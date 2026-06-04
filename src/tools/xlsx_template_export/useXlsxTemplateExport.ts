import { ref, computed } from 'vue'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import * as Papa from 'papaparse'

declare global {
  interface Window {
    ExcelJS: typeof import('exceljs')
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || '未命名'
}

function validateFilenameTemplate(template: string): { valid: boolean; error?: string } {
  let depth = 0
  for (const ch of template) {
    if (ch === '{') depth++
    if (ch === '}') depth--
    if (depth < 0) return { valid: false, error: '多余的 } 右花括号' }
  }
  if (depth > 0) return { valid: false, error: '花括号未闭合，缺少 }' }

  const re = /\{([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(template)) !== null) {
    if (m[1]! === '') return { valid: false, error: '存在空的 {} 占位符' }
    if (!/^[\w]+$/.test(m[1]!)) {
      return { valid: false, error: `字段名 "{${m[1]!}}" 包含非法字符，只允许字母、数字和下划线` }
    }
  }

  return { valid: true }
}

function generateFilename(
  row: Record<string, any>,
  template: string,
  index: number,
): string {
  if (!template) {
    const keys = Object.keys(row)
    const firstKey = keys[0]
    if (firstKey && row[firstKey] != null) {
      return sanitizeFilename(String(row[firstKey]))
    }
    return `文档_${index + 1}`
  }

  const name = template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const val = row[key]
    return val != null ? String(val) : ''
  })
  return sanitizeFilename(name)
}

function resolveDuplicates(
  names: string[],
  strategy: 'appendIndex' | 'rowPrefix',
): string[] {
  if (strategy === 'rowPrefix') {
    const pad = String(names.length).length
    return names.map((name, i) => `${String(i + 1).padStart(pad, '0')}-${name}`)
  }

  const seen = new Map<string, number>()
  return names.map((name) => {
    const count = seen.get(name) || 0
    seen.set(name, count + 1)
    if (count === 0) return name
    return `${name}(${count})`
  })
}

function convertDatesInData(data: Record<string, any>[]): Record<string, any>[] {
  // no-op: keep raw types (numbers for dates) so precision is preserved
  return data
}

function convertDateValue(value: any): any {
  return value
}

// Excel 序列号转换：日期字符串 → 数字
function dateStringToSerial(trimmed: string): number | null {
  const chineseDatePattern =
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  const m = trimmed.match(chineseDatePattern)
  if (m && parseInt(m[1]!) > 1900) {
    const hours = parseInt(m[4]!) || 0
    const minutes = parseInt(m[5]!) || 0
    const seconds = parseInt(m[6]!) || 0
    const MS_PER_DAY = 1000 * 60 * 60 * 24
    const totalMs = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, hours, minutes, seconds)
    return (totalMs - Date.UTC(1899, 11, 30)) / MS_PER_DAY
  }
  return null
}


function resolveValue(
  key: string,
  rowData: Record<string, any>,
  index: number,
  dataList: Record<string, any>[],
): any {
  let v: any = undefined

  if (rowData[key] !== undefined && rowData[key] !== null) {
    v = rowData[key]
  } else if (key === 'rowIndex') {
    v = index + 1
  } else if (key === 'totalRows') {
    v = dataList.length
  } else if (key === 'items') {
    v = JSON.stringify(dataList)
  }

  if (v === undefined || v === null || v === '') return ''

  // 数字直接透传（含 Excel 序列号），模板 numFmt 决定显示格式
  if (typeof v === 'number') return v

  if (typeof v === 'string') {
    const trimmed = v.trim()
    // 纯数字字符串 → 转数字
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
    // 日期字符串 → Excel 序列号
    const serial = dateStringToSerial(trimmed)
    if (serial !== null) return serial
  }

  return v
}

export function useXlsxTemplateExport() {
  const dataFileInputRef = ref<HTMLInputElement | null>(null)
  const templateFileInputRef = ref<HTMLInputElement | null>(null)

  const dataFileName = ref('')
  const templateFileName = ref('')
  const dataRowCount = ref(0)
  const detectedFields = ref<string[]>([])
  const skipRows = ref(1)
  const rawDataList = ref<Record<string, any>[]>([])

  const filenameTemplate = ref('')
  const duplicateStrategy = ref<'appendIndex' | 'rowPrefix'>('appendIndex')
  const showFilenameError = ref(false)
  const filenameErrorMessage = ref('')

  const templateData = ref<ArrayBuffer | null>(null)
  const renderResults = ref<{ name: string; blob: Blob }[]>([])

  const isRendering = ref(false)
  const progress = ref(0)
  const progressText = ref('')
  const showError = ref(false)
  const errorMessage = ref('')
  const showSuccess = ref(false)

  async function downloadTemplate(format: 'csv' | 'xlsx') {
    const templateData = [
      { name: '张三', age: 25, city: '北京' },
      { name: '李四', age: 30, city: '上海' },
    ]

    if (format === 'csv') {
      const csvContent = Papa.unparse(templateData)
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
      saveAs(blob, 'data_template.csv')
    } else {
      const ws = XLSX.utils.json_to_sheet(templateData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Data')
      XLSX.writeFile(wb, 'data_template.xlsx')
    }
  }

  async function onDataFileUpload(event: Event) {
    const target = event.target as HTMLInputElement
    if (!target.files || target.files.length === 0) return

    const file = target.files[0]
    if (!file) return

    dataFileName.value = file.name
    detectedFields.value = []

    try {
      let data: Record<string, any>[] = []

      if (file.name.endsWith('.csv')) {
        const text = await file.text()
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
        data = parsed.data as Record<string, any>[]
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, {
          type: 'array',
          cellFormula: false,
          cellHTML: false,
        })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
          throw new Error('Excel 文件中没有工作表')
        }
        const firstSheet = workbook.Sheets[sheetName] as XLSX.WorkSheet
        data = XLSX.utils.sheet_to_json(firstSheet, { raw: true }) as Record<string, any>[]
      }

      if (data.length > 0 && data[0]) {
        dataRowCount.value = data.length
        detectedFields.value = Object.keys(data[0])
        rawDataList.value = data
        const firstKey = Object.keys(data[0])[0]
        if (firstKey) {
          filenameTemplate.value = `{${firstKey}}`
        }
      }
    } catch (err) {
      errorMessage.value = `读取文件失败：${err instanceof Error ? err.message : String(err)}`
      showError.value = true
      dataFileName.value = ''
      dataRowCount.value = 0
      rawDataList.value = []
    }
  }

  function setSkipRows(value: number) {
    skipRows.value = Math.max(1, value)
  }

  async function onTemplateFileUpload(event: Event) {
    const target = event.target as HTMLInputElement
    if (!target.files || target.files.length === 0) return

    const file = target.files[0]
    if (!file) return

    templateFileName.value = file.name

    try {
      templateData.value = await file.arrayBuffer()
    } catch (err) {
      errorMessage.value = `读取模板失败：${err instanceof Error ? err.message : String(err)}`
      showError.value = true
      templateFileName.value = ''
      templateData.value = null
    }
  }

  const canRender = computed(() => {
    return dataRowCount.value > 0 && templateData.value !== null && !isRendering.value
  })

  const canDownload = computed(() => {
    return renderResults.value.length > 0
  })

  const actualDataList = computed(() => {
    return rawDataList.value.slice(skipRows.value - 1)
  })

  const previewFilenames = computed(() => {
    if (actualDataList.value.length === 0) return [] as string[]
    return actualDataList.value.slice(0, 3).map((row, i) =>
      generateFilename(row, filenameTemplate.value, i),
    )
  })

  const duplicateWarnings = computed(() => {
    if (actualDataList.value.length === 0 || !filenameTemplate.value) return [] as { name: string; count: number }[]
    const allNames = actualDataList.value.map((row, i) =>
      generateFilename(row, filenameTemplate.value, i),
    )
    const beforeStrategy = new Map<string, number>()
    allNames.forEach((name) => {
      beforeStrategy.set(name, (beforeStrategy.get(name) || 0) + 1)
    })
    const warnings: { name: string; count: number }[] = []
    beforeStrategy.forEach((count, name) => {
      if (count > 1) warnings.push({ name, count })
    })
    return warnings
  })

  async function handleRender() {
    if (!templateData.value || dataRowCount.value === 0) return

    const validation = validateFilenameTemplate(filenameTemplate.value)
    if (!validation.valid) {
      filenameErrorMessage.value = validation.error || '文件名模板语法错误'
      showFilenameError.value = true
      return
    }

    isRendering.value = true
    progress.value = 0
    progressText.value = '正在准备数据...'

    try {
      await new Promise((resolve) => setTimeout(resolve, 100))
      progress.value = 20
      progressText.value = '正在解析模板...'

      const dataList = actualDataList.value

      if (dataList.length === 0) {
        throw new Error('忽略行数后没有剩余数据')
      }

      const rawNames = dataList.map((row, i) =>
        generateFilename(row, filenameTemplate.value, i),
      )
      const finalNames = resolveDuplicates(rawNames, duplicateStrategy.value)

      await new Promise((resolve) => setTimeout(resolve, 100))
      progress.value = 30
      progressText.value = `正在渲染文档 (1/${dataList.length})...`

      renderResults.value = []

      for (let i = 0; i < dataList.length; i++) {
        const rowData = dataList[i]

        const workbook = new window.ExcelJS.Workbook()
        await workbook.xlsx.load(templateData.value!)
        const worksheet = workbook.getWorksheet(1)
        if (!worksheet) throw new Error('模板中没有工作表')

        worksheet.eachRow((row) => {
          row.eachCell((cell) => {
            const val = cell.value
            if (typeof val !== 'string') return

            const origNumFmt = cell.numFmt
            const singleKeyMatch = val.match(/^\{([^}]+)\}$/)

            if (singleKeyMatch) {
              const v = resolveValue(singleKeyMatch[1]!, rowData!, i, dataList)
              if (v !== '' && v !== undefined && v !== null) {
                cell.value = v
                cell.numFmt = origNumFmt
              }
            } else {
              const replaced = val.replace(/\{([^}]+)\}/g, (_match, key) => {
                const v = resolveValue(key, rowData!, i, dataList)
                return v != null && v !== '' ? String(v) : ''
              })
              if (replaced !== val) cell.value = replaced
            }
          })
        })

        const buffer = await workbook.xlsx.writeBuffer()
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })

        renderResults.value.push({
          name: `${finalNames[i]}.xlsx`,
          blob,
        })

        const progressPercent = 30 + Math.round(((i + 1) / dataList.length) * 60)
        progress.value = Math.min(90, progressPercent)
        progressText.value = `正在渲染文档 (${i + 1}/${dataList.length})...`

        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      await new Promise((resolve) => setTimeout(resolve, 100))
      progress.value = 100
      progressText.value = '渲染完成！'

      await new Promise((resolve) => setTimeout(resolve, 500))
      isRendering.value = false
      showSuccess.value = true
      setTimeout(() => {
        showSuccess.value = false
      }, 3000)
    } catch (err) {
      isRendering.value = false
      errorMessage.value = `渲染失败：${err instanceof Error ? err.message : String(err)}`
      showError.value = true
    }
  }

  async function handleDownload() {
    if (renderResults.value.length === 0) return

    if (renderResults.value.length === 1) {
      const result = renderResults.value[0]
      if (result) {
        saveAs(result.blob, result.name)
      }
    } else {
      const zip = new JSZip()
      renderResults.value.forEach((result) => {
        zip.file(result.name, result.blob)
      })

      const content = await zip.generateAsync({ type: 'blob' })
      const timestamp = new Date().toISOString().slice(0, 10)
      saveAs(content, `渲染文档_${timestamp}.zip`)
    }
  }

  function handleClear() {
    dataFileName.value = ''
    templateFileName.value = ''
    dataRowCount.value = 0
    detectedFields.value = []
    templateData.value = null
    renderResults.value = []
    skipRows.value = 1

    rawDataList.value = []
    filenameTemplate.value = ''
    duplicateStrategy.value = 'appendIndex'

    if (dataFileInputRef.value) {
      dataFileInputRef.value.value = ''
    }
    if (templateFileInputRef.value) {
      templateFileInputRef.value.value = ''
    }
  }

  function applyDefaultFilenameTemplate() {
    const firstKey = detectedFields.value[0]
    filenameTemplate.value = firstKey ? `{${firstKey}}` : ''
    showFilenameError.value = false
    handleRender()
  }

  function dismissFilenameError() {
    showFilenameError.value = false
  }

  return {
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
  }
}
