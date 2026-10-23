import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'

export interface UseEChartsOptions<T> {
  data: { value: T | null }
  getChartOption: (data: T, theme: Record<string, string>) => EChartsOption | null
  themeVariables?: Record<string, () => string>
}

/**
 * 首帧布局未完成时的重试上限。
 * 慢首屏通常一两帧就好了；超过上限就交给 ResizeObserver / window resize，
 * 避免容器长期 0×0（例如祖先 display:none）时空转 requestAnimationFrame。
 */
const MAX_LAYOUT_RETRY = 10

export function useECharts<T>(options: UseEChartsOptions<T>) {
  const { data, getChartOption, themeVariables = {} } = options
  const chartContainer = ref<HTMLDivElement | null>(null)
  const chartLoading = ref(false)

  let chartInstance: ECharts | null = null
  /**
   * 实例绑定在哪个 DOM 上。
   * 页面用 `v-if="chartLoading"` 切换占位，数据一变容器就会被销毁重建；
   * 只记 `chartInitialized` 会导致实例留在已移除的节点上（canvas 不可见），
   * 所以这里必须记住元素身份，重建后换绑。
   */
  let chartElement: HTMLDivElement | null = null
  let resizeObserver: ResizeObserver | null = null
  let observedElement: HTMLDivElement | null = null
  let retryFrame = 0
  let retryCount = 0

  const hasLayout = (el: HTMLElement): boolean => el.clientWidth > 0 && el.clientHeight > 0

  const cancelRetry = () => {
    if (retryFrame) {
      cancelAnimationFrame(retryFrame)
      retryFrame = 0
    }
  }

  const updateChart = async () => {
    await nextTick()
    if (!chartInstance || data.value === null) return
    const theme: Record<string, string> = Object.fromEntries(
      Object.entries(themeVariables).map(([key, getter]) => [key, getter()]),
    )
    const option = getChartOption(data.value, theme)
    if (option) {
      chartInstance.setOption(option, true)
    }
  }

  function observeElement(el: HTMLDivElement) {
    if (observedElement === el) return
    resizeObserver?.disconnect()
    observedElement = el
    resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    resizeObserver.observe(el)
  }

  async function initChart() {
    const el = chartContainer.value
    if (!el || data.value === null) return

    // 容器被 v-if 重建：旧实例绑在已移除的节点上，必须重来
    if (chartInstance && chartElement !== el) {
      disposeChart()
    }

    // 即使还没尺寸也要先观察，等布局出来（隐藏 tab / 慢首屏 / hydration）自动初始化
    observeElement(el)

    if (!chartInstance) {
      if (!hasLayout(el)) {
        if (retryCount >= MAX_LAYOUT_RETRY) return
        retryCount += 1
        cancelRetry()
        retryFrame = requestAnimationFrame(() => {
          retryFrame = 0
          void initChart()
        })
        return
      }
      chartInstance = echarts.init(el)
      chartElement = el
      retryCount = 0
    } else {
      chartInstance.resize()
    }

    await updateChart()
  }

  function disposeChart() {
    cancelRetry()
    retryCount = 0
    if (chartInstance) {
      chartInstance.dispose()
      chartInstance = null
    }
    chartElement = null
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
      observedElement = null
    }
  }

  /** 容器尺寸变化（窗口 resize、侧边栏收合、布局抖动）统一走这里 */
  function handleResize() {
    const el = chartContainer.value
    if (!el) return
    if (!chartInstance || chartElement !== el) {
      void initChart()
      return
    }
    chartInstance.resize()
  }

  const handleDataChange = async (newData: T | null) => {
    cancelRetry()
    retryCount = 0
    if (!newData) {
      disposeChart()
      return
    }
    disposeChart()
    chartLoading.value = true
    await nextTick()
    chartLoading.value = false
    await nextTick()
    await initChart()
  }

  const handleThemeChange = () => {
    if (chartInstance) void updateChart()
  }

  watch(() => data.value, handleDataChange)

  if (Object.keys(themeVariables).length > 0) {
    watch(Object.values(themeVariables), handleThemeChange)
  }

  onMounted(() => {
    if (data.value !== null) void initChart()
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    disposeChart()
  })

  return {
    chartContainer,
    chartLoading,
    initChart,
    disposeChart,
  }
}
