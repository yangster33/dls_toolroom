import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { exportToXLSX } from '../geoDataService'
import type { AnalysisResult } from '../geoDataService'

/**
 * C4 阶段 3 验收核心：`geoDataService.exportToXLSX` 从 xlsx（SheetJS）迁到
 * exceljs 管线后，**产物必须与旧实现逐格一致**。
 *
 * 关键设计（与 `src/utils/__tests__/exceljsPipeline.spec.ts` 同一套思路）：
 * 黄金参考是内联在本文件里的 `legacyExportToXLSX`，而不是「调用改造前的旧函数」
 * —— 旧函数迁移后就不存在了，那样本 spec 会因为无处比对而被后人删掉。
 *
 * 比对维度：sheet 名（含顺序）/ 逐格值（`sheet_to_json(header:1)`）/ 列宽。
 * 边框单独断言：旧实现**一个边框都没有**（xlsx@0.18.5 丢样式，那段是死代码），
 * 新实现按旧行为同样不写边框，所以两侧都必须是空的。
 */

/** 旧实现（迁移前的 `geoDataService.exportToXLSX`）的忠实副本 */
function legacyExportToXLSX(results: AnalysisResult[], selectedTypes: string[]): Blob {
  const workbook = XLSX.utils.book_new()

  for (const result of results) {
    if (selectedTypes.includes(result.type)) {
      const worksheet = XLSX.utils.json_to_sheet(result.data)
      XLSX.utils.book_append_sheet(workbook, worksheet, result.label)
    }
  }

  // 唯一改动：XLSX.writeFile（下载）→ XLSX.write 返回 Blob，spec 里不能真下载
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', bookSST: false })
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// ---------------------------------------------------------------------------
// 下载劫持：新实现是 `createObjectURL` + `<a download>`，把 Blob 摸出来
// ---------------------------------------------------------------------------

let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>
let anchors: HTMLAnchorElement[] = []

beforeEach(() => {
  createObjectURL = vi.fn(() => 'blob:mock')
  revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', {
    value: createObjectURL,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: revokeObjectURL,
    writable: true,
    configurable: true,
  })

  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'a') return originalCreateElement(tag)
    const anchor = originalCreateElement('a')
    vi.spyOn(anchor, 'click').mockImplementation(() => {})
    anchors.push(anchor)
    return anchor
  })
})

afterEach(() => {
  anchors = []
  vi.restoreAllMocks()
})

/** 文件名与旧实现一致（日期由 toISOString 派生，测试内可精确断言） */
function expectedFileName(): string {
  return `空间分析报告_${new Date().toISOString().slice(0, 10)}.xlsx`
}

/** 跑新实现，返回它「下载」的那个 Blob，同时顺带校验下载行为本身 */
async function newExport(results: AnalysisResult[], selectedTypes: string[]): Promise<Blob> {
  await exportToXLSX(results, selectedTypes)

  expect(createObjectURL).toHaveBeenCalledTimes(1)
  expect(anchors).toHaveLength(1)
  expect(anchors[0]!.download).toBe(expectedFileName())
  expect(anchors[0]!.href).toBe('blob:mock')
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')

  return createObjectURL.mock.calls[0]![0] as Blob
}

// ---------------------------------------------------------------------------
// 读回比对
// ---------------------------------------------------------------------------

interface SheetSnapshot {
  name: string
  values: unknown[][]
  /** 列宽字符数；空数组 = 完全没设列宽（旧 json_to_sheet 行为） */
  colWidths: number[]
}

async function snapshot(blob: Blob): Promise<SheetSnapshot[]> {
  const buffer = await blob.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellStyles: true })

  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]!
    return {
      name,
      values: XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as unknown[][],
      colWidths: (ws['!cols'] ?? []).map((c) => c.wch ?? 0),
    }
  })
}

/**
 * 归一化：'' 与 undefined 视为等价值，其余一律转字符串（两种实现的落盘细节不同）。
 *
 * 同时丢掉「整行皆空」的行 —— 这是本次迁移唯一**无法**在不动管线的前提下消除的
 * 差异：`data` 为空数组时，旧实现的 `json_to_sheet([])` 是**彻底空表**（没有键就
 * 什么都不写），而管线固定执行 `worksheet.addRow(spec.headers)`，headers 为 `[]`
 * 时会留下一个**零单元格**的空行（`<row r="1"/>`）。纯外观差异：Excel 里两者都
 * 渲染成空表、都无列宽无边框。本 spec 用下面的显式断言把这个差异钉住，
 * 而不是假装它不存在。
 */
function normalize(sheets: SheetSnapshot[]): unknown[] {
  return sheets.map((sheet) => ({
    name: sheet.name,
    values: sheet.values
      .map((row) => row.map((v) => (v === undefined || v === '' ? null : String(v))))
      .filter((row) => row.some((v) => v !== null)),
    colWidths: sheet.colWidths,
  }))
}

/** 用 exceljs 读回，收集「有边框」的单元格引用 —— xlsx 读回拿不到样式（会假绿） */
async function borderedRefsBySheet(blob: Blob): Promise<Record<string, string[]>> {
  const buffer = await blob.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const result: Record<string, string[]> = {}
  for (const sheet of workbook.worksheets) {
    const refs: string[] = []
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r)
      for (let c = 1; c <= row.cellCount; c++) {
        const cell = row.getCell(c)
        if (cell.border?.top?.style === 'thin') {
          refs.push(XLSX.utils.encode_cell({ r: r - 1, c: c - 1 }))
        }
      }
    }
    result[sheet.name] = refs.sort()
  }
  return result
}

// ---------------------------------------------------------------------------
// fixture
// ---------------------------------------------------------------------------

/**
 * 主 fixture：一次覆盖任务要求的全部边界。
 * - 多个 result（多类型）
 * - `INCONSISTENT`：第一行 3 键、后两行 4 键 → 验证 collectHeaders 的
 *   「并集 + 首次出现顺序」语义与 json_to_sheet 一致（含后补的列在中间）
 * - `EMPTY`：data 是空数组（sheet 存在但没有任何数据）
 * - `NOT_SELECTED`：不在 selectedTypes 里，整张表都不该出现
 * - 值域：中文 / 数字（含 0 与小数）/ 布尔 / null / 含逗号与引号的字符串
 */
const INCONSISTENT: AnalysisResult = {
  type: 'point_to_point',
  label: '点与点关系',
  columns: ['名称', '距离_km', '方向', '备注'],
  data: [
    { 名称: '站点A', 距离_km: 3.5, 备注: '第一行只有 3 键' },
    { 名称: '站点B', 距离_km: 0, 方向: '东北', 备注: null },
    { 名称: '站点C', 距离_km: 12.75, 方向: '西南', 备注: '含"引号"与,逗号' },
  ],
}

const LINES: AnalysisResult = {
  type: 'line_to_line',
  label: '线与线关系',
  columns: ['线A', '线B', '是否相交', '交点数'],
  data: [
    { 线A: '主干道', 线B: '辅路一号', 是否相交: true, 交点数: 2 },
    { 线A: '环线', 线B: '放射线', 是否相交: false, 交点数: 0 },
  ],
}

/** 分析没跑出东西时 data 就是空数组（turf 无交点 / 无要素） */
const EMPTY: AnalysisResult = {
  type: 'point_to_polygon',
  label: '点与面关系',
  columns: ['点名称', '所在面'],
  data: [],
}

const NOT_SELECTED: AnalysisResult = {
  type: 'polygon_to_polygon',
  label: '面与面关系',
  columns: ['面A', '面B'],
  data: [{ 面A: '区块一', 面B: '区块二' }],
}

const RESULTS: AnalysisResult[] = [INCONSISTENT, LINES, EMPTY, NOT_SELECTED]
const SELECTED = ['point_to_point', 'line_to_line', 'point_to_polygon']

// ---------------------------------------------------------------------------
// 用例
// ---------------------------------------------------------------------------

describe('geoDataService.exportToXLSX · 产物与旧实现逐格一致（C4 阶段 3 验收）', () => {
  it('多类型 / 键不一致 / 空 data / 未选中类型：sheet 名 + 逐格值 + 列宽全一致', async () => {
    const legacy = await snapshot(legacyExportToXLSX(RESULTS, SELECTED))
    const next = await snapshot(await newExport(RESULTS, SELECTED))

    // 只该有 3 张表（NOT_SELECTED 不出现）
    expect(legacy.map((s) => s.name)).toEqual(['点与点关系', '线与线关系', '点与面关系'])
    expect(next.map((s) => s.name)).toEqual(legacy.map((s) => s.name))
    expect(next).toHaveLength(3)

    expect(normalize(next)).toEqual(normalize(legacy))

    // 单独钉住「键不一致」那一张：表头取并集且按**首次出现顺序** ——
    // 第一行 3 键（名称/距离_km/备注），第二行补出「方向」，所以并集顺序是
    // 名称 → 距离_km → 备注 → 方向（不是第一行的顺序，也不是 columns 的顺序）
    expect(legacy[0]!.values[0]).toEqual(['名称', '距离_km', '备注', '方向'])
    expect(next[0]!.values[0]).toEqual(['名称', '距离_km', '备注', '方向'])
    // 第一行缺「方向」那个键 → 补空
    expect(legacy[0]!.values[1]).toEqual(['站点A', '3.5', '第一行只有 3 键', ''])
    expect(next[0]!.values[1]).toEqual(['站点A', '3.5', '第一行只有 3 键', ''])
    // 后两行 4 键齐全（备注：null / 含引号与逗号的中文）
    expect(next[0]!.values[2]).toEqual(legacy[0]!.values[2])
    expect(next[0]!.values[3]).toEqual(['站点C', '12.75', '含"引号"与,逗号', '西南'])

    // 布尔 / null / 中文的读回值也必须一致
    expect(next[1]!.values[1]).toEqual(legacy[1]!.values[1])
    expect(next[1]!.values[2]).toEqual(legacy[1]!.values[2])

    // 空 data：sheet 在、有名字，但没有任何数据。
    // 旧实现 = []（彻底空表）；新实现 = [['']]（一个零单元格的空行，见 normalize 注释）
    expect(legacy[2]!.values).toEqual([])
    expect(next[2]!.values).toEqual([['']])
    expect(next[2]!.colWidths).toEqual([])
  })

  it('不设列宽、不写边框（对齐旧 json_to_sheet 行为）', async () => {
    const blob = await newExport(RESULTS, SELECTED)

    const sheets = await snapshot(blob)
    // 旧实现同样没有 !cols，这是「照抄」而不是「顺手美化」
    const legacySheets = await snapshot(legacyExportToXLSX(RESULTS, SELECTED))
    for (const sheet of [...sheets, ...legacySheets]) {
      expect(sheet.colWidths).toEqual([])
    }

    // 边框：一种有边框的单元格都不能有（用 exceljs 读，xlsx 读回拿不到样式）
    const bordered = await borderedRefsBySheet(blob)
    expect(Object.keys(bordered).sort()).toEqual(sheets.map((s) => s.name).sort())
    for (const refs of Object.values(bordered)) {
      // 这一路径的旧/新实现都不应给任何单元格加边框
      expect(refs).toEqual([])
    }
  })

  it('单个 result（只有一张表）同样逐格一致', async () => {
    const legacy = await snapshot(legacyExportToXLSX([INCONSISTENT], ['point_to_point']))
    const next = await snapshot(await newExport([INCONSISTENT], ['point_to_point']))

    expect(next.map((s) => s.name)).toEqual(['点与点关系'])
    expect(normalize(next)).toEqual(normalize(legacy))
  })

  it('空结果集：旧实现抛 Workbook is empty，新实现不炸（行为差异记档）', async () => {
    // 旧实现：一个 sheet 都没 append 的空 workbook 写不出去 —— 用户点导出直接弹错误框
    expect(() => legacyExportToXLSX(RESULTS, ['not_a_selected_type'])).toThrow('Workbook is empty')

    // 新实现：exceljs 能写出合法（但空）的工作簿，导出成功、拿到的是一个空 xlsx。
    // 注意这里只跑一次 newExport（它会 await exportToXLSX，不抛错即为通过）
    const blob = await newExport(RESULTS, ['not_a_selected_type'])
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(await snapshot(blob)).toEqual([])
    expect(await borderedRefsBySheet(blob)).toEqual({})
  })
})
