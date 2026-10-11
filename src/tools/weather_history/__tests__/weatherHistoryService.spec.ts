import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchWeatherHistory, type WeatherFormData } from '../weatherHistoryService'

/**
 * 审计报告 B2 / P2-15 的回归测试。
 *
 * weatherHistoryService 此前用裸 fetch 调 Open-Meteo 归档 API：
 * 无超时（弱网下永远等不到错误，spinner 永转）、无法取消。
 * 现统一走 fetchWithTimeout，并接受外部 AbortSignal。
 */

const FORM: WeatherFormData = {
  latitude: '39.9',
  longitude: '116.4',
  startDate: '2026-08-01',
  endDate: '2026-08-17',
}

const VARIABLES = ['temperature_2m']

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('fetchWeatherHistory · 请求取消与超时（审计 B2）', () => {
  it('成功返回数据', async () => {
    const payload = { hourly: { time: ['2026-08-01T00:00'] } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }))

    const result = await fetchWeatherHistory(FORM, VARIABLES)

    expect(result.success).toBe(true)
    expect(result.data).toBe(payload)
  })

  it('外部 AbortSignal 已 abort 时不再发起 fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    controller.abort()

    const result = await fetchWeatherHistory(FORM, VARIABLES, controller.signal)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.success).toBe(false)
  })

  it('传入的 signal 会透传给底层 fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await fetchWeatherHistory(FORM, VARIABLES, controller.signal)

    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('挂起超时后返回可读的失败结果（验收标准 1）', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            // 模拟「连接挂起」：永不 resolve，只在 abort 时 reject
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            )
          }),
      ),
    )

    const pending = fetchWeatherHistory(FORM, VARIABLES)
    // 未到超时前不应结束
    await vi.advanceTimersByTimeAsync(14_999)

    await vi.advanceTimersByTimeAsync(1)
    const result = await pending

    expect(result.success).toBe(false)
    expect(result.error).toContain('超时')
  })
})
