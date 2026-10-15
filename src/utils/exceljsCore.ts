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
import { downloadBlob } from './download'

/** addRow 的让出粒度：exceljs 单行成本高于字符串拼接，粒度取 2000 行 */
const ROW_YIELD_INTERVAL = 2000

/** exceljs 单格处理较轻，边框遍历按「每 200 行让出一次」 */
const BORDER_ROW_YIELD_INTERVAL = 200

/**
 * exceljs 写出的列宽比传入值**固定小 5/6 ≈ 0.8333**（`col-xform.js` 原样写 width），
 * 而 SheetJS 写入侧是 `wch + 5/6`（`char2width`）。两者相减正好抵消：
 * 传 `wch + 5/6` 进去，读回的 `!cols.wch` 才正好等于我们要的 wch。
 * 实测：传 8.8333 → xml width=8.8333 → SheetJS 读回 8.0；旧近似值 0.83 会残留 0.002。
 * 由 `exceljsPipeline.spec.ts` 的列宽断言钉住（exceljs 改变该偏移时测试会红）。
 */
const EXCELJS_WIDTH_OFFSET = 5 / 6

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
 * 清洗工作表名，并保证同一工作簿内**不重名**。
 *
 * 为什么要清洗（评审纠正的错误认知，本函数旧注释写反了）：
 * - xlsx 的 `book_append_sheet` **会**校验表名：非法字符（`: \ / ? * [ ]`）、
 *   超过 31 字符、重名都会**直接抛错**（xlsx.js 的 check_ws_name）。
 * - exceljs 的 `addWorksheet` **不校验**任何一项：非法字符会静默写进 XML，
 *   超长静默截断，重名会写出两张同名表 —— 后者会让 Excel 弹"需要修复"并丢表。
 *
 * 因此把 exceljs 的宽松行为收敛成 xlsx 的**响亮失败**：重名直接抛错
 * （与旧行为一致），非法字符与超长按 OOXML 规则清洗。
 */
export function safeSheetName(name: string, used: Set<string> = new Set()): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, '_').trim() || 'Sheet1'
  const final = cleaned.slice(0, 31)

  if (used.has(final)) {
    throw new Error(`工作表名称重复或超长后重复：${final}（旧实现在此处同样会失败）`)
  }
  used.add(final)

  return final
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
 * 触发 xlsx 下载。
 *
 * 实现已收口到 `utils/download.ts`（appendChild + 延迟 revoke 的通用版），
 * 这里只保留 `.xlsx` 后缀补全这一件 xlsx 专属的事。
 *
 * 背景：仓库里原本有 3 份逐字节等价的 `triggerDownload`（`utils/TemplateExporter.ts`、
 * `gis2excel/GisToExcelExporter.ts`、以及旧 `geoDataService.exportToXLSX` 用的
 * `XLSX.writeFile` 内部那份）。
 *
 * 关键细节（评审 M2 修复）：`<a>` 必须**appendChild 进文档**（Firefox 历史上要求
 * 节点在文档内才会触发下载），且 `revokeObjectURL` 必须**延迟**执行 ——
 * 大文件的 Blob 在 click() 之后仍被浏览器读取，立即 revoke 会拿到空文件。
 */
export function downloadXlsxBlob(blob: Blob, filename: string): void {
  const fullFilename = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`
  downloadBlob(blob, fullFilename)
}

/**
 * 生成 xlsx Blob（exceljs）。
 *
 * @param sheets 一个或多个工作表（按顺序）
 * @param onProgress 进度回调（可选，不传则行为不变）
 */
export async function writeXlsxBlob(
  sheets: readonly SheetSpec[],
  onProgress?: ProgressCallback,
): Promise<Blob> {
  // exceljs 是 947 KB 的懒加载 chunk。先让出一帧再加载：否则进度弹窗要等
  // chunk 下载+eval 完才出现，用户看到的是"点了没反应"。
  await yieldToUI()
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()

  const total = Math.max(sheets.length, 1)
  let processedRows = 0
  let reportedPercent = 0
  const usedSheetNames = new Set<string>()
  const rowTotal = sheets.reduce((sum, sheet) => sum + (sheet.rows?.length ?? 0) + 1, 0)

  // 单调夹取：多 sheet 时「上一个 sheet 末尾」的进度会超过下一个 sheet 的起点，
  // 不夹会出现进度倒退（实测 46→45）。回调语义上进度不该倒退。
  const report = (percent: number, message: string) => {
    reportedPercent = Math.max(reportedPercent, Math.min(99, percent))
    onProgress?.(reportedPercent, message)
  }

  for (const [index, spec] of sheets.entries()) {
    const sheetBase = Math.round((index / total) * 90)
    report(sheetBase, `正在生成工作表 ${spec.name}...`)
    await yieldToUI()

    const worksheet = workbook.addWorksheet(safeSheetName(spec.name, usedSheetNames))
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
        report(
          sheetBase + Math.round((processedRows / rowTotal) * Math.round(90 / total)),
          '正在写入工作表数据...',
        )
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
