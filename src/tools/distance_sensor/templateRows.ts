/**
 * 距离测算模板的「行 + 表头」统一整形
 *
 * 历史 Bug（审计 C1 / P1-6）：异站址模板是 6 列（名称1/经度1/纬度1/名称2/经度2/纬度2）。
 * 若**第一条数据**的 data2 三个单元格为空，XLSX 默认的 `sheet_to_json(ws)`
 * （对象模式）不会给空单元格建 key，于是第一行只有 3 个 key → 列数被数成 3
 * → 整个文件被误判为「同站址」模式 → 之后每行都报「名称不能为空」。
 * 用户看到的是误导性错误，而文件其实是合法的。
 *
 * 修法（与 `utils/TemplateReader.ts` 的 `rawData + headerIndexMap` 一致）：
 * 列数与列名一律从**表头行**推断，绝不用数据行的 key 数量推断。
 * 本模块把 `sheet_to_json(ws, { header: 1 })` 的二维数组整成行对象，
 * 保证每一行都带齐全部表头 key（空单元格补 ''），XLSX 与 CSV 行为一致。
 */

/** 表头为空时的占位 key（保持列序，不会让某列凭空消失） */
function normalizeHeader(cell: unknown): string {
  return String(cell ?? '').trim()
}

/** 整行皆空 → 认为是没有内容的行，跳过（与 XLSX 对象模式跳空行的行为一致） */
function isBlankRow(raw: readonly unknown[] | undefined): boolean {
  if (!raw) return true
  return raw.every((v) => v === undefined || v === null || String(v).trim() === '')
}

/**
 * `sheet_to_json(ws, { header: 1 })` 的二维数组 → { columns, rows }
 *
 * @param aoa 二维数组，第 0 行是表头
 */
export function aoaToTemplateRows(aoa: readonly unknown[][]): {
  columns: string[]
  rows: Record<string, string | number>[]
} {
  const headerRow = aoa[0] ?? []
  const columns = headerRow.map(normalizeHeader)

  const rows: Record<string, string | number>[] = []
  for (const raw of aoa.slice(1)) {
    if (isBlankRow(raw)) continue

    const row: Record<string, string | number> = {}
    headerRow.forEach((header, index) => {
      // 空单元格也补 ''，保证每行 key 集合与表头完全一致
      row[normalizeHeader(header)] = (raw?.[index] ?? '') as string | number
    })
    rows.push(row)
  }

  return { columns, rows }
}

/** CSV 行对象 → 表头列名（`parseCSV` 已保证每行带齐全部表头 key） */
export function columnsFromRows(rows: readonly Record<string, string | number>[]): string[] {
  return Object.keys(rows[0] ?? {}).map((c) => c.trim())
}
