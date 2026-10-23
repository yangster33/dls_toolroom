import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DlsChart from '../DlsChart.vue'

/**
 * `DlsChart` 的回归点（2026-10-23）：
 *
 * 旧实现用 `Promise.all([fetchMapData(), fetch('/map/china.json')])`，
 * `/api/map-data` 一挂（开发环境后端没起、线上统计接口抖动）整张地图就被
 * 替换成"地图数据加载失败"。访问统计只是着色数据，不该决定地图能不能画。
 *
 * 这里 mock 掉 echarts，只验证：
 *  1. 统计接口 502 时地图边界仍然注册并 init；
 *  2. 没有省份数据时给出明确提示，而不是让用户看到一张"没上色"的图。
 */

interface FakeInstance {
  setOption: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
  getOption: ReturnType<typeof vi.fn>
}

const { instances, initMock, registerMapMock } = vi.hoisted(() => {
  const instances: FakeInstance[] = []
  const initMock = vi.fn((_el: HTMLElement): FakeInstance => {
    const instance: FakeInstance = {
      setOption: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
      getOption: vi.fn(() => ({})),
    }
    instances.push(instance)
    return instance
  })
  return { instances, initMock, registerMapMock: vi.fn() }
})

vi.mock('echarts', () => ({
  init: initMock,
  registerMap: registerMapMock,
}))

class ResizeObserverStub {
  observe() {}

  unobserve() {}

  disconnect() {}
}

const GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: '广东省' },
      geometry: { type: 'Polygon', coordinates: [] },
    },
  ],
}

const okJson = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
})

function stubContainerSize() {
  const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 800,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 500,
  })
  return () => {
    if (originalWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalWidth)
    if (originalHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalHeight)
  }
}

let restoreSize: () => void = () => {}

beforeEach(() => {
  instances.length = 0
  initMock.mockClear()
  registerMapMock.mockClear()
  restoreSize = stubContainerSize()
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  // 统计接口失败会在 dev 下打 warn，测试里静音
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  restoreSize()
  restoreSize = () => {}
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('DlsChart', () => {
  it('统计接口失败时地图仍然渲染，并提示暂无省份数据', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/map/china.json')) return Promise.resolve(okJson(GEOJSON))
      return Promise.resolve({ ok: false, status: 502, json: async () => ({}) })
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(DlsChart, { props: { toolId: 'weather_history' } })
    await flushPromises()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/map/china.json')
    expect(registerMapMock).toHaveBeenCalledWith('china', GEOJSON)
    expect(initMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).not.toContain('地图数据加载失败')
    expect(wrapper.text()).toContain('暂无省份访问数据')

    wrapper.unmount()
  })

  it('统计接口有数据时按结构过滤后再交给图表', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/map/china.json')) return Promise.resolve(okJson(GEOJSON))
      return Promise.resolve(
        okJson({
          code: 0,
          data: [
            { name: '广东省', sevenDays: 1, thirtyDays: 2, oneYear: 3 },
            // 字段缺失的脏数据应被丢掉，不能变成 undefined 进入 series
            { name: '坏数据' },
          ],
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(DlsChart, { props: { toolId: 'weather_history' } })
    await flushPromises()
    await flushPromises()

    const calls = instances[0]!.setOption.mock.calls
    const lastOption = calls[calls.length - 1]?.[0] as {
      series: Array<{ data: Array<{ name: string }> }>
    }
    expect(lastOption.series[0]!.data).toEqual([{ name: '广东省', value: 3 }])
    expect(wrapper.text()).not.toContain('暂无省份访问数据')

    wrapper.unmount()
  })

  it('地图边界加载失败时仍显示错误提示', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/map/china.json')) {
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
      }
      return Promise.resolve(okJson({ code: 0, data: [] }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(DlsChart, { props: { toolId: 'weather_history' } })
    await flushPromises()
    await flushPromises()

    expect(registerMapMock).not.toHaveBeenCalled()
    expect(initMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('地图数据加载失败')

    wrapper.unmount()
  })
})
