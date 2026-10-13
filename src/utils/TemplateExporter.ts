/**
 * 模板导出工具 - 通用版本
 * 支持 CSV 和 XLSX 文件的生成和导出
 *
 * C4 阶段 3：XLSX 生成已迁到 `./exceljsPipeline`（exceljs 逐行写入 + 分片让出），
 * 本文件不再直接依赖 xlsx 库。
 */
import { logger } from './logger'
import { pushAll } from './arrayUtils'
import type { ProgressCallback } from './progress'
import { writeXlsx } from './exceljsPipeline'

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
 * C4 阶段 3：改用 `utils/exceljsPipeline` 的 exceljs 管线。
 * 旧实现是 `aoa_to_sheet(全量)` + `XLSX.write`：两步都是一次性不可中断的同步块，
 * 5 万行能把主线程卡死数秒。exceljs 支持逐行 `addRow`，于是写工作表阶段就能分批让出。
 *
 * 产物一致性（值/列宽/表名）由 `utils/__tests__/exceljsPipeline.spec.ts` 守住。
 * 已知偏差：旧实现那段「为有内容的单元格添加边框」其实是**死代码** ——
 * xlsx@0.18.5 会把单元格样式整体丢弃（见该 spec 顶部说明），所以新实现是
 * 第一次让边框真正生效。这是有意的行为修正，已在实施记录中留痕。
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

  // border 关闭：见 docs/2026-10-12-c4-fix-record.md「阶段 3 · 性能实测」。
  // 旧实现那段「给有内容单元格加边框」从未真正生效（xlsx 会把单元格样式整体丢弃），
  // 在 exceljs 里打开它会让 5万×9 的总耗时从 1987ms 涨到 2967ms（+50%）。
  // 管线的 border 能力保留为 opt-in，确认要修那个老 bug 时改成 true 即可。
  return writeXlsx([{ name: sheetName, headers, rows: dataRows ?? [] }], onProgress)
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
