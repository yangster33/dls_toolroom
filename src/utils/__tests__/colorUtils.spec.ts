import { describe, it, expect } from 'vitest'
import { parseOklch, oklchToHex } from '../colorUtils'

describe('parseOklch', () => {
  it('解析 0~1 数值格式', () => {
    expect(parseOklch('oklch(0.5 0.1 30)')).toEqual({ L: 0.5, C: 0.1, H: 30 })
  })

  it('解析百分比格式（L 除以 100）', () => {
    expect(parseOklch('oklch(50% 0.1 30)')).toEqual({ L: 0.5, C: 0.1, H: 30 })
    expect(parseOklch('oklch(100% 0 0)')).toEqual({ L: 1, C: 0, H: 0 })
  })

  it('大于 1 的 L 视为百分比', () => {
    expect(parseOklch('oklch(1.5 0 0)')).toEqual({ L: 0.015, C: 0, H: 0 })
  })

  it('非法输入返回 null', () => {
    expect(parseOklch('red')).toBeNull()
    expect(parseOklch('')).toBeNull()
    expect(parseOklch('oklch(0.5 0.1)')).toBeNull()
    expect(parseOklch('oklch(a b c)')).toBeNull()
  })
})

describe('oklchToHex', () => {
  it('oklch 白色转为 #ffffff', () => {
    expect(oklchToHex('oklch(1 0 0)')).toBe('#ffffff')
  })

  it('oklch 黑色转为 #000000', () => {
    expect(oklchToHex('oklch(0 0 0)')).toBe('#000000')
  })

  it('中灰 L=0.5 输出 #636363', () => {
    expect(oklchToHex('oklch(0.5 0 0)')).toBe('#636363')
  })

  it('输出为标准 6 位小写 hex', () => {
    const hex = oklchToHex('oklch(0.6 0.15 200)')
    expect(hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('非法颜色原样返回', () => {
    expect(oklchToHex('not-a-color')).toBe('not-a-color')
  })

  it('百分比与数值格式输出一致', () => {
    expect(oklchToHex('oklch(50% 0 0)')).toBe(oklchToHex('oklch(0.5 0 0)'))
  })
})
