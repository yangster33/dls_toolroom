import { describe, it, expect } from 'vitest'
import { parseColor, hexToKmlColor, isValidColor } from '../ColorParser'

describe('parseColor', () => {
  it('中文颜色名映射到 hex', () => {
    expect(parseColor('红')).toBe('#FF0000')
    expect(parseColor('红色')).toBe('#FF0000')
    expect(parseColor('深红')).toBe('#8B0000')
    expect(parseColor('天蓝')).toBe('#87CEEB')
    expect(parseColor('金色')).toBe('#FFD700')
  })

  it('hex 输入保持大写', () => {
    expect(parseColor('#ff0000')).toBe('#FF0000')
    expect(parseColor('#00ff00')).toBe('#00FF00')
  })

  it('3 位 hex 扩展为 6 位', () => {
    expect(parseColor('#f00')).toBe('#FF0000')
    expect(parseColor('#0f0')).toBe('#00FF00')
    expect(parseColor('#abcdef')).toBe('#ABCDEF')
  })

  it('忽略首尾空白', () => {
    expect(parseColor(' 红 ')).toBe('#FF0000')
  })

  it('非法输入返回 null', () => {
    expect(parseColor(null)).toBeNull()
    expect(parseColor(undefined)).toBeNull()
    expect(parseColor('')).toBeNull()
    expect(parseColor('  ')).toBeNull()
    expect(parseColor('blue')).toBeNull()
    expect(parseColor('#12345')).toBeNull()
    expect(parseColor('#gggggg')).toBeNull()
  })
})

describe('hexToKmlColor', () => {
  it('不透明红色 → AABBGGRR', () => {
    expect(hexToKmlColor('#FF0000')).toBe('ff0000FF')
  })

  it('绿色 → AABBGGRR 顺序正确', () => {
    expect(hexToKmlColor('#00FF00')).toBe('ff00FF00')
  })

  it('透明度 alpha=0.5 四舍五入到 0x80', () => {
    expect(hexToKmlColor('#FF0000', 0.5)).toBe('800000FF')
  })

  it('alpha=0 完全透明', () => {
    expect(hexToKmlColor('#FF0000', 0)).toBe('000000FF')
  })

  it('alpha=1 不透明', () => {
    expect(hexToKmlColor('#FF0000', 1)).toBe('ff0000FF')
  })

  it('去掉 # 前缀', () => {
    expect(hexToKmlColor('FF0000')).toBe('ff0000FF')
  })
})

describe('isValidColor', () => {
  it('中文名与 hex 均合法', () => {
    expect(isValidColor('红')).toBe(true)
    expect(isValidColor('#00ff00')).toBe(true)
  })

  it('非法输入不合法', () => {
    expect(isValidColor('blue')).toBe(false)
    expect(isValidColor('')).toBe(false)
    expect(isValidColor(null)).toBe(false)
  })
})
