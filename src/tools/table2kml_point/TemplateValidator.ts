/**
 * 表格转 KML - 数据验证器
 */
import { parseColor } from './ColorParser'
import { parseStrictNumber } from '@/utils/coordinateValue'
import { TEMPLATE_HEADERS } from './TemplateExporter'
import type { ProgressCallback } from '@/utils/progress'
import { isAbortError } from '@/utils/abort'

export interface PointRow {
  name: string
  lng: number
  lat: number
  folder: string
  /** 规范化后的 hex 颜色（如 '#FF0000'），用于 IconStyle 叠色与样式去重 */
  color: string
  /** 用户原始输入（如 '红色' / '深红' / '#FF0000'），用于判定是否走中文色名图钉。
   *  审计报告 P0-3：只用 color 判断会恒为 false，因为 color 已被规范化。 */
  colorRaw?: string
}

export interface TableKmlReadResult {
  isValid: boolean
  points: PointRow[]
  errors: string[]
}

/**
 * 验证并读取 KML 模板数据
 * @param onProgress 进度回调（C4 阶段 2，可选）
 * @param signal 取消信号（C4 收尾，可选）：已取消时以 AbortError 拒绝，不写入 errors
 */
export async function readAndValidateKmlTemplate(
  file: File,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<TableKmlReadResult> {
  const result: TableKmlReadResult = { isValid: false, points: [], errors: [] }

  try {
    const { readAndValidateTemplate } = await import('@/utils/TemplateReader')

    const templateResult = await readAndValidateTemplate(file, TEMPLATE_HEADERS, {
      validateRow: (row) => validateKmlRow(row as Record<string, unknown>),
      onProgress,
      signal,
    })

    if (!templateResult.isValid) {
      result.errors = templateResult.errors
      return result
    }

    // 转换数据格式
    const defaultFolder = '默认文件夹'
    const points: PointRow[] = []

    for (const dataRow of templateResult.dataRows) {
      const name = String(dataRow['名称'] ?? '').trim()
      const lng = parseStrictNumber(dataRow['经度'])
      const lat = parseStrictNumber(dataRow['纬度'])
      // 校验阶段已拦截无效坐标；此处显式跳过，避免写入 0 或 NaN
      if (lng === null || lat === null) continue
      const folder = String(dataRow['文件夹'] ?? '').trim() || defaultFolder
      const colorRaw = String(dataRow['颜色'] ?? '').trim()

      const parsedColor = parseColor(colorRaw) || '#FF0000'

      points.push({ name, lng, lat, folder, color: parsedColor, colorRaw })
    }

    result.points = points
    result.isValid = points.length > 0

    if (!result.isValid && result.errors.length === 0) {
      result.errors.push('未读取到任何有效数据行。')
    }

    return result
  } catch (error) {
    // 取消不是「读取失败」：原样抛给页面，让它静默收尾（不弹错误对话框）
    if (isAbortError(error)) throw error
    result.errors.push(
      `读取文件时发生错误：${error instanceof Error ? error.message : String(error)}`,
    )
    return result
  }
}

/**
 * 验证单行数据
 */
export function validateKmlRow(row: Record<string, unknown>): string[] {
  const errors: string[] = []

  const name = String(row['名称'] ?? '').trim()
  const lngStr = String(row['经度'] ?? '').trim()
  const latStr = String(row['纬度'] ?? '').trim()
  const colorRaw = String(row['颜色'] ?? '').trim()

  // 验证名称
  if (!name) {
    errors.push('名称为空。')
  }

  // 验证经度
  const lng = parseStrictNumber(lngStr)
  if (lng === null) {
    errors.push(`经度"${lngStr}"不是有效数字。`)
  } else if (lng < -180 || lng > 180) {
    errors.push(`经度 ${lng} 超出范围 (-180 ~ 180)。`)
  }

  // 验证纬度
  const lat = parseStrictNumber(latStr)
  if (lat === null) {
    errors.push(`纬度"${latStr}"不是有效数字。`)
  } else if (lat < -90 || lat > 90) {
    errors.push(`纬度 ${lat} 超出范围 (-90 ~ 90)。`)
  }

  // 验证颜色
  if (colorRaw && !parseColor(colorRaw)) {
    errors.push(`颜色"${colorRaw}"无法识别。支持中文颜色名或十六进制（如"#FF0000"）。`)
  }

  return errors
}
