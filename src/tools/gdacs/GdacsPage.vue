<template>
  <div class="p-6">
    <ErrorDialog
      :is-open="errorDialogOpen"
      type="error"
      title="操作失败"
      :message="error"
      @close="closeErrorDialog"
    />
    <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || 'GDACS 灾害数据' }}</h1>
    <p class="text-base-content/70 mb-6">
      {{ toolConfig?.description || '从 GDACS 获取全球灾害事件数据' }}
    </p>

    <div class="bg-base-100 rounded-lg shadow-lg p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">查询参数</h2>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label class="label">
            <span class="label-text font-semibold">事件类型</span>
          </label>
          <select v-model="form.eventType" class="select select-bordered w-full h-10">
            <option v-for="opt in eventTypeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div>
          <label class="label">
            <span class="label-text font-semibold">警报级别</span>
          </label>
          <select v-model="form.alertLevel" class="select select-bordered w-full h-10">
            <option v-for="opt in alertLevelOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
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

      <div class="flex flex-wrap gap-3">
        <button @click="fetchData()" :disabled="isLoading || !isValid" class="btn btn-primary">
          <span v-if="isLoading" class="loading loading-spinner loading-sm mr-2"></span>
          {{ isLoading ? '查询中...' : '查询数据' }}
        </button>
        <button
          @click="downloadData"
          :disabled="!events || events.length === 0"
          class="btn btn-success"
        >
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

    

    <div v-if="events && events.length > 0" class="space-y-6">
      <div class="bg-base-100 rounded-lg shadow-lg p-6">
        <h2 class="text-xl font-semibold mb-4">数据概览</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">事件总数</div>
            <div class="stat-value text-lg">{{ events.length }}</div>
          </div>
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">红色警报</div>
            <div class="stat-value text-lg">{{ redAlerts }}</div>
          </div>
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">橙色警报</div>
            <div class="stat-value text-lg">{{ orangeAlerts }}</div>
          </div>
          <div class="stat bg-base-200 rounded-lg">
            <div class="stat-title">绿色警报</div>
            <div class="stat-value text-lg">{{ greenAlerts }}</div>
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
        <h2 class="text-xl font-semibold mb-4">事件列表</h2>
        <div class="overflow-x-auto">
          <table class="table table-compact w-full">
            <thead>
              <tr>
                <th>警报级别</th>
                <th>类型</th>
                <th>标题</th>
                <th>国家</th>
                <th>经纬度</th>
                <th>时间</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="gdacsEvent in events" :key="gdacsEvent.id" class="hover">
                <td>
                  <span
                    class="inline-flex items-center justify-center px-3 py-1 rounded-full text-white font-bold text-sm"
                    :style="{ backgroundColor: getAlertLevelColor(gdacsEvent.alertlevel) }"
                  >
                    {{ gdacsEvent.alertlevel }}
                  </span>
                </td>
                <td>{{ getEventTypeLabel(gdacsEvent.type) }}</td>
                <td class="max-w-xs truncate">{{ gdacsEvent.title }}</td>
                <td>{{ gdacsEvent.country }}</td>
                <td class="text-xs">
                  {{ gdacsEvent.longitude.toFixed(4) }}, {{ gdacsEvent.latitude.toFixed(4) }}
                </td>
                <td>{{ formatDate(gdacsEvent.fromdate) }}</td>
                <td>
                  <a
                    :href="gdacsEvent.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-xs btn-link"
                  >
                    查看详情
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-4 p-4 bg-base-200 rounded-lg text-sm text-base-content/70">
          <p><strong>时间说明：</strong>事件时间为 UTC 时区（协调世界时）。</p>
          <p>
            <strong>转换为北京时间：</strong>北京时间 = UTC + 8 小时。例如：UTC 10:00 = 北京时间
            18:00。
          </p>
        </div>

    <div v-if="total > (form as any).pageSize" class="mt-4 flex justify-center">
          <div class="join">
            <button
              @click="prevPage"
              :disabled="currentPage === 1 || isLoading"
              class="join-item btn"
            >
              上一页
            </button>
            <span v-for="page in visiblePages" :key="page" class="join-item">
              <span v-if="page === -1" class="btn btn-disabled">...</span>
              <button
                v-else
                @click="goToPage(page)"
                :disabled="isLoading"
                class="btn"
                :class="currentPage === page ? 'btn-primary' : ''"
              >
                {{ page }}
              </button>
            </span>
            <button
              @click="nextPage"
              :disabled="currentPage >= totalPages || isLoading"
              class="join-item btn"
            >
              下一页
            </button>
          </div>
          <div class="ml-4 flex items-center gap-2">
            <span class="text-sm text-base-content/60">
              第 {{ currentPage }} / {{ totalPages }} 页
            </span>
            <span class="text-sm text-base-content/60"> 共 {{ total }} 条记录 </span>
          </div>
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
  fetchGdacsData,
  downloadJson,
  formatDate,
  getAlertLevelColor,
  getEventTypeLabel,
  eventTypeOptions,
  alertLevelOptions,
  type GdacsEvent,
} from './gdacsService'
import { chartConfigs, getAvailableCharts, type ChartType } from './gdacsChart'
import { useDaisyTheme } from '@/composables/useDaisyTheme'
import { useECharts } from '@/composables/useECharts'
import type { EChartsOption } from 'echarts'
import type { ChartThemeColors } from './gdacsChart'
import ErrorDialog from '@/components/common/ErrorDialog.vue'

const toolConfig = getToolById('gdacs')

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
  eventType: '',
  alertLevel: '',
})

const startDateModel = ref<string>(defaultStartDate)
const endDateModel = ref<string>(today)

const isLoading = ref(false)
const error = ref('')
const errorDialogOpen = ref(false)
const events = ref<GdacsEvent[] | null>(null)
const total = ref(0)
const currentPage = ref(1)



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
  return (
    startDateModel.value &&
    endDateModel.value &&
    startDateModel.value <= endDateModel.value &&
    !dateRangeMessage.value
  )
})

const activeChart = ref<ChartType>('eventType')

const redAlerts = computed(() => {
  if (!events.value) return 0
  return events.value.filter((e) => e.alertlevel.toLowerCase() === 'red').length
})

const orangeAlerts = computed(() => {
  if (!events.value) return 0
  return events.value.filter((e) => e.alertlevel.toLowerCase() === 'orange').length
})

const greenAlerts = computed(() => {
  if (!events.value) return 0
  return events.value.filter((e) => e.alertlevel.toLowerCase() === 'green').length
})

const totalPages = computed(() => {
  return Math.ceil(total.value / (form.value as any).pageSize)
})

const visiblePages = computed(() => {
  const pages: number[] = []
  const total = totalPages.value
  const current = currentPage.value

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) {
        pages.push(i)
      }
      pages.push(-1)
      pages.push(total)
    } else if (current >= total - 3) {
      pages.push(1)
      pages.push(-1)
      for (let i = total - 4; i <= total; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)
      pages.push(-1)
      for (let i = current - 1; i <= current + 1; i++) {
        pages.push(i)
      }
      pages.push(-1)
      pages.push(total)
    }
  }

  return pages
})

const availableCharts = computed((): ChartType[] => {
  if (!events.value) return []
  return getAvailableCharts(events.value)
})

async function fetchData(pageNumber = 1) {
  if (!isValid.value) {
    error.value = '请填写完整的查询参数'
    errorDialogOpen.value = true
    return
  }

  isLoading.value = true
  error.value = ''
  errorDialogOpen.value = false
  events.value = null

  try {
    const result = await fetchGdacsData({
      eventType: form.value.eventType,
      alertLevel: form.value.alertLevel,
      startDate: startDateModel.value,
      endDate: endDateModel.value,
      pageNumber,
      pageSize: 20,
    })

    if (result.success && result.data) {
      events.value = result.data
      total.value = result.total || result.data.length
      currentPage.value = pageNumber
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

function prevPage() {
  if (currentPage.value > 1) {
    fetchData(currentPage.value - 1)
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    fetchData(currentPage.value + 1)
  }
}

function goToPage(page: number) {
  if (page > 0 && page <= totalPages.value && page !== currentPage.value) {
    fetchData(page)
  }
}

function clearResults() {
  events.value = null
  error.value = ''
  errorDialogOpen.value = false
}

function closeErrorDialog() {
  errorDialogOpen.value = false
  error.value = ''
}

function downloadData() {
  if (events.value) {
    downloadJson(events.value)
  }
}

const getChartOption = (data: GdacsEvent[], theme: Record<string, string>): EChartsOption | null => {
  const config = chartConfigs[activeChart.value]
  if (!config) return null
  return config.generator(data, theme as unknown as ChartThemeColors)
}

const { chartContainer, chartLoading, initChart, disposeChart } = useECharts({
  data: events,
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
  if (events.value) {
    initChart()
  }
})

watch(events, (newData) => {
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
