import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts'
import { CHART_FONT_FAMILY } from '@/utils/colorUtils'
import type { GdacsEvent } from './gdacsService'
import { getAlertLevelColor, getEventTypeLabel } from './gdacsService'

/**
 * echarts 不把回调参数类型（TopLevelFormatterParams / CallbackDataParams）
 * 从主入口导出，只在本包 types 内部声明。这里按本项目实际用到的字段声明
 * 最小类型，避免为此引入 `as any`。
 */
interface ChartCallbackParams {
  data?: unknown
}

/** 归一化回调参数：多序列时 echarts 传数组，取第一个 */
function normalizeCallback(raw: unknown): ChartCallbackParams | null {
  if (Array.isArray(raw)) return (raw[0] as ChartCallbackParams | undefined) ?? null
  if (raw !== null && typeof raw === 'object') return raw as ChartCallbackParams
  return null
}

/** 从回调参数取出 series data 并收窄为对象；非对象返回 null */
function extractSeriesData<T>(params: ChartCallbackParams): T | null {
  const raw = params.data
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as T
}

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

export function generateEventTypeChart(
  data: GdacsEvent[],
  theme: ChartThemeColors,
): EChartsOption | null {
  if (!data || data.length === 0) {
    return null
  }

  const typeCounts: Record<string, number> = {}
  data.forEach((event) => {
    typeCounts[event.type] = (typeCounts[event.type] || 0) + 1
  })

  const eventTypes = Object.keys(typeCounts)
  const counts = Object.values(typeCounts)
  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f97316', '#8b5cf6']

  return {
    backgroundColor: 'transparent',
    textStyle: {
      color: theme.baseContent,
      fontFamily: CHART_FONT_FAMILY,
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: oklchToHex(theme.base200),
      borderColor: oklchToHex(theme.base300),
      borderWidth: 1,
      textStyle: { color: theme.baseContent },
    },
    legend: {
      bottom: 0,
      textStyle: { color: theme.baseContent },
    },
    series: [
      {
        name: '事件类型',
        type: 'pie',
        radius: ['30%', '60%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: oklchToHex(theme.base100),
          borderWidth: 2,
        },
        label: {
          show: true,
          color: theme.baseContent,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
          },
        },
        data: eventTypes.map((type, index) => ({
          value: counts[index],
          name: getEventTypeLabel(type),
          itemStyle: { color: colors[index % colors.length] },
        })),
      },
    ],
  }
}

export function generateAlertLevelChart(
  data: GdacsEvent[],
  theme: ChartThemeColors,
): EChartsOption | null {
  if (!data || data.length === 0) {
    return null
  }

  const levelCounts: Record<string, number> = {}
  data.forEach((event) => {
    levelCounts[event.alertlevel] = (levelCounts[event.alertlevel] || 0) + 1
  })

  return {
    backgroundColor: 'transparent',
    textStyle: {
      color: theme.baseContent,
      fontFamily: CHART_FONT_FAMILY,
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
      data: Object.keys(levelCounts),
      axisLabel: {
        color: theme.baseContent,
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
        data: Object.entries(levelCounts).map(([level, count]) => ({
          value: count,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: getAlertLevelColor(level) },
              { offset: 1, color: getAlertLevelColor(level) + '80' },
            ]),
          },
        })),
        barWidth: '60%',
      },
    ],
  }
}

export function generateTimeChart(
  data: GdacsEvent[],
  theme: ChartThemeColors,
): EChartsOption | null {
  if (!data || data.length === 0) {
    return null
  }

  const sortedEvents = [...data].sort(
    (a, b) => new Date(a.fromdate).getTime() - new Date(b.fromdate).getTime(),
  )

  return {
    backgroundColor: 'transparent',
    textStyle: {
      color: theme.baseContent,
      fontFamily: CHART_FONT_FAMILY,
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: oklchToHex(theme.base200),
      borderColor: oklchToHex(theme.base300),
      borderWidth: 1,
      textStyle: { color: theme.baseContent },
      formatter: (raw: unknown) => {
        const ev = extractSeriesData<{
          title: string
          type: string
          alertlevel: string
          country: string
        }>(normalizeCallback(raw) ?? {})
        if (!ev) return ''
        return `
          <div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${ev.title}</div>
            <div>类型: ${getEventTypeLabel(ev.type)}</div>
            <div>级别: <span style="color: ${getAlertLevelColor(ev.alertlevel)}; font-weight: bold;">${ev.alertlevel}</span></div>
            <div>国家: ${ev.country}</div>
          </div>
        `
      },
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
      data: sortedEvents.map((event) => {
        const date = new Date(event.fromdate)
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
      }),
      axisLabel: {
        color: theme.baseContent,
        rotate: 45,
      },
      axisLine: { lineStyle: { color: theme.base300 } },
    },
    yAxis: {
      type: 'value',
      name: '事件',
      nameTextStyle: { color: theme.baseContent },
      axisLabel: { color: theme.baseContent, show: false },
      axisLine: { lineStyle: { color: theme.base300 } },
      splitLine: { lineStyle: { color: theme.base200 } },
    },
    series: [
      {
        type: 'scatter',
        data: sortedEvents.map((event, index) => ({
          value: [index, 1],
          title: event.title,
          type: event.type,
          alertlevel: event.alertlevel,
          country: event.country,
        })),
        symbolSize: 20,
        itemStyle: {
          color: (raw: unknown) => {
            const ev = extractSeriesData<{ alertlevel: string }>(normalizeCallback(raw) ?? {})
            return getAlertLevelColor(ev?.alertlevel ?? '')
          },
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.3)',
        },
      },
    ],
  }
}

export type ChartType = 'eventType' | 'alertLevel' | 'time'

export const chartConfigs: Record<
  ChartType,
  { title: string; generator: typeof generateEventTypeChart }
> = {
  eventType: { title: '事件类型分布', generator: generateEventTypeChart },
  alertLevel: { title: '警报级别统计', generator: generateAlertLevelChart },
  time: { title: '时间分布', generator: generateTimeChart },
}

export function getAvailableCharts(data: GdacsEvent[]): ChartType[] {
  const available: ChartType[] = []

  if (data && data.length > 0) {
    available.push('eventType', 'alertLevel', 'time')
  }

  return available
}
