import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, computed, h, nextTick, type PropType } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useECharts } from '../useECharts'

/**
 * `useECharts` 的两个回归点（2026-10-23）：
 *
 *  1. 页面用 `v-if="chartLoading"` 切占位，数据一变容器 div 就会被销毁重建。
 *     旧实现只记 `chartInitialized`，实例留在已移除的节点上 → canvas 不可见。
 *     现在必须按元素身份换绑。
 *  2. 容器首帧 0×0 时不能静默放弃（慢首屏 / hydration）——要重试，
 *     并在布局就绪后自动初始化；容器尺寸变化（侧边栏收合）要 resize。
 *
 * jsdom 没有 canvas / ResizeObserver，所以这里 mock 掉 echarts 并打桩 RO。
 */

interface FakeInstance {
  setOption: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
  getOption: ReturnType<typeof vi.fn>
}

const { instances, initMock } = vi.hoisted(() => {
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
  return { instances, initMock }
})

vi.mock('echarts', () => ({
  init: initMock,
  graphic: {
    LinearGradient: class LinearGradient {},
  },
}))

class ResizeObserverStub {
  static all: ResizeObserverStub[] = []
  element: Element | null = null

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.all.push(this)
  }

  observe(element: Element) {
    this.element = element
  }

  unobserve() {}

  disconnect() {
    this.element = null
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

interface Item {
  value: number
}

/** 用渲染函数而不是字符串模板：vitest 里只装了 Vue runtime，没有模板编译器 */
const TestChart = defineComponent({
  props: {
    data: {
      type: Object as PropType<Item | null>,
      default: null,
    },
    visible: {
      type: Boolean,
      default: true,
    },
  },
  setup(props, { expose }) {
    const data = computed(() => (props.data as Item | null) ?? null)
    const chart = useECharts<Item>({
      data,
      getChartOption: () => ({ series: [{ type: 'line', data: [1, 2, 3] }] }),
    })
    expose(chart)

    return () =>
      h('div', [
        chart.chartLoading.value
          ? h('span', { class: 'loading' })
          : props.visible
            ? h('div', { class: 'chart', ref: chart.chartContainer })
            : h('section', { class: 'placeholder' }),
      ])
  },
})

/** jsdom 里 clientWidth/Height 恒为 0，按用例改写原型 getter */
function stubContainerSize(width: number, height: number) {
  const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => width,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => height,
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
  ResizeObserverStub.all.length = 0

  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  // jsdom 的 rAF 在非可视环境下可能不跑，用 0ms timer 代替，测试里可直接等
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
})

afterEach(() => {
  restoreSize()
  restoreSize = () => {}
  vi.unstubAllGlobals()
})

describe('useECharts', () => {
  it('容器元素被替换后会 dispose 旧实例并在新元素上重新 init', async () => {
    restoreSize = stubContainerSize(800, 400)
    const wrapper = mount(TestChart, { props: { data: null } })

    await wrapper.setProps({ data: { value: 1 } })
    await flushPromises()

    expect(initMock).toHaveBeenCalledTimes(1)
    const firstElement = initMock.mock.calls[0]![0]
    expect(instances[0]!.setOption).toHaveBeenCalledTimes(1)

    // 模拟结果块整体 v-if 重建：旧 div 被移除，回来时是新的 DOM 元素
    await wrapper.setProps({ visible: false })
    await nextTick()
    await wrapper.setProps({ visible: true })
    await nextTick()

    const vm = wrapper.vm as unknown as { initChart: () => Promise<void> }
    await vm.initChart()
    await flushPromises()

    expect(instances[0]!.dispose).toHaveBeenCalledTimes(1)
    expect(initMock).toHaveBeenCalledTimes(2)
    expect(initMock.mock.calls[1]![0]).not.toBe(firstElement)
    expect(instances[1]!.setOption).toHaveBeenCalled()

    wrapper.unmount()
  })

  it('容器 0×0 时先不 init，布局就绪后自动重试', async () => {
    restoreSize = stubContainerSize(0, 0)
    const wrapper = mount(TestChart, { props: { data: { value: 1 } } })
    await flushPromises()

    expect(initMock).not.toHaveBeenCalled()

    // 布局完成（慢首屏 / hydration / 隐藏祖先变可见）
    restoreSize()
    restoreSize = stubContainerSize(800, 400)
    await new Promise((resolve) => setTimeout(resolve, 30))
    await flushPromises()

    expect(initMock).toHaveBeenCalledTimes(1)
    expect(instances[0]!.setOption).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('ResizeObserver 触发时对现有实例调用 resize()', async () => {
    restoreSize = stubContainerSize(800, 400)
    const wrapper = mount(TestChart, { props: { data: { value: 1 } } })
    await flushPromises()

    const observer = ResizeObserverStub.all.find((ro) => ro.element === initMock.mock.calls[0]![0])
    expect(observer).toBeTruthy()

    observer!.trigger()
    expect(instances[0]!.resize).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('数据置空时 dispose 实例并断开观察', async () => {
    restoreSize = stubContainerSize(800, 400)
    const wrapper = mount(TestChart, { props: { data: { value: 1 } } })
    await flushPromises()
    expect(initMock).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ data: null })
    await flushPromises()

    expect(instances[0]!.dispose).toHaveBeenCalledTimes(1)
    const observer = ResizeObserverStub.all.find((ro) => ro.element === initMock.mock.calls[0]![0])
    expect(observer?.element ?? null).toBeNull()

    wrapper.unmount()
  })
})
