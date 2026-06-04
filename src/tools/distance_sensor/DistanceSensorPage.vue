<template>
  <div class="p-6">
    <ErrorDialog
      :is-open="errorDialogOpen"
      :type="errorDialogType"
      :title="errorDialogTitle"
      :message="errorDialogMessage"
      @close="closeErrorDialog"
    />
    <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || '距离测算' }}</h1>
    <p class="text-base-content/70 mb-6">{{ toolConfig?.description || '两点间距离计算工具' }}</p>

    <div class="bg-base-100/70 backdrop-blur-sm rounded-lg shadow-lg p-6 mb-6 space-y-6">
      <!-- 模板下载区域 -->
      <div>
        <h2 class="text-xl font-semibold mb-4">1. 下载模板</h2>
        <p class="text-base-content/70 mb-3 text-sm">
          支持两种模板格式：<br />
          <span class="font-medium">同站址匹配</span>（3列）：名称、经度、纬度 |
          <span class="font-medium">异站址匹配</span
          >（6列）：名称1、经度1、纬度1、名称2、经度2、纬度2
        </p>
        <div class="flex flex-wrap gap-3">
          <!-- 同站址模板 -->
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
              同站址模板
            </label>
            <ul
              tabindex="0"
              class="dropdown-content menu bg-base-100 rounded-box shadow-lg p-2 w-48 z-10"
            >
              <li>
                <a @click="downloadSameSiteTemplate('csv')" class="text-sm">CSV 格式</a>
              </li>
              <li>
                <a @click="downloadSameSiteTemplate('xlsx')" class="text-sm">Excel 格式</a>
              </li>
            </ul>
          </div>
          <!-- 异站址模板 -->
          <div class="dropdown">
            <label tabindex="0" class="btn btn-outline btn-secondary">
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
              异站址模板
            </label>
            <ul
              tabindex="0"
              class="dropdown-content menu bg-base-100 rounded-box shadow-lg p-2 w-48 z-10"
            >
              <li>
                <a @click="downloadDifferentSiteTemplate('csv')" class="text-sm">CSV 格式</a>
              </li>
              <li>
                <a @click="downloadDifferentSiteTemplate('xlsx')" class="text-sm">Excel 格式</a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 参数设置区域 -->
      <div>
        <h2 class="text-xl font-semibold mb-4">2. 设置匹配参数</h2>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="label">
              <span class="label-text font-semibold">最小距离（米）</span>
            </label>
            <input
              v-model.number="minDistance"
              type="number"
              min="0"
              placeholder="忽略小于此距离"
              class="input input-bordered w-full"
            />
            <label class="label">
              <span class="label-text-alt text-gray-500">留空表示不限制</span>
            </label>
          </div>

          <div>
            <label class="label">
              <span class="label-text font-semibold">最大距离（米）</span>
            </label>
            <input
              v-model.number="maxDistance"
              type="number"
              min="0"
              placeholder="忽略大于此距离"
              class="input input-bordered w-full"
            />
            <label class="label">
              <span class="label-text-alt text-gray-500">留空表示不限制</span>
            </label>
          </div>

          <div>
            <label class="label">
              <span class="label-text font-semibold">匹配数量</span>
            </label>
            <input
              v-model.number="matchCount"
              type="number"
              min="1"
              step="1"
              placeholder="每个站匹配数量"
              class="input input-bordered w-full"
            />
          </div>

          <div>
            <label class="label">
              <span class="label-text font-semibold">匹配方式</span>
            </label>
            <select v-model="matchMode" class="select select-bordered w-full">
              <option value="nearest">从近到远</option>
              <option value="farthest">从远到近</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 高级参数 -->
      <div class="collapse collapse-arrow bg-base-200/50">
        <input type="checkbox" v-model="showAdvanced" />
        <div class="collapse-title text-lg font-semibold">⚙ 高级参数</div>
        <div class="collapse-content space-y-4">
          <!-- 星球预设 -->
          <div>
            <label class="label"><span class="label-text font-semibold">星球</span></label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="(radius, name) in planetPresets"
                :key="name"
                @click="matchConfig.planetRadius = radius"
                class="btn btn-xs"
                :class="Math.abs(matchConfig.planetRadius - radius) < 1 ? 'btn-primary' : 'btn-outline'"
              >
                {{ name }}
              </button>
              <button
                @click="matchConfig.planetRadius = customPlanetRadius"
                class="btn btn-xs"
                :class="isCustomPlanet ? 'btn-primary' : 'btn-outline'"
              >
                自定义
              </button>
            </div>
          </div>
          <!-- 自定义星球半径 -->
          <div v-if="isCustomPlanet">
            <label class="label"><span class="label-text">星球半径（米）</span></label>
            <input
              v-model.number="matchConfig.planetRadius"
              type="number"
              min="1"
              class="input input-bordered input-sm w-full max-w-xs"
            />
          </div>
          <div class="divider my-1"></div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="label"><span class="label-text">初始搜索半径（米）</span></label>
              <input
                v-model.number="matchConfig.initialSearchRadius"
                type="number"
                min="1"
                class="input input-bordered input-sm w-full"
              />
            </div>
            <div>
              <label class="label"><span class="label-text">半径扩大倍数</span></label>
              <input
                v-model.number="matchConfig.radiusMultiplier"
                type="number"
                min="1"
                step="0.1"
                class="input input-bordered input-sm w-full"
              />
            </div>
            <div>
              <label class="label"><span class="label-text">激进扩大倍数（无候选时）</span></label>
              <input
                v-model.number="matchConfig.radiusMultiplierAggressive"
                type="number"
                min="1"
                step="0.1"
                class="input input-bordered input-sm w-full"
              />
            </div>
            <div>
              <label class="label"><span class="label-text">最大迭代次数</span></label>
              <input
                v-model.number="matchConfig.maxIterations"
                type="number"
                min="1"
                class="input input-bordered input-sm w-full"
              />
            </div>
            <div>
              <label class="label"><span class="label-text">分片大小（每批站点数）</span></label>
              <input
                v-model.number="matchConfig.chunkSize"
                type="number"
                min="1"
                class="input input-bordered input-sm w-full"
              />
            </div>
          </div>
          <button @click="resetMatchConfig" class="btn btn-ghost btn-xs mt-2">恢复默认</button>
        </div>
      </div>

      <!-- 文件上传区域 -->
      <div>
        <h2 class="text-xl font-semibold mb-4">3. 上传数据文件</h2>
        <input
          type="file"
          @change="onFileUpload"
          class="file-input file-input-bordered w-full max-w-md"
          accept=".csv,.xlsx"
          ref="fileInputRef"
          :disabled="isMatching"
        />
        <!-- 操作按钮 -->
        <div class="flex flex-wrap gap-3 mt-4">
          <button @click="executeMatch" class="btn btn-primary" :disabled="!canExecuteMatch">
            <span v-if="isMatching" class="loading loading-spinner loading-sm mr-2"></span>
            {{ isMatching ? '匹配中...' : '执行计算' }}
          </button>
          <!-- 下载结果下拉按钮 -->
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
          <button @click="clearAll" class="btn btn-outline btn-error" :disabled="!hasUploadedFile">
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
            清除
          </button>
        </div>

      </div>

      <!-- 验证结果预览 -->
      <div v-if="validationResult" class="space-y-4">
        <!-- 验证通过信息 -->
        <div v-if="validationResult.isValid" class="space-y-2">
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
            验证通过：{{ validationResult.mode === 'same-site' ? '同站址' : '异站址' }}匹配模式
          </div>

          <div class="stats stats-vertical lg:stats-horizontal shadow">
            <div class="stat">
              <div class="stat-title">数据组1</div>
              <div class="stat-value text-primary">{{ validationResult.data1.length }}</div>
              <div class="stat-desc">个站点</div>
            </div>
            <div class="stat">
              <div class="stat-title">数据组2</div>
              <div class="stat-value text-secondary">{{ validationResult.data2.length }}</div>
              <div class="stat-desc">个站点</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 匹配结果预览 -->
      <div v-if="matchResult && matchResult.results.length > 0" class="space-y-4">
        <h2 class="text-xl font-semibold">4. 匹配结果</h2>

        <div class="alert alert-info">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="stroke-current shrink-0 w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <span>共匹配 {{ matchResult.results.length }} 个站，每个站 {{ matchCount }} 个近邻</span>
        </div>

        <div class="overflow-x-auto">
          <table class="table table-zebra table-sm">
            <thead>
              <tr>
                <th>序号</th>
                <th>站点名称</th>
                <th>站点坐标</th>
                <th>匹配站1</th>
                <th>距离1(米)</th>
                <th>匹配站2</th>
                <th>距离2(米)</th>
                <th>匹配站3</th>
                <th>距离3(米)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(result, index) in matchResult.results.slice(0, 20)" :key="index">
                <td>{{ index + 1 }}</td>
                <td>{{ result.site.name }}</td>
                <td>
                  {{ result.site.longitude.toFixed(6) }}, {{ result.site.latitude.toFixed(6) }}
                </td>
                <td>{{ result.matches[0]?.site.name || '-' }}</td>
                <td class="font-mono">{{ result.matches[0]?.distance.toFixed(2) || '-' }}</td>
                <td>{{ result.matches[1]?.site.name || '-' }}</td>
                <td class="font-mono">{{ result.matches[1]?.distance.toFixed(2) || '-' }}</td>
                <td>{{ result.matches[2]?.site.name || '-' }}</td>
                <td class="font-mono">{{ result.matches[2]?.distance.toFixed(2) || '-' }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="matchResult.results.length > 20" class="text-center text-gray-500 py-2">
            ... 还有 {{ matchResult.results.length - 20 }} 行未显示
          </div>
        </div>
      </div>
    </div>

  </div>

  <!-- 进度弹窗 -->
  <ProgressModal
    :is-open="isMatching"
    title="距离匹配计算中..."
    :percent="progressPercent"
    :message="progressMessage"
    :remaining-time="progressTimer.remainingText.value"
    @cancel="cancelMatch"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import * as XLSX from 'xlsx'
import { exportTemplate, exportData } from '@/utils/TemplateExporter'
import { logger } from '@/utils/logger'
import { getToolById } from '../toolData'
import { parseCSV } from '@/utils/CsvParser'
import ErrorDialog from '@/components/common/ErrorDialog.vue'
import ProgressModal from '@/components/common/ProgressModal.vue'
import { useProgressTimer } from '@/composables/useProgressTimer'

const toolConfig = getToolById('distance_sensor')
import {
  readAndValidateTemplate,
  exportMatchResultsToRows,
  getResultHeaders,
  type TemplateValidationResult,
} from './TemplateReader'
import { matchDistances, type MatchResult, DEFAULT_MATCH_CONFIG, PLANET_PRESETS, type MatchConfig } from '@/utils/DistanceCalculator'
import { SAME_SITE_HEADERS, DIFFERENT_SITE_HEADERS } from './TemplateExporter'

const fileInputRef = ref<HTMLInputElement | null>(null)

// 参数设置
const minDistance = ref<number | undefined>(undefined)
const maxDistance = ref<number | undefined>(undefined)
const matchCount = ref<number>(10)
const matchMode = ref<'nearest' | 'farthest'>('nearest')

// 高级算法配置
const showAdvanced = ref(false)
const matchConfig = ref<MatchConfig>({ ...DEFAULT_MATCH_CONFIG })
const planetPresets = PLANET_PRESETS
const customPlanetRadius = ref(DEFAULT_MATCH_CONFIG.planetRadius)

const isCustomPlanet = computed(() => {
  return !Object.values(PLANET_PRESETS).some((r) => Math.abs(matchConfig.value.planetRadius - r) < 1)
})

function resetMatchConfig() {
  matchConfig.value = { ...DEFAULT_MATCH_CONFIG }
  customPlanetRadius.value = DEFAULT_MATCH_CONFIG.planetRadius
}

// 验证结果和匹配结果
const validationResult = ref<TemplateValidationResult | null>(null)
const matchResult = ref<MatchResult | null>(null)
const isMatching = ref(false)
const abortController = ref<AbortController | null>(null)

// 进度
const progressPercent = ref(0)
const progressMessage = ref('')
const progressTimer = useProgressTimer()

// 错误对话框状态
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

// 计算属性
const hasUploadedFile = computed(() => {
  return validationResult.value !== null
})

const canExecuteMatch = computed(() => {
  return validationResult.value?.isValid && !isMatching.value
})

const canDownloadResult = computed(() => {
  return matchResult.value?.results.length !== undefined && matchResult.value.results.length > 0
})

// 确保匹配数量始终是整数
watch(matchCount, (newVal) => {
  if (newVal !== null && newVal !== undefined) {
    matchCount.value = Math.floor(newVal)
  }
})

// 下载同站址模板
const downloadSameSiteTemplate = (format: 'csv' | 'xlsx' = 'csv') => {
  exportTemplate(SAME_SITE_HEADERS, format, '同站址距离匹配模板')
}

// 下载异站址模板
const downloadDifferentSiteTemplate = (format: 'csv' | 'xlsx' = 'csv') => {
  exportTemplate(DIFFERENT_SITE_HEADERS, format, '异站址距离匹配模板')
}

// 处理文件上传
const onFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    let rows: Record<string, string | number>[]

    // 根据文件扩展名选择解析方式
    if (file.name.toLowerCase().endsWith('.xlsx')) {
      // 解析 XLSX 文件
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetNames = workbook.SheetNames || []
      if (sheetNames.length === 0) {
        throw new Error('Excel 文件中没有工作表')
      }
      const firstSheetName = sheetNames[0] as string
      const worksheet = workbook.Sheets[firstSheetName]
      if (!worksheet) {
        throw new Error('无法读取工作表内容')
      }
      const jsonData = XLSX.utils.sheet_to_json(worksheet)
      rows = jsonData as Record<string, string | number>[]
    } else {
      // 解析 CSV 文件
      const text = await file.text()
      rows = parseCSV(text)
    }

    validationResult.value = readAndValidateTemplate(rows)
    matchResult.value = null

    // 如果校验失败，弹出错误提示
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
      data1: [],
      data2: [],
      errors: ['文件读取失败，请确保文件格式正确'],
      mode: 'same-site',
    }
    showErrorDialog('error', '文件读取失败', '请确保文件格式正确')
  }
}



// 终止计算
const cancelMatch = () => {
  abortController.value?.abort()
  progressMessage.value = '正在终止...'
  progressTimer.reset()
}

// 执行距离匹配
const executeMatch = async () => {
  if (!validationResult.value || !validationResult.value.isValid) return

  const controller = new AbortController()
  abortController.value = controller
  isMatching.value = true
  progressPercent.value = 0
  progressMessage.value = '开始匹配...'
  progressTimer.start()

  try {
    matchResult.value = await matchDistances(
      validationResult.value.data1,
      validationResult.value.data2,
      {
        minDistance: minDistance.value || undefined,
        maxDistance: maxDistance.value || undefined,
        matchCount: matchCount.value,
        matchMode: matchMode.value,
      },
      (progress, message) => {
        progressPercent.value = progress
        progressMessage.value = message
        progressTimer.update(progress)
      },
      controller.signal,
      matchConfig.value,
    )
  } catch (error) {
    logger.error('匹配计算失败:', error)
    if (!controller.signal.aborted) {
      showErrorDialog('error', '计算失败', '距离匹配计算过程中发生错误，请重试')
    }
  } finally {
    isMatching.value = false
    abortController.value = null
    progressTimer.reset()
  }
}

// 下载匹配结果
const downloadResult = (format: 'csv' | 'xlsx' = 'csv') => {
  if (!matchResult.value || !validationResult.value) return

  const headers = getResultHeaders(validationResult.value.mode, matchCount.value)
  // 结果对齐：同站址→data1，异站址→data2（456列源集）
  const exportSource =
    validationResult.value.mode === 'different-site'
      ? validationResult.value.data2
      : validationResult.value.data1
  const rows = exportMatchResultsToRows(
    exportSource,
    validationResult.value.data2,
    matchResult.value.results,
    validationResult.value.mode,
    matchCount.value,
  )

  exportData(headers, rows, format, '距离匹配结果')
}

// 清除所有数据
const clearAll = () => {
  validationResult.value = null
  matchResult.value = null
  progressPercent.value = 0
  progressMessage.value = ''

  // 清除文件输入
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}
</script>
