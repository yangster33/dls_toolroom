<template>
  <div class="p-6">
    <ErrorDialog
      :is-open="errorDialogOpen"
      :type="errorDialogType"
      :title="errorDialogTitle"
      :message="errorDialogMessage"
      @close="closeErrorDialog"
    />
    <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || '批量高程查询' }}</h1>
    <p class="text-base-content/70 mb-6">{{ toolConfig?.description || '通过上传模板批量查询高程数据' }}</p>

    <div class="bg-base-100 rounded-lg shadow-lg p-6 mb-6 space-y-6">
      <div>
        <h2 class="text-xl font-semibold mb-4">1. 下载模板</h2>
        <p class="text-base-content/70 mb-3 text-sm">模板包含三列：名称、经度、纬度</p>
        <div class="dropdown">
          <label tabindex="0" class="btn btn-outline btn-primary">
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
            下载模板
          </label>
          <ul
            tabindex="0"
            class="dropdown-content menu bg-base-100 rounded-box shadow-lg p-2 w-48 z-10"
          >
            <li>
              <a @click="downloadTemplate('csv')" class="text-sm">CSV 格式</a>
            </li>
            <li>
              <a @click="downloadTemplate('xlsx')" class="text-sm">Excel 格式</a>
            </li>
          </ul>
        </div>
      </div>

      <div>
        <h2 class="text-xl font-semibold mb-4">2. 查询参数设置</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">请求延迟 (ms)</label>
            <input
              v-model.number="queryOptions.delay"
              type="number"
              min="0"
              max="10000"
              class="w-full input input-bordered"
            />
          </div>
          <div class="pb-1">
            <label class="flex items-center cursor-pointer">
              <input
                v-model="queryOptions.randomDelay"
                type="checkbox"
                class="checkbox checkbox-primary"
              />
              <span class="ml-2 text-sm">启用随机延迟</span>
            </label>
          </div>
          <div v-if="queryOptions.randomDelay" class="flex gap-2">
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">最小延迟 (ms)</label>
              <input
                v-model.number="queryOptions.minRandomDelay"
                type="number"
                min="0"
                class="w-full input input-bordered"
              />
            </div>
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">最大延迟 (ms)</label>
              <input
                v-model.number="queryOptions.maxRandomDelay"
                type="number"
                min="0"
                class="w-full input input-bordered"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 class="text-xl font-semibold mb-4">3. 上传数据文件</h2>
        <p class="text-base-content/70 mb-3 text-sm">支持 CSV 和 Excel 格式</p>
        <input
          ref="fileInputRef"
          type="file"
          accept=".csv,.xlsx"
          @change="onFileUpload"
          class="hidden"
        />
        <div
          @click="triggerFileUpload"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDropFile"
          :class="['border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors', isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary']"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-10 w-10 mx-auto mb-3 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p class="text-sm text-gray-600 mb-1">点击选择文件或拖拽文件到此处</p>
          <p class="text-xs text-gray-400">支持 CSV、Excel 格式</p>
        </div>
        <span v-if="uploadedFileName" class="block mt-2 text-sm text-gray-600">
          已选择：{{ uploadedFileName }}
        </span>
        <div v-if="validationResult" class="mt-4 p-4 bg-gray-50 rounded-lg">
          <p class="text-sm">
            <span :class="validationResult.isValid ? 'text-green-600' : 'text-red-600'">
              {{ validationResult.isValid ? '✓ 数据验证通过' : '✗ 数据验证失败' }}
            </span>
            <span class="ml-2 text-gray-600">
              共 {{ validationResult.data.length }} 条有效数据
            </span>
          </p>
        </div>
      </div>

      <div>
        <h2 class="text-xl font-semibold mb-4">4. 执行查询</h2>
        <div class="flex flex-wrap gap-4 items-center">
          <button
            @click="executeQuery"
            :disabled="!canExecuteQuery"
            class="btn btn-primary"
          >
            <span v-if="isQuerying" class="loading loading-spinner"></span>
            {{ isQuerying ? '查询中...' : '执行查询' }}
          </button>
          
          <div v-if="isQuerying" class="flex items-center gap-4 flex-1">
            <div class="w-64">
              <div class="progress w-full">
                <div
                  class="progress-primary progress"
                  :style="{ width: progressPercent + '%' }"
                ></div>
              </div>
            </div>
            <span class="text-sm text-gray-600">{{ progressMessage }}</span>
          </div>
          
          <div class="dropdown">
            <label tabindex="0" class="btn btn-outline btn-secondary" :disabled="!canDownloadResult">
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
              下载结果
            </label>
            <ul
              tabindex="0"
              class="dropdown-content menu bg-base-100 rounded-box shadow-lg p-2 w-48 z-10"
            >
              <li>
                <a @click="downloadResult('csv')" class="text-sm">CSV 格式</a>
              </li>
              <li>
                <a @click="downloadResult('xlsx')" class="text-sm">Excel 格式</a>
              </li>
            </ul>
          </div>
          
          <button
            @click="clearAll"
            class="btn btn-ghost"
            :disabled="!hasData"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            清除
          </button>
        </div>
      </div>
    </div>

    <div v-if="queryResults.length > 0" class="bg-base-100 rounded-lg shadow-lg p-6">
      <h2 class="text-xl font-semibold mb-4">查询结果预览 (前10条)</h2>
      <div class="overflow-x-auto">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th>序号</th>
              <th>名称</th>
              <th>经度</th>
              <th>纬度</th>
              <th>海拔高度 (米)</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(result, index) in displayResults" :key="index">
              <td>{{ index + 1 }}</td>
              <td>{{ result.name }}</td>
              <td>{{ result.longitude.toFixed(6) }}</td>
              <td>{{ result.latitude.toFixed(6) }}</td>
              <td :class="result.error ? 'text-gray-400' : 'text-primary font-semibold'">
                {{ result.error ? '-' : result.elevation?.toFixed(2) }}
              </td>
              <td>
                <span v-if="result.error" class="text-red-500 text-sm">失败</span>
                <span v-else class="text-green-500 text-sm">成功</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="queryResults.length > 10" class="mt-2 text-sm text-gray-500">
        仅显示前10条结果，完整结果请下载查看
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import * as XLSX from 'xlsx'
import { exportData, exportTemplate } from '@/utils/TemplateExporter'
import { logger } from '@/utils/logger'
import { getToolById } from '../toolData'
import { ELEVATION_HEADERS } from './TemplateExporter'
import ErrorDialog from '@/components/common/ErrorDialog.vue'
import {
  readAndValidateTemplate,
  type TemplateValidationResult,
  type CoordinatePoint,
} from './TemplateReader'
import { elevationService } from '../elevation_query/elevationService'

const toolConfig = getToolById('elevations_batch')

const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadedFileName = ref('')
const isDragging = ref(false)

interface QueryOptions {
  delay: number
  randomDelay: boolean
  minRandomDelay: number
  maxRandomDelay: number
}

const queryOptions = reactive<QueryOptions>({
  delay: 1000,
  randomDelay: false,
  minRandomDelay: 500,
  maxRandomDelay: 2000,
})

interface ElevationQueryResult extends CoordinatePoint {
  elevation?: number
  error?: string
}

const validationResult = ref<TemplateValidationResult<CoordinatePoint> | null>(null)
const queryResults = ref<ElevationQueryResult[]>([])
const isQuerying = ref(false)
const progressPercent = ref(0)
const progressMessage = ref('')

// 错误对话框状态
const errorDialogOpen = ref(false)
const errorDialogType = ref<'error' | 'warning' | 'success' | 'info'>('error')
const errorDialogTitle = ref('操作失败')
const errorDialogMessage = ref('')

const closeErrorDialog = () => {
  errorDialogOpen.value = false
  errorDialogMessage.value = ''
}

const showErrorDialog = (type: 'error' | 'warning' | 'success' | 'info', title: string, message: string) => {
  errorDialogType.value = type
  errorDialogTitle.value = title
  errorDialogMessage.value = message
  errorDialogOpen.value = true
}

const canExecuteQuery = computed(
  () => validationResult.value?.isValid && !isQuerying.value && validationResult.value.data.length <= 100,
)

const canDownloadResult = computed(() => queryResults.value.length > 0)

const hasData = computed(() => validationResult.value !== null || queryResults.value.length > 0)

const displayResults = computed(() => queryResults.value.slice(0, 10))

const downloadTemplate = (format: 'csv' | 'xlsx') => {
  exportTemplate(ELEVATION_HEADERS, format, '高程查询模板')
}

const triggerFileUpload = () => {
  fileInputRef.value?.click()
}

const onFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploadedFileName.value = file.name

  try {
    let rows: Record<string, string | number>[]

    if (file.name.toLowerCase().endsWith('.xlsx')) {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetNames = workbook.SheetNames || []
      if (sheetNames.length === 0) {
        throw new Error('Excel文件中没有工作表')
      }
      const firstSheetName = sheetNames[0] as string
      const worksheet = workbook.Sheets[firstSheetName]
      if (!worksheet) {
        throw new Error('无法读取工作表内容')
      }
      const jsonData = XLSX.utils.sheet_to_json(worksheet)
      rows = jsonData as Record<string, string | number>[]
    } else {
      const text = await file.text()
      const cleanText = text.replace(/^\uFEFF/, '')
      rows = parseCSV(cleanText)
    }

    validationResult.value = readAndValidateTemplate(rows)
    queryResults.value = []

    if (!validationResult.value.isValid && validationResult.value.errors.length > 0) {
      const errorMessage =
        validationResult.value.errors.slice(0, 5).join('\n') +
        (validationResult.value.errors.length > 5
          ? `\n...还有 ${validationResult.value.errors.length - 5} 个错误`
          : '')
      showErrorDialog('error', '数据校验失败', errorMessage)
    }

    if (validationResult.value.data.length > 100) {
      showErrorDialog('warning', '数据量超限', `单次查询最多支持 100 个坐标点，当前文件包含 ${validationResult.value.data.length} 个，请分批查询`)
    }
  } catch (error) {
    logger.error('文件读取失败:', error)
    validationResult.value = {
      isValid: false,
      data: [],
      errors: ['文件读取失败，请确保文件格式正确'],
    }
    showErrorDialog('error', '文件读取失败', '请确保文件格式正确')
  }
}

const onDropFile = async (event: DragEvent) => {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  
  // 验证文件类型
  if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.xlsx')) {
    showErrorDialog('warning', '文件格式错误', '请上传 CSV 或 Excel 格式的文件')
    return
  }
  
  // 手动创建事件并调用原有的文件上传处理函数
  const inputEvent = new Event('change', { bubbles: true })
  Object.defineProperty(inputEvent, 'target', {
    value: {
      files: [file]
    },
    writable: true
  })
  
  await onFileUpload(inputEvent)
}

const parseCSV = (text: string): Record<string, string | number>[] => {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headerLine = lines[0]
  if (!headerLine) return []

  const headers = headerLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const rows: Record<string, string | number>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    const values = parseCSVLine(line)
    const row: Record<string, string | number> = {}
    headers.forEach((header, index) => {
      const value = values[index]?.trim().replace(/^"|"$/g, '') || ''
      row[header] = isNaN(Number(value)) ? value : Number(value)
    })
    rows.push(row)
  }

  return rows
}

const parseCSVLine = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)

  return result
}

const executeQuery = async () => {
  if (!validationResult.value?.isValid) return

  isQuerying.value = true
  progressPercent.value = 0
  progressMessage.value = '开始查询...'

  const data = validationResult.value.data
  queryResults.value = []

  const MAX_BATCH_SIZE = 100
  const batches: CoordinatePoint[][] = []
  
  for (let i = 0; i < data.length; i += MAX_BATCH_SIZE) {
    batches.push(data.slice(i, i + MAX_BATCH_SIZE))
  }

  try {
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]!
      const points = batch!.map(p => ({ longitude: p.longitude, latitude: p.latitude }))

      if (batchIndex > 0) {
        await delay(getDelay())
      }

      const results = await elevationService.getElevations(points)

      results.forEach((result, index) => {
        const point = batch![index]!
        queryResults.value.push({
          name: point!.name,
          longitude: point!.longitude,
          latitude: point!.latitude,
          elevation: result.elevation,
        })
      })

      progressPercent.value = ((batchIndex + 1) / batches.length) * 100
      progressMessage.value = `已完成 ${queryResults.value.length}/${data.length}`
    }
  } catch (error) {
    logger.error('查询失败:', error)
    showErrorDialog('error', '查询失败', (error as Error).message)
  } finally {
    isQuerying.value = false
    progressMessage.value = '查询完成'
  }
}

const getDelay = (): number => {
  if (queryOptions.randomDelay) {
    return Math.random() * (queryOptions.maxRandomDelay - queryOptions.minRandomDelay) + queryOptions.minRandomDelay
  }
  return queryOptions.delay
}

const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const downloadResult = (format: 'csv' | 'xlsx') => {
  if (queryResults.value.length === 0) return

  const headers = ['序号', '名称', '经度', '纬度', '海拔高度', '状态']
  const dataRows = queryResults.value.map((result, index) => [
    (index + 1).toString(),
    result.name,
    result.longitude.toFixed(6),
    result.latitude.toFixed(6),
    result.error ? '查询失败' : `${result.elevation?.toFixed(2) || ''} 米`,
    result.error ? '失败' : '成功',
  ])

  exportData(headers, dataRows, format, '高程查询结果')
}

const clearAll = () => {
  fileInputRef.value = null
  uploadedFileName.value = ''
  validationResult.value = null
  queryResults.value = []
  progressPercent.value = 0
  progressMessage.value = ''
}
</script>