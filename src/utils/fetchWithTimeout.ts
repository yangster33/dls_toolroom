/**
 * 带超时与取消能力的 fetch 封装
 *
 * 背景（审计 B2 / P2-15）：项目里多处直接用裸 `fetch()` 调外部 API。
 * 裸 fetch 有三个共同问题：
 *
 *  1. **无超时** —— 连接挂起时 spinner 永久转动，用户永远等不到结果，
 *     也永远看不到错误提示。
 *  2. **无法取消** —— 用户离开页面后请求仍在跑，响应回来后还会继续
 *     修改已卸载组件的状态。
 *  3. **错误信息不可读** —— 网络层抛错时只拿到一个 `TypeError: Failed to fetch`，
 *     无法区分"超时""断网""被阻断"。
 *
 * 本模块用一个工厂把这三件事统一下来，并保留原生 `Response` 作为返回值，
 * 调用方的 `res.ok` / `res.json()` 逻辑完全不用改。
 */

/** 默认超时（毫秒）——外部 API 通常应在数秒内响应 */
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000

/** 超时错误的识别标记（改名安全，不要内联到业务代码里） */
export const FETCH_TIMEOUT_MARKER = '__dls_fetch_timeout__'

/** 超时抛出的错误，带可识别标记 */
export class FetchTimeoutError extends Error {
  readonly code = FETCH_TIMEOUT_MARKER
  constructor(timeoutMs: number) {
    super(`请求超时（${timeoutMs}ms）`)
    this.name = 'FetchTimeoutError'
  }
}

/** 判断是否为超时错误 */
export function isFetchTimeoutError(err: unknown): boolean {
  return (
    err instanceof FetchTimeoutError ||
    (typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: unknown }).code === FETCH_TIMEOUT_MARKER)
  )
}

/** 把任意 fetch 拒绝原因转成用户可读的中文信息 */
export function describeFetchError(err: unknown, url?: string): string {
  if (isFetchTimeoutError(err)) return '请求超时，请检查网络后重试'
  if (err instanceof DOMException && err.name === 'AbortError') return '请求已取消'
  if (err instanceof TypeError) return '网络请求失败，请检查网络连接'
  const msg = err instanceof Error ? err.message : String(err)
  return url ? `请求失败（${url}）: ${msg}` : `请求失败: ${msg}`
}

export interface FetchWithTimeoutOptions extends RequestInit {
  /** 超时毫秒数，默认 15s；传 0 或负数表示不设超时 */
  timeoutMs?: number
}

/**
 * 带超时的 fetch。
 *
 * @throws {FetchTimeoutError} 超过 timeoutMs
 * @throws {DOMException}      外部 AbortSignal 被触发时透传，name === 'AbortError'
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, signal: externalSignal, ...rest } = options

  // 调用方已取消则直接拒绝，不再发请求
  if (externalSignal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }

  const controller = new AbortController()
  const onExternalAbort = () => controller.abort(externalSignal?.reason)
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true })

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    if (timeoutMs > 0) {
      timer = setTimeout(() => controller.abort(new FetchTimeoutError(timeoutMs)), timeoutMs)
    }
    return await fetch(url, { ...rest, signal: controller.signal })
  } catch (err) {
    // 外部取消 → 保持 AbortError 语义，不包装成超时
    if (externalSignal?.aborted) throw err
    // 超时取消 → 转成带标记的错误
    if (controller.signal.aborted) {
      throw controller.signal.reason instanceof FetchTimeoutError
        ? controller.signal.reason
        : new FetchTimeoutError(timeoutMs)
    }
    throw err
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    externalSignal?.removeEventListener('abort', onExternalAbort)
  }
}

/**
 * 组件内创建可取消的请求控制器，自动在作用域结束时取消。
 *
 * 用法：
 *   const scope = createAbortScope()
 *   const res = await fetchWithTimeout(url, { signal: scope.signal })
 *
 * 说明：这里不直接 import vue 的 onUnmounted，以便该工具在非组件环境
 * （composable / service）也能使用；组件内请自行把 scope.abort() 挂到
 * onUnmounted，或用下面导出的 useAbortScope。
 */
export function createAbortScope(): {
  signal: AbortSignal
  abort: (reason?: unknown) => void
} {
  const controller = new AbortController()
  return { signal: controller.signal, abort: (r) => controller.abort(r) }
}

/**
 * 「单飞」请求闸门：同一时刻只允许一个进行中的请求。
 *
 * 每次 begin() 会取消上一个尚未完成的请求，并返回新的 signal。
 * 调用方用 signal.aborted 判断「本次请求是否已被取代或被卸载取消」，
 * 从而避免旧响应覆盖新状态（race），也避免卸载后继续改状态。
 *
 * 典型用法（组件内）：
 *   const gate = createRequestGate()
 *   onUnmounted(() => gate.abort())
 *   ...
 *   const signal = gate.begin()
 *   const result = await someService(params, signal)
 *   if (signal.aborted) return
 *
 * 不依赖 vue，便于在 service / composable 中复用。
 */
export function createRequestGate(): {
  begin: () => AbortSignal
  abort: () => void
} {
  let controller: AbortController | null = null
  return {
    begin() {
      controller?.abort()
      controller = new AbortController()
      return controller.signal
    },
    abort() {
      controller?.abort()
      controller = null
    },
  }
}
