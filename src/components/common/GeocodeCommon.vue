<template>
  <div class="p-6">
    <ErrorDialog
      :is-open="errorDialogOpen"
      :type="errorDialogType"
      :title="errorDialogTitle"
      :message="errorDialogMessage"
      @close="closeErrorDialog"
    />
    <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || (mode === 'add' ? '地址解析' : '经纬度查询') }}</h1>
    <p class="text-base-content/70 mb-6">
      {{ toolConfig?.description || (mode === 'add' ? '经纬度转地址工具' : '地址转经纬度工具') }}
    </p>

    <div class="bg-base-100/70 backdrop-blur-sm rounded-lg shadow-lg p-6 mb-6 space-y-6">
      <div>
        <h2 class="text-xl font-semibold mb-4">1. 下载模板</h2>
        <p class="text-base-content/70 mb-3 text-sm">
          {{ mode === 'add' ? '模板包含三列：名称、经度、纬度' : '模板包含：省、市、区/县、乡/镇、社区/村、地址（地址必填，其他可选）' }}
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
              <a @click="downloadTemplate('csv')" class="text-sm">CSV 格式</a>
            </li>
            <li>
              <a @click="downloadTemplate('xlsx')" class="text-sm">Excel 格式</a>
            </li>
          </ul>
        </div>
      </div>

      <div>
        <h2 class="text-xl font-semibold mb-4">2. API Key 配置</h2>

        <div class="space-y-3">
          <div
            v-for="(keyInfo, index) in currentConfig.apiKeys"
            :key="keyInfo.id"
            class="flex items-center gap-3"
          >
            <div class="w-32">
              <div class="select select-bordered w-full cursor-default bg-gray-100">
                <span class="text-gray-700">高德地图</span>
              </div>
            </div>

            <div class="flex-1">
              <div class="relative">
                <input
                  :value="keyInfo.key"
                  @input="updateApiKeyValue(index, ($event.target as HTMLInputElement).value)"
                  type="text"
                  placeholder="输入高德地图API Key"
                  class="input input-bordered w-full pr-24"
                  @blur="validateApiKey(index)"
                  :class="{
                    'border-success': keyInfo.isValid,
                    'border-error': keyInfo.key && !keyInfo.isValid && !keyInfo.validating,
                  }"
                />
                <span
                  v-if="keyInfo.isValid"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-success"
                >
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
                </span>
                <span
                  v-else-if="keyInfo.key && !keyInfo.validating"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-error"
                >
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </span>
                <span
                  v-else-if="keyInfo.validating"
                  class="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <span class="loading loading-spinner loading-sm"></span>
                </span>
              </div>
            </div>

            <button
              v-if="currentConfig.apiKeys.length > 1"
              @click="removeApiKey(index)"
              class="btn btn-error btn-xs"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
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
            </button>
          </div>

          <button @click="addApiKey" class="btn btn-outline btn-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            添加API Key
          </button>
        </div>
      </div>

      <div>
        <h2 class="text-xl font-semibold mb-4">3. 查询参数设置</h2>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="label">
              <span class="label-text font-semibold">请求延迟（毫秒）</span>
            </label>
            <input
              :value="currentConfig.queryOptions.delay"
              @input="updateQueryOption('delay', Number(($event.target as HTMLInputElement).value))"
              type="number"
              min="0"
              placeholder="请求间隔"
              class="input input-bordered w-full"
            />
          </div>

          <div>
            <label class="label">
              <span class="label-text font-semibold">混合查询模式</span>
            </label>
            <button
              @click="toggleQueryOption('mixedMode')"
              class="btn w-full"
              :class="currentConfig.queryOptions.mixedMode ? 'btn-success' : 'btn-outline'"
            >
              {{ currentConfig.queryOptions.mixedMode ? '开启' : '关闭' }}
            </button>
            <label class="label">
              <span class="label-text-alt text-gray-500">多Key轮询</span>
            </label>
          </div>

          <div>
            <label class="label">
              <span class="label-text font-semibold">随机延迟</span>
            </label>
            <button
              @click="toggleQueryOption('randomDelay')"
              class="btn w-full"
              :class="currentConfig.queryOptions.randomDelay ? 'btn-success' : 'btn-outline'"
            >
              {{ currentConfig.queryOptions.randomDelay ? '开启' : '关闭' }}
            </button>
          </div>

          <div v-if="currentConfig.queryOptions.randomDelay">
            <label class="label">
              <span class="label-text font-semibold">随机延迟范围（毫秒）</span>
            </label>
            <div class="flex gap-2">
              <input
                :value="currentConfig.queryOptions.minRandomDelay"
                @input="updateQueryOption('minRandomDelay', Number(($event.target as HTMLInputElement).value))"
                type="number"
                min="0"
                placeholder="最小"
                class="input input-bordered flex-1"
              />
              <span class="self-center">~</span>
              <input
                :value="currentConfig.queryOptions.maxRandomDelay"
                @input="updateQueryOption('maxRandomDelay', Number(($event.target as HTMLInputElement).value))"
                type="number"
                min="0"
                placeholder="最大"
                class="input input-bordered flex-1"
              />
            </div>
          </div>
        </div>

        <div v-if="mode === 'lonlat'" class="mt-4">
          <label class="label flex items-center gap-2 cursor-pointer">
            <input type="checkbox" :checked="currentConfig.enableBounds" @change="toggleEnableBounds" class="checkbox checkbox-primary" />
            <span class="label-text font-semibold">启用区域约束（WGS84）</span>
          </label>

          <div v-if="currentConfig.enableBounds" class="mt-2 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="label">
                  <span class="label-text">西南角（左下角）</span>
                </label>
                <div class="flex gap-2">
                  <input
                    :value="currentConfig.bounds.southwest.lng"
                    @input="updateBoundsSwLng(Number(($event.target as HTMLInputElement).value))"
                    type="number"
                    step="0.000001"
                    placeholder="经度"
                    class="input input-bordered flex-1"
                  />
                  <input
                    :value="currentConfig.bounds.southwest.lat"
                    @input="updateBoundsSwLat(Number(($event.target as HTMLInputElement).value))"
                    type="number"
                    step="0.000001"
                    placeholder="纬度"
                    class="input input-bordered flex-1"
                  />
                </div>
              </div>
              <div>
                <label class="label">
                  <span class="label-text">东北角（右上角）</span>
                </label>
                <div class="flex gap-2">
                  <input
                    :value="currentConfig.bounds.northeast.lng"
                    @input="updateBoundsNeLng(Number(($event.target as HTMLInputElement).value))"
                    type="number"
                    step="0.000001"
                    placeholder="经度"
                    class="input input-bordered flex-1"
                  />
                  <input
                    :value="currentConfig.bounds.northeast.lat"
                    @input="updateBoundsNeLat(Number(($event.target as HTMLInputElement).value))"
                    type="number"
                    step="0.000001"
                    placeholder="纬度"
                    class="input input-bordered flex-1"
                  />
                </div>
              </div>
            </div>

            <div class="flex gap-2">
              <button @click="clearBounds" class="btn btn-outline btn-sm">清除区域</button>
              <button @click="resetBounds" class="btn btn-outline btn-sm">重置为北京区域</button>
            </div>

            <p class="text-xs text-gray-500">
              提示：输入WGS84坐标范围，查询结果将标注是否在此区域内。经度范围：-180~180，纬度范围：-90~90
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 class="text-xl font-semibold mb-4">4. 输出字段选择</h2>
        <div class="flex flex-wrap gap-3">
          <label
            v-for="field in availableFields"
            :key="field.value"
            class="flex items-center gap-2 cursor-pointer"
          >
            <input
              type="checkbox"
              :checked="currentConfig.selectedFields.includes(field.value)"
              @change="toggleSelectedField(field.value)"
              class="checkbox checkbox-primary"
            />
            <span class="text-sm">{{ field.label }}</span>
          </label>
        </div>
      </div>

      <div>
        <h2 class="text-xl font-semibold mb-4">5. 上传文件并查询</h2>
        <input
          type="file"
          @change="onFileUpload"
          class="file-input file-input-bordered w-full max-w-md"
          accept=".csv,.xlsx"
          :disabled="isQuerying"
          ref="fileInputRef"
        />

        <div class="flex flex-wrap gap-3 mt-4">
          <button @click="executeQuery" class="btn btn-primary" :disabled="!canExecuteQuery">
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

          <button @click="clearUploadFile" class="btn btn-outline" :disabled="!validationResult">
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

          <button @click="clearAll" class="btn btn-outline btn-error" :disabled="!hasData">
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

      <div v-if="validationResult" class="space-y-4">
        <div
          v-if="validationResult.isValid"
          class="flex items-center gap-2 text-success font-semibold"
        >
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
          验证通过，共 {{ validationResult.data.length }} 条数据
        </div>
      </div>

      <div v-if="queryResults && queryResults.length > 0" class="space-y-4">
        <h2 class="text-xl font-semibold">查询结果预览</h2>
        <div class="overflow-x-auto">
          <table class="table table-zebra table-sm">
            <thead>
              <tr>
                <template v-if="mode === 'add'">
                  <th>序号</th>
                  <th>名称</th>
                  <th>经度</th>
                  <th>纬度</th>
                </template>
                <template v-else>
                  <th>序号</th>
                  <th>省</th>
                  <th>市</th>
                  <th>区/县</th>
                  <th>乡/镇</th>
                  <th>社区/村</th>
                  <th>地址</th>
                  <th>经度(WGS84)</th>
                  <th>纬度(WGS84)</th>
                </template>
                <th v-for="field in currentConfig.selectedFields" :key="field">{{ getFieldLabel(field) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(result, index) in queryResults.slice(0, 20)" :key="index">
                <template v-if="mode === 'add'">
                  <td>{{ index + 1 }}</td>
                  <td>{{ result.name }}</td>
                  <td>{{ result.longitude.toFixed(6) }}</td>
                  <td>{{ result.latitude.toFixed(6) }}</td>
                </template>
                <template v-else>
                  <td>{{ index + 1 }}</td>
                  <td>{{ result.province }}</td>
                  <td>{{ result.city }}</td>
                  <td>{{ result.district }}</td>
                  <td>{{ result.township }}</td>
                  <td>{{ result.community }}</td>
                  <td>{{ result.address }}</td>
                  <td :class="!result.inBounds && currentConfig.enableBounds ? 'text-error' : ''">
                    {{ result.longitude.toFixed(6) }}
                  </td>
                  <td :class="!result.inBounds && currentConfig.enableBounds ? 'text-error' : ''">
                    {{ result.latitude.toFixed(6) }}
                  </td>
                </template>
                <td v-for="field in currentConfig.selectedFields" :key="field">
                  {{ getFieldValue(result, field) }}
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="queryResults.length > 20" class="text-center text-gray-500 py-2">
            ... 还有 {{ queryResults.length - 20 }} 行未显示
          </div>
        </div>
      </div>
    </div>

    <ErrorDialog
      :is-open="errorModalOpen"
      type="error"
      title="API Key 验证失败"
      :message="errorModalData.errorMessage || '您输入的高德地图 API Key 无效或已过期，请检查后重新输入。'"
      :details="errorModalData.url ? { url: errorModalData.url } : undefined"
      @close="closeErrorModal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import * as XLSX from 'xlsx'
import { exportData, exportTemplate } from '@/utils/TemplateExporter'
import { logger } from '@/utils/logger'
import { getToolById } from '../../tools/toolData'
import ErrorDialog from '@/components/common/ErrorDialog.vue'
import { useGeocodeStore, type QueryOptions } from '@/stores/geocodeStore'

type GeocodeMode = 'add' | 'lonlat'

const props = defineProps<{
  mode: GeocodeMode
}>()

const mode = props.mode
const toolConfig = getToolById(mode === 'add' ? 'get_add' : 'get_lonlat')

const ADDRESS_HEADERS = ['名称', '经度', '纬度']
const LONLAT_HEADERS = ['省', '市', '区/县', '乡/镇', '社区/村', '地址']

import {
  readAndValidateTemplate as validateAddTemplate,
  type CoordinatePoint,
} from '../../tools/get_add/TemplateReader'

import {
  readAndValidateTemplate as validateLonLatTemplate,
  type FullAddress,
} from '../../tools/get_lonlat/TemplateReader'

import {
  batchQueryAddresses,
  exportResultsToRows as exportAddRows,
  getAvailableFields as getAddFields,
  validateApiKey as validateAddKey,
  type ApiKeyInfo as AddApiKeyInfo,
  type QueryOptions as AddQueryOptions,
  type QueryResult as AddQueryResult,
} from '../../tools/get_add/ApiService'

import {
  batchQueryLonLats,
  exportResultsToRows as exportLonLatRows,
  getAvailableFields as getLonLatFields,
  validateApiKey as validateLonLatKey,
  type ApiKeyInfo as LonLatApiKeyInfo,
  type QueryOptions as LonLatQueryOptions,
  type QueryResult as LonLatQueryResult,
} from '../../tools/get_lonlat/ApiService'

const fileInputRef = ref<HTMLInputElement | null>(null)

const store = useGeocodeStore()

const currentConfig = computed(() => (mode === 'add' ? store.addConfig : store.lonlatConfig))

const errorModalOpen = ref(false)
const errorModalData = ref<{
  url?: string
  errorMessage?: string
}>({})

const closeErrorModal = () => {
  errorModalOpen.value = false
}

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

const addApiKey = () => {
  store.addApiKey(mode)
}

const removeApiKey = (index: number) => {
  store.removeApiKey(mode, index)
}

const updateApiKeyValue = (index: number, value: string) => {
  store.updateApiKey(mode, index, { key: value })
}

const updateQueryOption = (key: keyof QueryOptions, value: number) => {
  store.updateQueryOptions(mode, { [key]: value } as Partial<QueryOptions>)
}

const toggleQueryOption = (key: keyof QueryOptions) => {
  const currentValue = currentConfig.value.queryOptions[key] as boolean
  store.updateQueryOptions(mode, { [key]: !currentValue } as Partial<QueryOptions>)
}

const toggleEnableBounds = () => {
  store.updateEnableBounds(mode, !currentConfig.value.enableBounds)
}

const updateBoundsSwLng = (value: number) => {
  store.updateBounds(mode, {
    ...currentConfig.value.bounds,
    southwest: { ...currentConfig.value.bounds.southwest, lng: value },
  })
}

const updateBoundsSwLat = (value: number) => {
  store.updateBounds(mode, {
    ...currentConfig.value.bounds,
    southwest: { ...currentConfig.value.bounds.southwest, lat: value },
  })
}

const updateBoundsNeLng = (value: number) => {
  store.updateBounds(mode, {
    ...currentConfig.value.bounds,
    northeast: { ...currentConfig.value.bounds.northeast, lng: value },
  })
}

const updateBoundsNeLat = (value: number) => {
  store.updateBounds(mode, {
    ...currentConfig.value.bounds,
    northeast: { ...currentConfig.value.bounds.northeast, lat: value },
  })
}

const toggleSelectedField = (field: string) => {
  const fields = [...currentConfig.value.selectedFields]
  const index = fields.indexOf(field)
  if (index > -1) {
    fields.splice(index, 1)
  } else {
    fields.push(field)
  }
  store.updateSelectedFields(mode, fields)
}

const clearBounds = () => {
  store.updateBounds(mode, {
    southwest: { lng: 0, lat: 0 },
    northeast: { lng: 0, lat: 0 },
  })
}

const resetBounds = () => {
  store.updateBounds(mode, {
    southwest: { lng: 116.0, lat: 39.6 },
    northeast: { lng: 116.8, lat: 40.2 },
  })
}

const availableFields = mode === 'add' ? getAddFields() : getLonLatFields()

const validationResult = ref<any>(null)
const queryResults = ref<any[]>([])
const isQuerying = ref(false)

const progressPercent = ref(0)
const progressMessage = ref('')

const hasValidApiKeys = computed(() =>
  currentConfig.value.apiKeys.some((k: any) => k.isValid && k.provider),
)
const hasData = computed(() => validationResult.value !== null || queryResults.value.length > 0)
const canExecuteQuery = computed(
  () => validationResult.value?.isValid && hasValidApiKeys.value && !isQuerying.value,
)
const canDownloadResult = computed(() => queryResults.value.length > 0)

const downloadTemplate = (format: 'csv' | 'xlsx') => {
  const headers = mode === 'add' ? ADDRESS_HEADERS : LONLAT_HEADERS
  const fileName = mode === 'add' ? '地址查询模板' : '经纬度查询模板'
  exportTemplate(headers, format, fileName)
}

const validateApiKey = async (index: number) => {
  const keyInfo = currentConfig.value.apiKeys[index]
  if (!keyInfo) return

  if (!keyInfo.key.trim()) {
    store.updateApiKey(mode, index, { isValid: false })
    return
  }

  store.updateApiKey(mode, index, { validating: true, provider: 'gaode' })

  const validateFn = mode === 'add' ? validateAddKey : validateLonLatKey
  const result = await validateFn(keyInfo.key, 'gaode')

  store.updateApiKey(mode, index, { isValid: result.isValid, validating: false })

  if (!result.isValid) {
    errorModalData.value = {
      url: result.url,
      errorMessage: result.errorMessage,
    }
    errorModalOpen.value = true

    setTimeout(() => {
      store.updateApiKey(mode, index, { key: '', isValid: false })
    }, 300)
  }
}

const parseCSV = (text: string): Record<string, string | number>[] => {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headerLine = lines[0]
  if (!headerLine) return []

  const headers = headerLine.split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const rows: Record<string, string | number>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    const values = parseCSVLine(line)
    const row: Record<string, string | number> = {}
    headers.forEach((header, index) => {
      const value = values[index]?.trim().replace(/^"|"$/g, '') || ''
      row[header] = isNaN(Number(value)) ? value : Number(value)
    })
    rows.push(row)
  }

  return rows
}

const parseCSVLine = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)

  return result
}

const onFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    let rows: Record<string, string | number>[]

    if (file.name.toLowerCase().endsWith('.xlsx')) {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetNames = workbook.SheetNames || []
      if (sheetNames.length === 0) {
        throw new Error('Excel文件中没有工作表')
      }
      const firstSheetName = sheetNames[0] as string
      const worksheet = workbook.Sheets[firstSheetName]
      if (!worksheet) {
        throw new Error('无法读取工作表内容')
      }
      const jsonData = XLSX.utils.sheet_to_json(worksheet)
      rows = jsonData as Record<string, string | number>[]
    } else {
      const text = await file.text()
      const cleanText = text.replace(/^\uFEFF/, '')
      rows = parseCSV(cleanText)
    }

    const validateFn = mode === 'add' ? validateAddTemplate : validateLonLatTemplate
    validationResult.value = validateFn(rows)
    queryResults.value = []

    if (!validationResult.value.isValid && validationResult.value.errors.length > 0) {
      const errorMessage =
        validationResult.value.errors.slice(0, 5).join('\n') +
        (validationResult.value.errors.length > 5
          ? `\n...还有 ${validationResult.value.errors.length - 5} 个错误`
          : '')
      showErrorDialog('error', '数据校验失败', errorMessage)
    }
  } catch (error) {
    logger.error('文件读取失败:', error)
    validationResult.value = {
      isValid: false,
      data: [],
      errors: ['文件读取失败，请确保文件格式正确'],
    }
    showErrorDialog('error', '文件读取失败', '请确保文件格式正确')
  }
}

const executeQuery = async () => {
  if (!validationResult.value?.isValid || !hasValidApiKeys.value) return

  isQuerying.value = true
  progressPercent.value = 0
  progressMessage.value = '开始查询...'

  try {
    const options = {
      ...currentConfig.value.queryOptions,
      bounds: currentConfig.value.enableBounds ? currentConfig.value.bounds : null,
    }

    if (mode === 'add') {
      queryResults.value = await batchQueryAddresses(
        validationResult.value.data,
        currentConfig.value.apiKeys as AddApiKeyInfo[],
        options as AddQueryOptions,
        (progress) => {
          progressPercent.value = progress.progress
          progressMessage.value = progress.message
        },
      )
    } else {
      queryResults.value = await batchQueryLonLats(
        validationResult.value.data,
        currentConfig.value.apiKeys as LonLatApiKeyInfo[],
        options as LonLatQueryOptions,
        (progress) => {
          progressPercent.value = progress.progress
          progressMessage.value = progress.message
        },
      )
    }
  } catch (error) {
    logger.error('查询失败:', error)
    showErrorDialog('error', '查询失败', (error as Error).message)
  } finally {
    isQuerying.value = false
    progressMessage.value = '查询完成'
  }
}

const downloadResult = (format: 'csv' | 'xlsx') => {
  if (queryResults.value.length === 0) return

  const exportFn = mode === 'add' ? exportAddRows : exportLonLatRows
  const rows = exportFn(queryResults.value, currentConfig.value.selectedFields)

  if (mode === 'add') {
    const headers = ['名称', '经度', '纬度', ...currentConfig.value.selectedFields.map((f: string) => getFieldLabel(f))]
    const dataRows = rows.slice(1)
    exportData(headers, dataRows, format, '地址查询结果')
  } else {
    const headers = rows[0] || []
    const dataRows = rows.slice(1)
    exportData(headers, dataRows, format, '经纬度查询结果')
  }
}

const getFieldLabel = (field: string): string => {
  const found = availableFields.find((f) => f.value === field)
  return found?.label || field
}

const getFieldValue = (result: AddQueryResult | LonLatQueryResult, field: string): string => {
  if (mode === 'add') {
    const r = result as AddQueryResult
    switch (field) {
      case 'address':
        return r.address
      case 'province':
        return r.province
      case 'city':
        return r.city
      case 'district':
        return r.district
      case 'formattedAddress':
        return r.formattedAddress
      case 'adcode':
        return r.adcode
      case 'provider':
        return '高德地图'
      default:
        return ''
    }
  } else {
    const r = result as LonLatQueryResult
    switch (field) {
      case 'formattedAddress':
        return r.formattedAddress
      case 'adcode':
        return r.adcode
      case 'inBounds':
        return r.inBounds ? '是' : '否'
      case 'provider':
        return '高德地图'
      default:
        return ''
    }
  }
}

const clearUploadFile = () => {
  validationResult.value = null

  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const clearAll = () => {
  validationResult.value = null
  queryResults.value = []
  store.clearApiKeys(mode)
  store.updateEnableBounds(mode, false)
  resetBounds()

  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}
</script>

<style scoped>
.input:disabled {
  cursor: not-allowed;
}
</style>