<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-6">{{ toolConfig?.name || '高程查询' }}</h1>
    <p class="text-base-content/60 mb-6">
      {{ toolConfig?.description || '输入经纬度查询海拔高度，数据来源于 Open-Meteo Elevation API。' }}
    </p>

    <div class="bg-base-100 rounded-lg shadow-lg p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">高程查询</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label class="block text-sm font-medium text-base-content/80 mb-1">经度 (Longitude)</label>
          <input
            v-model="longitude"
            type="number"
            step="any"
            placeholder="例如: 116.4074"
            class="w-full input input-bordered"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-base-content/80 mb-1">纬度 (Latitude)</label>
          <input
            v-model="latitude"
            type="number"
            step="any"
            placeholder="例如: 39.9042"
            class="w-full input input-bordered"
          />
        </div>
      </div>

      <button
        @click="queryElevation"
        :disabled="isLoading || !isValid"
        class="btn btn-primary w-full md:w-auto"
      >
        <span v-if="isLoading" class="loading loading-spinner"></span>
        {{ isLoading ? '查询中...' : '查询高程' }}
      </button>
    </div>

    <div v-if="result" class="bg-base-100 rounded-lg shadow-lg p-6">
      <h2 class="text-xl font-semibold mb-4">查询结果</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="stat">
          <div class="stat-title">经度</div>
          <div class="stat-value">{{ result.longitude }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">纬度</div>
          <div class="stat-value">{{ result.latitude }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">海拔高度</div>
          <div class="stat-value text-primary">{{ result.elevation }} <span class="text-sm text-base-content/50">米</span></div>
        </div>
      </div>
    </div>

    <ErrorDialog
      :is-open="errorDialogOpen"
      type="error"
      title="查询失败"
      :message="error"
      @close="closeErrorDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { getToolById } from '../toolData'
import { elevationService } from './elevationService'
import ErrorDialog from '@/components/common/ErrorDialog.vue'

const toolConfig = getToolById('elevation_query')

const latitude = ref<string>('')
const longitude = ref<string>('')
const isLoading = ref(false)
const result = ref<{ longitude: number; latitude: number; elevation: number } | null>(null)
const error = ref<string>('')
const errorDialogOpen = ref(false)

const isValid = computed(() => {
  const lat = parseFloat(latitude.value)
  const lng = parseFloat(longitude.value)
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
})

const closeErrorDialog = () => {
  errorDialogOpen.value = false
  error.value = ''
}

const queryElevation = async () => {
  if (!isValid.value) {
    error.value = '请输入有效的经纬度（经度范围: -180~180, 纬度范围: -90~90）'
    errorDialogOpen.value = true
    return
  }

  isLoading.value = true
  error.value = ''
  result.value = null

  try {
    const data = await elevationService.getElevation(
      parseFloat(longitude.value),
      parseFloat(latitude.value)
    )
    result.value = data
  } catch (err) {
    error.value = err instanceof Error ? err.message : '查询失败，请稍后重试'
    errorDialogOpen.value = true
  } finally {
    isLoading.value = false
  }
}
</script>
