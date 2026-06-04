import {
  type TemplateValidationResult,
  COORDINATE_POINT_FIELDS,
} from '@/utils/templateHandler'
import type { CoordinatePoint } from '@/utils/templateHandler'

export type { CoordinatePoint, TemplateValidationResult }

export function readAndValidateTemplate(
  rows: Record<string, string | number>[],
): TemplateValidationResult<CoordinatePoint> {
  const data: CoordinatePoint[] = []
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

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

    const lonField = COORDINATE_POINT_FIELDS['经度']
    if (!lonField) {
      errors.push(`第 ${i + 1} 行：配置错误，缺少经度字段`)
      continue
    }
    const lonAliases = lonField.aliases
    let longitude: number | null = null
    for (const alias of lonAliases) {
      if (row[alias] !== undefined && row[alias] !== null) {
        const val = Number(row[alias])
        if (!isNaN(val) && val >= -180 && val <= 180) {
          longitude = val
          break
        }
      }
    }

    if (longitude === null) {
      errors.push(`第 ${i + 1} 行：经度无效或超出范围 (-180 ~ 180)`)
      continue
    }

    const latField = COORDINATE_POINT_FIELDS['纬度']
    if (!latField) {
      errors.push(`第 ${i + 1} 行：配置错误，缺少纬度字段`)
      continue
    }
    const latAliases = latField.aliases
    let latitude: number | null = null
    for (const alias of latAliases) {
      if (row[alias] !== undefined && row[alias] !== null) {
        const val = Number(row[alias])
        if (!isNaN(val) && val >= -90 && val <= 90) {
          latitude = val
          break
        }
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