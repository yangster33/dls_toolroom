/**
 * 模板读取与验证工具 - 通用版本
 * 支持 CSV 和 XLSX 文件的读取和数据验证
 */
import { pushAll } from './arrayUtils'
import { yieldToUI } from './yieldToUI'
import type { ProgressCallback } from './progress'
import type { TemplateMatrix } from './templateMatrix'
import { filePipeline } from './filePipelineClient'

/**
 * 行循环的让出粒度：每处理这么多行让出一次主线程。
 * 按**批**而非逐行：逐行 yield 会产生几万次微任务，反而拖慢整体吞吐（计划风险 R4）。
 */
const ROW_YIELD_INTERVAL = 500

/**
 * 单元格值类型
 */
export type CellValue = string | number | boolean | null | undefined

/**
 * 数据行类型
 */
export interface DataRow {
  [key: string]: CellValue
}

/**
 * 模板验证结果
 */
export interface TemplateReadResult {
  isValid: boolean
  dataRows: DataRow[]
  errors: string[]
  rawData: CellValue[][]
}

/**
 * 读取并验证模板文件 - 支持灵活的字段顺序
 * @param file 上传的 File 对象
 * @param expectedHeaders 预期的表头数组
 * @param options 验证选项
 * @returns 验证结果
 */
export async function readAndValidateTemplate(
  file: File,
  expectedHeaders: string[],
  options?: {
    validateRow?: (row: DataRow, rowIndex: number) => string[]
    skipEmptyRows?: boolean
    /** 进度回调（C4 阶段 2）。不传则行为与改造前完全一致 */
    onProgress?: ProgressCallback
  },
): Promise<TemplateReadResult> {
  const result: TemplateReadResult = {
    isValid: false,
    dataRows: [],
    errors: [],
    rawData: [],
  }

  const { validateRow, skipEmptyRows = true, onProgress } = options || {}

  try {
    // 1. 读取并解析文件 —— 这一步（XLSX.read + sheet_to_json）是不可中断的重活，
    // 阶段 4 起搬进 filePipeline Worker；Worker 不可用时自动退回主线程，行为一致。
    let matrix: TemplateMatrix
    try {
      matrix = await filePipeline.parse(file, onProgress)
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error))
      return result
    }

    const rawData = matrix.rawData
    result.rawData = rawData
    const fileHeaders = matrix.fileHeaders

    // 2. 检查所有必需字段是否都存在（不要求顺序）
    const missingHeaders = expectedHeaders.filter((expected) => {
      const trimmedExpected = expected.trim()
      return !fileHeaders.includes(trimmedExpected)
    })

    if (missingHeaders.length > 0) {
      result.errors.push(`缺少必要的字段：${missingHeaders.join('、')}`)
      return result
    }

    // 构建字段名到列索引的映射
    const headerIndexMap = new Map<string, number>()
    fileHeaders.forEach((header, index) => {
      headerIndexMap.set(header, index)
    })

    // 3. 遍历数据行
    // XLSX.read + sheet_to_json 是不可中断的同步块，先让出一帧，
    // 让 UI 把「正在校验数据」画出来（审计缺陷 B 的同类问题）。
    onProgress?.(30, '正在校验数据...')
    await yieldToUI()

    const totalRows = rawData.length - 1
    let lastReportedPercent = 30

    for (let rowIndex = 1; rowIndex < rawData.length; rowIndex++) {
      // 让出放在循环**开头**：校验失败的行会 `continue`，放在结尾会被整批跳过，
      // 一份「全是坏行」的文件就会退化成同步阻塞。
      if ((rowIndex - 1) % ROW_YIELD_INTERVAL === 0) {
        await yieldToUI()
      }
      if (totalRows > 0) {
        const percent = Math.round(((rowIndex - 1) / totalRows) * 70) + 30
        if (percent !== lastReportedPercent) {
          lastReportedPercent = percent
          onProgress?.(Math.min(99, percent), `正在校验第 ${rowIndex + 1} 行...`)
        }
      }

      const rawRow = rawData[rowIndex]!
      const rowNum = rowIndex + 1

      // 跳过空行
      if (
        skipEmptyRows &&
        (!rawRow ||
          rawRow.every((cell) => cell === undefined || cell === null || String(cell).trim() === ''))
      ) {
        continue
      }

      // 构建数据行对象（按预期表头顺序整理数据）
      const rowData: DataRow = {}
      expectedHeaders.forEach((expectedHeader) => {
        const trimmedExpected = expectedHeader.trim()
        const colIndex = headerIndexMap.get(trimmedExpected)
        const cellValue = colIndex !== undefined ? rawRow[colIndex] : undefined
        rowData[expectedHeader] = cellValue === null ? undefined : cellValue
      })

      // 自定义行验证
      const rowErrors = validateRow ? validateRow(rowData, rowIndex) : []
      if (rowErrors.length > 0) {
        pushAll(
          result.errors,
          rowErrors.map((err) => `第 ${rowNum} 行：${err}`),
        )
        continue
      }

      result.dataRows.push(rowData)
    }

    // 4. 最终判定
    onProgress?.(100, '校验完成')
    result.isValid = result.errors.length === 0
    return result
  } catch (error) {
    result.errors.push(
      `读取文件时发生错误：${error instanceof Error ? error.message : String(error)}`,
    )
    return result
  }
}

/**
 * 读取模板文件（不进行验证）
 * @param file 上传的 File 对象
 * @param onProgress 进度回调（C4 阶段 2，可选）
 * @returns 原始数据
 */
export async function readTemplate(
  file: File,
  onProgress?: ProgressCallback,
): Promise<{
  headers: CellValue[]
  dataRows: DataRow[]
  rawData: CellValue[][]
}> {
  // 解析这一步在 filePipeline Worker 里跑（不可用时自动降级回主线程）
  const { rawData, fileHeaders } = await filePipeline.parse(file, onProgress)
  const headers = rawData[0] || fileHeaders
  const dataRows: DataRow[] = []

  onProgress?.(30, '正在整理数据...')
  await yieldToUI()

  const totalRows = rawData.length - 1
  let lastReportedPercent = 30

  for (let i = 1; i < rawData.length; i++) {
    if ((i - 1) % ROW_YIELD_INTERVAL === 0) {
      await yieldToUI()
    }
    if (totalRows > 0) {
      const percent = Math.round(((i - 1) / totalRows) * 70) + 30
      if (percent !== lastReportedPercent) {
        lastReportedPercent = percent
        onProgress?.(Math.min(99, percent), `正在整理第 ${i + 1} 行...`)
      }
    }

    const row = rawData[i]
    if (
      !row ||
      row.every((cell) => cell === undefined || cell === null || String(cell).trim() === '')
    ) {
      continue
    }

    const rowData: DataRow = {}
    headers.forEach((header, colIndex) => {
      rowData[String(header)] = row[colIndex]
    })
    dataRows.push(rowData)
  }

  onProgress?.(100, '整理完成')
  return { headers, dataRows, rawData }
}
