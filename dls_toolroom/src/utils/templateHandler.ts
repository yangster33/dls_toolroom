// ===================== 通用模板处理工具 =====================

export interface TemplateHeaders {
  required: string[]
  optional?: string[]
}

export interface ValidationError {
  row: number
  message: string
}

export interface TemplateValidationResult<T> {
  isValid: boolean
  data: T[]
  errors: string[]
}

// ===================== 字段映射配置 =====================

export interface FieldMapping {
  aliases: string[]
  required?: boolean
  validator?: (value: string, rowIndex: number) => string | null
}

// ===================== 通用验证器 =====================

/**
 * 验证经纬度格式
 */
export function validateCoordinate(
  value: unknown,
  type: 'longitude' | 'latitude',
  rowIndex: number
): { valid: boolean; error?: string; value?: number } {
  const numValue = typeof value === 'number' ? value : parseFloat(String(value))

  if (isNaN(numValue)) {
    return { valid: false, error: `第 ${rowIndex + 1} 行：${type === 'longitude' ? '经度' : '纬度'}必须是数字` }
  }

  if (type === 'longitude' && (numValue < -180 || numValue > 180)) {
    return { valid: false, error: `第 ${rowIndex + 1} 行：经度必须在 -180 到 180 之间` }
  }

  if (type === 'latitude' && (numValue < -90 || numValue > 90)) {
    return { valid: false, error: `第 ${rowIndex + 1} 行：纬度必须在 -90 到 90 之间` }
  }

  return { valid: true, value: numValue }
}

/**
 * 通用行验证器
 */
export function validateRow(
  row: Record<string, string | number>,
  rowIndex: number,
  fieldMappings: Record<string, FieldMapping>
): { valid: boolean; data?: Record<string, unknown>; errors: string[] } {
  const data: Record<string, unknown> = {}
  const errors: string[] = []

  for (const [fieldName, mapping] of Object.entries(fieldMappings)) {
    // 尝试从多个别名中获取值
    let value = ''
    for (const alias of mapping.aliases) {
      if (row[alias] !== undefined && row[alias] !== null) {
        value = String(row[alias] || '').trim()
        break
      }
    }

    // 检查必填字段
    if (mapping.required && !value) {
      errors.push(`第 ${rowIndex + 1} 行：${fieldName}不能为空`)
      continue
    }

    // 自定义验证器
    if (mapping.validator && value) {
      const error = mapping.validator(value, rowIndex)
      if (error) {
        errors.push(error)
        continue
      }
    }

    // 尝试转换数值类型
    const numValue = Number(value)
    data[fieldName] = isNaN(numValue) ? value : numValue
  }

  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? data : undefined,
    errors,
  }
}

/**
 * 读取并验证模板数据（通用版本）
 */
export function readAndValidateTemplate<T extends Record<string, unknown>>(
  rows: Record<string, string | number>[],
  fieldMappings: Record<string, FieldMapping>,
  dataTransformer: (data: Record<string, unknown>) => T
): TemplateValidationResult<T> {
  const data: T[] = []
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const validation = validateRow(row, i, fieldMappings)

    if (validation.valid && validation.data) {
      try {
        data.push(dataTransformer(validation.data))
      } catch (error) {
        errors.push(`第 ${i + 1} 行：数据转换失败 - ${(error as Error).message}`)
      }
    } else if (validation.errors.length > 0) {
      errors.push(...validation.errors)
    }
  }

  return {
    isValid: errors.length === 0 && data.length > 0,
    data,
    errors,
  }
}

// ===================== 字段映射预设 =====================

// 经纬度点字段映射
export const COORDINATE_POINT_FIELDS: Record<string, FieldMapping> = {
  名称: {
    aliases: ['名称', 'name', 'Name'],
    required: true,
  },
  经度: {
    aliases: ['经度', 'longitude', 'Longitude', 'lon', 'Lon'],
    required: true,
    validator: (value, rowIndex) => {
      const result = validateCoordinate(value, 'longitude', rowIndex)
      return result.error || null
    },
  },
  纬度: {
    aliases: ['纬度', 'latitude', 'Latitude', 'lat', 'Lat'],
    required: true,
    validator: (value, rowIndex) => {
      const result = validateCoordinate(value, 'latitude', rowIndex)
      return result.error || null
    },
  },
}

// 地址字段映射
export const ADDRESS_FIELDS: Record<string, FieldMapping> = {
  名称: {
    aliases: ['名称', 'name', 'Name'],
    required: true,
  },
  省: {
    aliases: ['省', 'province', 'Province'],
    required: false,
  },
  市: {
    aliases: ['市', 'city', 'City'],
    required: false,
  },
  '区/县': {
    aliases: ['区/县', '区县', 'district', 'District'],
    required: false,
  },
  '乡/镇': {
    aliases: ['乡/镇', '乡镇', 'township', 'Township'],
    required: false,
  },
  '社区/村': {
    aliases: ['社区/村', '社区村', 'community', 'Community'],
    required: false,
  },
  地址: {
    aliases: ['地址', 'address', 'Address'],
    required: false,
  },
}

// ===================== 数据转换预设 =====================

export interface CoordinatePoint {
  name: string
  longitude: number
  latitude: number
}

export interface FullAddress {
  name: string
  province: string
  city: string
  district: string
  township: string
  community: string
  address: string
}

export function transformToCoordinatePoint(data: Record<string, unknown>): CoordinatePoint {
  return {
    name: String(data['名称'] || ''),
    longitude: Number(data['经度']) || 0,
    latitude: Number(data['纬度']) || 0,
  }
}

export function transformToFullAddress(data: Record<string, unknown>): FullAddress {
  return {
    name: String(data['名称'] || ''),
    province: String(data['省'] || ''),
    city: String(data['市'] || ''),
    district: String(data['区/县'] || ''),
    township: String(data['乡/镇'] || ''),
    community: String(data['社区/村'] || ''),
    address: String(data['地址'] || ''),
  }
}
