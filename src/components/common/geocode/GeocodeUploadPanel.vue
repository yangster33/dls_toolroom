<template>
  <div>
    <h2 class="text-xl font-semibold mb-4">5. 上传文件并查询</h2>
    <input
      type="file"
      @change="$emit('upload', $event)"
      class="file-input file-input-bordered w-full max-w-md"
      accept=".csv,.xlsx"
      :disabled="isQuerying"
      ref="fileInputRef"
    />

    <div class="flex flex-wrap gap-3 mt-4">
      <button @click="$emit('execute')" class="btn btn-primary" :disabled="!canExecuteQuery">
        <span v-if="isQuerying" class="loading loading-spinner loading-sm mr-2"></span>
        {{ isQuerying ? '查询中...' : '执行查询' }}
      </button>

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
            <a @click="$emit('download', 'csv')" class="text-sm">CSV 格式</a>
          </li>
          <li>
            <a @click="$emit('download', 'xlsx')" class="text-sm">Excel 格式</a>
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

      <button @click="$emit('clearUpload')" class="btn btn-outline" :disabled="!hasValidation">
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
        清除上传文件
      </button>

      <button @click="$emit('clearAll')" class="btn btn-outline btn-error" :disabled="!hasData">
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

    <div v-if="isQuerying" class="mt-4 space-y-2">
      <div class="flex justify-between text-sm">
        <span>{{ progressMessage }}</span>
        <span>{{ progressPercent }}%</span>
      </div>
      <progress
        class="progress progress-primary w-full max-w-md"
        :value="progressPercent"
        max="100"
      ></progress>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  isQuerying: boolean
  canExecuteQuery: boolean
  canDownloadResult: boolean
  hasData: boolean
  hasValidation: boolean
  progressPercent: number
  progressMessage: string
}>()

defineEmits<{
  upload: [event: Event]
  execute: []
  download: [format: 'csv' | 'xlsx']
  clearUpload: []
  clearAll: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

/** 清除上传文件时同步清空原生 input，避免界面仍显示文件名 */
function clearFileInput() {
  if (fileInputRef.value) fileInputRef.value.value = ''
}

defineExpose({ clearFileInput })
</script>
