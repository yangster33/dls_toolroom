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
  it('空表头返回空 Blob', () => {
    const blob = generateXlsx([])
    expect(blob.type).toBe('application/octet-stream')
    expect(blob.size).toBe(0)
  })

  it('生成含表头、数据、列宽与边框的工作表', async () => {
    const blob = generateXlsx(['名称', '经度'], [['甲', '116.4']], '模板表')
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
    const blob = generateXlsx(['a'])
    const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
    expect(wb.SheetNames).toEqual(['Sheet1'])
  })
})

describe('exportTemplate / exportData / exportTable', () => {
  it('空表头时警告且不触发下载', () => {
    const warn = vi.spyOn(logger, 'warn')
    exportTemplate([], 'csv')
    expect(warn).toHaveBeenCalled()
    expect(anchors).toHaveLength(0)
  })

  it('exportData 空表头时警告', () => {
    const warn = vi.spyOn(logger, 'warn')
    exportData([], [], 'csv')
    expect(warn).toHaveBeenCalled()
  })

  it('csv 导出：字符串内容、自动补扩展名、触发下载并清理', () => {
    exportTemplate(['名称', '经度'], 'csv', '点位模板')
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

  it('xlsx 导出：Blob 内容、补 .xlsx 扩展名', () => {
    exportTemplate(['名称'], 'xlsx', '点位模板')
    const anchor = anchors[0]!
    const blob = createObjectURL.mock.calls[0]![0] as Blob
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(anchor.getAttribute('download')).toBe('点位模板.xlsx')
  })

  it('文件名已含扩展名时不重复追加', () => {
    exportTemplate(['a'], 'csv', 'a.csv')
    expect(anchors[0]!.getAttribute('download')).toBe('a.csv')
  })

  it('exportData 导出带数据的 csv', () => {
    exportData(['名称'], [['甲']], 'csv', '数据导出')
    expect(anchors[0]!.getAttribute('download')).toBe('数据导出.csv')
  })

  it('exportData 导出带数据的 xlsx', () => {
    exportData(['名称'], [['甲']], 'xlsx', '数据导出')
    expect(anchors[0]!.getAttribute('download')).toBe('数据导出.xlsx')
  })

  it('exportTable 委托 exportTemplate', () => {
    exportTable(['a'], 'csv', '旧接口')
    expect(anchors[0]!.getAttribute('download')).toBe('旧接口.csv')
  })

  it('导出失败时记录 error 且不触发下载', () => {
    const error = vi.spyOn(logger, 'error')
    createObjectURL.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    exportData(['a'], [['b']], 'xlsx')
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

  it('下载 XLSX 模板', () => {
    downloadXlsxTemplate()
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

  it('generateXlsx：大行数可构造并写出，不抛 RangeError', () => {
    // 说明：这里的 [headers, ...dataRows] 是「数组字面量展开」，走迭代器协议，
    // 不受调用栈限制，本就不是 P2-19 的崩溃点（改为 concat 仅为语义统一）。
    // XLSX 写出 20 万行成本极高，故仅用 5 千行做链路冒烟。
    const rows = Array.from({ length: 5_000 }, (_, i) => [`点${i}`, '116.4', '39.9'])
    let blob: Blob | null = null
    expect(() => {
      blob = generateXlsx(headers, rows, 'S')
    }).not.toThrow()
    expect(blob).toBeInstanceOf(Blob)
  })

  it('exportData：20 万行走完整导出链路（mock 下载）不抛错', () => {
    expect(() => exportData(headers, dataRows, 'csv')).not.toThrow()
    expect(createObjectURL).toHaveBeenCalled()
  })
})
