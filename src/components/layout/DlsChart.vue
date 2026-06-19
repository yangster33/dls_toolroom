<template>
  <div>
    <h2 class="card-title text-xl mb-4">中国各省访问量分布图</h2>
    <p class="text-base-content/70 mb-6">鼠标悬停查看各省份的访问数据统计</p>

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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'
import { useDaisyTheme } from '@/composables/useDaisyTheme'
import { parseOklch, oklchToHex } from '@/utils/colorUtils'
import { logger } from '@/utils/logger'

const props = defineProps<{
  toolId?: string
}>()

const { base100, base200, base300, baseContent, primary, secondary, accent } = useDaisyTheme()

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

const mockProvinceData: ProvinceData[] = [
  { name: '北京市', sevenDays: 71500, thirtyDays: 273500, oneYear: 3102000 },
  { name: '天津市', sevenDays: 31500, thirtyDays: 121000, oneYear: 1385000 },
  { name: '河北省', sevenDays: 42500, thirtyDays: 162000, oneYear: 1850000 },
  { name: '山西省', sevenDays: 28600, thirtyDays: 109000, oneYear: 1240000 },
  { name: '内蒙古自治区', sevenDays: 15200, thirtyDays: 58000, oneYear: 665000 },
  { name: '辽宁省', sevenDays: 35800, thirtyDays: 137000, oneYear: 1560000 },
  { name: '吉林省', sevenDays: 21300, thirtyDays: 81500, oneYear: 930000 },
  { name: '黑龙江省', sevenDays: 24800, thirtyDays: 95000, oneYear: 1080000 },
  { name: '上海市', sevenDays: 68500, thirtyDays: 261000, oneYear: 2980000 },
  { name: '江苏省', sevenDays: 82500, thirtyDays: 315000, oneYear: 3580000 },
  { name: '浙江省', sevenDays: 75800, thirtyDays: 289000, oneYear: 3300000 },
  { name: '安徽省', sevenDays: 42500, thirtyDays: 162000, oneYear: 1850000 },
  { name: '福建省', sevenDays: 39800, thirtyDays: 152000, oneYear: 1730000 },
  { name: '江西省', sevenDays: 31200, thirtyDays: 119000, oneYear: 1360000 },
  { name: '山东省', sevenDays: 65200, thirtyDays: 248000, oneYear: 2830000 },
  { name: '河南省', sevenDays: 52300, thirtyDays: 199000, oneYear: 2270000 },
  { name: '湖北省', sevenDays: 46800, thirtyDays: 178000, oneYear: 2030000 },
  { name: '湖南省', sevenDays: 43500, thirtyDays: 166000, oneYear: 1890000 },
  { name: '广东省', sevenDays: 98500, thirtyDays: 376000, oneYear: 4280000 },
  { name: '广西壮族自治区', sevenDays: 28600, thirtyDays: 109000, oneYear: 1240000 },
  { name: '海南省', sevenDays: 12300, thirtyDays: 47000, oneYear: 535000 },
  { name: '重庆市', sevenDays: 38500, thirtyDays: 147000, oneYear: 1680000 },
  { name: '四川省', sevenDays: 56800, thirtyDays: 217000, oneYear: 2470000 },
  { name: '贵州省', sevenDays: 22500, thirtyDays: 86000, oneYear: 980000 },
  { name: '云南省', sevenDays: 27400, thirtyDays: 104000, oneYear: 1190000 },
  { name: '西藏自治区', sevenDays: 3200, thirtyDays: 12200, oneYear: 139000 },
  { name: '陕西省', sevenDays: 41800, thirtyDays: 159000, oneYear: 1820000 },
  { name: '甘肃省', sevenDays: 17300, thirtyDays: 66000, oneYear: 755000 },
  { name: '青海省', sevenDays: 6800, thirtyDays: 26000, oneYear: 296000 },
  { name: '宁夏回族自治区', sevenDays: 8500, thirtyDays: 32500, oneYear: 370000 },
  { name: '新疆维吾尔自治区', sevenDays: 18500, thirtyDays: 70500, oneYear: 805000 },
  { name: '台湾省', sevenDays: 12500, thirtyDays: 47800, oneYear: 545000 },
  { name: '香港特别行政区', sevenDays: 15200, thirtyDays: 58000, oneYear: 665000 },
  { name: '澳门特别行政区', sevenDays: 3200, thirtyDays: 12200, oneYear: 139000 },
]

const currentProvinceData = ref<ProvinceData[]>(mockProvinceData)

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

const getMaxValue = computed(() => Math.max(...currentProvinceData.value.map((item) => item.oneYear)))

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
      formatter: (params: any) => {
        const data = nameToData.value.get(params.name)
        if (!data) return params.name
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
              <span style="font-weight: 500; color: ${accent.value};">${data.oneYear.toLocaleString()}</span>
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

  const prevOpt = chartInstance.getOption() as any
  const prevZoom = prevOpt?.series?.[0]?.zoom
  const prevCenter = prevOpt?.series?.[0]?.center

  const newOpt = generateChartOption()
  if ((newOpt.series as any)?.[0]) {
    const s = (newOpt.series as any)[0] as any
    if (prevZoom != null) s.zoom = prevZoom
    if (prevCenter != null) s.center = prevCenter
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

const fetchMapData = async () => {
  if (!props.toolId) {
    currentProvinceData.value = mockProvinceData
    return
  }

  try {
    const res = await fetch(`/api/map-data?tool_id=${props.toolId}`)
    const data = await res.json()
    if (data.code === 0 && data.data.length > 0) {
      currentProvinceData.value = data.data
    } else {
      currentProvinceData.value = mockProvinceData
    }
  } catch (error) {
    currentProvinceData.value = mockProvinceData
  }
}

async function loadChinaMap() {
  try {
    await fetchMapData()
    
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

watch([base100, base200, base300, baseContent, primary, secondary, accent], () => {
  void nextTick().then(() => {
    applyChartOption()
  })
})

watch(
  () => props.toolId,
  async () => {
    await fetchMapData()
    applyChartOption()
  }
)

onMounted(async () => {
  await loadChinaMap()

  if (mapError.value) return

  await nextTick()
  tryInitOrResize()
  window.addEventListener('resize', tryInitOrResize)
  if (chartContainer.value) {
    resizeObserver = new ResizeObserver(tryInitOrResize)
    resizeObserver.observe(chartContainer.value)
  }
})

onUnmounted(() => {
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
