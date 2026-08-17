import { ref, computed } from 'vue'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import * as Papa from 'papaparse'
import expressions from 'angular-expressions'
import {
  convertDatesInData,
  generateFilename,
  resolveDuplicates,
  validateFilenameTemplate,
} from './docxTemplateFunctions'

// ========== Angular 解析器 ==========

function angularParser(tag: string) {
  const expr = expressions.compile(tag)
  return {
    get(scope: Record<string, any>) {
      try {
        const result = expr(scope)
        // 如果 scope 中的值已经是格式化后的字符串，直接返回
        // Date 对象兜底：走上面注册的 dateFilter 不如在 convertDateValue 处理更快，这里做最后一道防线
        if (result instanceof Date) {
          const year = result.getFullYear()
          const month = result.getMonth() + 1
          const day = result.getDate()
          const hours = String(result.getHours()).padStart(2, '0')
          const minutes = String(result.getMinutes()).padStart(2, '0')
          const seconds = String(result.getSeconds()).padStart(2, '0')
          const hasTime = hours !== '00' || minutes !== '00' || seconds !== '00'
          return hasTime
            ? `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
            : `${year}-${month}-${day}`
        }
        return result !== undefined && result !== null ? result : ''
      } catch {
        return ''
      }
    },
  }
}

export function useDocxTemplateExport() {
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

  const templateContent = ref<ArrayBuffer | null>(null)
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
          cellDates: true,
        })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
          throw new Error('Excel 文件中没有工作表')
        }
        const firstSheet = workbook.Sheets[sheetName] as XLSX.WorkSheet
        data = XLSX.utils.sheet_to_json(firstSheet, { raw: true }) as Record<string, any>[]
        data = convertDatesInData(data)
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
      templateContent.value = await file.arrayBuffer()
    } catch (err) {
      errorMessage.value = `读取模板失败：${err instanceof Error ? err.message : String(err)}`
      showError.value = true
      templateFileName.value = ''
      templateContent.value = null
    }
  }

  const canRender = computed(() => {
    return dataRowCount.value > 0 && templateContent.value !== null && !isRendering.value
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
    if (!templateContent.value || dataRowCount.value === 0) return

    // 校验文件名模板
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

      // 生成所有文件名
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
        const zip = new PizZip(templateContent.value)
        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          nullGetter: function () {
            return ''
          },
          parser: angularParser,
        })

        doc.render({
          ...rowData,
          items: dataList,
          rowIndex: i + 1,
          totalRows: dataList.length,
        })

        const blob = doc.getZip().generate({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })

        renderResults.value.push({
          name: `${finalNames[i]}.docx`,
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
    templateContent.value = null
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
