import { describe, it, expect } from 'vitest'
import type { EChartsOption } from 'echarts'
import {
  generateMagnitudeTimeChart,
  generateDepthChart,
  type ChartThemeColors,
} from '../earthquakeChart'

/**
 * 回归：散点图的 symbolSize 回调第一个参数是 data.value（数组），不是 data 对象。
 * 旧实现读 `data.mag` 得到 NaN，echarts 会把符号尺寸归一成 0，图上只剩坐标轴。
 */

const THEME: ChartThemeColors = {
  base100: '#fff',
  base200: '#eee',
  base300: '#ddd',
  baseContent: '#111',
  primary: '#0a0',
  secondary: '#00a',
  accent: '#a00',
}

const TIME = new Date('2026-11-08T00:00:00Z').getTime()

const DATA = {
  features: [
    {
      properties: { mag: 5, time: TIME, place: '测试地点' },
      geometry: { coordinates: [100, 30, 10] },
    },
  ],
} as never

type SymbolSizeFn = (value: unknown, params?: unknown) => number

function getSymbolSize(option: EChartsOption | null): SymbolSizeFn {
  expect(option).not.toBeNull()
  const series = (option!.series as { symbolSize?: unknown }[])[0]
  expect(typeof series?.symbolSize).toBe('function')
  return series?.symbolSize as SymbolSizeFn
}

describe('earthquakeChart 散点尺寸', () => {
  it('震级时间分布：从 params.data.mag 计算尺寸', () => {
    const fn = getSymbolSize(generateMagnitudeTimeChart(DATA, THEME))
    expect(fn([TIME, 5], { data: { mag: 5 } })).toBe(25)
  })

  it('震级时间分布：params 缺失时回退到 value 中的震级', () => {
    const fn = getSymbolSize(generateMagnitudeTimeChart(DATA, THEME))
    expect(fn([TIME, 6])).toBe(30)
  })

  it('震源深度分布：value 第二项是深度，震级只从 params.data 取', () => {
    const fn = getSymbolSize(generateDepthChart(DATA, THEME))
    expect(fn([TIME, 10], { data: { mag: 5 } })).toBe(20)
    expect(fn([TIME, 10])).toBe(8)
  })

  it('尺寸始终是有限数，不会产生 NaN', () => {
    const timeFn = getSymbolSize(generateMagnitudeTimeChart(DATA, THEME))
    const depthFn = getSymbolSize(generateDepthChart(DATA, THEME))
    for (const size of [
      timeFn([TIME, 5], { data: { mag: 5 } }),
      timeFn([TIME, 5]),
      depthFn([TIME, 10], { data: { mag: 5 } }),
      depthFn([TIME, 10]),
    ]) {
      expect(Number.isFinite(size)).toBe(true)
      expect(size).toBeGreaterThan(0)
    }
  })
})
