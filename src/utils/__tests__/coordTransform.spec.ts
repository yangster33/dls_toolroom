import { describe, it, expect } from 'vitest'
import {
  computeCentralMeridian,
  buildCGCS2000ProjString,
  DEFAULT_CGCS2000_PARAMS,
} from '../coordTransform'

describe('computeCentralMeridian', () => {
  it('3 度带：取最近的 3 的倍数', () => {
    expect(computeCentralMeridian(105, 3)).toBe(105)
    expect(computeCentralMeridian(106, 3)).toBe(105)
    expect(computeCentralMeridian(107, 3)).toBe(108)
    expect(computeCentralMeridian(108, 3)).toBe(108)
  })

  it('6 度带：中央经线为 6n+3', () => {
    expect(computeCentralMeridian(105, 6)).toBe(105)
    expect(computeCentralMeridian(111, 6)).toBe(111)
    expect(computeCentralMeridian(113.9, 6)).toBe(111)
    expect(computeCentralMeridian(119, 6)).toBe(117)
    expect(computeCentralMeridian(120, 6)).toBe(123)
  })

  it('支持负经度（西半球）', () => {
    expect(computeCentralMeridian(-105, 3)).toBe(-105)
    expect(computeCentralMeridian(-106, 3)).toBe(-105)
  })
})

describe('buildCGCS2000ProjString', () => {
  it('按参数生成 proj4 字符串', () => {
    const proj = buildCGCS2000ProjString(DEFAULT_CGCS2000_PARAMS)
    expect(proj).toContain('+proj=tmerc')
    expect(proj).toContain('+lon_0=108')
    expect(proj).toContain('+lat_0=0')
    expect(proj).toContain('+k=1')
    expect(proj).toContain('+x_0=500000')
    expect(proj).toContain('+y_0=0')
    expect(proj).toContain('+ellps=GRS80')
    expect(proj).toContain('+units=m')
  })

  it('中央经线按 3 度带重新计算', () => {
    const proj = buildCGCS2000ProjString({ ...DEFAULT_CGCS2000_PARAMS, centralMeridian: 106 })
    expect(proj).toContain('+lon_0=105')
  })

  it('6 度带投影字符串', () => {
    const proj = buildCGCS2000ProjString({
      ...DEFAULT_CGCS2000_PARAMS,
      zoneWidth: 6,
      centralMeridian: 111,
    })
    expect(proj).toContain('+lon_0=111')
  })
})

describe('DEFAULT_CGCS2000_PARAMS', () => {
  it('默认参数为 3 度带 108 度', () => {
    expect(DEFAULT_CGCS2000_PARAMS.centralMeridian).toBe(108)
    expect(DEFAULT_CGCS2000_PARAMS.zoneWidth).toBe(3)
    expect(DEFAULT_CGCS2000_PARAMS.falseEasting).toBe(500000)
    expect(DEFAULT_CGCS2000_PARAMS.falseNorthing).toBe(0)
  })
})
