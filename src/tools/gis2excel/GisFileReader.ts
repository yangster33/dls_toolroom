import JSZip from 'jszip'
import shp from 'shpjs'
import { logger } from '@/utils/logger'

export interface GisFeature {
  id: string
  type: 'Point' | 'LineString' | 'Polygon'
  name: string
  coordinates: string
  path: string
  properties: Record<string, unknown>
}

export interface GisValidationResult {
  isValid: boolean
  errors: string[]
  features: GisFeature[]
  totalFeatures: number
  pointCount: number
  lineCount: number
  polygonCount: number
}

function parseKmlXml(xmlString: string, basePath: string = ''): GisFeature[] {
  const features: GisFeature[] = []
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlString, 'application/xml')
  
  const documentElement = xmlDoc.documentElement
  
  function traverseElement(element: Element, currentPath: string) {
    if (element.tagName === 'Placemark') {
      const name = element.querySelector('name')?.textContent || `要素${features.length + 1}`
      
      const pointElement = element.querySelector('Point')
      const lineElement = element.querySelector('LineString')
      const polygonElement = element.querySelector('Polygon')
      
      let type: 'Point' | 'LineString' | 'Polygon' = 'Point'
      let coordinates: string = ''
      
      if (pointElement) {
        type = 'Point'
        const coordsText = pointElement.querySelector('coordinates')?.textContent || ''
        const coords = coordsText.trim().split(',')
        if (coords.length >= 2) {
          coordinates = `${coords[0]},${coords[1]}`
        }
      } else if (lineElement) {
        type = 'LineString'
        const coordsText = lineElement.querySelector('coordinates')?.textContent || ''
        const coordPairs = coordsText.trim().split(/\s+/).filter(s => s && s.includes(','))
        coordinates = coordPairs.join(';')
      } else if (polygonElement) {
        type = 'Polygon'
        const linearRing = polygonElement.querySelector('LinearRing')
        if (linearRing) {
          const coordsText = linearRing.querySelector('coordinates')?.textContent || ''
          const coordPairs = coordsText.trim().split(/\s+/).filter(s => s && s.includes(','))
          coordinates = coordPairs.join(';')
        }
      }
      
      const properties: Record<string, unknown> = {}
      const extendedData = element.querySelector('ExtendedData')
      if (extendedData) {
        const dataElements = extendedData.querySelectorAll('Data')
        dataElements.forEach(data => {
          const dataName = data.getAttribute('name')
          const value = data.querySelector('value')?.textContent
          if (dataName && value) {
            properties[dataName] = value
          }
        })
      }
      
      if (coordinates) {
        features.push({
          id: `feature_${features.length + 1}`,
          type,
          name,
          coordinates,
          path: currentPath,
          properties,
        })
      }
    } else if (element.tagName === 'Folder') {
      const folderName = element.querySelector('name')?.textContent || ''
      const newPath = folderName ? (currentPath ? `${currentPath}/${folderName}` : folderName) : currentPath
      
      for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i]
        if (child instanceof Element) {
          traverseElement(child, newPath)
        }
      }
    } else {
      for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i]
        if (child instanceof Element) {
          traverseElement(child, currentPath)
        }
      }
    }
  }
  
  if (documentElement) {
    traverseElement(documentElement, basePath)
  }
  
  return features
}

async function parseKmzFile(file: File): Promise<GisFeature[]> {
  const features: GisFeature[] = []
  const zip = await JSZip.loadAsync(file)
  
  for (const [filename, fileObject] of Object.entries(zip.files)) {
    if (!fileObject.dir && filename.toLowerCase().endsWith('.kml')) {
      const content = await fileObject.async('string')
      const path = filename.replace(/[^/]+$/, '').replace(/\/$/, '')
      const kmlFeatures = parseKmlXml(content, path)
      features.push(...kmlFeatures)
    }
  }
  
  return features
}

async function parseKmlFile(file: File): Promise<GisFeature[]> {
  const content = await file.text()
  return parseKmlXml(content, '')
}

export async function parseShpFile(file: File | File[]): Promise<GisFeature[]> {
  if (Array.isArray(file)) {
    // 多文件模式：分别找 .shp 和 .dbf
    const shpFile = file.find((f) => f.name.toLowerCase().endsWith('.shp'))
    const dbfFile = file.find((f) => f.name.toLowerCase().endsWith('.dbf'))
    if (!shpFile) throw new Error('未找到 .shp 文件')

    logger.log('[parseShpFile] 多文件模式:', file.map(f => f.name))
    logger.log('[parseShpFile] 找到 shp:', shpFile.name, 'dbf:', dbfFile?.name || '(无)')

    const shpBuf = await shpFile.arrayBuffer()
    const dbfBuf = dbfFile ? await dbfFile.arrayBuffer() : undefined
    const geojson = await shp({ shp: shpBuf, dbf: dbfBuf })
    const result = convertGeoJsonToFeatures(geojson)
    logger.log('[parseShpFile] 解析完成, 要素数:', result.length)
    if (result.length > 0) {
      logger.log('[parseShpFile] 第一条 properties keys:', Object.keys(result[0]!.properties))
    }
    return result
  }

  if (file.name.toLowerCase().endsWith('.zip')) {
    logger.log('[parseShpFile] zip 模式:', file.name)
    const buf = await file.arrayBuffer()
    const geojson = await shp(buf)
    const result = convertGeoJsonToFeatures(geojson)
    logger.log('[parseShpFile] 解析完成, 要素数:', result.length)
    if (result.length > 0) {
      logger.log('[parseShpFile] 第一条 properties keys:', Object.keys(result[0]!.properties))
    }
    return result
  }

  // 单个 .shp 文件（无 .dbf）
  logger.log('[parseShpFile] 单文件模式（无 dbf）:', file.name)
  const buf = await file.arrayBuffer()
  const geojson = await shp({ shp: buf })
  const result = convertGeoJsonToFeatures(geojson)
  logger.log('[parseShpFile] 解析完成, 要素数:', result.length)
  if (result.length > 0) {
    logger.log('[parseShpFile] 第一条 properties keys:', Object.keys(result[0]!.properties))
  }
  return result
}

function convertGeoJsonToFeatures(geojson: any): GisFeature[] {
  const collections: any[] = Array.isArray(geojson) ? geojson : [geojson]
  const features: GisFeature[] = []

  for (const col of collections) {
    const fc = col.features || (col.type === 'Feature' ? [col] : [])
    if (!Array.isArray(fc)) continue

    for (let i = 0; i < fc.length; i++) {
      const feat = fc[i]
      const geom = feat.geometry
      if (!geom) continue

      let type: 'Point' | 'LineString' | 'Polygon'
      let coordinates: string

      if (geom.type === 'Point' || geom.type === 'MultiPoint') {
        type = 'Point'
        const pt = geom.type === 'Point' ? geom.coordinates : geom.coordinates[0]
        coordinates = `${pt[0]},${pt[1]}`
      } else if (geom.type === 'LineString' || geom.type === 'MultiLineString') {
        type = 'LineString'
        const flatLines: number[][] = geom.type === 'LineString'
          ? geom.coordinates
          : (geom.coordinates as number[][][]).reduce<number[][]>((a, b) => a.concat(b), [])
        coordinates = flatLines.map((c: number[]) => `${c[0]},${c[1]}`).join(';')
      } else if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
        type = 'Polygon'
        const rings: number[][][] = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates[0]
        const outerRing = rings[0]
        coordinates = outerRing!.map((c: number[]) => `${c[0]},${c[1]}`).join(';')
      } else {
        continue
      }

      const props = feat.properties || {}
      const featId = features.length + 1
      const name = String(props.name || props.NAME || props.Name || `要素${featId}`)

      // 兜底：DBF 缺失时至少保留基本字段，避免 extractFieldsFromFeatures 返回空数组
      const fallbackProps: Record<string, unknown> = {
        _fid: featId,
        _type: type,
      }
      // 合并：DBF 真实字段优先，_fid/_type 为兜底
      const merged = { ...fallbackProps, ...props }

      features.push({
        id: `feature_${featId}`,
        type,
        name,
        coordinates,
        path: '',
        properties: merged,
      })
    }
  }

  return features
}

export async function readAndValidateGisFile(file: File): Promise<GisValidationResult> {
  const errors: string[] = []
  const features: GisFeature[] = []
  
  const fileName = file.name.toLowerCase()
  
  if (!fileName.endsWith('.shp') && !fileName.endsWith('.kml') && !fileName.endsWith('.kmz') && !fileName.endsWith('.zip')) {
    errors.push('不支持的文件格式，请上传SHP、KML、KMZ或ZIP文件')
    return {
      isValid: false,
      errors,
      features: [],
      totalFeatures: 0,
      pointCount: 0,
      lineCount: 0,
      polygonCount: 0,
    }
  }
  
  try {
    if (fileName.endsWith('.shp') || fileName.endsWith('.zip')) {
      const shpFeatures = await parseShpFile(file)
      features.push(...shpFeatures)
    } else if (fileName.endsWith('.kml')) {
      const kmlFeatures = await parseKmlFile(file)
      features.push(...kmlFeatures)
    } else if (fileName.endsWith('.kmz')) {
      const kmzFeatures = await parseKmzFile(file)
      features.push(...kmzFeatures)
    }
  } catch (err) {
    errors.push(`文件解析错误: ${err instanceof Error ? err.message : String(err)}`)
    return {
      isValid: false,
      errors,
      features: [],
      totalFeatures: 0,
      pointCount: 0,
      lineCount: 0,
      polygonCount: 0,
    }
  }
  
  if (features.length === 0) {
    errors.push('文件中未找到任何地理要素')
    return {
      isValid: false,
      errors,
      features: [],
      totalFeatures: 0,
      pointCount: 0,
      lineCount: 0,
      polygonCount: 0,
    }
  }
  
  const pointCount = features.filter(f => f.type === 'Point').length
  const lineCount = features.filter(f => f.type === 'LineString').length
  const polygonCount = features.filter(f => f.type === 'Polygon').length
  
  return {
    isValid: true,
    errors: [],
    features,
    totalFeatures: features.length,
    pointCount,
    lineCount,
    polygonCount,
  }
}
