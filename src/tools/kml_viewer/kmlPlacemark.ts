/**
 * KML Placemark 元数据解析（纯 DOM，不依赖 Leaflet）。
 *
 * 负责读取名称/描述/颜色/几何类型，以及 <coordinates>、gx:Track 坐标。
 * 图层创建放在 kmlLayerBuilder.ts，便于纯函数单测与页面拆分。
 */
import { parseKmlCoordinates, type LatLngTuple } from '@/utils/kmlCoordinates'
import { parseKmlColorEl } from './kmlStyle'

export interface KmlPlacemarkMeta {
  name: string
  description: string
  color?: string
  geometryType: string
}

/**
 * 判断 Placemark 的几何类型。
 *
 * 顺序沿用旧实现：Point → LineString → Polygon → MultiGeometry → Track → GroundOverlay。
 */
export function detectGeometryType(el: Element): string {
  const geometryTypes = [
    'Point',
    'LineString',
    'Polygon',
    'MultiGeometry',
    'Track',
    'GroundOverlay',
  ]
  for (const gt of geometryTypes) {
    if (el.getElementsByTagName(gt).length > 0) return gt
  }
  return ''
}

/**
 * 解析 Placemark 的展示元数据。
 *
 * 颜色优先级：Placemark 内联 <Style> > styleUrl 引用 > 未指定。
 */
export function getPlacemarkMeta(el: Element, styles: Map<string, string>): KmlPlacemarkMeta {
  const name = el.getElementsByTagName('name')[0]?.textContent || '未命名要素'
  const description = el.getElementsByTagName('description')[0]?.textContent || ''

  let color: string | undefined
  // 1. Placemark 内联 <Style>
  const inlineStyle = el.getElementsByTagName('Style')[0]
  if (inlineStyle) {
    const iconColor = parseKmlColorEl(
      inlineStyle.getElementsByTagName('IconStyle')[0] || inlineStyle,
    )
    if (iconColor) color = iconColor
  }
  // 2. styleUrl 引用
  if (!color) {
    const styleUrlEl = el.getElementsByTagName('styleUrl')[0]
    if (styleUrlEl?.textContent) {
      color = styles.get(styleUrlEl.textContent.trim())
    }
  }

  return {
    name,
    description,
    color,
    geometryType: detectGeometryType(el),
  }
}

/** 读取元素下第一个 <coordinates>，交给 kmlCoordinates 统一解析 */
export function parseCoordinatesElement(el: Element): LatLngTuple[] {
  const coordEl = el.getElementsByTagName('coordinates')[0]
  if (!coordEl) return []
  return parseKmlCoordinates(coordEl.textContent)
}

/**
 * 解析 gx:Track / <Track> 的 <coord> 列表。
 *
 * 与旧实现一致：按空白分隔取前两个数为 lng/lat，过滤 NaN 与越界值。
 */
export function parseTrackCoordinates(element: Element): LatLngTuple[] {
  const coordEls = element.getElementsByTagName('coord')
  const gxCoordEls = element.getElementsByTagName('gx:coord')
  const coords = [...Array.from(coordEls), ...Array.from(gxCoordEls)]

  const points: LatLngTuple[] = []
  for (const c of coords) {
    const parts = (c.textContent || '').trim().split(/\s+/)
    if (parts.length < 2) continue
    const lng = parseFloat(parts[0]!)
    const lat = parseFloat(parts[1]!)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) continue
    points.push({ lat, lng })
  }
  return points
}
