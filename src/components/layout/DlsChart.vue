<template>
  <div>
    <h2 class="panel-title">中国各省访问量分布图</h2>
    <p class="panel-sub mb-6">鼠标悬停查看各省份的访问数据统计</p>

    <div v-if="mapLoading" class="w-full h-[500px] flex flex-col items-center justify-center gap-3">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <span class="text-base-content/60 text-sm">正在加载地图数据...</span>
    </div>

    <div
      v-else-if="mapError"
      class="w-full h-[500px] flex flex-col items-center justify-center gap-3"
    >
      <span class="text-error text-4xl">&#9888;</span>
      <span class="text-base-content/70">地图数据加载失败，请刷新页面重试</span>
    </div>

    <div v-else ref="chartContainer" class="w-full h-[500px]"></div>

    <p
      v-if="!mapLoading && !mapError && mapDataLoaded && currentProvinceData.length === 0"
      class="text-xs text-base-content/50 mt-2"
    >
      暂无省份访问数据，地图暂以默认配色显示。
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { maxOf } from '@/utils/arrayUtils'
import type { ECharts, EChartsOption } from 'echarts'
import { useDaisyTheme } from '@/composables/useDaisyTheme'
import { parseOklch, oklchToHex } from '@/utils/colorUtils'
import { logger } from '@/utils/logger'

/**
 * echarts 不把回调参数类型从主入口导出（只在本包 types 内部声明），
 * 这里按本项目实际用到的字段声明最小类型，避免为过 lint 而写 `as any`。
 */
interface ChartCallbackParams {
  data?: unknown
  name?: unknown
}

/** 归一化回调参数：多序列时 echarts 传数组，取第一个 */
function normalizeCallback(raw: unknown): ChartCallbackParams | null {
  if (Array.isArray(raw)) return (raw[0] as ChartCallbackParams | undefined) ?? null
  if (raw !== null && typeof raw === 'object') return raw as ChartCallbackParams
  return null
}

const props = defineProps<{
  toolId?: string
}>()

const { base100, base200, base300, baseContent, primary, secondary, accent, accentInk } =
  useDaisyTheme()

const isDark = computed(() => {
  const parts = parseOklch(base100.value)
  return parts ? parts.L < 0.5 : false
})

const chartContainer = ref<HTMLDivElement>()
let chartInstance: ECharts | null = null
let chartInitialized = false
const mapLoading = ref(true)
const mapError = ref(false)
let resizeObserver: ResizeObserver | null = null

interface ProvinceData {
  name: string
  sevenDays: number
  thirtyDays: number
  oneYear: number
}

/** 只接受结构完整的行，避免后端字段变更把图表数据打成 undefined */
function isProvinceData(value: unknown): value is ProvinceData {
  if (value === null || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    typeof row.name === 'string' &&
    typeof row.sevenDays === 'number' &&
    typeof row.thirtyDays === 'number' &&
    typeof row.oneYear === 'number'
  )
}

const currentProvinceData = ref<ProvinceData[]>([])
/** 统计接口是否已有结果（用于区分“还没加载”和“确实没有数据”） */
const mapDataLoaded = ref(false)

function buildMapColors(): string[] {
  const primaryParts = parseOklch(primary.value)
  if (!primaryParts) {
    return ['#E8F4FD', '#B8E0F9', '#7CC4F4', '#3DABEE', '#0E92E4', '#0077D9', '#005CB3', '#00448D']
  }

  const { L: pL, C: pC, H } = primaryParts
  const steps = 8
  const dark = isDark.value

  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1)

    if (dark) {
      const l = 0.22 + t * (pL - 0.22)
      const c = pC * (0.12 + t * 0.88)
      return oklchToHex(`oklch(${l.toFixed(4)} ${c.toFixed(4)} ${H})`)
    }
    const l = 0.94 - t * (0.94 - Math.max(0.35, pL * 0.55))
    const c = pC * (0.1 + t * 0.9)
    return oklchToHex(`oklch(${l.toFixed(4)} ${c.toFixed(4)} ${H})`)
  })
}

const nameToData = computed(() => new Map(currentProvinceData.value.map((d) => [d.name, d])))

const getMaxValue = computed(() => {
  if (currentProvinceData.value.length === 0) return 1
  return maxOf(currentProvinceData.value.map((item) => item.oneYear))
})

const generateChartOption = (): EChartsOption => {
  const maxValue = getMaxValue.value

  return {
    backgroundColor: 'transparent',
    textStyle: {
      color: baseContent.value,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: oklchToHex(base200.value),
      borderColor: oklchToHex(base300.value),
      borderWidth: 1,
      textStyle: { color: baseContent.value },
      formatter: (raw: unknown) => {
        const params = normalizeCallback(raw)
        const name = typeof params?.name === 'string' ? params.name : undefined
        const data = name !== undefined ? nameToData.value.get(name) : undefined
        if (!data) return params?.name === undefined ? '' : String(params.name)
        return `
          <div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">${data.name}</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>7天内访问数：</span>
              <span style="font-weight: 500; color: ${primary.value};">${data.sevenDays.toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>30天内访问数：</span>
              <span style="font-weight: 500; color: ${secondary.value};">${data.thirtyDays.toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>1年内访问数：</span>
              <span style="font-weight: 500; color: ${accentInk.value};">${data.oneYear.toLocaleString()}</span>
            </div>
          </div>
        `
      },
    },
    visualMap: {
      min: 0,
      max: maxValue,
      left: 'left',
      top: 'bottom',
      textStyle: { color: baseContent.value },
      inRange: {
        color: buildMapColors(),
      },
      calculable: true,
    },
    series: [
      {
        name: '访问量',
        type: 'map',
        map: 'china',
        roam: true,
        zoom: 1.2,
        itemStyle: {
          areaColor: oklchToHex(base200.value),
          borderColor: oklchToHex(base300.value),
          borderWidth: 0.5,
        },
        label: {
          show: true,
          fontSize: 10,
          color: baseContent.value,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
          },
          itemStyle: {
            areaColor: oklchToHex(primary.value),
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: isDark.value ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.3)',
          },
        },
        data: currentProvinceData.value.map((item) => ({
          name: item.name,
          value: item.oneYear,
        })),
      },
    ],
  }
}

const applyChartOption = () => {
  if (!chartInstance) return

  const prevOpt = chartInstance.getOption() as EChartsOption | undefined
  // SeriesOption 是联合类型（line/bar/scatter...），map 系列的 zoom/center
  // 只在 MapSeriesOption 上存在，这里显式收窄到 map 系列再读。
  const prevSeries = Array.isArray(prevOpt?.series) ? prevOpt.series[0] : undefined
  const prevMap = prevSeries?.type === 'map' ? prevSeries : undefined
  const prevZoom = prevMap?.zoom
  const prevCenter = prevMap?.center

  const newOpt = generateChartOption()
  const newSeries = Array.isArray(newOpt.series) ? newOpt.series[0] : undefined
  const newMap = newSeries?.type === 'map' ? newSeries : undefined
  if (newMap) {
    if (prevZoom != null) newMap.zoom = prevZoom
    if (prevCenter != null) newMap.center = prevCenter
  }

  chartInstance.setOption(newOpt, true)
}

const tryInitOrResize = () => {
  if (!chartContainer.value) return

  if (!chartInitialized) {
    const { clientWidth, clientHeight } = chartContainer.value
    if (clientWidth === 0 || clientHeight === 0) return
    chartInitialized = true
    chartInstance = echarts.init(chartContainer.value)
    applyChartOption()
    sendAnalytics()
  } else {
    chartInstance?.resize()
  }
}

const sendAnalytics = () => {
  logger.log('Analytics placeholder - province map chart viewed')
}

/**
 * 访问统计是「锦上添花」：它失败时地图边界仍然要能画出来。
 * 因此这里自己吞掉异常（只记日志），绝不向外抛。
 */
const fetchMapData = async () => {
  if (!props.toolId) {
    mapDataLoaded.value = true
    return
  }
  try {
    const res = await fetch(`/api/map-data?tool_id=${encodeURIComponent(props.toolId)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const payload: unknown = await res.json()
    if (payload === null || typeof payload !== 'object') return
    const body = payload as { code?: unknown; data?: unknown }
    if (body.code !== 0 || !Array.isArray(body.data)) return
    currentProvinceData.value = body.data.filter(isProvinceData)
  } catch (e) {
    // 统计接口失败保持空数据：地图照常渲染，只是没有访问量着色
    logger.warn('加载省份访问数据失败:', e)
  } finally {
    mapDataLoaded.value = true
  }
}

async function loadChinaMap() {
  try {
    const resp = await fetch('/map/china.json')
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const geoJson = await resp.json()

    if (!geoJson?.features?.length) {
      throw new Error('GeoJSON 数据为空')
    }

    echarts.registerMap('china', geoJson)
    mapLoading.value = false
  } catch (e) {
    logger.error('加载地图数据失败:', e)
    mapError.value = true
    mapLoading.value = false
  }
}

watch([base100, base200, base300, baseContent, primary, secondary, accent, accentInk], () => {
  void nextTick().then(() => {
    applyChartOption()
  })
})

watch(
  () => props.toolId,
  async () => {
    await fetchMapData()
    applyChartOption()
  },
)

// 标记组件是否已卸载。onMounted 是 async 的，await 之后组件可能已被
// 卸载——若不检查，tryInitOrResize / addEventListener / ResizeObserver 仍会
// 在已销毁的组件上执行，造成泄漏与"卸载后仍改状态"（审计 B2）。
let disposed = false

onMounted(async () => {
  // 统计接口与地图边界并行：统计慢/失败都不应该把整张地图拖成“加载失败”
  void fetchMapData().then(() => {
    if (!disposed) applyChartOption()
  })

  await loadChinaMap()

  if (mapError.value || disposed) return

  await nextTick()
  if (disposed) return
  tryInitOrResize()
  window.addEventListener('resize', tryInitOrResize)
  if (chartContainer.value && !disposed) {
    resizeObserver = new ResizeObserver(tryInitOrResize)
    resizeObserver.observe(chartContainer.value)
  }
})

onUnmounted(() => {
  disposed = true
  window.removeEventListener('resize', tryInitOrResize)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
  chartInitialized = false
})
</script>

<style scoped>
.h-\[500px\] {
  min-height: 31.25rem;
}
</style>
