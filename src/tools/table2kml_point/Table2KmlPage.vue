<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || '点转KML' }}</h1>
    <p class="text-base-content/70 mb-6">{{ toolConfig?.description || '表格数据转KML点文件' }}</p>

    <div class="bg-base-100/70 backdrop-blur-sm rounded-lg shadow-lg p-6 mb-6 space-y-6">
      <!-- 模板下载 -->
      <div>
        <h2 class="text-xl font-semibold mb-4">1. 下载模板</h2>
        <p class="text-base-content/70 mb-3 text-sm">
          模板包含 5 列：名称、经度、纬度、文件夹、颜色。颜色支持中文名（如"红色"）或 Hex 格式（如
          #FF0000）。
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

      <!-- 文件上传 -->
      <div>
        <h2 class="text-xl font-semibold mb-4">2. 上传数据文件</h2>
        <input
          type="file"
          @change="onFileUpload"
          class="file-input file-input-bordered w-full max-w-md"
          accept=".csv,.xlsx"
          ref="fileInputRef"
        />
      </div>

      <!-- 验证结果预览 -->
      <div v-if="validateResult && validateResult.isValid" class="space-y-2">
        <div class="flex items-center gap-2 text-success font-semibold">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
          验证通过，共 {{ validateResult.points.length }} 个有效点位
        </div>

        <!-- 按文件夹统计 -->
        <div class="overflow-x-auto">
          <table class="table table-zebra table-sm">
            <thead>
              <tr>
                <th>文件夹</th>
                <th>点位数量</th>
                <th>颜色</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in folderGroups" :key="g.name">
                <td>{{ g.name }}</td>
                <td>{{ g.count }}</td>
                <td>
                  <span
                    v-for="c in g.colors"
                    :key="c"
                    class="inline-block w-4 h-4 rounded-full border border-base-300 mr-1 align-middle"
                    :style="{ backgroundColor: c }"
                    :title="c"
                  ></span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 下载 KML 按钮 -->
      <div class="flex flex-wrap gap-3">
        <button :disabled="!canDownload" @click="handleDownloadKml" class="btn btn-success">
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
          下载 KML 文件
        </button>
        <button @click="handleClear" class="btn btn-outline btn-warning">清空</button>
      </div>

      <ErrorDialog
        :is-open="showErrorDialog"
        type="error"
        title="文件验证失败"
        :message="validationErrors.join('\n')"
        @close="showErrorDialog = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { downloadCsvTemplate, downloadXlsxTemplate } from '@/utils/TemplateExporter'
import { getToolById } from '../toolData'
import ErrorDialog from '@/components/common/ErrorDialog.vue'

const toolConfig = getToolById('table2kml_point')
import { readAndValidateKmlTemplate, type TableKmlReadResult } from './TemplateValidator'
import { downloadKml } from './KmlGenerator'

const fileInputRef = ref<HTMLInputElement | null>(null)
const showErrorDialog = ref(false)
const validateResult = ref<TableKmlReadResult | null>(null)
const validationErrors = ref<string[]>([])

const canDownload = computed(() => {
  return validateResult.value?.isValid === true && validateResult.value.points.length > 0
})

interface FolderSummary {
  name: string
  count: number
  colors: string[]
}

const folderGroups = computed<FolderSummary[]>(() => {
  if (!validateResult.value) return []
  const map = new Map<string, { count: number; colors: Set<string> }>()
  for (const p of validateResult.value.points) {
    const key = p.folder || '默认文件夹'
    if (!map.has(key)) map.set(key, { count: 0, colors: new Set() })
    const entry = map.get(key)!
    entry.count++
    entry.colors.add(p.color)
  }
  return [...map.entries()].map(([name, v]) => ({
    name,
    count: v.count,
    colors: [...v.colors],
  }))
})

async function onFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return

  const file = target.files[0]!
  validationErrors.value = []
  validateResult.value = null

  try {
    const result = await readAndValidateKmlTemplate(file)
    if (result.isValid) {
      validateResult.value = result
    } else {
      validationErrors.value = result.errors
      showErrorDialog.value = true
    }
  } catch (err) {
    validationErrors.value = [
      `处理文件时发生错误：${err instanceof Error ? err.message : String(err)}`,
    ]
    showErrorDialog.value = true
  }
}

function handleDownloadKml() {
  if (!validateResult.value?.points.length) return
  downloadKml(validateResult.value.points)
}

function handleClear() {
  validateResult.value = null
  validationErrors.value = []
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}
</script>
