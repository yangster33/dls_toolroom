import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import EarthquakeQueryPage from '../EarthquakeQueryPage.vue'

/**
 * 回归点（2026-10-23）：查询结果为 0 条时，页面以前会留下一个 400px 的
 * 空白图表区（没有任何图表按钮，也没有提示）。现在应显示明确的空态。
 *
 * echarts 在 jsdom 里没有 canvas，这里 mock 掉；服务层也一并 mock，
 * 只验证「数据 → availableCharts → 模板分支」这条链。
 */

const { fetchEarthquakeDataMock } = vi.hoisted(() => ({
  fetchEarthquakeDataMock: vi.fn(),
}))

vi.mock('../earthquakeService', () => ({
  fetchEarthquakeData: fetchEarthquakeDataMock,
  downloadJson: vi.fn(),
  formatTime: (time: number) => String(time),
  getMagnitudeColor: () => '#22c55e',
  getMagnitudeLevel: () => '小震',
  magnitudeOptions: [{ value: '2', label: '2 级以上' }],
}))

vi.mock('echarts', () => ({
  init: vi.fn(),
  graphic: {
    LinearGradient: class LinearGradient {},
  },
}))

const emptyResponse = {
  type: 'FeatureCollection',
  metadata: { count: 0 },
  features: [],
}

const withOneFeature = {
  type: 'FeatureCollection',
  metadata: { count: 1 },
  features: [
    {
      id: 'us1',
      type: 'Feature',
      properties: {
        mag: 4.2,
        place: '某地',
        time: 1_700_000_000_000,
        url: 'https://example.com/event',
      },
      geometry: { type: 'Point', coordinates: [116.4, 39.9, 10] },
    },
  ],
}

const mountPage = () =>
  mount(EarthquakeQueryPage, {
    global: { stubs: { VueDatePicker: true } },
  })

/** jsdom 没有 ResizeObserver；useECharts 初始化时要用到 */
class ResizeObserverStub {
  observe() {}

  unobserve() {}

  disconnect() {}
}

beforeEach(() => {
  fetchEarthquakeDataMock.mockReset()
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EarthquakeQueryPage 图表空态', () => {
  it('查询结果为 0 条时显示空态，而不是空白图表区', async () => {
    fetchEarthquakeDataMock.mockResolvedValue({ success: true, data: emptyResponse })

    const wrapper = mountPage()
    await flushPromises()

    const vm = wrapper.vm as unknown as { queryEarthquake: () => Promise<void> }
    await vm.queryEarthquake()
    await flushPromises()

    expect(wrapper.text()).toContain('当前查询没有可绘制的图表数据')
    expect(wrapper.text()).not.toContain('震级时间分布')

    const chartAreas = wrapper.findAll('div.h-\\[400px\\]')
    expect(chartAreas).toHaveLength(1)
    expect(chartAreas[0]!.text()).toContain('当前查询没有可绘制的图表数据')

    wrapper.unmount()
  })

  it('有数据时渲染图表按钮和图表容器', async () => {
    fetchEarthquakeDataMock.mockResolvedValue({ success: true, data: withOneFeature })

    const wrapper = mountPage()
    await flushPromises()

    const vm = wrapper.vm as unknown as { queryEarthquake: () => Promise<void> }
    await vm.queryEarthquake()
    await flushPromises()

    expect(wrapper.text()).not.toContain('当前查询没有可绘制的图表数据')
    expect(wrapper.text()).toContain('震级时间分布')
    expect(wrapper.text()).toContain('震级分布统计')
    expect(wrapper.text()).toContain('震源深度分布')

    wrapper.unmount()
  })
})
