import { describe, it, expect } from 'vitest'
import { validateCoordRow, readAndValidateCoordTemplate } from '../templateReader'

function makeCsvFile(content: string, name = '坐标.csv'): File {
  return new File(['\uFEFF' + content], name, { type: 'text/csv' })
}

describe('validateCoordRow', () => {
  it('经纬度模式下合法数值通过', () => {
    expect(
      validateCoordRow({ '经度/X（必填）': 116.4, '纬度/Y（必填）': 39.9 }, true, false),
    ).toEqual([])
  })

  it('经纬度模式下数字字符串通过', () => {
    expect(
      validateCoordRow({ '经度/X（必填）': '116.4', '纬度/Y（必填）': '39.9' }, true, false),
    ).toEqual([])
  })

  it('经纬度模式下非数字报错', () => {
    expect(
      validateCoordRow({ '经度/X（必填）': 'abc', '纬度/Y（必填）': '39.9' }, true, false),
    ).toEqual(['经度"abc"不是有效的数字。'])
    expect(
      validateCoordRow({ '经度/X（必填）': '116.4', '纬度/Y（必填）': '' }, true, false),
    ).toEqual(['纬度""不是有效的数字。'])
  })

  it('经纬度模式下超出范围报错', () => {
    expect(
      validateCoordRow({ '经度/X（必填）': 200, '纬度/Y（必填）': 39.9 }, true, false),
    ).toEqual(['经度值 200 超出有效范围 (-180 ~ 180)。'])
    expect(
      validateCoordRow({ '经度/X（必填）': 116.4, '纬度/Y（必填）': 95 }, true, false),
    ).toEqual(['纬度值 95 超出有效范围 (-90 ~ 90)。'])
  })

  it('平面坐标模式下仅校验数字', () => {
    expect(
      validateCoordRow({ '经度/X（必填）': 500000, '纬度/Y（必填）': 4000000 }, false, true),
    ).toEqual([])
    expect(
      validateCoordRow({ '经度/X（必填）': 'abc', '纬度/Y（必填）': '4000000' }, false, true),
    ).toEqual(['X 坐标"abc"不是有效的数字。'])
    expect(
      validateCoordRow({ '经度/X（必填）': '1', '纬度/Y（必填）': 'xyz' }, false, true),
    ).toEqual(['Y 坐标"xyz"不是有效的数字。'])
  })

  it('非经纬度非平面模式下不做行校验', () => {
    expect(
      validateCoordRow({ '经度/X（必填）': '任意', '纬度/Y（必填）': '' }, false, false),
    ).toEqual([])
  })
})

describe('readAndValidateCoordTemplate', () => {
  it('lnglat 模式读取合法 CSV', async () => {
    const file = makeCsvFile('名称,经度/X（必填）,纬度/Y（必填）\n站点A,116.4,39.9')
    const result = await readAndValidateCoordTemplate(file, 'wgs84_lnglat')
    expect(result.isValid).toBe(true)
    expect(result.dataRows).toEqual([
      { 名称: '站点A', '经度/X（必填）': 116.4, '纬度/Y（必填）': 39.9 },
    ])
  })

  it('wgs84 视为经纬度模式', async () => {
    const file = makeCsvFile('名称,经度/X（必填）,纬度/Y（必填）\nA,abc,39.9')
    const result = await readAndValidateCoordTemplate(file, 'wgs84')
    expect(result.isValid).toBe(false)
    expect(result.errors).toEqual(['第 2 行：经度"abc"不是有效的数字。'])
  })

  it('xy 模式校验平面坐标', async () => {
    const file = makeCsvFile('名称,经度/X（必填）,纬度/Y（必填）\nA,500000,xyz')
    const result = await readAndValidateCoordTemplate(file, 'cgcs2000_xy')
    expect(result.isValid).toBe(false)
    expect(result.errors).toEqual(['第 2 行：Y 坐标"xyz"不是有效的数字。'])
  })

  it('缺失表头时报错', async () => {
    const file = makeCsvFile('名称,经度\nA,116.4')
    const result = await readAndValidateCoordTemplate(file, 'wgs84_lnglat')
    expect(result.isValid).toBe(false)
    expect(result.errors[0]).toContain('缺少必要的字段')
  })

  it('任一非法行时整体校验失败且不返回数据', async () => {
    const file = makeCsvFile('名称,经度/X（必填）,纬度/Y（必填）\nA,116.4,39.9\nB,abc,def')
    const result = await readAndValidateCoordTemplate(file, 'wgs84_lnglat')
    expect(result.isValid).toBe(false)
    expect(result.dataRows).toEqual([])
    expect(result.errors).toEqual([
      '第 3 行：经度"abc"不是有效的数字。',
      '第 3 行：纬度"def"不是有效的数字。',
    ])
  })
})
