/**
 * CSV 解析工具
 * 提供通用的 CSV 文件解析功能
 */

/**
 * 解析 CSV 行，处理引号和转义
 * @param line CSV 行字符串
 * @returns 解析后的字段数组
 */
export function parseCSVLine(line: string): string[] {
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

/**
 * 将 CSV 文本解析为对象数组
 * @param text CSV 文件内容
 * @param options 解析选项
 * @returns 解析后的对象数组
 */
export function parseCSV(
  text: string,
  options?: {
    skipEmptyLines?: boolean
    trimValues?: boolean
    convertNumbers?: boolean
  },
): Record<string, string | number>[] {
  const { skipEmptyLines = true, trimValues = true, convertNumbers = true } = options || {}

  // 去除 BOM 头
  const cleanText = text.replace(/^\uFEFF/, '')
  const lines = cleanText.trim().split('\n')

  if (lines.length < 2) return []

  const headerLine = lines[0]
  if (!headerLine) return []

  // 解析表头
  let headers = parseCSVLine(headerLine)
  if (trimValues) {
    headers = headers.map((h) => h.trim().replace(/^"|"$/g, ''))
  }

  const rows: Record<string, string | number>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!

    // 跳过空行
    if (skipEmptyLines && (!line || line.trim() === '')) {
      continue
    }

    const values = parseCSVLine(line)
    const row: Record<string, string | number> = {}

    headers.forEach((header, index) => {
      let value = values[index] || ''

      if (trimValues) {
        value = value.trim().replace(/^"|"$/g, '')
      }

      // 尝试转换为数字
      if (convertNumbers) {
        const numValue = Number(value)
        row[header] = isNaN(numValue) ? value : numValue
      } else {
        row[header] = value
      }
    })

    rows.push(row)
  }

  return rows
}
