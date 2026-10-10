import { describe, it, expect } from 'vitest'
import { parseStrictNumber, parseCoordinateValue } from '../coordinateValue'

describe('parseStrictNumber', () => {
  it('解析普通数字与负数', () => {
    expect(parseStrictNumber('116.4')).toBe(116.4)
    expect(parseStrictNumber('-39.9')).toBe(-39.9)
    expect(parseStrictNumber(116.4)).toBe(116.4)
  })

  it('空字符串、纯空格返回 null（不是 0）', () => {
    expect(parseStrictNumber('')).toBeNull()
    expect(parseStrictNumber('   ')).toBeNull()
  })

  it('null / undefined 返回 null', () => {
    expect(parseStrictNumber(null)).toBeNull()
    expect(parseStrictNumber(undefined)).toBeNull()
  })

  it('宽松前缀 "116.4abc" 被拒绝（区别于 parseFloat）', () => {
    expect(parseStrictNumber('116.4abc')).toBeNull()
    expect(parseStrictNumber('N39.9')).toBeNull()
    expect(parseStrictNumber('39.9度')).toBeNull()
    // 证明这确实是宽松解析会放过的情况
    expect(parseFloat('116.4abc')).toBe(116.4)
  })

  it('Infinity / NaN 被拒绝', () => {
    expect(parseStrictNumber('Infinity')).toBeNull()
    expect(parseStrictNumber(NaN)).toBeNull()
  })

  it('十六进制 0x1A 被拒绝（Number() 会转成 26）', () => {
    expect(parseStrictNumber('0x1A')).toBeNull()
  })

  it('科学计数法被接受', () => {
    expect(parseStrictNumber('1.164e2')).toBe(116.4)
  })
})

describe('parseCoordinateValue', () => {
  it('经度范围内通过', () => {
    expect(parseCoordinateValue('116.4', -180, 180)).toBe(116.4)
  })

  it('0 是合法坐标（赤道/本初子午线）', () => {
    expect(parseCoordinateValue('0', -180, 180)).toBe(0)
    expect(parseCoordinateValue(0, -90, 90)).toBe(0)
  })

  it('空值返回 null，不落到 0', () => {
    expect(parseCoordinateValue('', -180, 180)).toBeNull()
    expect(parseCoordinateValue(undefined, -180, 180)).toBeNull()
    expect(parseCoordinateValue(null, -180, 180)).toBeNull()
  })

  it('越界返回 null', () => {
    expect(parseCoordinateValue('181', -180, 180)).toBeNull()
    expect(parseCoordinateValue('91', -90, 90)).toBeNull()
    expect(parseCoordinateValue('-181', -180, 180)).toBeNull()
  })

  it('边界值通过', () => {
    expect(parseCoordinateValue('180', -180, 180)).toBe(180)
    expect(parseCoordinateValue('90', -90, 90)).toBe(90)
  })
})
