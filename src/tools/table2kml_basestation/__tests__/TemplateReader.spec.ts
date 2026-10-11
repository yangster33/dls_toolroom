import { describe, it, expect } from 'vitest'
import { validateRow } from '../TemplateReader'

const VALID_ROW = {
  扇区名称: '小区A',
  经度: '116.4',
  纬度: '39.9',
  方位角: '90',
  半功率角: '65',
  半径: '500',
}

describe('validateRow - 必填字段', () => {
  it('合法行返回空错误数组', () => {
    expect(validateRow(VALID_ROW, 0)).toEqual([])
  })

  it('扇区名称不能为空', () => {
    expect(validateRow({ ...VALID_ROW, 扇区名称: '  ' }, 0)).toEqual(['扇区名称不能为空'])
    expect(validateRow({ ...VALID_ROW, 扇区名称: undefined }, 0)).toEqual(['扇区名称不能为空'])
  })

  it('经度必须是数字且在范围内', () => {
    expect(validateRow({ ...VALID_ROW, 经度: 'abc' }, 0)).toEqual(['经度必须是数字'])
    expect(validateRow({ ...VALID_ROW, 经度: '200' }, 0)).toEqual(['经度必须在-180到180之间'])
  })

  it('纬度必须是数字且在范围内', () => {
    expect(validateRow({ ...VALID_ROW, 纬度: 'x' }, 0)).toEqual(['纬度必须是数字'])
    expect(validateRow({ ...VALID_ROW, 纬度: '91' }, 0)).toEqual(['纬度必须在-90到90之间'])
  })

  it('方位角必须是数字且在 0~360', () => {
    expect(validateRow({ ...VALID_ROW, 方位角: 'abc' }, 0)).toEqual(['方位角必须是数字'])
    expect(validateRow({ ...VALID_ROW, 方位角: '-1' }, 0)).toEqual(['方位角必须在0到360之间'])
    expect(validateRow({ ...VALID_ROW, 方位角: '361' }, 0)).toEqual(['方位角必须在0到360之间'])
  })

  it('半功率角必须大于 0 且小于 180', () => {
    expect(validateRow({ ...VALID_ROW, 半功率角: 'abc' }, 0)).toEqual(['半功率角必须是数字'])
    expect(validateRow({ ...VALID_ROW, 半功率角: '0' }, 0)).toEqual(['半功率角必须大于0且小于180'])
    expect(validateRow({ ...VALID_ROW, 半功率角: '180' }, 0)).toEqual([
      '半功率角必须大于0且小于180',
    ])
  })

  it('半径必须大于 0', () => {
    expect(validateRow({ ...VALID_ROW, 半径: 'abc' }, 0)).toEqual(['半径必须是数字'])
    expect(validateRow({ ...VALID_ROW, 半径: '0' }, 0)).toEqual(['半径必须大于0'])
    expect(validateRow({ ...VALID_ROW, 半径: '-5' }, 0)).toEqual(['半径必须大于0'])
  })
})

describe('validateRow - 可选字段', () => {
  it('是否室分只能是"是"或"否"', () => {
    expect(validateRow({ ...VALID_ROW, 是否室分: '是' }, 0)).toEqual([])
    expect(validateRow({ ...VALID_ROW, 是否室分: '否' }, 0)).toEqual([])
    expect(validateRow({ ...VALID_ROW, 是否室分: '室内' }, 0)).toEqual(['是否室分只能是"是"或"否"'])
  })

  it('天线挂高必须是数字', () => {
    expect(validateRow({ ...VALID_ROW, 天线挂高: '30' }, 0)).toEqual([])
    expect(validateRow({ ...VALID_ROW, 天线挂高: 'abc' }, 0)).toEqual(['天线挂高必须是数字'])
  })

  it('半透明度必须是 0~1 的数字', () => {
    expect(validateRow({ ...VALID_ROW, 半透明度: '0.5' }, 0)).toEqual([])
    expect(validateRow({ ...VALID_ROW, 半透明度: 'abc' }, 0)).toEqual(['半透明度必须是数字'])
    expect(validateRow({ ...VALID_ROW, 半透明度: '1.5' }, 0)).toEqual(['半透明度必须在0到1之间'])
  })

  it('颜色支持 hex 与内置名称', () => {
    expect(validateRow({ ...VALID_ROW, 颜色: '#FF0000' }, 0)).toEqual([])
    expect(validateRow({ ...VALID_ROW, 颜色: '#f00' }, 0)).toEqual([])
    expect(validateRow({ ...VALID_ROW, 颜色: '红色' }, 0)).toEqual([])
    expect(validateRow({ ...VALID_ROW, 颜色: 'blue' }, 0)).toEqual([])
    expect(validateRow({ ...VALID_ROW, 颜色: '#12345' }, 0)).toEqual([
      '颜色格式不正确，请使用十六进制格式（如#FF0000）或中文颜色名',
    ])
  })
})

describe('validateRow · 严格解析（审计 P1-9 / B5）', () => {
  it('经度/纬度宽松前缀被拒绝', () => {
    expect(validateRow({ ...VALID_ROW, 经度: '116.4abc' }, 0)).toContain('经度必须是数字')
    expect(validateRow({ ...VALID_ROW, 纬度: '39.9度' }, 0)).toContain('纬度必须是数字')
  })

  it('方位角/半径等数字字段的宽松前缀也被拒绝', () => {
    expect(validateRow({ ...VALID_ROW, 方位角: '90度' }, 0)).toContain('方位角必须是数字')
    expect(validateRow({ ...VALID_ROW, 半径: '500m' }, 0)).toContain('半径必须是数字')
  })

  it('科学计数法与首尾空格通过', () => {
    expect(validateRow({ ...VALID_ROW, 经度: ' 116.4 ', 半径: '5e2' }, 0)).toEqual([])
  })
})
