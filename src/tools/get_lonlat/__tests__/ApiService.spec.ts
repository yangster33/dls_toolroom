import { describe, it, expect, vi, afterEach } from 'vitest'
import axios from 'axios'
import {
  batchQueryLonLats,
  exportResultsToRows,
  getAvailableFields,
  getProviderOptions,
} from '../ApiService'
import type { FullAddress } from '../TemplateReader'

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}))

const mockGet = vi.mocked(axios.get)

const KEY = { id: 'a', provider: 'gaode' as const, key: 'key-a', isValid: true }

const ADDRESS: FullAddress = {
  province: '北京市',
  city: '北京市',
  district: '朝阳区',
  township: '',
  community: '',
  address: '某街道1号',
}

const OPTIONS = {
  delay: 0,
  randomDelay: false,
  minRandomDelay: 0,
  maxRandomDelay: 0,
  mixedMode: false,
  bounds: null,
}

function geoResponse(location: string) {
  return {
    status: 200,
    data: {
      geocodes: [
        {
          location,
          formatted_address: '格式化地址A',
          adcode: '110105',
          province: '北京市',
          city: '北京市',
          district: '朝阳区',
        },
      ],
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  mockGet.mockReset()
})

describe('batchQueryLonLats', () => {
  it('成功查询并转换为 WGS84 坐标', async () => {
    mockGet.mockResolvedValue(geoResponse('116.4,39.9'))
    const results = await batchQueryLonLats([ADDRESS], [KEY], OPTIONS)
    expect(results).toHaveLength(1)
    const r = results[0]!
    expect(r.formattedAddress).toBe('格式化地址A')
    expect(r.adcode).toBe('110105')
    expect(r.provider).toBe('gaode')
    expect(r.inBounds).toBe(true)
    expect(Math.abs(r.longitude - 116.4)).toBeGreaterThan(0.001)
    expect(Math.abs(r.longitude - 116.4)).toBeLessThan(0.01)
    expect(Math.abs(r.latitude - 39.9)).toBeGreaterThan(0.001)
    expect(r.province).toBe('北京市')
    expect(r.city).toBe('北京市')
    expect(r.district).toBe('朝阳区')
  })

  it('请求参数包含 key/address，且 city 存在时追加', async () => {
    mockGet.mockResolvedValue(geoResponse('116.4,39.9'))
    await batchQueryLonLats([ADDRESS], [KEY], OPTIONS)
    expect(mockGet).toHaveBeenCalledWith(
      'https://restapi.amap.com/v3/geocode/geo',
      expect.objectContaining({
        params: expect.objectContaining({
          key: 'key-a',
          address: '北京市北京市朝阳区某街道1号',
          output: 'json',
          city: '北京市',
        }),
      }),
    )
  })

  it('geocodes 为空时返回空坐标', async () => {
    mockGet.mockResolvedValue({ status: 200, data: { geocodes: [] } })
    const results = await batchQueryLonLats([ADDRESS], [KEY], OPTIONS)
    expect(results[0]).toMatchObject({
      formattedAddress: '',
      longitude: 0,
      latitude: 0,
      inBounds: true,
    })
  })

  it('指定 bounds 时按坐标判定是否在区域内', async () => {
    mockGet.mockResolvedValue(geoResponse('116.4,39.9'))
    const inside = await batchQueryLonLats([ADDRESS], [KEY], {
      ...OPTIONS,
      bounds: { southwest: { lng: 116, lat: 39 }, northeast: { lng: 117, lat: 40 } },
    })
    expect(inside[0]!.inBounds).toBe(true)

    const outside = await batchQueryLonLats([ADDRESS], [KEY], {
      ...OPTIONS,
      bounds: { southwest: { lng: 116, lat: 39 }, northeast: { lng: 116.2, lat: 39.5 } },
    })
    expect(outside[0]!.inBounds).toBe(false)
  })

  it('查询异常返回失败结果', async () => {
    mockGet.mockRejectedValue(new Error('网络错误'))
    const results = await batchQueryLonLats([ADDRESS], [KEY], OPTIONS)
    expect(results[0]).toMatchObject({
      formattedAddress: '查询失败',
      longitude: 0,
      latitude: 0,
      inBounds: false,
    })
  })

  it('无有效 API Key 抛出错误', async () => {
    await expect(
      batchQueryLonLats([ADDRESS], [{ ...KEY, isValid: false }], OPTIONS),
    ).rejects.toThrow('没有有效的API Key')
  })

  it('进度回调与消息格式', async () => {
    mockGet.mockResolvedValue(geoResponse('116.4,39.9'))
    const onProgress = vi.fn()
    await batchQueryLonLats([ADDRESS, ADDRESS], [KEY], OPTIONS, onProgress)
    expect(onProgress.mock.calls.map((c) => c[0].progress)).toEqual([50, 100])
    expect(onProgress.mock.calls[0]![0].message).toBe('正在查询: 1/2')
  })
})

describe('exportResultsToRows', () => {
  const RESULT = {
    province: '北京市',
    city: '北京市',
    district: '朝阳区',
    township: '乡',
    community: '村',
    address: '街道1号',
    longitude: 116.4,
    latitude: 39.9,
    formattedAddress: '格式化地址',
    adcode: '110105',
    provider: 'gaode' as const,
    inBounds: true,
  }

  it('生成固定表头与数据行', () => {
    const rows = exportResultsToRows(
      [{ ...RESULT, inBounds: false }],
      ['formattedAddress', 'adcode', 'inBounds', 'provider'],
    )
    expect(rows[0]).toEqual([
      '省',
      '市',
      '区/县',
      '乡/镇',
      '社区/村',
      '地址',
      '经度(WGS84)',
      '纬度(WGS84)',
      'formattedAddress',
      'adcode',
      'inBounds',
      'provider',
    ])
    expect(rows[1]).toEqual([
      '北京市',
      '北京市',
      '朝阳区',
      '乡',
      '村',
      '街道1号',
      '116.4',
      '39.9',
      '格式化地址',
      '110105',
      '否',
      '高德地图',
    ])
  })

  it('未知字段输出空字符串', () => {
    const rows = exportResultsToRows([RESULT], ['bogus'])
    expect(rows[1]).toEqual([
      '北京市',
      '北京市',
      '朝阳区',
      '乡',
      '村',
      '街道1号',
      '116.4',
      '39.9',
      '',
    ])
  })
})

describe('元信息', () => {
  it('可用字段为 4 个', () => {
    expect(getAvailableFields().map((f) => f.value)).toEqual([
      'formattedAddress',
      'adcode',
      'inBounds',
      'provider',
    ])
  })

  it('提供商选项仅高德', () => {
    expect(getProviderOptions()).toEqual([{ value: 'gaode', label: '高德地图' }])
  })
})
