import { describe, it, expect } from 'vitest'
import { validateKmlRow } from '../TemplateValidator'

describe('validateKmlRow', () => {
  it('合法行返回空错误数组', () => {
    expect(validateKmlRow({ 名称: '站1', 经度: '116.4', 纬度: '39.9', 颜色: '红色' })).toEqual([])
  })

  it('中文颜色名与 hex 均通过', () => {
    expect(validateKmlRow({ 名称: '站1', 经度: 116.4, 纬度: 39.9, 颜色: '#FF0000' })).toEqual([])
  })

  it('名称为空报错', () => {
    const errors = validateKmlRow({ 名称: '  ', 经度: '116.4', 纬度: '39.9' })
    expect(errors).toEqual(['名称为空。'])
  })

  it('经度非数字报错', () => {
    const errors = validateKmlRow({ 名称: '站1', 经度: 'abc', 纬度: '39.9' })
    expect(errors).toEqual(['经度"abc"不是有效数字。'])
  })

  it('经度越界报错', () => {
    const errors = validateKmlRow({ 名称: '站1', 经度: '200', 纬度: '39.9' })
    expect(errors).toEqual(['经度 200 超出范围 (-180 ~ 180)。'])
  })

  it('纬度非数字报错', () => {
    expect(validateKmlRow({ 名称: '站1', 经度: '116.4', 纬度: 'x' })).toEqual([
      '纬度"x"不是有效数字。',
    ])
  })

  it('纬度越界报错', () => {
    expect(validateKmlRow({ 名称: '站1', 经度: '116.4', 纬度: '91' })).toEqual([
      '纬度 91 超出范围 (-90 ~ 90)。',
    ])
  })

  it('无法识别的颜色报错', () => {
    const errors = validateKmlRow({ 名称: '站1', 经度: '116.4', 纬度: '39.9', 颜色: 'notacolor' })
    expect(errors).toEqual(['颜色"notacolor"无法识别。支持中文颜色名或十六进制（如"#FF0000"）。'])
  })

  it('紫色等扩展色名同样通过', () => {
    expect(validateKmlRow({ 名称: '站1', 经度: '116.4', 纬度: '39.9', 颜色: '紫色' })).toEqual([])
  })

  it('颜色为空不报错', () => {
    expect(validateKmlRow({ 名称: '站1', 经度: '116.4', 纬度: '39.9', 颜色: '' })).toEqual([])
  })

  it('多个错误同时收集', () => {
    const errors = validateKmlRow({ 名称: '', 经度: 'abc', 纬度: '91', 颜色: 'notacolor' })
    expect(errors).toHaveLength(4)
  })
})