/**
 * 表格转 KML - 数据验证器
 */
import { parseColor } from './ColorParser'
import { TEMPLATE_HEADERS } from './TemplateExporter'

export interface PointRow {
  name: string
  lng: number
  lat: number
  folder: string
  color: string
}

export interface TableKmlReadResult {
  isValid: boolean
  points: PointRow[]
  errors: string[]
}

/**
 * 验证并读取 KML 模板数据
 */
export async function readAndValidateKmlTemplate(file: File): Promise<TableKmlReadResult> {
  const result: TableKmlReadResult = { isValid: false, points: [], errors: [] }

  try {
    const { readAndValidateTemplate } = await import('@/utils/TemplateReader')

    const templateResult = await readAndValidateTemplate(file, TEMPLATE_HEADERS, {
      validateRow: (row) => validateKmlRow(row as any),
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
      const lng = parseFloat(String(dataRow['经度'] ?? ''))
      const lat = parseFloat(String(dataRow['纬度'] ?? ''))
      const folder = String(dataRow['文件夹'] ?? '').trim() || defaultFolder
      const colorRaw = String(dataRow['颜色'] ?? '').trim()

      const parsedColor = parseColor(colorRaw) || '#FF0000'

      points.push({ name, lng, lat, folder, color: parsedColor })
    }

    result.points = points
    result.isValid = points.length > 0

    if (!result.isValid && result.errors.length === 0) {
      result.errors.push('未读取到任何有效数据行。')
    }

    return result
  } catch (error) {
    result.errors.push(
      `读取文件时发生错误：${error instanceof Error ? error.message : String(error)}`,
    )
    return result
  }
}

/**
 * 验证单行数据
 */
function validateKmlRow(row: Record<string, unknown>): string[] {
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
  const lng = parseFloat(lngStr)
  if (isNaN(lng)) {
    errors.push(`经度"${lngStr}"不是有效数字。`)
  } else if (lng < -180 || lng > 180) {
    errors.push(`经度 ${lng} 超出范围 (-180 ~ 180)。`)
  }

  // 验证纬度
  const lat = parseFloat(latStr)
  if (isNaN(lat)) {
    errors.push(`纬度"${latStr}"不是有效数字。`)
  } else if (lat < -90 || lat > 90) {
    errors.push(`纬度 ${lat} 超出范围 (-90 ~ 90)。`)
  }

  // 验证颜色
  if (colorRaw && !parseColor(colorRaw)) {
    errors.push(
      `颜色"${colorRaw}"无法识别。支持中文颜色名或十六进制（如"#FF0000"）。`,
    )
  }

  return errors
}
