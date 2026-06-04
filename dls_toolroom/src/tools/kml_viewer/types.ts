import L from 'leaflet'

export interface KmlTreeNodeData {
  id: string
  name: string
  type: 'file' | 'folder' | 'placemark'
  geometryType?: string
  color?: string
  leafletLayer?: any
  visible: boolean
  children: KmlTreeNodeData[]
  parent?: KmlTreeNodeData
  bounds?: L.LatLngBounds
}
