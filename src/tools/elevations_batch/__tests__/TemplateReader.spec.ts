import { describe, it, expect, vi, afterEach } from 'vitest'
import { readAndValidateTemplate } from '../TemplateReader'

/**
 * 统计校验期间「让出主线程」的次数。
 * yieldToUI(ms=0) 走 setTimeout(resolve, 0)，所以 0ms 的 setTimeout 调用数
 * 就是控制权交还事件循环的次数。（与 geo_data/parseProgressYield.spec.ts 同法）
 */
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

/**
 * 审计报告 P0-1 的回归测试
 *
 * 历史 Bug：`Number('') === 0`，空白经纬度单元格被当作 (0, 0) —— 几内亚湾 ——
 * 并通过 [-180,180] / [-90,90] 范围校验，静默产出错误的高程/地址结果。
 *
 * 旁证这是漏洞而非设计：同一份文件用 XLSX 导入会正常报错
 * （sheet_to_json 不给空单元格建 key），而 CSV 导入静默出错。
 */
describe('readAndValidateTemplate - 空白单元格（P0-1 回归）', () => {
  it('经度留空 → 报错，不产生 (0, x) 的假坐标', async () => {
    const result = await readAndValidateTemplate([{ 名称: 'A', 经度: '', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
    expect(result.errors.join()).toContain('经度')
  })

  it('纬度留空 → 报错，不产生 (x, 0) 的假坐标', async () => {
    const result = await readAndValidateTemplate([{ 名称: 'A', 经度: '116.4', 纬度: '' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
    expect(result.errors.join()).toContain('纬度')
  })

  it('经纬度都留空 → 报经度错误', async () => {
    const result = await readAndValidateTemplate([{ 名称: 'A', 经度: '', 纬度: '' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
  })

  it('纯空格等同于空 → 同样报错', async () => {
    const result = await readAndValidateTemplate([{ 名称: 'A', 经度: '   ', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
  })

  it('null / undefined 单元格 → 报错', async () => {
    const result = await readAndValidateTemplate([
      { 名称: 'A', 经度: null, 纬度: '39.9' } as unknown as Record<string, string | number>,
    ])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
  })
})

describe('readAndValidateTemplate - 合法数据不受影响', () => {
  it('正常经纬度通过校验', async () => {
    const result = await readAndValidateTemplate([{ 名称: 'A', 经度: '116.4', 纬度: '39.9' }])

    expect(result.isValid).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({ name: 'A', longitude: 116.4, latitude: 39.9 })
  })

  it('数字类型的单元格同样通过', async () => {
    const result = await readAndValidateTemplate([{ 名称: 'A', 经度: 116.4, 纬度: 39.9 }])

    expect(result.isValid).toBe(true)
    expect(result.data[0]).toMatchObject({ longitude: 116.4, latitude: 39.9 })
  })

  it('0 度是合法坐标（赤道/本初子午线），必须保留', async () => {
    const result = await readAndValidateTemplate([{ 名称: 'A', 经度: '0', 纬度: '0' }])

    expect(result.isValid).toBe(true)
    expect(result.data[0]).toMatchObject({ longitude: 0, latitude: 0 })
  })

  it('多个别名（英文列名）都能识别', async () => {
    const result = await readAndValidateTemplate([{ name: 'A', lon: '116.4', lat: '39.9' }])

    expect(result.isValid).toBe(true)
    expect(result.data[0]).toMatchObject({ name: 'A', longitude: 116.4, latitude: 39.9 })
  })
})

describe('readAndValidateTemplate - 脏数据（P1-9 部分）', () => {
  it('"116.4abc" 这类宽松前缀被拒绝，不被静默净化', async () => {
    const result = await readAndValidateTemplate([{ 名称: 'A', 经度: '116.4abc', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
  })

  it('超出范围的坐标被拒绝', async () => {
    const result = await readAndValidateTemplate([{ 名称: 'A', 经度: '190', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.errors.join()).toContain('经度')
  })

  it('名称为空 → 报名称错误', async () => {
    const result = await readAndValidateTemplate([{ 名称: '', 经度: '116.4', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.errors.join()).toContain('名称')
  })
})

describe('readAndValidateTemplate - 进度回调（C4 阶段 2 / P2-20）', () => {
  it('传入 onProgress 时回调被调用，percent 单调不减且最终为 100', async () => {
    const reports: number[] = []
    const messages: string[] = []

    await readAndValidateTemplate(
      [
        { 名称: 'A', 经度: '116.4', 纬度: '39.9' },
        { 名称: 'B', 经度: '116.5', 纬度: '39.8' },
        { 名称: 'C', 经度: '116.6', 纬度: '39.7' },
      ],
      (percent, message) => {
        reports.push(percent)
        messages.push(message)
      },
    )

    // 回调至少被调用一次，且进度为整数、单调不减、收尾到 100
    expect(reports.length).toBeGreaterThan(0)
    expect(reports[reports.length - 1]).toBe(100)
    for (let i = 1; i < reports.length; i++) {
      expect(reports[i]!).toBeGreaterThanOrEqual(reports[i - 1]!)
    }
    for (const p of reports) {
      expect(Number.isInteger(p)).toBe(true)
    }
    // 回调必须带上"正在做什么"的文案，不能被静默成空字符串
    expect(messages.every((m) => m.length > 0)).toBe(true)
  })
})

describe('readAndValidateTemplate - 真让出主线程（C4 阶段 2 / P2-20）', () => {
  it('1200 行全部校验失败时仍至少 yield 2 次（让出在循环开头，continue 不会跳过它）', async () => {
    // 每一行名称都为空 → 每行都走 `continue`。若让出被放在循环**结尾**，
    // 这些 continue 会把让出整批跳过，用户看到进度条永久卡死。
    const failingRows = Array.from({ length: 1200 }, () => ({
      名称: '',
      经度: '116.4',
      纬度: '39.9',
    }))

    const counter = countYields()
    let result
    try {
      result = await readAndValidateTemplate(failingRows)
    } finally {
      counter.restore()
    }

    // 反证：让出粒度 = 每 500 行一次（index 0 / 500 / 1000 → 3 次）。
    // 旧写法（让出在结尾）下被 continue 跳过 → 计数为 0，此断言必红。
    expect(counter.getCount()).toBeGreaterThanOrEqual(2)
    // 全部失败：无有效数据，但有 1200 条错误
    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
    expect(result.errors).toHaveLength(1200)
  })
})
