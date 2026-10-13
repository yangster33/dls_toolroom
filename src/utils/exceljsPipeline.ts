/**
 * 统一的 xlsx 生成管线（C4 阶段 3 / P2-20）
 *
 * **为什么要替换 xlsx（SheetJS）**
 * 旧路径是 `aoa_to_sheet(全量二维数组)` + `XLSX.write`：两步都是**一次性、不可中断**
 * 的同步块，5 万行能把主线程卡死数秒。exceljs 支持逐行 `addRow`，于是可以在
 * 「拼工作表」阶段就分批让出主线程，把最长连续阻塞砍到一次 `writeBuffer`。
 *
 * **与计划的偏离（必须记录）**：计划写的是「exceljs streaming writer（逐行 addRow + commit）」。
 * 实测 exceljs@4.4.0 的**浏览器 bundle 不含 streaming writer** —— `package.json` 的
 * `browser` 字段指向 `dist/exceljs.min.js`（约 947 KB），其中没有 `WorkbookWriter`
 * （Node 的 `lib/stream/xlsx/workbook-writer.js` 才在 `lib/` 下，不打包进 browser 产物）。
 * 因此这里用非流式 `Workbook` + 逐行 `addRow` 分段让出 + `xlsx.writeBuffer()`。
 * `useTemplateExport.ts` 早已验证过这条路径可用（动态 import + writeBuffer）。
 *
 * **导出产物必须与旧实现逐格一致**：列宽、边框、sheet 名、空值处理的一致性由
 * `src/utils/__tests__/exceljsPipeline.spec.ts` 的产物比对断言守护。
 */
import type { ProgressCallback } from './progress'
import type { CellValue as ExcelCellValue } from 'exceljs'
import { yieldToUI } from './yieldToUI'

/** addRow 的让出粒度：exceljs 单行成本高于字符串拼接，粒度取 2000 行 */
const ROW_YIELD_INTERVAL = 2000

/** exceljs 单格处理较轻，边框遍历按「每 200 行让出一次」 */
const BORDER_ROW_YIELD_INTERVAL = 200

/**
 * exceljs 写出的列宽比传入值**固定小 0.83**（实测 8→7.17、10→9.17、12.5→11.67），
 * 这是它对默认字号做的 padding。迁移目标是「产物与旧实现逐格一致」，
 * 因此这里显式补偿，并由 `exceljsPipeline.spec.ts` 的列宽断言钉住 ——
 * 将来 exceljs 改变该偏移时测试会红，而不是静默变形。
 */
const EXCELJS_WIDTH_OFFSET = 0.83

/** 与旧 xlsx 实现一致的细边框（黑） */
const BORDER_STYLE = { style: 'thin' as const, color: { argb: 'FF000000' } }
const CELL_BORDER = {
  top: BORDER_STYLE,
  bottom: BORDER_STYLE,
  left: BORDER_STYLE,
  right: BORDER_STYLE,
}

export interface SheetSpec {
  /** 工作表名 */
  name: string
  /** 表头（会作为第一行写入） */
  headers: string[]
  /** 数据行；省略表示只有表头 */
  rows?: readonly unknown[][]
  /** 每列宽度（字符宽）；省略时用 `Math.max(表头长度, 10)`，与旧实现一致 */
  colWidths?: readonly number[]
  /** 是否给「有内容」的单元格加细边框（旧 xlsx 实现的行为）。默认 false */
  border?: boolean
  /**
   * 是否写**默认**列宽（`Math.max(表头长度, 10)`）。
   * 旧实现里 `json_to_sheet` 路径（空间分析导出）**完全不设列宽**，
   * 为保持产物一致这里给一个 `false` 的开关。默认 true。
   */
  defaultColWidths?: boolean
}

/**
 * xlsx 的 `book_append_sheet` 不校验表名，exceljs 会直接抛错。
 * 这里按 OOXML 规则清洗，避免工具内部某天引入非法字符就从「能出文件」变成「抛异常」。
 */
export function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, '_').trim()
  return (cleaned || 'Sheet1').slice(0, 31)
}

/**
 * `json_to_sheet` 的等价表头收集：按**首次出现顺序**取所有 key 的并集。
 * （对象数组 → 二维数组，undefined 归一成 '' 以保持列数恒定。）
 */
export function collectHeaders(objs: readonly Record<string, unknown>[]): string[] {
  const headers: string[] = []
  for (const obj of objs) {
    for (const key of Object.keys(obj)) {
      if (!headers.includes(key)) headers.push(key)
    }
  }
  return headers
}

export function rowsFromObjects(
  objs: readonly Record<string, unknown>[],
  headers: readonly string[],
): unknown[][] {
  return objs.map((obj) => headers.map((header) => (obj[header] === undefined ? '' : obj[header])))
}

/**
 * 生成 xlsx Blob（exceljs）。
 *
 * @param sheets 一个或多个工作表（按顺序）
 * @param onProgress 进度回调（可选，不传则行为不变）
 */
export async function writeXlsx(
  sheets: readonly SheetSpec[],
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()

  const total = Math.max(sheets.length, 1)
  let processedRows = 0
  const rowTotal = sheets.reduce((sum, sheet) => sum + (sheet.rows?.length ?? 0) + 1, 0)

  const report = (base: number, span: number) => {
    const percent = rowTotal > 0 ? base + Math.round((processedRows / rowTotal) * span) : base
    onProgress?.(Math.min(99, percent), '正在写入工作表数据...')
  }

  for (const [index, spec] of sheets.entries()) {
    const sheetBase = Math.round((index / total) * 90)
    onProgress?.(sheetBase, `正在生成工作表 ${spec.name}...`)
    await yieldToUI()

    const worksheet = workbook.addWorksheet(safeSheetName(spec.name))
    const widthSpec = spec.colWidths ?? spec.headers.map((h) => Math.max(String(h).length, 10))
    if (spec.defaultColWidths !== false) {
      worksheet.columns = widthSpec.map((wch) => ({ width: wch + EXCELJS_WIDTH_OFFSET }))
    }
    if (spec.headers.length > 0) {
      worksheet.addRow(spec.headers)
    }
    processedRows++

    const rows = spec.rows ?? []
    for (let i = 0; i < rows.length; i++) {
      // 让出放在循环**开头**：配合下面的进度上报，二者都不应被任何分支跳过
      if (i % ROW_YIELD_INTERVAL === 0) {
        await yieldToUI()
      }
      worksheet.addRow(rows[i] as unknown as ExcelCellValue[])
      processedRows++
      if (i % ROW_YIELD_INTERVAL === 0) {
        report(sheetBase, Math.round(90 / total))
      }
    }

    if (spec.border) {
      // 注意：exceljs 的 eachRow/eachCell 只接受同步回调，无法在其中 await ——
      // 那会比"没有让出"更糟（看着像让出了）。这里改用手动行迭代。
      const rows = worksheet.getRows(1, worksheet.rowCount) ?? []
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r]
        if (!row) continue

        // v4 没有 row.cells（内部是 _cells），公开 API 是 cellCount + getCell
        const cellCount = row.cellCount
        for (let c = 1; c <= cellCount; c++) {
          const cell = row.getCell(c)
          const value = cell.value
          const hasContent = value !== null && value !== undefined && String(value).trim() !== ''
          if (hasContent) {
            cell.border = CELL_BORDER
          }
        }

        if (r % BORDER_ROW_YIELD_INTERVAL === 0) {
          await yieldToUI()
        }
      }
    }
  }

  // writeBuffer 仍是单一同步块（exceljs 无浏览器流式写入），先画出 95% 再跑
  onProgress?.(95, '正在生成文件...')
  await yieldToUI()

  const buffer = await workbook.xlsx.writeBuffer()
  onProgress?.(100, '生成完成')

  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
