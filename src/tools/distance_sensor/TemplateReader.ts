/**
 * 距离传感器模板读取与验证
 *
 * D1 重构：逐行循环（让出主线程 / 复查取消 / 上报进度）已收敛到
 * `@/utils/templateRowReader.readRows`。本文件只保留距离测算特有的语义：
 * **3 列同站址 / 6 列异站址两种模式**，以及一行同时向两个集合产出点位。
 */
import { readRows, type RowExtractor } from '@/utils/templateRowReader'
import { pushAll } from '@/utils/arrayUtils'
import { type LocationPoint, isValidCoordinate } from '@/utils/DistanceCalculator'
import { parseStrictNumber } from '@/utils/coordinateValue'
import type { ProgressCallback } from '@/utils/progress'

export interface TemplateValidationResult {
  isValid: boolean
  data1: LocationPoint[]
  data2: LocationPoint[]
  errors: string[]
  mode: 'same-site' | 'different-site'
}

/**
 * 读取并验证模板数据
 * 自动判断是同站址（3列）还是异站址（6列）匹配
 *
 * D1/C4：改为 async 并支持 progress/abort（与其它三个工具的 reader 对齐）。
 * 本工具的逐行校验此前是同步的，页面只能取消到「解析」为止。
 *
 * @param rows           数据行（不含表头）
 * @param headerColumns  表头列名，**强烈建议提供**，理由见下。
 * @param onProgress     进度回调（可选，不传则不上报）
 * @param signal         取消信号（可选）：已取消时以 AbortError 拒绝
 *
 * 历史 Bug（审计 C1 / P1-6）：列数原先从 `Object.keys(rows[0])` 推断，
 * 而 XLSX 默认的 `sheet_to_json(ws)` 不给空单元格建 key。若第一条数据的
 * 「名称2/经度2/纬度2」为空，首行就只有 3 个 key → 被误判成同站址模式
 * → 之后每行都报「名称不能为空」，而文件其实是合法的 6 列异站址模板。
 *
 * 列数与列名必须来自**表头行**；省略本参数时退回读首行 key 的旧行为，
 * 只为兼容直接传数组的调用方。
 */
export async function readAndValidateTemplate(
  rows: Record<string, string | number>[],
  headerColumns?: string[],
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<TemplateValidationResult> {
  const errors: string[] = []
  const data1: LocationPoint[] = []
  const data2: LocationPoint[] = []

  // 检查数据是否为空
  if (!rows || rows.length === 0) {
    return {
      isValid: false,
      data1: [],
      data2: [],
      errors: ['模板数据为空'],
      mode: 'same-site',
    }
  }

  // 列名与列数一律来自表头行，而不是数据行的 key 数量（审计 C1 / P1-6）
  const columns = (headerColumns ?? Object.keys(rows[0] || {})).map((col) => col.trim())
  const columnCount = columns.length

  if (columnCount !== 3 && columnCount !== 6) {
    return {
      isValid: false,
      data1: [],
      data2: [],
      errors: [`模板列数不正确，需要3列（同站址）或6列（异站址），当前为${columnCount}列`],
      mode: 'same-site',
    }
  }

  // 判断匹配模式
  const isSameSite = columnCount === 3
  const mode: 'same-site' | 'different-site' = isSameSite ? 'same-site' : 'different-site'

  // 获取列名映射（支持带空格的列名）
  const getColumnName = (expected: string): string => {
    return columns.find((col) => col === expected || col.trim() === expected) || expected
  }

  /**
   * 一行 → 0..N 条点位。
   *
   * 用 `target` 标记点位该进哪个集合，让距离测算也能复用公共循环：
   * 同站址一行产出 **2 条**（目标集与源集是同一份），异站址最多 2 条。
   * 行号用 `startRowNumber = 2`：rows 已去掉表头，界面上第一条数据是第 2 行。
   */
  const extractRow: RowExtractor<{ target: 1 | 2; point: LocationPoint }> = (row, rowNumber) => {
    const records: { target: 1 | 2; point: LocationPoint }[] = []
    const rowErrors: string[] = []

    if (isSameSite) {
      // 同站址匹配：名称, 经度, 纬度
      const nameKey = getColumnName('名称')
      const lonKey = getColumnName('经度')
      const latKey = getColumnName('纬度')

      const name = String(row[nameKey] || '').trim()
      const longitude = parseStrictNumber(row[lonKey])
      const latitude = parseStrictNumber(row[latKey])

      if (!name) {
        rowErrors.push(`第${rowNumber}行：名称不能为空`)
        return { records, errors: rowErrors }
      }

      if (longitude === null || latitude === null || !isValidCoordinate(latitude, longitude)) {
        rowErrors.push(`第${rowNumber}行：经纬度坐标无效（经度${longitude}, 纬度${latitude}）`)
        return { records, errors: rowErrors }
      }

      const point = { name, longitude, latitude }
      // 两个集合各持一份独立对象（与收敛前一致：两个 push 是两个字面量）
      records.push({ target: 1, point: { ...point } }, { target: 2, point: { ...point } })
      return { records, errors: rowErrors }
    }

    // 异站址匹配：名称1, 经度1, 纬度1（目标集，被查找）, 名称2, 经度2, 纬度2（源集，需查找）
    // 两组独立校验，不要求同一行都有值，允许行数不一致
    const nameKey1 = getColumnName('名称1')
    const lonKey1 = getColumnName('经度1')
    const latKey1 = getColumnName('纬度1')
    const nameKey2 = getColumnName('名称2')
    const lonKey2 = getColumnName('经度2')
    const latKey2 = getColumnName('纬度2')

    // 处理第一组（目标集，被查找的站址库）
    const name1 = String(row[nameKey1] || '').trim()
    const longitude1 = parseStrictNumber(row[lonKey1])
    const latitude1 = parseStrictNumber(row[latKey1])

    if (name1) {
      if (longitude1 !== null && latitude1 !== null && isValidCoordinate(latitude1, longitude1)) {
        records.push({
          target: 1,
          point: { name: name1, longitude: longitude1, latitude: latitude1 },
        })
      } else {
        rowErrors.push(`第${rowNumber}行：第一组经纬度坐标无效`)
      }
    }

    // 处理第二组（源集，需查找的站址）
    const name2 = String(row[nameKey2] || '').trim()
    const longitude2 = parseStrictNumber(row[lonKey2])
    const latitude2 = parseStrictNumber(row[latKey2])

    if (name2) {
      if (longitude2 !== null && latitude2 !== null && isValidCoordinate(latitude2, longitude2)) {
        records.push({
          target: 2,
          point: { name: name2, longitude: longitude2, latitude: latitude2 },
        })
      } else {
        rowErrors.push(`第${rowNumber}行：第二组经纬度坐标无效`)
      }
    }

    return { records, errors: rowErrors }
  }

  const { data, errors: rowErrors } = await readRows(rows, extractRow, {
    onProgress,
    signal,
    // rows 已去掉表头：界面上第一条数据是第 2 行
    startRowNumber: 2,
  })

  for (const record of data) {
    if (record.target === 1) {
      data1.push(record.point)
    } else {
      data2.push(record.point)
    }
  }

  pushAll(errors, rowErrors)

  // 异站址时确保两组都有数据
  if (mode === 'different-site') {
    if (data1.length === 0) {
      errors.push('目标集（列1-3：被查找的站址）没有有效数据')
    }
    if (data2.length === 0) {
      errors.push('源集（列4-6：需查找的站址）没有有效数据')
    }
  }

  return {
    isValid: errors.length === 0,
    data1,
    data2,
    errors,
    mode,
  }
}

/**
 * 导出匹配结果为数据行
 * 在原有模板数据右侧追加匹配结果
 * 同站址：名称, 经度, 纬度, 匹配站名1, 匹配经度1, 匹配纬度1, 距离1, 匹配站名2, ...
 * 异站址：名称1, 经度1, 纬度1, 名称2, 经度2, 纬度2, 匹配站名1, 匹配经度1, 匹配纬度1, 距离1, ...
 */
/** 把匹配结果构建为 Map 索引，避免 O(N²) 查找 */
function buildResultIndex(
  matchResults: Array<{
    site: LocationPoint
    matches: Array<{ site: LocationPoint; distance: number }>
  }>,
): Map<string, (typeof matchResults)[number]> {
  const map = new Map<string, (typeof matchResults)[number]>()
  const round = (v: number) => v.toFixed(6)
  for (const r of matchResults) {
    const key = `${r.site.name}|${round(r.site.longitude)}|${round(r.site.latitude)}`
    map.set(key, r)
  }
  return map
}

export function exportMatchResultsToRows(
  originalData1: LocationPoint[],
  originalData2: LocationPoint[],
  matchResults: Array<{
    site: LocationPoint
    matches: Array<{ site: LocationPoint; distance: number }>
  }>,
  mode: 'same-site' | 'different-site',
  matchCount: number,
): string[][] {
  const result: string[][] = []
  const resultIndex = buildResultIndex(matchResults)
  const round = (v: number) => v.toFixed(6)

  for (let i = 0; i < originalData1.length; i++) {
    const point1 = originalData1[i]
    if (!point1) continue

    const key = `${point1.name}|${round(point1.longitude)}|${round(point1.latitude)}`
    const siteMatch = resultIndex.get(key)

    if (mode === 'same-site') {
      // 同站址：名称, 经度, 纬度 + N组(匹配站名, 匹配经度, 匹配纬度, 距离)
      const row: string[] = [point1.name, String(point1.longitude), String(point1.latitude)]

      // 添加N个匹配结果
      if (siteMatch) {
        for (let j = 0; j < matchCount; j++) {
          const match = siteMatch.matches[j]
          if (match) {
            row.push(match.site.name)
            row.push(String(match.site.longitude))
            row.push(String(match.site.latitude))
            row.push(match.distance.toFixed(2))
          } else {
            // 不足N个匹配的填空
            row.push('', '', '', '')
          }
        }
      } else {
        // 没有匹配结果的填空
        for (let j = 0; j < matchCount; j++) {
          row.push('', '', '', '')
        }
      }

      result.push(row)
    } else {
      // 异站址：源站点（需查找的）+ N组(匹配站名, 匹配经度, 匹配纬度, 距离)
      const row: string[] = [point1.name, String(point1.longitude), String(point1.latitude)]

      if (siteMatch) {
        for (let j = 0; j < matchCount; j++) {
          const match = siteMatch.matches[j]
          if (match) {
            row.push(match.site.name)
            row.push(String(match.site.longitude))
            row.push(String(match.site.latitude))
            row.push(match.distance.toFixed(2))
          } else {
            row.push('', '', '', '')
          }
        }
      } else {
        for (let j = 0; j < matchCount; j++) {
          row.push('', '', '', '')
        }
      }

      result.push(row)
    }
  }

  return result
}

/**
 * 获取导出结果的表头
 * 根据匹配数量动态生成表头
 */
export function getResultHeaders(
  mode: 'same-site' | 'different-site',
  matchCount: number,
): string[] {
  const baseHeaders = mode === 'same-site' ? ['名称', '经度', '纬度'] : ['名称', '经度', '纬度']

  for (let i = 1; i <= matchCount; i++) {
    baseHeaders.push(`匹配站名${i}`, `匹配经度${i}`, `匹配纬度${i}`, `距离${i}(米)`)
  }

  return baseHeaders
}
