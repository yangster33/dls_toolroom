import { describe, it, expect, vi, afterEach } from 'vitest'
import axios from 'axios'
import {
  batchQueryAddresses,
  exportResultsToRows,
  getAvailableFields,
  getProviderOptions,
} from '../ApiService'

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}))

const mockGet = vi.mocked(axios.get)

const KEY = { id: 'a', provider: 'gaode' as const, key: 'key-a', isValid: true }

const POINT = { name: '点位甲', longitude: 116.4, latitude: 39.9 }

const OPTIONS = {
  delay: 0,
  randomDelay: false,
  minRandomDelay: 0,
  maxRandomDelay: 0,
  mixedMode: false,
}

const REGEO_RESPONSE = {
  status: 200,
  data: {
    regeocode: {
      formatted_address: '北京市海淀区中关村大街1号',
      addressComponent: {
        province: '北京市',
        city: '北京市',
        district: '海淀区',
        adcode: '110108',
      },
    },
  },
}

afterEach(() => {
  vi.restoreAllMocks()
  mockGet.mockReset()
})

describe('batchQueryAddresses', () => {
  it('成功逆地理编码并保留原始坐标', async () => {
    mockGet.mockResolvedValue(REGEO_RESPONSE)
    const results = await batchQueryAddresses([POINT], [KEY], OPTIONS)
    expect(results).toHaveLength(1)
    const r = results[0]!
    expect(r.name).toBe('点位甲')
    expect(r.longitude).toBe(116.4)
    expect(r.latitude).toBe(39.9)
    expect(r.address).toBe('北京市海淀区中关村大街1号')
    expect(r.formattedAddress).toBe('北京市海淀区中关村大街1号')
    expect(r.province).toBe('北京市')
    expect(r.city).toBe('北京市')
    expect(r.district).toBe('海淀区')
    expect(r.adcode).toBe('110108')
    expect(r.provider).toBe('gaode')
  })

  it('请求参数包含 key/location/output', async () => {
    mockGet.mockResolvedValue(REGEO_RESPONSE)
    await batchQueryAddresses([POINT], [KEY], OPTIONS)
    expect(mockGet).toHaveBeenCalledWith(
      'https://restapi.amap.com/v3/geocode/regeo',
      expect.objectContaining({
        params: expect.objectContaining({
          key: 'key-a',
          location: '116.4,39.9',
          output: 'json',
        }),
      }),
    )
  })

  it('regeocode 缺失时返回空地址', async () => {
    mockGet.mockResolvedValue({ status: 200, data: {} })
    const results = await batchQueryAddresses([POINT], [KEY], OPTIONS)
    expect(results[0]).toMatchObject({
      address: '',
      formattedAddress: '',
      adcode: '',
      longitude: 116.4,
    })
  })

  it('查询异常返回失败结果', async () => {
    mockGet.mockRejectedValue(new Error('网络错误'))
    const results = await batchQueryAddresses([POINT], [KEY], OPTIONS)
    expect(results[0]).toMatchObject({
      name: '点位甲',
      address: '查询失败',
      provider: 'gaode',
    })
  })

  it('无有效 API Key 抛出错误', async () => {
    await expect(
      batchQueryAddresses([POINT], [{ ...KEY, isValid: false }], OPTIONS),
    ).rejects.toThrow('没有有效的API Key')
  })

  it('进度消息包含点位名称', async () => {
    mockGet.mockResolvedValue(REGEO_RESPONSE)
    const onProgress = vi.fn()
    await batchQueryAddresses([POINT, POINT], [KEY], OPTIONS, onProgress)
    expect(onProgress.mock.calls.map((c) => c[0].progress)).toEqual([50, 100])
    expect(onProgress.mock.calls[0]![0].message).toBe('正在查询: 点位甲 (1/2)')
  })
})

describe('exportResultsToRows', () => {
  const RESULT = {
    name: '点位甲',
    longitude: 116.4,
    latitude: 39.9,
    address: '地址A',
    province: '北京市',
    city: '北京市',
    district: '海淀区',
    formattedAddress: '格式化地址',
    adcode: '110108',
    provider: 'gaode' as const,
  }

  it('生成固定表头与数据行', () => {
    const rows = exportResultsToRows(
      [RESULT],
      ['address', 'province', 'city', 'district', 'formattedAddress', 'adcode', 'provider'],
    )
    expect(rows[0]).toEqual([
      '名称',
      '经度',
      '纬度',
      'address',
      'province',
      'city',
      'district',
      'formattedAddress',
      'adcode',
      'provider',
    ])
    expect(rows[1]).toEqual([
      '点位甲',
      '116.4',
      '39.9',
      '地址A',
      '北京市',
      '北京市',
      '海淀区',
      '格式化地址',
      '110108',
      '高德地图',
    ])
  })

  it('未知字段输出空字符串', () => {
    const rows = exportResultsToRows([RESULT], ['bogus'])
    expect(rows[1]).toEqual(['点位甲', '116.4', '39.9', ''])
  })
})

describe('元信息', () => {
  it('可用字段为 7 个', () => {
    expect(getAvailableFields().map((f) => f.value)).toEqual([
      'address',
      'province',
      'city',
      'district',
      'formattedAddress',
      'adcode',
      'provider',
    ])
  })

  it('提供商选项仅高德', () => {
    expect(getProviderOptions()).toEqual([{ value: 'gaode', label: '高德地图' }])
  })
})
