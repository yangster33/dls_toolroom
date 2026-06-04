<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || '地震查询' }}</h1>
    <p class="text-base-content/70 mb-6">
      {{
        toolConfig?.description || '查询全球历史地震数据，支持按时间范围、震级范围和地理位置筛选'
      }}
    </p>

    <div class="bg-base-100 rounded-lg shadow-lg p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">查询参数</h2>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label class="label">
            <span class="label-text font-semibold">起始日期</span>
          </label>
          <VueDatePicker
            v-model="startDateModel"
            :time-config="{ enableTimePicker: false }"
            :min-date="minDate"
            :max-date="endDateModel || today"
            model-type="yyyy-MM-dd"
            format="yyyy年MM月dd日"
            :formats="{ input: 'yyyy-MM-dd', preview: 'yyyy/MM/dd' }"
            :action-row="{ selectBtnLabel: '选择', cancelBtnLabel: '取消' }"
            :year-first="true"
            :clearable="false"
            :teleport="true"
            :locale="zhCN"
            placeholder="选择起始日期"
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
            format="yyyy年MM月dd日"
            :formats="{ input: 'yyyy-MM-dd', preview: 'yyyy/MM/dd' }"
            :action-row="{ selectBtnLabel: '选择', cancelBtnLabel: '取消' }"
            :year-first="true"
            :clearable="false"
            :teleport="true"
            :locale="zhCN"
            placeholder="选择结束日期"
            menu-class-name="dp-custom-menu"
            class="w-full"
          />
        </div>
        <div>
          <label class="label">
            <span class="label-text font-semibold">最小震级</span>
          </label>
          <select v-model="form.minMagnitude" class="select select-bordered w-full h-10">
            <option v-for="opt in magnitudeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div>
          <label class="label">
            <span class="label-text font-semibold">最大震级</span>
          </label>
          <select v-model="form.maxMagnitude" class="select select-bordered w-full h-10">
            <option value="">不限</option>
            <option value="1">1 级及以下</option>
            <option value="2">2 级及以下</option>
            <option value="3">3 级及以下</option>
            <option value="4">4 级及以下</option>
            <option value="5">5 级及以下</option>
            <option value="6">6 级及以下</option>
            <option value="7">7 级及以下</option>
            <option value="8">8 级及以下</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label class="label">
            <span class="label-text font-semibold">经度</span>
          </label>
          <input
            v-model="form.longitude"
            type="number"
            step="any"
            placeholder="-180 ~ 180 (可选)"
            class="input input-bordered w-full h-10"
          />
        </div>
        <div>
          <label class="label">
            <span class="label-text font-semibold">纬度</span>
          </label>
          <input
            v-model="form.latitude"
            type="number"
            step="any"
            placeholder="-90 ~ 90 (可选)"
            class="input input-bordered w-full h-10"
          />
        </div>
        <div>
          <label class="label">
            <span class="label-text font-semibold">搜索半径</span>
          </label>
          <select v-model="form.radius" class="select select-bordered w-full h-10">
            <option value="50">50 公里</option>
            <option value="100">100 公里</option>
            <option value="200">200 公里</option>
            <option value="500">500 公里</option>
            <option value="1000">1000 公里</option>
            <option value="2000">2000 公里</option>
            <option value="5000">5000 公里</option>
          </select>
        </div>
      </div>

      <div v-if="dateRangeMessage" class="text-error text-sm mb-4">
        {{ dateRangeMessage }}
      </div>

      <div class="flex flex-wrap gap-3">
        <button @click="queryEarthquake" :disabled="isLoading || !isValid" class="btn btn-primary">
          <span v-if="isLoading" class="loading loading-spinner loading-sm mr-2"></span>
          {{ isLoading ? '查询中...' : '查询地震数据' }}
        </button>
        <button @click="downloadJson" :disabled="!earthquakeData" class="btn btn-success">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          下载 JSON
        </button>
        <button @click="clearResults" class="btn btn-outline">清除结果</button>
      </div>
    </div>

    <ErrorDialog
      :is-open="errorDialogOpen"
      type="error"
      title="操作失败"
      :message="error"
      @close="closeErrorDialog"
    />

    <div v-if="earthquakeData" class="space-y-6">
      <div class="bg-base-100 rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-semibold mb-4">数据概览</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">地震总数</div>
            <div class="stat-value text-lg">{{ earthquakeData.features.length }}</div>
          </div>
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">最大震级</div>
            <div class="stat-value text-lg" :style="{ color: getMagnitudeColor(maxMagnitude) }">
              {{ maxMagnitude.toFixed(1) }}
            </div>
          </div>
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">平均震级</div>
            <div class="stat-value text-lg">{{ avgMagnitude.toFixed(2) }}</div>
          </div>
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">最深深度</div>
            <div class="stat-value text-lg">
              {{ maxDepth.toFixed(1) }} <span class="text-sm">km</span>
            </div>
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

        <div
          v-if="chartLoading"
          class="w-full h-[400px] flex flex-col items-center justify-center gap-3"
        >
          <span class="loading loading-spinner loading-lg text-primary"></span>
          <span class="text-base-content/60 text-sm">正在加载图表...</span>
        </div>
        <div v-else ref="chartContainer" class="w-full h-[400px]"></div>
      </div>

      <div class="bg-base-100 rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-semibold mb-4">地震列表</h2>
        <div class="overflow-x-auto">
          <table class="table table-compact w-full">
            <thead>
              <tr>
                <th>震级</th>
                <th>地点</th>
                <th>经纬度</th>
                <th>时间</th>
                <th>深度</th>
                <th>类型</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="feature in displayFeatures" :key="feature.id" class="hover">
                <td>
                  <span
                    class="inline-flex items-center justify-center w-12 h-8 rounded-full text-white font-bold text-sm"
                    :style="{ backgroundColor: getMagnitudeColor(feature.properties.mag) }"
                  >
                    {{ feature.properties.mag }}
                  </span>
                </td>
                <td>{{ feature.properties.place }}</td>
                <td>{{ feature.geometry.coordinates[0].toFixed(4) }}, {{ feature.geometry.coordinates[1].toFixed(4) }}</td>
                <td>{{ formatTime(feature.properties.time) }}</td>
                <td>{{ feature.geometry.coordinates[2] }} km</td>
                <td>{{ getMagnitudeLevel(feature.properties.mag) }}</td>
                <td>
                  <a :href="feature.properties.url" target="_blank" class="btn btn-xs btn-link"
                    >查看详情</a
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="earthquakeData.features.length > 10" class="mt-4 text-center">
          <span class="text-sm text-base-content/60"
            >仅显示前 10 条记录，共 {{ earthquakeData.features.length }} 条</span
          >
        </div>
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
  fetchEarthquakeData,
  downloadJson as downloadJsonFile,
  formatTime,
  getMagnitudeColor,
  getMagnitudeLevel,
  magnitudeOptions,
  type EarthquakeApiResponse,
} from './earthquakeService'
import { chartConfigs, getAvailableCharts, type ChartType } from './earthquakeChart'
import { useDaisyTheme } from '@/composables/useDaisyTheme'
import { useECharts } from '@/composables/useECharts'
import type { EChartsOption } from 'echarts'
import type { ChartThemeColors } from './earthquakeChart'
import ErrorDialog from '@/components/common/ErrorDialog.vue'

const toolConfig = getToolById('earthquake_query')

const { base100, base200, base300, baseContent, primary, secondary, accent } = useDaisyTheme()

const toDateString = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const today = toDateString(new Date())
const minDate = '1900-01-01'
const defaultStartDate = toDateString(new Date(Date.now() - 30 * 86400000))

const form = ref({
  minMagnitude: '2',
  maxMagnitude: '',
  latitude: '',
  longitude: '',
  radius: '200',
})

const startDateModel = ref<string>(defaultStartDate)
const endDateModel = ref<string>(today)

const isLoading = ref(false)
const error = ref('')
const errorDialogOpen = ref(false)
const earthquakeData = ref<EarthquakeApiResponse | null>(null)

const activeChart = ref<ChartType>('magnitudeTime')



const dateRangeMessage = computed(() => {
  if (!startDateModel.value || !endDateModel.value) return ''

  if (startDateModel.value > endDateModel.value) {
    return '起始日期不能大于结束日期'
  }

  return ''
})

const isValid = computed(() => {
  return (
    startDateModel.value &&
    endDateModel.value &&
    startDateModel.value <= endDateModel.value &&
    !dateRangeMessage.value
  )
})

const maxMagnitude = computed(() => {
  if (!earthquakeData.value?.features || earthquakeData.value.features.length === 0) return 0
  return Math.max(...earthquakeData.value.features.map((f) => f.properties.mag))
})

const avgMagnitude = computed(() => {
  if (!earthquakeData.value?.features || earthquakeData.value.features.length === 0) return 0
  const sum = earthquakeData.value.features.reduce((acc, f) => acc + f.properties.mag, 0)
  return sum / earthquakeData.value.features.length
})

const maxDepth = computed(() => {
  if (!earthquakeData.value?.features || earthquakeData.value.features.length === 0) return 0
  return Math.max(...earthquakeData.value.features.map((f) => f.geometry.coordinates[2]))
})

const displayFeatures = computed(() => {
  if (!earthquakeData.value?.features) return []
  return [...earthquakeData.value.features]
    .sort((a, b) => b.properties.mag - a.properties.mag)
    .slice(0, 10)
})

const availableCharts = computed((): ChartType[] => {
  if (!earthquakeData.value) return []
  return getAvailableCharts(earthquakeData.value)
})

const closeErrorDialog = () => {
  errorDialogOpen.value = false
  error.value = ''
}

async function queryEarthquake() {
  if (!isValid.value) {
    error.value = '请填写完整的查询参数'
    errorDialogOpen.value = true
    return
  }

  isLoading.value = true
  error.value = ''
  earthquakeData.value = null

  try {
    const result = await fetchEarthquakeData({
      startDate: startDateModel.value,
      endDate: endDateModel.value,
      minMagnitude: form.value.minMagnitude,
      maxMagnitude: form.value.maxMagnitude,
      latitude: form.value.latitude,
      longitude: form.value.longitude,
      radius: form.value.radius,
    })

    if (result.success && result.data) {
      earthquakeData.value = result.data
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
  earthquakeData.value = null
  error.value = ''
}

function downloadJson() {
  if (earthquakeData.value) {
    const filename = `earthquake_${startDateModel.value}_${endDateModel.value}.json`
    downloadJsonFile(earthquakeData.value, filename)
  }
}

const getChartOption = (data: EarthquakeApiResponse, theme: Record<string, string>): EChartsOption | null => {
  const config = chartConfigs[activeChart.value]
  if (!config) return null
  return config.generator(data, theme as unknown as ChartThemeColors)
}

const { chartContainer, chartLoading, initChart, disposeChart } = useECharts({
  data: earthquakeData,
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
  if (earthquakeData.value) {
    initChart()
  }
})

watch(earthquakeData, (newData) => {
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
