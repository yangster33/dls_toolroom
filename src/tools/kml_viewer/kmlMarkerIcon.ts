/**
 * Google 风格彩色图钉图标的生成与缓存。
 *
 * 从 KmlViewerPage.vue 抽出，避免页面同时承担样式解析与图标构建。
 */
import L from 'leaflet'

/** Google Maps 风格：水滴形 + 白色圆心 + 下方阴影 */
export function createColoredMarkerIcon(fillColor: string): L.DivIcon {
  return L.divIcon({
    className: 'kml-marker-icon',
    html: `<div style="position:relative;width:27px;height:43px;">
  <svg xmlns="http://www.w3.org/2000/svg" width="27" height="43" viewBox="0 0 27 43" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));">
    <path d="M13.5 0C6.044 0 0 6.044 0 13.5C0 22.387 13.5 43 13.5 43S27 22.387 27 13.5C27 6.044 20.956 0 13.5 0z" fill="${fillColor}" stroke="#992d00" stroke-width="1.2" stroke-opacity="0.5"/>
    <circle cx="13.5" cy="13" r="5.5" fill="#fff" fill-opacity="0.92"/>
  </svg>
</div>`,
    iconSize: [27, 43],
    iconAnchor: [13.5, 43],
    popupAnchor: [0, -43],
  })
}

const markerIconCache = new Map<string, L.DivIcon>()

/** 按颜色缓存图标，避免同一文件内重复构建 DOM 字符串 */
export function getMarkerIcon(color?: string): L.DivIcon {
  const key = color || '__default__'
  if (!markerIconCache.has(key)) {
    markerIconCache.set(key, createColoredMarkerIcon(color || '#EA4335'))
  }
  return markerIconCache.get(key)!
}
