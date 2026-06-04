import axios from 'axios'
import type { AxiosResponse } from 'axios'

// ===================== 类型定义 =====================

export type ApiProvider = 'gaode'

export interface ApiKeyInfo {
  id: string
  provider: ApiProvider | null
  key: string
  securityKey?: string // 安全密钥（Web JS API 2.0 需要）
  isValid: boolean
  validating?: boolean
}

export interface QueryProgress {
  progress: number
  message: string
}

export interface ValidationResult {
  isValid: boolean
  url?: string
  errorMessage?: string
}

// ===================== 通用配置 =====================

// API Provider 配置
export interface ProviderConfig {
  url: string
  keyParam: string
  validateParam: string // 验证用的参数
  validateValue: string // 验证用的值
  responseParser: (data: unknown) => Record<string, unknown>
}

export const PROVIDER_CONFIGS: Record<ApiProvider, ProviderConfig> = {
  gaode: {
    url: 'https://restapi.amap.com/v3/geocode/geo',
    keyParam: 'key',
    validateParam: 'address',
    validateValue: '北京市天安门',
    responseParser: (data: unknown) => {
      const result = data as Record<string, unknown>
      return { status: result.status, info: result.info }
    },
  },
}

// ===================== 通用工具函数 =====================

/**
 * 计算随机延迟时间
 */
export function getRandomDelay(
  delay: number,
  randomDelay: boolean,
  minRandomDelay?: number,
  maxRandomDelay?: number
): number {
  if (randomDelay && minRandomDelay !== undefined && maxRandomDelay !== undefined) {
    return delay + Math.random() * ((maxRandomDelay as number) - (minRandomDelay as number)) + (minRandomDelay as number)
  }
  return delay
}

/**
 * 构建 API URL
 */
export function buildApiUrl(baseUrl: string, params: Record<string, string | number>): string {
  const url = new URL(baseUrl)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  return url.toString()
}

// ===================== API Key 验证 =====================

/**
 * 验证 API Key 是否有效（通用版本）
 */
export async function validateApiKey(key: string, provider: ApiProvider): Promise<ValidationResult> {
  const config = PROVIDER_CONFIGS[provider]

  const params: Record<string, string | number> = {
    [config.keyParam]: key,
    [config.validateParam]: config.validateValue,
    output: 'json',
  }

  const url = buildApiUrl(config.url, params)

  try {
    const response = await axios.get(config.url, {
      params,
      timeout: 5000,
    })

    if (response.status === 200) {
      const data = response.data as Record<string, unknown>
      if (data.status === '1' || data.status === 1) {
        return { isValid: true, url }
      }
      return { isValid: false, url, errorMessage: `高德API返回状态: ${data.status}` }
    }
    return { isValid: false, url, errorMessage: 'HTTP状态码不为200' }
  } catch (error) {
    return { isValid: false, url, errorMessage: `请求失败: ${(error as Error).message}` }
  }
}

// ===================== 通用字段配置 =====================

export interface FieldOption {
  value: string
  label: string
}

export function getProviderOptions(): { value: ApiProvider; label: string }[] {
  return [{ value: 'gaode', label: '高德地图' }]
}

// ===================== 坐标工具函数 =====================

/**
 * 检查经纬度是否在矩形区域内
 */
export function isInBounds(
  lng: number,
  lat: number,
  bounds: { southwest: { lng: number; lat: number }; northeast: { lng: number; lat: number } }
): boolean {
  const { southwest, northeast } = bounds
  return (
    lng >= southwest.lng &&
    lng <= northeast.lng &&
    lat >= southwest.lat &&
    lat <= northeast.lat
  )
}

/**
 * 解析经纬度字符串
 */
export function parseLocation(locationStr: string): { lng: number; lat: number } | null {
  const parts = locationStr.split(',').map(Number)
  if (parts.length === 2) {
    const lng = parts[0]
    const lat = parts[1]
    if (lng !== undefined && lat !== undefined && !isNaN(lng) && !isNaN(lat)) {
      return { lng, lat }
    }
  }
  return null
}

// ===================== 数据导出 =====================

/**
 * 导出结果到行数组（通用版本）
 */
export function exportResultsToRows(
  headers: string[],
  results: Record<string, unknown>[],
  fieldConfigs: Record<string, (result: Record<string, unknown>) => string>
): string[][] {
  const rows: string[][] = [headers]

  for (const result of results) {
    const row: string[] = []
    for (const header of headers) {
      const config = fieldConfigs[header]
      if (config) {
        row.push(config(result))
      } else {
        row.push(String(result[header] ?? ''))
      }
    }
    rows.push(row)
  }

  return rows
}
