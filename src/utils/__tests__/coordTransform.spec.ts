import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CGCS2000_PARAMS,
  validateCGCS2000Params,
  buildCGCS2000ProjString,
  computeCentralMeridian,
} from '../coordTransform'
import { convertAll } from '@/tools/coord_convert/coordConversion'

/**
 * 审计报告 P0-5 的回归测试
 *
 * 触发场景：`v-model.number` 在输入框被清空时产出 `''`，
 * 沿链路变成 NaN，最终 proj4 返回 [NaN, NaN]。
 * 而调用方只校验 `converted.length !== 2`，NaN 长度也是 2 → 顺利通过，
 * 被写进导出的 Excel；单点转换则显示成 0,0（本初子午线/赤道），
 * 看起来完全像一个合法坐标。
 */

/** 构造带无效 centralMeridian 的参数 */
const badParams = (overrides: Partial<typeof DEFAULT_CGCS2000_PARAMS> = {}) => ({
  ...DEFAULT_CGCS2000_PARAMS,
  ...overrides,
})

describe('validateCGCS2000Params', () => {
  it('默认参数通过', () => {
    expect(validateCGCS2000Params(DEFAULT_CGCS2000_PARAMS)).toBeNull()
  })

  it('centralMeridian 为空字符串 → 报错', () => {
    const err = validateCGCS2000Params(badParams({ centralMeridian: '' as unknown as number }))
    expect(err).toContain('中央子午线经度')
  })

  it('centralMeridian 为 NaN → 报错', () => {
    expect(validateCGCS2000Params(badParams({ centralMeridian: Number.NaN }))).toContain(
      '中央子午线经度',
    )
  })

  it('centralMeridian 超出 [-180, 180] → 报错', () => {
    expect(validateCGCS2000Params(badParams({ centralMeridian: 200 }))).toContain('-180')
    expect(validateCGCS2000Params(badParams({ centralMeridian: -200 }))).toContain('-180')
  })

  it('scaleFactor 为 0 → 报错（+k=0 无意义）', () => {
    expect(validateCGCS2000Params(badParams({ scaleFactor: 0 }))).toContain('比例因子')
  })

  it('scaleFactor 为 NaN → 报错', () => {
    expect(validateCGCS2000Params(badParams({ scaleFactor: Number.NaN }))).toContain('比例因子')
  })

  it('zoneWidth 不是 3 或 6 → 报错', () => {
    expect(validateCGCS2000Params(badParams({ zoneWidth: 4 as unknown as 3 }))).toContain(
      '分带度数',
    )
  })

  it('falseEasting / falseNorthing 非数字 → 报错', () => {
    expect(validateCGCS2000Params(badParams({ falseEasting: Number.NaN }))).toContain('常量')
    expect(validateCGCS2000Params(badParams({ falseNorthing: Number.NaN }))).toContain('常量')
  })

  it('originLatitude 超出 [-90, 90] → 报错', () => {
    expect(validateCGCS2000Params(badParams({ originLatitude: 100 }))).toContain('基准纬度')
  })
})

describe('buildCGCS2000ProjString', () => {
  it('合法参数产出正确的 proj4 字符串', () => {
    const s = buildCGCS2000ProjString(DEFAULT_CGCS2000_PARAMS)
    expect(s).toContain('+proj=tmerc')
    expect(s).toContain('+lon_0=108')
    expect(s).toContain('+k=1')
    expect(s).not.toContain('NaN')
  })

  it('含 NaN 的参数抛错，不静默产出含 NaN 的字符串', () => {
    expect(() => buildCGCS2000ProjString(badParams({ centralMeridian: Number.NaN }))).toThrow(
      'CGCS2000 投影参数无效',
    )
  })

  it('scaleFactor = 0 抛错', () => {
    expect(() => buildCGCS2000ProjString(badParams({ scaleFactor: 0 }))).toThrow('比例因子')
  })
})

describe('computeCentralMeridian', () => {
  it('3 度带：就近取整到 3 的倍数', () => {
    expect(computeCentralMeridian(108, 3)).toBe(108)
    expect(computeCentralMeridian(109, 3)).toBe(108)
    expect(computeCentralMeridian(110, 3)).toBe(111)
  })

  it('6 度带：中央经线为 6 的倍数 +3', () => {
    // 公式是 Math.round((lon - 3) / 6) * 6 + 3
    expect(computeCentralMeridian(108, 6)).toBe(111)
    expect(computeCentralMeridian(116, 6)).toBe(117)
    expect(computeCentralMeridian(105, 6)).toBe(105)
    expect(computeCentralMeridian(120, 6)).toBe(123)
  })
})

describe('convertAll - 无效投影参数（P0-5a）', () => {
  it('centralMeridian 为 NaN → 返回 null，不产出含 0,0 的假结果', () => {
    const result = convertAll('cgcs2000_xy', '500000', '4000000', {
      ...DEFAULT_CGCS2000_PARAMS,
      centralMeridian: Number.NaN,
    })
    expect(result).toBeNull()
  })

  it('scaleFactor 为 0 → 返回 null', () => {
    const result = convertAll('cgcs2000_xy', '500000', '4000000', badParams({ scaleFactor: 0 }))
    expect(result).toBeNull()
  })

  it('合法参数正常转换，wgs84 结果合理', () => {
    const result = convertAll('wgs84', '116.4', '39.9', DEFAULT_CGCS2000_PARAMS)
    expect(result).not.toBeNull()
    expect(result!.wgs84.lng).toBeCloseTo(116.4, 6)
    expect(result!.wgs84.lat).toBeCloseTo(39.9, 6)
  })

  it('合法参数的 GCJ-02/BD-09 结果都是有限数（不再残留 0 占位）', () => {
    const result = convertAll('wgs84', '116.4', '39.9', DEFAULT_CGCS2000_PARAMS)
    expect(Number.isFinite(result!.gcj02.lng)).toBe(true)
    expect(Number.isFinite(result!.gcj02.lat)).toBe(true)
    expect(Number.isFinite(result!.bd09.lng)).toBe(true)
    expect(Number.isFinite(result!.amap.lng)).toBe(true)
  })

  it('非法坐标输入 → null', () => {
    expect(convertAll('wgs84', 'abc', '39.9', DEFAULT_CGCS2000_PARAMS)).toBeNull()
    expect(convertAll('wgs84', '999', '39.9', DEFAULT_CGCS2000_PARAMS)).toBeNull()
  })
})

describe('convertAll - 成功转换的目标不保留 0 占位（P0-5b）', () => {
  it('wgs84 → cgcs2000_xy 的 x/y 是有限数', () => {
    const result = convertAll('wgs84', '116.4', '39.9', DEFAULT_CGCS2000_PARAMS)
    expect(Number.isFinite(result!.cgcs2000_xy.x)).toBe(true)
    expect(Number.isFinite(result!.cgcs2000_xy.y)).toBe(true)
    // 北京附近 3 度带，东偏 500km 量级
    expect(result!.cgcs2000_xy.x).toBeGreaterThan(100000)
  })

  it('输入即 cgcs2000_xy 时，自身结果原样保留', () => {
    const result = convertAll('cgcs2000_xy', '500000', '4000000', DEFAULT_CGCS2000_PARAMS)
    expect(result!.cgcs2000_xy.x).toBe(500000)
    expect(result!.cgcs2000_xy.y).toBe(4000000)
  })
})
