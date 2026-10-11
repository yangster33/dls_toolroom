import { describe, it, expect } from 'vitest'
import {
  validateCoordinate,
  validateRow,
  readAndValidateTemplate,
  COORDINATE_POINT_FIELDS,
  ADDRESS_FIELDS,
  transformToCoordinatePoint,
  transformToFullAddress,
  type FieldMapping,
} from '../templateHandler'

const toCoordinatePoint = (d: Record<string, unknown>) => ({ ...transformToCoordinatePoint(d) })

describe('validateCoordinate', () => {
  it('接受数字与数字字符串', () => {
    expect(validateCoordinate(116.4, 'longitude', 0).valid).toBe(true)
    expect(validateCoordinate('116.4', 'longitude', 0).valid).toBe(true)
    expect(validateCoordinate('39.9', 'latitude', 0).valid).toBe(true)
  })

  it('返回转换后的数值', () => {
    expect(validateCoordinate('116.4', 'longitude', 0).value).toBe(116.4)
  })

  it('拒绝非数字', () => {
    const result = validateCoordinate('abc', 'longitude', 2)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('第 3 行')
    expect(result.error).toContain('经度')
  })

  it('拒绝越界经度', () => {
    const result = validateCoordinate(181, 'longitude', 0)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('-180 到 180')
  })

  it('拒绝越界纬度', () => {
    expect(validateCoordinate(90.1, 'latitude', 0).valid).toBe(false)
    expect(validateCoordinate(-90.1, 'latitude', 0).valid).toBe(false)
  })
})

describe('validateRow', () => {
  const mappings: Record<string, FieldMapping> = {
    名称: { aliases: ['名称', 'name'], required: true },
    经度: {
      aliases: ['经度', 'lon'],
      required: true,
      validator: (v, i) => validateCoordinate(v, 'longitude', i).error || null,
    },
  }

  it('合法行转换并保留别名取值', () => {
    const result = validateRow({ name: '甲', lon: '116.4' }, 0, mappings)
    expect(result.valid).toBe(true)
    expect(result.data).toEqual({ 名称: '甲', 经度: 116.4 })
  })

  it('缺失必填字段报错', () => {
    const result = validateRow({ lon: '116.4' }, 1, mappings)
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(['第 2 行：名称不能为空'])
  })

  it('自定义验证器失败时报错', () => {
    const result = validateRow({ 名称: '甲', lon: '999' }, 0, mappings)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('-180 到 180')
  })

  it('空值跳过可选字段验证器', () => {
    const result = validateRow({ 名称: '甲', lon: '116.4', extra: '' }, 0, {
      ...mappings,
      extra: { aliases: ['extra'], validator: () => '不应触发' },
    })
    expect(result.valid).toBe(true)
  })
})

describe('readAndValidateTemplate', () => {
  it('全部合法时返回数据', () => {
    const result = readAndValidateTemplate(
      [{ 名称: '甲', 经度: '116.4', 纬度: '39.9' }],
      COORDINATE_POINT_FIELDS,
      toCoordinatePoint,
    )
    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.data).toEqual([{ name: '甲', longitude: 116.4, latitude: 39.9 }])
  })

  it('存在非法行时整体无效并收集错误', () => {
    const result = readAndValidateTemplate(
      [
        { 名称: '甲', 经度: '116.4', 纬度: '39.9' },
        { 名称: '乙', 经度: 'abc', 纬度: '39.9' },
      ],
      COORDINATE_POINT_FIELDS,
      toCoordinatePoint,
    )
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('第 2 行')
    expect(result.data).toEqual([{ name: '甲', longitude: 116.4, latitude: 39.9 }])
  })

  it('转换器抛错时记录错误', () => {
    const result = readAndValidateTemplate(
      [{ 名称: '甲', 经度: '116.4', 纬度: '39.9' }],
      COORDINATE_POINT_FIELDS,
      () => {
        throw new Error('转换失败')
      },
    )
    expect(result.isValid).toBe(false)
    expect(result.errors[0]).toContain('数据转换失败 - 转换失败')
  })

  it('空数据不视为有效', () => {
    const result = readAndValidateTemplate([], COORDINATE_POINT_FIELDS, toCoordinatePoint)
    expect(result.isValid).toBe(false)
    expect(result.data).toEqual([])
  })
})

describe('字段映射预设', () => {
  it('COORDINATE_POINT_FIELDS 支持中英文表头', () => {
    const result = validateRow(
      { name: '甲', lon: '116.4', lat: '39.9' },
      0,
      COORDINATE_POINT_FIELDS,
    )
    expect(result.valid).toBe(true)
    expect(result.data).toEqual({ 名称: '甲', 经度: 116.4, 纬度: 39.9 })
  })

  it('transformToCoordinatePoint 输出结构化对象', () => {
    expect(transformToCoordinatePoint({ 名称: '甲', 经度: 116.4, 纬度: 39.9 })).toEqual({
      name: '甲',
      longitude: 116.4,
      latitude: 39.9,
    })
  })

  it('ADDRESS_FIELDS 支持别名，空字段保持空字符串', () => {
    // 回归用例（审计 P0-4）：空地址字段曾被转成数字 0，
    // 拼接后得到「广东省0市0区0镇」这类垃圾地址
    const result = validateRow({ name: '甲', province: '广东', 地址: 'xx路1号' }, 0, ADDRESS_FIELDS)
    expect(result.valid).toBe(true)
    expect(result.data).toEqual({
      名称: '甲',
      省: '广东',
      市: '',
      '区/县': '',
      '乡/镇': '',
      '社区/村': '',
      地址: 'xx路1号',
    })
  })

  it('显式的数字 0 地址字段仍被识别为 0（非空白）', () => {
    const result = validateRow({ name: '甲', 市: '0' }, 0, ADDRESS_FIELDS)
    expect(result.data).toMatchObject({ 市: 0 })
  })

  it('transformToFullAddress 输出全字段地址', () => {
    expect(transformToFullAddress({ 名称: '甲', 省: '广东', 市: '广州' })).toEqual({
      name: '甲',
      province: '广东',
      city: '广州',
      district: '',
      township: '',
      community: '',
      address: '',
    })
  })
})

describe('validateCoordinate · 严格解析（审计 P1-9 / B5）', () => {
  it('拒绝宽松前缀（区别于 parseFloat）', () => {
    expect(validateCoordinate('116.4abc', 'longitude', 0).valid).toBe(false)
    expect(validateCoordinate('N39.9', 'latitude', 0).valid).toBe(false)
    expect(validateCoordinate('39.9度', 'latitude', 0).valid).toBe(false)
  })

  it('接受合法写法（含科学计数法、首尾空格）', () => {
    expect(validateCoordinate('116.4', 'longitude', 0).valid).toBe(true)
    expect(validateCoordinate('-39.9', 'latitude', 0).valid).toBe(true)
    expect(validateCoordinate('1.16e2', 'longitude', 0).valid).toBe(true)
    expect(validateCoordinate(' 116.4 ', 'longitude', 0).valid).toBe(true)
  })

  it('拒绝 Infinity 与十六进制', () => {
    expect(validateCoordinate('Infinity', 'longitude', 0).valid).toBe(false)
    expect(validateCoordinate('0x1A', 'longitude', 0).valid).toBe(false)
  })
})
