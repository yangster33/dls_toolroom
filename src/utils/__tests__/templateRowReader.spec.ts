import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  readRows,
  readCoordinatePointRows,
  resolveAlias,
  resolveCoordinateByAliases,
  toValidationResult,
  type RawRow,
} from '../templateRowReader'
import { readAndValidateTemplate as readFullAddressTemplate } from '../../tools/get_lonlat/TemplateReader'
import { isAbortError } from '../abort'

/**
 * 「名称 + 经度 + 纬度」坐标点模板的共用读取器（D1 / 审计 P3-2、P3-4）。
 *
 * 用例来源：`get_add/__tests__/TemplateReader.spec.ts` 与
 * `elevations_batch/__tests__/TemplateReader.spec.ts` —— 这两个文件对应的
 * reader 实现**逐行相同**（P0-1 的空经纬度 bug 曾同时存在于两处，就是"同一
 * 逻辑复制 N 份"的代价）。D1 已把两份合成 `readCoordinatePointRows`，
 * 这里合并保留两边的回归用例，任何一边的语义回退都会当场变红。
 */

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

describe('readCoordinatePointRows - 空白单元格（P0-1 回归）', () => {
  it('经度留空 → 报错，不产生 (0, x) 的假坐标', async () => {
    const result = await readCoordinatePointRows([{ 名称: 'A', 经度: '', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
    expect(result.errors.join()).toContain('经度')
  })

  it('纬度留空 → 报错，不产生 (x, 0) 的假坐标', async () => {
    const result = await readCoordinatePointRows([{ 名称: 'A', 经度: '116.4', 纬度: '' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
    expect(result.errors.join()).toContain('纬度')
  })

  it('经纬度都留空 → 报经度错误（每行最多一个错，与收敛前一致）', async () => {
    const result = await readCoordinatePointRows([{ 名称: 'A', 经度: '', 纬度: '' }])

    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('经度')
  })

  it('纯空格等同于空 → 同样报错', async () => {
    const result = await readCoordinatePointRows([{ 名称: 'A', 经度: '   ', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
  })

  it('null 单元格 → 报错', async () => {
    const result = await readCoordinatePointRows([
      { 名称: 'A', 经度: null, 纬度: '39.9' } as unknown as RawRow,
    ])

    expect(result.isValid).toBe(false)
  })

  it('NaN 单元格 → 报错（Number.isFinite 防线）', async () => {
    const result = await readCoordinatePointRows([
      { 名称: 'A', 经度: NaN, 纬度: '39.9' } as unknown as RawRow,
    ])

    expect(result.isValid).toBe(false)
  })
})

describe('readCoordinatePointRows - 合法数据不受影响', () => {
  it('正常经纬度通过校验', async () => {
    const result = await readCoordinatePointRows([{ 名称: 'A', 经度: '116.4', 纬度: '39.9' }])

    expect(result.isValid).toBe(true)
    expect(result.data).toEqual([{ name: 'A', longitude: 116.4, latitude: 39.9 }])
  })

  it('数字类型的单元格同样通过', async () => {
    const result = await readCoordinatePointRows([{ 名称: 'A', 经度: 116.4, 纬度: 39.9 }])

    expect(result.isValid).toBe(true)
    expect(result.data[0]).toMatchObject({ longitude: 116.4, latitude: 39.9 })
  })

  it('0 度是合法坐标（赤道/本初子午线），必须保留', async () => {
    const result = await readCoordinatePointRows([{ 名称: 'A', 经度: '0', 纬度: '0' }])

    expect(result.isValid).toBe(true)
    expect(result.data[0]).toMatchObject({ longitude: 0, latitude: 0 })
  })

  it('多个别名（英文列名）都能识别', async () => {
    const result = await readCoordinatePointRows([{ name: 'A', lon: '116.4', lat: '39.9' }])

    expect(result.isValid).toBe(true)
    expect(result.data[0]).toMatchObject({ name: 'A', longitude: 116.4, latitude: 39.9 })
  })

  it('中文别名为空时回退到英文别名取值（收敛前的行为）', async () => {
    // 旧实现是「第一个能解析成功的别名」：中文列为空串不算解析成功，继续找英文列。
    const result = await readCoordinatePointRows([
      { 名称: 'A', 经度: '', lon: '116.4', 纬度: '   ', lat: '39.9' },
    ])

    expect(result.isValid).toBe(true)
    expect(result.data[0]).toMatchObject({ longitude: 116.4, latitude: 39.9 })
  })
})

describe('readCoordinatePointRows - 脏数据（P1-9）', () => {
  it('"116.4abc" 这类宽松前缀被拒绝，不被静默净化', async () => {
    const result = await readCoordinatePointRows([{ 名称: 'A', 经度: '116.4abc', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
  })

  it('超出范围的坐标被拒绝', async () => {
    const result = await readCoordinatePointRows([{ 名称: 'A', 经度: '190', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.errors.join()).toContain('经度')
  })

  it('名称为空 → 报名称错误', async () => {
    const result = await readCoordinatePointRows([{ 名称: '', 经度: '116.4', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.errors.join()).toContain('名称')
  })

  it('错误信息带行号（第 1 行 = 第一条数据）', async () => {
    const result = await readCoordinatePointRows([
      { 名称: 'A', 经度: '116.4', 纬度: '39.9' },
      { 名称: 'B', 经度: 'abc', 纬度: '39.9' },
    ])

    expect(result.errors).toEqual(['第 2 行：经度无效或超出范围 (-180 ~ 180)'])
  })
})

describe('readRows - 进度与让出（C4 阶段 2 / P2-20 契约）', () => {
  it('传入 onProgress 时回调被调用，percent 单调不减且末次为 100', async () => {
    const reports: number[] = []
    const messages: string[] = []

    await readRows(
      [
        { 名称: 'A', 经度: '116.4', 纬度: '39.9' },
        { 名称: 'B', 经度: '116.5', 纬度: '39.8' },
        { 名称: 'C', 经度: '116.6', 纬度: '39.7' },
      ],
      () => ({ records: [{ name: 'x', longitude: 0, latitude: 0 }] }),
      {
        onProgress: (percent, message) => {
          reports.push(percent)
          messages.push(message)
        },
      },
    )

    // 回调至少被调用一次，且进度为整数、单调不减、收尾到 100
    expect(reports.length).toBeGreaterThan(0)
    // 首帧为 0：拒绝「只在结尾补一次 100」的假实现
    expect(reports[0]).toBe(0)
    expect(reports[reports.length - 1]).toBe(100)
    for (let i = 1; i < reports.length; i++) {
      expect(reports[i]!).toBeGreaterThanOrEqual(reports[i - 1]!)
    }
    for (const p of reports) {
      expect(Number.isInteger(p)).toBe(true)
    }
    // 回调必须带上"正在做什么"的文案，不能被静默成空字符串
    expect(messages.every((m) => m.length > 0)).toBe(true)
    // message 与 percent 一一对应（不能只上报数字）
    expect(messages).toHaveLength(reports.length)
  })

  it('1200 行：跨过让出分片后仍能出现多个中间进度值', async () => {
    // 行数 ≥ 1200 以覆盖 ROW_YIELD_INTERVAL=500 的分片让出（i=0/500/1000）。
    const rows: RawRow[] = Array.from({ length: 1200 }, (_, i) => ({
      名称: `P${i}`,
      经度: String(116 + (i % 10) * 0.001),
      纬度: String(39 + (i % 10) * 0.001),
    }))

    const percents: number[] = []
    const messages: string[] = []
    const result = await readCoordinatePointRows(rows, (percent, message) => {
      percents.push(percent)
      messages.push(message)
    })

    expect(result.isValid).toBe(true)
    expect(result.data).toHaveLength(1200)

    // 首帧为 0：拒绝「只在结尾补一次 100」的假实现
    expect(percents[0]).toBe(0)

    // 分片粒度下必然出现多个中间值（1200 行 / 每 500 行一让出 → 至少 3 帧 + 末尾 100）
    const intermediate = percents.filter((p) => p > 0 && p < 100)
    expect(intermediate.length).toBeGreaterThanOrEqual(2)

    // 末次必为 100（校验完成）
    expect(percents[percents.length - 1]).toBe(100)
    expect(messages[messages.length - 1]).toBe('校验完成')
  })

  it('1200 行全部校验失败时仍至少 yield 2 次（让出在循环开头，continue 不会跳过它）', async () => {
    // 每一行都失败 → 每行都走 continue。若让出被放在循环**结尾**，
    // 这些 continue 会把让出整批跳过，用户看到进度条永久卡死。
    const failingRows: RawRow[] = Array.from({ length: 1200 }, () => ({ 名称: '' }))

    const counter = countYields()
    let result
    try {
      result = await readCoordinatePointRows(failingRows)
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

  it('startRowNumber 把行号平移到源文件行（distance_sensor 传 2）', async () => {
    const reports: string[] = []
    await readRows([{ 名称: 'A' }, { 名称: 'B' }], () => ({ errors: ['x'] }), {
      startRowNumber: 2,
      onProgress: (_percent, message) => reports.push(message),
    })

    expect(reports).toEqual(['正在校验第 2 行...', '正在校验第 3 行...', '校验完成'])
  })

  it('空行（undefined 行）被跳过，不会调用 extractor', async () => {
    const seen: number[] = []
    const result = await readRows([undefined as unknown as RawRow, { 名称: 'A' }], (row) => {
      seen.push(1)
      return { records: [String(row['名称'])] }
    })

    expect(result.data).toEqual(['A'])
    expect(seen).toHaveLength(1)
  })
})

describe('readRows - 取消（C4 收尾）', () => {
  it('校验途中取消 → 抛 AbortError，且不伪装成"读取文件时发生错误"', async () => {
    const controller = new AbortController()
    // 第一行上报时就取消：让出间隙（i=500）会复查到并抛 AbortError
    const rows: RawRow[] = Array.from({ length: 1200 }, (_, i) => ({
      名称: `P${i}`,
      经度: String(116 + (i % 10) * 0.001),
      纬度: String(39 + (i % 10) * 0.001),
    }))

    await expect(
      readCoordinatePointRows(rows, () => controller.abort(), controller.signal),
    ).rejects.toSatisfy(isAbortError)
  })
})

describe('resolveAlias / resolveCoordinateByAliases', () => {
  it('名称取首个非空别名，空串不再向后找', () => {
    expect(resolveAlias({ 名称: ' 甲 ', name: '乙' }, ['名称', 'name', 'Name'])).toBe('甲')
    expect(resolveAlias({ 名称: '', name: '乙' }, ['名称', 'name', 'Name'])).toBe('')
    expect(resolveAlias({}, ['名称'])).toBe('')
  })

  it('坐标取第一个能解析成功的别名（含数值 0）', () => {
    expect(resolveCoordinateByAliases({ 经度: '0' }, ['经度', 'lon'], -180, 180)).toBe(0)
    expect(resolveCoordinateByAliases({ 经度: '', lon: '116.4' }, ['经度', 'lon'], -180, 180)).toBe(
      116.4,
    )
    expect(
      resolveCoordinateByAliases({ 经度: '121', lon: '116.4' }, ['经度', 'lon'], -180, 180),
    ).toBe(121)
    expect(
      resolveCoordinateByAliases({ 经度: 'abc', lon: '' }, ['经度', 'lon'], -180, 180),
    ).toBeNull()
  })
})

describe('toValidationResult', () => {
  it('无错误且有数据才算有效', () => {
    expect(toValidationResult({ data: [1, 2], errors: [] }).isValid).toBe(true)
    expect(toValidationResult({ data: [], errors: [] }).isValid).toBe(false)
    expect(toValidationResult({ data: [1], errors: ['x'] }).isValid).toBe(false)
  })
})

/**
 * get_lonlat（地址 → 坐标）的地址模板读取器。
 *
 * 这个工具原本**没有任何 reader 单测**（它的逻辑藏在 pages 里），
 * D1 把逻辑收敛到公共循环后，在这里补上契约：只强制「地址」字段。
 */
describe('readFullAddressTemplate（get_lonlat）', () => {
  it('只填地址即可通过，其余字段留空保持空串', async () => {
    const result = await readFullAddressTemplate([{ 地址: '北京市朝阳区xx路1号' }])

    expect(result.isValid).toBe(true)
    expect(result.data).toEqual([
      {
        province: '',
        city: '',
        district: '',
        township: '',
        community: '',
        address: '北京市朝阳区xx路1号',
      },
    ])
  })

  it('地址为空 → 报「地址不能为空」，不产生数据', async () => {
    const result = await readFullAddressTemplate([{ 省: '广东', 市: '广州' }])

    expect(result.isValid).toBe(false)
    expect(result.errors).toEqual(['第 1 行：地址不能为空'])
    expect(result.data).toHaveLength(0)
  })

  it('英文列名别名同样识别', async () => {
    const result = await readFullAddressTemplate([
      { province: '广东', city: '广州', district: '天河区', address: 'xx路1号' },
    ])

    expect(result.isValid).toBe(true)
    expect(result.data[0]).toMatchObject({ province: '广东', city: '广州', district: '天河区' })
  })

  it('错误信息带行号（第二条数据报第 2 行）', async () => {
    const result = await readFullAddressTemplate([{ address: 'xx路1号' }, { province: '广东' }])

    expect(result.errors).toEqual(['第 2 行：地址不能为空'])
    expect(result.data).toHaveLength(1)
  })
})
