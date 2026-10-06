import { describe, it, expect } from 'vitest'
import { parseCSVLine, parseCSV } from '../CsvParser'

describe('parseCSVLine', () => {
  it('按逗号拆分普通行', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('保留引号内逗号', () => {
    expect(parseCSVLine('"a,b",c')).toEqual(['a,b', 'c'])
  })

  it('保留空字段', () => {
    expect(parseCSVLine('a,,c')).toEqual(['a', '', 'c'])
  })

  it('单字段行', () => {
    expect(parseCSVLine('abc')).toEqual(['abc'])
  })

  it('空行', () => {
    expect(parseCSVLine('')).toEqual([''])
  })
})

describe('parseCSV', () => {
  it('解析表头与数据行并转换数字', () => {
    const rows = parseCSV('名称,经度,纬度\n甲,116.4,39.9\n乙,117.5,40.1')
    expect(rows).toEqual([
      { 名称: '甲', 经度: 116.4, 纬度: 39.9 },
      { 名称: '乙', 经度: 117.5, 纬度: 40.1 },
    ])
  })

  it('剥离 BOM 头', () => {
    const rows = parseCSV('\uFEFF名称,经度\n甲,116.4')
    expect(rows).toEqual([{ 名称: '甲', 经度: 116.4 }])
  })

  it('跳过空行', () => {
    const rows = parseCSV('a,b\n1,2\n\n3,4\n')
    expect(rows).toEqual([
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ])
  })

  it('兼容 CRLF 换行', () => {
    const rows = parseCSV('名称,经度\r\n甲,116.4\r\n乙,117.5')
    expect(rows).toEqual([
      { 名称: '甲', 经度: 116.4 },
      { 名称: '乙', 经度: 117.5 },
    ])
  })

  it('处理带引号的字段与表头', () => {
    const rows = parseCSV('"名称","经度"\n"甲,站","116.4"')
    expect(rows).toEqual([{ 名称: '甲,站', 经度: 116.4 }])
  })

  it('trimValues=false 时保留字段空白（末尾行尾空白仍被整体 trim 去掉）', () => {
    const rows = parseCSV('a,b\n 1 , 2 ', { trimValues: false, convertNumbers: false })
    expect(rows).toEqual([{ a: ' 1 ', b: ' 2' }])
  })

  it('convertNumbers=false 时保持字符串', () => {
    const rows = parseCSV('a,b\n1,2', { convertNumbers: false })
    expect(rows).toEqual([{ a: '1', b: '2' }])
  })

  it('非数字字符串保持原样', () => {
    const rows = parseCSV('a\nx')
    expect(rows).toEqual([{ a: 'x' }])
  })

  it('空单元格保持空字符串，不转换为数字 0', () => {
    // 回归用例（审计 P0-4）：旧实现 `Number('') === 0` 会把空白经纬度变成 0，
    // 通过范围校验后被当作几内亚湾 (0°N,0°E) 的真实坐标发给 API。
    const rows = parseCSV('a,b\n1,')
    expect(rows).toEqual([{ a: 1, b: '' }])
  })

  it('全空白单元格保持空字符串', () => {
    const rows = parseCSV('a,b,c\n ,   ,')
    expect(rows).toEqual([{ a: '', b: '', c: '' }])
  })

  it('显式的 "0" 仍然是数字 0（与空白区分）', () => {
    const rows = parseCSV('a,b\n0,0')
    expect(rows).toEqual([{ a: 0, b: 0 }])
  })

  it('缺少表头时返回空数组', () => {
    expect(parseCSV('')).toEqual([])
    expect(parseCSV('a,b')).toEqual([])
  })

  it('缺失字段按空字符串处理', () => {
    const rows = parseCSV('a,b\n1')
    expect(rows).toEqual([{ a: 1, b: '' }])
  })
})