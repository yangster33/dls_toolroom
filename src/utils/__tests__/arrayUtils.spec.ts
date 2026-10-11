import { describe, it, expect } from 'vitest'
import { pushAll, maxOf, minOf } from '../arrayUtils'

/**
 * 审计报告 P2-19 / B1 的回归测试。
 *
 * 原生 `push(...arr)` / `Math.max(...arr)` 会把数组当函数参数展开，
 * 元素过多时抛 RangeError。这些断言同时覆盖「语义等价」与「大数组不崩」。
 */

/** 构造一个超过常见引擎参数上限的数组 */
const BIG = 200_000
const bigArray = Array.from({ length: BIG }, (_, i) => i)

describe('pushAll', () => {
  it('追加全部元素并返回 target 本身', () => {
    const target = [0]
    const result = pushAll(target, [1, 2, 3])
    expect(result).toBe(target)
    expect(target).toEqual([0, 1, 2, 3])
  })

  it('空数组是 no-op', () => {
    const target = [1, 2]
    pushAll(target, [])
    expect(target).toEqual([1, 2])
  })

  it('接受任意可迭代对象（Set / 生成器）', () => {
    const target: number[] = []
    pushAll(target, new Set([1, 2, 2, 3]))
    expect(target).toEqual([1, 2, 3])
  })

  it('20 万元素不抛 RangeError，且追加数量正确', () => {
    const target: number[] = []
    expect(() => pushAll(target, bigArray)).not.toThrow()
    expect(target).toHaveLength(BIG)
    expect(target[0]).toBe(0)
    expect(target[BIG - 1]).toBe(BIG - 1)
  })

  it('反证：原生 push(...arr) 在大数组下会抛 RangeError', () => {
    const target: number[] = []
    // 若环境未触发上限（实现差异），跳过而不是误判；正常 V8 会抛。
    let threw = false
    try {
      target.push(...bigArray)
    } catch (e) {
      threw = e instanceof RangeError
    }
    expect(threw).toBe(true)
  })
})

describe('maxOf', () => {
  it('等价于 Math.max(...values)', () => {
    const vals = [3, 1, 4, 1, 5, 9, 2, 6]
    expect(maxOf(vals)).toBe(Math.max(...vals))
  })

  it('等价于 Math.max(...values, fallback)', () => {
    const small = [1, 2]
    const big = [100, 2]
    expect(maxOf(small, 8)).toBe(Math.max(...small, 8))
    expect(maxOf(big, 8)).toBe(Math.max(...big, 8))
  })

  it('空输入返回 fallback（默认 -Infinity，同 Math.max()）', () => {
    expect(maxOf([])).toBe(Math.max())
    expect(maxOf([], 8)).toBe(8)
  })

  it('保留 NaN 传播（不能用 > 比较替代）', () => {
    expect(Number.isNaN(maxOf([1, NaN, 3]))).toBe(true)
    expect(Number.isNaN(maxOf([NaN], 8))).toBe(true)
  })

  it('20 万元素不抛 RangeError，结果与预期一致', () => {
    expect(() => maxOf(bigArray)).not.toThrow()
    expect(maxOf(bigArray)).toBe(BIG - 1)
  })

  it('反证：原生 Math.max(...arr) 在大数组下会抛 RangeError', () => {
    let threw = false
    try {
      Math.max(...bigArray)
    } catch (e) {
      threw = e instanceof RangeError
    }
    expect(threw).toBe(true)
  })
})

describe('minOf', () => {
  it('等价于 Math.min(...values, fallback)', () => {
    expect(minOf([3, 1, 4], 0)).toBe(0)
    expect(minOf([3, 1, 4], -5)).toBe(-5)
    expect(minOf([])).toBe(Math.min())
  })

  it('保留 NaN 传播', () => {
    expect(Number.isNaN(minOf([1, NaN]))).toBe(true)
  })

  it('20 万元素不抛 RangeError', () => {
    expect(() => minOf(bigArray)).not.toThrow()
    expect(minOf(bigArray)).toBe(0)
  })
})
