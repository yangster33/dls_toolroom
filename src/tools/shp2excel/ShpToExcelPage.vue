<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || 'SHP转表格' }}</h1>
    <p class="text-base-content/70 mb-6">{{ toolConfig?.description || '将SHP文件转换为Excel/CSV表格' }}</p>

    <div class="bg-base-100 rounded-lg shadow-lg p-6 mb-6 space-y-6">
      <!-- 步骤1: 上传SHP文件 -->
      <div>
        <h2 class="text-xl font-semibold mb-4">1. 上传SHP文件</h2>
        <input
          ref="fileInputRef"
          type="file"
          @change="onFileUpload"
          class="file-input file-input-bordered w-full max-w-md"
          accept=".shp"
          multiple
          :disabled="isConverting"
        />
        <p class="text-sm text-base-content/60 mt-2">支持格式：Shapefile (.shp)，可一次选择多个不同类型的SHP文件</p>
      </div>

      <!-- 已验证的文件列表 -->
      <div v-if="fileEntries.length > 0" class="space-y-3">
        <div
          v-for="(entry, index) in fileEntries"
          :key="index"
          class="border rounded-lg p-3"
          :class="entry.isValid ? 'border-success/40 bg-success/5' : 'border-error/40 bg-error/5'"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <svg v-if="entry.isValid" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span class="font-medium text-sm">{{ entry.fileName }}</span>
            </div>
            <button
              @click="removeFile(index)"
              class="btn btn-xs btn-ghost text-error"
              :disabled="isConverting"
              title="移除文件"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
          <div v-if="entry.isValid" class="text-sm text-base-content/60 mt-1">
            检测到 {{ entry.totalFeatures }} 个地理要素：
            <span v-if="entry.pointCount > 0" class="text-primary">{{ entry.pointCount }} 个点</span>
            <span v-if="entry.lineCount > 0" class="text-blue-600">{{ entry.pointCount > 0 ? '，' : '' }}{{ entry.lineCount }} 条线</span>
            <span v-if="entry.polygonCount > 0" class="text-green-600">{{ (entry.pointCount > 0 || entry.lineCount > 0) ? '，' : '' }}{{ entry.polygonCount }} 个面</span>
          </div>
          <div v-else class="text-sm text-error mt-1">{{ entry.errors.join('；') }}</div>
        </div>
      </div>

      <!-- 汇总统计 -->
      <div v-if="validateResult && validateResult.isValid" class="space-y-2">
        <div class="flex items-center gap-2 text-success font-semibold">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          全部验证通过（{{ fileEntries.length }} 个文件）
        </div>
        <div class="text-sm text-base-content/70">
          共计 {{ validateResult.totalFeatures }} 个地理要素：
          <span v-if="validateResult.pointCount > 0" class="text-primary">{{ validateResult.pointCount }} 个点</span>
          <span v-if="validateResult.lineCount > 0" class="text-blue-600">，{{ validateResult.lineCount }} 条线</span>
          <span v-if="validateResult.polygonCount > 0" class="text-green-600">，{{ validateResult.polygonCount }} 个面</span>
        </div>
      </div>

      <!-- 高级选项 -->
      <div>
        <button
          @click="showAdvancedOptions = !showAdvancedOptions"
          class="btn btn-sm btn-outline mb-4 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" :class="{ 'rotate-180': showAdvancedOptions }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
          高级选项
        </button>
        
        <div v-show="showAdvancedOptions" class="border border-base-200 rounded-lg p-4 space-y-4">
          <div class="space-y-2">
            <h3 class="font-medium text-sm">LineString 设置</h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label text-xs">经纬度分隔符</label>
                <input
                  v-model="advancedOptions.lonLatSeparator"
                  type="text"
                  class="input input-sm input-bordered w-full"
                  placeholder=","
                />
              </div>
              <div>
                <label class="label text-xs">坐标点分隔符</label>
                <input
                  v-model="advancedOptions.coordSeparator"
                  type="text"
                  class="input input-sm input-bordered w-full"
                  placeholder=";"
                />
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <h3 class="font-medium text-sm">Polygon 设置</h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label text-xs">经纬度分隔符</label>
                <input
                  v-model="advancedOptions.polygonLonLatSeparator"
                  type="text"
                  class="input input-sm input-bordered w-full"
                  placeholder=","
                />
              </div>
              <div>
                <label class="label text-xs">坐标点分隔符</label>
                <input
                  v-model="advancedOptions.polygonCoordSeparator"
                  type="text"
                  class="input input-sm input-bordered w-full"
                  placeholder=";"
                />
              </div>
            </div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="advancedOptions.closePolygon"
                type="checkbox"
                class="checkbox checkbox-sm"
              />
              <span class="text-sm">首位经纬度闭环</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex flex-wrap gap-3">
        <button
          :disabled="!canConvert || isConverting"
          @click="handleConvert"
          class="btn btn-success"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {{ isConverting ? '转换中...' : '转换' }}
        </button>
        
        <div class="dropdown" v-if="canDownload">
          <label tabindex="0" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            下载结果
          </label>
          <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box shadow-lg p-2 w-48 z-10">
            <li>
              <a @click="downloadAll('xlsx')" class="text-sm">Excel 格式（单文件）</a>
            </li>
            <li>
              <a @click="downloadAll('csv')" class="text-sm">CSV 格式（单文件）</a>
            </li>
            <li class="divider"></li>
            <li>
              <a @click="downloadSeparate('xlsx')" class="text-sm">Excel 格式（分文件）</a>
            </li>
            <li>
              <a @click="downloadSeparate('csv')" class="text-sm">CSV 格式（分文件）</a>
            </li>
          </ul>
        </div>
        
        <button v-else disabled class="btn btn-disabled btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          下载结果
        </button>
        
        <button @click="handleClear" class="btn btn-outline btn-warning">清空</button>
      </div>
    </div>

    <!-- 转换进度弹窗 -->
    <div v-if="isConverting" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h3 class="font-bold text-lg mb-4">正在转换...</h3>
        <div class="w-full bg-base-200 rounded-full h-2.5 mb-2">
          <div
            class="bg-success h-2.5 rounded-full transition-all duration-300"
            :style="{ width: `${progress}%` }"
          ></div>
        </div>
        <p class="text-sm text-base-content/70 text-center">{{ progressText }}</p>
      </div>
    </div>

    <ErrorDialog
      :is-open="showError"
      type="error"
      title="文件处理失败"
      :message="errorMessage"
      @close="showError = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { getToolById } from '../toolData'
import { type ShpMultiFileResult, type ShpSingleFileResult } from './ShpFileReader'
import { exportToExcel, exportSeparateFiles } from '../gis2excel/GisToExcelExporter'
import type { GisFeature } from '../gis2excel/GisFileReader'
import ErrorDialog from '@/components/common/ErrorDialog.vue'

const toolConfig = getToolById('shp2excel')

const fileInputRef = ref<HTMLInputElement | null>(null)
const fileEntries = ref<ShpSingleFileResult[]>([])
const validateResult = ref<ShpMultiFileResult | null>(null)
const convertedData = ref<GisFeature[][] | null>(null)
const errorMessage = ref('')
const progress = ref(0)
const progressText = ref('')
const isConverting = ref(false)
const showAdvancedOptions = ref(false)
const showError = ref(false)

const advancedOptions = reactive({
  lonLatSeparator: ',',
  coordSeparator: ';',
  polygonLonLatSeparator: ',',
  polygonCoordSeparator: ';',
  closePolygon: true,
})

const canConvert = computed(() => {
  return validateResult.value?.isValid === true && validateResult.value.totalFeatures > 0 && !isConverting.value
})

const canDownload = computed(() => {
  return convertedData.value !== null && convertedData.value.length > 0
})

async function onFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return

  const newFiles: File[] = Array.from(target.files)
  
  validateResult.value = null
  convertedData.value = null
  errorMessage.value = ''

  try {
    // Validate new files one by one
    const newEntries: ShpSingleFileResult[] = []
    for (const file of newFiles) {
      const { validateSingleShpFile } = await import('./ShpFileReader')
      const result = await validateSingleShpFile(file)
      newEntries.push(result)
    }

    // Add to existing entries (avoid duplicates by file name)
    for (const entry of newEntries) {
      const existingIdx = fileEntries.value.findIndex(e => e.fileName === entry.fileName)
      if (existingIdx >= 0) {
        fileEntries.value[existingIdx] = entry
      } else {
        fileEntries.value.push(entry)
      }
    }

    // Re-validate all files
    await revalidateAll()
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : String(err)
    showError.value = true
  }

  // Reset file input so the same file can be selected again
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

async function revalidateAll() {
  if (fileEntries.value.length === 0) {
    validateResult.value = null
    return
  }

  const allFiles = fileEntries.value.map(e => e)
  
  // Build multi-file result from existing entries
  const allFeatures: GisFeature[] = []
  const errors: string[] = []
  for (const entry of fileEntries.value) {
    if (!entry.isValid) {
      errors.push(...entry.errors)
    }
    allFeatures.push(...entry.features)
  }

  const pointCount = allFeatures.filter(f => f.type === 'Point').length
  const lineCount = allFeatures.filter(f => f.type === 'LineString').length
  const polygonCount = allFeatures.filter(f => f.type === 'Polygon').length

  const isValid = errors.length === 0 && allFeatures.length > 0

  validateResult.value = {
    isValid,
    errors,
    fileResults: fileEntries.value,
    totalFeatures: allFeatures.length,
    pointCount,
    lineCount,
    polygonCount,
    allFeatures,
  }

  if (!isValid && errors.length === 0 && allFeatures.length === 0) {
    validateResult.value.errors.push('所有SHP文件中均未找到任何地理要素')
  }

  // Show error if there are invalid files but some valid ones
  if (!isValid && errors.length > 0) {
    errorMessage.value = errors.join('\n')
    // Don't show error modal here, it's shown in the file list
  }
}

function removeFile(index: number) {
  fileEntries.value.splice(index, 1)
  revalidateAll()
}

async function handleConvert() {
  if (!validateResult.value?.allFeatures) return

  isConverting.value = true
  progress.value = 0
  progressText.value = '正在解析地理要素...'

  try {
    await new Promise(resolve => setTimeout(resolve, 100))

    progress.value = 30
    progressText.value = '正在转换数据...'

    await new Promise(resolve => setTimeout(resolve, 200))

    progress.value = 70
    progressText.value = '正在整理表格...'

    const groupedFeatures: GisFeature[][] = []
    const pointFeatures = validateResult.value.allFeatures.filter(f => f.type === 'Point')
    const lineFeatures = validateResult.value.allFeatures.filter(f => f.type === 'LineString')
    const polygonFeatures = validateResult.value.allFeatures.filter(f => f.type === 'Polygon')

    if (pointFeatures.length > 0) groupedFeatures.push(pointFeatures)
    if (lineFeatures.length > 0) groupedFeatures.push(lineFeatures)
    if (polygonFeatures.length > 0) groupedFeatures.push(polygonFeatures)

    convertedData.value = groupedFeatures

    await new Promise(resolve => setTimeout(resolve, 200))

    progress.value = 100
    progressText.value = '转换完成'

    await new Promise(resolve => setTimeout(resolve, 500))

    isConverting.value = false
  } catch (err) {
    isConverting.value = false
    errorMessage.value = err instanceof Error ? err.message : String(err)
    showError.value = true
  }
}

function downloadAll(format: 'xlsx' | 'csv') {
  if (!convertedData.value) return

  const options = {
    lonLatSeparator: advancedOptions.lonLatSeparator || ',',
    coordSeparator: advancedOptions.coordSeparator || ';',
    polygonLonLatSeparator: advancedOptions.polygonLonLatSeparator || ',',
    polygonCoordSeparator: advancedOptions.polygonCoordSeparator || ';',
    closePolygon: advancedOptions.closePolygon,
  }

  exportToExcel(convertedData.value, format, options)
}

function downloadSeparate(format: 'xlsx' | 'csv') {
  if (!convertedData.value) return

  const options = {
    lonLatSeparator: advancedOptions.lonLatSeparator || ',',
    coordSeparator: advancedOptions.coordSeparator || ';',
    polygonLonLatSeparator: advancedOptions.polygonLonLatSeparator || ',',
    polygonCoordSeparator: advancedOptions.polygonCoordSeparator || ';',
    closePolygon: advancedOptions.closePolygon,
  }

  exportSeparateFiles(convertedData.value, format, options)
}

function handleClear() {
  fileEntries.value = []
  validateResult.value = null
  convertedData.value = null
  errorMessage.value = ''
  progress.value = 0
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}
</script>
