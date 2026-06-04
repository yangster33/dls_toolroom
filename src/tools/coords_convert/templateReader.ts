/**
 * 模板读取 - 批量坐标转换专用验证器
 */
import { readAndValidateTemplate as readGenericTemplate } from '@/utils/TemplateReader'

// 批量坐标转换的表头（原地迁移自已删除的 templateExporter.ts）
export const COORD_CONVERT_HEADERS = ['名称', '经度/X（必填）', '纬度/Y（必填）']

export interface CoordDataRow {
  [key: string]: string | number | boolean | null | undefined
}

export interface CoordReadResult {
  isValid: boolean
  dataRows: CoordDataRow[]
  errors: string[]
  rawData: (string | number | boolean | null | undefined)[][]
}

/**
 * 读取并验证坐标转换模板
 */
export async function readAndValidateCoordTemplate(
  file: File,
  coordinateSystemType: string,
): Promise<CoordReadResult> {
  const result: CoordReadResult = {
    isValid: false,
    dataRows: [],
    errors: [],
    rawData: [],
  }

  try {
    // 判断坐标系类型
    const isLngLatMode =
      coordinateSystemType.includes('lnglat') ||
      coordinateSystemType === 'wgs84' ||
      coordinateSystemType === 'gcj02' ||
      coordinateSystemType === 'bd09' ||
      coordinateSystemType === 'amap'

    const isXYMode = coordinateSystemType.includes('xy')

    const templateResult = await readGenericTemplate(file, COORD_CONVERT_HEADERS, {
      validateRow: (row) => validateCoordRow(row as any, isLngLatMode, isXYMode),
    })

    if (!templateResult.isValid) {
      result.errors = templateResult.errors
      return result
    }

    result.dataRows = templateResult.dataRows
    result.rawData = templateResult.rawData
    result.isValid = true

    return result
  } catch (error) {
    result.errors.push(
      `读取文件时发生错误：${error instanceof Error ? error.message : String(error)}`,
    )
    return result
  }
}

/**
 * 验证坐标数据行
 */
function validateCoordRow(
  row: { [key: string]: string | number | boolean | null | undefined },
  isLngLatMode: boolean,
  isXYMode: boolean,
): string[] {
  const errors: string[] = []

  const lngVal = row['经度/X（必填）']
  const latVal = row['纬度/Y（必填）']

  if (isLngLatMode) {
    // 经纬度模式验证
    const lngNum = typeof lngVal === 'number' ? lngVal : parseFloat(String(lngVal || ''))
    const latNum = typeof latVal === 'number' ? latVal : parseFloat(String(latVal || ''))

    if (isNaN(lngNum)) {
      errors.push(`经度"${lngVal}"不是有效的数字。`)
    } else if (lngNum < -180 || lngNum > 180) {
      errors.push(`经度值 ${lngNum} 超出有效范围 (-180 ~ 180)。`)
    }

    if (isNaN(latNum)) {
      errors.push(`纬度"${latVal}"不是有效的数字。`)
    } else if (latNum < -90 || latNum > 90) {
      errors.push(`纬度值 ${latNum} 超出有效范围 (-90 ~ 90)。`)
    }
  } else if (isXYMode) {
    // 平面坐标模式验证
    const xNum = typeof lngVal === 'number' ? lngVal : parseFloat(String(lngVal || ''))
    const yNum = typeof latVal === 'number' ? latVal : parseFloat(String(latVal || ''))

    if (isNaN(xNum)) {
      errors.push(`X 坐标"${lngVal}"不是有效的数字。`)
    }
    if (isNaN(yNum)) {
      errors.push(`Y 坐标"${latVal}"不是有效的数字。`)
    }
  }

  return errors
}

// 重新导出通用工具
export {
  readAndValidateTemplate,
  readTemplate,
  type CellValue,
  type DataRow,
  type TemplateReadResult,
} from '@/utils/TemplateReader'
