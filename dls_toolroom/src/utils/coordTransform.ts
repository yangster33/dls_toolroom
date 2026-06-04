/**
 * 共享的 CGCS2000 坐标系变换基础类型和函数
 * 由 coord_convert 和 coords_convert 共用
 */

/**
 * CGCS2000 投影参数接口
 */
export interface CGCS2000Params {
  centralMeridian: number
  zoneWidth: 3 | 6
  falseEasting: number
  falseNorthing: number
  scaleFactor: number
  originLatitude: number
}

/**
 * 默认 CGCS2000 投影参数
 */
export const DEFAULT_CGCS2000_PARAMS: CGCS2000Params = {
  centralMeridian: 108,
  zoneWidth: 3,
  falseEasting: 500000,
  falseNorthing: 0,
  scaleFactor: 1,
  originLatitude: 0,
}

/**
 * 计算中央经线
 */
export function computeCentralMeridian(inputLon: number, zoneWidth: 3 | 6): number {
  if (zoneWidth === 3) {
    return Math.round(inputLon / 3) * 3
  }
  return Math.round((inputLon - 3) / 6) * 6 + 3
}

/**
 * 根据 CGCS2000 参数构建 proj4 投影字符串
 */
export function buildCGCS2000ProjString(p: CGCS2000Params): string {
  const cm = computeCentralMeridian(p.centralMeridian, p.zoneWidth)
  return `+proj=tmerc +lat_0=${p.originLatitude} +lon_0=${cm} +k=${p.scaleFactor} +x_0=${p.falseEasting} +y_0=${p.falseNorthing} +ellps=GRS80 +units=m +no_defs`
}
