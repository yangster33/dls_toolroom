import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { maxOf } from '@/utils/arrayUtils'
import type { GisFeature } from '../GisFileReader'
import {
  formatCoordinates,
  exportToExcel,
  exportSeparateFiles,
  type ExportOptions,
} from '../GisToExcelExporter'

/**
 * exceljs 是**懒加载**（`writeXlsx` 内部 `await import('exceljs')`），而本文件大量用例
 * 装了 fake timers。实测：fake timers 下首次动态 import 不会 settle（Vite 的模块加载链
 * 依赖真实计时器），因此在装计时器之前把 exceljs 预载完。
 */
await import('exceljs')

const defaultOptions: ExportOptions = {
  lonLatSeparator: ',',
  coordSeparator: ';',
  polygonLonLatSeparator: ',',
  polygonCoordSeparator: ';',
  closePolygon: false,
}

function makeFeature(
  type: 'Point' | 'LineString' | 'Polygon',
  name: string,
  coordinates: string,
  path = '',
): GisFeature {
  return { id: 'f1', type, name, coordinates, path, properties: {} }
}

let anchors: HTMLAnchorElement[] = []
let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>

beforeEach(() => {
  anchors = []
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
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/**
 * C4 阶段 3：xlsx 路径改走 `writeXlsx`（exceljs）后，一次导出内含**多次**让出
 * （写每张表前、每 2000 行、边框遍历、writeBuffer 前）。fake timers 下一次
 * `advanceTimersByTimeAsync(0)` 推不完，必须交替推进虚拟时间与 microtask
 * 直到 Promise settle —— 否则用例只会空转到超时。
 *
 * 每步只推进 1ms：既不会一次冲过 100ms 的下载清理定时器，又能在超出上限时
 * 明确失败（而不是伪装成"5 秒超时"这种查不出原因的红）。
 */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const outcome = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  )
  for (let i = 0; i < 300; i++) {
    const winner = await Promise.race([outcome, vi.advanceTimersByTimeAsync(1).then(() => null)])
    if (winner) {
      if (!winner.ok) throw winner.error
      return winner.value
    }
  }
  throw new Error('Promise 未在推进 300ms 后 settle（可能是 yield 未接上定时器）')
}

describe('formatCoordinates', () => {
  it('Point 使用经纬度分隔符', () => {
    const options = { ...defaultOptions, lonLatSeparator: '，' }
    expect(formatCoordinates('116.4,39.9', 'Point', options)).toBe('116.4，39.9')
  })

  it('LineString 使用坐标分隔符', () => {
    const options = { ...defaultOptions, coordSeparator: '; ' }
    expect(formatCoordinates('1,2;3,4', 'LineString', options)).toBe('1,2; 3,4')
  })

  it('Polygon 使用专用分隔符', () => {
    const options = {
      ...defaultOptions,
      polygonLonLatSeparator: ':',
      polygonCoordSeparator: '|',
    }
    expect(formatCoordinates('1,2;3,4', 'Polygon', options)).toBe('1:2|3:4')
  })

  it('Polygon 开启闭合且首尾不同时追加首点', () => {
    const options = { ...defaultOptions, closePolygon: true }
    expect(formatCoordinates('1,2;3,4', 'Polygon', options)).toBe('1,2;3,4;1,2')
  })

  it('Polygon 已闭合时不重复追加', () => {
    const options = { ...defaultOptions, closePolygon: true }
    expect(formatCoordinates('1,2;3,4;1,2', 'Polygon', options)).toBe('1,2;3,4;1,2')
  })

  it('Polygon 未开启闭合时不追加', () => {
    expect(formatCoordinates('1,2;3,4', 'Polygon', defaultOptions)).toBe('1,2;3,4')
  })

  it('空坐标退化为 ,undefined（保持原实现行为）', () => {
    expect(formatCoordinates('', 'Polygon', defaultOptions)).toBe(',undefined')
  })
})

describe('exportToExcel / exportSeparateFiles', () => {
  it('csv 导出：按类型分组生成区块并下载', async () => {
    const groups = [
      [makeFeature('Point', '站点A', '116.4,39.9')],
      [makeFeature('Polygon', '甲,乙', '1,2;3,4')],
    ]
    await exportToExcel(groups, 'csv', defaultOptions)
    expect(anchors[0]!.getAttribute('download')).toBe('gis_export.csv')
    const blob = createObjectURL.mock.calls[0]![0] as Blob
    const text = await blob.text()
    expect(text).toContain('[点]')
    expect(text).toContain('名称,经纬度,路径')
    expect(text).toContain('站点A,"116.4,39.9",')
    expect(text).toContain('[面]')
    expect(text).toContain('"甲,乙","1,2;3,4",')
    vi.advanceTimersByTime(200)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('xlsx 导出：生成 xlsx Blob 并下载', async () => {
    const pending = exportToExcel(
      [[makeFeature('Point', '站点A', '116.4,39.9')]],
      'xlsx',
      defaultOptions,
    )
    await settle(pending)
    const blob = createObjectURL.mock.calls[0]![0] as Blob
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(anchors[0]!.getAttribute('download')).toBe('gis_export.xlsx')
  })

  it('exportSeparateFiles：真的让出主线程，不再有伪 yield', async () => {
    // 审计缺陷 A：旧实现是 `setTimeout(() => {}, 200)` —— 未 await、空回调、在 forEach 里，
    // 所有文件在一次同步任务里全部下载完，"让出"从未发生。
    // 现在每组之间 await yieldToUI(200)：第一份同步产出，第二份必须等定时器落地。
    const groups = [
      [makeFeature('Point', '站点A', '116.4,39.9')],
      [makeFeature('LineString', '线1', '1,2;3,4')],
    ]
    const pending = exportSeparateFiles(groups, 'csv', defaultOptions)
    expect(anchors.map((a) => a.getAttribute('download'))).toEqual(['gis_点.csv'])

    await vi.advanceTimersByTimeAsync(200)
    expect(anchors.map((a) => a.getAttribute('download'))).toEqual(['gis_点.csv', 'gis_线.csv'])

    await pending
    const text = await (createObjectURL.mock.calls[0]![0] as Blob).text()
    expect(text).toContain('站点A,"116.4,39.9",')
  })

  it('exportSeparateFiles：xlsx 模式', async () => {
    const pending = exportSeparateFiles(
      [[makeFeature('Point', '站点A', '116.4,39.9')]],
      'xlsx',
      defaultOptions,
    )
    await settle(pending)
    expect(anchors[0]!.getAttribute('download')).toBe('gis_点.xlsx')
  })

  it('空分组被跳过（且首组的 yield 不影响后续组）', async () => {
    const pending = exportSeparateFiles(
      [[], [makeFeature('Point', 'a', '1,2')]],
      'csv',
      defaultOptions,
    )
    expect(anchors).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(200)
    await pending
    expect(anchors).toHaveLength(1)
  })
})

/**
 * C4 阶段 3 验收核心：xlsx 生成从 `xlsx` 库迁到 `utils/exceljsPipeline`（exceljs）后，
 * 产物必须与旧实现**逐格一致** —— 表名 / 逐格值 / 列宽。
 *
 * 关键设计 1：黄金参考 `legacyExportToXlsx` 是**内联在本文件里的旧算法副本**，
 * 而不是"调用迁移前的函数" —— 迁移后旧函数已不存在，那样本 spec 会因为无处比对
 * 而被后人删掉。
 *
 * 关键设计 2（实测发现，见 `utils/__tests__/exceljsPipeline.spec.ts` 顶部说明）：
 * 旧 xlsx 路径**从未真正写出边框**（xlsx@0.18.5 把单元格样式整体丢弃），所以这里的
 * 「逐格一致」只比**值 / 列宽 / 表名**；边框是本次迁移**有意**补上的行为，
 * 另有专门用例用 exceljs 读回钉住它确实落盘。
 */

interface LegacySheet {
  name: string
  headers: string[]
  rows: string[][]
}

/** 旧实现（迁移前 `exportToXlsx` 的逐组 → sheet 规则）的忠实副本；空组整组跳过 */
function toLegacySheets(groups: GisFeature[][], options: ExportOptions): LegacySheet[] {
  const sheets: LegacySheet[] = []
  for (const features of groups) {
    if (features.length === 0 || !features[0]) continue
    const type = features[0].type
    sheets.push({
      name: legacySheetName(type),
      headers: ['名称', '经纬度', '路径'],
      rows: features.map((feature) => [
        feature.name,
        formatCoordinates(feature.coordinates, type, options),
        feature.path,
      ]),
    })
  }
  return sheets
}

/** 旧实现里按 type 推 sheet 名的 switch 副本（不 import 迁移后文件里的私有函数） */
function legacySheetName(type: 'Point' | 'LineString' | 'Polygon'): string {
  switch (type) {
    case 'Point':
      return '点'
    case 'LineString':
      return '线'
    case 'Polygon':
      return '面'
    default:
      return '要素'
  }
}

/**
 * 旧实现（迁移前 `exportToXlsx` / `exportSingleTypeToXlsx` 的算法）的忠实副本：
 * `aoa_to_sheet(全量)` + 逐列 `maxOf(..., 8|30|20)` 列宽 + 逐格 border 遍历 + 一次 `write`。
 */
function legacyExportToXlsx(sheets: LegacySheet[]): Blob {
  const workbook = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const worksheetData = [sheet.headers, ...sheet.rows]
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

    // 列宽的 min 阈值 8 / 30 / 20：逐列钉住，含表头一起算
    worksheet['!cols'] = [
      {
        wch: maxOf(
          worksheetData.map((row) => String(row[0]).length),
          8,
        ),
      },
      {
        wch: maxOf(
          worksheetData.map((row) => String(row[1]).length),
          30,
        ),
      },
      {
        wch: maxOf(
          worksheetData.map((row) => String(row[2]).length),
          20,
        ),
      },
    ]

    const borderStyle = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    }

    for (const key in worksheet) {
      if (key.startsWith('!')) continue
      const cell = worksheet[key]
      if (cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
        cell.s = cell.s || {}
        cell.s.border = borderStyle
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  }

  const wbout = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    bookSST: false,
  })

  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

interface SheetSnapshot {
  name: string
  values: unknown[][]
  colWidths: number[]
}

/** 读回产物：表名 / 逐格值 / 列宽（边框必须用 exceljs 读，见下） */
async function snapshot(blob: Blob): Promise<SheetSnapshot[]> {
  const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array', cellStyles: true })
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]!
    return {
      name,
      // raw:false 让两种实现都以字符串回读（我们的输入本来就是字符串）
      values: XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as unknown[][],
      colWidths: (ws['!cols'] ?? []).map((c) => c.wch ?? 0),
    }
  })
}

/** 归一化：把 '' 与 undefined 视为等价值（两种实现对空单元格的落盘方式可能不同） */
function normalize(sheets: SheetSnapshot[]): unknown[] {
  return sheets.map((sheet) => ({
    name: sheet.name,
    values: sheet.values.map((row) =>
      row.map((v) => (v === undefined || v === '' ? null : String(v))),
    ),
    colWidths: sheet.colWidths,
  }))
}

/** 取本次导出产生的 xlsx Blob（mock 的 createObjectURL 收到的第一个参数） */
function exportedBlob(): Blob {
  return createObjectURL.mock.calls[0]![0] as Blob
}

/** 点：空名称（第 0 列落到 min 阈值 8）+ 普通坐标 + 短路径（第 2 列落到 min 阈值 20） */
const POINT_FEATURE = () => makeFeature('Point', '', '116.4,39.9', 'g1')
/** 线：超长名称（>8）+ 超长坐标串（>30）+ 空路径（第 2 列仍是 min 阈值 20） */
const LINE_FEATURE = () =>
  makeFeature('LineString', `超长名称${'x'.repeat(12)}`, '116.4,39.9;121.5,31.2;113.2,23.1', '')
/** 面：普通名称 + 两条坐标 + 超长路径（>20） */
const POLYGON_FEATURE = () =>
  makeFeature('Polygon', '甲,乙地块', '116.4,39.9;121.5,31.2', 'folder/sub/directory/file_name.txt')

/** fixture：点 / 线 / 面三种类型 + 空分组 + 空字符串列 + 触发 8/30/20 阈值的超长值 */
function fixtureGroups(): GisFeature[][] {
  return [[POINT_FEATURE()], [LINE_FEATURE()], [], [POLYGON_FEATURE()]]
}

describe('exportToXlsx：产物与旧 xlsx 实现逐格一致（C4 阶段 3 验收）', () => {
  // 本 describe 要多次 await exceljs 的 load / writeBuffer，用真实计时器最稳
  // （fake timers 下 exceljs 的 zip 内部计时链很难推干净，且与比对无关）
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('多类型分组 + 空字符串列 + 超长阈值：表名 / 逐格值 / 列宽全部一致', async () => {
    const groups = fixtureGroups()

    await exportToExcel(groups, 'xlsx', defaultOptions)
    const next = await snapshot(exportedBlob())
    const legacy = await snapshot(legacyExportToXlsx(toLegacySheets(groups, defaultOptions)))

    // 空分组被跳过 → 只剩 3 个 sheet，顺序保持点 / 线 / 面
    expect(next.map((s) => s.name)).toEqual(['点', '线', '面'])
    expect(normalize(next)).toEqual(normalize(legacy))

    // 列宽逐列钉住：第 0 列 min 8、第 1 列 min 30、第 2 列 min 20
    expect(next.map((s) => s.colWidths)).toEqual([
      [8, 30, 20], // 点：名称 ''（0）→ min 8；坐标 10 → min 30；路径 'g1'（2）→ min 20
      [16, 32, 20], // 线：名称 16（>8）；坐标 32（>30）；路径 '' → min 20
      [8, 30, 34], // 面：名称 5 → min 8；坐标 21 → min 30；路径 34（>20）
    ])

    // 逐格值（含空字符串列、含逗号的名称）逐 sheet 展开断言一次
    expect(next[0]!.values).toEqual([
      ['名称', '经纬度', '路径'],
      ['', '116.4,39.9', 'g1'],
    ])
    expect(next[1]!.values[1]).toEqual([
      `超长名称${'x'.repeat(12)}`,
      '116.4,39.9;121.5,31.2;113.2,23.1',
      '',
    ])
    expect(next[2]!.values[1]).toEqual([
      '甲,乙地块',
      '116.4,39.9;121.5,31.2',
      'folder/sub/directory/file_name.txt',
    ])
  })

  it('空分组被跳过：sheet 数与 sheet 名只来自非空组', async () => {
    const groups: GisFeature[][] = [[], [makeFeature('Point', 'a', '1,2')], []]
    await exportToExcel(groups, 'xlsx', defaultOptions)
    const next = await snapshot(exportedBlob())
    expect(next.map((s) => s.name)).toEqual(['点'])
    expect(next[0]!.values).toEqual([
      ['名称', '经纬度', '路径'],
      ['a', '1,2', ''],
    ])
  })

  it('exportSeparateFiles：每份 xlsx 与旧实现的单 sheet 产物逐格一致', async () => {
    const groups = [[POINT_FEATURE()], [], [POLYGON_FEATURE()]]
    await exportSeparateFiles(groups, 'xlsx', defaultOptions)

    // 空组不出文件 → 两份下载，文件名按类型名走
    expect(anchors.map((a) => a.getAttribute('download'))).toEqual(['gis_点.xlsx', 'gis_面.xlsx'])

    for (const [index, features] of [groups[0]!, groups[2]!].entries()) {
      const blob = createObjectURL.mock.calls[index]![0] as Blob
      expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const next = await snapshot(blob)
      const legacy = await snapshot(legacyExportToXlsx(toLegacySheets([features], defaultOptions)))
      expect(normalize(next)).toEqual(normalize(legacy))
      // 单文件路径同样只有一个 sheet
      expect(next).toHaveLength(1)
    }
  })

  it('F2：生产路径小表自动开 border，旧实现仍然没有边框', async () => {
    const groups = fixtureGroups()
    await exportToExcel(groups, 'xlsx', defaultOptions)

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await exportedBlob().arrayBuffer())

    // F2：小表（远低于 2 万行阈值）默认带边框，修复「导出没有边框」的老 bug。
    for (const name of ['点', '线', '面']) {
      expect(borderedCellCount(wb.getWorksheet(name)!)).toBeGreaterThan(0)
    }

    // 旧实现（xlsx 库）同样读法下拿不到任何边框 —— 迁移前边框是死代码的证据
    const legacyWorkbook = new ExcelJS.Workbook()
    await legacyWorkbook.xlsx.load(
      await legacyExportToXlsx(toLegacySheets(groups, defaultOptions)).arrayBuffer(),
    )
    for (const name of ['点', '线', '面']) {
      expect(borderedCellCount(legacyWorkbook.getWorksheet(name)!)).toBe(0)
    }
  })
})

/** 统计一个工作表里带 thin 上边框的单元格数 */
function borderedCellCount(ws: ExcelJS.Worksheet): number {
  let count = 0
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    for (let c = 1; c <= row.cellCount; c++) {
      if (row.getCell(c).border?.top?.style === 'thin') count++
    }
  }
  return count
}
