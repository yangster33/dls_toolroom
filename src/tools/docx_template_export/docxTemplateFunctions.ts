/**
 * docx 模板导出 - 纯函数模块
 * 从 useDocxTemplateExport.ts 抽离，便于单元测试
 */
import expressions from 'angular-expressions'

// ========== 基础转换 ==========

export function ensureString(input: unknown): string {
  if (input === null || input === undefined) return ''
  return String(input)
}

export function ensureNumber(input: unknown): number {
  const n = Number(input)
  return isNaN(n) ? 0 : n
}

// ========== Angular 过滤器（注册到 angular-expressions） ==========

export function upperFilter(input: unknown): string {
  return ensureString(input).toUpperCase()
}

export function lowerFilter(input: unknown): string {
  return ensureString(input).toLowerCase()
}

export function capitalizeFilter(input: unknown): string {
  const str = ensureString(input)
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function numberFilter(input: unknown, decimals: unknown): string {
  const n = ensureNumber(input)
  const d = ensureNumber(decimals)
  return n.toFixed(d)
}

export function currencyFilter(input: unknown, symbol?: unknown): string {
  const n = ensureNumber(input)
  const s = symbol != null ? String(symbol) : '¥'
  return s + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function percentFilter(input: unknown, decimals?: unknown): string {
  const n = ensureNumber(input) * 100
  const d = decimals != null ? ensureNumber(decimals) : 0
  return n.toFixed(d) + '%'
}

export function dateFilter(input: unknown, format?: unknown): string {
  if (input === null || input === undefined) return ''
  const fmt = format != null ? String(format) : 'yyyy-mm-dd'
  let d: Date
  if (input instanceof Date) {
    d = input
  } else {
    d = new Date(input as string | number)
    if (isNaN(d.getTime())) return ensureString(input) // 无法解析则返回原样
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

export function defaultFilter(input: unknown, fallback?: unknown): unknown {
  if (input === null || input === undefined || input === '') {
    return fallback != null ? fallback : ''
  }
  return input
}

export function truncateFilter(input: unknown, length?: unknown): string {
  const str = ensureString(input)
  const len = ensureNumber(length) || 10
  return str.length > len ? str.substring(0, len) + '...' : str
}

export function trimFilter(input: unknown): string {
  return ensureString(input).trim()
}

export function splitFilter(input: unknown, delimiter?: unknown, index?: unknown): string {
  const str = ensureString(input)
  const delim = delimiter != null ? String(delimiter) : ' '
  const i = ensureNumber(index)
  const parts = str.split(delim)
  return parts[i] !== undefined ? parts[i] : ''
}

// ========== 过滤器注册（模块加载时生效） ==========

expressions.filters.upper = upperFilter
expressions.filters.lower = lowerFilter
expressions.filters.capitalize = capitalizeFilter
expressions.filters.number = numberFilter
expressions.filters.currency = currencyFilter
expressions.filters.percent = percentFilter
expressions.filters.date = dateFilter
expressions.filters.default = defaultFilter
expressions.filters.truncate = truncateFilter
expressions.filters.trim = trimFilter
expressions.filters.split = splitFilter

// ========== 日期值转换 ==========

export function convertDateValue(value: unknown): unknown {
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

export function convertDatesInData(
  data: Record<string, unknown>[],
): Record<string, unknown>[] {
  return data.map((row) => {
    const convertedRow: Record<string, unknown> = {}
    for (const key in row) {
      convertedRow[key] = convertDateValue(row[key])
    }
    return convertedRow
  })
}

// ========== 文件名工具函数 ==========

export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || '未命名'
}

export function validateFilenameTemplate(
  template: string,
): { valid: boolean; error?: string } {
  let depth = 0
  for (const ch of template) {
    if (ch === '{') depth++
    if (ch === '}') depth--
    if (depth < 0) return { valid: false, error: '多余的 } 右花括号' }
  }
  if (depth > 0) return { valid: false, error: '花括号未闭合，缺少 }' }
  if (depth < 0) return { valid: false, error: '花括号不匹配' }

  const re = /\{([^}]+)\}/g
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

export function resolveDuplicates(
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