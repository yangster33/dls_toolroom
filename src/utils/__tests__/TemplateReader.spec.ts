import { describe, it, expect, vi, afterEach } from 'vitest'
import * as XLSX from 'xlsx'
import { readAndValidateTemplate, readTemplate } from '../TemplateReader'

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

afterEach(() => {
  vi.restoreAllMocks()
})

function makeCsvFile(content: string, name = '模板.csv'): File {
  return new File(['\uFEFF' + content], name, { type: 'text/csv' })
}

function makeXlsxFile(rows: (string | number | null)[][], sheetName = 'Sheet1'): File {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new File([out], '模板.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('readAndValidateTemplate', () => {
  const headers = ['名称', '经度', '纬度']

  it('CSV 合法数据校验通过（字段顺序不要求一致）', async () => {
    const file = makeCsvFile('纬度,经度,名称\n39.9,116.4,站点A\n31.2,121.5,站点B')
    const result = await readAndValidateTemplate(file, headers)
    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.dataRows).toEqual([
      { 名称: '站点A', 经度: 116.4, 纬度: 39.9 },
      { 名称: '站点B', 经度: 121.5, 纬度: 31.2 },
    ])
  })

  it('XLSX 合法数据校验通过', async () => {
    const file = makeXlsxFile([
      ['名称', '经度', '纬度'],
      ['站点A', 116.4, 39.9],
    ])
    const result = await readAndValidateTemplate(file, headers)
    expect(result.isValid).toBe(true)
    expect(result.dataRows).toEqual([{ 名称: '站点A', 经度: 116.4, 纬度: 39.9 }])
  })

  it('缺失必需字段时校验失败', async () => {
    const file = makeCsvFile('名称,经度\n站点A,116.4')
    const result = await readAndValidateTemplate(file, headers)
    expect(result.isValid).toBe(false)
    expect(result.errors).toEqual(['缺少必要的字段：纬度'])
    expect(result.dataRows).toEqual([])
  })

  it('多余字段被忽略', async () => {
    const file = makeCsvFile('名称,经度,纬度,备注\n站点A,116.4,39.9,额外')
    const result = await readAndValidateTemplate(file, headers)
    expect(result.isValid).toBe(true)
    expect(result.dataRows).toEqual([{ 名称: '站点A', 经度: 116.4, 纬度: 39.9 }])
  })

  it('空文件校验失败（缺失全部字段）', async () => {
    const file = makeCsvFile('')
    const result = await readAndValidateTemplate(file, headers)
    expect(result.isValid).toBe(false)
    expect(result.errors[0]).toBe('缺少必要的字段：名称、经度、纬度')
  })

  it('仅表头无数据行时视为合法但无数据', async () => {
    const file = makeCsvFile('名称,经度,纬度')
    const result = await readAndValidateTemplate(file, headers)
    expect(result.isValid).toBe(true)
    expect(result.dataRows).toEqual([])
  })

  it('默认跳过空行', async () => {
    const file = makeCsvFile('名称,经度,纬度\n站点A,116.4,39.9\n,,\n站点B,121.5,31.2')
    const result = await readAndValidateTemplate(file, headers)
    expect(result.isValid).toBe(true)
    expect(result.dataRows).toHaveLength(2)
  })

  it('skipEmptyRows=false 时空行保留为 undefined 值行', async () => {
    const file = makeCsvFile('名称,经度,纬度\n站点A,116.4,39.9\n,,\n')
    const result = await readAndValidateTemplate(file, headers, { skipEmptyRows: false })
    expect(result.dataRows).toHaveLength(2)
    expect(result.dataRows[1]).toEqual({ 名称: undefined, 经度: undefined, 纬度: undefined })
  })

  it('自定义校验失败时记录行号并排除该行', async () => {
    const file = makeCsvFile('名称,经度,纬度\n站点A,116.4,39.9\n坏行,abc,def')
    const result = await readAndValidateTemplate(file, headers, {
      validateRow: (row) => {
        if (typeof row['经度'] !== 'number') return ['经度必须是数字']
        return []
      },
    })
    expect(result.isValid).toBe(false)
    expect(result.errors).toEqual(['第 3 行：经度必须是数字'])
    expect(result.dataRows).toHaveLength(1)
  })

  it('空单元格映射为 undefined', async () => {
    const file = makeCsvFile('名称,经度,纬度\n,116.4,39.9')
    const result = await readAndValidateTemplate(file, headers)
    expect(result.isValid).toBe(true)
    expect(result.dataRows).toEqual([{ 名称: undefined, 经度: 116.4, 纬度: 39.9 }])
  })

  it('表头含前后空格时按 trim 后匹配', async () => {
    const file = makeCsvFile(' 名称 ,经度 ,纬度\n站点A,116.4,39.9')
    const result = await readAndValidateTemplate(file, headers)
    expect(result.isValid).toBe(true)
    expect(result.dataRows[0]).toEqual({ 名称: '站点A', 经度: 116.4, 纬度: 39.9 })
  })

  it('无法解析的文件报读取错误', async () => {
    const file = new File([new Uint8Array([0xff, 0xfe, 0x00, 0x01])], 'bad.bin')
    const result = await readAndValidateTemplate(file, headers)
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('readTemplate', () => {
  it('读取表头与数据行', async () => {
    const file = makeCsvFile('名称,经度\n站点A,116.4\n,')
    const result = await readTemplate(file)
    expect(result.headers).toEqual(['名称', '经度'])
    expect(result.dataRows).toEqual([{ 名称: '站点A', 经度: 116.4 }])
    expect(result.rawData.length).toBe(3)
  })

  it('空文件返回空数据行（不抛异常）', async () => {
    const file = makeCsvFile('')
    const result = await readTemplate(file)
    expect(result.dataRows).toEqual([])
  })

  it('readTemplate 支持 onProgress（末次为 100）', async () => {
    const reports: number[] = []
    const result = await readTemplate(makeCsvFile('名称,经度\n站点A,116.4'), (percent) =>
      reports.push(percent),
    )
    expect(result.dataRows).toHaveLength(1)
    expect(reports[reports.length - 1]).toBe(100)
  })
})

describe('C4 阶段 2：读表进度与分片让出', () => {
  const headers = ['名称', '经度', '纬度']

  function bigCsv(rows: number): File {
    const body = Array.from({ length: rows }, (_, i) => `站点${i},116.4,39.9`).join('\n')
    return makeCsvFile(`名称,经度,纬度\n${body}`)
  }

  it('onProgress 上报 0→100，整数、单调不减', async () => {
    const reports: number[] = []
    const result = await readAndValidateTemplate(bigCsv(1200), headers, {
      onProgress: (percent) => reports.push(percent),
    })

    expect(result.isValid).toBe(true)
    expect(result.dataRows).toHaveLength(1200)
    expect(reports[0]).toBe(0)
    expect(reports[reports.length - 1]).toBe(100)
    for (let i = 1; i < reports.length; i++) {
      expect(reports[i]!).toBeGreaterThanOrEqual(reports[i - 1]!)
    }
    for (const p of reports) {
      expect(Number.isInteger(p)).toBe(true)
    }
  })

  it('1200 行至少 yield 3 次（控制权真的交还事件循环）', async () => {
    const counter = countYields()
    try {
      await readAndValidateTemplate(bigCsv(1200), headers)
    } finally {
      counter.restore()
    }
    // 让出粒度 500 行：index 0 / 500 / 1000
    expect(counter.getCount()).toBeGreaterThanOrEqual(3)
  })

  it('全部行校验失败时仍让出（让出在循环开头，不会被 continue 吞掉）', async () => {
    const counter = countYields()
    try {
      await readAndValidateTemplate(bigCsv(1200), headers, {
        validateRow: () => ['永远失败'],
      })
    } finally {
      counter.restore()
    }
    // 反证点：若让出写在循环结尾，1200 行全部 continue → 一次都不让出，断言变红
    expect(counter.getCount()).toBeGreaterThanOrEqual(3)
  })

  it('不传 onProgress 时行为与改造前一致', async () => {
    const result = await readAndValidateTemplate(bigCsv(10), headers)
    expect(result.isValid).toBe(true)
    expect(result.dataRows).toHaveLength(10)
  })
})
