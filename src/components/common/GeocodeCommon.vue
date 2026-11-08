<template>
  <div class="bg-base-100/70 backdrop-blur-sm rounded-lg shadow-lg p-4">
    <ErrorDialog
      :is-open="errorDialogOpen"
      :type="errorDialogType"
      :title="errorDialogTitle"
      :message="errorDialogMessage"
      @close="closeErrorDialog"
    />
    <h1 class="text-3xl font-bold mb-1">
      {{ toolConfig?.name || (mode === 'add' ? '地址解析' : '经纬度查询') }}
    </h1>
    <p class="text-base-content/70">
      {{ toolConfig?.description || (mode === 'add' ? '经纬度转地址工具' : '地址转经纬度工具') }}
    </p>

    <div class="mt-4 space-y-6">
      <GeocodeTemplatePanel :mode="mode" @download="downloadTemplate" />

      <GeocodeApiKeyPanel :mode="mode" @validate="validateApiKey" />

      <GeocodeQueryOptionsPanel :mode="mode" />

      <GeocodeFieldPicker :mode="mode" />

      <GeocodeUploadPanel
        ref="uploadPanelRef"
        :is-querying="isQuerying"
        :can-execute-query="canExecuteQuery"
        :can-download-result="canDownloadResult"
        :has-data="hasData"
        :has-validation="validationResult !== null"
        :progress-percent="progressPercent"
        :progress-message="progressMessage"
        @upload="onFileUpload"
        @execute="executeQuery"
        @download="downloadResult"
        @clear-upload="handleClearUpload"
        @clear-all="handleClearAll"
      />

      <GeocodeResultsTable
        :mode="mode"
        :validation-result="validationResult"
        :add-results="addResults"
        :lonlat-results="lonlatResults"
        :selected-fields="currentConfig.selectedFields"
        :enable-bounds="currentConfig.enableBounds"
      />
    </div>

    <ErrorDialog
      :is-open="errorModalOpen"
      type="error"
      title="API Key 验证失败"
      :message="
        errorModalData.errorMessage || '您输入的高德地图 API Key 无效或已过期，请检查后重新输入。'
      "
      :details="errorModalData.url ? { url: errorModalData.url } : undefined"
      @close="closeErrorModal"
    />

    <!-- 导入/导出进度弹窗（模板下载、文件解析、结果导出） -->
    <!-- 取消按钮只在「导入」期间出现：模板下载/结果导出没有可 abort 的控制器，
         挂一个点了没反应的按钮比没有更糟（审计 D-5 同类问题） -->
    <ProgressModal
      :is-open="pipelineProgress.open"
      :title="pipelineProgress.title"
      :percent="pipelineProgress.percent"
      :message="pipelineProgress.message"
      :remaining-time="pipelineTimer.remainingText.value"
      :show-cancel="canCancelImport"
      @cancel="handleCancelImport"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getToolById } from '@/tools/toolData'
import ErrorDialog from '@/components/common/ErrorDialog.vue'
import ProgressModal from '@/components/common/ProgressModal.vue'
import GeocodeTemplatePanel from './geocode/GeocodeTemplatePanel.vue'
import GeocodeApiKeyPanel from './geocode/GeocodeApiKeyPanel.vue'
import GeocodeQueryOptionsPanel from './geocode/GeocodeQueryOptionsPanel.vue'
import GeocodeFieldPicker from './geocode/GeocodeFieldPicker.vue'
import GeocodeUploadPanel from './geocode/GeocodeUploadPanel.vue'
import GeocodeResultsTable from './geocode/GeocodeResultsTable.vue'
import { useGeocodeWorkflow } from './geocode/useGeocodeWorkflow'
import type { GeocodeMode } from './geocode/geocodeTypes'

const props = defineProps<{
  mode: GeocodeMode
}>()

const mode = props.mode
const toolConfig = getToolById(mode === 'add' ? 'get_add' : 'get_lonlat')

const uploadPanelRef = ref<{ clearFileInput: () => void } | null>(null)

const {
  currentConfig,
  errorModalOpen,
  errorModalData,
  closeErrorModal,
  errorDialogOpen,
  errorDialogType,
  errorDialogTitle,
  errorDialogMessage,
  closeErrorDialog,
  validationResult,
  addResults,
  lonlatResults,
  isQuerying,
  progressPercent,
  progressMessage,
  pipelineProgress,
  pipelineTimer,
  canCancelImport,
  hasData,
  canExecuteQuery,
  canDownloadResult,
  downloadTemplate,
  validateApiKey,
  onFileUpload,
  executeQuery,
  downloadResult,
  clearUploadFile,
  cancelImport,
  clearAll,
} = useGeocodeWorkflow(mode)

function handleClearUpload() {
  clearUploadFile()
  uploadPanelRef.value?.clearFileInput()
}

function handleClearAll() {
  clearAll()
  uploadPanelRef.value?.clearFileInput()
}

function handleCancelImport() {
  cancelImport()
  uploadPanelRef.value?.clearFileInput()
}
</script>

<style scoped>
.input:disabled {
  cursor: not-allowed;
}
</style>
