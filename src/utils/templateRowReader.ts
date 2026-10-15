/**
 * 行式模板读取与验证 · 参数化实现（D1 / 审计 P3-2、P3-4）
 *
 * **为什么有这一份**：`get_add`、`elevations_batch`、`get_lonlat`、`distance_sensor`
 * 四个工具的 `readAndValidateTemplate(rows, …)` 曾各自复制同一套循环：
 * 逐行 → 让出主线程 → 复查取消 → 上报进度 → 别名取值 → 校验 → 收集。
 * 其中 `get_add` 与 `elevations_batch` 两份**逐行相同**（这正是 P0-1 的空经纬度
 * bug 同时存在于两处的原因），四个工具又各自抄了一遍 C4 加的 yield/abort/progress 块。
 *
 * 本模块把「循环机制」收成一份 `readRows`，工具只提供自己的取值与校验；
 * `get_add` / `elevations_batch` 更进一步 —— 连取值校验都共用
 * `readCoordinatePointRows`（这两个工具的行语义完全相同）。
 *
 * 与 `utils/TemplateReader.ts` 的分工（**不合并**，入口不同）：
 *   那边  File → 解析（Worker）→ 校验，服务「整份文件导入」；
 *   这边  已解析好的行 → 校验，服务「页内 XLSX.read / sheet_to_json / CSV」的后续步骤。
 * 两者的 yield/abort/progress 机制同源同参数，改一处必须同步另一处。
 */
import { pushAll } from './arrayUtils'
import { yieldToUI } from './yieldToUI'
import { throwIfAborted } from './abort'
import { parseCoordinateValue } from './coordinateValue'
import type { ProgressCallback } from './progress'
import type { CoordinatePoint, TemplateValidationResult } from './templateHandler'

/** 一行原始数据（页内解析产物：sheet_to_json 对象模式 / CSV / 二维数组整形的行） */
export type RawRow = Record<string, string | number>

/** 一行的处理结果：0..N 条记录 + 0..N 条错误（错误文案需自带行号） */
export interface RowOutcome<T> {
  records?: T[]
  errors?: string[]
}

/** 取值与校验：把一行数据变成 0..N 条记录 + 0..N 条错误 */
export type RowExtractor<T> = (row: RawRow, rowNumber: number) => RowOutcome<T>

export interface RowReadOptions {
  /** 进度回调（不传则行为与改造前一致） */
  onProgress?: ProgressCallback
  /** 取消信号：在让出间隙复查，已取消时以 AbortError 拒绝（**不**写入 errors） */
  signal?: AbortSignal
  /**
   * 首行数据在源文件中的行号（默认 1）。
   * `distance_sensor` 传 2：它拿到的 rows 已去掉表头，界面上第一条数据是第 2 行。
   */
  startRowNumber?: number
}

export interface RowReadResult<T> {
  data: T[]
  errors: string[]
}

/**
 * 行循环的让出粒度：每处理这么多行让出一次主线程。
 * 按**批**而非逐行：逐行 yield 会产生几万次微任务，反而拖慢整体吞吐（C4 计划风险 R4）。
 */
const ROW_YIELD_INTERVAL = 500

/**
 * 行式读取的公共循环（本模块的核心）
 *
 * 行为契约（四个工具收敛前后的共同行为，勿改）：
 * 1. 让出放在循环**开头** —— 校验失败的行会 `continue`，放在结尾会被整批跳过，
 *    一份「全是坏行」的文件就退化成同步阻塞（有反证测试守护）。
 * 2. 进度每行上报一次（`Math.min(99, …)`），循环结束后补 100。
 * 3. `signal` 与让出同频复查：否则点了「取消」还要跑完剩下几万行。
 * 4. 空行（`!row`）跳过，且**不调用** extractor。
 */
export async function readRows<T>(
  rows: readonly RawRow[],
  extract: RowExtractor<T>,
  options?: RowReadOptions,
): Promise<RowReadResult<T>> {
  const data: T[] = []
  const errors: string[] = []
  const { onProgress, signal, startRowNumber = 1 } = options ?? {}
  const total = rows.length

  for (let i = 0; i < total; i++) {
    if (i % ROW_YIELD_INTERVAL === 0) {
      await yieldToUI()
      throwIfAborted(signal)
    }

    const percent = total > 0 ? Math.round((i / total) * 100) : 100
    onProgress?.(Math.min(99, percent), `正在校验第 ${startRowNumber + i} 行...`)

    const row = rows[i]
    if (!row) continue

    const outcome = extract(row, startRowNumber + i)
    if (outcome.records?.length) pushAll(data, outcome.records)
    if (outcome.errors?.length) pushAll(errors, outcome.errors)
  }

  onProgress?.(100, '校验完成')
  return { data, errors }
}

/** 名称列的中英文别名 */
const NAME_ALIASES = ['名称', 'name', 'Name']
const LONGITUDE_ALIASES = ['经度', 'longitude', 'Longitude', 'lon', 'Lon']
const LATITUDE_ALIASES = ['纬度', 'latitude', 'Latitude', 'lat', 'Lat']

/**
 * 按别名取字符串值：取**首个非空别名**（即便它取值是空串，也不再向后找）。
 *
 * 与 `resolveCoordinateByAliases` 的差异是刻意保留的：
 * 名称为空就应报错；而经纬度某个别名为空时，还应看看英文列名有没有值。
 */
export function resolveAlias(row: RawRow, aliases: readonly string[]): string {
  for (const alias of aliases) {
    const cell = row[alias]
    if (cell !== undefined && cell !== null) {
      // `cell || ''` 把数值 0 也变成空串 —— 这是收敛前的既有行为（P0-1 相关用例钉住）
      return String(cell || '').trim()
    }
  }
  return ''
}

/**
 * 按别名取坐标值：取**第一个能解析成功的别名**，空值/脏值跳过继续找。
 * 找不到合法值时返回 null（调用方负责报错）。
 */
export function resolveCoordinateByAliases(
  row: RawRow,
  aliases: readonly string[],
  min: number,
  max: number,
): number | null {
  for (const alias of aliases) {
    const parsed = parseCoordinateValue(row[alias], min, max)
    if (parsed !== null) return parsed
  }
  return null
}

/**
 * 读「名称 + 经度 + 纬度」坐标点模板 —— `get_add`（地址解析）与
 * `elevations_batch`（批量高程查询）共用。
 *
 * 这两个工具的行语义完全相同（历史原因：从同一份代码复制），因此只保留这一份实现；
 * 任何一边需要发散语义时，从这里复制出去并删掉这里的共用注释。
 *
 * 每行**最多报一个错**（与收敛前一致）：名称 → 经度 → 纬度，首个失败即返回。
 */
export async function readCoordinatePointRows(
  rows: readonly RawRow[],
  /** 进度回调（C4 阶段 2，可选）。与 `readAndValidateTemplate` 的位置参数签名一致 */
  onProgress?: ProgressCallback,
  /** 取消信号（C4 收尾，可选）：已取消时以 AbortError 拒绝 */
  signal?: AbortSignal,
): Promise<TemplateValidationResult<CoordinatePoint>> {
  return toValidationResult(
    await readRows<CoordinatePoint>(
      rows,
      (row, rowNumber) => {
        const errors: string[] = []

        const name = resolveAlias(row, NAME_ALIASES)
        if (!name) {
          errors.push(`第 ${rowNumber} 行：名称不能为空`)
          return { errors }
        }

        const longitude = resolveCoordinateByAliases(row, LONGITUDE_ALIASES, -180, 180)
        if (longitude === null) {
          errors.push(`第 ${rowNumber} 行：经度无效或超出范围 (-180 ~ 180)`)
          return { errors }
        }

        const latitude = resolveCoordinateByAliases(row, LATITUDE_ALIASES, -90, 90)
        if (latitude === null) {
          errors.push(`第 ${rowNumber} 行：纬度无效或超出范围 (-90 ~ 90)`)
          return { errors }
        }

        return { records: [{ name, longitude, latitude }] }
      },
      { onProgress, signal },
    ),
  )
}

/**
 * 组装 `TemplateValidationResult`：行式读取的统一收尾。
 * `isValid` 要求**既无错误、又至少一条有效数据**（空文件不算通过）。
 */
export function toValidationResult<T>(result: RowReadResult<T>): TemplateValidationResult<T> {
  return {
    isValid: result.errors.length === 0 && result.data.length > 0,
    data: result.data,
    errors: result.errors,
  }
}
