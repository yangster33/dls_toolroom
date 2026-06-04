export interface EarthquakeFeature {
  type: string
  properties: {
    mag: number
    place: string
    time: number
    updated: number
    tz: number | null
    url: string
    detail: string
    felt: number | null
    cdi: number | null
    mmi: number | null
    alert: string | null
    status: string
    tsunami: number
    sig: number
    net: string
    code: string
    ids: string
    sources: string
    types: string
    nst: number | null
    dmin: number | null
    rms: number | null
    gap: number | null
    magType: string
    type: string
    title: string
  }
  geometry: {
    type: string
    coordinates: [number, number, number]
  }
  id: string
}

export interface EarthquakeApiResponse {
  type: string
  metadata: {
    generated: number
    url: string
    title: string
    status: number
    api: string
    count: number
  }
  features: EarthquakeFeature[]
  bbox: [number, number, number, number, number, number]
}

export interface EarthquakeFormData {
  startDate: string
  endDate: string
  minMagnitude: string
  maxMagnitude: string
  latitude: string
  longitude: string
  radius: string
}

export interface QueryResult {
  success: boolean
  data?: EarthquakeApiResponse
  error?: string
}

export const magnitudeOptions = [
  { value: '', label: '不限' },
  { value: '0', label: '0 级及以上' },
  { value: '1', label: '1 级及以上' },
  { value: '2', label: '2 级及以上' },
  { value: '3', label: '3 级及以上' },
  { value: '4', label: '4 级及以上' },
  { value: '5', label: '5 级及以上' },
  { value: '6', label: '6 级及以上' },
  { value: '7', label: '7 级及以上' },
  { value: '8', label: '8 级及以上' },
]

export async function fetchEarthquakeData(
  formData: EarthquakeFormData
): Promise<QueryResult> {
  const params = new URLSearchParams({
    format: 'geojson',
    starttime: formData.startDate,
    endtime: formData.endDate,
  })

  if (formData.minMagnitude) {
    params.set('minmagnitude', formData.minMagnitude)
  }

  if (formData.maxMagnitude) {
    params.set('maxmagnitude', formData.maxMagnitude)
  }

  if (formData.latitude && formData.longitude) {
    params.set('latitude', formData.latitude)
    params.set('longitude', formData.longitude)
    params.set('maxradiuskm', formData.radius || '100')
  }

  params.set('limit', '2000')

  try {
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?${params.toString()}`
    const response = await fetch(url)

    if (!response.ok) {
      return {
        success: false,
        error: `请求失败: HTTP ${response.status}`,
      }
    }

    const data: EarthquakeApiResponse = await response.json()

    return {
      success: true,
      data,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '网络请求失败',
    }
  }
}

export function downloadJson(data: EarthquakeApiResponse, filename: string = 'earthquake_data.json'): void {
  const jsonStr = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function getMagnitudeColor(mag: number): string {
  if (mag >= 8) return '#dc2626'
  if (mag >= 7) return '#ef4444'
  if (mag >= 6) return '#f97316'
  if (mag >= 5) return '#f59e0b'
  if (mag >= 4) return '#eab308'
  if (mag >= 3) return '#84cc16'
  if (mag >= 2) return '#22c55e'
  return '#8b5cf6'
}

export function getMagnitudeLevel(mag: number): string {
  if (mag >= 8) return '特大地震'
  if (mag >= 7) return '大地震'
  if (mag >= 6) return '强震'
  if (mag >= 5) return '中强震'
  if (mag >= 4) return '中震'
  if (mag >= 3) return '弱震'
  if (mag >= 1) return '微震'
  return '极微震'
}