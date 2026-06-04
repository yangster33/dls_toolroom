/**
 * 模板读取与验证工具 - 通用版本
 * 支持 CSV 和 XLSX 文件的读取和数据验证
 */
import * as XLSX from 'xlsx'

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
  },
): Promise<TemplateReadResult> {
  const result: TemplateReadResult = {
    isValid: false,
    dataRows: [],
    errors: [],
    rawData: [],
  }

  const { validateRow, skipEmptyRows = true } = options || {}

  try {
    // 1. 读取文件
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    // 获取第一个工作表
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      result.errors.push('文件中未找到有效的工作表。')
      return result
    }

    const worksheet = workbook.Sheets[firstSheetName]
    if (!worksheet) {
      result.errors.push('无法读取工作表内容。')
      return result
    }

    // 转换为二维数组
    const rawData: CellValue[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    if (rawData.length === 0) {
      result.errors.push('文件为空或无法读取。')
      return result
    }

    result.rawData = rawData
    const fileHeaders: string[] = (rawData[0] || []).map(h => String(h || '').trim())

    // 2. 检查所有必需字段是否都存在（不要求顺序）
    const missingHeaders = expectedHeaders.filter(expected => {
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
    for (let rowIndex = 1; rowIndex < rawData.length; rowIndex++) {
      const rawRow = rawData[rowIndex]!
      const rowNum = rowIndex + 1

      // 跳过空行
      if (
        skipEmptyRows &&
        (!rawRow || rawRow.every((cell) => cell === undefined || cell === null || String(cell).trim() === ''))
      ) {
        continue
      }

      // 构建数据行对象（按预期表头顺序整理数据）
      const rowData: DataRow = {}
      expectedHeaders.forEach(expectedHeader => {
        const trimmedExpected = expectedHeader.trim()
        const colIndex = headerIndexMap.get(trimmedExpected)
        const cellValue = colIndex !== undefined ? rawRow[colIndex] : undefined
        rowData[expectedHeader] = cellValue === null ? undefined : cellValue
      })

      // 自定义行验证
      const rowErrors = validateRow ? validateRow(rowData, rowIndex) : []
      if (rowErrors.length > 0) {
        result.errors.push(...rowErrors.map((err) => `第 ${rowNum} 行：${err}`))
        continue
      }

      result.dataRows.push(rowData)
    }

    // 4. 最终判定
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
 * @returns 原始数据
 */
export async function readTemplate(file: File): Promise<{
  headers: CellValue[]
  dataRows: DataRow[]
  rawData: CellValue[][]
}> {
  const arrayBuffer = await file.arrayBuffer()
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
    throw new Error('文件为空。')
  }

  const headers = rawData[0] || []
  const dataRows: DataRow[] = []

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i]
    if (!row || row.every((cell) => cell === undefined || cell === null || String(cell).trim() === '')) {
      continue
    }

    const rowData: DataRow = {}
    headers.forEach((header, colIndex) => {
      rowData[String(header)] = row[colIndex]
    })
    dataRows.push(rowData)
  }

  return { headers, dataRows, rawData }
}
