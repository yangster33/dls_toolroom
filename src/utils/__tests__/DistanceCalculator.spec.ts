import { describe, it, expect, vi } from 'vitest'
import {
  toRad,
  haversineDistance,
  isValidCoordinate,
  matchDistances,
  DEFAULT_MATCH_CONFIG,
  PLANET_PRESETS,
  type LocationPoint,
} from '../DistanceCalculator'

const A: LocationPoint = { name: 'A', longitude: 116.4, latitude: 39.9 }
const B: LocationPoint = { name: 'B', longitude: 116.41, latitude: 39.91 }
const C: LocationPoint = { name: 'C', longitude: 116.5, latitude: 39.95 }

describe('toRad', () => {
  it('将度数转换为弧度', () => {
    expect(toRad(180)).toBeCloseTo(Math.PI, 10)
    expect(toRad(90)).toBeCloseTo(Math.PI / 2, 10)
    expect(toRad(0)).toBe(0)
  })
})

describe('haversineDistance', () => {
  it('计算北京到东京的已知距离', () => {
    const d = haversineDistance(39.9042, 116.4074, 35.6762, 139.6503)
    expect(d).toBeGreaterThan(2000_000)
    expect(d).toBeLessThan(2200_000)
  })

  it('计算纽约到伦敦的已知距离', () => {
    const d = haversineDistance(40.7128, -74.006, 51.5074, -0.1278)
    expect(d).toBeGreaterThan(5500_000)
    expect(d).toBeLessThan(5650_000)
  })

  it('相同坐标距离为 0', () => {
    expect(haversineDistance(39.9, 116.4, 39.9, 116.4)).toBe(0)
  })

  it('赤道 1 度经度约 111 公里', () => {
    const d = haversineDistance(0, 0, 0, 1)
    expect(d).toBeGreaterThan(111000)
    expect(d).toBeLessThan(112000)
  })

  it('支持自定义星球半径', () => {
    const earth = haversineDistance(0, 0, 0, 1, PLANET_PRESETS['地球']!)
    const moon = haversineDistance(0, 0, 0, 1, PLANET_PRESETS['月球']!)
    expect(moon).toBeLessThan(earth)
    expect(moon / earth).toBeCloseTo(PLANET_PRESETS['月球']! / PLANET_PRESETS['地球']!, 5)
  })
})

describe('isValidCoordinate', () => {
  it('接受合法坐标', () => {
    expect(isValidCoordinate(39.9, 116.4)).toBe(true)
    expect(isValidCoordinate(-90, -180)).toBe(true)
    expect(isValidCoordinate(90, 180)).toBe(true)
  })

  it('拒绝越界或非数字', () => {
    expect(isValidCoordinate(91, 116.4)).toBe(false)
    expect(isValidCoordinate(-90.1, 116.4)).toBe(false)
    expect(isValidCoordinate(39.9, 181)).toBe(false)
    expect(isValidCoordinate(39.9, -180.1)).toBe(false)
    expect(isValidCoordinate(NaN, 116.4)).toBe(false)
    expect(isValidCoordinate(39.9, NaN)).toBe(false)
  })
})

describe('matchDistances - 同站址', () => {
  it('识别同站址模式', async () => {
    const result = await matchDistances([A, B, C], [A, B, C], {
      matchCount: 1,
      matchMode: 'nearest',
    })
    expect(result.mode).toBe('same-site')
  })

  it('每个站点匹配到最近的其他站点（排除自身）', async () => {
    const result = await matchDistances([A, B, C], [A, B, C], {
      matchCount: 2,
      matchMode: 'nearest',
    })
    expect(result.results).toHaveLength(3)

    const aResult = result.results.find((r) => r.site.name === 'A')!
    expect(aResult.matches.map((m) => m.site.name)).toEqual(['B', 'C'])
    expect(aResult.matches[0]!.distance).toBeGreaterThan(1000)
    expect(aResult.matches[0]!.distance).toBeLessThan(2000)
  })

  it('最远匹配模式返回降序候选', async () => {
    const result = await matchDistances([A, B, C], [A, B, C], {
      matchCount: 2,
      matchMode: 'farthest',
    })
    const aResult = result.results.find((r) => r.site.name === 'A')!
    expect(aResult.matches.map((m) => m.site.name)).toEqual(['C', 'B'])
  })

  it('maxDistance 过滤超出范围的候选', async () => {
    const result = await matchDistances([A, B, C], [A, B, C], {
      matchCount: 2,
      matchMode: 'nearest',
      maxDistance: 5000,
    })
    const aResult = result.results.find((r) => r.site.name === 'A')!
    expect(aResult.matches.map((m) => m.site.name)).toEqual(['B'])
  })

  it('minDistance 过滤过近的候选', async () => {
    const result = await matchDistances([A, B, C], [A, B, C], {
      matchCount: 2,
      matchMode: 'nearest',
      minDistance: 2000,
    })
    const aResult = result.results.find((r) => r.site.name === 'A')!
    expect(aResult.matches.map((m) => m.site.name)).toEqual(['C'])
  })

  it('少于两个站点时返回空匹配', async () => {
    const result = await matchDistances([A], [A], { matchCount: 1, matchMode: 'nearest' })
    expect(result.mode).toBe('same-site')
    expect(result.results[0]!.matches).toEqual([])
  })
})

describe('matchDistances - 异站址', () => {
  it('异站址模式以 data2 为主遍历、data1 为匹配目标', async () => {
    const result = await matchDistances([A], [B, C], { matchCount: 2, matchMode: 'nearest' })
    expect(result.mode).toBe('different-site')
    expect(result.results).toHaveLength(2)
    expect(result.results[0]!.site.name).toBe('B')
    expect(result.results[1]!.site.name).toBe('C')
    expect(result.results[0]!.matches.map((m) => m.site.name)).toEqual(['A'])
    expect(result.results[1]!.matches.map((m) => m.site.name)).toEqual(['A'])
  })

  it('空目标集合返回空结果', async () => {
    const result = await matchDistances([A, B], [], { matchCount: 1, matchMode: 'nearest' })
    expect(result.mode).toBe('different-site')
    expect(result.results).toEqual([])
  })

  it('目标集合为空数组时的同站址判定', async () => {
    const result = await matchDistances([], [], { matchCount: 1, matchMode: 'nearest' })
    expect(result.mode).toBe('same-site')
    expect(result.results).toEqual([])
  })
})

describe('matchDistances - 进度与中止', () => {
  it('进度回调最终到达 100', async () => {
    const onProgress = vi.fn()
    await matchDistances([A, B, C], [A, B, C], { matchCount: 1, matchMode: 'nearest' }, onProgress)
    expect(onProgress).toHaveBeenCalled()
    expect(onProgress.mock.calls[onProgress.mock.calls.length - 1]![0]).toBe(100)
  })

  it('中止后不再返回结果', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await matchDistances(
      [A, B, C],
      [A, B, C],
      { matchCount: 1, matchMode: 'nearest' },
      undefined,
      controller.signal,
    )
    expect(result.results).toHaveLength(0)
  })

  it('中止时进度回调收到 0', async () => {
    const controller = new AbortController()
    controller.abort()
    const onProgress = vi.fn()
    await matchDistances(
      [A, B, C],
      [A, B, C],
      { matchCount: 1, matchMode: 'nearest' },
      onProgress,
      controller.signal,
    )
    expect(onProgress.mock.calls[onProgress.mock.calls.length - 1]).toEqual([0, '计算已终止'])
  })
})

describe('配置常量', () => {
  it('默认配置可调参数齐全', () => {
    expect(DEFAULT_MATCH_CONFIG.planetRadius).toBe(6371000)
    expect(DEFAULT_MATCH_CONFIG.initialSearchRadius).toBe(200)
    expect(DEFAULT_MATCH_CONFIG.maxIterations).toBe(50)
    expect(DEFAULT_MATCH_CONFIG.chunkSize).toBe(100)
  })
})

describe('matchDistances - matchCount 边界（阶段 0）', () => {
  // 历史 Bug：DistanceSensorPage 的 watcher 只做 Math.floor 不做下限钳制。
  // 清空「匹配数量」输入框时 v-model.number 产出 ''，Math.floor('') === 0。
  // k = 0 会让 insertSortedAsc 访问 arr[-1].distance、matchOneNearest 访问
  // topK[k-1] → TypeError，整个计算崩溃，只弹一个无信息量的「计算失败」。
  it('matchCount = 0 不崩溃，退化为至少 1 个近邻', async () => {
    const result = await matchDistances([A, B, C], [A, B, C], {
      matchCount: 0,
      matchMode: 'nearest',
    } as Parameters<typeof matchDistances>[2])
    expect(result.results).toHaveLength(3)
    for (const site of result.results) {
      expect(site.matches.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('matchCount 为负数 / NaN 也不崩溃', async () => {
    for (const bad of [-5, Number.NaN]) {
      const result = await matchDistances([A, B, C], [A, B, C], {
        matchCount: bad,
        matchMode: 'nearest',
      } as Parameters<typeof matchDistances>[2])
      expect(result.results).toHaveLength(3)
      for (const site of result.results) {
        expect(site.matches.length).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('正常 matchCount 仍返回请求的数量（行为不变）', async () => {
    const result = await matchDistances([A, B, C], [A, B, C], {
      matchCount: 2,
      matchMode: 'nearest',
    })
    const aResult = result.results.find((r) => r.site.name === 'A')!
    expect(aResult.matches.map((m) => m.site.name)).toEqual(['B', 'C'])
  })
})
