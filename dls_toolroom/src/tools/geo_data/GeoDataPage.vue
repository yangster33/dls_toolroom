<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || '空间分析' }}</h1>
    <p class="text-base-content/70 mb-6">{{ toolConfig?.description || '基于Turf.js的地理空间分析工具' }}</p>

    <div class="bg-base-100 rounded-lg shadow-lg p-6 mb-6 space-y-6">
      <!-- 文件上传区域 -->
      <div>
        <label class="label">
          <span class="label-text font-semibold">选择 KML/KMZ 文件</span>
        </label>
        <div
          class="border-4 border-dashed border-base-300 rounded-xl p-12 text-center hover:border-primary transition-colors cursor-pointer"
          :class="{ 'border-primary bg-primary/5': isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
          @click="triggerFileInput"
        >
          <input
            ref="fileInput"
            type="file"
            @change="onFileUpload"
            class="hidden"
            :disabled="isParsing"
            accept=".kml,.kmz"
          />
          <div class="flex flex-col items-center gap-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div>
              <p class="text-lg font-semibold">拖拽 KML/KMZ 文件到此处</p>
              <p class="text-base-content/60">或点击选择文件</p>
            </div>
          </div>
        </div>
        <div v-if="uploadedFile" class="mt-4 flex items-center justify-between">
          <span class="text-sm text-gray-600">{{ uploadedFile.name }} ({{ formatFileSize(uploadedFile.size) }})</span>
          <button @click="clearFile" class="btn btn-sm btn-outline btn-warning">移除</button>
        </div>
      </div>

      <!-- 解析进度条区域 -->
      <div v-if="isParsing" class="space-y-2">
        <div class="flex justify-between text-sm">
          <span>解析进度</span>
          <span>{{ parseProgress }}%</span>
        </div>
        <progress
          class="progress progress-primary w-full"
          :value="parseProgress"
          max="100"
        ></progress>
        <div class="text-sm text-gray-600 text-center">{{ parseProgressMessage }}</div>
      </div>

      <!-- 数据统计 -->
      <div v-if="parseResult" class="stats stats-vertical lg:stats-horizontal shadow mb-6 w-full">
        <div class="stat">
          <div class="stat-figure text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div class="stat-title">点要素</div>
          <div class="stat-value text-primary">{{ parseResult.totalPoints }}</div>
        </div>
        <div class="stat">
          <div class="stat-figure text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div class="stat-title">线要素</div>
          <div class="stat-value text-secondary">{{ parseResult.totalLines }}</div>
        </div>
        <div class="stat">
          <div class="stat-figure text-accent">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 011-1v-6z" />
            </svg>
          </div>
          <div class="stat-title">面要素</div>
          <div class="stat-value text-accent">{{ parseResult.totalPolygons }}</div>
        </div>
        <div class="stat">
          <div class="stat-figure text-info">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <div class="stat-title">总计</div>
          <div class="stat-value text-info">{{ parseResult.features.length }}</div>
        </div>
      </div>

      <!-- 分析类型选择区域 -->
      <div v-if="parseResult">
        <label class="label">
          <span class="label-text font-semibold">选择分析类型</span>
        </label>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <label
            v-for="config in analysisConfigs"
            :key="config.type"
            class="flex items-center gap-2 cursor-pointer p-3 bg-base-200 rounded-lg hover:bg-base-300 transition-colors"
          >
            <input
              type="checkbox"
              :checked="selectedAnalysisTypes.includes(config.type)"
              :disabled="!isAnalysisTypeAvailable(config)"
              @change="toggleAnalysisType(config.type)"
              class="checkbox checkbox-primary"
            />
            <span class="text-sm">{{ config.label }}</span>
          </label>
        </div>
        <div class="flex gap-4 mt-4">
          <button @click="selectAllAnalysis" class="btn btn-sm btn-outline">全选</button>
          <button @click="deselectAllAnalysis" class="btn btn-sm btn-outline">取消全选</button>
          <button @click="toggleAllAnalysis" class="btn btn-sm btn-outline">反选</button>
        </div>
      </div>

      <!-- 操作按钮区域 -->
      <div class="flex flex-wrap gap-4">
        <button
          :disabled="!canStartAnalysis"
          @click="startAnalysis"
          class="btn btn-primary"
          :class="{ 'btn-disabled': !canStartAnalysis }"
        >
          <span v-if="isAnalyzing" class="loading loading-spinner loading-sm mr-2"></span>
          {{ isAnalyzing ? '分析中...' : '开始分析' }}
        </button>
        <div class="dropdown" v-if="canDownloadResult">
          <label tabindex="0" class="btn btn-success">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出数据
          </label>
          <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box shadow-lg p-2 w-52 z-10">
            <li>
              <a @click="exportResult('csv')" class="text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV 格式
              </a>
            </li>
            <li>
              <a @click="exportResult('xlsx')" class="text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel 格式
              </a>
            </li>
          </ul>
        </div>
        <button v-else disabled class="btn btn-disabled btn-success">导出数据</button>
        <button @click="clearAll" class="btn btn-outline btn-warning">清空</button>
      </div>

      <!-- 分析结果预览 -->
      <div v-if="analysisResults.length > 0" class="mt-4">
        <h3 class="text-lg font-semibold mb-2">分析结果</h3>
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>序号</th>
                <th>分析类型</th>
                <th>数据条数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(result, index) in analysisResults" :key="result.type">
                <td>{{ index + 1 }}</td>
                <td>{{ result.label }}</td>
                <td>{{ result.data.length }}</td>
                <td>
                  <button class="btn btn-xs btn-ghost" @click="previewResult(result)">预览</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 解析错误提示 -->
      <div v-if="parseErrors.length > 0" class="alert alert-warning shadow-lg">
        <div>
          <span>解析过程中遇到 {{ parseErrors.length }} 个问题：</span>
          <ul class="list-disc pl-5 text-sm mt-1">
            <li v-for="(error, index) in parseErrors" :key="index">{{ error }}</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 错误提示弹窗 -->
    <ErrorDialog
      :is-open="showErrorDialog"
      type="error"
      title="文件解析错误"
      message="您上传的文件存在以下问题，请检查后重新上传："
      :details="{ errorMessage: parseErrors.join('\n') }"
      @close="showErrorDialog = false"
    />

    <!-- 分析进度弹窗 -->
    <dialog ref="analysisModal" class="modal">
      <div class="modal-box">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-bold text-lg">空间分析</h3>
          <button @click="cancelAnalysis" class="btn btn-sm btn-outline btn-error">取消</button>
        </div>
        
        <!-- 总进度条 -->
        <div class="space-y-2 mb-6">
          <div class="flex justify-between text-sm">
            <span>总进度</span>
            <span>{{ analysisProgress.toFixed(0) }}%</span>
          </div>
          <progress
            class="progress progress-primary w-full"
            :value="analysisProgress"
            max="100"
          ></progress>
          <div class="text-sm text-gray-600">
            {{ analysisProgressMessage }} ({{ completedTasks }}/{{ totalTasks }})
          </div>
        </div>

        <!-- 当前任务进度条 -->
        <div class="space-y-2">
          <div class="flex justify-between text-sm">
            <span>当前任务</span>
            <span>{{ currentTaskProgress.toFixed(0) }}%</span>
          </div>
          <progress
            class="progress progress-secondary w-full"
            :value="currentTaskProgress"
            max="100"
          ></progress>
          <div class="text-sm text-gray-600">
            {{ currentTaskName || '准备中...' }}
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="cancelAnalysis">
        <button>close</button>
      </form>
    </dialog>

    <!-- 结果预览弹窗 -->
    <dialog ref="previewModal" class="modal modal-lg">
      <div class="modal-box max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <h3 class="font-bold text-lg">{{ previewTitle }}</h3>
        <div class="py-2 overflow-auto flex-1">
          <table class="table table-zebra table-compact w-full">
            <thead>
              <tr>
                <th v-for="(header, index) in previewColumns" :key="index">{{ header }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in previewData" :key="index">
                <td v-for="(header, hIndex) in previewColumns" :key="hIndex">{{ row[header] }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="previewData.length > 100" class="text-sm text-gray-500 mt-2 text-center">
            仅显示前 100 条，共 {{ previewTotal }} 条
          </p>
        </div>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn">关闭</button>
          </form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { getToolById } from '../toolData'
import { logger } from '@/utils/logger'
import {
  parseKML,
  parseKMZ,
  exportToXLSX,
  exportToCSV,
  type ParseResult,
  type AnalysisResult,
  type GeoFeature,
  type PointFeature,
  type LineFeature,
  type PolygonFeature,
} from './geoDataService'
import {
  analysisConfigs,
  getAnalysisLabel,
  getAvailableAnalysisTypes,
  analyzePoints,
  analyzeLines,
  analyzePolygons,
  analyzePointToPoint,
  analyzePointToLine,
  analyzePointToPolygon,
  analyzeLineToLine,
  analyzeLineToPolygon,
  analyzePolygonToPolygon,
  type AnalysisType,
} from './geoAnalysisService'
import ErrorDialog from '@/components/common/ErrorDialog.vue'

const toolConfig = getToolById('geo_data')

// 状态定义
const fileInput = ref<HTMLInputElement | null>(null)
const uploadedFile = ref<File | null>(null)
const isDragging = ref(false)
const isParsing = ref(false)
const parseProgress = ref(0)
const parseProgressMessage = ref('')
const parseResult = ref<ParseResult | null>(null)
const parseErrors = ref<string[]>([])
const showErrorDialog = ref(false)

// 通用错误对话框状态
const errorDialogOpen = ref(false)
const errorDialogType = ref<'error' | 'warning' | 'success' | 'info'>('error')
const errorDialogTitle = ref('操作失败')
const errorDialogMessage = ref('')

const closeErrorDialog = () => {
  errorDialogOpen.value = false
  errorDialogMessage.value = ''
}

const showErrorDialogMsg = (type: 'error' | 'warning' | 'success' | 'info', title: string, message: string) => {
  errorDialogType.value = type
  errorDialogTitle.value = title
  errorDialogMessage.value = message
  errorDialogOpen.value = true
}

const selectedAnalysisTypes = ref<AnalysisType[]>([])
const isAnalyzing = ref(false)
const analysisProgress = ref(0)
const analysisProgressMessage = ref('')
const analysisResults = ref<AnalysisResult[]>([])

// 分析进度模态框状态
const analysisModal = ref<HTMLDialogElement | null>(null)
const isCancelRequested = ref(false)
const currentTaskProgress = ref(0)
const currentTaskName = ref('')
const totalTasks = ref(0)
const completedTasks = ref(0)

const previewModal = ref<HTMLDialogElement | null>(null)
const previewTitle = ref('')
const previewData = ref<Record<string, unknown>[]>([])
const previewColumns = ref<string[]>([])
const previewTotal = ref(0)

// 计算属性
const canStartAnalysis = computed(() => {
  return parseResult.value !== null &&
    selectedAnalysisTypes.value.length > 0 &&
    !isAnalyzing.value
})

const canDownloadResult = computed(() => {
  return analysisResults.value.length > 0 &&
    selectedAnalysisTypes.value.length > 0 &&
    !isAnalyzing.value
})

// 检查分析类型是否可用
const isAnalysisTypeAvailable = (config: typeof analysisConfigs[0]): boolean => {
  if (!parseResult.value) return false
  const { totalPoints, totalLines, totalPolygons } = parseResult.value
  if (config.minPoints && totalPoints < config.minPoints) return false
  if (config.minLines && totalLines < config.minLines) return false
  if (config.minPolygons && totalPolygons < config.minPolygons) return false
  return true
}

// 触发文件选择
const triggerFileInput = () => {
  fileInput.value?.click()
}

// 文件上传处理
const onFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return

  const file = target.files[0]!
  uploadedFile.value = file
  await processFile(file)
}

// 拖拽处理
const handleDrop = async (event: DragEvent) => {
  isDragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file) {
    uploadedFile.value = file
    await processFile(file)
  }
}

// 处理文件
const processFile = async (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension !== 'kml' && extension !== 'kmz') {
    parseErrors.value = ['仅支持 KML 和 KMZ 格式的文件']
    showErrorDialog.value = true
    return
  }

  isParsing.value = true
  parseProgress.value = 0
  parseProgressMessage.value = '准备解析...'
  parseErrors.value = []

  try {
    const result = extension === 'kmz'
      ? await parseKMZ(file, updateParseProgress)
      : await parseKML(file, updateParseProgress)

    parseResult.value = result

    if (!result.success) {
      parseErrors.value = result.errors
      showErrorDialog.value = true
      return
    }

    if (result.errors.length > 0) {
      parseErrors.value = result.errors
    }

    autoSelectAnalysisTypes()
  } catch (error) {
    parseErrors.value = [`解析失败: ${error instanceof Error ? error.message : '未知错误'}`]
    showErrorDialog.value = true
  } finally {
    isParsing.value = false
  }
}

// 更新解析进度
const updateParseProgress = (progress: number, message: string) => {
  parseProgress.value = progress
  parseProgressMessage.value = message
}

// 清空文件
const clearFile = () => {
  uploadedFile.value = null
  parseResult.value = null
  parseErrors.value = []
  selectedAnalysisTypes.value = []
  analysisResults.value = []
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// 切换分析类型
const toggleAnalysisType = (type: AnalysisType) => {
  const index = selectedAnalysisTypes.value.indexOf(type)
  if (index > -1) {
    selectedAnalysisTypes.value.splice(index, 1)
  } else {
    selectedAnalysisTypes.value.push(type)
  }
}

// 全选分析类型
const selectAllAnalysis = () => {
  selectedAnalysisTypes.value = getAvailableAnalysisTypes(
    parseResult.value?.totalPoints ?? 0,
    parseResult.value?.totalLines ?? 0,
    parseResult.value?.totalPolygons ?? 0
  )
}

// 取消全选
const deselectAllAnalysis = () => {
  selectedAnalysisTypes.value = []
}

// 反选分析类型
const toggleAllAnalysis = () => {
  const availableTypes = getAvailableAnalysisTypes(
    parseResult.value?.totalPoints ?? 0,
    parseResult.value?.totalLines ?? 0,
    parseResult.value?.totalPolygons ?? 0
  )
  const currentSet = new Set(selectedAnalysisTypes.value)
  selectedAnalysisTypes.value = availableTypes.filter(type => !currentSet.has(type))
}

// 自动选择可用的分析类型
const autoSelectAnalysisTypes = () => {
  if (!parseResult.value) return
  selectedAnalysisTypes.value = getAvailableAnalysisTypes(
    parseResult.value.totalPoints,
    parseResult.value.totalLines,
    parseResult.value.totalPolygons
  )
}

// 开始分析
const startAnalysis = async () => {
  if (!canStartAnalysis.value || !parseResult.value) return

  isAnalyzing.value = true
  isCancelRequested.value = false
  analysisProgress.value = 0
  analysisProgressMessage.value = '准备分析...'
  analysisResults.value = []
  currentTaskProgress.value = 0
  currentTaskName.value = ''
  totalTasks.value = selectedAnalysisTypes.value.length
  completedTasks.value = 0

  if (analysisModal.value) {
    analysisModal.value.showModal()
  }

  try {
    const results = await performAnalysisAsync(
      parseResult.value.features,
      selectedAnalysisTypes.value
    )

    if (!isCancelRequested.value) {
      analysisResults.value = results
    }
  } catch (error) {
    if (!isCancelRequested.value) {
      parseErrors.value = [`分析失败: ${error instanceof Error ? error.message : '未知错误'}`]
      showErrorDialog.value = true
    }
  } finally {
    isAnalyzing.value = false
    if (analysisModal.value) {
      analysisModal.value.close()
    }
  }
}

// 异步分析函数（支持取消）
const performAnalysisAsync = async (
  features: GeoFeature[],
  analysisTypes: AnalysisType[]
): Promise<AnalysisResult[]> => {
  const results: AnalysisResult[] = []
  const points = features.filter((f): f is PointFeature => f.type === 'Point')
  const lines = features.filter((f): f is LineFeature => f.type === 'LineString')
  const polygons = features.filter((f): f is PolygonFeature => f.type === 'Polygon')

  totalTasks.value = analysisTypes.length
  completedTasks.value = 0

  const progressCallback = (progress: number, taskName: string) => {
    updateCurrentTaskProgress(progress, taskName)
  }

  const cancelCallback = () => isCancelRequested.value

  for (const type of analysisTypes) {
    if (isCancelRequested.value) {
      throw new Error('分析已取消')
    }

    const taskLabel = getAnalysisLabel(type)
    updateCurrentTaskProgress(0, taskLabel)

    await new Promise(resolve => setTimeout(resolve, 10))

    let result: AnalysisResult | null = null

    switch (type) {
      case 'point_analysis':
        result = await analyzePoints(points, progressCallback, cancelCallback)
        break
      case 'line_analysis':
        result = await analyzeLines(lines, progressCallback, cancelCallback)
        break
      case 'polygon_analysis':
        result = await analyzePolygons(polygons, progressCallback, cancelCallback)
        break
      case 'point_to_point':
        result = await analyzePointToPoint(points, progressCallback, cancelCallback)
        break
      case 'point_to_line':
        result = await analyzePointToLine(points, lines, progressCallback, cancelCallback)
        break
      case 'point_to_polygon':
        result = await analyzePointToPolygon(points, polygons, progressCallback, cancelCallback)
        break
      case 'line_to_line':
        result = await analyzeLineToLine(lines, progressCallback, cancelCallback)
        break
      case 'line_to_polygon':
        result = await analyzeLineToPolygon(lines, polygons, progressCallback, cancelCallback)
        break
      case 'polygon_to_polygon':
        result = await analyzePolygonToPolygon(polygons, progressCallback, cancelCallback)
        break
    }

    if (result && !isCancelRequested.value) {
      results.push(result)
    }

    completedTasks.value++
    const totalProgress = (completedTasks.value / totalTasks.value) * 100
    updateAnalysisProgress(totalProgress, `已完成 ${completedTasks.value}/${totalTasks.value}`)
    updateCurrentTaskProgress(100, '')
  }

  return results
}

// 更新分析进度
const updateAnalysisProgress = (progress: number, message: string) => {
  analysisProgress.value = progress
  analysisProgressMessage.value = message
}

// 更新当前任务进度
const updateCurrentTaskProgress = (progress: number, taskName: string) => {
  currentTaskProgress.value = progress
  currentTaskName.value = taskName
}

// 取消分析
const cancelAnalysis = () => {
  isCancelRequested.value = true
}

// 预览结果
const previewResult = (result: AnalysisResult) => {
  previewTitle.value = result.label
  previewTotal.value = result.data.length
  previewData.value = result.data.slice(0, 100)
  previewColumns.value = result.columns
  if (previewModal.value) {
    previewModal.value.showModal()
  }
}

// 导出结果
const exportResult = (format: 'csv' | 'xlsx') => {
  if (!canDownloadResult.value) return

  try {
    if (format === 'xlsx') {
      exportToXLSX(analysisResults.value, selectedAnalysisTypes.value)
    } else {
      exportToCSV(analysisResults.value, selectedAnalysisTypes.value)
    }
  } catch (error) {
    logger.error(`导出${format}失败:`, error)
    showErrorDialogMsg('error', '导出失败', `导出${format === 'csv' ? 'CSV' : 'Excel'}时发生错误`)
  }
}

// 清空所有状态
const clearAll = () => {
  clearFile()
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>
