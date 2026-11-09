import * as turf from '@turf/turf'
import toGeoJSON from 'togeojson'
import JSZip from 'jszip'
// 仅剩 exportToCSV 在用（json_to_sheet + sheet_to_csv，CSV 路径本次不动）。
// exportToXLSX 已迁到 exceljs 管线（C4 阶段 3）—— 别顺手把这个 import 删了。
import * as XLSX from 'xlsx'
import type { Feature, LineString } from 'geojson'
import { yieldToUI } from '@/utils/yieldToUI'
import {
  collectHeaders,
  downloadXlsxBlob,
  rowsFromObjects,
  writeXlsx,
} from '@/utils/exceljsPipeline'

/**
 * 要素循环的让出粒度：每处理这么多要素让出一次主线程。
 *
 * 按**批**而非逐要素：逐要素 yield 会产生几万次微任务，反而拖慢整体吞吐
 * （计划风险 R4）。500 与 TemplateReader 的分片粒度保持一致。
 */
const FEATURE_YIELD_INTERVAL = 500

/**
 * turf.polygonToLine 的返回类型是
 * `Feature<LineString|MultiLineString> | FeatureCollection<...>`
 * —— 前者有 coordinates，后者只有 features。booleanPointOnLine 只接受前者。
 * 这里做运行时判别后收窄，替代原来的 `as any`。
 */
function asLineFeature(value: unknown): Feature<LineString, GeoJSON.GeoJsonProperties> | null {
  if (value === null || typeof value !== 'object') return null
  const feature = value as { type?: unknown; geometry?: { type?: unknown } | null }
  if (feature.type !== 'Feature' || feature.geometry == null) return null
  if (feature.geometry.type !== 'LineString') return null
  return value as Feature<LineString, GeoJSON.GeoJsonProperties>
}

// toGeoJSON 使用
const toGeoJson = toGeoJSON as unknown as { kml: (doc: Document) => GeoJSON.FeatureCollection }

export interface GeoFeature {
  id: string
  name: string
  type: 'Point' | 'LineString' | 'Polygon'
  coordinates: number[] | number[][] | number[][][]
  properties: Record<string, unknown>
  /**
   * F4：不再持有原始 `GeoJSON.Feature`。
   *
   * 旧实现把 togeojson 的整个 feature 挂在每个拆分子要素上，大文件下
   * 同一份几何/属性会被长期强引用，内存放大 2 倍以上。分析链路只需要
   * `coordinates` / `properties`，因此这里只保留这两份派生数据。
   */
}

/** 展开后的「原子单几何」：coordinates 形状与 type 严格对应 */
interface AtomicGeometry {
  type: 'Point' | 'LineString' | 'Polygon'
  coordinates: number[] | number[][] | number[][][]
  /** 名称后缀，如 '1' 或 '1.2'；空串表示该 feature 只有一个几何 */
  suffix: string
}

function childSuffix(parent: string, i: number): string {
  return parent ? `${parent}.${i + 1}` : String(i + 1)
}

/**
 * 把 GeoJSON geometry 递归展开成若干**原子单几何**。
 *
 * 处理两类嵌套：
 *  1. `GeometryCollection` —— KML 的 `<MultiGeometry>` 经 togeojson 转换后
 *     就是它（可能混合 Point/LineString/Polygon）。旧代码直接丢弃整块。
 *  2. `MultiPoint` / `MultiLineString` / `MultiPolygon`。
 *
 * 关键点：展开后每个元素的 `coordinates` 形状必须与 `type` 严格对应
 * （Point→number[]，LineString→number[][]，Polygon→number[][][]），
 * 否则下游 `analyzePoints` 会把 `[lng,lat]` 整个数组当成经度写进 Excel，
 * 或 `turf.lineString` 抛错（审计 P0-4）。
 */
function flattenGeometry(geometry: unknown, suffix: string, out: AtomicGeometry[]): void {
  if (geometry === null || typeof geometry !== 'object') return
  const g = geometry as { type?: unknown; coordinates?: unknown; geometries?: unknown }
  const t = g.type
  if (typeof t !== 'string') return

  if (t === 'GeometryCollection') {
    if (!Array.isArray(g.geometries)) return
    g.geometries.forEach((child, i) => flattenGeometry(child, childSuffix(suffix, i), out))
    return
  }

  const coords = g.coordinates
  if (!Array.isArray(coords)) return

  switch (t) {
    case 'Point':
      if (typeof coords[0] === 'number') {
        out.push({ type: 'Point', coordinates: coords as number[], suffix })
      }
      break
    case 'MultiPoint':
      coords.forEach((c, i) => {
        if (Array.isArray(c) && typeof c[0] === 'number') {
          out.push({ type: 'Point', coordinates: c as number[], suffix: childSuffix(suffix, i) })
        }
      })
      break
    case 'LineString':
      if (Array.isArray(coords[0])) {
        out.push({ type: 'LineString', coordinates: coords as number[][], suffix })
      }
      break
    case 'MultiLineString':
      coords.forEach((c, i) => {
        if (Array.isArray(c) && Array.isArray(c[0])) {
          out.push({
            type: 'LineString',
            coordinates: c as number[][],
            suffix: childSuffix(suffix, i),
          })
        }
      })
      break
    case 'Polygon':
      if (Array.isArray(coords[0]) && Array.isArray((coords[0] as unknown[])[0])) {
        out.push({ type: 'Polygon', coordinates: coords as number[][][], suffix })
      }
      break
    case 'MultiPolygon':
      coords.forEach((rings, i) => {
        if (Array.isArray(rings) && Array.isArray(rings[0])) {
          out.push({
            type: 'Polygon',
            coordinates: rings as number[][][],
            suffix: childSuffix(suffix, i),
          })
        }
      })
      break
    default:
      break
  }
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
  /**
   * 分析过程中被跳过的要素及其原因（审计 P0-4）。
   *
   * 畸形几何（1 点的 LineString、未闭合的 3 点 Polygon 等）会让 turf 抛错。
   * 旧实现没有容错，一个坏要素就让整场分析 reject、已算完的结果全部作废。
   * 现在逐要素容错：坏要素记到这里，其它要素的结果照常产出。
   *
   * 注意：有 errors 不代表分析失败 —— data 仍然是有效的部分结果，
   * 调用方应把 errors 展示给用户，而不是丢弃 data。
   */
  errors?: string[]
}

import type { ProgressCallback as SharedProgressCallback } from '@/utils/progress'

/**
 * 进度回调（P3-4 收敛）：历史上本文件、`DistanceCalculator.ts`、
 * `geoAnalysisService.ts` 各有一份逐字节等价的定义，现统一指向 `@/utils/progress`。
 */
export type ProgressCallback = SharedProgressCallback

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
export async function parseKML(file: File, onProgress?: ProgressCallback): Promise<ParseResult> {
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
      return {
        success: false,
        features: [],
        errors,
        totalPoints: 0,
        totalLines: 0,
        totalPolygons: 0,
      }
    }

    onProgress?.(50, '正在转换为 GeoJSON...')
    // 让 UI 先把 50% 画出来：下面 toGeoJSON 是单一不可中断的同步块，
    // 不先 yield 的话用户看到的是进度条冻结在转换前的旧值。
    await yieldToUI()
    const geojson = toGeoJson.kml(xmlDoc)

    if (!geojson.features || geojson.features.length === 0) {
      errors.push('文件中未找到有效的地理要素')
      return {
        success: false,
        features: [],
        errors,
        totalPoints: 0,
        totalLines: 0,
        totalPolygons: 0,
      }
    }

    onProgress?.(70, '正在处理要素...')
    let pointCount = 0
    let lineCount = 0
    let polygonCount = 0

    // 历史 Bug（审计缺陷 B）：这里是 `geojson.features.forEach`，forEach 内不可 await，
    // onProgress 被同步调用几千次 —— 浏览器一次都重绘不了，用户看到进度条死在 70%，
    // 直到整个循环跑完才一把跳 100%。改为 for...of，按批 yield + 按 1% 粒度上报。
    const totalFeatures = geojson.features.length
    let lastReportedPercent = 70

    for (let index = 0; index < totalFeatures; index++) {
      // 让出放在循环**开头**：`continue`（无几何要素）会跳过循环尾部，放在那里会被整批漏掉
      if (index % FEATURE_YIELD_INTERVAL === 0) {
        await yieldToUI()
      }

      const feature = geojson.features[index]!
      if (!feature.geometry) continue

      const name = (feature.properties?.name as string) || `要素_${index + 1}`

      // 先把该 placemark 下的几何展开成若干个「原子单几何」。
      // 需要处理两类嵌套：
      //   1. KML 的 <MultiGeometry> → togeojson 转成 GeometryCollection（可能混合类型）
      //   2. GeoJSON 的 MultiPoint / MultiLineString / MultiPolygon
      // 历史 Bug（审计 P0-4）：旧代码对 Multi* 只改 type 标签不改 coordinates 形状，
      // 对 GeometryCollection 直接 default:return 整块丢弃。
      const atoms: AtomicGeometry[] = []
      flattenGeometry(feature.geometry, '', atoms)

      atoms.forEach((atom, atomIndex) => {
        if (atom.type === 'Point') pointCount++
        else if (atom.type === 'LineString') lineCount++
        else polygonCount++

        features.push({
          id: atoms.length > 1 ? `feature_${index}_${atomIndex}` : `feature_${index}`,
          name: atom.suffix ? `${name} (${atom.suffix})` : name,
          type: atom.type,
          coordinates: atom.coordinates,
          properties: feature.properties || {},
        })
      })

      // 按 1% 粒度上报：5 万要素只会触发约 30 次回调，每次之间页面可交互。
      // 阈值用原始浮点比较，上报值取整 —— 否则页面会渲染出 "71.0002%"。
      const percent = 70 + ((index + 1) / totalFeatures) * 30
      if (percent - lastReportedPercent >= 1 || index === totalFeatures - 1) {
        lastReportedPercent = percent
        onProgress?.(
          index === totalFeatures - 1 ? 100 : Math.round(percent),
          `正在处理要素: ${name}`,
        )
      }
    }

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
export async function parseKMZ(file: File, onProgress?: ProgressCallback): Promise<ParseResult> {
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
      return {
        success: false,
        features: [],
        errors,
        totalPoints: 0,
        totalLines: 0,
        totalPolygons: 0,
      }
    }

    onProgress?.(60, '正在解析 KML 内容...')
    const kmlContent = await kmlFile.async('string')

    // 创建虚拟文件用于解析
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(kmlContent, 'text/xml')

    const parseError = xmlDoc.querySelector('parsererror')
    if (parseError) {
      errors.push('KML 内容格式不正确')
      return {
        success: false,
        features: [],
        errors,
        totalPoints: 0,
        totalLines: 0,
        totalPolygons: 0,
      }
    }

    onProgress?.(80, '正在转换为 GeoJSON...')
    await yieldToUI()
    const geojson = toGeoJson.kml(xmlDoc)

    const features: GeoFeature[] = []
    let pointCount = 0
    let lineCount = 0
    let polygonCount = 0

    // C4 收尾：改用与 parseKML **完全同一套** flattenGeometry。
    // 旧代码是裸 switch：KML 的 <MultiGeometry> 经 togeojson 变成 GeometryCollection，
    // 走 default: continue **整块被静默丢弃** —— 与阶段 2 已修的 P0-4 同一类
    // 「静默数据丢失」，只是 parseKML 修了、parseKMZ 漏了。
    // 进度与让出语义保持不变（按批 yield + 80→100 按 1% 粒度）。
    const totalFeatures = geojson.features.length
    let lastReportedPercent = 80

    for (let index = 0; index < totalFeatures; index++) {
      // 让出放在循环**开头**：continue 分支会跳过循环尾部
      if (index % FEATURE_YIELD_INTERVAL === 0) {
        await yieldToUI()
      }

      const feature = geojson.features[index]!
      if (!feature.geometry) continue

      const name = (feature.properties?.name as string) || `要素_${index + 1}`

      const atoms: AtomicGeometry[] = []
      flattenGeometry(feature.geometry, '', atoms)

      atoms.forEach((atom, atomIndex) => {
        if (atom.type === 'Point') pointCount++
        else if (atom.type === 'LineString') lineCount++
        else polygonCount++

        features.push({
          id: atoms.length > 1 ? `feature_${index}_${atomIndex}` : `feature_${index}`,
          name: atom.suffix ? `${name} (${atom.suffix})` : name,
          type: atom.type,
          coordinates: atom.coordinates,
          properties: feature.properties || {},
        })
      })

      const percent = 80 + ((index + 1) / totalFeatures) * 20
      if (percent - lastReportedPercent >= 1 || index === totalFeatures - 1) {
        lastReportedPercent = percent
        onProgress?.(
          index === totalFeatures - 1 ? 100 : Math.round(percent),
          `正在处理要素: ${name}`,
        )
      }
    }

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
  onProgress?: ProgressCallback,
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
    columns: [
      '序号',
      '名称',
      '类型',
      '长度_km',
      '点数',
      '起点经度',
      '起点纬度',
      '终点经度',
      '终点纬度',
    ],
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
    columns: [
      '点A名称',
      '点A经度',
      '点A纬度',
      '点B名称',
      '点B经度',
      '点B纬度',
      '距离_km',
      '方位角_度',
      '是否重合',
    ],
  }
}

/**
 * 点与线关系分析
 */
async function analyzePointToLine(
  points: PointFeature[],
  lines: LineFeature[],
): Promise<AnalysisResult> {
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
    columns: [
      '点名称',
      '点经度',
      '点纬度',
      '线名称',
      '是否在线上',
      '到线距离_m',
      '最近点经度',
      '最近点纬度',
    ],
  }
}

/**
 * 点与面关系分析
 */
async function analyzePointToPolygon(
  points: PointFeature[],
  polygons: PolygonFeature[],
): Promise<AnalysisResult> {
  const data: PointToPolygonData[] = []

  for (const point of points) {
    for (const polygon of polygons) {
      const pt = turf.point(point.coordinates)
      const polyCoords = polygon.coordinates
      const polygonFeature = turf.polygon(polyCoords)

      const isInside = turf.booleanPointInPolygon(pt, polygonFeature)
      const distance = turf.pointToPolygonDistance(pt, polygonFeature, { units: 'meters' })
      const polygonLine = turf.polygonToLine(polygonFeature)
      const isOnBoundary = (() => {
        const lf = asLineFeature(polygonLine)
        return lf ? turf.booleanPointOnLine(pt, lf) : false
      })()

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
    columns: [
      '线A名称',
      '线A长度_km',
      '线B名称',
      '线B长度_km',
      '是否相交',
      '是否交叉',
      '是否平行',
      '是否相等',
      '是否重叠',
      '交点数量',
    ],
  }
}

/**
 * 线与面关系分析
 */
async function analyzeLineToPolygon(
  lines: LineFeature[],
  polygons: PolygonFeature[],
): Promise<AnalysisResult> {
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
    columns: [
      '线名称',
      '线长度_km',
      '面名称',
      '面面积_km2',
      '是否相交',
      '是否穿越',
      '线是否在面内',
      '面是否包含线',
      '交点数量',
    ],
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
        const intersection = turf.intersect(turf.featureCollection([polyA, polyB]))
        if (intersection) {
          // turf v7 的 intersect 只接受一个 FeatureCollection，返回 Feature | null
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
    columns: [
      '面A名称',
      '面A面积_km2',
      '面B名称',
      '面B面积_km2',
      '是否相交',
      '是否重叠',
      'A是否在B内',
      'A是否包含B',
      '是否分离',
      '是否相等',
      '交叠面积_km2',
    ],
  }
}

/**
 * 导出为 XLSX
 *
 * C4 阶段 3 / P2-20：从 xlsx（SheetJS）迁到 `@/utils/exceljsPipeline`（exceljs）。
 * 迁移方式是「照抄旧算法」而不是重写语义：
 *   - sheet 名仍是 `result.label`（且顺序仍按 results 的顺序）
 *   - 列宽**故意不设**（`defaultColWidths: false`）、**故意不加边框** ——
 *     旧实现走 `json_to_sheet`，而这个函数两者都不做（边框那段是死代码：
 *     xlsx@0.18.5 会把单元格样式整体丢弃，见 `src/utils/__tests__/exceljsPipeline.spec.ts`）。
 *     产物一致性由 `src/tools/geo_data/__tests__/exportXlsxParity.spec.ts`
 *     逐格比对守护，改动前先跑它。
 *
 * **行为差异（有意，已记档）**：旧实现在「没有任何 result 被选中」时
 * `XLSX.writeFile` 会抛 `Workbook is empty`（空 workbook 写不出去），
 * 导出按钮点了直接弹错误框；新实现会导出一个合法但空的工作簿。
 *
 * 之所以是 async：`writeXlsx` 内部 `await import('exceljs')`，块内不能同步返回。
 */
export async function exportToXLSX(
  results: AnalysisResult[],
  selectedTypes: string[],
): Promise<void> {
  const sheets = results
    .filter((result) => selectedTypes.includes(result.type))
    .map((result) => {
      const headers = collectHeaders(result.data)
      return {
        name: result.label,
        headers,
        rows: rowsFromObjects(result.data, headers),
        defaultColWidths: false,
      }
    })

  const blob = await writeXlsx(sheets)

  // 下载方式与下面的 exportToCSV 保持一致（旧实现是 XLSX.writeFile，
  // 它内部也是 <a download>；不引入 file-saver）
  // 下载统一走 utils/exceljsPipeline 的 downloadXlsxBlob：appendChild 进文档
  // + 延迟 revoke（大文件 Blob 在 click() 之后仍被浏览器读取，立即 revoke 会拿到空文件）。
  // 旧实现是 XLSX.writeFile（它内部会走 chrome.downloads 的 saveAs）。
  downloadXlsxBlob(blob, '空间分析报告_' + new Date().toISOString().slice(0, 10))
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
