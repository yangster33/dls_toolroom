export interface WeatherVariable {
  key: string
  label: string
}

export const availableVariables: WeatherVariable[] = [
  { key: 'temperature_2m', label: '气温' },
  { key: 'relative_humidity_2m', label: '相对湿度' },
  { key: 'precipitation', label: '降水量' },
  { key: 'rain', label: '降雨' },
  { key: 'snowfall', label: '降雪' },
  { key: 'wind_speed_10m', label: '风速' },
  { key: 'wind_direction_10m', label: '风向' },
  { key: 'cloud_cover', label: '云量' },
  { key: 'pressure_msl', label: '海平面气压' },
  { key: 'shortwave_radiation', label: '太阳辐射' },
]

export interface WeatherFormData {
  longitude: string
  latitude: string
  startDate: string
  endDate: string
}

export interface HourlyData {
  time: string[]
  temperature_2m?: number[]
  relative_humidity_2m?: number[]
  precipitation?: number[]
  rain?: number[]
  snowfall?: number[]
  wind_speed_10m?: number[]
  wind_direction_10m?: number[]
  cloud_cover?: number[]
  pressure_msl?: number[]
  shortwave_radiation?: number[]
}

export interface DailyData {
  time: string[]
  temperature_2m_max?: number[]
  temperature_2m_min?: number[]
  precipitation_sum?: number[]
}

export interface WeatherApiResponse {
  latitude: number
  longitude: number
  generationtime_ms: number
  utc_offset_seconds: number
  timezone: string
  timezone_abbreviation: string
  elevation: number
  hourly?: HourlyData
  daily?: DailyData
}

export interface QueryResult {
  success: boolean
  data?: WeatherApiResponse
  error?: string
}

export async function fetchWeatherHistory(
  formData: WeatherFormData,
  variables: string[]
): Promise<QueryResult> {
  const params = new URLSearchParams({
    latitude: formData.latitude,
    longitude: formData.longitude,
    start_date: formData.startDate,
    end_date: formData.endDate,
    hourly: variables.join(','),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'Asia/Shanghai',
  })

  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`
    const response = await fetch(url)

    if (!response.ok) {
      return {
        success: false,
        error: `请求失败: HTTP ${response.status}`,
      }
    }

    const data: WeatherApiResponse = await response.json()

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

export function downloadJson(data: WeatherApiResponse, filename: string = 'weather_history.json'): void {
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
