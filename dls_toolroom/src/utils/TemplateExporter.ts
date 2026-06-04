/**
 * 模板导出工具 - 通用版本
 * 支持 CSV 和 XLSX 文件的生成和导出
 */
import * as XLSX from 'xlsx'
import { logger } from './logger'

/**
 * CSV 字段转义
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * 生成 CSV 内容（带 BOM）
 * @param headers 表头数组
 * @param dataRows 数据行数组（可选）
 * @returns CSV 字符串
 */
export function generateCsv(headers: string[], dataRows?: string[][]): string {
  if (!headers || headers.length === 0) {
    return ''
  }

  const rows: string[][] = [headers]
  if (dataRows && dataRows.length > 0) {
    rows.push(...dataRows)
  }

  const csvContent = rows.map((row) => row.map(escapeCsvField).join(',')).join('\n')
  // 添加 UTF-8 BOM 以解决中文编码问题
  return '\uFEFF' + csvContent
}

/**
 * 生成 XLSX Blob
 * @param headers 表头数组
 * @param dataRows 数据行数组（可选）
 * @param sheetName 工作表名称
 * @returns XLSX Blob
 */
export function generateXlsx(
  headers: string[],
  dataRows?: string[][],
  sheetName: string = 'Sheet1',
): Blob {
  if (!headers || headers.length === 0) {
    return new Blob([], { type: 'application/octet-stream' })
  }

  const workbook = XLSX.utils.book_new()
  const worksheetData = [headers, ...(dataRows || [])]
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

  // 设置列宽
  const colWidths = headers.map((header) => ({
    wch: Math.max(header.length, 10),
  }))
  worksheet['!cols'] = colWidths

  // 为有内容的单元格添加边框
  const borderStyle = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  }

  // 遍历所有单元格
  for (const key in worksheet) {
    // 跳过特殊属性（以 ! 开头的）
    if (key.startsWith('!')) continue

    const cell = worksheet[key]
    // 如果单元格有值（v 属性），添加边框样式
    if (cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
      cell.s = cell.s || {}
      cell.s.border = borderStyle
    }
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const wbout = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    bookSST: false,
  })

  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/**
 * 触发文件下载
 * @param content 文件内容（字符串或 Blob）
 * @param filename 文件名
 * @param type 文件类型
 */
function triggerDownload(content: string | Blob, filename: string, type: 'csv' | 'xlsx'): void {
  let blob: Blob
  let fullFilename = filename

  // 确保文件名有正确的扩展名
  if (!fullFilename.toLowerCase().endsWith(`.${type}`)) {
    fullFilename += `.${type}`
  }

  if (typeof content === 'string') {
    blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  } else {
    blob = content
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fullFilename)
  document.body.appendChild(link)
  link.click()

  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 100)
}

/**
 * 导出模板文件（仅表头）
 * @param headers 表头数组
 * @param format 文件格式
 * @param filename 文件名（不含扩展名）
 */
export function exportTemplate(
  headers: string[],
  format: 'csv' | 'xlsx',
  filename: string = 'template',
): void {
  if (!headers || headers.length === 0) {
    logger.warn('表头数组为空，无法导出文件')
    return
  }

  try {
    if (format === 'csv') {
      const csvContent = generateCsv(headers)
      triggerDownload(csvContent, filename, 'csv')
    } else if (format === 'xlsx') {
      const xlsxBlob = generateXlsx(headers)
      triggerDownload(xlsxBlob, filename, 'xlsx')
    }
  } catch (error) {
    logger.error(`导出${format.toUpperCase()}文件时出错:`, error)
  }
}

/**
 * 导出带数据的文件
 * @param headers 表头数组
 * @param dataRows 数据行数组
 * @param format 文件格式
 * @param filename 文件名
 */
export function exportData(
  headers: string[],
  dataRows: string[][],
  format: 'csv' | 'xlsx',
  filename: string = 'export',
): void {
  if (!headers || headers.length === 0) {
    logger.warn('表头数组为空，无法导出文件')
    return
  }

  try {
    if (format === 'csv') {
      const csvContent = generateCsv(headers, dataRows)
      triggerDownload(csvContent, filename, 'csv')
    } else if (format === 'xlsx') {
      const xlsxBlob = generateXlsx(headers, dataRows)
      triggerDownload(xlsxBlob, filename, 'xlsx')
    }
  } catch (error) {
    logger.error(`导出${format.toUpperCase()}文件时出错:`, error)
  }
}

/**
 * 导出模板文件（兼容旧版本）
 * @deprecated 请使用 exportTemplate
 */
export function exportTable(
  headers: string[],
  format: 'csv' | 'xlsx',
  filename: string = 'template',
): void {
  exportTemplate(headers, format, filename)
}

/**
 * 下载 CSV 模板（兼容 table2kml）
 */
export function downloadCsvTemplate(): void {
  const headers = ['名称', '经度', '纬度', '文件夹', '颜色']
  const sampleRow = ['示例点位', '116.397428', '39.909204', '北京', '红色']
  const csvContent = generateCsv(headers, [sampleRow])
  triggerDownload(csvContent, '点位导入模板', 'csv')
}

/**
 * 下载 XLSX 模板（兼容 table2kml）
 */
export function downloadXlsxTemplate(): void {
  const headers = ['名称', '经度', '纬度', '文件夹', '颜色']
  const sampleRow = ['示例点位', '116.397428', '39.909204', '北京', '红色']
  const xlsxBlob = generateXlsx(headers, [sampleRow])
  triggerDownload(xlsxBlob, '点位导入模板', 'xlsx')
}
