/**
 * 文件管线客户端（C4 阶段 4 / P2-20）
 *
 * 主线程侧的统一入口：把最重的解析/生成工作搬进
 * `src/workers/filePipeline.worker.ts`，并在 Worker 不可用时**退回主线程实现**。
 *
 * 三条硬约束（计划 4.2 / 4.6 / 4.7）：
 * 1. Worker URL 必须让 Vite 能静态分析：`new Worker(new URL(..., import.meta.url), { type: 'module' })`；
 * 2. `typeof Worker === 'undefined'` 或构造抛错 → 永久降级到主线程路径，行为不变；
 * 3. `AbortSignal` 贯通：abort 时 terminate（复用 B2 的取消模型），
 *    在途请求以 AbortError 拒绝 —— 与 `fetchWithTimeout` 的 `AbortError` 语义一致。
 */
import { parseTemplateMatrix, type TemplateMatrix } from './templateMatrix'
import { writeXlsx, type SheetSpec } from './exceljsPipeline'
import type { ProgressCallback } from './progress'
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerParseRequest,
  WorkerWriteRequest,
} from '@/workers/filePipeline.worker'

export interface FilePipelineClient {
  parse: (
    file: File,
    onProgress?: ProgressCallback,
    signal?: AbortSignal,
  ) => Promise<TemplateMatrix>
  write: (
    sheets: readonly SheetSpec[],
    onProgress?: ProgressCallback,
    signal?: AbortSignal,
  ) => Promise<Blob>
  /** 是否已经降级到主线程（供调用方/测试观测） */
  readonly degraded: () => boolean
}

export type WorkerCtor = new (url: URL, options?: { type: 'module' }) => Worker

/**
 * 生产路径的 Worker 工厂。
 *
 * ⚠ 这里的 `new Worker(new URL(...))` 必须保持**字面形式**：Vite 只对该模式做静态分析，
 * 据此把 worker 切成独立 chunk（用变量构造器/别名路径都不会生成 chunk，实测过）。
 * 测试通过 `createFilePipeline({ Worker })` 注入假 Worker，不走这个工厂。
 */
function createDefaultWorker(): Worker {
  return new Worker(new URL('../workers/filePipeline.worker.ts', import.meta.url), {
    type: 'module',
  })
}

/** 只会通过 Promise 交回的响应类型：progress 在 onmessage 里当场转给回调，不 resolve */
export type WorkerResult =
  | Extract<WorkerResponse, { type: 'ok' }>
  | Extract<WorkerResponse, { type: 'error' }>

interface PendingRequest {
  resolve: (response: WorkerResult) => void
  reject: (error: unknown) => void
  onProgress?: ProgressCallback
}

export function createFilePipeline(options: { Worker?: WorkerCtor } = {}): FilePipelineClient {
  // options.Worker 只给测试注入假 Worker；生产传 undefined，走 createDefaultWorker()
  const InjectedWorker = options.Worker
  let worker: Worker | null = null
  let isDegraded = false
  let nextId = 1
  const pending = new Map<number, PendingRequest>()

  const teardown = () => {
    if (!worker) return
    worker.terminate()
    worker = null
    for (const request of pending.values()) {
      request.reject(new DOMException('Worker 被终止', 'AbortError'))
    }
    pending.clear()
  }

  const ensureWorker = (): Worker | null => {
    if (isDegraded) return null
    if (worker) return worker
    // 注入缺失且环境没有 Worker 实现（老浏览器 / SSR / 被 CSP 挡掉）→ 永久降级
    if (!InjectedWorker && typeof Worker === 'undefined') {
      isDegraded = true
      return null
    }
    try {
      worker = InjectedWorker
        ? new InjectedWorker(new URL('../workers/filePipeline.worker.ts', import.meta.url), {
            type: 'module',
          })
        : createDefaultWorker()
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data
        const request = pending.get(response.id)
        if (!request) return

        if (response.type === 'progress') {
          request.onProgress?.(response.percent, response.message)
          return
        }
        pending.delete(response.id)
        request.resolve(response as WorkerResult)
      }
      worker.onerror = (event) => {
        //  Worker 挂了（模块加载失败等）：降级，并把在途请求变成 error
        isDegraded = true
        const error = new Error(`Worker 错误：${event.message || '未知错误'}`)
        for (const [id, request] of pending) {
          request.reject(error)
          pending.delete(id)
        }
        teardown()
      }
      return worker
    } catch {
      // 构造失败（旧浏览器 / CSP / 静态分析失败）→ 永久降级，不影响功能
      isDegraded = true
      return null
    }
  }

  const runInWorker = (
    build: (id: number) => WorkerRequest,
    onProgress: ProgressCallback | undefined,
    signal: AbortSignal | undefined,
  ): Promise<WorkerResult> | null => {
    // 已取消就不该再创建 Worker（否则会留下一个空转的 worker）
    if (signal?.aborted) {
      return Promise.reject(new DOMException('已取消', 'AbortError'))
    }

    const activeWorker = ensureWorker()
    if (!activeWorker) return null

    const id = nextId++
    const promise = new Promise<WorkerResult>((resolve, reject) => {
      pending.set(id, { resolve, reject, onProgress })
      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            if (!pending.has(id)) return
            pending.delete(id)
            // 只有一个在途请求时才 terminate：其它请求会被完整执行完
            if (pending.size === 0) teardown()
            reject(new DOMException('已取消', 'AbortError'))
          },
          { once: true },
        )
      }
    })

    activeWorker.postMessage(build(id))
    return promise
  }

  return {
    parse: async (file, onProgress, signal) => {
      const response = await runInWorker(
        (id) => ({ id, kind: 'parse', payload: { file } }) satisfies WorkerParseRequest,
        onProgress,
        signal,
      )
      if (!response) {
        // 降级路径：主线程直接算
        return parseTemplateMatrix(file, onProgress)
      }
      if (response.type === 'error') {
        throw new Error(response.message)
      }
      if (response.kind !== 'parse') {
        throw new Error('Worker 返回了非 parse 结果')
      }
      return { rawData: response.rawData, fileHeaders: response.fileHeaders }
    },

    write: async (sheets, onProgress, signal) => {
      const response = await runInWorker(
        (id) =>
          ({
            id,
            kind: 'write',
            payload: { sheets: sheets as SheetSpec[] },
          }) satisfies WorkerWriteRequest,
        onProgress,
        signal,
      )
      if (!response) {
        return writeXlsx(sheets, onProgress)
      }
      if (response.type === 'error') {
        throw new Error(response.message)
      }
      if (response.kind !== 'write') {
        throw new Error('Worker 返回了非 write 结果')
      }
      return response.blob
    },

    degraded: () => isDegraded,
  }
}

/** 进程内单例（首次使用时才创建 Worker） */
export const filePipeline = createFilePipeline()
