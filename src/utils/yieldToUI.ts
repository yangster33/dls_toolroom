/**
 * 把控制权交还事件循环，让浏览器有机会重绘进度条、响应点击。
 *
 * ⚠ 关键认知：**`await` 一个 Promise ≠ 不阻塞主线程。**
 * `await workbook.xlsx.writeBuffer()` / `XLSX.write` 这类 API 虽然返回 Promise，
 * 序列化仍在主线程同步跑完，页面一样冻结。exceljs 的 streaming writer 才是真流式，
 * 而根治手段是把耗时计算移入 Web Worker（见 docs/2026-10-12-async-pipeline-plan.md 阶段 4）。
 *
 * 在**没法 Worker 化**的路径上（或被 Worker 降级后的回退路径），
 * 长循环里周期性 `await yieldToUI()` 是最低成本的让出手段。
 *
 * 用法：按**批**让出，不要逐行让出——每 500 行左右一次，
 * 否则大量微任务会拖慢整体吞吐（计划风险 R4）。
 */

/** 默认让出粒度：0ms 即下一轮宏任务，足够让浏览器重绘一帧 */
const DEFAULT_YIELD_MS = 0

export function yieldToUI(ms: number = DEFAULT_YIELD_MS): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
