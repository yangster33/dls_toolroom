/**
 * GeocodeCommon 的业务编排（地址解析 / 经纬度查询共用）。
 *
 * 从 GeocodeCommon.vue 抽出的状态与动作：文件导入、模板下载、API Key 校验、
 * 批量查询、结果导出、进度弹窗与错误提示。页面只保留模板与组件编排。
 */
import { computed, reactive, ref, shallowRef } from 'vue'
import * as XLSX from 'xlsx'
import { exportData, exportTemplate } from '@/utils/TemplateExporter'
import { logger } from '@/utils/logger'
import { useProgressTimer } from '@/composables/useProgressTimer'
import type { ProgressCallback } from '@/utils/progress'
import { yieldToUI } from '@/utils/yieldToUI'
import { useGeocodeStore } from '@/stores/geocodeStore'
import {
  readCoordinatePointRows as validateAddTemplate,
  type CoordinatePoint,
} from '@/utils/templateRowReader'
import {
  readAndValidateTemplate as validateLonLatTemplate,
  type FullAddress,
} from '@/tools/get_lonlat/TemplateReader'
import {
  batchQueryAddresses,
  exportResultsToRows as exportAddRows,
  getAvailableFields as getAddFields,
  validateApiKey as validateAddKey,
  type ApiKeyInfo as AddApiKeyInfo,
  type QueryOptions as AddQueryOptions,
  type QueryResult as AddQueryResult,
} from '@/tools/get_add/ApiService'
import {
  batchQueryLonLats,
  exportResultsToRows as exportLonLatRows,
  getAvailableFields as getLonLatFields,
  validateApiKey as validateLonLatKey,
  type ApiKeyInfo as LonLatApiKeyInfo,
  type QueryOptions as LonLatQueryOptions,
  type QueryResult as LonLatQueryResult,
} from '@/tools/get_lonlat/ApiService'
import { parseCSV } from './geocodeParsing'
import { findFieldLabel } from './geocodeFields'
import type { GeocodeMode, GeocodeQueryResult, GeocodeValidation } from './geocodeTypes'

const ADDRESS_HEADERS = ['名称', '经度', '纬度']
const LONLAT_HEADERS = ['省', '市', '区/县', '乡/镇', '社区/村', '地址']

export function useGeocodeWorkflow(mode: GeocodeMode) {
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

  const showErrorDialog = (
    type: 'error' | 'warning' | 'success' | 'info',
    title: string,
    message: string,
  ) => {
    errorDialogType.value = type
    errorDialogTitle.value = title
    errorDialogMessage.value = message
    errorDialogOpen.value = true
  }

  const availableFields = mode === 'add' ? getAddFields() : getLonLatFields()

  const validationResult = ref<GeocodeValidation | null>(null)
  const queryResults = shallowRef<GeocodeQueryResult[]>([])

  /** 模板按 mode 分流渲染；用 computed 收窄，避免模板里访问并集上不存在的字段 */
  const addResults = computed<AddQueryResult[]>(() =>
    mode === 'add' ? (queryResults.value as AddQueryResult[]) : [],
  )
  const lonlatResults = computed<LonLatQueryResult[]>(() =>
    mode === 'lonlat' ? (queryResults.value as LonLatQueryResult[]) : [],
  )

  const isQuerying = ref(false)
  const progressPercent = ref(0)
  const progressMessage = ref('')

  // 导入/导出（模板下载、文件解析、结果导出）统一进度弹窗。
  // 与查询阶段的内联进度（isQuerying / progressPercent）相互独立。
  const pipelineProgress = reactive({
    open: false,
    title: '正在处理...',
    percent: 0,
    message: '',
  })
  const pipelineTimer = useProgressTimer()

  function beginPipeline(title: string) {
    pipelineProgress.open = true
    pipelineProgress.title = title
    pipelineProgress.percent = 0
    pipelineProgress.message = ''
    pipelineTimer.start()
  }

  function endPipeline() {
    pipelineProgress.open = false
  }

  const pipelineReporter: ProgressCallback = (percent, message) => {
    pipelineProgress.percent = percent
    pipelineProgress.message = message
    pipelineTimer.update(percent)
  }

  /**
   * 导入取消（C4 收尾 / P2-20）。
   *
   * 页内 `XLSX.read` 是同步块，abort 实际能停下的是逐行校验阶段；
   * 已取消时两个 mode 的 reader 会在让出间隙抛 AbortError。
   */
  const importAbort = ref<AbortController | null>(null)
  const canCancelImport = computed(() => importAbort.value !== null)

  const hasValidApiKeys = computed(() =>
    currentConfig.value.apiKeys.some((k) => k.isValid && k.provider),
  )
  const hasData = computed(() => validationResult.value !== null || queryResults.value.length > 0)
  const canExecuteQuery = computed(() =>
    Boolean(validationResult.value?.isValid && hasValidApiKeys.value && !isQuerying.value),
  )
  const canDownloadResult = computed(() => queryResults.value.length > 0)

  const downloadTemplate = async (format: 'csv' | 'xlsx') => {
    const headers = mode === 'add' ? ADDRESS_HEADERS : LONLAT_HEADERS
    const fileName = mode === 'add' ? '地址查询模板' : '经纬度查询模板'
    beginPipeline('正在下载模板...')
    try {
      await exportTemplate(headers, format, fileName, pipelineReporter)
    } finally {
      endPipeline()
    }
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

  const onFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    const controller = new AbortController()
    importAbort.value = controller
    beginPipeline('正在解析文件...')
    try {
      // 先画进度文案并让出一帧：XLSX.read / sheet_to_json 是同步阻塞
      pipelineProgress.percent = 10
      pipelineProgress.message = '正在解析表格...'
      pipelineTimer.update(10)
      await yieldToUI()

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
      const result = await validateFn(rows, pipelineReporter, controller.signal)

      // 取消后 reader 可能仍把结果算完并返回：此时整份丢弃，不写校验结果
      if (controller.signal.aborted) return

      validationResult.value = result
      queryResults.value = []

      if (!result.isValid && result.errors.length > 0) {
        const errorMessage =
          result.errors.slice(0, 5).join('\n') +
          (result.errors.length > 5 ? `\n...还有 ${result.errors.length - 5} 个错误` : '')
        showErrorDialog('error', '数据校验失败', errorMessage)
      }
    } catch (error) {
      // 取消不是错误：静默收尾，别弹「文件读取失败」
      if (controller.signal.aborted) return
      logger.error('文件读取失败:', error)
      validationResult.value = {
        isValid: false,
        data: [],
        errors: ['文件读取失败，请确保文件格式正确'],
      }
      showErrorDialog('error', '文件读取失败', '请确保文件格式正确')
    } finally {
      importAbort.value = null
      endPipeline()
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
        const data = validationResult.value?.data as CoordinatePoint[] | undefined
        queryResults.value = data
          ? await batchQueryAddresses(
              data,
              currentConfig.value.apiKeys as AddApiKeyInfo[],
              options as AddQueryOptions,
              (progress) => {
                progressPercent.value = progress.progress
                progressMessage.value = progress.message
              },
            )
          : []
      } else {
        const data = validationResult.value?.data as FullAddress[] | undefined
        queryResults.value = data
          ? await batchQueryLonLats(
              data,
              currentConfig.value.apiKeys as LonLatApiKeyInfo[],
              options as LonLatQueryOptions,
              (progress) => {
                progressPercent.value = progress.progress
                progressMessage.value = progress.message
              },
            )
          : []
      }
    } catch (error) {
      logger.error('查询失败:', error)
      showErrorDialog('error', '查询失败', (error as Error).message)
    } finally {
      isQuerying.value = false
      progressMessage.value = '查询完成'
    }
  }

  const downloadResult = async (format: 'csv' | 'xlsx') => {
    if (queryResults.value.length === 0) return

    // 两个 exportResultsToRows 签名不同，按 mode 分别调用（用三元会导致类型交集）
    const rows =
      mode === 'add'
        ? exportAddRows(queryResults.value as AddQueryResult[], currentConfig.value.selectedFields)
        : exportLonLatRows(
            queryResults.value as LonLatQueryResult[],
            currentConfig.value.selectedFields,
          )

    beginPipeline('正在导出结果...')
    try {
      if (mode === 'add') {
        const headers = [
          '名称',
          '经度',
          '纬度',
          ...currentConfig.value.selectedFields.map((f: string) => getFieldLabel(f)),
        ]
        const dataRows = rows.slice(1)
        await exportData(headers, dataRows, format, '地址查询结果', pipelineReporter)
      } else {
        const headers = rows[0] || []
        const dataRows = rows.slice(1)
        await exportData(headers, dataRows, format, '经纬度查询结果', pipelineReporter)
      }
    } finally {
      endPipeline()
    }
  }

  const getFieldLabel = (field: string): string => findFieldLabel(availableFields, field)

  const clearUploadFile = () => {
    validationResult.value = null
  }

  /**
   * 取消导入：abort 在途校验，收回进度弹窗，并与「清除上传」保持同一口径
   * 丢掉本次上传的校验结果。
   */
  const cancelImport = () => {
    importAbort.value?.abort()
    importAbort.value = null
    endPipeline()
    pipelineTimer.reset()
    clearUploadFile()
  }

  const clearAll = () => {
    validationResult.value = null
    queryResults.value = []
    store.clearApiKeys(mode)
    store.updateEnableBounds(mode, false)
    store.updateBounds(mode, {
      southwest: { lng: 116.0, lat: 39.6 },
      northeast: { lng: 116.8, lat: 40.2 },
    })
  }

  return {
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
  }
}
