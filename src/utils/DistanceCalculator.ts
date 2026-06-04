/**
 * 距离传感器 - 核心距离计算模块
 *
 * 算法：纬度排序索引 + 渐进半径搜索 + 三级过滤（纬度→经度→球面余弦）
 * 参照 VB 优化版的思路重写，替换原来的 H3 方案
 */

export interface LocationPoint {
  name: string
  longitude: number
  latitude: number
}

export interface DistanceMatch {
  point1: LocationPoint
  point2: LocationPoint
  distance: number // 单位：米
}

export interface MatchOptions {
  minDistance?: number
  maxDistance?: number
  matchCount: number
  matchMode: 'nearest' | 'farthest'
}

export interface MatchResult {
  results: SiteMatchResult[]
  mode: 'same-site' | 'different-site'
}

export interface SiteMatchResult {
  site: LocationPoint
  matches: Array<{
    site: LocationPoint
    distance: number
  }>
}

export interface ProgressCallback {
  (progress: number, message: string): void
}

/** 匹配算法可调配置 */
export interface MatchConfig {
  /** 星球半径（米），默认地球 6371000 */
  planetRadius: number
  /** 初始搜索半径（米），默认 200 */
  initialSearchRadius: number
  /** 搜索失败后半径扩大倍数（有候选但不够时），默认 1.5 */
  radiusMultiplier: number
  /** 搜索失败后半径扩大倍数（无任何候选时），默认 4 */
  radiusMultiplierAggressive: number
  /** 单点搜索最大迭代次数，默认 50 */
  maxIterations: number
  /** 分片大小（每批处理站点数），默认 100 */
  chunkSize: number
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  planetRadius: 6371000,
  initialSearchRadius: 200,
  radiusMultiplier: 1.5,
  radiusMultiplierAggressive: 4,
  maxIterations: 50,
  chunkSize: 100,
}

// 常见星球半径（米）
export const PLANET_PRESETS: Record<string, number> = {
  '地球': 6371000,
  '月球': 1737100,
  '火星': 3390000,
  '金星': 6051800,
}

const DEG_TO_RAD = Math.PI / 180

// ---- 内部数据结构 ----

/** 预处理后的目标点：弧度 + cos 缓存，按纬度排序 */
interface IndexedPoint {
  name: string
  longitude: number // 原始度数
  latitude: number
  lonRad: number
  latRad: number
  cosLat: number
  sinLat: number
}

// ---- 公共工具 ----

export function toRad(deg: number): number {
  return deg * DEG_TO_RAD
}

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  planetRadius = DEFAULT_MATCH_CONFIG.planetRadius,
): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return planetRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function isValidCoordinate(lat: number, lon: number): boolean {
  return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}

// ---- 球面余弦距离（比 haversine 少一个 sqrt + atan2）----

function sphericalCosDistance(
  lat1: number,
  sinLat1: number,
  cosLat1: number,
  lonRad1: number,
  lat2: number,
  sinLat2: number,
  cosLat2: number,
  lonRad2: number,
  planetRadius: number,
): number {
  const dLon = lonRad1 - lonRad2
  const cosC = sinLat1 * sinLat2 + cosLat1 * cosLat2 * Math.cos(dLon)
  const clamped = cosC > 1 ? 1 : cosC < -1 ? -1 : cosC
  return planetRadius * Math.acos(clamped)
}

// ---- 数据预处理 ----

/** 转为弧度并计算 cosLat/sinLat 缓存，按纬度升序排列 */
function prepareTarget(points: LocationPoint[]): IndexedPoint[] {
  const result: IndexedPoint[] = new Array(points.length)
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!
    const latRad = p.latitude * DEG_TO_RAD
    const lonRad = p.longitude * DEG_TO_RAD
    result[i] = {
      name: p.name,
      longitude: p.longitude,
      latitude: p.latitude,
      latRad,
      lonRad,
      cosLat: Math.cos(latRad),
      sinLat: Math.sin(latRad),
    }
  }
  result.sort((a, b) => a.latRad - b.latRad)
  return result
}

// ---- 二分查找 ----

/** 在按 latRad 排序的数组中找第一个 latRad >= target 的索引 */
function lowerBound(sorted: IndexedPoint[], target: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sorted[mid]!.latRad < target) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

/** 在按 latRad 排序的数组中找第一个 latRad > target 的索引 */
function upperBound(sorted: IndexedPoint[], target: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sorted[mid]!.latRad <= target) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

// ---- 距离比较：判断是否"完全相同"坐标 ----

const SAME_COORD_EPSILON = 0.000001

function isSameCoord(a: LocationPoint, b: LocationPoint): boolean {
  return (
    a.name === b.name &&
    Math.abs(a.longitude - b.longitude) < SAME_COORD_EPSILON &&
    Math.abs(a.latitude - b.latitude) < SAME_COORD_EPSILON
  )
}

// 用预缓存的弧度比较，避免重复转换
function isSameCoordRad(
  src: LocationPoint,
  tgt: IndexedPoint,
  lonRad: number,
  latRad: number,
): boolean {
  return (
    src.name === tgt.name &&
    Math.abs(lonRad - tgt.lonRad) < SAME_COORD_EPSILON * DEG_TO_RAD &&
    Math.abs(latRad - tgt.latRad) < SAME_COORD_EPSILON * DEG_TO_RAD
  )
}

// ---- Top-K 维护 ----

type Candidate = { site: LocationPoint; distance: number }

/** 检查候选是否已在 Top-K 中（相同坐标视为重复） */
function hasCandidate(arr: Candidate[], item: Candidate): boolean {
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i]!.site
    if (
      Math.abs(s.longitude - item.site.longitude) < SAME_COORD_EPSILON &&
      Math.abs(s.latitude - item.site.latitude) < SAME_COORD_EPSILON
    ) {
      return true
    }
  }
  return false
}

/** 将候选插入已排序数组，保持升序，去重，最多保留 K 个 */
function insertSortedAsc(arr: Candidate[], item: Candidate, k: number): void {
  if (arr.length >= k && item.distance >= arr[arr.length - 1]!.distance) return
  if (hasCandidate(arr, item)) return

  let i = arr.length
  while (i > 0 && arr[i - 1]!.distance > item.distance) {
    i--
  }
  arr.splice(i, 0, item)
  if (arr.length > k) arr.length = k
}

/** 将候选插入已排序数组，保持降序，去重，最多保留 K 个 */
function insertSortedDesc(arr: Candidate[], item: Candidate, k: number): void {
  if (arr.length >= k && item.distance <= arr[arr.length - 1]!.distance) return
  if (hasCandidate(arr, item)) return

  let i = arr.length
  while (i > 0 && arr[i - 1]!.distance < item.distance) {
    i--
  }
  arr.splice(i, 0, item)
  if (arr.length > k) arr.length = k
}

// ---- 单个站点的匹配 ----

/**
 * 对单个源站点，用渐进半径在目标集中找 K 个最近匹配
 */
function matchOneNearest(
  src: LocationPoint,
  srcLonRad: number,
  srcLatRad: number,
  srcSinLat: number,
  srcCosLat: number,
  target: IndexedPoint[],
  options: MatchOptions,
  cfg: MatchConfig,
  skipSelf: boolean,
): Candidate[] {
  const k = options.matchCount
  const minDist = options.minDistance
  const maxDist = options.maxDistance
  const maxDistRad = maxDist !== undefined ? maxDist / cfg.planetRadius : Math.PI
  const topK: Candidate[] = []

  const n = target.length
  if (n === 0) return topK

  let radiusRad = cfg.initialSearchRadius / cfg.planetRadius
  const maxRadiusRad = maxDistRad

  for (let iter = 0; iter < cfg.maxIterations; iter++) {
    if (radiusRad > maxRadiusRad) radiusRad = maxRadiusRad

    // 1. 纬度窗口
    const minLat = srcLatRad - radiusRad
    const maxLat = srcLatRad + radiusRad
    const start = lowerBound(target, minLat)
    const end = upperBound(target, maxLat)

    // 2. 经度窗口阈值（sin 在 π/2 后递减，需截断避免窗口错误收缩）
    const cosLatSrc = Math.cos(srcLatRad)
    const sinR = Math.sin(Math.min(radiusRad, Math.PI / 2))
    let deltaLon = Math.PI
    if (cosLatSrc > 1e-10) {
      const val = sinR / cosLatSrc
      deltaLon = val >= 1 ? Math.PI : Math.asin(val)
    }
    const minLon = srcLonRad - deltaLon
    const maxLon = srcLonRad + deltaLon

    // 3. 遍历窗口内的候选点
    let foundAny = false
    for (let j = start; j < end; j++) {
      const t = target[j]!

      if (t.lonRad < minLon || t.lonRad > maxLon) continue
      if (skipSelf && isSameCoordRad(src, t, srcLonRad, srcLatRad)) continue

      let distance: number
      if (
        Math.abs(srcLatRad - t.latRad) < 1e-7 &&
        Math.abs(srcLonRad - t.lonRad) < 1e-7
      ) {
        distance = 0
      } else {
        distance = sphericalCosDistance(
          srcLatRad, srcSinLat, srcCosLat, srcLonRad,
          t.latRad, t.sinLat, t.cosLat, t.lonRad,
          cfg.planetRadius,
        )
      }

      if (minDist !== undefined && distance < minDist) continue
      if (maxDist !== undefined && distance > maxDist) continue

      insertSortedAsc(topK, { site: t, distance }, k)
      foundAny = true
    }

    if (
      topK.length >= k &&
      topK[k - 1]!.distance <= radiusRad * cfg.planetRadius
    ) {
      break
    }

    if (radiusRad >= maxRadiusRad) break

    radiusRad *= foundAny ? cfg.radiusMultiplier : cfg.radiusMultiplierAggressive

    if (radiusRad >= maxRadiusRad) {
      radiusRad = maxRadiusRad
      if (iter > 0) break
    }
  }

  return topK
}

/**
 * 对单个源站点，在目标集中找 K 个最远匹配
 * 直接搜索全量 maxDistance 范围，不适用渐进半径
 */
function matchOneFarthest(
  src: LocationPoint,
  srcLonRad: number,
  srcLatRad: number,
  srcSinLat: number,
  srcCosLat: number,
  target: IndexedPoint[],
  options: MatchOptions,
  cfg: MatchConfig,
  skipSelf: boolean,
): Candidate[] {
  const k = options.matchCount
  const minDist = options.minDistance
  const maxDist = options.maxDistance
  const topK: Candidate[] = []

  const maxDistRad = maxDist !== undefined ? maxDist / cfg.planetRadius : Math.PI

  const minLat = srcLatRad - maxDistRad
  const maxLat = srcLatRad + maxDistRad
  const start = lowerBound(target, minLat)
  const end = upperBound(target, maxLat)

  const cosLatSrc = Math.cos(srcLatRad)
  const sinR = Math.sin(Math.min(maxDistRad, Math.PI / 2))
  let deltaLon = Math.PI
  if (cosLatSrc > 1e-10) {
    const val = sinR / cosLatSrc
    deltaLon = val >= 1 ? Math.PI : Math.asin(val)
  }
  const minLon = srcLonRad - deltaLon
  const maxLon = srcLonRad + deltaLon

  for (let j = start; j < end; j++) {
    const t = target[j]!

    if (t.lonRad < minLon || t.lonRad > maxLon) continue
    if (skipSelf && isSameCoordRad(src, t, srcLonRad, srcLatRad)) continue

    let distance: number
    if (
      Math.abs(srcLatRad - t.latRad) < 1e-7 &&
      Math.abs(srcLonRad - t.lonRad) < 1e-7
    ) {
      distance = 0
    } else {
      distance = sphericalCosDistance(
        srcLatRad, srcSinLat, srcCosLat, srcLonRad,
        t.latRad, t.sinLat, t.cosLat, t.lonRad,
        cfg.planetRadius,
      )
    }

    if (minDist !== undefined && distance < minDist) continue
    if (maxDist !== undefined && distance > maxDist) continue

    insertSortedDesc(topK, { site: t, distance }, k)
  }

  return topK
}

// ---- 批量匹配 ----

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * 同站址匹配 - 在 src 集中找每个站点的 K 个近邻
 */
async function matchSameSite(
  src: LocationPoint[],
  options: MatchOptions,
  cfg: MatchConfig,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<SiteMatchResult[]> {
  const n = src.length
  if (n < 2) {
    return src.map((site) => ({ site, matches: [] }))
  }

  const target = prepareTarget(src)
  const results: SiteMatchResult[] = []

  for (let i = 0; i < n; i++) {
    if (signal?.aborted) break

    const site = src[i]!
    const latRad = site.latitude * DEG_TO_RAD
    const lonRad = site.longitude * DEG_TO_RAD
    const sinLat = Math.sin(latRad)
    const cosLat = Math.cos(latRad)

    const matchFn =
      options.matchMode === 'nearest' ? matchOneNearest : matchOneFarthest

    const candidates = matchFn(
      site, lonRad, latRad, sinLat, cosLat,
      target, options, cfg, /* skipSelf */ true,
    )

    results.push({
      site,
      matches: candidates.map((c) => ({
        site: {
          name: c.site.name,
          longitude: c.site.longitude,
          latitude: c.site.latitude,
        },
        distance: c.distance,
      })),
    })

    if (i % cfg.chunkSize === 0) {
      if (onProgress) {
        onProgress(Math.round(((i + 1) / n) * 100), `正在处理站点 ${i + 1}/${n}...`)
      }
      if (signal?.aborted) break
      await yieldToBrowser()
    }
  }

  if (signal?.aborted && onProgress) onProgress(0, '计算已终止')
  else if (onProgress) onProgress(100, `已完成 ${n} 个站点的匹配`)

  return results
}

/**
 * 异站址匹配 - data1 是源，data2 是目标
 * 预处理 data2（目标集），data1 按原始顺序遍历
 */
async function matchDifferentSite(
  data1: LocationPoint[],
  data2: LocationPoint[],
  options: MatchOptions,
  cfg: MatchConfig,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<SiteMatchResult[]> {
  const m = data1.length
  if (m === 0 || data2.length === 0) {
    return data1.map((site) => ({ site, matches: [] }))
  }

  // 只预处理目标集 data2
  const target = prepareTarget(data2)
  const results: SiteMatchResult[] = []

  for (let i = 0; i < m; i++) {
    if (signal?.aborted) break

    const site = data1[i]!
    const latRad = site.latitude * DEG_TO_RAD
    const lonRad = site.longitude * DEG_TO_RAD
    const sinLat = Math.sin(latRad)
    const cosLat = Math.cos(latRad)

    const matchFn =
      options.matchMode === 'nearest' ? matchOneNearest : matchOneFarthest

    const candidates = matchFn(
      site, lonRad, latRad, sinLat, cosLat,
      target, options, cfg, /* skipSelf */ false,
    )

    results.push({
      site,
      matches: candidates.map((c) => ({
        site: {
          name: c.site.name,
          longitude: c.site.longitude,
          latitude: c.site.latitude,
        },
        distance: c.distance,
      })),
    })

    if (i % cfg.chunkSize === 0) {
      if (onProgress) {
        onProgress(Math.round(((i + 1) / m) * 100), `正在处理站点 ${i + 1}/${m}...`)
      }
      if (signal?.aborted) break
      await yieldToBrowser()
    }
  }

  if (signal?.aborted && onProgress) onProgress(0, '计算已终止')
  else if (onProgress) onProgress(100, `已完成 ${m} 个站点的匹配`)

  return results
}

// ---- 判断同/异站址 ----

function isSameSiteData(data1: LocationPoint[], data2: LocationPoint[]): boolean {
  if (data1.length !== data2.length) return false
  for (let i = 0; i < data1.length; i++) {
    if (!isSameCoord(data1[i]!, data2[i]!)) return false
  }
  return true
}

// ---- 主入口 ----

export async function matchDistances(
  data1: LocationPoint[],
  data2: LocationPoint[],
  options: MatchOptions,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
  config?: MatchConfig,
): Promise<MatchResult> {
  const cfg = config ?? DEFAULT_MATCH_CONFIG
  const mode = isSameSiteData(data1, data2) ? 'same-site' : 'different-site'

  let results: SiteMatchResult[]

  if (mode === 'same-site') {
    results = await matchSameSite(data1, options, cfg, onProgress, signal)
  } else {
    // data2(456列) 遍历，data1(123列) 做目标索引
    results = await matchDifferentSite(data2, data1, options, cfg, onProgress, signal)
  }

  return { results, mode }
}
