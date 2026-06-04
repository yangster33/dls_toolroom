<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || '基站转KML' }}</h1>
    <p class="text-base-content/70 mb-6">{{ toolConfig?.description || '基站数据转KML文件' }}</p>

    <div class="bg-base-100 rounded-lg shadow-lg p-6 mb-6 space-y-6">
      <!-- 操作区域 -->
      <div>
        <h2 class="text-xl font-semibold mb-4">1. 下载模板</h2>
        <div class="dropdown">
          <label tabindex="0" class="btn btn-outline btn-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            下载模板
          </label>
          <ul
            tabindex="0"
            class="dropdown-content menu bg-base-100 rounded-box shadow-lg p-2 w-52 z-10"
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

      <!-- 上传区域 -->
      <div>
        <h2 class="text-xl font-semibold mb-4">2. 上传文件</h2>
        <div
          class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center"
          @click="triggerFileInput"
          @dragover.prevent
          @drop.prevent="handleFileDrop"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-16 h-16 mx-auto text-gray-400 mb-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <p class="text-gray-600">点击或拖拽文件到此处上传</p>
          <p class="text-sm text-gray-400 mt-2">支持 CSV 和 XLSX 格式</p>
          <input
            ref="fileInput"
            type="file"
            accept=".csv,.xlsx"
            class="hidden"
            @change="handleFileSelect"
          />
        </div>
      </div>

      <!-- 上传的文件信息 -->
      <div v-if="uploadedFile" class="p-4 bg-blue-50 rounded-lg">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-6 h-6 text-blue-500 mr-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span class="font-medium">{{ uploadedFile.name }}</span>
          </div>
          <button @click="clearUpload" class="btn btn-sm btn-error">清除</button>
        </div>
      </div>

      <!-- 验证结果 -->
      <div v-if="validateResult">
        <div v-if="validateResult.isValid" class="p-4 bg-green-50 rounded-lg">
          <div class="flex items-center text-green-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>验证通过！共读取 {{ validateResult.dataRows.length }} 条扇区数据</span>
          </div>
        </div>
        <div v-else class="p-4 bg-red-50 rounded-lg">
          <div class="flex items-center text-red-700 mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <span>验证失败，存在以下错误：</span>
          </div>
          <ul class="list-disc list-inside text-red-600 text-sm">
            <li v-for="(error, index) in validateResult.errors" :key="index">{{ error }}</li>
          </ul>
        </div>
      </div>

      <!-- 数据预览 -->
      <div v-if="validateResult && validateResult.isValid && validateResult.dataRows.length > 0">
        <h3 class="text-lg font-semibold mb-3">数据预览</h3>
        <div class="overflow-x-auto">
          <table class="table table-compact w-full">
            <thead>
              <tr>
                <th>扇区名称</th>
                <th>经度</th>
                <th>纬度</th>
                <th>方位角</th>
                <th>半功率角</th>
                <th>半径</th>
                <th>是否室分</th>
                <th>颜色</th>
                <th>文件夹</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in validateResult.dataRows.slice(0, 10)" :key="index">
                <td>{{ row['扇区名称'] }}</td>
                <td>{{ row['经度'] }}</td>
                <td>{{ row['纬度'] }}</td>
                <td>{{ row['方位角'] }}</td>
                <td>{{ row['半功率角'] }}</td>
                <td>{{ row['半径'] }}</td>
                <td>{{ row['是否室分'] || '-' }}</td>
                <td>{{ row['颜色'] || '默认' }}</td>
                <td>{{ row['文件夹'] || '根目录' }}</td>
              </tr>
              <tr v-if="validateResult.dataRows.length > 10">
                <td colspan="9" class="text-center text-gray-400">
                  ... 还有 {{ validateResult.dataRows.length - 10 }} 条数据
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 生成按钮 -->
      <div>
        <h2 class="text-xl font-semibold mb-4">3. 生成KML</h2>
        <button
          @click="generateKmlFile"
          :disabled="
            !validateResult || !validateResult.isValid || validateResult.dataRows.length === 0
          "
          class="btn btn-success"
          :class="{
            'opacity-50 cursor-not-allowed':
              !validateResult || !validateResult.isValid || validateResult.dataRows.length === 0,
          }"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4 mr-2"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          生成KML文件
        </button>
      </div>
    </div>

    <ErrorDialog
      :is-open="showErrorDialog"
      type="error"
      title="验证错误"
      :message="validationErrors.join('\n')"
      @close="showErrorDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { exportTemplate } from '@/utils/TemplateExporter'
import { getToolById } from '../toolData'
import ErrorDialog from '@/components/common/ErrorDialog.vue'

const toolConfig = getToolById('table2kml_basestation')
import { readAndValidateBasestationTemplate, type BasestationReadResult } from './TemplateReader'
import { generateKml, downloadKml, type KmlSector } from '@/utils/KmlGenerator'
import { TEMPLATE_HEADERS } from './TemplateExporter'

const fileInput = ref<HTMLInputElement | null>(null)
const showErrorDialog = ref(false)
const uploadedFile = ref<File | null>(null)
const validateResult = ref<BasestationReadResult | null>(null)
const validationErrors = ref<string[]>([])

// 触发文件选择
const triggerFileInput = () => {
  fileInput.value?.click()
}

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    processFile(file)
  }
}

// 处理文件拖放
const handleFileDrop = (event: DragEvent) => {
  const file = event.dataTransfer?.files[0]
  if (file) {
    processFile(file)
  }
}

// 处理文件
const processFile = async (file: File) => {
  uploadedFile.value = file
  validateResult.value = null
  validationErrors.value = []

  try {
    const result = await readAndValidateBasestationTemplate(file)
    validateResult.value = result

    if (!result.isValid) {
      validationErrors.value = result.errors
      showErrorDialog.value = true
    }
  } catch (error) {
    validationErrors.value = [error instanceof Error ? error.message : '文件读取失败']
    showErrorDialog.value = true
  }
}

// 清除上传
const clearUpload = () => {
  uploadedFile.value = null
  validateResult.value = null
  validationErrors.value = []
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// 下载CSV模板
const downloadCsvTemplate = () => {
  exportTemplate(TEMPLATE_HEADERS, 'csv', 'basestation_template')
}

// 下载XLSX模板
const downloadXlsxTemplate = () => {
  exportTemplate(TEMPLATE_HEADERS, 'xlsx', 'basestation_template')
}

// 生成KML文件
const generateKmlFile = () => {
  if (!validateResult.value || !validateResult.value.isValid) {
    return
  }

  const sectors: KmlSector[] = validateResult.value.dataRows.map((row) => ({
    name: row['扇区名称'],
    longitude: row['经度'],
    latitude: row['纬度'],
    azimuth: row['方位角'],
    halfPowerAngle: row['半功率角'],
    radius: row['半径'],
    folder: row['文件夹'],
    color: row['颜色'],
    opacity: row['半透明度'] !== undefined ? row['半透明度'] : 0.5,
    description: `${row['区域'] || ''}|${row['网管基站名'] || ''}|${row['物理站名'] || ''}|${row['小区覆盖类型'] || ''}|${row['厂家'] || ''}|${row['天线挂高'] || ''}|${row['带宽'] || ''}|${row['收发模式'] || ''}`,
    physicalStationName: row['物理站名'],
    isIndoor: row['是否室分'],
  }))

  const kmlContent = generateKml(sectors, { name: '基站扇区图' })
  downloadKml(kmlContent, 'basestation.kml')
}
</script>
