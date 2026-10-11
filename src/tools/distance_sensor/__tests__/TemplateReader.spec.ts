import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { readAndValidateTemplate } from '../TemplateReader'
import { aoaToTemplateRows, columnsFromRows } from '../templateRows'

/**
 * 审计 C1 / P1-6 的回归测试。
 *
 * 旧行为：XLSX 用默认的 `sheet_to_json(ws)`（对象模式），而它**不给空单元格
 * 建 key**。6 列异站址模板里，只要第一条数据的「名称2/经度2/纬度2」为空，
 * 首行就只有 3 个 key → 列数被数成 3 → 误判为同站址 → 每行报「名称不能为空」。
 */

/**
 * 6 列异站址模板：第一条数据只写了前 3 列，后 3 列是**完全空白的单元格**
 * （真实 Excel 里空单元格没有 cell 对象，而不是空串）。
 * 注意若写成 `''`，`aoa_to_sheet` 会为其建立 cell，反而开始有 key——
 * 这正是反证用例要体现的差别。
 */
const DIFFERENT_SITE_AOA = [
  ['名称1', '经度1', '纬度1', '名称2', '经度2', '纬度2'],
  ['甲地', '116.4', '39.9'],
  ['乙地', '117.0', '40.0', '乙源', '118.0', '41.0'],
]

/** 3 列同站址模板 */
const SAME_SITE_AOA = [
  ['名称', '经度', '纬度'],
  ['丙地', '116.4', '39.9'],
  ['丁地', '117.0', '40.0'],
]

/** 走真实 xlsx 库：aoa → sheet → sheet_to_json(header:1) → 整形 */
function roundTripViaXlsx(aoa: unknown[][]) {
  const worksheet = XLSX.utils.aoa_to_sheet(aoa)
  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
  return aoaToTemplateRows(matrix)
}

describe('aoaToTemplateRows', () => {
  it('列名来自表头行，而不是数据行', () => {
    const { columns, rows } = aoaToTemplateRows(DIFFERENT_SITE_AOA)
    expect(columns).toHaveLength(6)
    // 即便某行单元格为空，每行也必须带齐全部表头 key
    expect(Object.keys(rows[0]!)).toHaveLength(6)
    expect(Object.keys(rows[1]!)).toHaveLength(6)
  })

  it('空单元格补为空串，不是 undefined', () => {
    const { rows } = aoaToTemplateRows(DIFFERENT_SITE_AOA)
    expect(rows[0]!['名称2']).toBe('')
    expect(rows[0]!['经度2']).toBe('')
    expect(rows[0]!['纬度2']).toBe('')
  })

  it('整行为空的行被跳过', () => {
    const { rows } = aoaToTemplateRows([
      ['名称', '经度', '纬度'],
      ['', '', ''],
      ['丙地', '116.4', '39.9'],
    ])
    expect(rows).toHaveLength(1)
  })

  it('数据行短于表头时不越界', () => {
    const { rows, columns } = aoaToTemplateRows([['a', 'b', 'c'], ['x']])
    expect(columns).toHaveLength(3)
    expect(rows[0]).toEqual({ a: 'x', b: '', c: '' })
  })

  it('columnsFromRows 从行对象读表头', () => {
    const { rows } = aoaToTemplateRows(SAME_SITE_AOA)
    expect(columnsFromRows(rows)).toEqual(['名称', '经度', '纬度'])
    expect(columnsFromRows([])).toEqual([])
  })
})

describe('异站址模板：首行 data2 为空（审计 C1 核心用例）', () => {
  it('正确识别为异站址模式，而不是同站址', () => {
    const { columns, rows } = roundTripViaXlsx(DIFFERENT_SITE_AOA)
    const result = readAndValidateTemplate(rows, columns)

    expect(result.mode).toBe('different-site')
    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('两组数据量正确：目标集 2 条、源集 1 条', () => {
    const { columns, rows } = roundTripViaXlsx(DIFFERENT_SITE_AOA)
    const result = readAndValidateTemplate(rows, columns)

    expect(result.data1.map((p) => p.name)).toEqual(['甲地', '乙地'])
    expect(result.data2.map((p) => p.name)).toEqual(['乙源'])
  })

  it('反证：旧的对象模式 sheet_to_json 会让首行只剩 3 个 key → 误判同站址', () => {
    // 旧实现就是这个：默认对象模式，不给空单元格建 key
    const worksheet = XLSX.utils.aoa_to_sheet(DIFFERENT_SITE_AOA)
    const objectRows = XLSX.utils.sheet_to_json(worksheet) as Record<string, string | number>[]

    expect(Object.keys(objectRows[0]!)).toHaveLength(3)

    const old = readAndValidateTemplate(objectRows)
    // 旧的误判：当成同站址，于是每行都报「名称不能为空」
    expect(old.mode).toBe('same-site')
    expect(old.errors.length).toBeGreaterThan(0)
  })
  it('空白被写成空串时，对象模式也会建出 6 个 key（旧代码碰巧不误判）', () => {
    // 这个用例用于锁住前面的前提：真正的坑是**单元格完全空白**（无 cell 对象）。
    // 若某列被写成空串 ''，`aoa_to_sheet` 会为其建立 cell，对象模式同样有 6 个 key。
    const withEmptyStrings = [
      ['名称1', '经度1', '纬度1', '名称2', '经度2', '纬度2'],
      ['甲地', '116.4', '39.9', '', '', ''],
      ['乙地', '117.0', '40.0', '乙源', '118.0', '41.0'],
    ]
    const worksheet = XLSX.utils.aoa_to_sheet(withEmptyStrings)
    const objectRows = XLSX.utils.sheet_to_json(worksheet) as Record<string, string | number>[]

    expect(Object.keys(objectRows[0]!)).toHaveLength(6)
    expect(readAndValidateTemplate(objectRows).mode).toBe('different-site')
  })
})

describe('同站址模板', () => {
  it('3 列仍识别为同站址', () => {
    const { columns, rows } = roundTripViaXlsx(SAME_SITE_AOA)
    const result = readAndValidateTemplate(rows, columns)

    expect(result.mode).toBe('same-site')
    expect(result.isValid).toBe(true)
    expect(result.data1).toHaveLength(2)
    expect(result.data2).toHaveLength(2)
  })

  it('缺 value 时报「名称不能为空」', () => {
    const result = readAndValidateTemplate([{ 名称: ' ', 经度: '116.4', 纬度: '39.9' }])
    expect(result.errors).toEqual(['第2行：名称不能为空'])
  })
})

describe('列数校验', () => {
  it('既不是 3 也不是 6 列时报错', () => {
    const result = readAndValidateTemplate([{ a: '1', b: '2' }], ['a', 'b'])
    expect(result.isValid).toBe(false)
    expect(result.errors[0]).toContain('模板列数不正确')
  })

  it('空数据报「模板数据为空」', () => {
    const result = readAndValidateTemplate([])
    expect(result.isValid).toBe(false)
    expect(result.errors).toEqual(['模板数据为空'])
  })
})
