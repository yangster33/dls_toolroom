/**
 * 取消（AbortSignal）相关的统一小工具（C4 收尾 / P2-20）。
 *
 * 为什么单独一个文件：`filePipelineClient.parse(file, onProgress, signal)` 的
 * AbortSignal 早已贯通到 `worker.terminate()`，但**页面侧一直没人创建
 * AbortController**（审计 M4 如实记档的「客户端能力就绪、页面未接取消」）。
 * 收尾时 9 个 reader / 6 个页面都要判断「是不是被用户取消了」，
 * 如果各处自己 `new DOMException(..., 'AbortError')` + 自己拼错误名判断，
 * 就是审计 P3-4「同一逻辑复制 N 份」的又一个副本。
 *
 * 判据用 **name** 而非 `instanceof DOMException`：跨 realm（jsdom / iframe /
 * Node 与浏览器混跑）时 instanceof 会假阴性，而 `name` 恒定可用。
 */

/** 取消时抛出的错误（与平台 `AbortController.abort()` 的默认 reason 同型同名） */
export function createAbortError(message = '已取消'): DOMException {
  return new DOMException(message, 'AbortError')
}

/** 是否「用户取消」类错误：取消不该弹错误对话框，只该静默收尾 */
export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  return (error as { name?: unknown }).name === 'AbortError'
}

/**
 * 在**可让出的间隙**检查取消：已取消就抛 AbortError。
 *
 * 必须放在长循环里周期性调用 —— 只在函数开头检查一次是不够的：
 * 循环中的 `validateRow` / 字符串拼接同样不可中断，用户点了「终止计算」
 * 之后还会跑完整个循环（甚至把结果写回页面）。
 */
export function throwIfAborted(signal?: AbortSignal, message?: string): void {
  if (signal?.aborted) throw createAbortError(message)
}
