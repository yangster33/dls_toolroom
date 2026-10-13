import { rowsFromObjects, writeXlsx } from '@/utils/exceljsPipeline'
import { convert, type CoordinateSystemType, COORDINATE_SYSTEMS } from '@/utils/coordinateConverter'
import { parseStrictNumber } from '@/utils/coordinateValue'
import {
  type CGCS2000Params,
  DEFAULT_CGCS2000_PARAMS,
  computeCentralMeridian,
} from '@/utils/coordTransform'

export {
  type CGCS2000Params,
  DEFAULT_CGCS2000_PARAMS,
  computeCentralMeridian,
} from '@/utils/coordTransform'

export interface ConversionResult {
  success: boolean
  data: DataRow[]
  outputHeaders: string[]
  errors: string[]
  totalRows: number
  processedRows: number
}

export interface DataRow {
  [key: string]: CellValue
}

type CellValue = string | number | boolean | null | undefined

export interface ConversionProgressInfo {
  progress: number
  processedRows: number
  totalRows: number
  elapsedTime: number
  estimatedRemainingTime: number
}

/**
 * 裁决「该用哪个输入坐标系来解释已上传的数据」（审计 C2 / P0-5 余项）。
 *
 * 数据是按**上传当时**的坐标系校验的（经纬度模式与 XY 模式的列语义、取值范围
 * 都不同）。若用户上传后改了输入坐标系，内存里的已校验数据会被按新系统解释，
 * 静默产出错误坐标 —— 这正是 P0-5 遗留的那一半（阶段 2 只修了 CGCS2000 的 NaN）。
 *
 * 规则：
 * - 有上传快照时，`effectiveSystem` **一律**取快照（上传时的口径）；
 * - 快照与当前选择不一致时置 `mismatched`，交由 UI 显式告知，
 *   既不静默按新系统解释，也不自作主张废掉用户上传的文件。
 *
 * @param uploadedSystem 上传时锁定的输入坐标系（空串表示尚无成功上传的数据）
 * @param currentSystem  用户当前在下拉里选的输入坐标系
 */
export function resolveInputSystem(
  uploadedSystem: string,
  currentSystem: string,
): { effectiveSystem: string; mismatched: boolean } {
  if (!uploadedSystem) {
    // 还没有成功上传的数据：用当前选择
    return { effectiveSystem: currentSystem, mismatched: false }
  }
  return {
    effectiveSystem: uploadedSystem,
    mismatched: uploadedSystem !== currentSystem,
  }
}

export interface ConversionOptions {
  inputSystem: string
  outputSystem: string
  cgcs2000Params?: CGCS2000Params
  abortSignal?: AbortSignal
  batchSize?: number
  onProgress?: (info: ConversionProgressInfo) => void
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function batchConvertCoordinates(
  dataRows: DataRow[],
  options: ConversionOptions,
): Promise<ConversionResult> {
  const result: ConversionResult = {
    success: false,
    data: [],
    outputHeaders: [],
    errors: [],
    totalRows: dataRows.length,
    processedRows: 0,
  }

  try {
    if (!dataRows || dataRows.length === 0) {
      result.errors.push('没有可转换的数据')
      return result
    }

    const inputSystem = options.inputSystem.toLowerCase() as CoordinateSystemType
    const outputSystem = options.outputSystem.toLowerCase() as CoordinateSystemType

    if (!COORDINATE_SYSTEMS[inputSystem]) {
      result.errors.push(`不支持的输入坐标系: ${inputSystem}`)
      return result
    }

    if (!COORDINATE_SYSTEMS[outputSystem]) {
      result.errors.push(`不支持的输出坐标系: ${outputSystem}`)
      return result
    }

    const inputHeaders = Object.keys(dataRows[0] || {})
    const lngHeader = '经度/X（必填）'
    const latHeader = '纬度/Y（必填）'
    const nameHeader = '名称'

    const inputDisplayName = COORDINATE_SYSTEMS[inputSystem].displayName
    const outputDisplayName = COORDINATE_SYSTEMS[outputSystem].displayName

    result.outputHeaders = [
      nameHeader,
      `经度/X（${inputDisplayName}）`,
      `纬度/Y（${inputDisplayName}）`,
      `经度/X（${outputDisplayName}）`,
      `纬度/Y（${outputDisplayName}）`,
    ]

    if (!inputHeaders.includes(lngHeader) || !inputHeaders.includes(latHeader)) {
      result.errors.push('数据中缺少经度/X或纬度/Y列')
      return result
    }

    const nameIndex = inputHeaders.indexOf(nameHeader)
    const cgcs2000Params = options.cgcs2000Params || DEFAULT_CGCS2000_PARAMS
    const batchSize = options.batchSize || 50
    const startTime = Date.now()

    const processBatch = (startIndex: number): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const endIndex = Math.min(startIndex + batchSize, dataRows.length)

          for (let i = startIndex; i < endIndex; i++) {
            if (options.abortSignal?.aborted) {
              resolve()
              return
            }

            const row = dataRows[i]
            const rowNum = i + 1

            try {
              if (!row) {
                result.errors.push(`第 ${rowNum} 行: 数据为空`)
                continue
              }

              const lngVal = row[lngHeader]
              const latVal = row[latHeader]
              const nameVal =
                nameIndex !== -1 && row[nameHeader] ? row[nameHeader] : `点位${rowNum}`

              const lngNum = parseStrictNumber(lngVal)
              const latNum = parseStrictNumber(latVal)

              if (lngNum === null || latNum === null) {
                result.errors.push(`第 ${rowNum} 行: 坐标值不是有效的数字`)
                continue
              }

              const converted = convert(inputSystem, outputSystem, lngNum, latNum, cgcs2000Params)

              // 只判 length 不够：proj4 出错时返回 [NaN, NaN]，长度也是 2，
              // 于是 NaN 被静默写进导出的 CSV/Excel（审计 P0-5）
              if (
                !converted ||
                converted.length !== 2 ||
                !Number.isFinite(converted[0]) ||
                !Number.isFinite(converted[1])
              ) {
                result.errors.push(`第 ${rowNum} 行: 坐标转换失败，请检查投影参数`)
                continue
              }

              const newRow: DataRow = {}

              if (result.outputHeaders.length >= 5) {
                const nameKey = result.outputHeaders[0]
                const inputLngKey = result.outputHeaders[1]
                const inputLatKey = result.outputHeaders[2]
                const outputLngKey = result.outputHeaders[3]
                const outputLatKey = result.outputHeaders[4]

                if (nameKey && inputLngKey && inputLatKey && outputLngKey && outputLatKey) {
                  newRow[nameKey] = nameVal
                  newRow[inputLngKey] = lngNum
                  newRow[inputLatKey] = latNum
                  newRow[outputLngKey] = converted[0]
                  newRow[outputLatKey] = converted[1]
                } else {
                  result.errors.push(`第 ${rowNum} 行: 输出表头格式错误`)
                  continue
                }
              } else {
                result.errors.push(`第 ${rowNum} 行: 输出表头格式错误`)
                continue
              }

              result.data.push(newRow)
              result.processedRows++
            } catch (error) {
              result.errors.push(
                `第 ${rowNum} 行转换失败: ${error instanceof Error ? error.message : String(error)}`,
              )
            }
          }

          resolve()
        })
      })
    }

    for (let i = 0; i < dataRows.length; i += batchSize) {
      if (options.abortSignal?.aborted) {
        result.errors.push('转换已被取消')
        break
      }

      await processBatch(i)

      if (options.onProgress) {
        const elapsedTime = Date.now() - startTime
        const progress = Math.floor((result.processedRows / result.totalRows) * 100)
        const estimatedRemainingTime =
          result.processedRows > 0
            ? Math.round(
                (elapsedTime * (result.totalRows - result.processedRows)) / result.processedRows,
              )
            : 0

        options.onProgress({
          progress,
          processedRows: result.processedRows,
          totalRows: result.totalRows,
          elapsedTime,
          estimatedRemainingTime,
        })
      }

      await delay(0)
    }

    if (!options.abortSignal?.aborted) {
      result.success = result.errors.length === 0 || result.processedRows > 0

      if (result.processedRows === 0 && result.errors.length === 0) {
        result.errors.push('没有成功转换任何数据行')
      }
    }

    return result
  } catch (error) {
    result.errors.push(
      `转换过程发生错误: ${error instanceof Error ? error.message : String(error)}`,
    )
    return result
  }
}

export function convertToCsv(data: DataRow[], headers: string[]): string {
  if (!data || data.length === 0 || !headers || headers.length === 0) {
    return ''
  }

  const processedHeaders = headers.map((header) => {
    if (header.includes(',') || header.includes('"') || header.includes('\n')) {
      const escapedHeader = header.replace(/"/g, '""')
      return `"${escapedHeader}"`
    }
    return header
  })

  const csvRows = [processedHeaders.join(',')]

  for (const row of data) {
    const rowValues = headers.map((header) => {
      let value = row[header]
      if (value === null || value === undefined) {
        value = ''
      }

      const strValue = String(value)
      if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
        const escapedValue = strValue.replace(/"/g, '""')
        return `"${escapedValue}"`
      }
      return strValue
    })

    csvRows.push(rowValues.join(','))
  }

  return '\uFEFF' + csvRows.join('\n')
}

/**
 * 导出 xlsx（C4 阶段 3 / P2-20：由 xlsx(SheetJS) 迁到 exceljs 管线）。
 *
 * `writeXlsx` 内部 `await import('exceljs')`（懒加载），因此本函数必须是 async。
 *
 * 产物与旧实现逐格一致（表名 '转换结果'、`!cols` 列宽 `Math.max(表头长度, 10)`、
 * undefined → ''、无边框），由 `__tests__/coordsConversion.spec.ts` 的内联
 * 黄金参考 `legacyConvertToXlsx()` 读回比对守护。
 */
export async function convertToXlsx(data: DataRow[], headers: string[]): Promise<Blob> {
  if (!data || data.length === 0 || !headers || headers.length === 0) {
    return new Blob([], { type: 'application/octet-stream' })
  }

  return await writeXlsx([{ name: '转换结果', headers, rows: rowsFromObjects(data, headers) }])
}
