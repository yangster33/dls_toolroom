import * as XLSX from 'xlsx'
import type { GisFeature } from './GisFileReader'

export interface ExportOptions {
  lonLatSeparator: string
  coordSeparator: string
  polygonLonLatSeparator: string
  polygonCoordSeparator: string
  closePolygon: boolean
}

function formatCoordinates(
  coordinates: string,
  type: 'Point' | 'LineString' | 'Polygon',
  options: ExportOptions
): string {
  if (type === 'Point') {
    const [lon, lat] = coordinates.split(',')
    return `${lon}${options.lonLatSeparator}${lat}`
  }
  
  const separator = type === 'Polygon' ? options.polygonCoordSeparator : options.coordSeparator
  const lonLatSep = type === 'Polygon' ? options.polygonLonLatSeparator : options.lonLatSeparator
  
  const coordPairs = coordinates.split(';')
  const formattedPairs = coordPairs.map(pair => {
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
  const csvLines = rows.map(row => 
    row.map(cell => {
      const cellStr = String(cell)
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`
      }
      return cellStr
    }).join(',')
  )
  
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
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

export function exportToExcel(
  groupedFeatures: GisFeature[][],
  format: 'xlsx' | 'csv',
  options: ExportOptions
): void {
  if (format === 'xlsx') {
    exportToXlsx(groupedFeatures, options)
  } else {
    exportToCsv(groupedFeatures, options)
  }
}

export function exportSeparateFiles(
  groupedFeatures: GisFeature[][],
  format: 'xlsx' | 'csv',
  options: ExportOptions
): void {
  groupedFeatures.forEach((features) => {
    if (features.length === 0 || !features[0]) return
    
    const type = features[0].type
    const typeName = getTypeName(type)
    const filename = `gis_${typeName}`
    
    if (format === 'xlsx') {
      exportSingleTypeToXlsx(features, type, filename, options)
    } else {
      exportSingleTypeToCsv(features, type, filename, options)
    }
    
    setTimeout(() => {}, 200)
  })
}

function exportToXlsx(groupedFeatures: GisFeature[][], options: ExportOptions): void {
  const workbook = XLSX.utils.book_new()
  
  groupedFeatures.forEach((features) => {
    if (features.length === 0 || !features[0]) return
    
    const type = features[0].type
    const sheetName = getSheetName(type)
    
    const headers = ['名称', '经纬度', '路径']
    const dataRows: string[][] = features.map(feature => [
      feature.name,
      formatCoordinates(feature.coordinates, type, options),
      feature.path,
    ])
    
    const worksheetData = [headers, ...dataRows]
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    
    const colWidths = [
      { wch: Math.max(...worksheetData.map(row => String(row[0]).length), 8) },
      { wch: Math.max(...worksheetData.map(row => String(row[1]).length), 30) },
      { wch: Math.max(...worksheetData.map(row => String(row[2]).length), 20) },
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
  
  parts.push(new Uint8Array([0xEF, 0xBB, 0xBF]))
  
  groupedFeatures.forEach((features, index) => {
    if (features.length === 0 || !features[0]) return
    
    const type = features[0].type
    const sheetName = getSheetName(type)
    
    if (index > 0) {
      parts.push(encoder.encode('\n'))
    }
    
    parts.push(encoder.encode(`[${sheetName}]\n`))
    
    const headers = ['名称', '经纬度', '路径']
    const dataRows: string[][] = features.map(feature => [
      feature.name,
      formatCoordinates(feature.coordinates, type, options),
      feature.path,
    ])
    
    const rows: string[][] = [headers, ...dataRows]
    const csvLines = rows.map(row => 
      row.map(cell => {
        const cellStr = String(cell)
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`
        }
        return cellStr
      }).join(',')
    )
    
    parts.push(encoder.encode(csvLines.join('\n')))
    parts.push(encoder.encode('\n'))
  })
  
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  parts.forEach(part => {
    result.set(part, offset)
    offset += part.length
  })
  
  const blob = new Blob([result], { type: 'text/csv;charset=UTF-8' })
  triggerDownload(blob, 'gis_export', 'csv')
}

function generateCsvNoBom(headers: string[], dataRows: string[][]): Blob {
  const rows: string[][] = [headers, ...dataRows]
  const csvLines = rows.map(row => 
    row.map(cell => {
      const cellStr = String(cell)
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`
      }
      return cellStr
    }).join(',')
  )
  
  const csvContent = new TextEncoder().encode(csvLines.join('\n'))
  return new Blob([csvContent], { type: 'text/csv;charset=UTF-8' })
}

function exportSingleTypeToXlsx(features: GisFeature[], type: 'Point' | 'LineString' | 'Polygon', filename: string, options: ExportOptions): void {
  const workbook = XLSX.utils.book_new()
  
  const sheetName = getSheetName(type)
  
  const headers = ['名称', '经纬度', '路径']
  const dataRows: string[][] = features.map(feature => [
    feature.name,
    formatCoordinates(feature.coordinates, type, options),
    feature.path,
  ])
  
  const worksheetData = [headers, ...dataRows]
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
  
  const colWidths = [
    { wch: Math.max(...worksheetData.map(row => String(row[0]).length), 8) },
    { wch: Math.max(...worksheetData.map(row => String(row[1]).length), 30) },
    { wch: Math.max(...worksheetData.map(row => String(row[2]).length), 20) },
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

function exportSingleTypeToCsv(features: GisFeature[], type: 'Point' | 'LineString' | 'Polygon', filename: string, options: ExportOptions): void {
  const headers = ['名称', '经纬度', '路径']
  const dataRows: string[][] = features.map(feature => [
    feature.name,
    formatCoordinates(feature.coordinates, type, options),
    feature.path,
  ])
  
  const csvContent = generateCsv(headers, dataRows)
  triggerDownload(csvContent, filename, 'csv')
}
