import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  eventTypeOptions,
  alertLevelOptions,
  fetchGdacsData,
  formatDate,
  getAlertLevelColor,
  getEventTypeLabel,
  type GdacsFormData,
} from '../gdacsService'

const FORM: GdacsFormData = {
  eventType: '',
  alertLevel: '',
  startDate: '',
  endDate: '',
  pageNumber: 1,
  pageSize: 10,
}

function feature(overrides: Record<string, unknown> = {}) {
  return {
    type: 'Feature',
    properties: {
      eventid: 'e1',
      eventtype: 'EQ',
      title: '地震事件',
      country: 'Japan',
      fromdate: '2026-08-01T00:00:00',
      todate: '2026-08-02T00:00:00',
      alertlevel: 'Red',
      severity: '2.0',
      population: 1000,
      ...overrides,
    },
    geometry: { type: 'Point', coordinates: [141.35, 43.06] },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getAlertLevelColor', () => {
  it('按级别返回颜色', () => {
    expect(getAlertLevelColor('Red')).toBe('#dc2626')
    expect(getAlertLevelColor('orange')).toBe('#f97316')
    expect(getAlertLevelColor('GREEN')).toBe('#22c55e')
  })

  it('未知级别返回灰色', () => {
    expect(getAlertLevelColor('Blue')).toBe('#6b7280')
    expect(getAlertLevelColor('')).toBe('#6b7280')
  })
})

describe('getEventTypeLabel', () => {
  it('映射已知类型', () => {
    expect(getEventTypeLabel('EQ')).toBe('地震')
    expect(getEventTypeLabel('TC')).toBe('热带气旋')
    expect(getEventTypeLabel('FL')).toBe('洪水')
    expect(getEventTypeLabel('VO')).toBe('火山')
    expect(getEventTypeLabel('DR')).toBe('干旱')
    expect(getEventTypeLabel('WF')).toBe('野火')
  })

  it('未知类型原样返回', () => {
    expect(getEventTypeLabel('XX')).toBe('XX')
  })
})

describe('formatDate', () => {
  it('格式化日期为 zh-CN 格式', () => {
    const text = formatDate('2026-08-17T03:04:00')
    expect(text).toMatch(/2026/)
    expect(text).toMatch(/03:04/)
  })
})

describe('选项常量', () => {
  it('事件类型选项', () => {
    expect(eventTypeOptions[0]).toEqual({ value: '', label: '全部类型' })
    expect(eventTypeOptions[eventTypeOptions.length - 1]!).toEqual({ value: 'WF', label: '野火' })
    expect(eventTypeOptions).toHaveLength(7)
  })

  it('预警级别选项', () => {
    expect(alertLevelOptions[0]).toEqual({ value: '', label: '全部级别' })
    expect(alertLevelOptions.map((o) => o.value)).toEqual(['', 'Green', 'Orange', 'Red'])
  })
})

describe('fetchGdacsData', () => {
  it('FeatureCollection 响应映射为事件', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          features: [feature(), feature({ eventid: 'e2', url: 'https://x/y' })],
        }),
      }),
    )
    const result = await fetchGdacsData(FORM)
    expect(result.success).toBe(true)
    expect(result.total).toBe(2)
    expect(result.data).toHaveLength(2)
    const first = result.data![0]!
    expect(first.id).toBe('e1')
    expect(first.title).toBe('地震事件')
    expect(first.type).toBe('EQ')
    expect(first.country).toBe('Japan')
    expect(first.latitude).toBe(43.06)
    expect(first.longitude).toBe(141.35)
    expect(first.url).toContain('report.aspx?eventid=e1')
    const second = result.data![1]!
    expect(second.url).toBe('https://x/y')
  })

  it('数组响应也可解析', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { eventid: 'a1', eventtype: 'FL', title: '洪水', latitude: '10', longitude: '20' },
        ],
      }),
    )
    const result = await fetchGdacsData(FORM)
    expect(result.success).toBe(true)
    expect(result.total).toBe(1)
    expect(result.data![0]).toMatchObject({ id: 'a1', latitude: 10, longitude: 20 })
  })

  it('请求参数：默认事件列表与日期', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await fetchGdacsData(FORM)
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('eventlist=EQ%3BTC%3BFL%3BVO%3BDR%3BWF')
    expect(url).toContain('fromdate=')
    expect(url).toContain('todate=')
    expect(url).toContain('pagenumber=1')
    expect(url).toContain('pagesize=10')
  })

  it('请求参数：指定类型与级别（小写）', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await fetchGdacsData({
      ...FORM,
      eventType: 'EQ',
      alertLevel: 'Red',
      startDate: '2026-08-01',
      endDate: '2026-08-10',
    })
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toContain('eventlist=EQ')
    expect(url).toContain('alertlevel=red')
    expect(url).toContain('fromdate=2026-08-01')
    expect(url).toContain('todate=2026-08-10')
  })

  it('HTTP 错误返回失败结果', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }),
    )
    const result = await fetchGdacsData(FORM)
    expect(result.success).toBe(false)
    expect(result.error).toContain('HTTP 500')
    expect(result.error).toContain('boom')
  })

  it('网络异常返回失败结果', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const result = await fetchGdacsData(FORM)
    expect(result.success).toBe(false)
    expect(result.error).toBe('network down')
  })
})
