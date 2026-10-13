import { describe, it, expect, vi, afterEach } from 'vitest'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { writeXlsx, collectHeaders, rowsFromObjects, safeSheetName } from '../exceljsPipeline'

/**
 * C4 阶段 3 的验收核心：exceljs 迁移后的产物必须与旧 xlsx 实现**逐格一致**。
 *
 * 关键设计 1：**黄金参考实现是内联在本文件里的 `legacyXlsx()`**，
 * 而不是"调用改造前的旧函数"—— 旧函数迁移后就不存在了，
 * 那样本 spec 会因为无处比对而被后人删掉。
 *
 * 关键设计 2（实测发现，见 docs/2026-10-12-c4-fix-record.md「旧实现的边框是死代码」）：
 * 旧 xlsx 路径**从未真正写出边框** —— xlsx@0.18.5 在本环境会把单元格样式整体丢弃
 * （`styles.xml` 里只有一个空 `<border>`，`sheetData` 的单元格不带 `s=`；
 * 连官方 `add_style` 与 fill 同样落不了盘）。因此本 spec 的「逐格一致」比对的是
 * **值 / 列宽 / 表名**，而边框是本次迁移**有意**补上的行为（代码注释一直承诺边框，
 * 只是从未生效），另有专门用例钉住它确实存在。
 */

/** 旧实现（`utils/TemplateExporter.generateXlsx` 迁移前的算法）的忠实副本 */
function legacyXlsx(fixture: {
  name: string
  headers: string[]
  rows?: string[][]
  colWidths?: number[]
  border?: boolean
}): Blob {
  const workbook = XLSX.utils.book_new()
  const worksheetData = [fixture.headers].concat(fixture.rows ?? [])
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

  worksheet['!cols'] = (
    fixture.colWidths ?? fixture.headers.map((h) => Math.max(String(h).length, 10))
  ).map((wch) => ({ wch }))

  if (fixture.border) {
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
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, fixture.name)
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
  borderedRefs: string[]
}

/**
 * 读回产物：表名 / 逐格值（xlsx 读）/ 列宽（xlsx 读）/ 有边框的单元格引用（exceljs 读）。
 *
 * 边框必须用 exceljs 读：xlsx 读回时 `cellStyles: true` 拿不到我们要断言的样式
 * （实测两侧都读到 undefined，会让断言变成假绿）。
 */
async function snapshot(blob: Blob): Promise<SheetSnapshot[]> {
  const buffer = await blob.arrayBuffer()

  const wb = XLSX.read(buffer, { type: 'array', cellStyles: true })
  const exceljsWorkbook = new ExcelJS.Workbook()
  await exceljsWorkbook.xlsx.load(buffer)

  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]!
    const exceljsSheet = exceljsWorkbook.getWorksheet(name)!
    const borderedRefs: string[] = []
    for (let r = 1; r <= exceljsSheet.rowCount; r++) {
      const row = exceljsSheet.getRow(r)
      for (let c = 1; c <= row.cellCount; c++) {
        if (row.getCell(c).border?.top?.style === 'thin') {
          borderedRefs.push(XLSX.utils.encode_cell({ r: r - 1, c: c - 1 }))
        }
      }
    }
    return {
      name,
      // raw:false 让两种实现都以字符串回读（我们的输入本来就是字符串）
      values: XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as unknown[][],
      colWidths: (ws['!cols'] ?? []).map((c) => c.wch ?? 0),
      borderedRefs: borderedRefs.sort(),
    }
  })
}

/** 归一化：把 '' 与 undefined 视为等价值（两种实现对"空单元格"的落盘方式可能不同） */
function normalize(sheets: SheetSnapshot[]): unknown[] {
  return sheets.map((sheet) => ({
    name: sheet.name,
    values: sheet.values.map((row) =>
      row.map((v) => (v === undefined || v === '' ? null : String(v))),
    ),
    colWidths: sheet.colWidths,
  }))
}

const FIXTURE = {
  name: 'Sheet1',
  headers: ['名称', '经度', '纬度', '备注'],
  rows: [
    ['站点A', '116.4', '39.9', ''],
    ['站点B', '121.5', '31.2', '带,逗号'],
    ['站点C', '113.2', '23.1', '含"引号"'],
  ] as string[][],
}

const MULTI_FIXTURE = {
  name: '点',
  headers: ['名称', '经纬度', '路径'],
  rows: [['站点A', '116.4,39.9', '']] as string[][],
  colWidths: [8, 30, 20],
  border: true,
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('exceljsPipeline · 产物与旧 xlsx 实现逐格一致（C4 阶段 3 验收）', () => {
  it('带边框 + 默认列宽：逐格一致', async () => {
    const legacy = await snapshot(legacyXlsx({ ...FIXTURE, border: true }))
    const next = await snapshot(
      await writeXlsx([
        { name: FIXTURE.name, headers: FIXTURE.headers, rows: FIXTURE.rows, border: true },
      ]),
    )
    expect(normalize(next)).toEqual(normalize(legacy))

    // 旧实现（xlsx）其实一个边框都没写出来；新实现必须真的写出来
    expect(legacy[0]!.borderedRefs).toHaveLength(0)
    expect(next[0]!.borderedRefs.length).toBeGreaterThan(10)
    expect(next[0]!.borderedRefs).toContain('A1')
  })

  it('无边框 + 自定义列宽：逐格一致', async () => {
    const legacy = await snapshot(
      legacyXlsx({
        name: MULTI_FIXTURE.name,
        headers: MULTI_FIXTURE.headers,
        rows: MULTI_FIXTURE.rows,
        colWidths: MULTI_FIXTURE.colWidths,
      }),
    )
    const next = await snapshot(
      await writeXlsx([
        {
          name: MULTI_FIXTURE.name,
          headers: MULTI_FIXTURE.headers,
          rows: MULTI_FIXTURE.rows,
          colWidths: MULTI_FIXTURE.colWidths,
        },
      ]),
    )
    expect(normalize(next)).toEqual(normalize(legacy))
  })

  it('多工作表（多个 sheet，各自列宽与边框）逐格一致', async () => {
    const sheets = [
      {
        name: '点',
        headers: ['名称', '经纬度'],
        rows: [['A', '116.4,39.9']] as string[][],
        colWidths: [8, 30],
        border: true,
      },
      {
        name: '线',
        headers: ['名称', '路径'],
        rows: [['B', 'group_1']] as string[][],
        colWidths: [8, 20],
        border: false,
      },
      { name: '面', headers: ['名称'] },
    ]
    const legacyBlobs = sheets.map((s) => legacyXlsx({ ...s, border: s.border }))
    const legacyWorkbook = XLSX.utils.book_new()
    // 旧实现的多 sheet 写法：逐个 append 后一次 write
    for (const blob of legacyBlobs) {
      const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array', cellStyles: true })
      for (const name of wb.SheetNames) {
        XLSX.utils.book_append_sheet(legacyWorkbook, wb.Sheets[name]!, name)
      }
    }
    const legacyOut = XLSX.write(legacyWorkbook, {
      bookType: 'xlsx',
      type: 'array',
      bookSST: false,
    })
    const legacy = await snapshot(new Blob([legacyOut]))

    const next = await snapshot(await writeXlsx(sheets))
    expect(normalize(next)).toEqual(normalize(legacy))
  })

  it('对象数组 → headers 由 collectHeaders 推导（对齐 json_to_sheet 语义）', async () => {
    const objs = [
      { 名称: 'A', 经度: 116.4, 纬度: 39.9 },
      { 名称: 'B', 经度: 121.5, 纬度: 31.2, 备注: '多出的列' },
    ]
    const headers = collectHeaders(objs)
    expect(headers).toEqual(['名称', '经度', '纬度', '备注'])
    expect(rowsFromObjects(objs, headers)[1]).toEqual(['B', 121.5, 31.2, '多出的列'])

    // 与 json_to_sheet 的值域一致（读回比较）
    const legacyWorkbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(legacyWorkbook, XLSX.utils.json_to_sheet(objs as never[]), '数据')
    const legacyOut = XLSX.write(legacyWorkbook, {
      bookType: 'xlsx',
      type: 'array',
      bookSST: false,
    })
    const legacy = await snapshot(new Blob([legacyOut]))
    const next = await snapshot(
      await writeXlsx([
        { name: '数据', headers, rows: rowsFromObjects(objs, headers), defaultColWidths: false },
      ]),
    )

    expect(normalize(next)).toEqual(normalize(legacy))
  })
})

describe('exceljsPipeline · 进度与让出', () => {
  it('onProgress 上报 0→100，整数、单调不减', async () => {
    const reports: number[] = []
    await writeXlsx([{ name: 'S', headers: ['a'], rows: [['x'], ['y']] }], (p) => reports.push(p))
    expect(reports.length).toBeGreaterThan(2)
    expect(reports[0]).toBe(0)
    expect(reports[reports.length - 1]).toBe(100)
    for (let i = 1; i < reports.length; i++) {
      expect(reports[i]!).toBeGreaterThanOrEqual(reports[i - 1]!)
    }
    for (const p of reports) expect(Number.isInteger(p)).toBe(true)
  })

  it('大表按批让出：5000 行至少 yield 4 次', async () => {
    const rows = Array.from({ length: 5000 }, (_, i) => [`p${i}`, '116.4'])
    const counter = countYields()
    try {
      await writeXlsx([{ name: 'S', headers: ['名称', '经度'], rows }])
    } finally {
      counter.restore()
    }
    // 起点 1 + 逐行分片（0/2000/4000）3 + 生成前 1 = 5
    expect(counter.getCount()).toBeGreaterThanOrEqual(4)
  })

  it('边框遍历也在让出（5000 行带边框）', async () => {
    const rows = Array.from({ length: 5000 }, (_, i) => [`p${i}`, '116.4'])
    const counter = countYields()
    try {
      await writeXlsx([{ name: 'S', headers: ['名称', '经度'], rows, border: true }])
    } finally {
      counter.restore()
    }
    // 边框按每 200 行让出一次，5001 行应有 25+ 次
    expect(counter.getCount()).toBeGreaterThanOrEqual(25)
  })

  it('多 sheet 时进度单调不减（曾出现 46→45 倒退，见单调夹取）', async () => {
    // 刻意让第二个 sheet 有 2000+ 行：旧的 sheetBase + span 公式在这里会越过下一个起点
    // 4 个 sheet：sheetBase=round(i/4*90)={0,23,45,68} 而 span=round(90/4)=23，
    // 于是 sheet1 末尾可到 23+23=46，下一张却从 45 开始 —— 这正是倒退的成因。
    // 第三个 sheet 固定 2001 行（让出边界 i=0/2000，末次上报恰好封顶）。
    const sheets = [
      { name: 'A', headers: ['a'], rows: Array.from({ length: 10 }, (_, i) => ['a' + i]) },
      { name: 'B', headers: ['b'], rows: Array.from({ length: 2001 }, (_, i) => ['b' + i]) },
      { name: 'C', headers: ['c'], rows: Array.from({ length: 10 }, (_, i) => ['c' + i]) },
      { name: 'D', headers: ['d'], rows: Array.from({ length: 10 }, (_, i) => ['d' + i]) },
    ]
    const reports: number[] = []
    await writeXlsx(sheets, (percent) => reports.push(percent))
    expect(reports.length).toBeGreaterThan(3)
    for (let i = 1; i < reports.length; i++) {
      expect(reports[i]!).toBeGreaterThanOrEqual(reports[i - 1]!)
    }
    expect(reports[reports.length - 1]).toBe(100)
  })

  it('列宽映射：给 wch，产物里的列宽必须正好是 wch（5/6 补偿被钉住）', async () => {
    const blob = await writeXlsx([
      { name: 'S', headers: ['a', 'b', 'c'], rows: [['1', '2', '3']], colWidths: [8, 30, 12.5] },
    ])
    const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array', cellStyles: true })
    expect((wb.Sheets['S']!['!cols'] ?? []).map((c) => c.wch)).toEqual([8, 30, 12.5])
  })

  it('稀疏行（某行比表头短，中间留洞）与旧实现逐格一致', async () => {
    const spec = {
      name: 'S',
      headers: ['a', 'b', 'c', 'd'],
      rows: [['1', undefined, '3', undefined]] as unknown[][],
    }
    const legacy = XLSX.utils.book_new()
    const legacySheet = XLSX.utils.aoa_to_sheet([spec.headers, ...spec.rows])
    legacySheet['!cols'] = spec.headers.map(() => ({ wch: 10 }))
    XLSX.utils.book_append_sheet(legacy, legacySheet, spec.name)
    const legacyOut = XLSX.write(legacy, { bookType: 'xlsx', type: 'array', bookSST: false })
    const legacySnapshot = await snapshot(new Blob([legacyOut]))
    const nextSnapshot = await snapshot(await writeXlsx([spec]))
    expect(normalize(nextSnapshot)).toEqual(normalize(legacySnapshot))
  })
})

describe('exceljsPipeline · 表名清洗与工具函数', () => {
  it('safeSheetName：非法字符替换、超长截断、空名兜底', () => {
    expect(safeSheetName('点/线')).toBe('点_线')
    expect(safeSheetName('a:b*c?d[e]')).toBe('a_b_c_d_e_')
    expect(safeSheetName(''.padEnd(40, 'x'))).toHaveLength(31)
    expect(safeSheetName('   ')).toBe('Sheet1')
  })

  it("collectHeaders：按首次出现顺序取并集；rowsFromObjects：undefined 归一为 ''", () => {
    expect(collectHeaders([{ b: 1 }, { a: 2, b: 2 }, { c: 3, a: 4 }])).toEqual(['b', 'a', 'c'])
    expect(rowsFromObjects([{ a: 1, b: undefined }], ['a', 'b'])).toEqual([[1, '']])
  })
})

/** 统计一次调用期间的「让出主线程」次数（yieldToUI 走 setTimeout(fn, 0)） */
function countYields() {
  const realSetTimeout = globalThis.setTimeout.bind(globalThis)
  let zeroDelayCalls = 0
  const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    fn: () => void,
    ms?: number,
  ) => {
    if (ms === 0) zeroDelayCalls++
    return realSetTimeout(fn, ms)
  }) as unknown as typeof setTimeout)
  return { getCount: () => zeroDelayCalls, restore: () => spy.mockRestore() }
}
