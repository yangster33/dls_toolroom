/**
 * 模板导出工具 - 通用版本
 * 支持 CSV 和 XLSX 文件的生成和导出
 */
import * as XLSX from 'xlsx'
import { logger } from './logger'
import { pushAll } from './arrayUtils'
import { yieldToUI } from './yieldToUI'
import type { ProgressCallback } from './progress'

/**
 * 边框遍历的让出粒度：每处理这么多单元格让出一次主线程。
 * 5 万行 × 3 列 = 15 万单元格 → 约 30 次让出，开销可忽略。
 */
const BORDER_YIELD_INTERVAL = 5000

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
    pushAll(rows, dataRows)
  }

  const csvContent = rows.map((row) => row.map(escapeCsvField).join(',')).join('\n')
  // 添加 UTF-8 BOM 以解决中文编码问题
  return '\uFEFF' + csvContent
}

/**
 * 生成 XLSX Blob
 *
 * C4 阶段 2：改为 async —— 边框遍历按批 `await yieldToUI()`，
 * 让进度条能逐格推进、页面在处理大表时仍可交互。
 * `XLSX.write` 本身是不可中断的同步块（彻底根治需阶段 3 的 streaming writer）。
 *
 * @param headers 表头数组
 * @param dataRows 数据行数组（可选）
 * @param sheetName 工作表名称
 * @param onProgress 进度回调（可选，默认不传则行为不变）
 * @returns XLSX Blob
 */
export async function generateXlsx(
  headers: string[],
  dataRows?: string[][],
  sheetName: string = 'Sheet1',
  onProgress?: ProgressCallback,
): Promise<Blob> {
  if (!headers || headers.length === 0) {
    return new Blob([], { type: 'application/octet-stream' })
  }

  onProgress?.(0, '正在整理数据...')
  await yieldToUI()

  const workbook = XLSX.utils.book_new()
  const worksheetData = [headers].concat(dataRows || [])
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

  // 遍历所有单元格。进度按「已处理单元格 / 估算总单元格」映射到 30~90。
  const estimatedCells = Math.max(worksheetData.length * headers.length, 1)
  let processedCells = 0
  let lastReportedPercent = 30

  for (const key in worksheet) {
    // 跳过特殊属性（以 ! 开头的）
    if (key.startsWith('!')) continue

    const cell = worksheet[key]
    // 如果单元格有值（v 属性），添加边框样式
    if (cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
      cell.s = cell.s || {}
      cell.s.border = borderStyle
    }

    processedCells++
    if (processedCells % BORDER_YIELD_INTERVAL === 0) {
      await yieldToUI()
      const percent = Math.min(90, 30 + Math.round((processedCells / estimatedCells) * 60))
      if (percent !== lastReportedPercent) {
        lastReportedPercent = percent
        onProgress?.(percent, '正在设置单元格样式...')
      }
    }
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  // XLSX.write 是单一不可中断的同步块：先上报 + 让出一帧，让 UI 画出"正在生成文件"
  onProgress?.(95, '正在生成文件...')
  await yieldToUI()

  const wbout = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    bookSST: false,
  })

  onProgress?.(100, '生成完成')
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
export async function exportTemplate(
  headers: string[],
  format: 'csv' | 'xlsx',
  filename: string = 'template',
  onProgress?: ProgressCallback,
): Promise<void> {
  if (!headers || headers.length === 0) {
    logger.warn('表头数组为空，无法导出文件')
    return
  }

  try {
    if (format === 'csv') {
      const csvContent = generateCsv(headers)
      triggerDownload(csvContent, filename, 'csv')
    } else if (format === 'xlsx') {
      const xlsxBlob = await generateXlsx(headers, undefined, 'Sheet1', onProgress)
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
 * @param onProgress 进度回调（可选）
 */
export async function exportData(
  headers: string[],
  dataRows: string[][],
  format: 'csv' | 'xlsx',
  filename: string = 'export',
  onProgress?: ProgressCallback,
): Promise<void> {
  if (!headers || headers.length === 0) {
    logger.warn('表头数组为空，无法导出文件')
    return
  }

  try {
    if (format === 'csv') {
      const csvContent = generateCsv(headers, dataRows)
      triggerDownload(csvContent, filename, 'csv')
    } else if (format === 'xlsx') {
      const xlsxBlob = await generateXlsx(headers, dataRows, 'Sheet1', onProgress)
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
): Promise<void> {
  return exportTemplate(headers, format, filename)
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
 * @param onProgress 进度回调（可选，默认不传则行为不变）
 */
export async function downloadXlsxTemplate(onProgress?: ProgressCallback): Promise<void> {
  const headers = ['名称', '经度', '纬度', '文件夹', '颜色']
  const sampleRow = ['示例点位', '116.397428', '39.909204', '北京', '红色']
  const xlsxBlob = await generateXlsx(headers, [sampleRow], 'Sheet1', onProgress)
  triggerDownload(xlsxBlob, '点位导入模板', 'xlsx')
}
