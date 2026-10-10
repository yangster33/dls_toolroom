import { describe, it, expect } from 'vitest'
import { readAndValidateTemplate } from '../TemplateReader'

/**
 * 审计报告 P0-1 的回归测试
 *
 * 历史 Bug：`Number('') === 0`，空白经纬度单元格被当作 (0, 0) —— 几内亚湾 ——
 * 并通过 [-180,180] / [-90,90] 范围校验，静默产出错误的高程/地址结果。
 *
 * 旁证这是漏洞而非设计：同一份文件用 XLSX 导入会正常报错
 * （sheet_to_json 不给空单元格建 key），而 CSV 导入静默出错。
 */
describe('readAndValidateTemplate - 空白单元格（P0-1 回归）', () => {
  it('经度留空 → 报错，不产生 (0, x) 的假坐标', () => {
    const result = readAndValidateTemplate([{ 名称: 'A', 经度: '', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
    expect(result.errors.join()).toContain('经度')
  })

  it('纬度留空 → 报错，不产生 (x, 0) 的假坐标', () => {
    const result = readAndValidateTemplate([{ 名称: 'A', 经度: '116.4', 纬度: '' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
    expect(result.errors.join()).toContain('纬度')
  })

  it('经纬度都留空 → 报经度错误', () => {
    const result = readAndValidateTemplate([{ 名称: 'A', 经度: '', 纬度: '' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
  })

  it('纯空格等同于空 → 同样报错', () => {
    const result = readAndValidateTemplate([{ 名称: 'A', 经度: '   ', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
  })

  it('null / undefined 单元格 → 报错', () => {
    const result = readAndValidateTemplate([
      { 名称: 'A', 经度: null, 纬度: '39.9' } as unknown as Record<string, string | number>,
    ])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
  })
})

describe('readAndValidateTemplate - 合法数据不受影响', () => {
  it('正常经纬度通过校验', () => {
    const result = readAndValidateTemplate([{ 名称: 'A', 经度: '116.4', 纬度: '39.9' }])

    expect(result.isValid).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({ name: 'A', longitude: 116.4, latitude: 39.9 })
  })

  it('数字类型的单元格同样通过', () => {
    const result = readAndValidateTemplate([{ 名称: 'A', 经度: 116.4, 纬度: 39.9 }])

    expect(result.isValid).toBe(true)
    expect(result.data[0]).toMatchObject({ longitude: 116.4, latitude: 39.9 })
  })

  it('0 度是合法坐标（赤道/本初子午线），必须保留', () => {
    const result = readAndValidateTemplate([{ 名称: 'A', 经度: '0', 纬度: '0' }])

    expect(result.isValid).toBe(true)
    expect(result.data[0]).toMatchObject({ longitude: 0, latitude: 0 })
  })

  it('多个别名（英文列名）都能识别', () => {
    const result = readAndValidateTemplate([{ name: 'A', lon: '116.4', lat: '39.9' }])

    expect(result.isValid).toBe(true)
    expect(result.data[0]).toMatchObject({ name: 'A', longitude: 116.4, latitude: 39.9 })
  })
})

describe('readAndValidateTemplate - 脏数据（P1-9 部分）', () => {
  it('"116.4abc" 这类宽松前缀被拒绝，不被静默净化', () => {
    const result = readAndValidateTemplate([{ 名称: 'A', 经度: '116.4abc', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
  })

  it('超出范围的坐标被拒绝', () => {
    const result = readAndValidateTemplate([{ 名称: 'A', 经度: '190', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.errors.join()).toContain('经度')
  })

  it('名称为空 → 报名称错误', () => {
    const result = readAndValidateTemplate([{ 名称: '', 经度: '116.4', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.errors.join()).toContain('名称')
  })
})
