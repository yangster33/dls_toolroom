/**
 * xlsx 模板导出 - 纯函数模块
 * 从 useXlsxTemplateExport.ts 抽离，便于单元测试
 */

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

// Excel 序列号转换：日期字符串 → 数字
export function dateStringToSerial(trimmed: string): number | null {
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

export function resolveValue(
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