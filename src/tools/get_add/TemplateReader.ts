import { type TemplateValidationResult, COORDINATE_POINT_FIELDS } from '@/utils/templateHandler'
import type { CoordinatePoint } from '@/utils/templateHandler'
import { parseCoordinateValue } from '@/utils/coordinateValue'
import { yieldToUI } from '@/utils/yieldToUI'
import type { ProgressCallback } from '@/utils/progress'
import { throwIfAborted } from '@/utils/abort'

/** 行循环的让出粒度（C4 阶段 2）：按批而非逐行，避免微任务拖慢吞吐（计划风险 R4） */
const ROW_YIELD_INTERVAL = 500

// 重新导出类型
export type { CoordinatePoint, TemplateValidationResult }

// 使用通用验证函数
/**
 * 校验地址解析模板行
 *
 * C4 阶段 2：改为 async 并支持进度回调。让出放在循环**开头** ——
 * 校验失败的行会 `continue`，放在结尾会被整批跳过。
 *
 * @param onProgress 进度回调（可选，不传则行为与改造前一致）
 * @param signal 取消信号（C4 收尾，可选）：已取消时以 AbortError 拒绝
 */
export async function readAndValidateTemplate(
  rows: Record<string, string | number>[],
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<TemplateValidationResult<CoordinatePoint>> {
  const data: CoordinatePoint[] = []
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    if (i % ROW_YIELD_INTERVAL === 0) {
      await yieldToUI()
      // 与让出同频复查取消：否则点了「终止计算」还要跑完剩下几万行
      throwIfAborted(signal)
    }
    const percent = rows.length > 0 ? Math.round((i / rows.length) * 100) : 100
    onProgress?.(Math.min(99, percent), `正在校验第 ${i + 1} 行...`)

    const row = rows[i]
    if (!row) continue

    // 验证名称
    const nameField = COORDINATE_POINT_FIELDS['名称']
    if (!nameField) {
      errors.push(`第 ${i + 1} 行：配置错误，缺少名称字段`)
      continue
    }
    const nameAliases = nameField.aliases
    let name = ''
    for (const alias of nameAliases) {
      if (row[alias] !== undefined && row[alias] !== null) {
        name = String(row[alias] || '').trim()
        break
      }
    }

    if (!name) {
      errors.push(`第 ${i + 1} 行：名称不能为空`)
      continue
    }

    // 验证经度
    const lonField = COORDINATE_POINT_FIELDS['经度']
    if (!lonField) {
      errors.push(`第 ${i + 1} 行：配置错误，缺少经度字段`)
      continue
    }
    const lonAliases = lonField.aliases
    let longitude: number | null = null
    for (const alias of lonAliases) {
      const parsed = parseCoordinateValue(row[alias], -180, 180)
      if (parsed !== null) {
        longitude = parsed
        break
      }
    }

    if (longitude === null) {
      errors.push(`第 ${i + 1} 行：经度无效或超出范围 (-180 ~ 180)`)
      continue
    }

    // 验证纬度
    const latField = COORDINATE_POINT_FIELDS['纬度']
    if (!latField) {
      errors.push(`第 ${i + 1} 行：配置错误，缺少纬度字段`)
      continue
    }
    const latAliases = latField.aliases
    let latitude: number | null = null
    for (const alias of latAliases) {
      const parsed = parseCoordinateValue(row[alias], -90, 90)
      if (parsed !== null) {
        latitude = parsed
        break
      }
    }

    if (latitude === null) {
      errors.push(`第 ${i + 1} 行：纬度无效或超出范围 (-90 ~ 90)`)
      continue
    }

    data.push({
      name,
      longitude,
      latitude,
    })
  }

  onProgress?.(100, '校验完成')
  return {
    isValid: errors.length === 0 && data.length > 0,
    data,
    errors,
  }
}
