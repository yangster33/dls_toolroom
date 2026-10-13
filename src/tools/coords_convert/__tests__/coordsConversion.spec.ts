import { describe, it, expect, vi } from 'vitest'
import * as XLSX from 'xlsx'
import {
  batchConvertCoordinates,
  resolveInputSystem,
  convertToCsv,
  convertToXlsx,
  type DataRow,
} from '../coordsConversion'

/**
 * `convertToXlsx` 走 `utils/exceljsPipeline`，其中 exceljs 是**懒加载**的。
 * 本文件多个 describe 装了 fake timers，而 fake timers 下首次 `await import('exceljs')`
 * 不会 settle（Vite 模块加载链依赖真实计时器，已实测）。因此在装计时器之前预载。
 */
await import('exceljs')

function row(name: string, lng: string | number, lat: string | number): DataRow {
  return { 名称: name, '经度/X（必填）': lng, '纬度/Y（必填）': lat }
}

describe('batchConvertCoordinates - 前置校验', () => {
  it('空数据返回错误', async () => {
    const result = await batchConvertCoordinates([], {
      inputSystem: 'wgs84',
      outputSystem: 'gcj02',
    })
    expect(result.success).toBe(false)
    expect(result.errors).toEqual(['没有可转换的数据'])
  })

  it('不支持的输入坐标系', async () => {
    const result = await batchConvertCoordinates([row('甲', '116.4', '39.9')], {
      inputSystem: 'mars',
      outputSystem: 'wgs84',
    })
    expect(result.errors).toEqual(['不支持的输入坐标系: mars'])
  })

  it('不支持的输出坐标系', async () => {
    const result = await batchConvertCoordinates([row('甲', '116.4', '39.9')], {
      inputSystem: 'wgs84',
      outputSystem: 'mars',
    })
    expect(result.errors).toEqual(['不支持的输出坐标系: mars'])
  })

  it('缺少经度/X 或纬度/Y 列', async () => {
    const result = await batchConvertCoordinates([{ 名称: '甲' }], {
      inputSystem: 'wgs84',
      outputSystem: 'gcj02',
    })
    expect(result.errors).toEqual(['数据中缺少经度/X或纬度/Y列'])
  })
})

describe('batchConvertCoordinates - 转换', () => {
  it('成功转换并输出完整表头', async () => {
    const result = await batchConvertCoordinates(
      [row('甲', '116.4', '39.9'), row('乙', '117.5', '40.1')],
      { inputSystem: 'wgs84', outputSystem: 'gcj02' },
    )
    expect(result.success).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.totalRows).toBe(2)
    expect(result.processedRows).toBe(2)
    expect(result.outputHeaders).toEqual([
      '名称',
      '经度/X（WGS84）',
      '纬度/Y（WGS84）',
      '经度/X（GCJ-02）',
      '纬度/Y（GCJ-02）',
    ])
    expect(result.data).toHaveLength(2)
    const first = result.data[0]!
    expect(first['名称']).toBe('甲')
    expect(first['经度/X（WGS84）']).toBe(116.4)
    expect(Math.abs((first['经度/X（GCJ-02）'] as number) - 116.4)).toBeGreaterThan(0.0005)
  })

  it('无名称列时使用点位+行号', async () => {
    const rows = [{ '经度/X（必填）': '116.4', '纬度/Y（必填）': '39.9' }]
    const result = await batchConvertCoordinates(rows, {
      inputSystem: 'wgs84',
      outputSystem: 'wgs84',
    })
    expect(result.data[0]!['名称']).toBe('点位1')
  })

  it('非法坐标行记录错误并继续', async () => {
    const result = await batchConvertCoordinates(
      [row('甲', '116.4', '39.9'), row('乙', 'abc', '39.9'), row('丙', '116.4', '39.9')],
      { inputSystem: 'wgs84', outputSystem: 'wgs84' },
    )
    expect(result.success).toBe(true)
    expect(result.processedRows).toBe(2)
    expect(result.errors).toEqual(['第 2 行: 坐标值不是有效的数字'])
  })

  it('全部行非法时 success 为 false', async () => {
    const result = await batchConvertCoordinates([row('甲', 'abc', '39.9')], {
      inputSystem: 'wgs84',
      outputSystem: 'wgs84',
    })
    expect(result.success).toBe(false)
  })

  it('提前中止返回已取消错误', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await batchConvertCoordinates([row('甲', '116.4', '39.9')], {
      inputSystem: 'wgs84',
      outputSystem: 'gcj02',
      abortSignal: controller.signal,
    })
    expect(result.success).toBe(false)
    expect(result.errors).toEqual(['转换已被取消'])
  })
})

describe('batchConvertCoordinates - 进度', () => {
  it('按批次上报进度', async () => {
    const onProgress = vi.fn()
    const rows = Array.from({ length: 60 }, (_, i) => row(`点${i + 1}`, '116.4', '39.9'))
    await batchConvertCoordinates(rows, {
      inputSystem: 'wgs84',
      outputSystem: 'wgs84',
      batchSize: 50,
      onProgress,
    })
    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress.mock.calls[0]![0].processedRows).toBe(50)
    expect(onProgress.mock.calls[1]![0].progress).toBe(100)
    expect(onProgress.mock.calls[1]![0].totalRows).toBe(60)
  })

  it('进度信息包含剩余时间估算', async () => {
    const onProgress = vi.fn()
    await batchConvertCoordinates([row('甲', '116.4', '39.9')], {
      inputSystem: 'wgs84',
      outputSystem: 'wgs84',
      onProgress,
    })
    const info = onProgress.mock.calls[0]![0]
    expect(info.progress).toBe(100)
    expect(info.estimatedRemainingTime).toBe(0)
    expect(info.elapsedTime).toBeGreaterThanOrEqual(0)
  })
})

describe('convertToCsv', () => {
  it('空数据或空表头返回空字符串', () => {
    expect(convertToCsv([], ['a'])).toBe('')
    expect(convertToCsv([{ a: 1 }], [])).toBe('')
  })

  it('生成带 BOM 的 CSV', () => {
    const csv = convertToCsv([{ 名称: '甲' }], ['名称'])
    expect(csv).toBe('\uFEFF名称\n甲')
  })

  it('逗号与引号字段转义', () => {
    const csv = convertToCsv([{ 备注: '他说 "你好",是吧' }], ['备注'])
    expect(csv).toBe('\uFEFF备注\n"他说 ""你好"",是吧"')
  })

  it('null/undefined 值输出为空', () => {
    const csv = convertToCsv([{ a: null, b: undefined }], ['a', 'b'])
    expect(csv).toBe('\uFEFFa,b\n,')
  })

  it('表头含特殊字符时转义', () => {
    const csv = convertToCsv([{ '名,称': '值' }], ['名,称'])
    expect(csv).toBe('\uFEFF"名,称"\n值')
  })
})

describe('convertToXlsx', () => {
  // C4 阶段 3：convertToXlsx 改为 async（exceljs 路由懒加载 exceljs）
  it('空数据返回空 Blob', async () => {
    const blob = await convertToXlsx([], ['a'])
    expect(blob.size).toBe(0)
    expect(blob.type).toBe('application/octet-stream')
  })

  it('返回 xlsx Blob', async () => {
    const blob = await convertToXlsx([{ 名称: '甲' }], ['名称'])
    expect(blob.type).toContain('spreadsheetml')
    expect(blob.size).toBeGreaterThan(0)
  })
})

/**
 * C4 阶段 3 验收内核：`convertToXlsx` 从 xlsx(SheetJS) 迁到 exceljs 管线后，
 * **产物必须与旧实现逐格一致**。
 *
 * 关键设计 1：黄金参考是内联在本文件的 `legacyConvertToXlsx()` ——
 * 旧实现已随迁移删除，没有可 import 的旧代码；而"删掉旧实现就删掉比对"
 * 会让迁移失去回归兜底（与 `utils/__tests__/exceljsPipeline.spec.ts` 同一设计）。
 *
 * 关键设计 2：旧实现**从不写边框**（`aoa_to_sheet` 路径上没有 `cell.s` 的赋值），
 * 新实现也不传 `border`，因此这里只比对 **表名 / 逐格值 / 列宽**。
 *
 * 关键设计 3：列宽是这次迁移最容易悄悄变形的东西（exceljs 的宽度补偿是
 * `wch + 0.83`），所以 fixture 必须**至少 8 列**且表头长度有长有短，
 * 列宽一旦漂移，`colWidths` 数组就会红。
 */

interface ReadBackSheet {
  name: string
  values: unknown[][]
  colWidths: number[]
}

/**
 * 读回产物：表名 / 逐格值 / 列宽。
 *
 * `raw: false` 两侧都用字符串回读（避免 exceljs 与 xlsx 的数字类型标记差异影响比对），
 * `defval: ''` 把"空单元格"与"空串单元格"都归一成同一个值。
 */
const readBack = async (blob: Blob): Promise<ReadBackSheet[]> => {
  const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array', cellStyles: true })
  return wb.SheetNames.map((name) => ({
    name,
    values: XLSX.utils.sheet_to_json(wb.Sheets[name]!, {
      header: 1,
      raw: false,
      defval: '',
    }) as unknown[][],
    colWidths: (wb.Sheets[name]!['!cols'] ?? []).map((c) => c.wch ?? 0),
  }))
}

/** 迁移前 `convertToXlsx` 的忠实副本（黄金参考） */
function legacyConvertToXlsx(data: DataRow[], headers: string[]): Blob {
  if (!data || data.length === 0 || !headers || headers.length === 0) {
    return new Blob([], { type: 'application/octet-stream' })
  }

  const worksheetData: (string | number | boolean | null)[][] = [headers]

  for (const row of data) {
    const rowData: (string | number | boolean | null)[] = []
    for (const header of headers) {
      const value = row[header]
      rowData.push(value === undefined ? '' : value)
    }
    worksheetData.push(rowData)
  }

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

  worksheet['!cols'] = headers.map((header) => ({
    wch: Math.max(header.length, 10),
  }))

  XLSX.utils.book_append_sheet(workbook, worksheet, '转换结果')

  const wbout = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    bookSST: false,
  })

  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/**
 * 9 列 fixture：表头长度有长有短（`经度/X（GCJ-02）` = 12 字符 → 列宽 12，
 * 其余 ≤ 10 落到 10），值域覆盖 整数 / 0 / 负数 / 小数 / 字符串 / 空串 /
 * null / undefined / 布尔。
 */
const WIDE_HEADERS = [
  '名称',
  '编号',
  '经度/X（GCJ-02）',
  '纬度/Y（GCJ-02）',
  '高程',
  '有效',
  '备注',
  '更新时间',
  '序号',
]

const WIDE_ROWS: DataRow[] = [
  {
    名称: '站点甲',
    编号: 10001,
    '经度/X（GCJ-02）': 116.397129,
    '纬度/Y（GCJ-02）': 39.916527,
    高程: 40.5,
    有效: true,
    备注: '正常点位',
    更新时间: '2026-10-12 08:30:00',
    序号: 1,
  },
  {
    // 第二行：字符串数值、空串、带逗号/引号的备注
    名称: '站点乙',
    编号: 10002,
    '经度/X（GCJ-02）': '121.473702',
    '纬度/Y（GCJ-02）': '-31.230416',
    高程: -12.5,
    有效: false,
    备注: '带,逗号与"引号"',
    更新时间: '',
    序号: 2,
  },
  {
    // 第三行：0 / null / undefined —— 都不能被静默吞掉
    名称: '站点丙',
    编号: 0,
    '经度/X（GCJ-02）': 0,
    '纬度/Y（GCJ-02）': 0,
    高程: null,
    有效: false,
    备注: '',
    // 更新时间 缺键（undefined） → 归一为 ''
    序号: 3,
  },
]

/**
 * 第二组 fixture（10 列 / 4 行）：换一套维度，避免「列宽只在某一套表头下碰巧一致」。
 *
 * 注意：行对象的 key 必须与表头**同名**（`writeXlsx` 与旧实现都是按表头取值的），
 * 所以这里用 `LONG` / `MISSING` 两个变量同时作表头与 key。
 * `MISSING` 一整列都缺键 —— 覆盖 `undefined → ''` 的归一化路径。
 */
const LONG = '名字特别长的第三列用来拉开宽度差'
const MISSING = '缺键列'
const NARROW_HEADERS = ['a', 'b', LONG, MISSING, 'e', 'f', 'g', 'h', 'i', 'j']

const NARROW_ROWS: DataRow[] = [
  {
    a: 1,
    b: 2,
    [LONG]: 3,
    e: 5,
    f: 6,
    g: 7,
    h: 8,
    i: 9,
    j: 10,
  },
  {
    a: '',
    b: null,
    [LONG]: 'text',
    e: true,
    f: '0',
    g: 0,
    h: '',
    i: undefined,
    j: 'x,y',
  },
  {
    a: '甲',
    b: '乙',
    [LONG]: '丙',
    e: '戊',
    f: '己',
    g: '庚',
    h: '辛',
    i: '壬',
    j: '癸',
  },
  {
    a: '0.1',
    b: 0.2,
    [LONG]: 1e-7,
    e: 123456789,
    f: 0,
    g: '',
    h: '末',
    i: '',
    j: '',
  },
]

describe('convertToXlsx · 产物与旧实现逐格一致（C4 阶段 3 验收）', () => {
  it('9 列 / 数字-字符串-空串-undefined 混合：表名、逐格值、列宽与旧实现一致', async () => {
    const legacyBlob = legacyConvertToXlsx(WIDE_ROWS, WIDE_HEADERS)
    const nextBlob = await convertToXlsx(WIDE_ROWS, WIDE_HEADERS)

    const actual = await readBack(nextBlob)
    expect(actual).toEqual(await readBack(legacyBlob))

    // 显式钉住表名与列宽口径（万一上面的 toEqual 因格式漂移全线失败，这几行能指出方向）
    expect(actual).toHaveLength(1)
    expect(actual[0]!.name).toBe('转换结果')
    expect(actual[0]!.colWidths).toEqual(WIDE_HEADERS.map((h) => Math.max(h.length, 10)))

    // 防「假绿」：把 fixture 真正读到的值写出来，确保比对覆盖的是真实值域
    expect(actual[0]!.values).toHaveLength(WIDE_ROWS.length + 1)
    expect(actual[0]!.values[0]).toEqual(WIDE_HEADERS)
    expect(actual[0]!.values[1]).toEqual([
      '站点甲',
      '10001',
      '116.397129',
      '39.916527',
      '40.5',
      'TRUE',
      '正常点位',
      '2026-10-12 08:30:00',
      '1',
    ])
    expect(actual[0]!.values[2]).toEqual([
      '站点乙',
      '10002',
      '121.473702',
      '-31.230416',
      '-12.5',
      'FALSE',
      '带,逗号与"引号"',
      '',
      '2',
    ])
    // 第三行：0 / null / 空串 / 缺键都各就各位
    expect(actual[0]!.values[3]).toEqual(['站点丙', '0', '0', '0', '', 'FALSE', '', '', '3'])
  })

  it('10 列 / 4 行另一组数据：同样逐格一致（列宽不依赖具体表头）', async () => {
    const legacyBlob = legacyConvertToXlsx(NARROW_ROWS, NARROW_HEADERS)
    const nextBlob = await convertToXlsx(NARROW_ROWS, NARROW_HEADERS)

    const actual = await readBack(nextBlob)
    expect(actual).toEqual(await readBack(legacyBlob))

    expect(actual).toHaveLength(1)
    expect(actual[0]!.name).toBe('转换结果')
    expect(actual[0]!.colWidths).toEqual(NARROW_HEADERS.map((h) => Math.max(h.length, 10)))
    expect(actual[0]!.values).toHaveLength(NARROW_ROWS.length + 1)
    expect(actual[0]!.values[1]).toEqual(['1', '2', '3', '', '5', '6', '7', '8', '9', '10'])
    expect(actual[0]!.values[2]).toEqual(['', '', 'text', '', 'TRUE', '0', '0', '', '', 'x,y'])
    expect(actual[0]!.values[3]).toEqual(['甲', '乙', '丙', '', '戊', '己', '庚', '辛', '壬', '癸'])
    expect(actual[0]!.values[4]).toEqual([
      '0.1',
      '0.2',
      '0.0000001',
      '',
      '123456789',
      '0',
      '',
      '末',
      '',
      '',
    ])
  })

  it('空数据 / 空表头的早退行为与旧实现一致', async () => {
    const cases: Array<[DataRow[], string[]]> = [
      [[], WIDE_HEADERS],
      [WIDE_ROWS, []],
      [[], []],
    ]
    for (const [data, headers] of cases) {
      const next = await convertToXlsx(data, headers)
      const legacy = legacyConvertToXlsx(data, headers)
      expect(next.type).toBe(legacy.type)
      expect(next.size).toBe(0)
    }
    expect((await convertToXlsx([], WIDE_HEADERS)).type).toBe('application/octet-stream')
  })
})

/**
 * 审计 C2 / P0-5 余项：转换必须按【上传时】的输入坐标系解释数据，
 * 而不是用户当前下拉里选的那个。
 */
describe('resolveInputSystem', () => {
  it('尚无成功上传的数据时，用当前选择', () => {
    const r = resolveInputSystem('', 'gcj02')
    expect(r.effectiveSystem).toBe('gcj02')
    expect(r.mismatched).toBe(false)
  })

  it('快照与当前一致时，正常且不提示', () => {
    const r = resolveInputSystem('wgs84', 'wgs84')
    expect(r.effectiveSystem).toBe('wgs84')
    expect(r.mismatched).toBe(false)
  })

  it('上传后改了输入坐标系：仍按快照解释，并标记不一致', () => {
    // 关键用例：数据是按 wgs84 校验的，用户把下拉改成了 cgcs2000_xy。
    // 旧行为会按 cgcs2000_xy 解释经纬度值 —— 静默出错。
    const r = resolveInputSystem('wgs84', 'cgcs2000_xy')
    expect(r.effectiveSystem).toBe('wgs84')
    expect(r.mismatched).toBe(true)
  })

  it('同模式但不同系统时也标记不一致（gcj02 → bd09）', () => {
    const r = resolveInputSystem('gcj02', 'bd09')
    expect(r.effectiveSystem).toBe('gcj02')
    expect(r.mismatched).toBe(true)
  })

  it('反证：沿用旧的「按当前下拉解释」确实会算出不同结果', async () => {
    // 这份数据上传时是按 wgs84（经纬度）校验的，之后用户把下拉改成了 gcj02。
    const rows = [row('A', 116.4, 39.9)]

    const bySnapshot = await batchConvertCoordinates(rows, {
      inputSystem: resolveInputSystem('wgs84', 'gcj02').effectiveSystem,
      outputSystem: 'wgs84',
    })
    const byCurrent = await batchConvertCoordinates(rows, {
      inputSystem: 'gcj02', // 旧行为：改完下拉后直接用它
      outputSystem: 'wgs84',
    })

    expect(bySnapshot.success).toBe(true)
    expect(byCurrent.success).toBe(true)
    // 同一份数据按不同输入系解释，坐标值必然不同 —— 旧行为就是这样静默出错的
    expect(bySnapshot.data[0]).not.toEqual(byCurrent.data[0])
  })
})
