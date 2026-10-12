import { describe, it, expect, vi } from 'vitest'
import { yieldToUI } from '../yieldToUI'

/**
 * C4 阶段 1.4：统一的让出主线程工具。
 * 存在的意义：把"`await` ≠ 不阻塞"这件事写进代码里。
 * `await workbook.xlsx.writeBuffer()` 这类 API 返回 Promise，但序列化仍在主线程
 * 同步跑完；只有 yield 到宏任务（或移入 Worker）才真的让出。
 */
describe('yieldToUI', () => {
  it('让出是宏任务，不是微任务', async () => {
    const order: string[] = []
    const yielded = yieldToUI().then(() => order.push('yield'))
    // 排一个微任务：如果 yieldToUI 是微任务实现，它会先于这里跑完
    void Promise.resolve().then(() => order.push('microtask'))
    await yielded
    expect(order).toEqual(['microtask', 'yield'])
  })

  it('自定义延迟走 setTimeout', async () => {
    vi.useFakeTimers()
    let resolved = false
    const pending = yieldToUI(50).then(() => {
      resolved = true
    })
    await vi.advanceTimersByTimeAsync(49)
    expect(resolved).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(resolved).toBe(true)
    vi.useRealTimers()
  })
})
