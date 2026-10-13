import { describe, it, expect, vi, afterEach } from 'vitest'
import * as XLSX from 'xlsx'
import { createFilePipeline, type WorkerCtor } from '../filePipelineClient'
import { writeXlsxBlob } from '../exceljsCore'
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerParseResult,
} from '@/workers/filePipeline.worker'

/**
 * C4 阶段 4：文件管线 Worker 化的客户端契约测试。
 *
 * 关键点：**注入假 Worker** 而不是依赖真实 Worker —— vitest 的 jsdom 环境没有原生
 * Worker，而真实 Worker 的时序/协议在这里无法断言。真实 Worker 的打包与连通由
 * `npm run build`（dist 里出现独立 worker chunk）与 `e2e/worker-pipeline.spec.ts` 覆盖。
 *
 * exceljs 是懒加载的：fake timers 下首次 `await import()` 不会 settle，
 * 因此在文件顶部预载。
 */
await import('exceljs')

/** 可控的假 Worker：记录 postMessage，允许测试手动回消息 */
class FakeWorker {
  static instances: FakeWorker[] = []
  static throwOnNextPost = false
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
    if (FakeWorker.throwOnNextPost) {
      FakeWorker.throwOnNextPost = false
      throw new Error('DataCloneError')
    }
    this.posted.push(request)
  }

  terminate() {
    this.terminated = true
    FakeWorker.instances = FakeWorker.instances.filter((it) => it !== this)
  }

  reply(response: WorkerResponse) {
    this.onmessage?.(new MessageEvent('message', { data: response }))
  }

  /** 回一条 parse ok（按请求 id） */
  replyParseOk(id: number, result: WorkerParseResult) {
    this.reply({ id, type: 'ok', kind: 'parse', ...result })
  }

  /** 回一条 write ok */
  replyWriteOk(id: number, blob: Blob) {
    this.reply({ id, type: 'ok', kind: 'write', blob })
  }

  fail(message = 'worker crashed') {
    this.onerror?.(new ErrorEvent('error', { message }))
  }

  get lastId(): number {
    return this.posted[this.posted.length - 1]!.id
  }
}

function makeCsvFile(content: string, name = '模板.csv'): File {
  return new File(['\uFEFF' + content], name, { type: 'text/csv' })
}

function workerCtor(): WorkerCtor {
  return FakeWorker as unknown as WorkerCtor
}

const MATRIX: WorkerParseResult = {
  rawData: [
    ['名称', '经度', '纬度'],
    ['A', '116.4', '39.9'],
  ],
  fileHeaders: ['名称', '经度', '纬度'],
}

afterEach(() => {
  FakeWorker.instances = []
  FakeWorker.throwOnNextPost = false
  vi.restoreAllMocks()
})

describe('filePipelineClient · 协议', () => {
  it('Worker 以 module 形态、用可被 Vite 静态分析的 URL 构造', () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    void pipeline.parse(makeCsvFile('名称,经度,纬度\nA,116.4,39.9'))
    const worker = FakeWorker.instances[0]!
    expect(worker.options).toEqual({ type: 'module' })
    expect(worker.url.pathname).toContain('filePipeline.worker.ts')
  })

  it('parse：File 结构化克隆进 Worker，回包解出矩阵', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const file = makeCsvFile('名称,经度,纬度\nA,116.4,39.9')
    const pending = pipeline.parse(file)

    const worker = FakeWorker.instances[0]!
    expect(worker.posted).toHaveLength(1)
    expect(worker.posted[0]!.kind).toBe('parse')
    expect((worker.posted[0]!.payload as { file: File }).file).toBe(file)

    worker.replyParseOk(worker.lastId, MATRIX)
    expect(await pending).toEqual(MATRIX)
  })

  it('write：SheetSpec 序列化进 Worker，回包拿到 Blob', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const blob = new Blob(['x'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const pending = pipeline.write([{ name: 'S', headers: ['a'], rows: [['1']] }])

    const worker = FakeWorker.instances[0]!
    expect(worker.posted[0]!.kind).toBe('write')
    worker.replyWriteOk(worker.lastId, blob)
    expect(await pending).toBe(blob)
  })

  it('write 与 parse 复用同一个 worker，id 连续不串（乱序回包也正确）', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const writePromise = pipeline.write([{ name: 'S', headers: ['a'], rows: [['1']] }])
    const parsePromise = pipeline.parse(makeCsvFile('名称\nA'))

    const worker = FakeWorker.instances[0]!
    expect(worker.posted.map((it) => it.kind)).toEqual(['write', 'parse'])

    const blob = new Blob(['x'])
    worker.replyParseOk(worker.posted[1]!.id, MATRIX)
    worker.replyWriteOk(worker.posted[0]!.id, blob)

    expect(await parsePromise).toEqual(MATRIX)
    expect(await writePromise).toBe(blob)
  })

  it('progress 按 id 分流，不 resolve；与 ok 混流也不串', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const firstReports: number[] = []
    const secondReports: number[] = []
    const first = pipeline.parse(makeCsvFile('a'), (percent) => firstReports.push(percent))
    const second = pipeline.parse(makeCsvFile('b'), (percent) => secondReports.push(percent))
    const worker = FakeWorker.instances[0]!

    worker.reply({ id: 1, type: 'progress', percent: 20, message: '解析中' })
    worker.reply({ id: 2, type: 'progress', percent: 50, message: '另一个' })
    worker.reply({ id: 1, type: 'progress', percent: 30, message: '又一条' })
    worker.replyParseOk(1, MATRIX)
    worker.replyParseOk(2, MATRIX)

    await first
    await second
    // 去掉 parse/write 开头那帧「正在准备...」(0)
    expect(firstReports.filter((p) => p > 0)).toEqual([20, 30])
    expect(secondReports.filter((p) => p > 0)).toEqual([50])
  })

  it('未知 id 的回包被安全忽略，不炸不 resolve', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const pending = pipeline.parse(makeCsvFile('a'))
    const worker = FakeWorker.instances[0]!
    worker.reply({ id: 999, type: 'error', message: '乱入' })
    worker.replyParseOk(1, MATRIX)
    expect(await pending).toEqual(MATRIX)
  })

  it('重复 ok 回包：第二次被忽略（不会二次 resolve）', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const pending = pipeline.parse(makeCsvFile('a'))
    const worker = FakeWorker.instances[0]!
    worker.replyParseOk(1, MATRIX)
    await pending
    expect(() => worker.replyParseOk(1, MATRIX)).not.toThrow()
  })

  it('error 回包转成 Error 抛出', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const pending = pipeline.parse(makeCsvFile('a,b\n1,2'))
    const worker = FakeWorker.instances[0]!
    worker.reply({ id: 1, type: 'error', message: '文件为空或无法读取。' })
    await expect(pending).rejects.toThrow('文件为空或无法读取。')
  })

  it('postMessage 抛错时条目被清理（不会留下僵尸 pending）', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    FakeWorker.throwOnNextPost = true
    await expect(pipeline.parse(makeCsvFile('a'))).rejects.toThrow('DataCloneError')
    const worker = FakeWorker.instances[0]!

    // 若 throw 时没清理条目，pending 里会留下一个永不 resolve 的僵尸，
    // 于是这次 abort 之后 pending.size 不为 0，worker 永远不会被 terminate。
    const controller = new AbortController()
    const aborted = pipeline.parse(makeCsvFile('b'), undefined, controller.signal)
    controller.abort()
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker.terminated).toBe(true)
  })
})

describe('filePipelineClient · 降级路径（计划 4.6）', () => {
  it('环境没有 Worker 实现时退回主线程，parse 产物与直接调用一致', async () => {
    const { parseTemplateMatrix } = await import('../templateMatrix')
    const pipeline = createFilePipeline()
    const file = makeCsvFile('名称,经度,纬度\nA,116.4,39.9\nB,121.5,31.2')
    const matrix = await pipeline.parse(file)

    expect(pipeline.degraded()).toBe(true)
    const direct = await parseTemplateMatrix(file)
    expect(matrix.fileHeaders).toEqual(direct.fileHeaders)
    expect(matrix.rawData).toHaveLength(direct.rawData.length)
  })

  it('降级 write 的产物是合法 xlsx（表名/值可读回），且与 exceljsCore 逐格一致', async () => {
    const sheets = [
      {
        name: '点',
        headers: ['名称', '经度'],
        rows: [
          ['A', '116.4'],
          ['B', '121.5'],
        ],
      },
    ]
    const pipeline = createFilePipeline()
    const blob = await pipeline.write(sheets)
    expect(pipeline.degraded()).toBe(true)

    const readBack = async (target: Blob) =>
      XLSX.utils.sheet_to_json(
        XLSX.read(await target.arrayBuffer(), { type: 'array' }).Sheets['点']!,
        { header: 1, raw: false, defval: '' },
      )

    expect(await readBack(blob)).toEqual([
      ['名称', '经度'],
      ['A', '116.4'],
      ['B', '121.5'],
    ])
    // 降级不该变味：与直接调 core 的产物完全一致
    expect(await readBack(blob)).toEqual(await readBack(await writeXlsxBlob(sheets)))
  })

  it('构造抛错时永久降级，之后仍可用', async () => {
    class ThrowingWorker {
      constructor() {
        throw new Error('CSP 禁止 Worker')
      }
      postMessage() {}
      terminate() {}
    }
    const pipeline = createFilePipeline({ Worker: ThrowingWorker as unknown as WorkerCtor })
    const matrix = await pipeline.parse(makeCsvFile('名称\nA'))
    expect(pipeline.degraded()).toBe(true)
    expect(matrix.fileHeaders).toEqual(['名称'])
  })

  it('运行期 onerror（CSP / chunk 404）→ 降级**并重算在途请求**，用户侧不失败', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const pending = pipeline.parse(makeCsvFile('名称,经度,纬度\nA,116.4,39.9'))

    FakeWorker.instances[0]!.fail('CSP worker-src')
    const matrix = await pending
    expect(pipeline.degraded()).toBe(true)
    expect(matrix.fileHeaders).toEqual(['名称', '经度', '纬度'])
    expect(matrix.rawData).toHaveLength(2)
  })

  it('运行期 onerror 且多个在途：全部转主线程重算（含 write）', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const first = pipeline.parse(makeCsvFile('名称\nA'))
    const second = pipeline.write([{ name: 'S', headers: ['a'], rows: [['1']] }])
    FakeWorker.instances[0]!.fail()

    expect((await first).fileHeaders).toEqual(['名称'])
    const blob = await second
    const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
    expect(wb.SheetNames).toEqual(['S'])
  })
})

describe('filePipelineClient · 取消（计划 4.7）', () => {
  it('abort 后 in-flight 以 AbortError 拒绝，且 terminate worker', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const controller = new AbortController()
    const pending = pipeline.parse(makeCsvFile('名称\nA'), undefined, controller.signal)

    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(FakeWorker.instances).toHaveLength(0)
  })

  it('并发中只 abort 一个：另一个照常完成，worker 不被误杀', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const controller = new AbortController()
    const keep = pipeline.parse(makeCsvFile('名称\nA'))
    const drop = pipeline.parse(makeCsvFile('名称\nB'), undefined, controller.signal)

    controller.abort()
    await expect(drop).rejects.toMatchObject({ name: 'AbortError' })

    FakeWorker.instances[0]!.replyParseOk(1, MATRIX)
    expect(await keep).toEqual(MATRIX)
    expect(FakeWorker.instances).toHaveLength(1)
  })

  it('正常 settle 后再 abort：不影响已完成的请求', async () => {
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const controller = new AbortController()
    const pending = pipeline.parse(makeCsvFile('名称\nA'), undefined, controller.signal)
    FakeWorker.instances[0]!.replyParseOk(1, MATRIX)
    controller.abort()
    expect(await pending).toEqual(MATRIX)
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

describe('filePipelineClient · 空闲释放', () => {
  it('空闲 60s 后 terminate（不是降级：下次请求会重建 worker）', async () => {
    vi.useFakeTimers()
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const pending = pipeline.parse(makeCsvFile('名称\nA'))
    const worker = FakeWorker.instances[0]!
    worker.replyParseOk(1, MATRIX)
    await pending
    expect(FakeWorker.instances).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(59_000)
    expect(worker.terminated).toBe(false)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(worker.terminated).toBe(true)
    expect(pipeline.degraded()).toBe(false)

    // 重建：再发一次请求会得到新的 worker 实例
    void pipeline.parse(makeCsvFile('名称\nB'))
    expect(FakeWorker.instances).toHaveLength(1)
    vi.useRealTimers()
  })

  it('空闲倒计时期间来了新请求：旧计时器被取消，worker 不被误杀', async () => {
    vi.useFakeTimers()
    const pipeline = createFilePipeline({ Worker: workerCtor() })
    const first = pipeline.parse(makeCsvFile('名称\nA'))
    const worker = FakeWorker.instances[0]!
    worker.replyParseOk(1, MATRIX)
    await first

    await vi.advanceTimersByTimeAsync(30_000)
    const second = pipeline.parse(makeCsvFile('名称\nB'))
    await vi.advanceTimersByTimeAsync(40_000)

    // 第二个请求还在途（未回包），不能因为空闲而 terminate
    expect(worker.terminated).toBe(false)
    worker.replyParseOk(2, MATRIX)
    await second
    vi.useRealTimers()
  })
})

describe('filePipelineClient · 降级路径的进度', () => {
  it('降级 parse 的进度回调单调、首帧 0（100 由调用方的校验阶段上报）', async () => {
    const reports: number[] = []
    const pipeline = createFilePipeline()
    await pipeline.parse(makeCsvFile('名称,经度,纬度\nA,116.4,39.9'), (percent) =>
      reports.push(percent),
    )
    expect(reports[0]).toBe(0)
    expect(reports.length).toBeGreaterThan(1)
    for (let i = 1; i < reports.length; i++) {
      expect(reports[i]!).toBeGreaterThanOrEqual(reports[i - 1]!)
    }
  })
})

describe('worker 产物与主线程产物一致（证明降级不是“另一种結果”）', () => {
  it('降级 parse 的矩阵与直接调 parseTemplateMatrix 值相同', async () => {
    const { parseTemplateMatrix } = await import('../templateMatrix')
    const rows = Array.from({ length: 3000 }, (_, i) => `点${i},116.4,39.9`)
    const file = makeCsvFile(['名称,经度,纬度', ...rows].join('\n'))

    const pipeline = createFilePipeline()
    const viaPipeline = await pipeline.parse(file)
    const direct = await parseTemplateMatrix(file)

    expect(viaPipeline.fileHeaders).toEqual(direct.fileHeaders)
    expect(viaPipeline.rawData).toHaveLength(direct.rawData.length)
    expect(viaPipeline.rawData[viaPipeline.rawData.length - 1]).toEqual(
      direct.rawData[direct.rawData.length - 1],
    )
  })
})
