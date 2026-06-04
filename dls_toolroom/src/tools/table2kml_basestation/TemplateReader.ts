/**
 * 基站扇区模板读取与验证
 */
import {
  readAndValidateTemplate,
  type TemplateReadResult,
  type CellValue,
} from '@/utils/TemplateReader'
import { TEMPLATE_HEADERS } from './TemplateExporter'

export interface BasestationRow {
  [key: string]: string | number | undefined
  扇区名称: string
  经度: number
  纬度: number
  方位角: number // 扇形对称线
  半功率角: number // 扇形总角度，从方位角向两边各偏移半功率角/2
  半径: number
  是否室分?: string
  区域?: string
  小区覆盖类型?: string
  厂家?: string
  天线挂高?: number
  带宽?: string
  收发模式?: string
  网管基站名?: string
  物理站名?: string
  颜色?: string
  半透明度?: number
  文件夹?: string
}

export interface BasestationReadResult {
  isValid: boolean
  dataRows: BasestationRow[]
  errors: string[]
  rawData: (string | number | boolean | null | undefined)[][]
}

/**
 * 验证单行数据
 */
function validateRow(row: any, rowIndex: number): string[] {
  const errors: string[] = []

  // 扇区名称（必填）
  if (!row['扇区名称'] || String(row['扇区名称']).trim() === '') {
    errors.push(`扇区名称不能为空`)
  }

  // 经度（必填，数字）
  const lng = parseFloat(String(row['经度'] ?? ''))
  if (isNaN(lng)) {
    errors.push(`经度必须是数字`)
  } else if (lng < -180 || lng > 180) {
    errors.push(`经度必须在-180到180之间`)
  }

  // 纬度（必填，数字）
  const lat = parseFloat(String(row['纬度'] ?? ''))
  if (isNaN(lat)) {
    errors.push(`纬度必须是数字`)
  } else if (lat < -90 || lat > 90) {
    errors.push(`纬度必须在-90到90之间`)
  }

  // 方位角（必填，数字）- 扇形对称线
  const azimuth = parseFloat(String(row['方位角'] ?? ''))
  if (isNaN(azimuth)) {
    errors.push(`方位角必须是数字`)
  } else if (azimuth < 0 || azimuth > 360) {
    errors.push(`方位角必须在0到360之间`)
  }

  // 半功率角（必填，数字）- 扇形总角度
  const halfPowerAngle = parseFloat(String(row['半功率角'] ?? ''))
  if (isNaN(halfPowerAngle)) {
    errors.push(`半功率角必须是数字`)
  } else if (halfPowerAngle <= 0 || halfPowerAngle >= 180) {
    errors.push(`半功率角必须大于0且小于180`)
  }

  // 半径（必填，数字）
  const radius = parseFloat(String(row['半径'] ?? ''))
  if (isNaN(radius)) {
    errors.push(`半径必须是数字`)
  } else if (radius <= 0) {
    errors.push(`半径必须大于0`)
  }

  // 是否室分（选填，只能是'是'或'否'）
  if (row['是否室分'] && String(row['是否室分']).trim() !== '') {
    const isIndoor = String(row['是否室分']).trim()
    if (!['是', '否'].includes(isIndoor)) {
      errors.push(`是否室分只能是"是"或"否"`)
    }
  }

  // 天线挂高（选填，数字）
  if (row['天线挂高'] && String(row['天线挂高']).trim() !== '') {
    const height = parseFloat(String(row['天线挂高']))
    if (isNaN(height)) {
      errors.push(`天线挂高必须是数字`)
    }
  }

  // 半透明度（选填，数字）
  if (row['半透明度'] && String(row['半透明度']).trim() !== '') {
    const opacity = parseFloat(String(row['半透明度']))
    if (isNaN(opacity)) {
      errors.push(`半透明度必须是数字`)
    } else if (opacity < 0 || opacity > 1) {
      errors.push(`半透明度必须在0到1之间`)
    }
  }

  // 颜色（选填，验证格式）
  if (row['颜色'] && String(row['颜色']).trim() !== '') {
    const color = String(row['颜色']).trim()
    if (
      !/^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$/.test(color) &&
      ![
        '红色',
        '蓝色',
        '绿色',
        '黄色',
        '粉色',
        '白色',
        'grn',
        'ylw',
        'red',
        'blue',
        'pink',
        'wht',
      ].includes(color.toLowerCase())
    ) {
      errors.push(`颜色格式不正确，请使用十六进制格式（如#FF0000）或中文颜色名`)
    }
  }

  return errors
}

/**
 * 读取并验证基站扇区模板
 */
export async function readAndValidateBasestationTemplate(
  file: File,
): Promise<BasestationReadResult> {
  const result = await readAndValidateTemplate(file, TEMPLATE_HEADERS, {
    validateRow,
    skipEmptyRows: true,
  })

  // 转换数据类型
  const dataRows: BasestationRow[] = result.dataRows.map((rawRow) => {
    const row: BasestationRow = {
      扇区名称: String(rawRow['扇区名称'] ?? ''),
      经度: parseFloat(String(rawRow['经度'] ?? '0')),
      纬度: parseFloat(String(rawRow['纬度'] ?? '0')),
      方位角: parseFloat(String(rawRow['方位角'] ?? '0')),
      半功率角: parseFloat(String(rawRow['半功率角'] ?? '0')),
      半径: parseFloat(String(rawRow['半径'] ?? '0')),
    }

    // 可选字段
    if (rawRow['是否室分'] && rawRow['是否室分'] !== '') row['是否室分'] = String(rawRow['是否室分'])
    if (rawRow['区域'] && rawRow['区域'] !== '') row['区域'] = String(rawRow['区域'])
    if (rawRow['小区覆盖类型'] && rawRow['小区覆盖类型'] !== '')
      row['小区覆盖类型'] = String(rawRow['小区覆盖类型'])
    if (rawRow['厂家'] && rawRow['厂家'] !== '') row['厂家'] = String(rawRow['厂家'])
    if (rawRow['天线挂高'] && rawRow['天线挂高'] !== '')
      row['天线挂高'] = parseFloat(String(rawRow['天线挂高']))
    if (rawRow['带宽'] && rawRow['带宽'] !== '') row['带宽'] = String(rawRow['带宽'])
    if (rawRow['收发模式'] && rawRow['收发模式'] !== '')
      row['收发模式'] = String(rawRow['收发模式'])
    if (rawRow['网管基站名'] && rawRow['网管基站名'] !== '')
      row['网管基站名'] = String(rawRow['网管基站名'])
    if (rawRow['物理站名'] && rawRow['物理站名'] !== '')
      row['物理站名'] = String(rawRow['物理站名'])
    if (rawRow['颜色'] && rawRow['颜色'] !== '') row['颜色'] = String(rawRow['颜色'])
    if (rawRow['半透明度'] && rawRow['半透明度'] !== '')
      row['半透明度'] = parseFloat(String(rawRow['半透明度']))
    if (rawRow['文件夹'] && rawRow['文件夹'] !== '') row['文件夹'] = String(rawRow['文件夹'])

    return row
  })

  return {
    isValid: result.isValid,
    dataRows,
    errors: result.errors,
    rawData: result.rawData,
  }
}

// 重新导出通用工具
export {
  readAndValidateTemplate,
  readTemplate,
  type CellValue,
  type TemplateReadResult,
} from '@/utils/TemplateReader'
