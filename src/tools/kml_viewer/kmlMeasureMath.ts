/**
 * 测量工具的纯数学函数（不依赖 Leaflet / DOM），便于单测。
 */
export interface PointLike {
  lat: number
  lng: number
}

/** 三点夹角（度），用于测角工具 */
export function calculateAngle(a: PointLike, b: PointLike, c: PointLike): number {
  const ba = { x: a.lng - b.lng, y: a.lat - b.lat }
  const bc = { x: c.lng - b.lng, y: c.lat - b.lat }
  const dot = ba.x * bc.x + ba.y * bc.y
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y)
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y)
  const cosA = dot / (magBA * magBC)
  return (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI
}

/**
 * 多边形面积（平方米）。
 *
 * 用鞋带公式算经纬度平面面积，再按中心纬度做度→米换算（与旧实现一致）。
 */
export function polygonAreaM2(points: PointLike[]): number {
  if (points.length < 3) return 0
  const coords = points.map((p) => [p.lng, p.lat] as const)
  let area = 0
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length
    area += coords[i]![0]! * coords[j]![1]!
    area -= coords[j]![0]! * coords[i]![1]!
  }
  area = Math.abs(area) / 2
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length
  const latRad = (lat * Math.PI) / 180
  const mPerDegLat = 111320
  const mPerDegLng = 111320 * Math.cos(latRad)
  return area * mPerDegLat * mPerDegLng
}

export function formatLength(meters: number): string {
  if (meters >= 1000) return (meters / 1000).toFixed(2) + ' km'
  return meters.toFixed(1) + ' m'
}

export function formatArea(m2: number): string {
  if (m2 >= 1_000_000) return (m2 / 1_000_000).toFixed(2) + ' km²'
  return m2.toFixed(1) + ' m²'
}
