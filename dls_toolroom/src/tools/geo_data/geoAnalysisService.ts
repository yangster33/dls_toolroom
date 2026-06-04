import * as turf from '@turf/turf'
import type { PointFeature, LineFeature, PolygonFeature, AnalysisResult } from './geoDataService'

export interface AnalysisProgressCallback {
  (progress: number, taskName: string): void
}

export interface AnalysisCancelCallback {
  (): boolean
}

export async function analyzePoints(
  points: PointFeature[],
  onProgress?: AnalysisProgressCallback,
  isCanceled?: AnalysisCancelCallback
): Promise<AnalysisResult> {
  const data: Record<string, unknown>[] = []
  const total = points.length

  for (let i = 0; i < total; i++) {
    if (isCanceled?.()) throw new Error('取消')
    const p = points[i]!
    const coords = p.coordinates
    data.push({
      序号: i + 1,
      名称: p.name,
      类型: p.type,
      经度: coords[0] ?? 0,
      纬度: coords[1] ?? 0,
    })
    onProgress?.(((i + 1) / total) * 100, '单点分析')
    await new Promise((r) => setTimeout(r, 0))
  }

  return {
    type: 'point_analysis',
    label: '单点分析',
    data,
    columns: ['序号', '名称', '类型', '经度', '纬度'],
  }
}

export async function analyzeLines(
  lines: LineFeature[],
  onProgress?: AnalysisProgressCallback,
  isCanceled?: AnalysisCancelCallback
): Promise<AnalysisResult> {
  const data: Record<string, unknown>[] = []
  const total = lines.length

  for (let i = 0; i < total; i++) {
    if (isCanceled?.()) throw new Error('取消')
    const line = lines[i]!
    const coords = line.coordinates
    const lineString = turf.lineString(coords)
    const length = turf.length(lineString, { units: 'kilometers' })
    const startPoint = coords[0] as [number, number]
    const endPoint = coords[coords.length - 1] as [number, number]

    data.push({
      序号: i + 1,
      名称: line.name,
      类型: line.type,
      长度_km: length.toFixed(4),
      点数: coords.length,
      起点经度: startPoint[0],
      起点纬度: startPoint[1],
      终点经度: endPoint[0],
      终点纬度: endPoint[1],
    })
    onProgress?.(((i + 1) / total) * 100, '单线分析')
    await new Promise((r) => setTimeout(r, 0))
  }

  return {
    type: 'line_analysis',
    label: '单线分析',
    data,
    columns: ['序号', '名称', '类型', '长度_km', '点数', '起点经度', '起点纬度', '终点经度', '终点纬度'],
  }
}

export async function analyzePolygons(
  polygons: PolygonFeature[],
  onProgress?: AnalysisProgressCallback,
  isCanceled?: AnalysisCancelCallback
): Promise<AnalysisResult> {
  const data: Record<string, unknown>[] = []
  const total = polygons.length

  for (let i = 0; i < total; i++) {
    if (isCanceled?.()) throw new Error('取消')
    const poly = polygons[i]!
    const coords = poly.coordinates
    const polygon = turf.polygon(coords)
    const area = turf.area(polygon)
    const centroid = turf.centroid(polygon)
    const centroidCoords = centroid.geometry.coordinates as [number, number]
    const exteriorRing = coords[0] ?? []

    data.push({
      序号: i + 1,
      名称: poly.name,
      类型: poly.type,
      面积_km2: (area / 1000000).toFixed(4),
      质心经度: centroidCoords[0],
      质心纬度: centroidCoords[1],
      顶点数: exteriorRing.length,
      是否有孔洞: polygon.geometry.coordinates.length > 1 ? '是' : '否',
    })
    onProgress?.(((i + 1) / total) * 100, '单面分析')
    await new Promise((r) => setTimeout(r, 0))
  }

  return {
    type: 'polygon_analysis',
    label: '单面分析',
    data,
    columns: ['序号', '名称', '类型', '面积_km2', '质心经度', '质心纬度', '顶点数', '是否有孔洞'],
  }
}

export async function analyzePointToPoint(
  points: PointFeature[],
  onProgress?: AnalysisProgressCallback,
  isCanceled?: AnalysisCancelCallback
): Promise<AnalysisResult> {
  const data: Record<string, unknown>[] = []
  const total = (points.length * (points.length - 1)) / 2
  let count = 0

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (isCanceled?.()) throw new Error('取消')
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
      count++
      onProgress?.((count / total) * 100, '点与点关系')
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  return {
    type: 'point_to_point',
    label: '点与点关系',
    data,
    columns: ['点A名称', '点A经度', '点A纬度', '点B名称', '点B经度', '点B纬度', '距离_km', '方位角_度', '是否重合'],
  }
}

export async function analyzePointToLine(
  points: PointFeature[],
  lines: LineFeature[],
  onProgress?: AnalysisProgressCallback,
  isCanceled?: AnalysisCancelCallback
): Promise<AnalysisResult> {
  const data: Record<string, unknown>[] = []
  const total = points.length * lines.length
  let count = 0

  for (const point of points) {
    for (const line of lines) {
      if (isCanceled?.()) throw new Error('取消')
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
      count++
      onProgress?.((count / total) * 100, '点与线关系')
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  return {
    type: 'point_to_line',
    label: '点与线关系',
    data,
    columns: ['点名称', '点经度', '点纬度', '线名称', '是否在线上', '到线距离_m', '最近点经度', '最近点纬度'],
  }
}

export async function analyzePointToPolygon(
  points: PointFeature[],
  polygons: PolygonFeature[],
  onProgress?: AnalysisProgressCallback,
  isCanceled?: AnalysisCancelCallback
): Promise<AnalysisResult> {
  const data: Record<string, unknown>[] = []
  const total = points.length * polygons.length
  let count = 0

  for (const point of points) {
    for (const polygon of polygons) {
      if (isCanceled?.()) throw new Error('取消')
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
      count++
      onProgress?.((count / total) * 100, '点与面关系')
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  return {
    type: 'point_to_polygon',
    label: '点与面关系',
    data,
    columns: ['点名称', '点经度', '点纬度', '面名称', '是否在面内', '是否在边界上', '到面距离_m'],
  }
}

export async function analyzeLineToLine(
  lines: LineFeature[],
  onProgress?: AnalysisProgressCallback,
  isCanceled?: AnalysisCancelCallback
): Promise<AnalysisResult> {
  const data: Record<string, unknown>[] = []
  const total = (lines.length * (lines.length - 1)) / 2
  let count = 0

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      if (isCanceled?.()) throw new Error('取消')
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
      count++
      onProgress?.((count / total) * 100, '线与线关系')
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  return {
    type: 'line_to_line',
    label: '线与线关系',
    data,
    columns: ['线A名称', '线A长度_km', '线B名称', '线B长度_km', '是否相交', '是否交叉', '是否平行', '是否相等', '是否重叠', '交点数量'],
  }
}

export async function analyzeLineToPolygon(
  lines: LineFeature[],
  polygons: PolygonFeature[],
  onProgress?: AnalysisProgressCallback,
  isCanceled?: AnalysisCancelCallback
): Promise<AnalysisResult> {
  const data: Record<string, unknown>[] = []
  const total = lines.length * polygons.length
  let count = 0

  for (const line of lines) {
    for (const polygon of polygons) {
      if (isCanceled?.()) throw new Error('取消')
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
      count++
      onProgress?.((count / total) * 100, '线与面关系')
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  return {
    type: 'line_to_polygon',
    label: '线与面关系',
    data,
    columns: ['线名称', '线长度_km', '面名称', '面面积_km2', '是否相交', '是否穿越', '线是否在面内', '面是否包含线', '交点数量'],
  }
}

export async function analyzePolygonToPolygon(
  polygons: PolygonFeature[],
  onProgress?: AnalysisProgressCallback,
  isCanceled?: AnalysisCancelCallback
): Promise<AnalysisResult> {
  const data: Record<string, unknown>[] = []
  const total = (polygons.length * (polygons.length - 1)) / 2
  let count = 0

  for (let i = 0; i < polygons.length; i++) {
    for (let j = i + 1; j < polygons.length; j++) {
      if (isCanceled?.()) throw new Error('取消')
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
      count++
      onProgress?.((count / total) * 100, '面与面关系')
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  return {
    type: 'polygon_to_polygon',
    label: '面与面关系',
    data,
    columns: ['面A名称', '面A面积_km2', '面B名称', '面B面积_km2', '是否相交', '是否重叠', 'A是否在B内', 'A是否包含B', '是否分离', '是否相等', '交叠面积_km2'],
  }
}

export type AnalysisType =
  | 'point_analysis'
  | 'line_analysis'
  | 'polygon_analysis'
  | 'point_to_point'
  | 'point_to_line'
  | 'point_to_polygon'
  | 'line_to_line'
  | 'line_to_polygon'
  | 'polygon_to_polygon'

export interface AnalysisConfig {
  type: AnalysisType
  label: string
  minPoints?: number
  minLines?: number
  minPolygons?: number
}

export const analysisConfigs: AnalysisConfig[] = [
  { type: 'point_analysis', label: '单点分析', minPoints: 1 },
  { type: 'line_analysis', label: '单线分析', minLines: 1 },
  { type: 'polygon_analysis', label: '单面分析', minPolygons: 1 },
  { type: 'point_to_point', label: '点与点关系', minPoints: 2 },
  { type: 'point_to_line', label: '点与线关系', minPoints: 1, minLines: 1 },
  { type: 'point_to_polygon', label: '点与面关系', minPoints: 1, minPolygons: 1 },
  { type: 'line_to_line', label: '线与线关系', minLines: 2 },
  { type: 'line_to_polygon', label: '线与面关系', minLines: 1, minPolygons: 1 },
  { type: 'polygon_to_polygon', label: '面与面关系', minPolygons: 2 },
]

export function getAnalysisLabel(type: AnalysisType): string {
  const config = analysisConfigs.find((c) => c.type === type)
  return config?.label || type
}

export function getAvailableAnalysisTypes(
  totalPoints: number,
  totalLines: number,
  totalPolygons: number
): AnalysisType[] {
  return analysisConfigs.filter((config) => {
    if (config.minPoints && totalPoints < config.minPoints) return false
    if (config.minLines && totalLines < config.minLines) return false
    if (config.minPolygons && totalPolygons < config.minPolygons) return false
    return true
  }).map((c) => c.type)
}