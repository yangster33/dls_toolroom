import { describe, it, expect } from 'vitest'
import { validateCoordinate, convertAll, DEFAULT_CGCS2000_PARAMS } from '../coordConversion'

describe('validateCoordinate', () => {
  it('解析合法坐标字符串', () => {
    expect(validateCoordinate('wgs84', '116.4', '39.9')).toEqual({
      isValid: true,
      x: 116.4,
      y: 39.9,
    })
  })

  it('拒绝非数字字符串', () => {
    const result = validateCoordinate('wgs84', 'abc', '39.9')
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('坐标必须为有效数字')
    expect(result.x).toBeNull()
    expect(result.y).toBeNull()
  })

  it('拒绝越界坐标', () => {
    expect(validateCoordinate('wgs84', '181', '39.9').isValid).toBe(false)
    expect(validateCoordinate('wgs84', '116.4', '91').isValid).toBe(false)
  })

  it('BD-09 限中国范围', () => {
    expect(validateCoordinate('bd09', '116.4', '39.9').isValid).toBe(true)
    expect(validateCoordinate('bd09', '0', '0').isValid).toBe(false)
  })

  it('平面坐标限制大小', () => {
    expect(validateCoordinate('cgcs2000_xy', '500000', '0').isValid).toBe(true)
    expect(validateCoordinate('cgcs2000_xy', '10000001', '0').isValid).toBe(false)
  })
})

describe('convertAll', () => {
  it('非法输入返回 null', () => {
    expect(convertAll('wgs84', 'abc', '39.9', DEFAULT_CGCS2000_PARAMS)).toBeNull()
    expect(convertAll('wgs84', '181', '39.9', DEFAULT_CGCS2000_PARAMS)).toBeNull()
  })

  it('从 WGS84 转换输出全部六种系统', () => {
    const result = convertAll('wgs84', '116.4', '39.9', DEFAULT_CGCS2000_PARAMS)!
    expect(result.wgs84).toEqual({ lng: 116.4, lat: 39.9 })
    expect(result.gcj02.lng).not.toBeCloseTo(116.4, 3)
    expect(result.bd09.lng).not.toBeCloseTo(116.4, 3)
    expect(result.amap.lng).toBeCloseTo(result.gcj02.lng, 9)
    expect(result.cgcs2000_lnglat.lng).toBeCloseTo(116.4, 4)
    expect(result.cgcs2000_xy.x).toBeGreaterThan(500000)
  })

  it('从 GCJ02 转换后原系统回填', () => {
    const result = convertAll('gcj02', '116.4', '39.9', DEFAULT_CGCS2000_PARAMS)!
    expect(result.gcj02).toEqual({ lng: 116.4, lat: 39.9 })
  })

  it('从平面坐标转换后平面坐标回填', () => {
    const result = convertAll('cgcs2000_xy', '500000', '0', DEFAULT_CGCS2000_PARAMS)!
    expect(result.cgcs2000_xy).toEqual({ x: 500000, y: 0 })
    expect(result.wgs84.lng).toBeCloseTo(108, 5)
    expect(result.wgs84.lat).toBeCloseTo(0, 5)
  })

  it('CGCS2000 平面往返一致', () => {
    const result = convertAll('cgcs2000_xy', '510000', '3325000', DEFAULT_CGCS2000_PARAMS)!
    const [x, y] = [result.cgcs2000_xy.x, result.cgcs2000_xy.y]
    const roundTrip = convertAll('cgcs2000_xy', String(x), String(y), DEFAULT_CGCS2000_PARAMS)!
    expect(roundTrip.wgs84.lng).toBeCloseTo(result.wgs84.lng, 5)
    expect(roundTrip.wgs84.lat).toBeCloseTo(result.wgs84.lat, 5)
  })

  it('自定义 CGCS2000 参数生效', () => {
    const params = { ...DEFAULT_CGCS2000_PARAMS, centralMeridian: 111, zoneWidth: 6 as const }
    const result = convertAll('wgs84', '111', '0', params)!
    expect(Math.abs(result.cgcs2000_xy.x - 500000)).toBeLessThan(1)
    expect(Math.abs(result.cgcs2000_xy.y)).toBeLessThan(1)
  })
})