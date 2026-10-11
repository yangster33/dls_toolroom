import { ref, computed, shallowRef } from 'vue'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import * as Papa from 'papaparse'
import expressions from 'angular-expressions'
import { logger } from '@/utils/logger'
// exceljs 约 900KB，运行时用动态 import 懒加载；这里只取类型（编译期擦除，不进 bundle）
import type * as ExcelJS from 'exceljs'

export type ExportFormat = 'docx' | 'xlsx'

function ensureString(input: unknown): string {
  if (input === null || input === undefined) return ''
  return String(input)
}

function ensureNumber(input: unknown): number {
  const n = Number(input)
  return isNaN(n) ? 0 : n
}

expressions.filters.upper = (input: unknown) => ensureString(input).toUpperCase()
expressions.filters.lower = (input: unknown) => ensureString(input).toLowerCase()
expressions.filters.capitalize = (input: unknown) => {
  const str = ensureString(input)
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}
expressions.filters.number = (input: unknown, decimals: unknown) => {
  const n = ensureNumber(input)
  const d = ensureNumber(decimals)
  return n.toFixed(d)
}
expressions.filters.currency = (input: unknown, symbol: unknown) => {
  const n = ensureNumber(input)
  const s = symbol != null ? String(symbol) : '¥'
  return s + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
expressions.filters.percent = (input: unknown, decimals: unknown) => {
  const n = ensureNumber(input) * 100
  const d = decimals != null ? ensureNumber(decimals) : 0
  return n.toFixed(d) + '%'
}
expressions.filters.date = (input: unknown, format: unknown) => {
  if (input === null || input === undefined) return ''
  const fmt = format != null ? String(format) : 'yyyy-mm-dd'
  let d: Date
  if (input instanceof Date) {
    d = input
  } else if (typeof input === 'string' || typeof input === 'number') {
    d = new Date(input)
    if (isNaN(d.getTime())) return ensureString(input)
  } else {
    return ensureString(input)
  }
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')

  return fmt
    .replace(/yyyy/g, String(year))
    .replace(/yy/g, String(year).slice(-2))
    .replace(/mm/g, String(month).padStart(2, '0'))
    .replace(/dd/g, String(day).padStart(2, '0'))
    .replace(/hh/g, hours)
    .replace(/ii/g, minutes)
    .replace(/ss/g, seconds)
}
expressions.filters.default = (input: unknown, fallback: unknown) => {
  if (input === null || input === undefined || input === '') {
    return fallback != null ? fallback : ''
  }
  return input
}
expressions.filters.truncate = (input: unknown, length: unknown) => {
  const str = ensureString(input)
  const len = ensureNumber(length) || 10
  return str.length > len ? str.substring(0, len) + '...' : str
}
expressions.filters.trim = (input: unknown) => ensureString(input).trim()
expressions.filters.split = (input: unknown, delimiter: unknown, index: unknown) => {
  const str = ensureString(input)
  const delim = delimiter != null ? String(delimiter) : ' '
  const i = ensureNumber(index)
  const parts = str.split(delim)
  return parts[i] !== undefined ? parts[i] : ''
}

function angularParser(tag: string) {
  const expr = expressions.compile(tag)
  return {
    get(scope: Record<string, unknown>) {
      try {
        const result = expr(scope)
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

function convertDatesInData(data: Record<string, unknown>[]): Record<string, unknown>[] {
  return data.map((row) => {
    const convertedRow: Record<string, unknown> = {}
    for (const key in row) {
      convertedRow[key] = convertDateValue(row[key])
    }
    return convertedRow
  })
}

function convertDateValue(value: unknown): unknown {
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = value.getMonth() + 1
    const day = value.getDate()
    const hours = String(value.getHours()).padStart(2, '0')
    const minutes = String(value.getMinutes()).padStart(2, '0')
    const seconds = String(value.getSeconds()).padStart(2, '0')
    const formatted = `${year}-${month}-${day}`
    const hasTime = hours !== '00' || minutes !== '00' || seconds !== '00'
    return hasTime ? `${formatted} ${hours}:${minutes}:${seconds}` : formatted
  }

  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()

    const chineseDatePattern =
      /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    const matchChinese = trimmed.match(chineseDatePattern)
    if (matchChinese && parseInt(matchChinese[1]!) > 1900) {
      const year = matchChinese[1]!
      const month = parseInt(matchChinese[2]!)
      const day = parseInt(matchChinese[3]!)
      const hours = parseInt(matchChinese[4]!) || 0
      const minutes = parseInt(matchChinese[5]!) || 0
      const seconds = parseInt(matchChinese[6]!) || 0
      const hasTime = hours !== 0 || minutes !== 0 || seconds !== 0
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      return hasTime ? `${year}-${month}-${day} ${timeStr}` : `${year}-${month}-${day}`
    }

    const usDatePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    const matchUS = trimmed.match(usDatePattern)
    if (matchUS) {
      const month = parseInt(matchUS[1]!)
      const day = parseInt(matchUS[2]!)
      const year = matchUS[3]!
      const hours = parseInt(matchUS[4]!) || 0
      const minutes = parseInt(matchUS[5]!) || 0
      const seconds = parseInt(matchUS[6]!) || 0
      const hasTime = hours !== 0 || minutes !== 0 || seconds !== 0
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      return hasTime ? `${year}-${month}-${day} ${timeStr}` : `${year}-${month}-${day}`
    }

    if (/^\d{8}/.test(trimmed)) {
      const year = trimmed.substring(0, 4)
      const month = parseInt(trimmed.substring(4, 6))
      const day = parseInt(trimmed.substring(6, 8))
      return `${year}-${month}-${day}`
    }

    return value
  }

  return value
}

/**
 * 归一化「忽略行数」。
 *
 * 历史 Bug（审计 P1-5）：
 *  1. 旧实现 `slice(skipRows - 1)` 与 UI 文案「忽略前 N 行（默认1行）」错开一位；
 *  2. 旧钳制 `Math.max(1, value)` 使下限为 1，用户无法表达「不忽略」；
 *  3. `v-model.number` 清空输入框时产出 `''`，必须能被正常处理。
 *
 * 现在统一为「忽略 N 行」并允许 0。抽成模块级纯函数以便单测
 * （原本是 composable 内的闭包，无法直接测试）。
 */
export function normalizeSkipRows(value: number): number {
  const n = Math.floor(Number(value))
  // NaN / Infinity / 空串一律归 0（不忽略）
  if (!Number.isFinite(n)) return 0
  return Math.max(0, n)
}

/** 导出以便单测（这些纯函数此前只在已删除的 docx/xlsxTemplateFunctions.ts 中有测试，
 *  而那份是重构残留的死代码副本；导出后 live 实现重新获得覆盖） */
export function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim() || '未命名'
  )
}

export function validateFilenameTemplate(template: string): { valid: boolean; error?: string } {
  let depth = 0
  for (const ch of template) {
    if (ch === '{') depth++
    if (ch === '}') depth--
    if (depth < 0) return { valid: false, error: '多余的 } 右花括号' }
  }
  if (depth > 0) return { valid: false, error: '花括号未闭合，缺少 } 右花括号' }

  // 注意用 [^}]* 而不是 [^}]+：`{}` 也必须被判为非法。
  // 旧实现用 [^}]+，空占位符匹配不上正则，下面的"存在空的 {} 占位符"
  // 分支是死代码，`报告_{}` 会被放过并生成 `报告_`。
  const re = /\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(template)) !== null) {
    if (m[1] === '') return { valid: false, error: '存在空的 {} 占位符' }
    if (!/^[\w]+$/.test(m[1]!)) {
      return { valid: false, error: `字段名 "{${m[1]!}}" 包含非法字符，只允许字母、数字和下划线` }
    }
  }

  return { valid: true }
}

export function generateFilename(
  row: Record<string, unknown>,
  template: string,
  index: number,
): string {
  if (!template) {
    const keys = Object.keys(row)
    const firstKey = keys[0]
    const firstValue = firstKey !== undefined ? row[firstKey] : undefined
    // 首列存在但为空字符串时，旧实现会走 sanitizeFilename('') → '未命名'，
    // 导致下面的 `文档_${index+1}` 分支永远不可达（'' != null 为 true）。
    if (firstValue != null && String(firstValue).trim() !== '') {
      return sanitizeFilename(String(firstValue))
    }
    return `文档_${index + 1}`
  }

  const name = template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const val = row[key]
    return val != null ? String(val) : ''
  })
  return sanitizeFilename(name)
}

export function resolveDuplicates(
  names: string[],
  strategy: 'appendIndex' | 'rowPrefix',
): string[] {
  if (strategy === 'rowPrefix') {
    const pad = String(names.length).length
    return names.map((name, i) => `${String(i + 1).padStart(pad, '0')}-${name}`)
  }

  // 必须用「已产出的最终名」集合，而不是「原始名出现次数」。
  //
  // 旧实现（审计报告 P1-4）：
  //   const seen = new Map<string, number>()
  //   names.map(name => { const count = seen.get(name) || 0; seen.set(name, count+1)
  //                      return count === 0 ? name : `${name}(${count})` })
  // 输入 ['a','a','a(1)'] → ['a','a(1)','a(1)']：第三行与第二行撞名，
  // JSZip 的 zip.file(name) 同名覆盖 → 少一个文件，且 zip 生成时不报错。
  const used = new Set<string>()
  return names.map((name) => {
    if (!used.has(name)) {
      used.add(name)
      return name
    }
    let n = 1
    let candidate = `${name}(${n})`
    while (used.has(candidate)) {
      n++
      candidate = `${name}(${n})`
    }
    used.add(candidate)
    return candidate
  })
}

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

/**
 * 把 resolveValue 的结果转成 exceljs 的 CellValue。
 *
 * resolveValue 返回 unknown（数据来自用户表格，类型不可知），而
 * ExcelJS.Cell.value 只接受 string/number/boolean/Date/null 等，
 * 直接赋值过不了类型检查——此处显式收窄，非标量统一转字符串。
 */
function toCellValue(v: unknown): ExcelJS.CellValue {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  if (v instanceof Date) return v
  return String(v)
}

function resolveValue(
  key: string,
  rowData: Record<string, unknown>,
  index: number,
  dataList: Record<string, unknown>[],
): unknown {
  let v: unknown = undefined

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

  if (typeof v === 'number') return v

  if (typeof v === 'string') {
    const trimmed = v.trim()
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
    const serial = dateStringToSerial(trimmed)
    if (serial !== null) return serial
  }

  return v
}

export function useTemplateExport(format: ExportFormat) {
  const dataFileInputRef = ref<HTMLInputElement | null>(null)
  const templateFileInputRef = ref<HTMLInputElement | null>(null)

  const dataFileName = ref('')
  const templateFileName = ref('')
  const dataRowCount = ref(0)
  const detectedFields = ref<string[]>([])
  /** 忽略前 N 行；0 表示不忽略。默认 0 而不是 1（审计 P1-5） */
  const skipRows = ref(0)
  const rawDataList = shallowRef<Record<string, unknown>[]>([])

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

  async function downloadTemplate(dwnFormat: 'csv' | 'xlsx') {
    const templateData = [
      { name: '张三', age: 25, city: '北京' },
      { name: '李四', age: 30, city: '上海' },
    ]

    if (dwnFormat === 'csv') {
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
      let data: Record<string, unknown>[] = []

      // 扩展名判断必须忽略大小写，否则 DATA.CSV / DATA.XLSX 会两个分支都不匹配，
      // 导致 data 保持 [] 且不报错，界面表现为「什么都没发生」（见审计 P1-11）
      const lowerName = file.name.toLowerCase()

      if (lowerName.endsWith('.csv')) {
        const text = await file.text()
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
        data = parsed.data as Record<string, unknown>[]
        // 畸形 CSV（参差行、未闭合引号）此前从不检查 errors，静默产出半截数据
        if (parsed.errors.length > 0) {
          logger.warn('CSV 解析存在问题（已尽量恢复）:', parsed.errors.slice(0, 5))
        }
      } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, {
          type: 'array',
          cellFormula: false,
          cellHTML: false,
          cellDates: format === 'docx',
        })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
          throw new Error('Excel 文件中没有工作表')
        }
        const firstSheet = workbook.Sheets[sheetName] as XLSX.WorkSheet
        data = XLSX.utils.sheet_to_json(firstSheet, { raw: true }) as Record<string, unknown>[]
        if (format === 'docx') {
          data = convertDatesInData(data)
        }
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
    skipRows.value = normalizeSkipRows(value)
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

  /**
   * 忽略前 N 行后剩余的数据行。
   *
   * 历史 Bug（审计 P1-5）：旧代码是 `rawDataList.slice(skipRows - 1)`，
   * 而 UI 文案写「忽略前 N 行（默认1行）」——两个语义错开一位：
   * skipRows=1 时 slice(0) 等于一行不忽略，用户按提示填 1 结果什么都没跳，
   * 填 2 才真正忽略 1 行。
   *
   * 现在统一为「忽略 N 行」，且允许 0（不忽略），默认 0。
   */
  const actualDataList = computed(() => {
    return rawDataList.value.slice(skipRows.value)
  })

  const previewFilenames = computed(() => {
    if (actualDataList.value.length === 0) return [] as string[]
    return actualDataList.value
      .slice(0, 3)
      .map((row, i) => generateFilename(row, filenameTemplate.value, i))
  })

  const duplicateWarnings = computed(() => {
    if (actualDataList.value.length === 0 || !filenameTemplate.value)
      return [] as { name: string; count: number }[]
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

  async function handleRenderDocx() {
    if (!templateContent.value || dataRowCount.value === 0) return

    const dataList = actualDataList.value
    const rawNames = dataList.map((row, i) => generateFilename(row, filenameTemplate.value, i))
    const finalNames = resolveDuplicates(rawNames, duplicateStrategy.value)

    renderResults.value = []

    for (let i = 0; i < dataList.length; i++) {
      const rowData = dataList[i]
      const zip = new PizZip(templateContent.value!)
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
  }

  async function handleRenderXlsx() {
    if (!templateContent.value || dataRowCount.value === 0) return

    const dataList = actualDataList.value
    const rawNames = dataList.map((row, i) => generateFilename(row, filenameTemplate.value, i))
    const finalNames = resolveDuplicates(rawNames, duplicateStrategy.value)

    renderResults.value = []

    // ExcelJS 是重库（约 700KB+），按需动态加载，避免进入首屏 bundle。
    // 注意：必须使用包的真实导入，window.ExcelJS 从未被赋值（见审计 P0-1）。
    const { Workbook } = await import('exceljs')

    for (let i = 0; i < dataList.length; i++) {
      const rowData = dataList[i]

      const workbook = new Workbook()
      await workbook.xlsx.load(templateContent.value!)
      const worksheet = workbook.getWorksheet(1)
      if (!worksheet) throw new Error('模板中没有工作表')

      worksheet.eachRow((row: ExcelJS.Row) => {
        row.eachCell((cell: ExcelJS.Cell) => {
          const val = cell.value
          if (typeof val !== 'string') return

          const origNumFmt = cell.numFmt
          const singleKeyMatch = val.match(/^\{([^}]+)\}$/)

          if (singleKeyMatch) {
            const v = resolveValue(singleKeyMatch[1]!, rowData!, i, dataList)
            if (v !== '' && v !== undefined && v !== null) {
              cell.value = toCellValue(v)
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
  }

  async function handleRender() {
    if (!templateContent.value || dataRowCount.value === 0) return

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

      await new Promise((resolve) => setTimeout(resolve, 100))
      progress.value = 30
      progressText.value = `正在渲染文档 (1/${dataList.length})...`

      if (format === 'docx') {
        await handleRenderDocx()
      } else {
        await handleRenderXlsx()
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
    skipRows.value = 0

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
    actualDataList,
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
