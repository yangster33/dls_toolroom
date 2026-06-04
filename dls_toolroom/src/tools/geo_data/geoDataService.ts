import * as turf from '@turf/turf'
import toGeoJSON from 'togeojson'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'

// toGeoJSON 使用
const toGeoJson = toGeoJSON as unknown as { kml: (doc: Document) => GeoJSON.FeatureCollection }

export interface GeoFeature {
  id: string
  name: string
  type: 'Point' | 'LineString' | 'Polygon'
  coordinates: number[] | number[][] | number[][][]
  properties: Record<string, unknown>
  feature: GeoJSON.Feature
}

export interface PointFeature extends GeoFeature {
  type: 'Point'
  coordinates: number[]
}

export interface LineFeature extends GeoFeature {
  type: 'LineString'
  coordinates: number[][]
}

export interface PolygonFeature extends GeoFeature {
  type: 'Polygon'
  coordinates: number[][][]
}

export interface ParseResult {
  success: boolean
  features: GeoFeature[]
  errors: string[]
  totalPoints: number
  totalLines: number
  totalPolygons: number
}

export interface AnalysisType {
  id: string
  label: string
  description: string
  enabled: boolean
}

export interface AnalysisResult {
  type: string
  label: string
  data: Record<string, unknown>[]
  columns: string[]
}

export interface ProgressCallback {
  (progress: number, message: string): void
}

export interface PointAnalysisData {
  序号: number
  名称: string
  类型: string
  经度: number
  纬度: number
}

export interface LineAnalysisData {
  序号: number
  名称: string
  类型: string
  长度_km: string
  点数: number
  起点经度: number
  起点纬度: number
  终点经度: number
  终点纬度: number
}

export interface PolygonAnalysisData {
  序号: number
  名称: string
  类型: string
  面积_km2: string
  质心经度: number
  质心纬度: number
  顶点数: number
  是否有孔洞: string
}

export interface PointToPointData {
  点A名称: string
  点A经度: number
  点A纬度: number
  点B名称: string
  点B经度: number
  点B纬度: number
  距离_km: string
  方位角_度: string
  是否重合: string
}

export interface PointToLineData {
  点名称: string
  点经度: number
  点纬度: number
  线名称: string
  是否在线上: string
  到线距离_m: string
  最近点经度: number
  最近点纬度: number
}

export interface PointToPolygonData {
  点名称: string
  点经度: number
  点纬度: number
  面名称: string
  是否在面内: string
  是否在边界上: string
  到面距离_m: string
}

export interface LineToLineData {
  线A名称: string
  线A长度_km: string
  线B名称: string
  线B长度_km: string
  是否相交: string
  是否交叉: string
  是否平行: string
  是否相等: string
  是否重叠: string
  交点数量: number
}

export interface LineToPolygonData {
  线名称: string
  线长度_km: string
  面名称: string
  面面积_km2: string
  是否相交: string
  是否穿越: string
  线是否在面内: string
  面是否包含线: string
  交点数量: number
}

export interface PolygonToPolygonData {
  面A名称: string
  面A面积_km2: string
  面B名称: string
  面B面积_km2: string
  是否相交: string
  是否重叠: string
  A是否在B内: string
  A是否包含B: string
  是否分离: string
  是否相等: string
  交叠面积_km2: string
}

/**
 * 解析 KML 文件
 */
export async function parseKML(
  file: File,
  onProgress?: ProgressCallback
): Promise<ParseResult> {
  const errors: string[] = []
  const features: GeoFeature[] = []

  try {
    onProgress?.(10, '正在读取文件...')
    const content = await readFileAsText(file)

    onProgress?.(30, '正在解析 XML...')
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(content, 'text/xml')

    // 检查解析错误
    const parseError = xmlDoc.querySelector('parsererror')
    if (parseError) {
      errors.push('KML 文件格式不正确，无法解析')
      return { success: false, features: [], errors, totalPoints: 0, totalLines: 0, totalPolygons: 0 }
    }

    onProgress?.(50, '正在转换为 GeoJSON...')
    const geojson = toGeoJson.kml(xmlDoc)

    if (!geojson.features || geojson.features.length === 0) {
      errors.push('文件中未找到有效的地理要素')
      return { success: false, features: [], errors, totalPoints: 0, totalLines: 0, totalPolygons: 0 }
    }

    onProgress?.(70, '正在处理要素...')
    let pointCount = 0
    let lineCount = 0
    let polygonCount = 0

    geojson.features.forEach((feature: GeoJSON.Feature, index: number) => {
      const geometryType = feature.geometry?.type
      if (!geometryType) return

      const name = (feature.properties?.name as string) || `要素_${index + 1}`

      let type: 'Point' | 'LineString' | 'Polygon'
      switch (geometryType) {
        case 'Point':
        case 'MultiPoint':
          type = 'Point'
          pointCount++
          break
        case 'LineString':
        case 'MultiLineString':
          type = 'LineString'
          lineCount++
          break
        case 'Polygon':
        case 'MultiPolygon':
          type = 'Polygon'
          polygonCount++
          break
        default:
          return
      }

      features.push({
        id: `feature_${index}`,
        name,
        type,
        coordinates: feature.geometry.coordinates as number[] | number[][] | number[][][],
        properties: feature.properties || {},
        feature,
      })

      onProgress?.(70 + (index / geojson.features.length) * 30, `正在处理要素: ${name}`)
    })

    onProgress?.(100, '解析完成')

    return {
      success: true,
      features,
      errors,
      totalPoints: pointCount,
      totalLines: lineCount,
      totalPolygons: polygonCount,
    }
  } catch (error) {
    errors.push(`解析错误: ${error instanceof Error ? error.message : '未知错误'}`)
    return { success: false, features: [], errors, totalPoints: 0, totalLines: 0, totalPolygons: 0 }
  }
}

/**
 * 解析 KMZ 文件
 */
export async function parseKMZ(
  file: File,
  onProgress?: ProgressCallback
): Promise<ParseResult> {
  const errors: string[] = []

  try {
    onProgress?.(10, '正在读取 KMZ 文件...')
    const arrayBuffer = await file.arrayBuffer()

    onProgress?.(30, '正在解压文件...')
    const zip = await JSZip.loadAsync(arrayBuffer)

    // 查找 KML 文件
    const kmlFile = zip.file(/\.kml$/i)[0]
    if (!kmlFile) {
      errors.push('KMZ 文件中未找到 KML 文件')
      return { success: false, features: [], errors, totalPoints: 0, totalLines: 0, totalPolygons: 0 }
    }

    onProgress?.(60, '正在解析 KML 内容...')
    const kmlContent = await kmlFile.async('string')

    // 创建虚拟文件用于解析
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(kmlContent, 'text/xml')

    const parseError = xmlDoc.querySelector('parsererror')
    if (parseError) {
      errors.push('KML 内容格式不正确')
      return { success: false, features: [], errors, totalPoints: 0, totalLines: 0, totalPolygons: 0 }
    }

    onProgress?.(80, '正在转换为 GeoJSON...')
    const geojson = toGeoJson.kml(xmlDoc)

    const features: GeoFeature[] = []
    let pointCount = 0
    let lineCount = 0
    let polygonCount = 0

    geojson.features.forEach((feature: GeoJSON.Feature, index: number) => {
      const geometryType = feature.geometry?.type
      if (!geometryType) return

      const name = (feature.properties?.name as string) || `要素_${index + 1}`

      let type: 'Point' | 'LineString' | 'Polygon'
      switch (geometryType) {
        case 'Point':
        case 'MultiPoint':
          type = 'Point'
          pointCount++
          break
        case 'LineString':
        case 'MultiLineString':
          type = 'LineString'
          lineCount++
          break
        case 'Polygon':
        case 'MultiPolygon':
          type = 'Polygon'
          polygonCount++
          break
        default:
          return
      }

      features.push({
        id: `feature_${index}`,
        name,
        type,
        coordinates: feature.geometry.coordinates as number[] | number[][] | number[][][],
        properties: feature.properties || {},
        feature,
      })
    })

    onProgress?.(100, '解析完成')

    return {
      success: true,
      features,
      errors,
      totalPoints: pointCount,
      totalLines: lineCount,
      totalPolygons: polygonCount,
    }
  } catch (error) {
    errors.push(`KMZ 解析错误: ${error instanceof Error ? error.message : '未知错误'}`)
    return { success: false, features: [], errors, totalPoints: 0, totalLines: 0, totalPolygons: 0 }
  }
}

/**
 * 执行空间分析
 */
export async function performAnalysis(
  features: GeoFeature[],
  analysisTypes: string[],
  onProgress?: ProgressCallback
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = []
  const points = features.filter((f): f is PointFeature => f.type === 'Point')
  const lines = features.filter((f): f is LineFeature => f.type === 'LineString')
  const polygons = features.filter((f): f is PolygonFeature => f.type === 'Polygon')

  const totalTasks = analysisTypes.length
  let completedTasks = 0

  for (const type of analysisTypes) {
    onProgress?.((completedTasks / totalTasks) * 100, `正在执行: ${getAnalysisLabel(type)}`)

    switch (type) {
      case 'point_analysis':
        results.push(await analyzePoints(points))
        break
      case 'line_analysis':
        results.push(await analyzeLines(lines))
        break
      case 'polygon_analysis':
        results.push(await analyzePolygons(polygons))
        break
      case 'point_to_point':
        results.push(await analyzePointToPoint(points))
        break
      case 'point_to_line':
        results.push(await analyzePointToLine(points, lines))
        break
      case 'point_to_polygon':
        results.push(await analyzePointToPolygon(points, polygons))
        break
      case 'line_to_line':
        results.push(await analyzeLineToLine(lines))
        break
      case 'line_to_polygon':
        results.push(await analyzeLineToPolygon(lines, polygons))
        break
      case 'polygon_to_polygon':
        results.push(await analyzePolygonToPolygon(polygons))
        break
    }

    completedTasks++
    onProgress?.((completedTasks / totalTasks) * 100, `已完成: ${getAnalysisLabel(type)}`)
  }

  onProgress?.(100, '分析完成')
  return results
}

function getAnalysisLabel(type: string): string {
  const labels: Record<string, string> = {
    point_analysis: '单点分析',
    line_analysis: '单线分析',
    polygon_analysis: '单面分析',
    point_to_point: '点与点关系',
    point_to_line: '点与线关系',
    point_to_polygon: '点与面关系',
    line_to_line: '线与线关系',
    line_to_polygon: '线与面关系',
    polygon_to_polygon: '面与面关系',
  }
  return labels[type] || type
}

/**
 * 分析点要素
 */
async function analyzePoints(points: PointFeature[]): Promise<AnalysisResult> {
  const data: PointAnalysisData[] = points.map((p, index) => {
    const coords = p.coordinates
    return {
      序号: index + 1,
      名称: p.name,
      类型: p.type,
      经度: coords[0] ?? 0,
      纬度: coords[1] ?? 0,
    }
  })

  return {
    type: 'point_analysis',
    label: '单点分析',
    data: data as unknown as Record<string, unknown>[],
    columns: ['序号', '名称', '类型', '经度', '纬度'],
  }
}

/**
 * 分析线要素
 */
async function analyzeLines(lines: LineFeature[]): Promise<AnalysisResult> {
  const data: LineAnalysisData[] = lines.map((line, index) => {
    const coords = line.coordinates
    const lineString = turf.lineString(coords)
    const length = turf.length(lineString, { units: 'kilometers' })
    const startPoint = coords[0] as [number, number]
    const endPoint = coords[coords.length - 1] as [number, number]

    return {
      序号: index + 1,
      名称: line.name,
      类型: line.type,
      长度_km: length.toFixed(4),
      点数: coords.length,
      起点经度: startPoint[0],
      起点纬度: startPoint[1],
      终点经度: endPoint[0],
      终点纬度: endPoint[1],
    }
  })

  return {
    type: 'line_analysis',
    label: '单线分析',
    data: data as unknown as Record<string, unknown>[],
    columns: ['序号', '名称', '类型', '长度_km', '点数', '起点经度', '起点纬度', '终点经度', '终点纬度'],
  }
}

/**
 * 分析面要素
 */
async function analyzePolygons(polygons: PolygonFeature[]): Promise<AnalysisResult> {
  const data: PolygonAnalysisData[] = polygons.map((poly, index) => {
    const coords = poly.coordinates
    const polygon = turf.polygon(coords)
    const area = turf.area(polygon)
    const centroid = turf.centroid(polygon)
    const centroidCoords = centroid.geometry.coordinates as [number, number]
    const exteriorRing = coords[0] ?? []

    return {
      序号: index + 1,
      名称: poly.name,
      类型: poly.type,
      面积_km2: (area / 1000000).toFixed(4),
      质心经度: centroidCoords[0],
      质心纬度: centroidCoords[1],
      顶点数: exteriorRing.length,
      是否有孔洞: polygon.geometry.coordinates.length > 1 ? '是' : '否',
    }
  })

  return {
    type: 'polygon_analysis',
    label: '单面分析',
    data: data as unknown as Record<string, unknown>[],
    columns: ['序号', '名称', '类型', '面积_km2', '质心经度', '质心纬度', '顶点数', '是否有孔洞'],
  }
}

/**
 * 点与点关系分析
 */
async function analyzePointToPoint(points: PointFeature[]): Promise<AnalysisResult> {
  const data: PointToPointData[] = []

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const pointA = points[i]
      const pointB = points[j]
      if (!pointA || !pointB) continue

      const ptA = turf.point(pointA.coordinates)
      const ptB = turf.point(pointB.coordinates)
      const distance = turf.distance(ptA, ptB, { units: 'kilometers' })
      const bearing = turf.bearing(ptA, ptB)
      const coordsA = pointA.coordinates
      const coordsB = pointB.coordinates

      data.push({
        点A名称: pointA.name,
        点A经度: coordsA[0] ?? 0,
        点A纬度: coordsA[1] ?? 0,
        点B名称: pointB.name,
        点B经度: coordsB[0] ?? 0,
        点B纬度: coordsB[1] ?? 0,
        距离_km: distance.toFixed(4),
        方位角_度: bearing.toFixed(2),
        是否重合: turf.booleanEqual(ptA, ptB) ? '是' : '否',
      })
    }
  }

  return {
    type: 'point_to_point',
    label: '点与点关系',
    data: data as unknown as Record<string, unknown>[],
    columns: ['点A名称', '点A经度', '点A纬度', '点B名称', '点B经度', '点B纬度', '距离_km', '方位角_度', '是否重合'],
  }
}

/**
 * 点与线关系分析
 */
async function analyzePointToLine(points: PointFeature[], lines: LineFeature[]): Promise<AnalysisResult> {
  const data: PointToLineData[] = []

  for (const point of points) {
    for (const line of lines) {
      const pt = turf.point(point.coordinates)
      const lineCoords = line.coordinates
      const lineString = turf.lineString(lineCoords)

      const nearestPoint = turf.nearestPointOnLine(lineString, pt)
      const nearestCoords = nearestPoint.geometry.coordinates as [number, number]
      const distance = turf.pointToLineDistance(pt, lineString, { units: 'meters' })
      const isOnLine = turf.booleanPointOnLine(pt, lineString)
      const ptCoords = point.coordinates

      data.push({
        点名称: point.name,
        点经度: ptCoords[0] ?? 0,
        点纬度: ptCoords[1] ?? 0,
        线名称: line.name,
        是否在线上: isOnLine ? '是' : '否',
        到线距离_m: distance.toFixed(2),
        最近点经度: nearestCoords[0],
        最近点纬度: nearestCoords[1],
      })
    }
  }

  return {
    type: 'point_to_line',
    label: '点与线关系',
    data: data as unknown as Record<string, unknown>[],
    columns: ['点名称', '点经度', '点纬度', '线名称', '是否在线上', '到线距离_m', '最近点经度', '最近点纬度'],
  }
}

/**
 * 点与面关系分析
 */
async function analyzePointToPolygon(points: PointFeature[], polygons: PolygonFeature[]): Promise<AnalysisResult> {
  const data: PointToPolygonData[] = []

  for (const point of points) {
    for (const polygon of polygons) {
      const pt = turf.point(point.coordinates)
      const polyCoords = polygon.coordinates
      const polygonFeature = turf.polygon(polyCoords)

      const isInside = turf.booleanPointInPolygon(pt, polygonFeature)
      const distance = turf.pointToPolygonDistance(pt, polygonFeature, { units: 'meters' })
      const polygonLine = turf.polygonToLine(polygonFeature)
      const isOnBoundary = turf.booleanPointOnLine(pt, polygonLine as any)

      const ptCoords = point.coordinates

      data.push({
        点名称: point.name,
        点经度: ptCoords[0] ?? 0,
        点纬度: ptCoords[1] ?? 0,
        面名称: polygon.name,
        是否在面内: isInside ? '是' : '否',
        是否在边界上: isOnBoundary ? '是' : '否',
        到面距离_m: distance.toFixed(2),
      })
    }
  }

  return {
    type: 'point_to_polygon',
    label: '点与面关系',
    data: data as unknown as Record<string, unknown>[],
    columns: ['点名称', '点经度', '点纬度', '面名称', '是否在面内', '是否在边界上', '到面距离_m'],
  }
}

/**
 * 线与线关系分析
 */
async function analyzeLineToLine(lines: LineFeature[]): Promise<AnalysisResult> {
  const data: LineToLineData[] = []

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const featureA = lines[i]
      const featureB = lines[j]
      if (!featureA || !featureB) continue

      const lineA = turf.lineString(featureA.coordinates)
      const lineB = turf.lineString(featureB.coordinates)
      const lengthA = turf.length(lineA, { units: 'kilometers' })
      const lengthB = turf.length(lineB, { units: 'kilometers' })

      const intersections = turf.lineIntersect(lineA, lineB)

      data.push({
        线A名称: featureA.name,
        线A长度_km: lengthA.toFixed(4),
        线B名称: featureB.name,
        线B长度_km: lengthB.toFixed(4),
        是否相交: turf.booleanIntersects(lineA, lineB) ? '是' : '否',
        是否交叉: turf.booleanCrosses(lineA, lineB) ? '是' : '否',
        是否平行: turf.booleanParallel(lineA, lineB) ? '是' : '否',
        是否相等: turf.booleanEqual(lineA, lineB) ? '是' : '否',
        是否重叠: turf.booleanOverlap(lineA, lineB) ? '是' : '否',
        交点数量: intersections.features.length,
      })
    }
  }

  return {
    type: 'line_to_line',
    label: '线与线关系',
    data: data as unknown as Record<string, unknown>[],
    columns: ['线A名称', '线A长度_km', '线B名称', '线B长度_km', '是否相交', '是否交叉', '是否平行', '是否相等', '是否重叠', '交点数量'],
  }
}

/**
 * 线与面关系分析
 */
async function analyzeLineToPolygon(lines: LineFeature[], polygons: PolygonFeature[]): Promise<AnalysisResult> {
  const data: LineToPolygonData[] = []

  for (const line of lines) {
    for (const polygon of polygons) {
      const lineCoords = line.coordinates
      const polyCoords = polygon.coordinates

      const lineString = turf.lineString(lineCoords)
      const polygonFeature = turf.polygon(polyCoords)

      const lineLength = turf.length(lineString, { units: 'kilometers' })
      const polygonArea = turf.area(polygonFeature) / 1000000
      const intersections = turf.lineIntersect(lineString, polygonFeature)

      data.push({
        线名称: line.name,
        线长度_km: lineLength.toFixed(4),
        面名称: polygon.name,
        面面积_km2: polygonArea.toFixed(4),
        是否相交: turf.booleanIntersects(lineString, polygonFeature) ? '是' : '否',
        是否穿越: turf.booleanCrosses(lineString, polygonFeature) ? '是' : '否',
        线是否在面内: turf.booleanWithin(lineString, polygonFeature) ? '是' : '否',
        面是否包含线: turf.booleanContains(polygonFeature, lineString) ? '是' : '否',
        交点数量: intersections.features.length,
      })
    }
  }

  return {
    type: 'line_to_polygon',
    label: '线与面关系',
    data: data as unknown as Record<string, unknown>[],
    columns: ['线名称', '线长度_km', '面名称', '面面积_km2', '是否相交', '是否穿越', '线是否在面内', '面是否包含线', '交点数量'],
  }
}

/**
 * 面与面关系分析
 */
async function analyzePolygonToPolygon(polygons: PolygonFeature[]): Promise<AnalysisResult> {
  const data: PolygonToPolygonData[] = []

  for (let i = 0; i < polygons.length; i++) {
    for (let j = i + 1; j < polygons.length; j++) {
      const featureA = polygons[i]
      const featureB = polygons[j]
      if (!featureA || !featureB) continue

      const polyA = turf.polygon(featureA.coordinates)
      const polyB = turf.polygon(featureB.coordinates)

      const areaA = turf.area(polyA) / 1000000
      const areaB = turf.area(polyB) / 1000000

      let intersectionArea = '0'
      try {
        const fcA = turf.featureCollection([polyA])
        const fcB = turf.featureCollection([polyB])
        const intersection = turf.intersect(fcA as any, fcB as any) as any
        if (intersection && intersection.features && intersection.features.length > 0) {
          intersectionArea = (turf.area(intersection) / 1000000).toFixed(4)
        }
      } catch {
        intersectionArea = '0'
      }

      data.push({
        面A名称: featureA.name,
        面A面积_km2: areaA.toFixed(4),
        面B名称: featureB.name,
        面B面积_km2: areaB.toFixed(4),
        是否相交: turf.booleanIntersects(polyA, polyB) ? '是' : '否',
        是否重叠: turf.booleanOverlap(polyA, polyB) ? '是' : '否',
        A是否在B内: turf.booleanWithin(polyA, polyB) ? '是' : '否',
        A是否包含B: turf.booleanContains(polyA, polyB) ? '是' : '否',
        是否分离: turf.booleanDisjoint(polyA, polyB) ? '是' : '否',
        是否相等: turf.booleanEqual(polyA, polyB) ? '是' : '否',
        交叠面积_km2: intersectionArea,
      })
    }
  }

  return {
    type: 'polygon_to_polygon',
    label: '面与面关系',
    data: data as unknown as Record<string, unknown>[],
    columns: ['面A名称', '面A面积_km2', '面B名称', '面B面积_km2', '是否相交', '是否重叠', 'A是否在B内', 'A是否包含B', '是否分离', '是否相等', '交叠面积_km2'],
  }
}

/**
 * 导出为 XLSX
 */
export function exportToXLSX(results: AnalysisResult[], selectedTypes: string[]): void {
  const workbook = XLSX.utils.book_new()

  for (const result of results) {
    if (selectedTypes.includes(result.type)) {
      const worksheet = XLSX.utils.json_to_sheet(result.data)
      XLSX.utils.book_append_sheet(workbook, worksheet, result.label)
    }
  }

  const timestamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `空间分析报告_${timestamp}.xlsx`)
}

/**
 * 导出为 CSV
 */
export function exportToCSV(results: AnalysisResult[], selectedTypes: string[]): void {
  for (const result of results) {
    if (selectedTypes.includes(result.type)) {
      const worksheet = XLSX.utils.json_to_sheet(result.data)
      const csv = XLSX.utils.sheet_to_csv(worksheet)

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${result.label}_${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
    }
  }
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}
