<template>
  <div class="p-6">
    <ErrorDialog
      :is-open="errorDialogOpen"
      :type="errorDialogType"
      :title="errorDialogTitle"
      :message="errorDialogMessage"
      @close="closeErrorDialog"
    />
    <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || '批量坐标转换' }}</h1>
    <p class="text-base-content/70 mb-6">{{ toolConfig?.description || '支持多种坐标系相互转换' }}</p>

    <div class="bg-base-100/70 backdrop-blur-sm rounded-lg shadow-lg p-6 mb-6 space-y-6">
      <!-- 1. 下载模板 -->
      <div>
        <h2 class="text-xl font-semibold mb-4">1. 下载模板</h2>
        <p class="text-base-content/70 mb-3 text-sm">
          模板格式（3列）：名称、经度/X（必填）、纬度/Y（必填）
        </p>
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
              <a @click="downloadCsvTemplate" class="text-sm">CSV 格式</a>
            </li>
            <li>
              <a @click="downloadXlsxTemplate" class="text-sm">Excel 格式</a>
            </li>
          </ul>
        </div>
      </div>

      <!-- 2. 设置转换参数 -->
      <div>
        <h2 class="text-xl font-semibold mb-4">2. 设置转换参数</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="label">
              <span class="label-text font-semibold">输入坐标系</span>
            </label>
            <select v-model="inputCoordinateSystem" class="select select-bordered w-full">
              <option disabled :value="''">请选择输入坐标系</option>
              <option value="wgs84">WGS84</option>
              <option value="gcj02">GCJ-02</option>
              <option value="bd09">百度 BD-09</option>
              <option value="amap">高德地图</option>
              <option value="cgcs2000_lnglat">CGCS2000（经纬度）</option>
              <option value="cgcs2000_xy">CGCS2000（平面坐标）</option>
            </select>
          </div>
          <div>
            <label class="label">
              <span class="label-text font-semibold">输出坐标系</span>
            </label>
            <select v-model="outputCoordinateSystem" class="select select-bordered w-full">
              <option disabled :value="''">请选择输出坐标系</option>
              <option value="wgs84">WGS84</option>
              <option value="gcj02">GCJ-02</option>
              <option value="bd09">百度 BD-09</option>
              <option value="amap">高德地图</option>
              <option value="cgcs2000_lnglat">CGCS2000（经纬度）</option>
              <option value="cgcs2000_xy">CGCS2000（平面坐标）</option>
            </select>
          </div>
        </div>
        <!-- CGCS2000 投影参数 -->
        <div class="mt-4">
          <div class="collapse collapse-arrow bg-base-200 border-base-300 border">
            <input type="checkbox" />
            <div class="collapse-title font-semibold">
              CGCS2000 投影参数（按需求填写，选填）
            </div>
            <div class="collapse-content">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 pt-2">
                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium">中央子午线经度</span>
                  <input
                    v-model.number="cgcs2000Params.centralMeridian"
                    type="number"
                    step="0.1"
                    class="input input-bordered input-sm w-full"
                  />
                </label>

                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium">分带度数</span>
                  <select
                    v-model.number="cgcs2000Params.zoneWidth"
                    class="select select-bordered select-sm w-full"
                  >
                    <option :value="3">3 度带</option>
                    <option :value="6">6 度带</option>
                  </select>
                </label>

                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium">计算后的中央子午线</span>
                  <input
                    :value="computedCM"
                    type="text"
                    readonly
                    class="input input-bordered input-sm w-full bg-base-300"
                  />
                </label>

                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium">假东偏移（米）</span>
                  <input
                    v-model.number="cgcs2000Params.falseEasting"
                    type="number"
                    class="input input-bordered input-sm w-full"
                  />
                </label>

                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium">假北偏移（米）</span>
                  <input
                    v-model.number="cgcs2000Params.falseNorthing"
                    type="number"
                    class="input input-bordered input-sm w-full"
                  />
                </label>

                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium">比例因子</span>
                  <input
                    v-model.number="cgcs2000Params.scaleFactor"
                    type="number"
                    step="0.0001"
                    class="input input-bordered input-sm w-full"
                  />
                </label>

                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-medium">原点纬度</span>
                  <input
                    v-model.number="cgcs2000Params.originLatitude"
                    type="number"
                    step="0.1"
                    class="input input-bordered input-sm w-full"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. 上传数据文件 -->
      <div>
        <h2 class="text-xl font-semibold mb-4">3. 上传数据文件</h2>
        <input
          type="file"
          @change="onFileUpload"
          class="file-input file-input-bordered w-full max-w-md"
          accept=".csv, .xlsx"
          :disabled="!canUploadFile"
          ref="fileInputRef"
        />
        <div class="text-sm text-gray-500 mt-2" v-if="!canUploadFile">
          请先选择输入和输出坐标系
        </div>
        <div class="text-sm text-gray-500 mt-2" v-else>
          支持 CSV 或 Excel 格式，请确保格式与模板一致
        </div>

        <!-- 操作按钮 -->
        <div class="flex flex-wrap gap-3 mt-4">
          <button
            :disabled="!canStartConversion"
            @click="startConversion"
            class="btn btn-primary"
          >
            <span v-if="isProcessing" class="loading loading-spinner loading-sm mr-2"></span>
            {{ isProcessing ? '转换中...' : '开始转换' }}
          </button>
          <button
            v-if="isProcessing"
            @click="cancelConversion"
            class="btn btn-outline btn-warning"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            取消转换
          </button>
          <!-- 下载结果下拉按钮 -->
          <div class="dropdown" v-if="canDownloadResult">
            <label tabindex="0" class="btn btn-success">
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
          <button v-else disabled class="btn btn-disabled btn-success">
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
          </button>
          <button @click="clearAll" class="btn btn-outline btn-error">
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
            清除所有数据
          </button>
        </div>

        <!-- 进度条 -->
        <div v-if="isProcessing" class="mt-4 space-y-2">
          <div class="flex justify-between text-sm">
            <span>转换进度</span>
            <span>{{ conversionProgress }}% ({{ processedRows }}/{{ totalRows }})</span>
          </div>
          <progress
            class="progress progress-primary w-full max-w-md"
            :value="conversionProgress"
            max="100"
          ></progress>
          <div v-if="estimatedRemainingTime > 0" class="text-sm text-gray-500">
            预计剩余时间: {{ formatTime(estimatedRemainingTime) }}
          </div>
        </div>
      </div>

      <!-- 转换错误 -->
      <div v-if="conversionErrors.length > 0" class="alert alert-warning">
        <div>
          <h3 class="font-bold">转换过程遇到问题</h3>
          <div class="text-sm">
            <p v-for="(error, index) in conversionErrors.slice(0, 5)" :key="index">
              {{ error }}
            </p>
            <p v-if="conversionErrors.length > 5">
              ...还有 {{ conversionErrors.length - 5 }} 个问题
            </p>
          </div>
        </div>
      </div>

      <!-- 4. 转换结果预览 -->
      <div v-if="conversionResultData.length > 0" class="space-y-4">
        <h2 class="text-xl font-semibold">4. 转换结果</h2>
        <div class="alert alert-info">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="stroke-current shrink-0 w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <span>共转换 {{ conversionResultData.length }} 行数据</span>
        </div>

        <div class="overflow-x-auto">
          <table class="table table-zebra table-sm">
            <thead>
              <tr>
                <th v-for="(header, index) in conversionResultHeaders" :key="index">
                  {{ header }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in conversionResultData.slice(0, 20)" :key="index">
                <td v-for="(header, hIndex) in conversionResultHeaders" :key="hIndex">
                  {{ row[header] }}
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="conversionResultData.length > 20" class="text-center text-gray-500 py-2">
            ...还有 {{ conversionResultData.length - 20 }} 行未显示
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { exportTemplate } from '@/utils/TemplateExporter'
import { getToolById } from '../toolData'
import ErrorDialog from '@/components/common/ErrorDialog.vue'

const toolConfig = getToolById('coords_convert')
import {
  batchConvertCoordinates,
  type ConversionResult as CoordConversionResult,
  type DataRow,
  type ConversionProgressInfo,
  convertToCsv,
  convertToXlsx,
  type CGCS2000Params,
  DEFAULT_CGCS2000_PARAMS,
  computeCentralMeridian,
} from './coordsConversion'
import { readAndValidateCoordTemplate, type CoordReadResult } from './templateReader'

const templateHeaders = ['名称', '经度/X（必填）', '纬度/Y（必填）']
const fileInputRef = ref<HTMLInputElement | null>(null)

// 响应式状态
const inputCoordinateSystem = ref<string>('')
const outputCoordinateSystem = ref<string>('')
const validationErrors = ref<string[]>([])

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

// CGCS2000投影参数
const cgcs2000Params = ref<CGCS2000Params>({ ...DEFAULT_CGCS2000_PARAMS })
const computedCM = computed(() =>
  computeCentralMeridian(cgcs2000Params.value.centralMeridian, cgcs2000Params.value.zoneWidth),
)

// 转换相关状态
const validatedDataRows = ref<DataRow[]>([])
const isProcessing = ref<boolean>(false)
const conversionProgress = ref<number>(0)
const conversionCompleted = ref<boolean>(false)
const conversionResultData = ref<DataRow[]>([])
const conversionResultHeaders = ref<string[]>([])
const conversionErrors = ref<string[]>([])
const processedRows = ref<number>(0)
const totalRows = ref<number>(0)
const estimatedRemainingTime = ref<number>(0)
const abortController = ref<AbortController | null>(null)

// 计算属性
const canUploadFile = computed(() => {
  return inputCoordinateSystem.value !== '' && outputCoordinateSystem.value !== ''
})

const canStartConversion = computed(() => {
  return (
    inputCoordinateSystem.value !== '' &&
    outputCoordinateSystem.value !== '' &&
    validatedDataRows.value.length > 0 &&
    !isProcessing.value
  )
})

const canDownloadResult = computed(() => {
  return conversionCompleted.value && conversionResultData.value.length > 0
})

const hasUploadedFile = computed(() => {
  return validatedDataRows.value.length > 0
})

// 模板下载
const downloadCsvTemplate = () => {
  exportTemplate(templateHeaders, 'csv', '坐标转换模板')
}
const downloadXlsxTemplate = () => {
  exportTemplate(templateHeaders, 'xlsx', '坐标转换模板')
}

// 文件上传
const onFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return

  const file = target.files[0]!
  validationErrors.value = []
  validatedDataRows.value = []

  try {
    const validateResult: CoordReadResult = await readAndValidateCoordTemplate(
      file,
      inputCoordinateSystem.value,
    )

    if (validateResult.isValid) {
      validatedDataRows.value = validateResult.dataRows
    } else {
      validationErrors.value = validateResult.errors
      const errorMessage =
        validateResult.errors.slice(0, 5).join('\n') +
        (validateResult.errors.length > 5
          ? `\n...还有 ${validateResult.errors.length - 5} 个错误`
          : '')
      showErrorDialog('error', '文件验证失败', errorMessage)
    }
  } catch (error) {
    const errorMsg = `文件处理失败: ${error instanceof Error ? error.message : String(error)}`
    validationErrors.value.push(errorMsg)
    showErrorDialog('error', '文件处理失败', errorMsg)
  }
}

const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes > 0) {
    return `${minutes}分${remainingSeconds}秒`
  }
  return `${remainingSeconds}秒`
}

// 开始转换
const startConversion = async () => {
  if (!canStartConversion.value) return

  isProcessing.value = true
  conversionProgress.value = 0
  conversionCompleted.value = false
  conversionResultData.value = []
  conversionResultHeaders.value = []
  conversionErrors.value = []
  processedRows.value = 0
  totalRows.value = validatedDataRows.value.length
  estimatedRemainingTime.value = 0

  abortController.value = new AbortController()

  try {
    const conversionOptions = {
      inputSystem: inputCoordinateSystem.value,
      outputSystem: outputCoordinateSystem.value,
      cgcs2000Params: cgcs2000Params.value,
      abortSignal: abortController.value.signal,
      batchSize: 50,
      onProgress: (info: ConversionProgressInfo) => {
        conversionProgress.value = info.progress
        processedRows.value = info.processedRows
        totalRows.value = info.totalRows
        estimatedRemainingTime.value = info.estimatedRemainingTime
      },
    }

    const result: CoordConversionResult = await batchConvertCoordinates(
      validatedDataRows.value,
      conversionOptions,
    )

    isProcessing.value = false
    conversionCompleted.value = result.success
    conversionResultData.value = result.data
    conversionResultHeaders.value = result.outputHeaders
    conversionErrors.value = result.errors
  } catch (error) {
    isProcessing.value = false
    conversionErrors.value.push(
      `转换过程发生未预期错误: ${error instanceof Error ? error.message : String(error)}`,
    )
  } finally {
    abortController.value = null
  }
}

// 取消转换
const cancelConversion = () => {
  abortController.value?.abort()
}

// 下载结果
const downloadResult = (format: 'csv' | 'xlsx' = 'csv') => {
  if (!canDownloadResult.value || conversionResultData.value.length === 0) return

  try {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const baseFilename = `坐标转换结果_${timestamp}`

    if (format === 'csv') {
      const csvContent = convertToCsv(conversionResultData.value, conversionResultHeaders.value)
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.href = url
      link.setAttribute('download', `${baseFilename}.csv`)
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }, 100)
    } else if (format === 'xlsx') {
      const xlsxBlob = convertToXlsx(conversionResultData.value, conversionResultHeaders.value)
      const link = document.createElement('a')
      const url = URL.createObjectURL(xlsxBlob)
      link.href = url
      link.setAttribute('download', `${baseFilename}.xlsx`)
      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }, 100)
    }
  } catch (error) {
    showErrorDialog('error', '下载失败', `下载${format === 'csv' ? 'CSV' : 'Excel'}结果时发生错误，请检查控制台`)
  }
}

// 清除
const clearAll = () => {
  inputCoordinateSystem.value = ''
  outputCoordinateSystem.value = ''
  validationErrors.value = []
  validatedDataRows.value = []
  conversionResultData.value = []
  conversionResultHeaders.value = []
  conversionErrors.value = []
  isProcessing.value = false
  conversionProgress.value = 0
  conversionCompleted.value = false
  processedRows.value = 0
  totalRows.value = 0
  estimatedRemainingTime.value = 0
  abortController.value?.abort()
  abortController.value = null
  cgcs2000Params.value = { ...DEFAULT_CGCS2000_PARAMS }

  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}
</script>
