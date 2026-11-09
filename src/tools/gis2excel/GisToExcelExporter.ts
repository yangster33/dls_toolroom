import type { GisFeature } from './GisFileReader'
import { maxOf } from '@/utils/arrayUtils'
import { yieldToUI } from '@/utils/yieldToUI'
import { autoBorder, writeXlsx, type SheetSpec } from '@/utils/exceljsPipeline'
import type { ProgressCallback } from '@/utils/progress'

/**
 * 把一组同类型要素转成 `SheetSpec`（表名 / 表头 / 数据行 / 列宽 / 边框）。
 *
 * C4 阶段 3：xlsx 生成已迁到 `@/utils/exceljsPipeline`（exceljs 逐行写入 + 分片让出），
 * 本文件不再直接依赖 xlsx 库。旧路径是 `aoa_to_sheet(全量二维数组)` + `XLSX.write`：
 * 两步都是一次性、不可中断的同步块，5 万行能把主线程卡死数秒。
 *
 * 列宽的 min 阈值 8 / 30 / 20 是旧实现逐列钉住的（`maxOf(该列所有值的长度, 8|30|20)`），
 * 直接搬过来 —— 迁移只换生成引擎，不改产物尺寸。
 *
 * `border: true` 是为「有内容的单元格加细边框」。旧 xlsx 实现里这段其实是死代码
 * （xlsx@0.18.5 会把单元格样式整体丢弃，见 `utils/__tests__/exceljsPipeline.spec.ts`
 * 顶部说明），exceljs 管线是第一次让边框真正落盘。
 */
function toSheetSpec(
  features: GisFeature[],
  type: 'Point' | 'LineString' | 'Polygon',
  options: ExportOptions,
): SheetSpec {
  const headers = ['名称', '经纬度', '路径']
  const rows: string[][] = features.map((feature) => [
    feature.name,
    formatCoordinates(feature.coordinates, type, options),
    feature.path,
  ])

  // 旧实现的列宽是拿**含表头**的二维数组算的（worksheetData = [headers, ...rows]）
  const worksheetData = [headers, ...rows]

  return {
    name: getSheetName(type),
    headers,
    rows,
    colWidths: [
      maxOf(
        worksheetData.map((row) => String(row[0]).length),
        8,
      ),
      maxOf(
        worksheetData.map((row) => String(row[1]).length),
        30,
      ),
      maxOf(
        worksheetData.map((row) => String(row[2]).length),
        20,
      ),
    ],
    // F2：小/中表默认带边框；超过阈值自动关闭，避免 5 万行级别导出 +50% 耗时。
    border: autoBorder(features.length),
  }
}

/**
 * 分文件下载之间的让出间隔。
 *
 * 历史代码这里是 `setTimeout(() => {}, 200)` —— **未 await、空回调、在 forEach 里**，
 * 是一个"看起来让出了其实完全没有"的伪 yield（审计缺陷 A）。留着一个骗人的 yield
 * 比没有更糟：后人会以为这里已经让出过了。
 * 现在改为真正 await：既保留 200ms 的下载间隔意图（浏览器对连续程序化下载可能丢包），
 * 又真的把控制权交还主线程。
 */
const DOWNLOAD_YIELD_MS = 200

export interface ExportOptions {
  lonLatSeparator: string
  coordSeparator: string
  polygonLonLatSeparator: string
  polygonCoordSeparator: string
  closePolygon: boolean
}

export function formatCoordinates(
  coordinates: string,
  type: 'Point' | 'LineString' | 'Polygon',
  options: ExportOptions,
): string {
  if (type === 'Point') {
    const [lon, lat] = coordinates.split(',')
    return `${lon}${options.lonLatSeparator}${lat}`
  }

  const separator = type === 'Polygon' ? options.polygonCoordSeparator : options.coordSeparator
  const lonLatSep = type === 'Polygon' ? options.polygonLonLatSeparator : options.lonLatSeparator

  const coordPairs = coordinates.split(';')
  const formattedPairs = coordPairs.map((pair) => {
    const [lon, lat] = pair.split(',')
    return `${lon}${lonLatSep}${lat}`
  })

  if (type === 'Polygon' && options.closePolygon && coordPairs.length > 0) {
    const firstPair = coordPairs[0]
    const lastPair = coordPairs[coordPairs.length - 1]
    if (firstPair !== lastPair && formattedPairs[0] !== undefined) {
      formattedPairs.push(formattedPairs[0])
    }
  }

  return formattedPairs.join(separator)
}

function getSheetName(type: 'Point' | 'LineString' | 'Polygon'): string {
  switch (type) {
    case 'Point':
      return '点'
    case 'LineString':
      return '线'
    case 'Polygon':
      return '面'
    default:
      return '要素'
  }
}

function getTypeName(type: 'Point' | 'LineString' | 'Polygon'): string {
  switch (type) {
    case 'Point':
      return '点'
    case 'LineString':
      return '线'
    case 'Polygon':
      return '面'
    default:
      return '要素'
  }
}

function generateCsv(headers: string[], dataRows: string[][]): Blob {
  const rows: string[][] = [headers, ...dataRows]
  const csvLines = rows.map((row) =>
    row
      .map((cell) => {
        const cellStr = String(cell)
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`
        }
        return cellStr
      })
      .join(','),
  )

  const bom = new Uint8Array([0xef, 0xbb, 0xbf])
  const csvContent = new TextEncoder().encode(csvLines.join('\n'))

  const result = new Uint8Array(bom.length + csvContent.length)
  result.set(bom, 0)
  result.set(csvContent, bom.length)

  return new Blob([result], { type: 'text/csv;charset=UTF-8' })
}

function triggerDownload(content: string | Blob, filename: string, type: 'csv' | 'xlsx'): void {
  let blob: Blob
  let fullFilename = filename

  if (!fullFilename.toLowerCase().endsWith(`.${type}`)) {
    fullFilename += `.${type}`
  }

  if (typeof content === 'string') {
    blob = new Blob([content], { type: 'text/csv;charset=UTF-8;' })
  } else {
    blob = content
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fullFilename)
  document.body.appendChild(link)
  link.click()

  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 100)
}

/**
 * 导出为单个文件（一个类型一个 sheet）。
 *
 * @param onProgress 进度回调（C4 收尾，可选；不传则行为不变）。仅 xlsx 路径有
 *   进度（exceljs 逐行写入阶段），CSV 是同步拼装、无从上报。
 */
export async function exportToExcel(
  groupedFeatures: GisFeature[][],
  format: 'xlsx' | 'csv',
  options: ExportOptions,
  onProgress?: ProgressCallback,
): Promise<void> {
  if (format === 'xlsx') {
    await exportToXlsx(groupedFeatures, options, onProgress)
  } else {
    // CSV 是同步拼装（字符串 join + Blob），没有可上报的阶段；不伪造进度
    exportToCsv(groupedFeatures, options)
  }
}

/**
 * 分文件导出（一组一个文件）。
 *
 * @param onProgress 进度回调（C4 收尾，可选；不传则行为不变）。进度按组均分后
 *   下发，否则第二组会从 0% 重新开始、进度条倒退。CSV 路径无进度。
 */
export async function exportSeparateFiles(
  groupedFeatures: GisFeature[][],
  format: 'xlsx' | 'csv',
  options: ExportOptions,
  onProgress?: ProgressCallback,
): Promise<void> {
  // 分文件下载：一组一份文件。进度按组均分后下发 —— 直接透传会让第二组
  // 从 0% 重新开始，进度条倒退。
  const total = Math.max(groupedFeatures.length, 1)

  for (const [groupIndex, features] of groupedFeatures.entries()) {
    // 组与组之间让出主线程（第一组除外：它仍发生在点击的同一个任务里，
    // 保留用户手势上下文，Safari 对"跨任务边界才触发的下载"历史上会拦截）。
    if (groupIndex > 0) {
      await yieldToUI(DOWNLOAD_YIELD_MS)
    }

    if (features.length === 0 || !features[0]) continue

    const type = features[0].type
    const typeName = getTypeName(type)
    const filename = `gis_${typeName}`

    if (format === 'xlsx') {
      const base = Math.round((groupIndex / total) * 100)
      await exportSingleTypeToXlsx(features, type, filename, options, (percent, message) =>
        onProgress?.(Math.round(base + percent / total), message),
      )
    } else {
      // CSV 是同步拼装，无可上报阶段（同上，不伪造进度）
      exportSingleTypeToCsv(features, type, filename, options)
    }
  }
}

async function exportToXlsx(
  groupedFeatures: GisFeature[][],
  options: ExportOptions,
  onProgress?: ProgressCallback,
): Promise<void> {
  // 先让出一帧：调用方（点击处理函数）可以先重绘"转换中"状态，再跑重活
  await yieldToUI(0)

  // 一个类型一个 sheet（旧实现同样是逐组 append sheet）；空组整组跳过
  const sheets: SheetSpec[] = []
  for (const features of groupedFeatures) {
    if (features.length === 0 || !features[0]) continue
    sheets.push(toSheetSpec(features, features[0].type, options))
  }

  const blob = await writeXlsx(sheets, onProgress)

  triggerDownload(blob, 'gis_export', 'xlsx')
}

function exportToCsv(groupedFeatures: GisFeature[][], options: ExportOptions): void {
  const parts: Uint8Array[] = []
  const encoder = new TextEncoder()

  parts.push(new Uint8Array([0xef, 0xbb, 0xbf]))

  groupedFeatures.forEach((features, index) => {
    if (features.length === 0 || !features[0]) return

    const type = features[0].type
    const sheetName = getSheetName(type)

    if (index > 0) {
      parts.push(encoder.encode('\n'))
    }

    parts.push(encoder.encode(`[${sheetName}]\n`))

    const headers = ['名称', '经纬度', '路径']
    const dataRows: string[][] = features.map((feature) => [
      feature.name,
      formatCoordinates(feature.coordinates, type, options),
      feature.path,
    ])

    const rows: string[][] = [headers, ...dataRows]
    const csvLines = rows.map((row) =>
      row
        .map((cell) => {
          const cellStr = String(cell)
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`
          }
          return cellStr
        })
        .join(','),
    )

    parts.push(encoder.encode(csvLines.join('\n')))
    parts.push(encoder.encode('\n'))
  })

  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  parts.forEach((part) => {
    result.set(part, offset)
    offset += part.length
  })

  const blob = new Blob([result], { type: 'text/csv;charset=UTF-8' })
  triggerDownload(blob, 'gis_export', 'csv')
}

async function exportSingleTypeToXlsx(
  features: GisFeature[],
  type: 'Point' | 'LineString' | 'Polygon',
  filename: string,
  options: ExportOptions,
  onProgress?: ProgressCallback,
): Promise<void> {
  // 先让出一帧：分文件下载时，每份之间页面可交互
  await yieldToUI(0)

  // 单 sheet（旧实现同样只 append 一个 worksheet）
  const blob = await writeXlsx([toSheetSpec(features, type, options)], onProgress)

  triggerDownload(blob, filename, 'xlsx')
}

function exportSingleTypeToCsv(
  features: GisFeature[],
  type: 'Point' | 'LineString' | 'Polygon',
  filename: string,
  options: ExportOptions,
): void {
  const headers = ['名称', '经纬度', '路径']
  const dataRows: string[][] = features.map((feature) => [
    feature.name,
    formatCoordinates(feature.coordinates, type, options),
    feature.path,
  ])

  const csvContent = generateCsv(headers, dataRows)
  triggerDownload(csvContent, filename, 'csv')
}
