import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchWithTimeout,
  FetchTimeoutError,
  isFetchTimeoutError,
  describeFetchError,
  createAbortScope,
  createRequestGate,
  DEFAULT_FETCH_TIMEOUT_MS,
} from '../fetchWithTimeout'

/**
 * 审计报告 B2 / P2-15 的回归测试
 *
 * 项目里多处裸 fetch 调外部 API：无超时（连接挂起则 spinner 永久转）、
 * 无法取消（离开页面后请求仍在跑并继续改状态）、错误信息只有
 * "TypeError: Failed to fetch"。
 */

function stubFetch(impl: typeof fetch) {
  const spy = vi.fn(impl)
  vi.stubGlobal('fetch', spy)
  return spy
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('fetchWithTimeout', () => {
  it('成功时正常返回 Response（调用方 res.ok / res.json 逻辑不变）', async () => {
    stubFetch(async () => jsonResponse({ elevation: [42] }))

    const res = await fetchWithTimeout('https://api.example.com/x')

    expect(res.ok).toBe(true)
    await expect(res.json()).resolves.toEqual({ elevation: [42] })
  })

  it('透传 method / headers / body 等原 fetch 选项', async () => {
    const spy = stubFetch(async () => jsonResponse({}))

    await fetchWithTimeout('https://api.example.com/x', {
      method: 'POST',
      headers: { 'x-a': '1' },
      body: 'payload',
    })

    expect(spy).toHaveBeenCalledWith(
      'https://api.example.com/x',
      expect.objectContaining({ method: 'POST', headers: { 'x-a': '1' }, body: 'payload' }),
    )
  })

  it('超时后抛 FetchTimeoutError，而不是挂起', async () => {
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
        }),
    )

    const p = fetchWithTimeout('https://api.example.com/slow', { timeoutMs: 5000 })
    // 先挂上 catch，避免定时器触发时产生未处理的 rejection
    const settled = p.catch((e: unknown) => e)

    await vi.advanceTimersByTimeAsync(4999)
    await vi.advanceTimersByTimeAsync(1)

    expect(await settled).toBeInstanceOf(FetchTimeoutError)
  })

  it('默认超时为 15s', async () => {
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBe(15_000)
  })

  it('timeoutMs <= 0 表示不设超时', async () => {
    const spy = stubFetch(async () => jsonResponse({ ok: true }))
    const res = await fetchWithTimeout('https://api.example.com/x', { timeoutMs: 0 })
    expect(res.ok).toBe(true)
    // 不应注册任何定时器导致测试悬挂
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('外部 AbortSignal 触发时抛 AbortError（保持原生语义）', async () => {
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
        }),
    )

    const scope = createAbortScope()
    const p = fetchWithTimeout('https://api.example.com/x', { signal: scope.signal, timeoutMs: 0 })
    const settled = p.catch((e: unknown) => e)

    scope.abort()

    const err = await settled
    expect(err).toBeInstanceOf(DOMException)
    expect((err as DOMException).name).toBe('AbortError')
  })

  it('外部已 abort 时直接拒绝，不发请求，且保持原生 AbortError 语义', async () => {
    const spy = stubFetch(async () => jsonResponse({}))
    const scope = createAbortScope()
    scope.abort()

    // 必须保持原生 name === 'AbortError'，调用方普遍依此判断取消语义。
    // 曾因改成中文 message 导致该判断失效，此断言用于固化契约。
    await expect(
      fetchWithTimeout('https://api.example.com/x', { signal: scope.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('网络错误（TypeError）原样抛出', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(fetchWithTimeout('https://api.example.com/x')).rejects.toThrow(TypeError)
  })

  it('HTTP 错误状态不抛错，由调用方判断（与原生 fetch 一致）', async () => {
    stubFetch(async () => jsonResponse({ error: 'bad' }, { status: 400 }))

    const res = await fetchWithTimeout('https://api.example.com/x')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  it('超时后清理定时器，不泄漏', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    stubFetch(async () => jsonResponse({}))
    await fetchWithTimeout('https://api.example.com/x')
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })
})

describe('isFetchTimeoutError', () => {
  it('识别 FetchTimeoutError 实例', () => {
    expect(isFetchTimeoutError(new FetchTimeoutError(1000))).toBe(true)
  })

  it('识别带 code 标记的普通对象（跨 realm / 序列化场景）', () => {
    expect(isFetchTimeoutError({ code: '__dls_fetch_timeout__' })).toBe(true)
  })

  it('不误判其它错误', () => {
    expect(isFetchTimeoutError(new Error('x'))).toBe(false)
    expect(isFetchTimeoutError(new TypeError('Failed to fetch'))).toBe(false)
    expect(isFetchTimeoutError(null)).toBe(false)
  })
})

describe('describeFetchError', () => {
  it('超时 → 中文可读信息', () => {
    expect(describeFetchError(new FetchTimeoutError(5000))).toBe('请求超时，请检查网络后重试')
  })

  it('取消 → 中文可读信息', () => {
    const err = new DOMException('aborted', 'AbortError')
    expect(describeFetchError(err)).toBe('请求已取消')
  })

  it('网络错误 → 中文可读信息', () => {
    expect(describeFetchError(new TypeError('Failed to fetch'))).toBe(
      '网络请求失败，请检查网络连接',
    )
  })

  it('未知错误带上 url 便于排查', () => {
    expect(describeFetchError(new Error('boom'), 'https://a.com')).toContain('https://a.com')
  })
})

describe('createRequestGate', () => {
  it('begin 返回新 signal，前一个被取消（单飞）', () => {
    const gate = createRequestGate()
    const s1 = gate.begin()
    expect(s1.aborted).toBe(false)

    const s2 = gate.begin()
    // 旧请求被取代
    expect(s1.aborted).toBe(true)
    expect(s2.aborted).toBe(false)
    expect(s1).not.toBe(s2)
  })

  it('abort 取消当前请求，之后 begin 仍是全新的未取消 signal', () => {
    const gate = createRequestGate()
    const s1 = gate.begin()
    gate.abort()
    expect(s1.aborted).toBe(true)

    const s2 = gate.begin()
    expect(s2.aborted).toBe(false)
  })

  it('未 begin 时直接 abort 不报错', () => {
    const gate = createRequestGate()
    expect(() => gate.abort()).not.toThrow()
  })
})

describe('createAbortScope', () => {
  it('abort 后 signal.aborted 为 true', () => {
    const scope = createAbortScope()
    expect(scope.signal.aborted).toBe(false)
    scope.abort()
    expect(scope.signal.aborted).toBe(true)
  })

  it('支持传入原因', () => {
    const scope = createAbortScope()
    scope.abort('user navigated away')
    expect(scope.signal.reason).toBe('user navigated away')
  })
})
