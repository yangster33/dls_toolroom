/**
 * 文件管线客户端（C4 阶段 4 / P2-20）
 *
 * 主线程侧的统一入口：把最重的「表格解析」搬进
 * `src/workers/filePipeline.worker.ts`，并在 Worker 不可用时**退回主线程实现**。
 *
 * 硬约束（计划 4.2 / 4.6 / 4.7）：
 * 1. Worker URL 必须让 Vite 能静态分析：`new Worker(new URL(相对路径, import.meta.url), { type: 'module' })`
 *    （写成变量构造器或 `@/` 别名都不会切出 chunk，实测过）；
 * 2. Worker 不可用 → 退回主线程实现，**行为不变**。构造期失败、运行期 onerror 都会降级；
 *    运行期那次降级还会把**在途请求改走主线程重算**，不会让用户看到"第一次失败、第二次才好"；
 * 3. `AbortSignal` 贯通：abort 时 terminate（复用 B2 的取消模型），在途请求以 AbortError 拒绝。
 *
 * 为什么只有 parse、没有 write：`write`（exceljs 生成）仍由
 * `utils/exceljsPipeline.writeXlsx` 在主线程执行。把 write 接进 Worker 需要先把
 * 「exceljs 生成」抽成 worker 与主线程共同依赖的第三个模块（否则循环依赖），
 * 属 D 档收敛工作；在那之前，worker 里那份 exceljs 是纯死货
 * （曾让 worker chunk 白胖 ~900KB），因此这里不提供 write API。
 */
import { parseTemplateMatrix, type TemplateMatrix } from './templateMatrix'
import { writeXlsxBlob, type SheetSpec } from './exceljsCore'
import type { ProgressCallback } from './progress'
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerParseResult,
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

/** 空闲多久后释放 worker（毫秒）。worker 常驻会白占几十 MB，而重建只是重新 eval 缓存 chunk */
const IDLE_TEARDOWN_MS = 60_000

/** 平台 Worker 构造器；测试通过注入假 Worker 覆盖它 */
export type WorkerCtor = new (url: URL, options?: { type: 'module' }) => Worker

/**
 * 生产路径的 Worker 工厂。
 * ⚠ `new Worker(new URL(...))` 三处都必须是**字面形式**（URL、URL 的位置、构造器）：
 * Vite 只对完整字面模式做静态分析，据此切出独立 worker chunk。实测踩过两次坑 ——
 * 把 URL 抽成常量、或把 `new Worker` 换成变量构造器，都不会生成 chunk。
 */
function createDefaultWorker(): Worker {
  return new Worker(new URL('../workers/filePipeline.worker.ts', import.meta.url), {
    type: 'module',
  })
}

/** 只会通过 Promise 交回的响应类型：progress 在 onmessage 里当场转给回调，不 resolve */
type WorkerResult = Extract<WorkerResponse, { type: 'ok' } | { type: 'error' }>

interface PendingRequest {
  resolve: (response: WorkerResult) => void
  reject: (error: unknown) => void
  /** 该请求的进度回调（progress 消息按 id 分流到它，不会 resolve） */
  onProgress?: ProgressCallback
  /** worker 运行期故障时的主线程重算（保证"降级后行为不变"） */
  fallback: () => Promise<WorkerResult>
  /** abort settle 后移除监听，避免 listener 残留 */
  dispose: () => void
}

export function createFilePipeline(options: { Worker?: WorkerCtor } = {}): FilePipelineClient {
  // options.Worker 只给测试注入假 Worker；生产走 createDefaultWorker()
  const InjectedWorker = options.Worker
  let worker: Worker | null = null
  let isDegraded = false
  let nextId = 1
  const pending = new Map<number, PendingRequest>()
  // 空闲一段时间后释放 worker：它常驻会白占几十 MB（里面还躺着 exceljs + xlsx 两份库）。
  // chunk 已被浏览器缓存，重建只是重新 eval，成本远低于常驻内存。
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  const constructWorker = (): Worker =>
    InjectedWorker
      ? new InjectedWorker(new URL('../workers/filePipeline.worker.ts', import.meta.url), {
          type: 'module',
        })
      : createDefaultWorker()

  const clearIdleTimer = () => {
    if (idleTimer !== null) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }

  const teardown = () => {
    if (!worker) return
    clearIdleTimer()
    worker.terminate()
    worker = null
    for (const request of pending.values()) {
      request.dispose()
      request.reject(new DOMException('Worker 被终止', 'AbortError'))
    }
    pending.clear()
  }

  /** 空闲释放：一段时间内没有在途请求就 terminate（不是降级，下次用时重建） */
  const scheduleIdleTeardown = () => {
    clearIdleTimer()
    if (pending.size > 0 || !worker) return
    idleTimer = setTimeout(() => {
      idleTimer = null
      if (pending.size === 0) teardown()
    }, IDLE_TEARDOWN_MS)
  }

  /**
   * 运行期故障：永久降级 + 在途请求改走主线程重算。
   * 触发场景：CSP 拦 worker-src、worker chunk 404/被缓存成旧版本、MIME 不合规等。
   */
  const degradeAndRetry = () => {
    isDegraded = true
    const inflight = [...pending.values()]
    for (const request of inflight) {
      request.dispose()
    }
    pending.clear()
    teardown()
    for (const request of inflight) {
      void request.fallback().then(request.resolve, request.reject)
    }
  }

  const ensureWorker = (): Worker | null => {
    if (isDegraded) return null
    if (worker) {
      clearIdleTimer()
      return worker
    }
    if (typeof Worker === 'undefined' && !InjectedWorker) {
      isDegraded = true
      return null
    }
    try {
      worker = constructWorker()
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data
        const request = pending.get(response.id)
        if (!request) return // 未知 id / 已 abort 的迟到回包：安全忽略

        if (response.type === 'progress') {
          request.onProgress?.(response.percent, response.message)
          return // progress 不 resolve、不清条目
        }
        pending.delete(response.id)
        request.dispose()
        request.resolve(response as WorkerResult)
        scheduleIdleTeardown()
      }
      worker.onerror = () => {
        degradeAndRetry()
      }
      return worker
    } catch {
      // 构造失败（旧浏览器 / CSP / 静态分析失败）→ 永久降级，不影响功能
      isDegraded = true
      return null
    }
  }

  /** 主线程等价的 parse：worker 与降级路径共用同一份 parseTemplateMatrix，产物天然一致 */
  const parseOnMainThread = async (
    file: File,
    onProgress: ProgressCallback | undefined,
  ): Promise<WorkerResult> => {
    const matrix = await parseTemplateMatrix(file, onProgress)
    const payload: WorkerParseResult = {
      rawData: matrix.rawData,
      fileHeaders: matrix.fileHeaders,
    }
    return { id: 0, type: 'ok', kind: 'parse', ...payload }
  }

  type PipelineSpec =
    | { kind: 'parse'; payload: { file: File } }
    | { kind: 'write'; payload: { sheets: readonly SheetSpec[] } }

  /** 主线程等价的 write：worker 与降级路径共用同一份 exceljs 实现，产物天然一致 */
  const writeOnMainThread = async (
    sheets: readonly SheetSpec[],
    onProgress: ProgressCallback | undefined,
  ): Promise<WorkerResult> => {
    const blob = await writeXlsxBlob(sheets, onProgress)
    return { id: 0, type: 'ok', kind: 'write', blob }
  }

  const runInWorker = (
    spec: PipelineSpec,
    onProgress: ProgressCallback | undefined,
    signal: AbortSignal | undefined,
  ): Promise<WorkerResult> | undefined => {
    // 已取消就不该再创建 Worker（否则会留下一个空转的 worker）
    if (signal?.aborted) {
      return Promise.reject(new DOMException('已取消', 'AbortError'))
    }

    const activeWorker = ensureWorker()
    if (!activeWorker) return undefined

    const id = nextId++
    let dispose = () => {}
    const promise = new Promise<WorkerResult>((resolve, reject) => {
      pending.set(id, {
        resolve,
        reject,
        onProgress,
        fallback:
          spec.kind === 'parse'
            ? () => parseOnMainThread(spec.payload.file, onProgress)
            : () => writeOnMainThread(spec.payload.sheets, onProgress),
        dispose: () => dispose(),
      })
      if (signal) {
        const onAbort = () => {
          const entry = pending.get(id)
          if (!entry) return
          pending.delete(id)
          entry.dispose()
          // 只有一个在途请求时才 terminate：其它请求会被完整执行完
          if (pending.size === 0) teardown()
          else scheduleIdleTeardown()
          reject(new DOMException('已取消', 'AbortError'))
        }
        signal.addEventListener('abort', onAbort, { once: true })
        dispose = () => signal.removeEventListener('abort', onAbort)
      }
    })

    const request: WorkerRequest = { id, ...spec } as WorkerRequest
    try {
      activeWorker.postMessage(request)
    } catch (error) {
      // postMessage 失败（序列化报错 / worker 已 terminate）：必须清理条目，
      // 否则僵尸条目会让 abort 永不 terminate，并变成 unhandled rejection
      const entry = pending.get(id)
      if (entry) {
        pending.delete(id)
        entry.dispose()
        // 注意：不要 entry.reject(error) —— 调用方的 rejection 来自下面的 throw，
        // 这里再 reject 一次会让那个没人 await 的 Promise 变成 unhandled rejection。
      }
      throw error
    }

    return promise
  }

  return {
    parse: async (file, onProgress, signal) => {
      // Worker 首次要下载并 eval chunk：先画一帧，别让进度停在 0% 干等
      onProgress?.(0, '正在准备解析环境...')
      const response = await runInWorker({ kind: 'parse', payload: { file } }, onProgress, signal)
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
      const response = await runInWorker({ kind: 'write', payload: { sheets } }, onProgress, signal)
      if (!response) {
        // 降级路径：主线程直接生成
        return writeXlsxBlob(sheets, onProgress)
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
