import { describe, it, expect } from 'vitest'
import { generateTemperatureChart, generatePrecipitationChart } from '../weatherHistoryChart'
import {
  generateMagnitudeTimeChart,
  generateDepthChart,
} from '@/tools/earthquake_query/earthquakeChart'
import type { WeatherApiResponse } from '@/tools/weather_history/weatherHistoryService'

/**
 * 审计报告 P1-10 的回归测试
 *
 * `useECharts` 的判断是 `if (option) { setOption(option, true) }`。
 * 旧实现在缺数据时 `return {}` —— `{}` 是 truthy，于是
 * `setOption({}, true)` 带 notMerge=true 执行，把上一个已经渲染好的
 * 图表清成空白，且没有任何错误提示。
 *
 * 现在约定：缺数据一律返回 null。
 */

const THEME = {
  base100: '#fff',
  base200: '#eee',
  base300: '#ddd',
  baseContent: '#111',
  primary: '#f00',
  secondary: '#0f0',
  accent: '#00f',
}

/** 空的 API 响应（各字段均缺失） */
const EMPTY_RESPONSE = {} as WeatherApiResponse

describe('weatherChart 缺数据返回 null（P1-10）', () => {
  it('缺 hourly.temperature_2m → null，不是 {}', () => {
    const r = generateTemperatureChart(EMPTY_RESPONSE, THEME)
    expect(r).toBeNull()
  })

  it('缺 daily.precipitation_sum → null', () => {
    const r = generatePrecipitationChart(EMPTY_RESPONSE, THEME)
    expect(r).toBeNull()
  })

  it('返回 null 时 `if (option)` 不成立，不会清空上一个图表', () => {
    // 直接验证 useECharts 用的判断逻辑
    const option = generateTemperatureChart(EMPTY_RESPONSE, THEME)
    expect(option).toBeFalsy() // {} 是 truthy 会通过，null 不会
  })
})

describe('earthquakeChart 缺数据返回 null（P1-10）', () => {
  it('空 features → null', () => {
    const r = generateMagnitudeTimeChart({ features: [] } as never, THEME)
    expect(r).toBeNull()
    const r2 = generateDepthChart({ features: [] } as never, THEME)
    expect(r2).toBeNull()
  })
})
