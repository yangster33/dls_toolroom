<template>
  <div class="p-6">
    <ErrorDialog
      :is-open="errorDialogOpen"
      type="error"
      title="操作失败"
      :message="error"
      @close="closeErrorDialog"
    />
    <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || '历史天气查询' }}</h1>
    <p class="text-base-content/70 mb-6">
      {{ toolConfig?.description || '输入经纬度查询历史天气数据，支持多种气象变量选择' }}
    </p>

    <div class="bg-base-100 rounded-lg shadow-lg p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">查询参数</h2>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label class="label">
            <span class="label-text font-semibold">经度 (Longitude)</span>
          </label>
          <input
            v-model="form.longitude"
            type="number"
            step="any"
            placeholder="例如: 116.4"
            class="input input-bordered w-full h-10"
          />
        </div>
        <div>
          <label class="label">
            <span class="label-text font-semibold">纬度 (Latitude)</span>
          </label>
          <input
            v-model="form.latitude"
            type="number"
            step="any"
            placeholder="例如: 39.9"
            class="input input-bordered w-full h-10"
          />
        </div>
        <div>
          <label class="label">
            <span class="label-text font-semibold">开始日期</span>
          </label>
          <VueDatePicker
            v-model="startDateModel"
            :time-config="{ enableTimePicker: false }"
            :min-date="minDate"
            :max-date="endDateModel || today"
            model-type="yyyy-MM-dd"
            :formats="{ input: 'yyyy-MM-dd', preview: 'yyyy/MM/dd' }"
            :year-first="true"
            :action-row="{ selectBtnLabel: '选择', cancelBtnLabel: '取消' }"
            :clearable="false"
            :teleport="true"
            :locale="zhCN"
            placeholder="选择开始日期"
            menu-class-name="dp-custom-menu"
            class="w-full"
          />
        </div>
        <div>
          <label class="label">
            <span class="label-text font-semibold">结束日期</span>
          </label>
          <VueDatePicker
            v-model="endDateModel"
            :time-config="{ enableTimePicker: false }"
            :min-date="startDateModel || minDate"
            :max-date="today"
            model-type="yyyy-MM-dd"
            :formats="{ input: 'yyyy-MM-dd', preview: 'yyyy/MM/dd' }"
            :year-first="true"
            :action-row="{ selectBtnLabel: '选择', cancelBtnLabel: '取消' }"
            :clearable="false"
            :teleport="true"
            :locale="zhCN"
            placeholder="选择结束日期"
            menu-class-name="dp-custom-menu"
            class="w-full"
          />
        </div>
      </div>

      <div v-if="dateRangeMessage" class="text-error text-sm mb-4">
        {{ dateRangeMessage }}
      </div>

      <div class="mb-6">
        <label class="label">
          <span class="label-text font-semibold">选择气象变量</span>
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="variable in availableVariables"
            :key="variable.key"
            @click="toggleVariable(variable.key)"
            class="btn btn-sm"
            :class="selectedVariables.includes(variable.key) ? 'btn-primary' : 'btn-outline'"
          >
            {{ variable.label }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-3">
        <button
          @click="queryWeather"
          :disabled="isLoading || !isValid"
          class="btn btn-primary"
        >
          <span v-if="isLoading" class="loading loading-spinner loading-sm mr-2"></span>
          {{ isLoading ? '查询中...' : '查询天气数据' }}
        </button>
        <button
          @click="downloadJson"
          :disabled="!weatherData"
          class="btn btn-success"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          下载 JSON
        </button>
        <button
          @click="clearResults"
          class="btn btn-outline"
        >
          清除结果
        </button>
      </div>
    </div>

    

    <div v-if="weatherData" class="space-y-6">
      <div class="bg-base-100 rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-semibold mb-4">数据概览</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">位置</div>
            <div class="stat-value text-lg">{{ weatherData.longitude.toFixed(4) }}, {{ weatherData.latitude.toFixed(4) }}</div>
          </div>
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">海拔</div>
            <div class="stat-value text-lg">{{ weatherData.elevation.toFixed(1) }} <span class="text-sm">m</span></div>
          </div>
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">时区</div>
            <div class="stat-value text-lg text-sm">{{ weatherData.timezone }}</div>
          </div>
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">数据点数</div>
            <div class="stat-value text-lg">{{ hourlyDataCount }}</div>
          </div>
        </div>
      </div>

      <div class="bg-base-100 rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-semibold mb-4">可视化图表</h2>
        
        <div class="flex flex-wrap gap-2 mb-4">
          <button
            v-for="chartType in availableCharts"
            :key="chartType"
            @click="activeChart = chartType"
            class="btn btn-sm"
            :class="activeChart === chartType ? 'btn-primary' : 'btn-outline'"
          >
            {{ chartConfigs[chartType].title }}
          </button>
        </div>

        <div v-if="chartLoading" class="w-full h-[400px] flex flex-col items-center justify-center gap-3">
          <span class="loading loading-spinner loading-lg text-primary"></span>
          <span class="text-base-content/60 text-sm">正在加载图表...</span>
        </div>
        <div v-else ref="chartContainer" class="w-full h-[400px]"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import { zhCN } from 'date-fns/locale'
import { getToolById } from '@/tools/toolData'
import {
  availableVariables,
  fetchWeatherHistory,
  downloadJson as downloadJsonFile,
  type WeatherApiResponse,
} from './weatherHistoryService'
import {
  chartConfigs,
  getAvailableCharts,
  type ChartType,
} from './weatherHistoryChart'
import { useDaisyTheme } from '@/composables/useDaisyTheme'
import { useECharts } from '@/composables/useECharts'
import ErrorDialog from '@/components/common/ErrorDialog.vue'
import type { EChartsOption } from 'echarts'
import type { ChartThemeColors } from './weatherHistoryChart'

const toolConfig = getToolById('weather_history')

const { base100, base200, base300, baseContent, primary, secondary, accent } = useDaisyTheme()

const toDateString = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const today = toDateString(new Date())
const minDate = '1940-01-01'
const defaultStartDate = toDateString(new Date(Date.now() - 7 * 86400000))

const form = ref({
  longitude: '116.4',
  latitude: '39.9',
})

const startDateModel = ref<string>(defaultStartDate)
const endDateModel = ref<string>(today)

const selectedVariables = ref(['temperature_2m', 'precipitation'])
const isLoading = ref(false)
const error = ref('')
const errorDialogOpen = ref(false)
const weatherData = ref<WeatherApiResponse | null>(null)

const activeChart = ref<ChartType>('temperature')



const dateRangeMessage = computed(() => {
  if (!startDateModel.value || !endDateModel.value) return ''

  if (startDateModel.value > endDateModel.value) {
    return '起始日期不能大于结束日期'
  }

  const start = new Date(startDateModel.value)
  const end = new Date(endDateModel.value)
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / 86400000) + 1

  if (diffDays > 365) {
    return '日期范围不能超过 365 天'
  }
  if (diffDays < 1) {
    return '日期范围不能少于 1 天'
  }
  return ''
})

const isValid = computed(() => {
  const lng = parseFloat(form.value.longitude)
  const lat = parseFloat(form.value.latitude)
  return (
    !isNaN(lng) &&
    !isNaN(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90 &&
    startDateModel.value &&
    endDateModel.value &&
    startDateModel.value <= endDateModel.value &&
    !dateRangeMessage.value &&
    selectedVariables.value.length > 0
  )
})

const hourlyDataCount = computed(() => {
  if (!weatherData.value?.hourly?.time) return 0
  return weatherData.value.hourly.time.length
})

const availableCharts = computed((): ChartType[] => {
  if (!weatherData.value) return []
  return getAvailableCharts(weatherData.value)
})

function toggleVariable(key: string) {
  const index = selectedVariables.value.indexOf(key)
  if (index > -1) {
    selectedVariables.value.splice(index, 1)
  } else {
    selectedVariables.value.push(key)
  }
}

async function queryWeather() {
  if (!isValid.value) {
    error.value = '请填写完整的查询参数'
    errorDialogOpen.value = true
    return
  }

  isLoading.value = true
  error.value = ''
  errorDialogOpen.value = false
  weatherData.value = null

  try {
    const result = await fetchWeatherHistory({
      longitude: form.value.longitude,
      latitude: form.value.latitude,
      startDate: startDateModel.value,
      endDate: endDateModel.value,
    }, selectedVariables.value)

    if (result.success && result.data) {
      weatherData.value = result.data
      if (availableCharts.value.length > 0) {
        activeChart.value = availableCharts.value[0]!
      }
    } else {
      error.value = result.error || '查询失败'
      errorDialogOpen.value = true
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '请求失败'
    errorDialogOpen.value = true
  } finally {
    isLoading.value = false
  }
}

function clearResults() {
  weatherData.value = null
  error.value = ''
  errorDialogOpen.value = false
}

function closeErrorDialog() {
  errorDialogOpen.value = false
  error.value = ''
}

function downloadJson() {
  if (weatherData.value) {
    const filename = `weather_${form.value.latitude}_${form.value.longitude}_${startDateModel.value}_${endDateModel.value}.json`
    downloadJsonFile(weatherData.value, filename)
  }
}

const getChartOption = (data: WeatherApiResponse, theme: Record<string, string>): EChartsOption | null => {
  const config = chartConfigs[activeChart.value]
  if (!config) return null
  return config.generator(data, theme as unknown as ChartThemeColors)
}

const { chartContainer, chartLoading, initChart, disposeChart } = useECharts({
  data: weatherData,
  getChartOption,
  themeVariables: {
    base100: () => base100.value,
    base200: () => base200.value,
    base300: () => base300.value,
    baseContent: () => baseContent.value,
    primary: () => primary.value,
    secondary: () => secondary.value,
    accent: () => accent.value,
  },
})

watch(activeChart, () => {
  if (weatherData.value) {
    initChart()
  }
})

watch(weatherData, (newData) => {
  if (newData) {
    const charts = getAvailableCharts(newData)
    if (charts.length > 0 && !charts.includes(activeChart.value)) {
      activeChart.value = charts[0]!
    }
  }
})
</script>

<style scoped>
.h-\[400px\] {
  min-height: 25rem;
}
</style>
