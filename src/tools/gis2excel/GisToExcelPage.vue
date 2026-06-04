<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || 'GIS转表格' }}</h1>
    <p class="text-base-content/70 mb-6">{{ toolConfig?.description || '将SHP、KML、KMZ文件转换为Excel表格' }}</p>

    <div class="bg-base-100/70 backdrop-blur-sm rounded-lg shadow-lg p-6 mb-6 space-y-6">
      <div>
        <h2 class="text-xl font-semibold mb-4">1. 上传GIS文件</h2>
        <input
          ref="fileInputRef"
          type="file"
          @change="onFileUpload"
          class="file-input file-input-bordered w-full max-w-md"
          accept=".shp,.kml,.kmz"
          :disabled="isConverting"
        />
        <p class="text-sm text-base-content/60 mt-2">支持格式：Shapefile (.shp)、KML (.kml)、KMZ (.kmz)</p>
      </div>

      <div v-if="validateResult && validateResult.isValid" class="space-y-2">
        <div class="flex items-center gap-2 text-success font-semibold">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          验证通过
        </div>
        <div class="text-sm text-base-content/70">
          检测到 {{ validateResult.totalFeatures }} 个地理要素：
          <span v-if="validateResult.pointCount > 0" class="text-primary">{{ validateResult.pointCount }} 个点</span>
          <span v-if="validateResult.lineCount > 0" class="text-blue-600">，{{ validateResult.lineCount }} 条线</span>
          <span v-if="validateResult.polygonCount > 0" class="text-green-600">，{{ validateResult.polygonCount }} 个面</span>
        </div>
      </div>

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
import { readAndValidateGisFile, type GisValidationResult, type GisFeature } from './GisFileReader'
import ErrorDialog from '@/components/common/ErrorDialog.vue'

const toolConfig = getToolById('gis2excel')
import { exportToExcel, exportSeparateFiles } from './GisToExcelExporter'

const fileInputRef = ref<HTMLInputElement | null>(null)
const validateResult = ref<GisValidationResult | null>(null)
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

  const file = target.files[0]
  validateResult.value = null
  convertedData.value = null
  errorMessage.value = ''

  try {
    const result = await readAndValidateGisFile(file!)
    if (result.isValid) {
      validateResult.value = result
    } else {
      errorMessage.value = result.errors.join('\n')
      showError.value = true
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : String(err)
    showError.value = true
  }
}

async function handleConvert() {
  if (!validateResult.value?.features) return

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
    const pointFeatures = validateResult.value.features.filter(f => f.type === 'Point')
    const lineFeatures = validateResult.value.features.filter(f => f.type === 'LineString')
    const polygonFeatures = validateResult.value.features.filter(f => f.type === 'Polygon')

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
  validateResult.value = null
  convertedData.value = null
  errorMessage.value = ''
  progress.value = 0
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}
</script>
