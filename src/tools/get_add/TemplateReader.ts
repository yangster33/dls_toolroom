import {
  type TemplateValidationResult,
  COORDINATE_POINT_FIELDS,
} from '@/utils/templateHandler'
import type { CoordinatePoint } from '@/utils/templateHandler'
import { parseCoordinateValue } from '@/utils/coordinateValue'

// 重新导出类型
export type { CoordinatePoint, TemplateValidationResult }

// 使用通用验证函数
export function readAndValidateTemplate(
  rows: Record<string, string | number>[]
): TemplateValidationResult<CoordinatePoint> {
  const data: CoordinatePoint[] = []
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
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

  return {
    isValid: errors.length === 0 && data.length > 0,
    data,
    errors,
  }
}
