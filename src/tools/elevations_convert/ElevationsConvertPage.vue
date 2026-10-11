<template>
  <div class="bg-base-100/70 backdrop-blur-sm rounded-lg shadow-lg p-4">
    <h1 class="text-3xl font-bold mb-1">{{ toolConfig?.name || '批量高程查询' }}</h1>
    <p class="text-base-content/70">
      {{ toolConfig?.description || '批量输入经纬度查询海拔高度，支持 Excel 导入导出。' }}
    </p>

    <div class="bg-base-200/40 rounded-lg p-6">
      <h2 class="text-xl font-semibold mb-4">批量高程查询</h2>

      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2"
          >输入格式：每行一个坐标，格式为 经度,纬度</label
        >
        <textarea
          v-model="inputText"
          rows="8"
          placeholder="116.4074,39.9042&#10;120.1535,30.2874&#10;104.0668,30.5728"
          class="w-full textarea textarea-bordered"
        ></textarea>
      </div>

      <div class="flex flex-wrap gap-4">
        <button
          @click="queryElevations"
          :disabled="isLoading || !hasValidPoints"
          class="btn btn-primary"
        >
          <span v-if="isLoading" class="loading loading-spinner"></span>
          {{ isLoading ? '查询中...' : '批量查询高程' }}
        </button>

        <button @click="clearAll" class="btn btn-ghost">清空</button>
      </div>
    </div>

    <div v-if="results.length > 0" class="bg-base-200/40 rounded-lg p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">查询结果</h2>
        <button @click="exportResults" class="btn btn-secondary btn-sm">导出 Excel</button>
      </div>

      <div class="overflow-x-auto">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th>序号</th>
              <th>经度</th>
              <th>纬度</th>
              <th>海拔高度 (米)</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(result, index) in results" :key="index">
              <td>{{ index + 1 }}</td>
              <td>{{ result.longitude.toFixed(6) }}</td>
              <td>{{ result.latitude.toFixed(6) }}</td>
              <td :class="result.error ? 'text-gray-400' : 'text-primary font-semibold'">
                {{
                  result.error || !Number.isFinite(result.elevation)
                    ? '查询失败'
                    : result.elevation.toFixed(2)
                }}
              </td>
              <td>
                <span v-if="result.error" class="text-red-500 text-sm">失败</span>
                <span v-else class="text-green-500 text-sm">成功</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex justify-between text-sm text-gray-600">
        <span>共 {{ results.length }} 条记录</span>
        <span>成功 {{ successCount }} 条，失败 {{ failCount }} 条</span>
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
import { elevationService } from '../elevation_query/elevationService'
import { exportData } from '@/utils/TemplateExporter'
import { parseStrictNumber } from '@/utils/coordinateValue'
import ErrorDialog from '@/components/common/ErrorDialog.vue'

const toolConfig = getToolById('elevations_convert')

const inputText = ref<string>('')
const isLoading = ref(false)
/** 单条高程查询结果（含失败行） */
interface ElevationRow {
  longitude: number
  latitude: number
  elevation: number
  /** 有值表示该行查询失败 */
  error?: string
}

const results = ref<ElevationRow[]>([])
const error = ref<string>('')
const errorDialogOpen = ref(false)

interface ParsedPoint {
  longitude: number
  latitude: number
  valid: boolean
  error?: string
}

const parsePoints = (): ParsedPoint[] => {
  const lines = inputText.value.trim().split('\n')
  return lines.map((line) => {
    const parts = line.trim().split(',')
    if (parts.length !== 2) {
      return { longitude: 0, latitude: 0, valid: false, error: '格式错误' }
    }
    const lng = parseStrictNumber(parts[0]!)
    const lat = parseStrictNumber(parts[1]!)
    if (lng === null || lat === null) {
      return { longitude: 0, latitude: 0, valid: false, error: '数值无效' }
    }
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return { longitude: 0, latitude: 0, valid: false, error: '范围超出' }
    }
    return { longitude: lng, latitude: lat, valid: true }
  })
}

const hasValidPoints = computed(() => {
  return parsePoints().some((p) => p.valid)
})

const successCount = computed(() => {
  return results.value.filter((r) => !r.error).length
})

const failCount = computed(() => {
  return results.value.filter((r) => r.error).length
})

/**
 * 防呆上限。elevationService 已内部分批（每批 100 点），这里只需防止
 * 用户误粘贴超大文件把浏览器卡死，不再因为"API 一次只能 100 个"而劝退。
 */
const MAX_POINTS = 5000

const closeErrorDialog = () => {
  errorDialogOpen.value = false
  error.value = ''
}

const queryElevations = async () => {
  const points = parsePoints()
  const validPoints = points.filter((p) => p.valid)

  if (validPoints.length === 0) {
    error.value = '请输入有效的经纬度坐标'
    errorDialogOpen.value = true
    return
  }

  if (validPoints.length > MAX_POINTS) {
    error.value = `单次查询最多支持 ${MAX_POINTS} 个坐标点，当前输入 ${validPoints.length} 个，请分批查询`
    errorDialogOpen.value = true
    return
  }

  isLoading.value = true
  error.value = ''
  results.value = []

  try {
    const validResults = await elevationService.getElevations(validPoints)

    let validIndex = 0
    results.value = points.map((point) => {
      if (!point.valid) {
        return {
          longitude: point.longitude,
          latitude: point.latitude,
          elevation: Number.NaN,
          error: point.error,
        }
      }
      // getElevations 逐点返回且带 error，不再抛错；仍用可选链兜底，
      // 防止 validPoints 与实际返回条数不一致时 push undefined
      const result = validResults[validIndex++]
      return (
        result ?? {
          longitude: point.longitude,
          latitude: point.latitude,
          elevation: Number.NaN,
          error: '接口未返回该点高程',
        }
      )
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : '查询失败，请稍后重试'
    errorDialogOpen.value = true
  } finally {
    isLoading.value = false
  }
}

const clearAll = () => {
  inputText.value = ''
  results.value = []
  error.value = ''
}

const exportResults = () => {
  const headers = ['序号', '经度', '纬度', '海拔高度', '状态']
  const dataRows = results.value.map((result, index) => [
    (index + 1).toString(),
    result.longitude.toFixed(6),
    result.latitude.toFixed(6),
    result.error || !Number.isFinite(result.elevation)
      ? '查询失败'
      : `${result.elevation.toFixed(2)} 米`,
    result.error ? '失败' : '成功',
  ])

  exportData(headers, dataRows, 'xlsx', '批量高程查询结果')
}
</script>
