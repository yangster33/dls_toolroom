/**
 * 模板读取 - 批量坐标转换专用验证器
 */
import { readAndValidateTemplate as readGenericTemplate } from '@/utils/TemplateReader'
import { parseStrictNumber } from '@/utils/coordinateValue'
import type { ProgressCallback } from '@/utils/progress'
import { isAbortError } from '@/utils/abort'

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
 * @param onProgress 进度回调（C4 阶段 2，可选）
 * @param signal 取消信号（C4 收尾，可选）：已取消时以 AbortError 拒绝，不写入 errors
 */
export async function readAndValidateCoordTemplate(
  file: File,
  coordinateSystemType: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
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
      validateRow: (row) => validateCoordRow(row, isLngLatMode, isXYMode),
      onProgress,
      signal,
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
    // 取消不是「读取失败」：原样抛给页面，让它静默收尾（不弹错误对话框）
    if (isAbortError(error)) throw error
    result.errors.push(
      `读取文件时发生错误：${error instanceof Error ? error.message : String(error)}`,
    )
    return result
  }
}

/**
 * 验证坐标数据行
 */
export function validateCoordRow(
  row: { [key: string]: string | number | boolean | null | undefined },
  isLngLatMode: boolean,
  isXYMode: boolean,
): string[] {
  const errors: string[] = []

  const lngVal = row['经度/X（必填）']
  const latVal = row['纬度/Y（必填）']

  if (isLngLatMode) {
    // 经纬度模式验证
    const lngNum = parseStrictNumber(lngVal)
    const latNum = parseStrictNumber(latVal)

    if (lngNum === null) {
      errors.push(`经度"${lngVal}"不是有效的数字。`)
    } else if (lngNum < -180 || lngNum > 180) {
      errors.push(`经度值 ${lngNum} 超出有效范围 (-180 ~ 180)。`)
    }

    if (latNum === null) {
      errors.push(`纬度"${latVal}"不是有效的数字。`)
    } else if (latNum < -90 || latNum > 90) {
      errors.push(`纬度值 ${latNum} 超出有效范围 (-90 ~ 90)。`)
    }
  } else if (isXYMode) {
    // 平面坐标模式验证
    const xNum = parseStrictNumber(lngVal)
    const yNum = parseStrictNumber(latVal)

    if (xNum === null) {
      errors.push(`X 坐标"${lngVal}"不是有效的数字。`)
    }
    if (yNum === null) {
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
