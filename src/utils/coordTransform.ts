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
 * 校验 CGCS2000 投影参数的每个字段。
 *
 * 历史 Bug（审计 P0-5）：`v-model.number` 在输入框被清空时产出 `''`，
 * 沿链路传到 `computeCentralMeridian('')` → `Math.round(NaN / 3) * 3`
 * → NaN，最终 proj4 返回 `[NaN, NaN]` 或被 catch 吞成 null，
 * 而调用方只校验 `length !== 2`，于是 NaN 被写进导出的 Excel。
 *
 * 这里集中做一次校验，让"无效参数"尽早变成一个明确的错误，
 * 而不是一路静默传播成 NaN。
 */
export function validateCGCS2000Params(p: CGCS2000Params): string | null {
  if (!Number.isFinite(p.centralMeridian)) {
    return '中央子午线经度必须是有效数字'
  }
  if (p.centralMeridian < -180 || p.centralMeridian > 180) {
    return '中央子午线经度应在 -180 ~ 180 之间'
  }
  if (!Number.isFinite(p.zoneWidth) || (p.zoneWidth !== 3 && p.zoneWidth !== 6)) {
    return '分带度数只能是 3 度带或 6 度带'
  }
  if (!Number.isFinite(p.originLatitude) || p.originLatitude < -90 || p.originLatitude > 90) {
    return '基准纬度应在 -90 ~ 90 之间'
  }
  // 比例因子为 0 会让 proj4 的 +k=0 无意义甚至抛错
  if (!Number.isFinite(p.scaleFactor) || p.scaleFactor === 0) {
    return '比例因子必须是非零的有效数字'
  }
  if (!Number.isFinite(p.falseEasting) || !Number.isFinite(p.falseNorthing)) {
    return '东偏/北偏常量必须是有效数字'
  }
  return null
}

/**
 * 根据 CGCS2000 参数构建 proj4 投影字符串
 *
 * @throws 参数无效时抛出带中文说明的 Error，不再静默产出含 NaN 的字符串
 */
export function buildCGCS2000ProjString(p: CGCS2000Params): string {
  const error = validateCGCS2000Params(p)
  if (error) {
    throw new Error(`CGCS2000 投影参数无效：${error}`)
  }

  const cm = computeCentralMeridian(p.centralMeridian, p.zoneWidth)
  return `+proj=tmerc +lat_0=${p.originLatitude} +lon_0=${cm} +k=${p.scaleFactor} +x_0=${p.falseEasting} +y_0=${p.falseNorthing} +ellps=GRS80 +units=m +no_defs`
}
