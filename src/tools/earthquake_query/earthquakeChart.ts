import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts'
import type { EarthquakeApiResponse } from './earthquakeService'

export interface ChartThemeColors {
  base100: string
  base200: string
  base300: string
  baseContent: string
  primary: string
  secondary: string
  accent: string
}

interface OklchParts {
  L: number
  C: number
  H: number
}

export function parseOklch(color: string): OklchParts | null {
  const match = color.match(/oklch\(([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\)/)
  if (!match) return null
  let L = parseFloat(match[1]!)
  if (match[2] === '%' || L > 1) L = L / 100
  return {
    L,
    C: parseFloat(match[3]!),
    H: parseFloat(match[4]!),
  }
}

export function oklchToHex(color: string): string {
  const parts = parseOklch(color)
  if (!parts) return color

  const { L, C, H } = parts
  const hRad = (H * Math.PI) / 180
  const a = C * Math.cos(hRad)
  const b = C * Math.sin(hRad)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l3 = l_ * l_ * l_
  const m3 = m_ * m_ * m_
  const s3 = s_ * s_ * s_

  let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

  const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

  r = gamma(r)
  g = gamma(g)
  bl = gamma(bl)

  const hex = (c: number) => {
    const v = Math.round(Math.max(0, Math.min(1, c)) * 255)
    return v.toString(16).padStart(2, '0')
  }
  return `#${hex(r)}${hex(g)}${hex(bl)}`
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

export function generateMagnitudeTimeChart(
  data: EarthquakeApiResponse,
  theme: ChartThemeColors
): EChartsOption {
  const features = data.features
  if (!features || features.length === 0) {
    return {}
  }

  const sortedFeatures = [...features].sort((a, b) => a.properties.time - b.properties.time)

  const dateStrings = sortedFeatures.map((f) =>
    new Date(f.properties.time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  )

  const seriesData = sortedFeatures.map((f, i) => ({
    name: dateStrings[i]!,
    value: [dateStrings[i]!, f.properties.mag],
    mag: f.properties.mag,
    time: new Date(f.properties.time).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    place: f.properties.place,
  }))

  return {
    backgroundColor: 'transparent',
    textStyle: {
      color: theme.baseContent,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: oklchToHex(theme.base200),
      borderColor: oklchToHex(theme.base300),
      borderWidth: 1,
      textStyle: { color: theme.baseContent },
      formatter: (params: { data: { mag: number; time: string; place: string } }) => {
        return `
          <div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${params.data.place}</div>
            <div>震级: <span style="color: ${getMagnitudeColor(params.data.mag)}; font-weight: bold;">${params.data.mag}</span></div>
            <div>时间: ${params.data.time}</div>
          </div>
        `
      },
    } as any,
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dateStrings,
      axisLabel: {
        color: theme.baseContent,
        rotate: 45,
      },
      axisLine: { lineStyle: { color: theme.base300 } },
    },
    yAxis: {
      type: 'value',
      name: '震级',
      nameTextStyle: { color: theme.baseContent },
      axisLabel: { color: theme.baseContent },
      axisLine: { lineStyle: { color: theme.base300 } },
      splitLine: { lineStyle: { color: theme.base200 } },
      min: 0,
      max: 10,
    },
    series: [
      {
        type: 'scatter',
        data: seriesData,
        symbolSize: (data: { mag: number }) => Math.max(10, data.mag * 5),
        itemStyle: {
          color: (params: { data: { mag: number } }) => getMagnitudeColor(params.data.mag),
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.3)',
        },
      },
    ] as any,
  }
}

export function generateMagnitudeDistributionChart(
  data: EarthquakeApiResponse,
  theme: ChartThemeColors
): EChartsOption {
  const features = data.features
  if (!features || features.length === 0) {
    return {}
  }

  const bins = [
    { min: 0, max: 2, label: '0-2级' },
    { min: 2, max: 3, label: '2-3级' },
    { min: 3, max: 4, label: '3-4级' },
    { min: 4, max: 5, label: '4-5级' },
    { min: 5, max: 6, label: '5-6级' },
    { min: 6, max: 7, label: '6-7级' },
    { min: 7, max: 8, label: '7-8级' },
    { min: 8, max: 10, label: '8级+' },
  ]

  const counts = bins.map((bin) =>
    features.filter((f) => f.properties.mag >= bin.min && f.properties.mag < bin.max).length
  )

  const colors = ['#8b5cf6', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#dc2626']

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
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: bins.map((b) => b.label),
      axisLabel: {
        color: theme.baseContent,
        rotate: 45,
      },
      axisLine: { lineStyle: { color: theme.base300 } },
    },
    yAxis: {
      type: 'value',
      name: '数量',
      nameTextStyle: { color: theme.baseContent },
      axisLabel: { color: theme.baseContent },
      axisLine: { lineStyle: { color: theme.base300 } },
      splitLine: { lineStyle: { color: theme.base200 } },
    },
    series: [
      {
        type: 'bar',
        data: counts.map((count, index) => ({
          value: count,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: colors[index!]! },
              { offset: 1, color: colors[index!]! + '80' },
            ]),
          },
        })),
        barWidth: '60%',
      },
    ],
  }
}

export function generateDepthChart(
  data: EarthquakeApiResponse,
  theme: ChartThemeColors
): EChartsOption {
  const features = data.features
  if (!features || features.length === 0) {
    return {}
  }

  const sortedFeatures = [...features].sort((a, b) => a.properties.time - b.properties.time)

  const dateStrings = sortedFeatures.map((f) =>
    new Date(f.properties.time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  )

  const seriesData = sortedFeatures.map((f, i) => ({
    name: dateStrings[i]!,
    value: [dateStrings[i]!, f.geometry.coordinates[2]],
    mag: f.properties.mag,
    depth: f.geometry.coordinates[2],
    time: new Date(f.properties.time).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }))

  return {
    backgroundColor: 'transparent',
    textStyle: {
      color: theme.baseContent,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: oklchToHex(theme.base200),
      borderColor: oklchToHex(theme.base300),
      borderWidth: 1,
      textStyle: { color: theme.baseContent },
      formatter: (params: { data: { mag: number; depth: number; time: string } }) => {
        return `
          <div style="padding: 8px;">
            <div>震级: <span style="color: ${getMagnitudeColor(params.data.mag)}; font-weight: bold;">${params.data.mag}</span></div>
            <div>深度: ${params.data.depth} km</div>
            <div>时间: ${params.data.time}</div>
          </div>
        `
      },
    } as any,
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dateStrings,
      axisLabel: {
        color: theme.baseContent,
        rotate: 45,
      },
      axisLine: { lineStyle: { color: theme.base300 } },
    },
    yAxis: {
      type: 'value',
      name: '深度 (km)',
      nameTextStyle: { color: theme.baseContent },
      axisLabel: { color: theme.baseContent },
      axisLine: { lineStyle: { color: theme.base300 } },
      splitLine: { lineStyle: { color: theme.base200 } },
      inverse: true,
    },
    series: [
      {
        type: 'scatter',
        data: seriesData,
        symbolSize: (data: { mag: number }) => Math.max(8, data.mag * 4),
        itemStyle: {
          color: (params: { data: { mag: number } }) => getMagnitudeColor(params.data.mag),
          shadowBlur: 8,
          shadowColor: 'rgba(0, 0, 0, 0.2)',
        },
      },
    ] as any,
  }
}

export type ChartType = 'magnitudeTime' | 'magnitudeDist' | 'depth'

export const chartConfigs: Record<ChartType, { title: string; generator: typeof generateMagnitudeTimeChart }> = {
  magnitudeTime: { title: '震级时间分布', generator: generateMagnitudeTimeChart },
  magnitudeDist: { title: '震级分布统计', generator: generateMagnitudeDistributionChart },
  depth: { title: '震源深度分布', generator: generateDepthChart },
}

export function getAvailableCharts(data: EarthquakeApiResponse): ChartType[] {
  const available: ChartType[] = []

  if (data.features && data.features.length > 0) {
    available.push('magnitudeTime', 'magnitudeDist', 'depth')
  }

  return available
}