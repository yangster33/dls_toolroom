import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts'
import type { WeatherApiResponse } from './weatherHistoryService'
import { parseOklch, oklchToHex } from '@/utils/colorUtils'

export interface ChartThemeColors {
  base100: string
  base200: string
  base300: string
  baseContent: string
  primary: string
  secondary: string
  accent: string
}

export function generateTemperatureChart(
  data: WeatherApiResponse,
  theme: ChartThemeColors
): EChartsOption {
  const hourly = data.hourly
  if (!hourly?.time || !hourly.temperature_2m) {
    return {}
  }

  return {
    backgroundColor: 'transparent',
    textStyle: {
      color: theme.baseContent,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: oklchToHex(theme.base200),
      borderColor: oklchToHex(theme.base300),
      borderWidth: 1,
      textStyle: { color: theme.baseContent },
    },
    legend: {
      data: ['气温'],
      bottom: 0,
      textStyle: { color: theme.baseContent },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: hourly.time.map((t) => t.substring(0, 16).replace('T', ' ')),
      axisLabel: {
        color: theme.baseContent,
        rotate: 45,
        interval: Math.floor(hourly.time.length / 10),
      },
      axisLine: { lineStyle: { color: theme.base300 } },
    },
    yAxis: {
      type: 'value',
      name: '温度 (°C)',
      nameTextStyle: { color: theme.baseContent },
      axisLabel: { color: theme.baseContent },
      axisLine: { lineStyle: { color: theme.base300 } },
      splitLine: { lineStyle: { color: theme.base200 } },
    },
    series: [
      {
        name: '气温',
        type: 'line',
        data: hourly.temperature_2m,
        smooth: true,
        lineStyle: { color: theme.primary, width: 2 },
        itemStyle: { color: theme.primary },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: oklchToHex(theme.primary) + '40' },
            { offset: 1, color: oklchToHex(theme.primary) + '05' },
          ]),
        },
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
      },
    ],
  }
}

export function generatePrecipitationChart(
  data: WeatherApiResponse,
  theme: ChartThemeColors
): EChartsOption {
  const daily = data.daily
  if (!daily?.time || !daily.precipitation_sum) {
    return {}
  }

  return {
    backgroundColor: 'transparent',
    textStyle: {
      color: theme.baseContent,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: oklchToHex(theme.base200),
      borderColor: oklchToHex(theme.base300),
      borderWidth: 1,
      textStyle: { color: theme.baseContent },
    },
    legend: {
      data: ['日降水量'],
      bottom: 0,
      textStyle: { color: theme.baseContent },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: daily.time,
      axisLabel: {
        color: theme.baseContent,
        rotate: 45,
      },
      axisLine: { lineStyle: { color: theme.base300 } },
    },
    yAxis: {
      type: 'value',
      name: '降水量 (mm)',
      nameTextStyle: { color: theme.baseContent },
      axisLabel: { color: theme.baseContent },
      axisLine: { lineStyle: { color: theme.base300 } },
      splitLine: { lineStyle: { color: theme.base200 } },
    },
    series: [
      {
        name: '日降水量',
        type: 'bar',
        data: daily.precipitation_sum,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: theme.secondary },
            { offset: 1, color: oklchToHex(theme.secondary) + '80' },
          ]),
        },
        barWidth: '60%',
      },
    ],
  }
}

export function generateHumidityChart(
  data: WeatherApiResponse,
  theme: ChartThemeColors
): EChartsOption {
  const hourly = data.hourly
  if (!hourly?.time || !hourly.relative_humidity_2m) {
    return {}
  }

  return {
    backgroundColor: 'transparent',
    textStyle: {
      color: theme.baseContent,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: oklchToHex(theme.base200),
      borderColor: oklchToHex(theme.base300),
      borderWidth: 1,
      textStyle: { color: theme.baseContent },
    },
    legend: {
      data: ['相对湿度'],
      bottom: 0,
      textStyle: { color: theme.baseContent },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: hourly.time.map((t) => t.substring(0, 16).replace('T', ' ')),
      axisLabel: {
        color: theme.baseContent,
        rotate: 45,
        interval: Math.floor(hourly.time.length / 10),
      },
      axisLine: { lineStyle: { color: theme.base300 } },
    },
    yAxis: {
      type: 'value',
      name: '湿度 (%)',
      min: 0,
      max: 100,
      nameTextStyle: { color: theme.baseContent },
      axisLabel: { color: theme.baseContent },
      axisLine: { lineStyle: { color: theme.base300 } },
      splitLine: { lineStyle: { color: theme.base200 } },
    },
    series: [
      {
        name: '相对湿度',
        type: 'line',
        data: hourly.relative_humidity_2m,
        smooth: true,
        lineStyle: { color: theme.accent, width: 2 },
        itemStyle: { color: theme.accent },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: oklchToHex(theme.accent) + '40' },
            { offset: 1, color: oklchToHex(theme.accent) + '05' },
          ]),
        },
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
      },
    ],
  }
}

export function generateWindSpeedChart(
  data: WeatherApiResponse,
  theme: ChartThemeColors
): EChartsOption {
  const hourly = data.hourly
  if (!hourly?.time || !hourly.wind_speed_10m) {
    return {}
  }

  return {
    backgroundColor: 'transparent',
    textStyle: {
      color: theme.baseContent,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: oklchToHex(theme.base200),
      borderColor: oklchToHex(theme.base300),
      borderWidth: 1,
      textStyle: { color: theme.baseContent },
    },
    legend: {
      data: ['风速'],
      bottom: 0,
      textStyle: { color: theme.baseContent },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: hourly.time.map((t) => t.substring(0, 16).replace('T', ' ')),
      axisLabel: {
        color: theme.baseContent,
        rotate: 45,
        interval: Math.floor(hourly.time.length / 10),
      },
      axisLine: { lineStyle: { color: theme.base300 } },
    },
    yAxis: {
      type: 'value',
      name: '风速 (km/h)',
      nameTextStyle: { color: theme.baseContent },
      axisLabel: { color: theme.baseContent },
      axisLine: { lineStyle: { color: theme.base300 } },
      splitLine: { lineStyle: { color: theme.base200 } },
    },
    series: [
      {
        name: '风速',
        type: 'line',
        data: hourly.wind_speed_10m,
        smooth: true,
        lineStyle: { color: theme.primary, width: 2 },
        itemStyle: { color: theme.primary },
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
      },
    ],
  }
}

export function generateTemperatureRangeChart(
  data: WeatherApiResponse,
  theme: ChartThemeColors
): EChartsOption {
  const daily = data.daily
  if (!daily?.time || !daily.temperature_2m_max || !daily.temperature_2m_min) {
    return {}
  }

  return {
    backgroundColor: 'transparent',
    textStyle: {
      color: theme.baseContent,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: oklchToHex(theme.base200),
      borderColor: oklchToHex(theme.base300),
      borderWidth: 1,
      textStyle: { color: theme.baseContent },
    },
    legend: {
      data: ['最高气温', '最低气温'],
      bottom: 0,
      textStyle: { color: theme.baseContent },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: daily.time,
      axisLabel: {
        color: theme.baseContent,
        rotate: 45,
      },
      axisLine: { lineStyle: { color: theme.base300 } },
    },
    yAxis: {
      type: 'value',
      name: '温度 (°C)',
      nameTextStyle: { color: theme.baseContent },
      axisLabel: { color: theme.baseContent },
      axisLine: { lineStyle: { color: theme.base300 } },
      splitLine: { lineStyle: { color: theme.base200 } },
    },
    series: [
      {
        name: '最高气温',
        type: 'line',
        data: daily.temperature_2m_max,
        smooth: true,
        lineStyle: { color: theme.primary, width: 2 },
        itemStyle: { color: theme.primary },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: oklchToHex(theme.primary) + '30' },
            { offset: 1, color: oklchToHex(theme.primary) + '05' },
          ]),
        },
        symbol: 'circle',
        symbolSize: 6,
      },
      {
        name: '最低气温',
        type: 'line',
        data: daily.temperature_2m_min,
        smooth: true,
        lineStyle: { color: theme.secondary, width: 2 },
        itemStyle: { color: theme.secondary },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: oklchToHex(theme.secondary) + '30' },
            { offset: 1, color: oklchToHex(theme.secondary) + '05' },
          ]),
        },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  }
}

export type ChartType = 'temperature' | 'precipitation' | 'humidity' | 'wind' | 'tempRange'

export const chartConfigs: Record<ChartType, { title: string; generator: typeof generateTemperatureChart }> = {
  temperature: { title: '气温趋势（逐小时）', generator: generateTemperatureChart },
  precipitation: { title: '日降水量', generator: generatePrecipitationChart },
  humidity: { title: '相对湿度（逐小时）', generator: generateHumidityChart },
  wind: { title: '风速（逐小时）', generator: generateWindSpeedChart },
  tempRange: { title: '最高/最低气温（日）', generator: generateTemperatureRangeChart },
}

export function getAvailableCharts(data: WeatherApiResponse): ChartType[] {
  const available: ChartType[] = []

  if (data.hourly?.temperature_2m) {
    available.push('temperature')
  }
  if (data.daily?.precipitation_sum) {
    available.push('precipitation')
  }
  if (data.hourly?.relative_humidity_2m) {
    available.push('humidity')
  }
  if (data.hourly?.wind_speed_10m) {
    available.push('wind')
  }
  if (data.daily?.temperature_2m_max && data.daily?.temperature_2m_min) {
    available.push('tempRange')
  }

  return available
}
