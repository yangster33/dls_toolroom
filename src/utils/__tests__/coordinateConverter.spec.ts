import { describe, it, expect } from 'vitest'
import {
  toWGS84,
  fromWGS84,
  convert,
  validateCoordinate,
  COORDINATE_SYSTEMS,
} from '../coordinateConverter'
import { DEFAULT_CGCS2000_PARAMS } from '../coordTransform'

const P = DEFAULT_CGCS2000_PARAMS

describe('validateCoordinate', () => {
  it('接受合法经纬度', () => {
    expect(validateCoordinate('wgs84', 116.4, 39.9).isValid).toBe(true)
    expect(validateCoordinate('gcj02', -180, -90).isValid).toBe(true)
  })

  it('拒绝非数字', () => {
    expect(validateCoordinate('wgs84', NaN, 39.9).isValid).toBe(false)
    expect(validateCoordinate('wgs84', 116.4, NaN).isValid).toBe(false)
  })

  it('拒绝越界经纬度', () => {
    expect(validateCoordinate('wgs84', 181, 39.9).isValid).toBe(false)
    expect(validateCoordinate('wgs84', 116.4, 91).isValid).toBe(false)
    expect(validateCoordinate('wgs84', 116.4, -90.1).isValid).toBe(false)
  })

  it('BD-09 限中国范围', () => {
    expect(validateCoordinate('bd09', 116.4, 39.9).isValid).toBe(true)
    expect(validateCoordinate('bd09', 0, 0).isValid).toBe(false)
    expect(validateCoordinate('bd09', 136, 39.9).isValid).toBe(false)
  })

  it('平面坐标过大时拒绝', () => {
    expect(validateCoordinate('cgcs2000_xy', 500000, 0).isValid).toBe(true)
    expect(validateCoordinate('cgcs2000_xy', 10000001, 0).isValid).toBe(false)
  })
})

describe('wgs84 系统', () => {
  it('toWGS84/fromWGS84 恒等', () => {
    expect(toWGS84('wgs84', 116.4, 39.9, P)).toEqual([116.4, 39.9])
    expect(fromWGS84('wgs84', 116.4, 39.9, P)).toEqual([116.4, 39.9])
  })
})

describe('gcj02 / bd09 转换', () => {
  const LON = 116.404
  const LAT = 39.915

  it('WGS84→GCJ02 产生偏移', () => {
    const [lng, lat] = fromWGS84('gcj02', LON, LAT, P)!
    expect(Math.abs(lng - LON)).toBeGreaterThan(0.0005)
    expect(Math.abs(lat - LAT)).toBeGreaterThan(0.0005)
  })

  it('WGS84→GCJ02→WGS84 往返误差极小', () => {
    const [lng, lat] = fromWGS84('gcj02', LON, LAT, P)!
    const [backLng, backLat] = toWGS84('gcj02', lng, lat, P)!
    expect(backLng).toBeCloseTo(LON, 6)
    expect(backLat).toBeCloseTo(LAT, 6)
  })

  it('GCJ02→BD09→GCJ02 往返误差极小', () => {
    const [bdLng, bdLat] = convert('gcj02', 'bd09', LON, LAT, P)!
    const [backLng, backLat] = convert('bd09', 'gcj02', bdLng, bdLat, P)!
    expect(backLng).toBeCloseTo(LON, 5)
    expect(backLat).toBeCloseTo(LAT, 5)
  })

  it('高德坐标系与 GCJ02 结果一致', () => {
    const [amapLng, amapLat] = fromWGS84('amap', LON, LAT, P)!
    const [gcjLng, gcjLat] = fromWGS84('gcj02', LON, LAT, P)!
    expect(amapLng).toBeCloseTo(gcjLng, 10)
    expect(amapLat).toBeCloseTo(gcjLat, 10)
  })

  it('相同系统转换返回原值', () => {
    expect(convert('gcj02', 'gcj02', LON, LAT, P)).toEqual([LON, LAT])
  })
})

describe('cgcs2000 转换', () => {
  it('CGCS2000 经纬度与 WGS84 近似相等（零 towgs84 偏移）', () => {
    const [lng, lat] = fromWGS84('cgcs2000_lnglat', 116.404, 39.915, P)!
    expect(lng).toBeCloseTo(116.404, 6)
    expect(lat).toBeCloseTo(39.915, 6)
  })

  it('中央经线 108 上的 WGS84 点投影到平面 x≈500000', () => {
    const [x, y] = fromWGS84('cgcs2000_xy', 108, 0, P)!
    expect(Math.abs(x - 500000)).toBeLessThan(1)
    expect(Math.abs(y)).toBeLessThan(1)
  })

  it('CGCS2000 平面坐标往返转换', () => {
    const [x, y] = fromWGS84('cgcs2000_xy', 108, 0, P)!
    const [lng, lat] = toWGS84('cgcs2000_xy', x, y, P)!
    expect(lng).toBeCloseTo(108, 7)
    expect(lat).toBeCloseTo(0, 7)
  })

  it('非中央经线的平面坐标投影', () => {
    const [x, y] = fromWGS84('cgcs2000_xy', 110, 30, P)!
    expect(x).toBeGreaterThan(500000)
    expect(y).toBeGreaterThan(0)
    const [lng, lat] = toWGS84('cgcs2000_xy', x, y, P)!
    expect(lng).toBeCloseTo(110, 5)
    expect(lat).toBeCloseTo(30, 5)
  })
})

describe('COORDINATE_SYSTEMS 元数据', () => {
  it('六种坐标系齐备', () => {
    expect(Object.keys(COORDINATE_SYSTEMS)).toEqual([
      'wgs84',
      'gcj02',
      'bd09',
      'amap',
      'cgcs2000_lnglat',
      'cgcs2000_xy',
    ])
  })

  it('显示名称正确', () => {
    expect(COORDINATE_SYSTEMS.wgs84.displayName).toBe('WGS84')
    expect(COORDINATE_SYSTEMS.bd09.displayName).toBe('百度 BD-09')
    expect(COORDINATE_SYSTEMS.cgcs2000_xy.displayName).toBe('CGCS2000(平面坐标)')
  })
})