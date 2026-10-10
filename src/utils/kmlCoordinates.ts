/**
 * KML `<coordinates>` 解析工具
 *
 * KML 规范中 `<coordinates>` 的格式为「元组序列」：
 *   lon,lat[,alt] [或 , 换行] lon,lat[,alt] ...
 *
 * 现实中存在多种写法，必须全部兼容：
 *   1. `116.3,39.9,0 116.4,40.0,0`        —— Google Earth / ArcGIS（KML 2.0，带高程）
 *   2. `116.3, 39.9,0 116.4, 40.0,0`      —— 逗号后带空格（QGIS / 部分国内工具）
 *   3. `116.3,39.9,116.4,40.0`            —— KML 2.2，无高程，纯逗号
 *   4. `116.3,39.9,0,116.4,40.0,0`        —— 无空白分隔
 *   5. `116.3 39.9 116.4 40.0`            —— 空格分隔，无逗号
 *
 * 历史 Bug：早期实现直接 `text.split(/[\s\n]+/)`，遇到第 2 种写法（逗号后带空格）
 * 会把元组从中间切开，导致每个 token 的 `split(',').length < 2`，
 * 最终 LineString / Polygon 要素被静默丢弃。
 *
 * 本模块改为「提取全部数字 token + 按 stride 分组」，对上述 5 种写法均正确。
 */

/** 一个经纬度点（命名与 Leaflet 一致：lat/lng） */
export interface LatLngTuple {
  lat: number
  lng: number
}

/** 匹配单个数字：可选负号、小数、科学计数法 */
const NUMBER_PATTERN = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

/**
 * 提取字符串中的全部数字 token
 * @param text 原始文本
 * @returns 数值数组（无法解析为有限数的会被剔除）
 */
function extractNumbers(text: string): number[] {
  const matches = text.match(NUMBER_PATTERN)
  if (!matches) return []

  const numbers: number[] = []
  for (const raw of matches) {
    const value = Number(raw)
    // 剔除 NaN / Infinity
    if (Number.isFinite(value)) numbers.push(value)
  }
  return numbers
}

/**
 * 按 KML 规范的「元组间空白分隔」把文本切成元组片段
 *
 * KML 规范：`<coordinates>` 是元组序列，**元组间用空白分隔，元组内字段用逗号分隔**。
 * 这个空白边界是规范给我们的最强信号，比"数字个数能否整除"可靠得多。
 *
 * 现实中的坑：有些工具在逗号后也加空格（QGIS 及部分国产工具）：
 *   `116.3, 39.9,0 116.4, 40.0,0`
 * 直接按空白切会得到 ["116.3,", "39.9,0", "116.4,", "40.0,0"]，每个片段的
 * 字段数不一致。此时把「以逗号结尾的片段」与下一个片段合并即可还原元组。
 *
 * @returns 元组片段数组；无法切分时返回 null
 */
function splitIntoTuples(text: string): string[] | null {
  const rawSegments = text.trim().split(/\s+/).filter(Boolean)
  if (rawSegments.length === 0) return null

  const tuples: string[] = []
  let current = ''

  for (const seg of rawSegments) {
    current += (current ? ' ' : '') + seg
    // 以逗号结尾 → 这个元组还没写完，继续拼下一个片段
    if (seg.endsWith(',')) continue
    tuples.push(current)
    current = ''
  }
  if (current) tuples.push(current) // 兜底：结尾有未闭合的片段

  return tuples
}

/** 统计一段文本里的数字个数 */
function countNumbers(segment: string): number {
  const matches = segment.match(NUMBER_PATTERN)
  return matches ? matches.length : 0
}

/** 按给定 stride 切分，返回「坐标合法」的点数 */
function countValidPoints(numbers: number[], stride: number): number {
  let valid = 0
  for (let i = 0; i + 1 < numbers.length; i += stride) {
    const lng = numbers[i]
    const lat = numbers[i + 1]
    if (lng === undefined || lat === undefined) break
    if (lng < -180 || lng > 180) continue
    if (lat < -90 || lat > 90) continue
    valid++
  }
  return valid
}

/**
 * 推断元组宽度（stride）
 *
 * 四级策略，从可靠到兜底：
 * 1. 空白边界一致 —— 所有元组片段含相同数量的数字（2 或 3）→ 直接采用
 * 2. 纯空格分隔、每段 1 个数字 → 2（KML 2.2 的无逗号变体）
 * 3. 整除推断 —— 只能被 2 整除取 2，只能被 3 整除取 3
 * 4. 歧义区（可同时被 2 和 3 整除，如 6/12 个数字）——
 *    按「哪个 stride 能得到更多合法坐标」选择，平手时取 3（KML 2.0 规范
 *    的 lon,lat,alt 是标准形式）
 */
function inferStride(text: string, numbers: number[]): number {
  const numberCount = numbers.length

  // ── 策略 1 & 2：利用空白边界 ──
  const tuples = splitIntoTuples(text)
  if (tuples && tuples.length > 1) {
    const counts = tuples.map(countNumbers)

    if (counts.every((c) => c === counts[0])) {
      if (counts[0] === 2 || counts[0] === 3) return counts[0]
      if (counts[0] === 1) return 2 // 纯空格分隔，无逗号
    }
  }

  // ── 策略 3：整除推断 ──
  const divBy2 = numberCount % 2 === 0
  const divBy3 = numberCount % 3 === 0
  if (divBy2 && !divBy3) return 2
  if (divBy3 && !divBy2) return 3

  // ── 策略 4：歧义区 ──
  if (numberCount === 0) return 2
  const valid2 = countValidPoints(numbers, 2)
  const valid3 = countValidPoints(numbers, 3)
  // 平手时取 3：KML 2.0 的 lon,lat,alt 是规范标准形式，
  // 且带高程的写法更可能出自正规工具（Google Earth / ArcGIS）
  return valid3 >= valid2 ? 3 : 2
}

/**
 * 解析 KML `<coordinates>` 文本为经纬度点数组
 *
 * @param text `<coordinates>` 元素的文本内容
 * @returns 有效经纬度点数组（自动跳过 altitude、越界值与不完整元组）
 *
 * @example
 * parseKmlCoordinates('116.3, 39.9,0 116.4, 40.0,0')
 * // => [{ lat: 39.9, lng: 116.3 }, { lat: 40.0, lng: 116.4 }]
 */
export function parseKmlCoordinates(text: string | null | undefined): LatLngTuple[] {
  if (!text) return []

  // 去掉 BOM 与首尾空白，换行统一为 \n
  const clean = text.replace(/^\uFEFF/, '').trim()
  if (!clean) return []

  const numbers = extractNumbers(clean)
  // 少于 2 个数字不可能构成一个点
  if (numbers.length < 2) return []

  const stride = inferStride(clean, numbers)
  const points: LatLngTuple[] = []

  for (let i = 0; i + 1 < numbers.length; i += stride) {
    const lng = numbers[i]
    const lat = numbers[i + 1]
    if (lng === undefined || lat === undefined) break

    // 坐标范围校验：超出合法范围的直接丢弃，避免 Leaflet 收到 NaN / 非法值
    if (lng < -180 || lng > 180) continue
    if (lat < -90 || lat > 90) continue

    points.push({ lat, lng })
  }

  return points
}

/**
 * 将经纬度点数组序列化为导出工具使用的 `lon,lat;lon,lat` 格式
 *
 * @param points 经纬度点数组
 * @param precision 小数位数；**省略时保留原始精度**（推荐），
 *                  显式传值才会补零/截断。
 *                  GIS→Excel 等场景下截断用户输入的精度会造成数据损失，
 *                  因此默认不做任何舍入。
 * @returns 分号分隔的字符串；无有效点时返回空字符串
 */
export function formatCoordinates(points: LatLngTuple[], precision?: number): string {
  if (points.length === 0) return ''

  const fmt = (n: number): string => (precision === undefined ? String(n) : n.toFixed(precision))

  return points.map((p) => `${fmt(p.lng)},${fmt(p.lat)}`).join(';')
}

/**
 * 将经纬度点数组序列化为 KML `<coordinates>` 标准格式
 * （lon,lat,alt 元组，空格分隔）
 *
 * @param points 经纬度点数组
 * @param altitude 统一高程值（KML 默认 0）
 * @returns 空格分隔的 KML coordinates 字符串
 */
export function toKmlCoordinatesString(points: LatLngTuple[], altitude: number = 0): string {
  if (points.length === 0) return ''
  return points.map((p) => `${p.lng},${p.lat},${altitude}`).join(' ')
}
