/**
 * 地址查询 / 经纬度查询共用的 CSV 解析。
 *
 * 从 GeocodeCommon.vue 抽出，保持原有语义：
 * - 支持双引号包裹与引号内的逗号；
 * - 去掉 BOM；
 * - 纯数字转 number，空字符串保持 ''（审计 P0-1：空白经纬度不能变成 0）。
 */

/** 解析一行 CSV，支持双引号包裹字段 */
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

/** 解析完整 CSV 文本为行对象数组 */
export function parseCSV(text: string): Record<string, string | number>[] {
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
      const value = (values[index] ?? '').trim().replace(/^"|"$/g, '')
      // 空字符串保持为空字符串，不能变成数字 0
      row[header] = /^[+-]?(\d+\.?\d*|\.\d+)$/.test(value) ? Number(value) : value
    })
    rows.push(row)
  }

  return rows
}
