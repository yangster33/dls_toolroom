import * as XLSX from 'xlsx'
import type { GisFeature } from './GisFileReader'
import { maxOf } from '@/utils/arrayUtils'
import { yieldToUI } from '@/utils/yieldToUI'

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

export async function exportToExcel(
  groupedFeatures: GisFeature[][],
  format: 'xlsx' | 'csv',
  options: ExportOptions,
): Promise<void> {
  if (format === 'xlsx') {
    await exportToXlsx(groupedFeatures, options)
  } else {
    await exportToCsv(groupedFeatures, options)
  }
}

export async function exportSeparateFiles(
  groupedFeatures: GisFeature[][],
  format: 'xlsx' | 'csv',
  options: ExportOptions,
): Promise<void> {
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
      await exportSingleTypeToXlsx(features, type, filename, options)
    } else {
      exportSingleTypeToCsv(features, type, filename, options)
    }
  }
}

async function exportToXlsx(
  groupedFeatures: GisFeature[][],
  options: ExportOptions,
): Promise<void> {
  // 先让出一帧：调用方（点击处理函数）可以先重绘"转换中"状态，再跑重活
  await yieldToUI(0)

  const workbook = XLSX.utils.book_new()

  groupedFeatures.forEach((features) => {
    if (features.length === 0 || !features[0]) return

    const type = features[0].type
    const sheetName = getSheetName(type)

    const headers = ['名称', '经纬度', '路径']
    const dataRows: string[][] = features.map((feature) => [
      feature.name,
      formatCoordinates(feature.coordinates, type, options),
      feature.path,
    ])

    const worksheetData = [headers, ...dataRows]
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

    const colWidths = [
      {
        wch: maxOf(
          worksheetData.map((row) => String(row[0]).length),
          8,
        ),
      },
      {
        wch: maxOf(
          worksheetData.map((row) => String(row[1]).length),
          30,
        ),
      },
      {
        wch: maxOf(
          worksheetData.map((row) => String(row[2]).length),
          20,
        ),
      },
    ]
    worksheet['!cols'] = colWidths

    const borderStyle = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    }

    for (const key in worksheet) {
      if (key.startsWith('!')) continue
      const cell = worksheet[key]
      if (cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
        cell.s = cell.s || {}
        cell.s.border = borderStyle
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  })

  const wbout = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    bookSST: false,
  })

  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

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
): Promise<void> {
  // 先让出一帧：分文件下载时，每份之间页面可交互
  await yieldToUI(0)

  const workbook = XLSX.utils.book_new()

  const sheetName = getSheetName(type)

  const headers = ['名称', '经纬度', '路径']
  const dataRows: string[][] = features.map((feature) => [
    feature.name,
    formatCoordinates(feature.coordinates, type, options),
    feature.path,
  ])

  const worksheetData = [headers, ...dataRows]
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

  const colWidths = [
    {
      wch: maxOf(
        worksheetData.map((row) => String(row[0]).length),
        8,
      ),
    },
    {
      wch: maxOf(
        worksheetData.map((row) => String(row[1]).length),
        30,
      ),
    },
    {
      wch: maxOf(
        worksheetData.map((row) => String(row[2]).length),
        20,
      ),
    },
  ]
  worksheet['!cols'] = colWidths

  const borderStyle = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  }

  for (const key in worksheet) {
    if (key.startsWith('!')) continue
    const cell = worksheet[key]
    if (cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
      cell.s = cell.s || {}
      cell.s.border = borderStyle
    }
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const wbout = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    bookSST: false,
  })

  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

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
