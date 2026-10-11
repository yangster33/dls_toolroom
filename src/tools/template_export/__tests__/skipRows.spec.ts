import { describe, it, expect } from 'vitest'
import { normalizeSkipRows } from '../useTemplateExport'

/**
 * 审计报告 P1-5 的回归测试
 *
 * 历史 Bug：`actualDataList` 用 `slice(skipRows - 1)`，而 UI 文案写
 * 「忽略前 N 行（默认1行）」——两者语义错开一位：
 * skipRows=1 时 slice(0) 等于一行不忽略，用户按提示填 1 想忽略首条
 * 垃圾数据，结果什么都没跳；填 2 才真正忽略 1 行。
 *
 * 同时旧钳制 `Math.max(1, value)` 让下限为 1，用户根本无法表达「不忽略」。
 *
 * 现在统一为「忽略 N 行」并允许 0。这里验证归一化逻辑；
 * `actualDataList` 的切片语义由 e2e 覆盖（依赖 composable 内部状态）。
 *
 * 注：这个函数是从 composable 闭包里抽出来的——原本无法单测。
 */

describe('normalizeSkipRows（P1-5）', () => {
  it('0 是合法值（不忽略），不再被钳到 1', () => {
    // 旧实现 Math.max(1, 0) => 1，把「不忽略」偷偷变成「忽略 1 行」
    expect(normalizeSkipRows(0)).toBe(0)
  })

  it('负数被钳到 0', () => {
    expect(normalizeSkipRows(-5)).toBe(0)
    expect(normalizeSkipRows(-0.5)).toBe(0)
  })

  it('小数向下取整', () => {
    expect(normalizeSkipRows(2.9)).toBe(2)
  })

  it('正常正整数原样返回', () => {
    expect(normalizeSkipRows(1)).toBe(1)
    expect(normalizeSkipRows(3)).toBe(3)
  })

  it('空串归 0（v-model.number 清空输入框时产出空串）', () => {
    const empty = '' as unknown as number
    expect(normalizeSkipRows(empty)).toBe(0)
  })

  it('NaN / Infinity 归 0（不再向下游传播）', () => {
    expect(normalizeSkipRows(Number.NaN)).toBe(0)
    expect(normalizeSkipRows(Number.POSITIVE_INFINITY)).toBe(0)
    expect(normalizeSkipRows(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})
