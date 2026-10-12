import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as XLSX from 'xlsx'
import {
  generateCsv,
  generateXlsx,
  exportTemplate,
  exportData,
  exportTable,
  downloadCsvTemplate,
  downloadXlsxTemplate,
} from '../TemplateExporter'
import { logger } from '../logger'

let anchors: HTMLAnchorElement[] = []
let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>

beforeEach(() => {
  anchors = []
  createObjectURL = vi.fn(() => 'blob:mock')
  revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', {
    value: createObjectURL,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: revokeObjectURL,
    writable: true,
    configurable: true,
  })
  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'a') return originalCreateElement(tag)
    const anchor = originalCreateElement('a')
    vi.spyOn(anchor, 'click').mockImplementation(() => {})
    anchors.push(anchor)
    return anchor
  })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/**
 * C4 阶段 2：generateXlsx / export* 改为 async，内部用 `await yieldToUI()`（即 setTimeout 0）
 * 分片让出。这在 fake timers 下不会自己跑完，必须推进定时器才能 resolve ——
 * 这个 helper 交替推进虚拟时间与 microtask，直到 Promise settle。
 *
 * 用 `Promise.race` 探测是否 settle，而不是「在 .then 里改局部变量再轮询」——
 * 后者会被 TS 控制流分析判定为恒定值而报 TS2367。
 * 每步只推进 1ms：不会误触动 100ms 的下载清理定时器，避免断言变假绿。
 */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const outcome = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  )
  for (let i = 0; i < 2000; i++) {
    const winner = await Promise.race([outcome, vi.advanceTimersByTimeAsync(1).then(() => null)])
    if (winner) {
      if (!winner.ok) throw winner.error
      return winner.value
    }
  }
  throw new Error('Promise 未在推进 2000ms 后 settle（可能是 yield 未接上定时器）')
}

/** 统计一次调用期间的「让出主线程」次数（yieldToUI 走 setTimeout(fn, 0)） */
function countYields() {
  const realSetTimeout = globalThis.setTimeout.bind(globalThis)
  let zeroDelayCalls = 0
  const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    fn: () => void,
    ms?: number,
  ) => {
    if (ms === 0) zeroDelayCalls++
    return realSetTimeout(fn, ms)
  }) as unknown as typeof setTimeout)
  return { getCount: () => zeroDelayCalls, restore: () => spy.mockRestore() }
}

describe('generateCsv', () => {
  it('空表头返回空字符串', () => {
    expect(generateCsv([])).toBe('')
    expect(generateCsv([] as string[])).toBe('')
  })

  it('仅表头时生成带 BOM 的单行', () => {
    const csv = generateCsv(['名称', '经度'])
    expect(csv).toBe('\uFEFF名称,经度')
  })

  it('输出含数据行', () => {
    const csv = generateCsv(['名称', '经度'], [['甲', '116.4']])
    expect(csv).toBe('\uFEFF名称,经度\n甲,116.4')
  })

  it('首字符为 UTF-8 BOM', () => {
    expect(generateCsv(['a']).charCodeAt(0)).toBe(0xfeff)
  })

  it('含逗号的字段加引号', () => {
    const csv = generateCsv(['名称'], [['甲,乙']])
    expect(csv).toBe('\uFEFF名称\n"甲,乙"')
  })

  it('含引号的字段转义为双引号', () => {
    const csv = generateCsv(['备注'], [['他说 "你好"']])
    expect(csv).toBe('\uFEFF备注\n"他说 ""你好"""')
  })

  it('含换行的字段加引号', () => {
    const csv = generateCsv(['备注'], [['第一行\n第二行']])
    expect(csv).toBe('\uFEFF备注\n"第一行\n第二行"')
  })

  it('空数据行数组时仅输出表头', () => {
    expect(generateCsv(['a', 'b'], [])).toBe('\uFEFFa,b')
  })
})

describe('generateXlsx', () => {
  it('空表头返回空 Blob', async () => {
    const blob = await settle(generateXlsx([]))
    expect(blob.type).toBe('application/octet-stream')
    expect(blob.size).toBe(0)
  })

  it('生成含表头、数据、列宽与边框的工作表', async () => {
    const blob = await settle(generateXlsx(['名称', '经度'], [['甲', '116.4']], '模板表'))
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array', cellStyles: true })
    expect(wb.SheetNames).toEqual(['模板表'])
    const ws = wb.Sheets['模板表']!
    expect(XLSX.utils.sheet_to_json(ws, { header: 1 })).toEqual([
      ['名称', '经度'],
      ['甲', '116.4'],
    ])
    expect(ws['!cols']![0]!.wch).toBeGreaterThanOrEqual(10)
  })

  it('默认工作表名为 Sheet1', async () => {
    const blob = await settle(generateXlsx(['a']))
    const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
    expect(wb.SheetNames).toEqual(['Sheet1'])
  })
})

describe('C4 阶段 2：generateXlsx 真的让出主线程并上报进度', () => {
  it('不推进定时器就不会 resolve（证明循环内真的 yield 了）', async () => {
    let settled = false
    const pending = generateXlsx(['名称'], [['甲']]).then((blob) => {
      settled = true
      return blob
    })
    // 冲掉微任务：若实现是同步的（无 await），此刻早已 resolve
    await Promise.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)

    const blob = await settle(pending)
    expect(blob).toBeInstanceOf(Blob)
  })

  it('大表按批 yield：5000 行至少让出 3 次', async () => {
    const rows = Array.from({ length: 5000 }, (_, i) => [`点${i}`, '116.4'])
    const counter = countYields()
    try {
      await settle(generateXlsx(['名称', '经度'], rows, 'S'))
    } finally {
      counter.restore()
    }
    // 起点 1 次 + 边框分片（10001 单元格 / 5000）2 次 + XLSX.write 前 1 次
    expect(counter.getCount()).toBeGreaterThanOrEqual(3)
  })

  it('onProgress 上报 0→100，1% 粒度、整数、单调不减', async () => {
    const rows = Array.from({ length: 5000 }, (_, i) => [`点${i}`, '116.4'])
    const reports: number[] = []
    await settle(generateXlsx(['名称', '经度'], rows, 'S', (percent) => reports.push(percent)))

    expect(reports.length).toBeGreaterThan(2)
    expect(reports[0]).toBe(0)
    expect(reports[reports.length - 1]).toBe(100)
    for (let i = 1; i < reports.length; i++) {
      expect(reports[i]!).toBeGreaterThanOrEqual(reports[i - 1]!)
    }
    for (const p of reports) {
      expect(Number.isInteger(p)).toBe(true)
    }
  })
})

describe('exportTemplate / exportData / exportTable', () => {
  it('空表头时警告且不触发下载', async () => {
    const warn = vi.spyOn(logger, 'warn')
    await settle(exportTemplate([], 'csv'))
    expect(warn).toHaveBeenCalled()
    expect(anchors).toHaveLength(0)
  })

  it('exportData 空表头时警告', async () => {
    const warn = vi.spyOn(logger, 'warn')
    await settle(exportData([], [], 'csv'))
    expect(warn).toHaveBeenCalled()
  })

  it('csv 导出：字符串内容、自动补扩展名、触发下载并清理', async () => {
    await settle(exportTemplate(['名称', '经度'], 'csv', '点位模板'))
    expect(anchors).toHaveLength(1)
    const anchor = anchors[0]!
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0]![0] as Blob
    expect(blob.type).toBe('text/csv;charset=utf-8;')
    expect(anchor.href).toBe('blob:mock')
    expect(anchor.getAttribute('download')).toBe('点位模板.csv')
    vi.advanceTimersByTime(200)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('xlsx 导出：Blob 内容、补 .xlsx 扩展名', async () => {
    await settle(exportTemplate(['名称'], 'xlsx', '点位模板'))
    const anchor = anchors[0]!
    const blob = createObjectURL.mock.calls[0]![0] as Blob
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(anchor.getAttribute('download')).toBe('点位模板.xlsx')
  })

  it('xlsx 导出：onProgress 透传到 generateXlsx', async () => {
    const reports: number[] = []
    await settle(exportTemplate(['名称'], 'xlsx', '点位模板', (percent) => reports.push(percent)))
    expect(reports.length).toBeGreaterThan(0)
    expect(reports[reports.length - 1]).toBe(100)
  })

  it('文件名已含扩展名时不重复追加', async () => {
    await settle(exportTemplate(['a'], 'csv', 'a.csv'))
    expect(anchors[0]!.getAttribute('download')).toBe('a.csv')
  })

  it('exportData 导出带数据的 csv', async () => {
    await settle(exportData(['名称'], [['甲']], 'csv', '数据导出'))
    expect(anchors[0]!.getAttribute('download')).toBe('数据导出.csv')
  })

  it('exportData 导出带数据的 xlsx', async () => {
    await settle(exportData(['名称'], [['甲']], 'xlsx', '数据导出'))
    expect(anchors[0]!.getAttribute('download')).toBe('数据导出.xlsx')
  })

  it('exportTable 委托 exportTemplate', async () => {
    await settle(exportTable(['a'], 'csv', '旧接口'))
    expect(anchors[0]!.getAttribute('download')).toBe('旧接口.csv')
  })

  it('导出失败时记录 error 且不触发下载', async () => {
    const error = vi.spyOn(logger, 'error')
    createObjectURL.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    await settle(exportData(['a'], [['b']], 'xlsx'))
    expect(error).toHaveBeenCalled()
    expect(anchors).toHaveLength(0)
  })
})

describe('downloadCsvTemplate / downloadXlsxTemplate', () => {
  it('下载 CSV 模板（含示例行）', () => {
    downloadCsvTemplate()
    const blob = createObjectURL.mock.calls[0]![0] as Blob
    expect(blob.type).toBe('text/csv;charset=utf-8;')
    expect(anchors[0]!.getAttribute('download')).toBe('点位导入模板.csv')
  })

  it('下载 XLSX 模板', async () => {
    await settle(downloadXlsxTemplate())
    const blob = createObjectURL.mock.calls[0]![0] as Blob
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(anchors[0]!.getAttribute('download')).toBe('点位导入模板.xlsx')
  })
})

describe('大数据量导出不触发 RangeError（审计 P2-19 / B1）', () => {
  // 超过引擎参数展开上限（约 10^5），旧实现 rows.push(...dataRows) 必抛
  const ROWS = 200_000
  const headers = ['名称', '经度', '纬度']
  const dataRows: string[][] = Array.from({ length: ROWS }, (_, i) => [`点${i}`, '116.4', '39.9'])

  it('generateCsv：20 万行不抛 RangeError，行数与输入一致', () => {
    let csv = ''
    expect(() => {
      csv = generateCsv(headers, dataRows)
    }).not.toThrow()

    const lines = csv.replace(/^\uFEFF/, '').split('\n')
    expect(lines).toHaveLength(ROWS + 1) // 1 表头 + 20 万数据行
    expect(lines[0]).toBe(headers.join(','))
    expect(lines[ROWS]).toContain('39.9')
  })

  it('generateXlsx：大行数可构造并写出，不抛 RangeError', async () => {
    // 说明：这里的 [headers, ...dataRows] 是「数组字面量展开」，走迭代器协议，
    // 不受调用栈限制，本就不是 P2-19 的崩溃点（改为 concat 仅为语义统一）。
    // XLSX 写出 20 万行成本极高，故仅用 5 千行做链路冒烟。
    const rows = Array.from({ length: 5_000 }, (_, i) => [`点${i}`, '116.4', '39.9'])
    const blob = await settle(generateXlsx(headers, rows, 'S'))
    expect(blob).toBeInstanceOf(Blob)
  })

  it('exportData：20 万行走完整导出链路（mock 下载）不抛错', async () => {
    await settle(exportData(headers, dataRows, 'csv'))
    expect(createObjectURL).toHaveBeenCalled()
  })
})
