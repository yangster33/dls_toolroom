import gcoord from 'gcoord'
import proj4 from 'proj4'
import { type CGCS2000Params, buildCGCS2000ProjString } from './coordTransform'

proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs')
proj4.defs('EPSG:4490', '+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs')

export type CoordinateSystemType =
  | 'wgs84'
  | 'gcj02'
  | 'bd09'
  | 'amap'
  | 'cgcs2000_lnglat'
  | 'cgcs2000_xy'

const COORDINATE_SYSTEMS = {
  wgs84: {
    type: 'lnglat' as const,
    gcoordType: gcoord.WGS84,
    proj4Def: 'EPSG:4326',
    displayName: 'WGS84',
  },
  gcj02: {
    type: 'lnglat' as const,
    gcoordType: gcoord.GCJ02,
    proj4Def: null,
    displayName: 'GCJ-02',
  },
  bd09: {
    type: 'lnglat' as const,
    gcoordType: gcoord.BD09,
    proj4Def: null,
    displayName: '百度 BD-09',
  },
  amap: {
    type: 'lnglat' as const,
    gcoordType: gcoord.GCJ02,
    proj4Def: null,
    displayName: '高德地图',
  },
  cgcs2000_lnglat: {
    type: 'lnglat' as const,
    gcoordType: null,
    proj4Def: 'EPSG:4490',
    displayName: 'CGCS2000(经纬度)',
  },
  cgcs2000_xy: {
    type: 'xy' as const,
    gcoordType: null,
    proj4Def: null,
    displayName: 'CGCS2000(平面坐标)',
  },
} as const

export function toWGS84(
  sys: CoordinateSystemType,
  x: number,
  y: number,
  cgcs2000Params: CGCS2000Params,
): [number, number] | null {
  try {
    const config = COORDINATE_SYSTEMS[sys]

    if (sys === 'wgs84') {
      return [x, y]
    }

    if (config.gcoordType) {
      return gcoord.transform([x, y], config.gcoordType, gcoord.WGS84) as [number, number]
    }

    if (sys === 'cgcs2000_lnglat') {
      return proj4('EPSG:4490', 'EPSG:4326', [x, y]) as [number, number]
    }

    if (sys === 'cgcs2000_xy') {
      const projStr = buildCGCS2000ProjString(cgcs2000Params)
      const lnglat = proj4(projStr, 'EPSG:4490', [x, y])
      return proj4('EPSG:4490', 'EPSG:4326', lnglat) as [number, number]
    }

    return null
  } catch {
    return null
  }
}

export function fromWGS84(
  sys: CoordinateSystemType,
  lng: number,
  lat: number,
  cgcs2000Params: CGCS2000Params,
): [number, number] | null {
  try {
    const config = COORDINATE_SYSTEMS[sys]

    if (sys === 'wgs84') {
      return [lng, lat]
    }

    if (config.gcoordType) {
      return gcoord.transform([lng, lat], gcoord.WGS84, config.gcoordType) as [number, number]
    }

    if (sys === 'cgcs2000_lnglat') {
      const result = proj4('EPSG:4326', 'EPSG:4490', [lng, lat])
      return [result[0] ?? 0, result[1] ?? 0]
    }

    if (sys === 'cgcs2000_xy') {
      const projStr = buildCGCS2000ProjString(cgcs2000Params)
      const result = proj4('EPSG:4326', projStr, [lng, lat])
      return [result[0] ?? 0, result[1] ?? 0]
    }

    return null
  } catch {
    return null
  }
}

export function convert(
  from: CoordinateSystemType,
  to: CoordinateSystemType,
  x: number,
  y: number,
  cgcs2000Params: CGCS2000Params,
): [number, number] | null {
  if (from === to) {
    return [x, y]
  }

  const wgs84 = toWGS84(from, x, y, cgcs2000Params)
  if (!wgs84) return null

  return fromWGS84(to, wgs84[0], wgs84[1], cgcs2000Params)
}

export function validateCoordinate(
  sys: CoordinateSystemType,
  x: number,
  y: number,
): { isValid: boolean; error?: string } {
  if (isNaN(x) || isNaN(y)) {
    return { isValid: false, error: '坐标必须为有效数字' }
  }

  const isLngLat = ['wgs84', 'gcj02', 'bd09', 'amap', 'cgcs2000_lnglat'].includes(sys)

  if (isLngLat) {
    if (Math.abs(x) > 180 || Math.abs(y) > 90) {
      return { isValid: false, error: '经纬度超出有效范围(经度: -180~180, 纬度: -90~90)' }
    }
    if (sys === 'bd09' && (x < 73.66 || x > 135.05 || y < 3.86 || y > 53.55)) {
      return { isValid: false, error: 'BD-09坐标超出中国范围' }
    }
  } else if (sys === 'cgcs2000_xy') {
    if (Math.abs(x) > 10000000 || Math.abs(y) > 10000000) {
      return { isValid: false, error: '平面坐标值过大' }
    }
  }

  return { isValid: true }
}

export { COORDINATE_SYSTEMS }