/**
 * 模板矩阵解析（C4 阶段 4）
 *
 * 把「读文件 → XLSX.read → sheet_to_json → 表头」这段抽出来，**主线程路径与
 * Web Worker 路径共用同一份代码**：Worker 化的意义是让它跑在别的线程，
 * 而不是把逻辑复制一份。
 *
 * 这段是导入链路里最重的一步（5 万行的 `XLSX.read` + `sheet_to_json`
 * 是单一不可中断的同步块），因此也是唯一值得搬进 Worker 的部分；
 * 逐行校验仍在主线程（它带 validateRow 回调，无法结构化克隆进 Worker）。
 */
import * as XLSX from 'xlsx'
import { yieldToUI } from './yieldToUI'
import type { ProgressCallback } from './progress'

export interface TemplateMatrix {
  /** 二维原始数据，第 0 行是表头 */
  rawData: CellValue[][]
  /** 表头（trim 后） */
  fileHeaders: string[]
}

export type CellValue = string | number | boolean | null | undefined

/**
 * 解析上传的表格文件为二维矩阵。
 *
 * @param file 上传的 File
 * @param onProgress 进度回调（可选）
 */
export async function parseTemplateMatrix(
  file: File,
  onProgress?: ProgressCallback,
): Promise<TemplateMatrix> {
  onProgress?.(0, '正在读取文件...')
  const arrayBuffer = await file.arrayBuffer()
  onProgress?.(20, '正在解析表格...')
  // XLSX.read 是单一同步块：先让出一帧，让 UI 把「正在解析表格」画出来
  await yieldToUI()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('文件中未找到有效的工作表。')
  }

  const worksheet = workbook.Sheets[firstSheetName]
  if (!worksheet) {
    throw new Error('无法读取工作表内容。')
  }

  const rawData: CellValue[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

  if (rawData.length === 0) {
    // 文案与改造前保持一致（旧实现是 '文件为空或无法读取。'，外层会再加前缀）
    throw new Error('文件为空或无法读取。')
  }

  const fileHeaders: string[] = (rawData[0] || []).map((h) => String(h || '').trim())
  onProgress?.(30, '表格解析完成')

  return { rawData, fileHeaders }
}
