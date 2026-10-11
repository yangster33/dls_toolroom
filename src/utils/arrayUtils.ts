/**
 * 大数组安全操作（审计 P2-19 / B1）。
 *
 * 背景：`target.push(...items)` 与 `Math.max(...values)` 会把整个数组作为
 * **函数参数**展开，参数个数受引擎调用栈限制。元素数超过约 10^5 ~ 10^6 时
 * 直接抛 `RangeError: Maximum call stack size exceeded`。
 *
 * 而这些调用恰恰集中在「为大数据量设计」的导出工具里（模板导出、GIS 转
 * Excel、SHP 转 Excel、地震/天气图表统计等）——数据越大越容易触发。
 *
 * 本模块用循环 / 归约替代参数展开，语义与原写法严格一致。
 */

/**
 * 把 `items` 的全部元素追加到 `target`，等价于 `target.push(...items)`，
 * 但不展开参数。返回 target 便于链式使用。
 */
export function pushAll<T>(target: T[], items: Iterable<T>): T[] {
  for (const item of items) target.push(item)
  return target
}

/**
 * 等价于 `Math.max(...values, fallback)`。
 *
 * - fallback 默认 `-Infinity`，因此 `maxOf([])` === `Math.max()` === `-Infinity`；
 * - 逐元素用 `Math.max` 归约，NaN 传播行为与原生展开完全一致。
 *   注意不要写成 `if (v > m) m = v`——那样会把 NaN 静默跳过。
 */
export function maxOf(values: Iterable<number>, fallback = -Infinity): number {
  let m = fallback
  for (const v of values) m = Math.max(m, v)
  return m
}

/**
 * 等价于 `Math.min(...values, fallback)`，fallback 默认 `+Infinity`。
 * 同样保留 NaN 传播。
 */
export function minOf(values: Iterable<number>, fallback = Infinity): number {
  let m = fallback
  for (const v of values) m = Math.min(m, v)
  return m
}
