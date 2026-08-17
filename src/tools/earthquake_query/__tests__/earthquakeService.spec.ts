import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  magnitudeOptions,
  fetchEarthquakeData,
  formatTime,
  getMagnitudeColor,
  getMagnitudeLevel,
  type EarthquakeFormData,
} from '../earthquakeService'

const FORM: EarthquakeFormData = {
  startDate: '2026-08-01',
  endDate: '2026-08-17',
  minMagnitude: '',
  maxMagnitude: '',
  latitude: '',
  longitude: '',
  radius: '',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getMagnitudeColor', () => {
  it('按震级区间返回颜色', () => {
    expect(getMagnitudeColor(8)).toBe('#dc2626')
    expect(getMagnitudeColor(7.5)).toBe('#ef4444')
    expect(getMagnitudeColor(6)).toBe('#f97316')
    expect(getMagnitudeColor(5.1)).toBe('#f59e0b')
    expect(getMagnitudeColor(4.2)).toBe('#eab308')
    expect(getMagnitudeColor(3)).toBe('#84cc16')
    expect(getMagnitudeColor(2)).toBe('#22c55e')
  })

  it('低于 2 级返回紫色', () => {
    expect(getMagnitudeColor(1.9)).toBe('#8b5cf6')
    expect(getMagnitudeColor(0)).toBe('#8b5cf6')
  })
})

describe('getMagnitudeLevel', () => {
  it('按震级区间返回等级', () => {
    expect(getMagnitudeLevel(8)).toBe('特大地震')
    expect(getMagnitudeLevel(7.9)).toBe('大地震')
    expect(getMagnitudeLevel(6)).toBe('强震')
    expect(getMagnitudeLevel(5)).toBe('中强震')
    expect(getMagnitudeLevel(4)).toBe('中震')
    expect(getMagnitudeLevel(3)).toBe('弱震')
    expect(getMagnitudeLevel(1)).toBe('微震')
  })

  it('低于 1 级返回极微震', () => {
    expect(getMagnitudeLevel(0.9)).toBe('极微震')
  })
})

describe('formatTime', () => {
  it('格式化时间戳为 zh-CN 格式', () => {
    const timestamp = new Date(2026, 0, 15, 3, 4, 5).getTime()
    const text = formatTime(timestamp)
    expect(text).toMatch(/2026/)
    expect(text).toMatch(/03:04:05/)
  })
})

describe('magnitudeOptions', () => {
  it('包含不限与各级震级', () => {
    expect(magnitudeOptions[0]).toEqual({ value: '', label: '不限' })
    expect(magnitudeOptions[magnitudeOptions.length - 1]!).toEqual({ value: '8', label: '8 级及以上' })
    expect(magnitudeOptions).toHaveLength(10)
  })
})

describe('fetchEarthquakeData', () => {
  it('请求参数包含起止时间与 limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await fetchEarthquakeData(FORM)
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('format=geojson')
    expect(url).toContain('starttime=2026-08-01')
    expect(url).toContain('endtime=2026-08-17')
    expect(url).toContain('limit=2000')
    expect(url).not.toContain('minmagnitude')
    expect(url).not.toContain('maxradiuskm')
  })

  it('震级上下限与位置参数', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await fetchEarthquakeData({
      ...FORM,
      minMagnitude: '4',
      maxMagnitude: '6',
      latitude: '39.9',
      longitude: '116.4',
      radius: '50',
    })
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('minmagnitude=4')
    expect(url).toContain('maxmagnitude=6')
    expect(url).toContain('latitude=39.9')
    expect(url).toContain('longitude=116.4')
    expect(url).toContain('maxradiuskm=50')
  })

  it('仅提供经纬度时半径默认 100', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await fetchEarthquakeData({ ...FORM, latitude: '39.9', longitude: '116.4' })
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('maxradiuskm=100')
  })

  it('成功返回响应数据', async () => {
    const payload = { type: 'FeatureCollection', features: [] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }))
    const result = await fetchEarthquakeData(FORM)
    expect(result.success).toBe(true)
    expect(result.data).toBe(payload)
  })

  it('HTTP 错误返回失败结果', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const result = await fetchEarthquakeData(FORM)
    expect(result.success).toBe(false)
    expect(result.error).toBe('请求失败: HTTP 404')
  })

  it('网络异常返回失败结果', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))
    const result = await fetchEarthquakeData(FORM)
    expect(result.success).toBe(false)
    expect(result.error).toBe('boom')
  })
})