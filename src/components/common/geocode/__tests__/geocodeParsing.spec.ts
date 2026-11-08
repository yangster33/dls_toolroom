import { describe, it, expect } from 'vitest'
import { parseCSV, parseCSVLine } from '../geocodeParsing'

describe('parseCSVLine', () => {
  it('普通字段按逗号拆分', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('双引号内的逗号不拆分', () => {
    expect(parseCSVLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd'])
  })

  it('保留空字段', () => {
    expect(parseCSVLine('a,,c')).toEqual(['a', '', 'c'])
  })
})

describe('parseCSV', () => {
  it('解析表头与数据行', () => {
    const rows = parseCSV('名称,经度,纬度\nA,116.4,39.9\nB,116.5,40.0')
    expect(rows).toEqual([
      { 名称: 'A', 经度: 116.4, 纬度: 39.9 },
      { 名称: 'B', 经度: 116.5, 纬度: 40.0 },
    ])
  })

  it('空字符串保持为空串，不转成数字 0（P0-1 回归）', () => {
    const rows = parseCSV('名称,经度,纬度\nA,,\n')
    expect(rows).toEqual([{ 名称: 'A', 经度: '', 纬度: '' }])
  })

  it('支持带引号的字段与表头', () => {
    const rows = parseCSV('"名称","地址"\n"站点A","北京市,海淀区"')
    expect(rows).toEqual([{ 名称: '站点A', 地址: '北京市,海淀区' }])
  })

  it('只有表头或空文本时返回空数组', () => {
    expect(parseCSV('名称,经度,纬度')).toEqual([])
    expect(parseCSV('')).toEqual([])
  })
})
