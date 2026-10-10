import {
  type CoordinateSystemType,
  toWGS84,
  fromWGS84,
  validateCoordinate as validateCoord,
} from '@/utils/coordinateConverter'
import { type CGCS2000Params, validateCGCS2000Params } from '@/utils/coordTransform'
import { logger } from '@/utils/logger'

export {
  type CGCS2000Params,
  DEFAULT_CGCS2000_PARAMS,
  computeCentralMeridian,
  validateCGCS2000Params,
} from '@/utils/coordTransform'
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

  // 投影参数无效时直接失败，不再往下游传播 NaN（审计 P0-5）
  const paramError = validateCGCS2000Params(cgcs2000Params)
  if (paramError) {
    logger.error('CGCS2000 参数无效:', paramError)
    return null
  }

  const wgs84 = toWGS84(sys, x, y, cgcs2000Params)
  if (!wgs84 || !Number.isFinite(wgs84[0]) || !Number.isFinite(wgs84[1])) {
    return null
  }

  // 未成功转换的目标坐标用 NaN 占位，而不是 0 —— 0 是本初子午线/赤道，
  // 是一个合法坐标，会让用户以为转换成功。UI 层据此显示"转换失败"。
  const result: AllConversionResults = {
    wgs84: { lng: wgs84[0], lat: wgs84[1] },
    gcj02: { lng: Number.NaN, lat: Number.NaN },
    bd09: { lng: Number.NaN, lat: Number.NaN },
    amap: { lng: Number.NaN, lat: Number.NaN },
    cgcs2000_lnglat: { lng: Number.NaN, lat: Number.NaN },
    cgcs2000_xy: { x: Number.NaN, y: Number.NaN },
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
      // converted 可能是 [NaN, NaN]（proj4 出错时），只判 truthy 会让
      // NaN 静默流入结果 —— 这里要求两端都是有限数
      if (converted && Number.isFinite(converted[0]) && Number.isFinite(converted[1])) {
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
