import {
  type CoordinateSystemType,
  toWGS84,
  fromWGS84,
  validateCoordinate as validateCoord,
} from '@/utils/coordinateConverter'
import { type CGCS2000Params } from '@/utils/coordTransform'

export { type CGCS2000Params, DEFAULT_CGCS2000_PARAMS, computeCentralMeridian } from '@/utils/coordTransform'
export { type CoordinateSystemType } from '@/utils/coordinateConverter'

interface CoordinateResult {
  lng: number
  lat: number
}

interface ProjectedCoordinateResult {
  x: number
  y: number
}

export interface AllConversionResults {
  wgs84: CoordinateResult
  gcj02: CoordinateResult
  bd09: CoordinateResult
  amap: CoordinateResult
  cgcs2000_lnglat: CoordinateResult
  cgcs2000_xy: ProjectedCoordinateResult
}

interface ValidationResult {
  isValid: boolean
  x: number | null
  y: number | null
  error?: string
}

export function validateCoordinate(
  sys: CoordinateSystemType,
  xStr: string,
  yStr: string,
): ValidationResult {
  const x = parseFloat(xStr)
  const y = parseFloat(yStr)

  if (isNaN(x) || isNaN(y)) {
    return { isValid: false, x: null, y: null, error: '坐标必须为有效数字' }
  }

  const validation = validateCoord(sys, x, y)
  if (!validation.isValid) {
    return { isValid: false, x: null, y: null, error: validation.error }
  }

  return { isValid: true, x, y }
}

export function convertAll(
  sys: CoordinateSystemType,
  xStr: string,
  yStr: string,
  cgcs2000Params: CGCS2000Params,
): AllConversionResults | null {
  const validation = validateCoordinate(sys, xStr, yStr)
  if (!validation.isValid || validation.x === null || validation.y === null) {
    return null
  }

  const x = validation.x
  const y = validation.y

  const wgs84 = toWGS84(sys, x, y, cgcs2000Params)
  if (!wgs84) return null

  const result: AllConversionResults = {
    wgs84: { lng: 0, lat: 0 },
    gcj02: { lng: 0, lat: 0 },
    bd09: { lng: 0, lat: 0 },
    amap: { lng: 0, lat: 0 },
    cgcs2000_lnglat: { lng: 0, lat: 0 },
    cgcs2000_xy: { x: 0, y: 0 },
  }

  const targetSystems: CoordinateSystemType[] = [
    'wgs84',
    'gcj02',
    'bd09',
    'amap',
    'cgcs2000_lnglat',
    'cgcs2000_xy',
  ]

  for (const targetSys of targetSystems) {
    if (targetSys === sys) {
      if (sys === 'cgcs2000_xy') {
        result.cgcs2000_xy = { x, y }
      } else {
        const coordinateResult = result[targetSys]
        if ('lng' in coordinateResult && 'lat' in coordinateResult) {
          coordinateResult.lng = x
          coordinateResult.lat = y
        }
      }
    } else {
      const converted = fromWGS84(targetSys, wgs84[0], wgs84[1], cgcs2000Params)
      if (converted) {
        if (targetSys === 'cgcs2000_xy') {
          result.cgcs2000_xy = { x: converted[0], y: converted[1] }
        } else {
          const targetResult = result[targetSys] as CoordinateResult
          targetResult.lng = converted[0]
          targetResult.lat = converted[1]
        }
      }
    }
  }

  return result
}