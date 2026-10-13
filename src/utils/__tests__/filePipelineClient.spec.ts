import { describe, it, expect, vi, afterEach } from 'vitest'
import * as XLSX from 'xlsx'
import { createFilePipeline, type WorkerCtor } from '../filePipelineClient'
import type { WorkerRequest, WorkerResponse } from '@/workers/filePipeline.worker'

/**
 * exceljs 是懒加载的，而 vitest 的 fake timers 会让首次 `await import()` 永不 settle。
 * 本文件与其它 spec 共享 worker 进程，提前预载可避免顺序依赖。
 */
await import('exceljs')

/**
 * C4 阶段 4：文件管线 Worker 化的客户端契约测试。
 *
 * 关键点：**注入假 Worker** 而不是依赖真实 Worker —— vitest 的 jsdom 环境没有
 * 原生 Worker，而真实 Worker 的行为在这里无法断言（时序、消息协议）。
 * 真实 Worker 的打包与连通由 `npm run build`（产物里出现独立 worker chunk）
 * 与 Playwright 的 e2e 覆盖。
 */

/** 可控的假 Worker：记录 postMessage，允许测试手动回消息 */
class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  posted: WorkerRequest[] = []
  terminated = false

  constructor(
    readonly url: URL,
    readonly options?: { type?: 'module' },
  ) {
    FakeWorker.instances.push(this)
  }

  postMessage(request: WorkerRequest) {
    this.posted.push(request)
  }

  terminate() {
    this.terminated = true
    FakeWorker.instances = FakeWorker.instances.filter((it) => it !== this)
  }

  /** 测试辅助：回一条消息 */
  reply(response: WorkerResponse) {
    this.onmessage?.(new MessageEvent('message', { data: response }))
  }

  /** 测试辅助：回一条 ok */
  replyOk(payload: Extract<WorkerResponse, { type: 'ok' }>) {
    this.reply({ ...payload } as WorkerResponse)
  }

  fail(message: string) {
    this.onerror?.(new ErrorEvent('error', { message }))
  }
}

function makeCsvFile(content: string, name = '模板.csv'): File {
  return new File(['\uFEFF' + content], name, { type: 'text/csv' })
}

function workerCtor(): WorkerCtor {
  return FakeWorker as unknown as WorkerCtor
}

afterEach(() => {
  FakeWorker.instances = []
  vi.restoreAllMocks()
})

describe('filePipelineClient · 正常路径（Worker 可用）', () => {
  it('Worker 以 module 形态、用 import.meta.url 静态可分析的 URL 构造', () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    void pipeline.parse(makeCsvFile('名称,经度,纬度\nA,116.4,39.9'))
    const worker = FakeWorker.instances[0]!
    expect(worker.options).toEqual({ type: 'module' })
    expect(worker.url.pathname).toContain('filePipeline.worker.ts')
  })

  it('parse：File 被结构化克隆进 Worker，回包解出矩阵', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const file = makeCsvFile('名称,经度,纬度\nA,116.4,39.9')
    const pending = pipeline.parse(file)

    const worker = FakeWorker.instances[0]!
    expect(worker.posted).toHaveLength(1)
    expect(worker.posted[0]!.kind).toBe('parse')
    expect((worker.posted[0]!.payload as { file: File }).file).toBe(file)

    worker.replyOk({
      id: worker.posted[0]!.id,
      type: 'ok',
      kind: 'parse',
      rawData: [['名称'], ['A']],
      fileHeaders: ['名称'],
    })
    const matrix = await pending
    expect(matrix.fileHeaders).toEqual(['名称'])
    expect(matrix.rawData).toEqual([['名称'], ['A']])
  })

  it('write：SheetSpec 序列化进 Worker，回包拿到 Blob', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const blob = new Blob(['x'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const pending = pipeline.write([{ name: 'S', headers: ['a'], rows: [['1']] }])

    const worker = FakeWorker.instances[0]!
    expect(worker.posted[0]!.kind).toBe('write')
    worker.replyOk({ id: worker.posted[0]!.id, type: 'ok', kind: 'write', blob })

    expect(await pending).toBe(blob)
  })

  it('progress 消息当场转给回调，不会 resolve', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const reports: number[] = []
    const pending = pipeline.parse(makeCsvFile('a,b\n1,2'), (percent) => reports.push(percent))

    const worker = FakeWorker.instances[0]!
    worker.reply({ id: worker.posted[0]!.id, type: 'progress', percent: 20, message: '解析中' })
    expect(reports).toEqual([20])

    // 未 resolve：等一小会儿仍未完成
    const race = await Promise.race([pending.then(() => 'done'), Promise.resolve('pending')])
    expect(race).toBe('pending')
  })

  it('error 回包转成 Error 抛出', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const pending = pipeline.parse(makeCsvFile('a,b\n1,2'))
    const worker = FakeWorker.instances[0]!
    worker.reply({ id: worker.posted[0]!.id, type: 'error', message: '文件为空。' })
    await expect(pending).rejects.toThrow('文件为空。')
  })
})

describe('filePipelineClient · 降级路径（计划 4.6）', () => {
  it('没有 Worker 构造器时退回主线程，且产物与 Worker 路径一致', async () => {
    const pipeline = createFilePipeline({ Worker: undefined })
    const file = makeCsvFile('名称,经度,纬度\nA,116.4,39.9\nB,121.5,31.2')
    const matrix = await pipeline.parse(file)

    expect(pipeline.degraded()).toBe(true)
    expect(matrix.fileHeaders).toEqual(['名称', '经度', '纬度'])
    expect(matrix.rawData).toHaveLength(3)
  })

  it('构造抛错时永久降级，之后仍可用', async () => {
    class ThrowingWorker {
      constructor() {
        throw new Error('CSP 禁止 Worker')
      }
      postMessage() {}
      terminate() {}
      addEventListener() {}
    }
    const pipeline = createFilePipeline({
      Worker: ThrowingWorker as unknown as WorkerCtor,
    })
    const matrix = await pipeline.parse(makeCsvFile('名称\nA'))
    expect(pipeline.degraded()).toBe(true)
    expect(matrix.fileHeaders).toEqual(['名称'])
  })

  it('Worker 运行期报错（模块加载失败）→ 降级并把在途请求变 error', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const pending = pipeline.parse(makeCsvFile('名称\nA'))
    FakeWorker.instances[0]!.fail('worker script crashed')

    await expect(pending).rejects.toThrow('Worker 错误')
    expect(pipeline.degraded()).toBe(true)

    // 降级后仍能完成后续请求
    const matrix = await pipeline.parse(makeCsvFile('名称\nB'))
    expect(matrix.fileHeaders).toEqual(['名称'])
  })
})

describe('filePipelineClient · 取消（计划 4.7）', () => {
  it('abort 后 in-flight 请求以 AbortError 拒绝，最后一个请求时 terminate', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const controller = new AbortController()
    const pending = pipeline.parse(makeCsvFile('名称\nA'), undefined, controller.signal)

    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(FakeWorker.instances).toHaveLength(0)
  })

  it('abort 前已 settled 的请求不会被二次拒绝', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const controller = new AbortController()
    const pending = pipeline.parse(makeCsvFile('名称\nA'), undefined, controller.signal)
    const worker = FakeWorker.instances[0]!
    worker.replyOk({
      id: worker.posted[0]!.id,
      type: 'ok',
      kind: 'parse',
      rawData: [['名称'], ['A']],
      fileHeaders: ['名称'],
    })
    controller.abort()
    await expect(pending).resolves.toEqual({ fileHeaders: ['名称'], rawData: [['名称'], ['A']] })
  })

  it('请求前 signal 已 aborted：直接拒绝，不创建 Worker', async () => {
    const controller = new AbortController()
    controller.abort()
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    await expect(
      pipeline.parse(makeCsvFile('a\nb'), undefined, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(FakeWorker.instances).toHaveLength(0)
  })
})

describe('filePipelineClient · 主线程降级路径的产物正确性', () => {
  it('降级 parse 的矩阵与直接调用 parseTemplateMatrix 一致（含大表）', async () => {
    const { parseTemplateMatrix } = await import('../templateMatrix')
    const rows = Array.from({ length: 3000 }, (_, i) => `点${i},116.4,39.9`)
    const file = makeCsvFile(['名称,经度,纬度', ...rows].join('\n'))

    const pipeline = createFilePipeline({ Worker: undefined })
    const viaPipeline = await pipeline.parse(file)
    const direct = await parseTemplateMatrix(file)

    expect(viaPipeline.fileHeaders).toEqual(direct.fileHeaders)
    expect(viaPipeline.rawData).toHaveLength(direct.rawData.length)
    expect(viaPipeline.rawData[viaPipeline.rawData.length - 1]).toEqual(
      direct.rawData[direct.rawData.length - 1],
    )
  })

  it('降级 write 的产物是合法 xlsx（表名/值可读回）', async () => {
    const pipeline = createFilePipeline({ Worker: undefined })
    const blob = await pipeline.write([
      { name: '点', headers: ['名称', '经度'], rows: [['A', '116.4']] },
    ])
    const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
    expect(wb.SheetNames).toEqual(['点'])
    expect(XLSX.utils.sheet_to_json(wb.Sheets['点']!, { header: 1 })).toEqual([
      ['名称', '经度'],
      ['A', '116.4'],
    ])
  })
})
