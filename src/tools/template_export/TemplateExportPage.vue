<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || (format === 'docx' ? 'DOCX模板' : 'XLSX模板') }}</h1>
    <p class="text-base-content/70 mb-6">
      {{ toolConfig?.description || (format === 'docx' ? '使用docxtemplater将CSV/Excel数据填充到Word模板' : '使用xlsx-template将CSV/Excel数据填充到Excel模板') }}
    </p>

    <div class="bg-base-100 rounded-lg shadow-lg p-6 mb-6 space-y-6">
      <div>
        <h2 class="text-xl font-semibold mb-4">1. 下载模板</h2>
        <div class="dropdown">
          <label tabindex="0" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            下载模板
          </label>
          <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box shadow-lg p-2 w-52 z-10">
            <li>
              <a @click="downloadTemplate('csv')" class="text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV 格式
              </a>
            </li>
            <li>
              <a @click="downloadTemplate('xlsx')" class="text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel 格式
              </a>
            </li>
          </ul>
        </div>
        <p class="text-sm text-base-content/60 mt-2">
          下载包含示例字段名的数据模板，在模板中填入你的数据。
        </p>
      </div>

      <div>
        <h2 class="text-xl font-semibold mb-4">2. 上传数据文件</h2>
        <input
          ref="dataFileInputRef"
          type="file"
          @change="onDataFileUpload"
          class="file-input file-input-bordered w-full max-w-md"
          accept=".csv,.xlsx,.xls"
          :disabled="isRendering"
        />
        <p class="text-sm text-base-content/60 mt-2">支持 CSV 和 Excel 格式</p>
        <div v-if="dataFileName" class="mt-2 flex items-center gap-2 text-success">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-sm">{{ dataFileName }}</span>
          <span class="text-sm text-base-content/60">({{ dataRowCount }} 行数据)</span>
        </div>
      </div>

      <div>
        <h2 class="text-xl font-semibold mb-4">3. 设置忽略行数</h2>
        <div class="flex items-center gap-3">
          <label class="text-sm">忽略前</label>
          <input
            type="number"
            v-model.number="skipRowsLocal"
            @change="handleSkipRowsChange"
            class="input input-bordered w-20"
            :min="1"
            :disabled="isRendering"
          />
          <label class="text-sm">行（默认1行，最少1行）</label>
        </div>
        <p class="text-sm text-base-content/60 mt-2">用于忽略CSV/Excel中的标题行或其他不需要的数据行</p>
      </div>

      <div>
        <h2 class="text-xl font-semibold mb-4">4. 上传 {{ format === 'docx' ? 'DOCX' : 'XLSX' }} 模板</h2>
        <input
          ref="templateFileInputRef"
          type="file"
          @change="onTemplateFileUpload"
          class="file-input file-input-bordered w-full max-w-md"
          :accept="format === 'docx' ? '.docx' : '.xlsx'"
          :disabled="isRendering"
        />
        <p class="text-sm text-base-content/60 mt-2">上传包含 {{ format === 'docx' ? '{field_name}' : '${field_name}' }} 占位符的 {{ format === 'docx' ? 'Word' : 'Excel' }} 模板</p>
        <div v-if="templateFileName" class="mt-2 flex items-center gap-2 text-success">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-sm">{{ templateFileName }}</span>
        </div>
        <div v-if="detectedFields.length > 0" class="mt-2">
          <span class="text-sm text-base-content/70">检测到的字段：</span>
          <div class="flex flex-wrap gap-1 mt-1">
            <button
              v-for="field in detectedFields"
              :key="field"
              @click="insertField(field)"
              class="btn btn-xs btn-outline hover:btn-primary transition-colors"
            >
              {{ '{' + field + '}' }}
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 class="text-xl font-semibold mb-4">5. 设置输出文件名</h2>
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <label class="text-sm font-medium w-20">文件名模板</label>
            <input
              v-model="filenameTemplate"
              type="text"
              class="input input-bordered flex-1 max-w-lg"
              placeholder="{name}-{日期}"
              :disabled="isRendering || detectedFields.length === 0"
            />
          </div>
          <p class="text-sm text-base-content/60 ml-[5.5rem]">
            支持 <code class="bg-base-200 px-1 rounded">{字段名}</code> 占位符，如
            <code class="bg-base-200 px-1 rounded">{name}-{日期}</code>
          </p>

          <div class="flex items-center gap-3">
            <label class="text-sm font-medium w-20">重名处理</label>
            <select v-model="duplicateStrategy" class="select select-bordered max-w-xs" :disabled="isRendering">
              <option value="appendIndex">追加序号 (1)(2)...</option>
              <option value="rowPrefix">行号前缀 001-...</option>
            </select>
          </div>

          <div v-if="previewFilenames.length > 0" class="ml-[5.5rem]">
            <p class="text-sm text-base-content/60 mb-1">预览（前 3 行）：</p>
            <div class="flex flex-wrap gap-2">
              <span v-for="(name, idx) in previewFilenames" :key="idx" class="badge badge-outline text-xs py-3">
                {{ name }}.{{ format }}
              </span>
            </div>
          </div>

          <div v-if="duplicateWarnings.length > 0" class="ml-[5.5rem]">
            <div class="alert alert-warning py-2 text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>
                检测到 {{ duplicateWarnings.length }} 组重名（如 "{{
                  duplicateWarnings[0]!.name
                }}" 重复 {{ duplicateWarnings[0]!.count }} 次），已按重名策略自动区分
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-3 pt-4 border-t border-base-200">
        <button
          :disabled="!canRender"
          @click="handleRender"
          class="btn btn-success"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {{ isRendering ? '渲染中...' : '渲染' }}
        </button>

        <button
          :disabled="!canDownload"
          @click="handleDownload"
          class="btn btn-primary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          下载结果
        </button>

        <button @click="handleClear" class="btn btn-outline btn-warning">清空</button>
      </div>
    </div>

    <div v-if="isRendering" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-base-100 rounded-lg p-8 max-w-md w-full mx-4">
        <h3 class="font-bold text-lg mb-4">正在渲染...</h3>
        <div class="w-full bg-base-200 rounded-full h-2.5 mb-2">
          <div
            class="bg-success h-2.5 rounded-full transition-all duration-300"
            :style="{ width: `${progress}%` }"
          ></div>
        </div>
        <p class="text-sm text-base-content/70 text-center">{{ progressText }}</p>
      </div>
    </div>

    <div v-if="showError" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-base-100 rounded-lg p-8 max-w-md w-full mx-4">
        <h3 class="font-bold text-lg text-error mb-4">渲染失败</h3>
        <p class="text-sm text-base-content/70 mb-4 whitespace-pre-wrap">{{ errorMessage }}</p>
        <button @click="showError = false" class="btn btn-sm w-full">关闭</button>
      </div>
    </div>

    <div v-if="showSuccess" class="fixed bottom-4 right-4 bg-success text-success-content rounded-lg p-4 shadow-lg z-50">
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span>文档渲染成功！</span>
      </div>
    </div>

    <div v-if="showFilenameError" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-base-100 rounded-lg p-8 max-w-md w-full mx-4">
        <h3 class="font-bold text-lg text-warning mb-4">文件名模板语法错误</h3>
        <p class="text-sm text-base-content/70 mb-2">{{ filenameErrorMessage }}</p>
        <p class="text-sm text-base-content/60 mb-4">是否使用默认名称（数据第一列）继续渲染？</p>
        <div class="flex gap-3">
          <button @click="applyDefaultFilenameTemplate" class="btn btn-primary flex-1">使用默认名称</button>
          <button @click="dismissFilenameError" class="btn btn-outline flex-1">取消，我自己修改</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { getToolById } from '../toolData'
import { useTemplateExport, type ExportFormat } from './useTemplateExport'

const props = defineProps<{
  format: ExportFormat
}>()

const format = props.format
const toolConfig = getToolById(format === 'docx' ? 'docx_template_export' : 'xlsx_template_export')

const {
  dataFileInputRef,
  templateFileInputRef,
  dataFileName,
  templateFileName,
  dataRowCount,
  detectedFields,
  skipRows,
  filenameTemplate,
  duplicateStrategy,
  previewFilenames,
  duplicateWarnings,
  showFilenameError,
  filenameErrorMessage,
  isRendering,
  progress,
  progressText,
  showError,
  errorMessage,
  showSuccess,
  canRender,
  canDownload,
  downloadTemplate,
  onDataFileUpload,
  onTemplateFileUpload,
  handleRender,
  handleDownload,
  handleClear,
  setSkipRows,
  applyDefaultFilenameTemplate,
  dismissFilenameError,
} = useTemplateExport(format)

const skipRowsLocal = ref(1)

watch(skipRows, (newVal) => {
  skipRowsLocal.value = newVal
})

function handleSkipRowsChange() {
  setSkipRows(skipRowsLocal.value)
}

function insertField(field: string) {
  filenameTemplate.value += `{${field}}`
}
</script>

<style scoped>
pre code {
  display: block;
  padding: 0.5rem;
  background: transparent;
}
</style>