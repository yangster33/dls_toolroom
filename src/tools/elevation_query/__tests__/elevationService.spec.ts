import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ElevationService } from '../elevationService'

/**
 * 审计报告 P0-6 的回归测试
 *
 * 三条独立失效路径：
 * 1. 单 URL 拼全部点位 → 超长 URL 返 400，整个请求抛错
 * 2. 任一批失败 → 消费方只弹窗，前几批的部分结果仍可下载
 * 3. `data.elevation[index] ?? 0` → 接口少返一条变成"海平面 0 米"
 */

const point = (lng: number, lat: number) => ({ longitude: lng, latitude: lat })

/** 构造一个 200 条点位的数组，覆盖 3 个批次 */
function makePoints(count: number) {
  return Array.from({ length: count }, (_, i) => point(116 + i * 0.001, 39 + i * 0.001))
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function okResponse(elevations: number[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ elevation: elevations }),
  }
}

function failResponse(status = 400) {
  return { ok: false, status, json: async () => ({}) }
}

describe('getElevations - 分批（P0-6a）', () => {
  it('250 个点分成 3 批请求，每批不超过 100', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const n = new URL(url).searchParams.get('latitude')!.split(',').length
      expect(n).toBeLessThanOrEqual(100)
      return okResponse(Array.from({ length: n }, () => 42))
    })

    const results = await new ElevationService().getElevations(makePoints(250))

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(results).toHaveLength(250)
    expect(results.every((r) => r.elevation === 42)).toBe(true)
    expect(results.some((r) => r.error !== undefined)).toBe(false)
  })

  it('空数组不发请求', async () => {
    const results = await new ElevationService().getElevations([])
    expect(results).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('getElevations - 单批失败不影响其它批（P0-6b）', () => {
  it('第 2 批失败只标记该批，前 100 个点仍返回真实高程', async () => {
    let call = 0
    fetchMock.mockImplementation(async (url: string) => {
      const n = new URL(url).searchParams.get('latitude')!.split(',').length
      call++
      // 第二批（call === 2）失败
      if (call === 2) return failResponse(500)
      return okResponse(Array.from({ length: n }, () => 10))
    })

    const results = await new ElevationService().getElevations(makePoints(250))

    // 不再抛错
    expect(results).toHaveLength(250)
    // 前 100 个成功
    expect(results.slice(0, 100).every((r) => r.elevation === 10)).toBe(true)
    expect(results.slice(0, 100).every((r) => r.error === undefined)).toBe(true)
    // 第二批 100 个标记失败
    expect(results.slice(100, 200).every((r) => r.error !== undefined)).toBe(true)
    expect(results.slice(100, 200).every((r) => Number.isNaN(r.elevation))).toBe(true)
    // 其余成功
    expect(results.slice(200).every((r) => r.elevation === 10)).toBe(true)
  })

  it('网络抛错（非 HTTP 错误）也只影响该批', async () => {
    let call = 0
    fetchMock.mockImplementation(async (url: string) => {
      const n = new URL(url).searchParams.get('latitude')!.split(',').length
      call++
      if (call === 1) throw new Error('network down')
      return okResponse(Array.from({ length: n }, () => 7))
    })

    const results = await new ElevationService().getElevations(makePoints(150))

    expect(results).toHaveLength(150)
    expect(results.slice(0, 100).every((r) => r.error !== undefined)).toBe(true)
    expect(results.slice(100).every((r) => r.elevation === 7)).toBe(true)
  })
})

describe('getElevations - 缺失高程不再变成 0 米（P0-6c）', () => {
  it('接口少返一条 → 该点是 NaN + error，不是 0', async () => {
    // 请求 3 个点，但只返回 2 条高程
    fetchMock.mockImplementation(async () => okResponse([10, 20]))

    const results = await new ElevationService().getElevations([
      point(1, 2),
      point(3, 4),
      point(5, 6),
    ])

    expect(results).toHaveLength(3)
    expect(results[0]!.elevation).toBe(10)
    expect(results[0]!.error).toBeUndefined()
    expect(results[1]!.elevation).toBe(20)
    expect(results[2]!.elevation).toBe(Number.NaN)
    expect(results[2]!.error).toBeDefined()
    // 绝不能是 0 —— 0 是合法的海平面高程，无法与"缺失"区分
    expect(results[2]!.elevation).not.toBe(0)
  })

  it('接口返回非数值（null / "abc"）同样标记失败而非 0', async () => {
    fetchMock.mockImplementation(async () =>
      okResponse([5, null as unknown as number, 'abc' as unknown as number]),
    )

    const results = await new ElevationService().getElevations([
      point(1, 2),
      point(3, 4),
      point(5, 6),
    ])

    expect(results[0]!.elevation).toBe(5)
    expect(results[1]!.elevation).toBe(Number.NaN)
    expect(results[2]!.elevation).toBe(Number.NaN)
    expect(results[1]!.error).toBeDefined()
    expect(results[2]!.error).toBeDefined()
  })

  it('接口返回的 elevation 字段缺失/非数组 → 全部标记失败', async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({}) }))

    const results = await new ElevationService().getElevations([point(1, 2), point(3, 4)])

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.error !== undefined)).toBe(true)
    expect(results.every((r) => Number.isNaN(r.elevation))).toBe(true)
  })

  it('真实的 0 米高程（海平面）必须保留，不被当成失败', async () => {
    fetchMock.mockImplementation(async () => okResponse([0]))

    const results = await new ElevationService().getElevations([point(0, 0)])

    expect(results[0]!.elevation).toBe(0)
    expect(results[0]!.error).toBeUndefined()
  })
})

describe('getElevation - 单点查询（同样适用）', () => {
  it('接口未返回有效值时抛错，不返回 0', async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ elevation: [] }),
    }))

    await expect(new ElevationService().getElevation(116, 39)).rejects.toThrow('未获取到高程数据')
  })

  it('0 米是合法结果，正常返回', async () => {
    fetchMock.mockImplementation(async () => okResponse([0]))
    const r = await new ElevationService().getElevation(0, 0)
    expect(r.elevation).toBe(0)
  })

  it('HTTP 非 2xx 抛错', async () => {
    fetchMock.mockImplementation(async () => failResponse(503))
    await expect(new ElevationService().getElevation(116, 39)).rejects.toThrow('HTTP error')
  })
})
