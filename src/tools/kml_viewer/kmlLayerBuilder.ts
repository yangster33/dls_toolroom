/**
 * KML DOM → Leaflet 图层 / 图层树（不依赖 Vue）。
 *
 * 从 KmlViewerPage.vue 抽出的「重活」，页面只负责状态与交互。
 */
import L from 'leaflet'
import DOMPurify from 'dompurify'
import { parseKmlStyles } from './kmlStyle'
import { getPlacemarkMeta, parseCoordinatesElement, parseTrackCoordinates } from './kmlPlacemark'
import { getMarkerIcon } from './kmlMarkerIcon'
import type { KmlTreeNodeData, LeafletLayerLike, LatLngBoundsLike } from './types'

export type MarkerIconFactory = (color?: string) => L.DivIcon

/** 把 LeafletLayerLike 收窄成 leaflet 的 L.Layer，供 map.addLayer() 使用 */
export function asLeafletLayer(layer: LeafletLayerLike): L.Layer {
  return layer as unknown as L.Layer
}

/** 把 LatLngBoundsLike 收窄成 L.LatLngBounds，供 map.fitBounds() 使用 */
export function asLeafletBounds(bounds: LatLngBoundsLike): L.LatLngBounds {
  return bounds as unknown as L.LatLngBounds
}

/** 解析 <coordinates> 为 Leaflet LatLng 数组 */
export function parseCoords(el: Element): L.LatLng[] {
  return parseCoordinatesElement(el).map((p) => L.latLng(p.lat, p.lng))
}

/** 为一个 Placemark 创建 Leaflet 图层（点/线/面/轨迹/多几何取首个） */
export function createLayerForPlacemark(
  el: Element,
  meta: { color?: string; name?: string; description?: string },
  iconFactory: MarkerIconFactory = getMarkerIcon,
): L.Layer | null {
  const { color, name, description: descr } = meta
  const sanitizedName = DOMPurify.sanitize(name || '要素', { ALLOWED_TAGS: [] })
  const sanitizedDescr = descr ? DOMPurify.sanitize(descr, { ALLOWED_TAGS: ['br'] }) : ''
  const popupContent = `<strong>${sanitizedName}</strong>${sanitizedDescr ? `<br/>${sanitizedDescr}` : ''}`

  // Point
  const pointEls = el.getElementsByTagName('Point')
  if (pointEls.length > 0) {
    const points = parseCoordinatesElement(pointEls[0]!)
    if (points.length > 0) {
      const first = points[0]!
      const marker = L.marker(L.latLng(first.lat, first.lng), { icon: iconFactory(color) })
      marker.bindPopup(popupContent)
      return marker
    }
  }

  // LineString
  const lineEls = el.getElementsByTagName('LineString')
  if (lineEls.length > 0) {
    const latlngs = parseCoords(lineEls[0]!)
    if (latlngs.length > 1) {
      const opts: L.PolylineOptions = { color: color || '#3388ff' }
      const line = L.polyline(latlngs, opts)
      line.bindPopup(popupContent)
      return line
    }
  }

  // Polygon
  const polyEls = el.getElementsByTagName('Polygon')
  if (polyEls.length > 0) {
    const outerEl = polyEls[0]!.getElementsByTagName('outerBoundaryIs')[0]
    if (outerEl) {
      const outerCoords = parseCoords(outerEl)
      if (outerCoords.length > 2) {
        const opts: L.PolylineOptions = {
          color: color || '#3388ff',
          fillColor: color || '#3388ff',
          fillOpacity: 0.2,
        }
        const poly = L.polygon(outerCoords, opts)
        poly.bindPopup(popupContent)
        return poly
      }
    }
  }

  // Track / gx:Track
  const trackEls = el.getElementsByTagName('Track')
  const gxTrackEls = el.getElementsByTagName('gx:Track')
  const allTracks = [...Array.from(trackEls), ...Array.from(gxTrackEls)]
  if (allTracks.length > 0) {
    const latlngs = parseTrackCoordinates(allTracks[0]!).map((p) => L.latLng(p.lat, p.lng))
    if (latlngs.length > 1) {
      const track = L.polyline(latlngs, { color: color || '#3388ff' })
      track.bindPopup(popupContent)
      return track
    }
  }

  // MultiGeometry —— 取第一个能成功创建的子几何
  const multiEls = el.getElementsByTagName('MultiGeometry')
  if (multiEls.length > 0) {
    for (const child of Array.from(multiEls[0]!.children)) {
      // Fake a Placemark wrapper
      const fakeEl = document.createElement('Placemark')
      fakeEl.appendChild(child.cloneNode(true))
      const result = createLayerForPlacemark(fakeEl, meta, iconFactory)
      if (result) return result
    }
  }

  return null
}

/** 为 Placemark 创建图层、挂到地图、计算 bounds，并返回树节点 */
export function createPlacemarkNode(
  el: Element,
  styles: Map<string, string>,
  map: L.Map,
  iconFactory: MarkerIconFactory = getMarkerIcon,
): KmlTreeNodeData | null {
  const meta = getPlacemarkMeta(el, styles)

  // createLayerForPlacemark 已声明返回 L.Layer | null，这里显式收窄为 L.Layer，
  // 避免 TS 把 bindPopup() 的 this 类型推断成结构体而与 KmlTreeNodeData 冲突
  const leafletLayer: L.Layer | null = createLayerForPlacemark(el, meta, iconFactory)
  if (!leafletLayer) return null

  leafletLayer.addTo(map)

  let bounds: L.LatLngBounds | undefined
  if ('getLatLng' in leafletLayer) {
    bounds = L.latLngBounds([
      (leafletLayer as L.Marker).getLatLng(),
      (leafletLayer as L.Marker).getLatLng(),
    ])
  } else if ('getBounds' in leafletLayer) {
    bounds = (leafletLayer as L.Polyline).getBounds()
  }

  return {
    id: 'pm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name: meta.name,
    type: 'placemark',
    geometryType: meta.geometryType,
    color: meta.color,
    leafletLayer,
    visible: true,
    children: [],
    bounds,
  }
}

/** 递归遍历 Folder / Document / Placemark，构建图层树并挂载图层 */
export function parseKmlNode(
  xmlEl: Element,
  parent: KmlTreeNodeData,
  styles: Map<string, string>,
  map: L.Map,
  iconFactory: MarkerIconFactory = getMarkerIcon,
): void {
  const folders = xmlEl.children
  for (let i = 0; i < folders.length; i++) {
    const el = folders[i]!
    if (el.tagName === 'Folder') {
      const name = el.getElementsByTagName('name')[0]?.textContent || '未命名文件夹'
      const folderNode: KmlTreeNodeData = {
        id: 'folder_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 6),
        name,
        type: 'folder',
        visible: true,
        children: [],
        parent,
      }
      parent.children.push(folderNode)
      parseKmlNode(el, folderNode, styles, map, iconFactory)
    } else if (el.tagName === 'Placemark') {
      const pmNode = createPlacemarkNode(el, styles, map, iconFactory)
      if (pmNode) {
        pmNode.parent = parent
        parent.children.push(pmNode)
        // Propagate bounds up
        let p: KmlTreeNodeData | undefined = parent
        while (p) {
          if (pmNode.bounds?.isValid()) {
            if (!p.bounds) p.bounds = L.latLngBounds([]).extend(asLeafletBounds(pmNode.bounds))
            else p.bounds.extend(asLeafletBounds(pmNode.bounds))
          }
          p = p.parent
        }
      }
    } else if (el.tagName === 'Document') {
      parseKmlNode(el, parent, styles, map, iconFactory)
    }
  }
}

/** 解析整份 KML 文档，返回文件根节点（图层已挂到 map） */
export function buildKmlTree(
  kmlDoc: Document,
  file: File,
  map: L.Map,
  iconFactory: MarkerIconFactory = getMarkerIcon,
): KmlTreeNodeData {
  const styles = parseKmlStyles(kmlDoc)

  const fileNode: KmlTreeNodeData = {
    id: 'file_' + Date.now(),
    name: file.name,
    type: 'file',
    visible: true,
    children: [],
  }

  parseKmlNode(kmlDoc.documentElement, fileNode, styles, map, iconFactory)
  return fileNode
}
