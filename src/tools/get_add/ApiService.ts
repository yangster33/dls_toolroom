import axios from 'axios'
import type { AxiosResponse } from 'axios'
import {
  type ApiKeyInfo,
  type ApiProvider,
  type QueryProgress,
  validateApiKey as validateKey,
} from '@/utils/amapService'
import { batchGeocodeQuery } from '@/utils/GeocodeBatchService'
import type { CoordinatePoint } from '@/utils/templateHandler'

// ===================== 类型定义 =====================

export type { ApiKeyInfo, ApiProvider }

export interface QueryOptions {
  delay: number
  randomDelay: boolean
  minRandomDelay: number
  maxRandomDelay: number
  mixedMode: boolean
}

export interface QueryResult {
  name: string
  longitude: number
  latitude: number
  address: string
  province: string
  city: string
  district: string
  formattedAddress: string
  adcode: string
  provider: ApiProvider
  rawData?: Record<string, unknown>
}

// ===================== API Provider 配置 =====================

const PROVIDER_CONFIG: Record<
  ApiProvider,
  {
    url: string
    keyParam: string
    coordParam: string
    responseParser: (data: unknown) => Partial<QueryResult>
  }
> = {
  gaode: {
    url: 'https://restapi.amap.com/v3/geocode/regeo',
    keyParam: 'key',
    coordParam: 'location',
    responseParser: (data: unknown) => {
      const result = data as Record<string, unknown>
      const regeocode = result.regeocode as Record<string, unknown> | undefined
      const addressComponent = regeocode?.addressComponent as Record<string, unknown> | undefined
      return {
        address: String(regeocode?.formatted_address || ''),
        province: String(addressComponent?.province || ''),
        city: String(addressComponent?.city || ''),
        district: String(addressComponent?.district || ''),
        formattedAddress: String(regeocode?.formatted_address || ''),
        adcode: String(addressComponent?.adcode || ''),
        rawData: data as Record<string, unknown>,
      }
    },
  },
}

// ===================== 导出通用函数 =====================

export { validateKey as validateApiKey }

// ===================== 批量查询 =====================

export async function batchQueryAddresses(
  points: CoordinatePoint[],
  apiKeys: ApiKeyInfo[],
  options: QueryOptions,
  onProgress?: (progress: QueryProgress) => void,
): Promise<QueryResult[]> {
  return batchGeocodeQuery<CoordinatePoint, Partial<QueryResult>, QueryResult>(
    points,
    apiKeys,
    options,
    // 单次查询
    async (point, apiKey, provider) => {
      const config = PROVIDER_CONFIG[provider]
      const coordStr = `${point.longitude},${point.latitude}`

      const response: AxiosResponse = await axios.get(config.url, {
        params: {
          [config.keyParam]: apiKey,
          [config.coordParam]: coordStr,
          output: 'json',
        },
        timeout: 10000,
      })

      if (response.status === 200) {
        const parsed = config.responseParser(response.data)
        return { ...parsed, longitude: point.longitude, latitude: point.latitude, provider }
      }
      throw new Error('查询失败')
    },
    // 成功时合并结果
    (point, partial) => ({
      name: point.name,
      longitude: point.longitude,
      latitude: point.latitude,
      address: '',
      province: '',
      city: '',
      district: '',
      formattedAddress: '',
      adcode: '',
      provider: partial.provider!,
      rawData: {},
      ...partial,
    }),
    // 失败时的默认结果
    (point, provider) => ({
      name: point.name,
      longitude: point.longitude,
      latitude: point.latitude,
      address: '查询失败',
      province: '',
      city: '',
      district: '',
      formattedAddress: '',
      adcode: '',
      provider,
      rawData: {},
    }),
    onProgress,
    (point, i, total) => `正在查询: ${point.name} (${i + 1}/${total})`,
  )
}

// ===================== 可用字段和导出 =====================

export function getAvailableFields(): { value: string; label: string }[] {
  return [
    { value: 'address', label: '地址' },
    { value: 'province', label: '省份' },
    { value: 'city', label: '城市' },
    { value: 'district', label: '区县' },
    { value: 'formattedAddress', label: '格式化地址' },
    { value: 'adcode', label: '行政区划代码' },
    { value: 'provider', label: '查询来源' },
  ]
}

export function exportResultsToRows(
  results: QueryResult[],
  selectedFields: string[],
): string[][] {
  const headers = ['名称', '经度', '纬度', ...selectedFields]
  const rows: string[][] = [headers]

  for (const result of results) {
    const row: string[] = [result.name, String(result.longitude), String(result.latitude)]

    for (const field of selectedFields) {
      switch (field) {
        case 'address':
          row.push(result.address)
          break
        case 'province':
          row.push(result.province)
          break
        case 'city':
          row.push(result.city)
          break
        case 'district':
          row.push(result.district)
          break
        case 'formattedAddress':
          row.push(result.formattedAddress)
          break
        case 'adcode':
          row.push(result.adcode)
          break
        case 'provider':
          row.push('高德地图')
          break
        default:
          row.push('')
      }
    }

    rows.push(row)
  }

  return rows
}

export function getProviderOptions(): { value: ApiProvider; label: string }[] {
  return [{ value: 'gaode', label: '高德地图' }]
}
