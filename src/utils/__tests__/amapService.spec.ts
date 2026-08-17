import { describe, it, expect, vi, afterEach } from 'vitest'
import axios from 'axios'
import {
  PROVIDER_CONFIGS,
  getRandomDelay,
  buildApiUrl,
  isInBounds,
  parseLocation,
  validateApiKey,
  getProviderOptions,
  exportResultsToRows,
} from '../amapService'

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}))

const mockGet = vi.mocked(axios.get)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getRandomDelay', () => {
  it('randomDelay 关闭时返回固定延迟', () => {
    expect(getRandomDelay(500, false, 100, 500)).toBe(500)
  })

  it('randomDelay 开启但未提供范围时返回固定延迟', () => {
    expect(getRandomDelay(500, true)).toBe(500)
  })

  it('randomDelay 开启时落在 [delay+min, delay+max] 区间', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(getRandomDelay(500, true, 100, 500)).toBe(600)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(getRandomDelay(500, true, 100, 500)).toBe(800)
  })
})

describe('buildApiUrl', () => {
  it('追加查询参数', () => {
    const url = buildApiUrl('https://example.com/api', { key: 'k1', output: 'json' })
    expect(url).toBe('https://example.com/api?key=k1&output=json')
  })

  it('保留已有参数并覆盖同名参数', () => {
    const url = buildApiUrl('https://example.com/api?a=1', { a: '2', b: '3' })
    expect(url).toBe('https://example.com/api?a=2&b=3')
  })
})

describe('isInBounds', () => {
  const bounds = {
    southwest: { lng: 116, lat: 39 },
    northeast: { lng: 117, lat: 40 },
  }

  it('区域内返回 true', () => {
    expect(isInBounds(116.5, 39.5, bounds)).toBe(true)
  })

  it('边界上返回 true', () => {
    expect(isInBounds(116, 39, bounds)).toBe(true)
    expect(isInBounds(117, 40, bounds)).toBe(true)
  })

  it('区域外返回 false', () => {
    expect(isInBounds(115.9, 39.5, bounds)).toBe(false)
    expect(isInBounds(116.5, 40.1, bounds)).toBe(false)
    expect(isInBounds(117.1, 39.5, bounds)).toBe(false)
  })
})

describe('parseLocation', () => {
  it('合法坐标返回数值', () => {
    expect(parseLocation('116.4,39.9')).toEqual({ lng: 116.4, lat: 39.9 })
  })

  it('非法输入返回 null', () => {
    expect(parseLocation('')).toBeNull()
    expect(parseLocation('abc')).toBeNull()
    expect(parseLocation('116.4')).toBeNull()
    expect(parseLocation('1,2,3')).toBeNull()
    expect(parseLocation('a,b')).toBeNull()
  })
})

describe('PROVIDER_CONFIGS', () => {
  it('仅包含 gaode 且配置正确', () => {
    expect(Object.keys(PROVIDER_CONFIGS)).toEqual(['gaode'])
    const config = PROVIDER_CONFIGS.gaode
    expect(config.url).toBe('https://restapi.amap.com/v3/geocode/geo')
    expect(config.keyParam).toBe('key')
    expect(config.validateParam).toBe('address')
    expect(config.validateValue).toBe('北京市天安门')
    expect(config.responseParser({ status: '1', info: 'OK' })).toEqual({ status: '1', info: 'OK' })
  })
})

describe('validateApiKey', () => {
  it('状态 1 判定有效', async () => {
    mockGet.mockResolvedValue({ status: 200, data: { status: '1' } })
    const result = await validateApiKey('k1', 'gaode')
    expect(result.isValid).toBe(true)
    expect(result.url).toContain('key=k1')
    expect(mockGet).toHaveBeenCalledWith(
      'https://restapi.amap.com/v3/geocode/geo',
      expect.objectContaining({ params: expect.objectContaining({ address: '北京市天安门' }), timeout: 5000 }),
    )
  })

  it('数字状态 1 也判定有效', async () => {
    mockGet.mockResolvedValue({ status: 200, data: { status: 1 } })
    expect((await validateApiKey('k1', 'gaode')).isValid).toBe(true)
  })

  it('状态非 1 返回错误信息', async () => {
    mockGet.mockResolvedValue({ status: 200, data: { status: '0' } })
    const result = await validateApiKey('k1', 'gaode')
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('高德API返回状态: 0')
  })

  it('HTTP 状态非 200 报错', async () => {
    mockGet.mockResolvedValue({ status: 403, data: {} })
    const result = await validateApiKey('k1', 'gaode')
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('HTTP状态码不为200')
  })

  it('网络异常返回请求失败', async () => {
    mockGet.mockRejectedValue(new Error('timeout of 5000ms exceeded'))
    const result = await validateApiKey('k1', 'gaode')
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBe('请求失败: timeout of 5000ms exceeded')
  })
})

describe('getProviderOptions / exportResultsToRows', () => {
  it('提供商选项仅高德', () => {
    expect(getProviderOptions()).toEqual([{ value: 'gaode', label: '高德地图' }])
  })

  it('按表头与字段配置导出行', () => {
    const rows = exportResultsToRows(
      ['名称', '来源', '原始'],
      [{ 名称: '甲', 原始: 'raw1' }],
      { 来源: (r) => `来源:${String(r.名称)}` },
    )
    expect(rows).toEqual([
      ['名称', '来源', '原始'],
      ['甲', '来源:甲', 'raw1'],
    ])
  })

  it('无配置的缺失字段输出空字符串', () => {
    const rows = exportResultsToRows(['a', 'b'], [{ a: 'x' }], {})
    expect(rows).toEqual([
      ['a', 'b'],
      ['x', ''],
    ])
  })
})