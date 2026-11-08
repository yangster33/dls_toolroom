/**
 * KML 图层树节点
 *
 * 关于 `leafletLayer` / `bounds` 的类型：
 *
 * 直接写 `L.Layer` / `L.LatLngBounds`（@types/leaflet 的 class 类型）会在
 * 跨 .vue 组件传 props 时报 "Property '_map' is missing" —— 因为它们是
 * class，带 protected 私有字段，TS 按名义子类型检查，结构上不兼容。
 *
 * 这里改用「leaflet 的 Layer 实例睡结构子集」：
 * 真实对象一定是 L.Marker / L.Polyline / L.Polygon 等子类，运行时完全安全。
 * 需要传给 map.addLayer() / fitBounds() 时，在调用处用 `as L.Layer` 收窄。
 */
export interface LeafletLayerLike {
  addTo(map: unknown): unknown
  remove(): unknown
  removeFrom(map: unknown): unknown
  getPane(name?: string): HTMLElement | undefined
  getLatLng?: () => { lat: number; lng: number }
  getBounds?: () => unknown
}

export interface LatLngBoundsLike {
  isValid(): boolean
  extend(other: unknown): unknown
}

export interface KmlTreeNodeData {
  id: string
  name: string
  type: 'file' | 'folder' | 'placemark'
  geometryType?: string
  color?: string
  leafletLayer?: LeafletLayerLike
  visible: boolean
  children: KmlTreeNodeData[]
  parent?: KmlTreeNodeData
  bounds?: LatLngBoundsLike
}

/** 把 LeafletLayerLike 收窄成 leaflet 的 L.Layer，供 map.addLayer() 使用 */
export type { LeafletLayerLike as LeafletLayerHandle }

/** 测量工具模式（null 表示未启用） */
export type MeasureMode = 'length' | 'area' | 'angle' | null

/** 经纬度采集点（WGS84） */
export interface PickedCoord {
  lat: number
  lng: number
}
