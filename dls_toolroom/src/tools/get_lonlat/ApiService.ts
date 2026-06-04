import axios from 'axios'
import type { AxiosResponse } from 'axios'
import gcoord from 'gcoord'
import {
  type ApiKeyInfo,
  type ApiProvider,
  type QueryProgress,
  validateApiKey as validateKey,
  isInBounds,
} from '@/utils/amapService'
import { batchGeocodeQuery } from '@/utils/GeocodeBatchService'
import type { FullAddress } from './TemplateReader'

// 重新导出类型
export type { ApiKeyInfo, ApiProvider }

// ===================== 类型定义 =====================

export interface QueryOptions {
  delay: number
  randomDelay: boolean
  minRandomDelay: number
  maxRandomDelay: number
  mixedMode: boolean
  bounds?: {
    southwest: { lng: number; lat: number }
    northeast: { lng: number; lat: number }
  } | null
}

export interface QueryResult {
  province: string
  city: string
  district: string
  township: string
  community: string
  address: string
  longitude: number
  latitude: number
  formattedAddress: string
  adcode: string
  provider: ApiProvider
  inBounds: boolean
  rawData?: Record<string, unknown>
}

// ===================== API Provider 配置 =====================

const PROVIDER_CONFIG: Record<
  ApiProvider,
  {
    url: string
    keyParam: string
    addressParam: string
    responseParser: (data: unknown) => Partial<QueryResult>
  }
> = {
  gaode: {
    url: 'https://restapi.amap.com/v3/geocode/geo',
    keyParam: 'key',
    addressParam: 'address',
    responseParser: (data: unknown) => {
      const result = data as Record<string, unknown>
      const geocodes = (result.geocodes as Array<Record<string, unknown>>) || []
      const firstGeocode = geocodes[0]

      if (!firstGeocode) {
        return {}
      }

      const location = String(firstGeocode.location || '')
      const [lngStr, latStr] = location.split(',')
      const gcjLng = parseFloat(lngStr || '0')
      const gcjLat = parseFloat(latStr || '0')

      const [wgsLng, wgsLat] = gcoord.transform(
        [gcjLng, gcjLat],
        gcoord.GCJ02,
        gcoord.WGS84,
      ) as [number, number]

      return {
        longitude: wgsLng,
        latitude: wgsLat,
        formattedAddress: String(firstGeocode.formatted_address || ''),
        adcode: String(firstGeocode.adcode || ''),
        province: String(firstGeocode.province || ''),
        city: String(firstGeocode.city || ''),
        district: String(firstGeocode.district || ''),
        rawData: data as Record<string, unknown>,
      }
    },
  },
}

// ===================== 导出通用函数 =====================

export { validateKey as validateApiKey }

// ===================== 构建地址字符串 =====================

function buildFullAddress(addressData: FullAddress): string {
  const parts: string[] = []
  if (addressData.province) parts.push(addressData.province)
  if (addressData.city) parts.push(addressData.city)
  if (addressData.district) parts.push(addressData.district)
  if (addressData.township) parts.push(addressData.township)
  if (addressData.community) parts.push(addressData.community)
  if (addressData.address) parts.push(addressData.address)
  return parts.join('')
}

// ===================== 批量查询 =====================

export async function batchQueryLonLats(
  addresses: FullAddress[],
  apiKeys: ApiKeyInfo[],
  options: QueryOptions,
  onProgress?: (progress: QueryProgress) => void,
): Promise<QueryResult[]> {
  return batchGeocodeQuery<FullAddress, Partial<QueryResult>, QueryResult>(
    addresses,
    apiKeys,
    options,
    // 单次查询
    async (addressData, apiKey, provider) => {
      const config = PROVIDER_CONFIG[provider]
      const fullAddress = buildFullAddress(addressData)

      const params: Record<string, string | number> = {
        [config.keyParam]: apiKey,
        [config.addressParam]: fullAddress,
        output: 'json',
      }

      if (addressData.city) {
        params.city = addressData.city
      }

      const response: AxiosResponse = await axios.get(config.url, {
        params,
        timeout: 10000,
      })

      if (response.status === 200) {
        const parsed = config.responseParser(response.data)
        const partialResult: Partial<QueryResult> = {
          ...parsed,
          province: addressData.province,
          city: addressData.city,
          district: addressData.district,
          township: addressData.township,
          community: addressData.community,
          address: addressData.address,
          provider,
          inBounds: true,
        }

        if (
          options.bounds &&
          parsed.longitude !== undefined &&
          parsed.latitude !== undefined
        ) {
          partialResult.inBounds = isInBounds(
            parsed.longitude,
            parsed.latitude,
            options.bounds,
          )
        }

        return partialResult
      }

      throw new Error('查询失败')
    },
    // 成功时合并结果
    (addressData, partial) => ({
      province: addressData.province,
      city: addressData.city,
      district: addressData.district,
      township: addressData.township,
      community: addressData.community,
      address: addressData.address,
      longitude: 0,
      latitude: 0,
      formattedAddress: '',
      adcode: '',
      provider: partial.provider!,
      inBounds: true,
      rawData: {},
      ...partial,
    }),
    // 失败时的默认结果
    (addressData, provider) => ({
      province: addressData.province,
      city: addressData.city,
      district: addressData.district,
      township: addressData.township,
      community: addressData.community,
      address: addressData.address,
      longitude: 0,
      latitude: 0,
      formattedAddress: '查询失败',
      adcode: '',
      provider,
      inBounds: false,
      rawData: {},
    }),
    onProgress,
    (_item, i, total) => `正在查询: ${i + 1}/${total}`,
  )
}

// ===================== 可用字段 =====================

export function getAvailableFields(): { value: string; label: string }[] {
  return [
    { value: 'formattedAddress', label: '格式化地址' },
    { value: 'adcode', label: '行政区划代码' },
    { value: 'inBounds', label: '是否在区域内' },
    { value: 'provider', label: '查询来源' },
  ]
}

// ===================== 导出结果到行 =====================

export function exportResultsToRows(
  results: QueryResult[],
  selectedFields: string[],
): string[][] {
  const headers = [
    '省',
    '市',
    '区/县',
    '乡/镇',
    '社区/村',
    '地址',
    '经度(WGS84)',
    '纬度(WGS84)',
    ...selectedFields,
  ]
  const rows: string[][] = [headers]

  for (const result of results) {
    const row: string[] = [
      result.province,
      result.city,
      result.district,
      result.township,
      result.community,
      result.address,
      String(result.longitude),
      String(result.latitude),
    ]

    for (const field of selectedFields) {
      switch (field) {
        case 'formattedAddress':
          row.push(result.formattedAddress)
          break
        case 'adcode':
          row.push(result.adcode)
          break
        case 'inBounds':
          row.push(result.inBounds ? '是' : '否')
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
