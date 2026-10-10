/**
 * 坐标/数值解析工具
 *
 * 历史 Bug（审计报告 P0-1）：
 *   早期实现用 `Number(row[alias])` 读表格单元格，而 `Number('')` **等于 0**。
 *   若某行「经度」单元格留空，`Number('') === 0` 落在 [-180, 180] 合法区间内，
 *   于是该行被当作 (0, x) —— 几内亚湾的一个点 —— 并通过校验。
 *   批量高程查询会真的向 Open-Meteo 请求这个坐标，返回一个看似合理的海拔；
 *   地址解析会返回一个真实的海洋地址。用户完全无法察觉。
 *
 *   旁证这是漏洞而非设计：同一份文件用 XLSX 导入会正常报错
 *   （sheet_to_json 不给空单元格建 key → `row[alias] !== undefined` 不成立），
 *   而 CSV 导入静默出错 —— 两条路径行为不一致。
 *
 * 本模块提供两个函数：
 *   `parseCoordinateValue` —— 严格坐标解析，空值/脏值一律返回 null
 *   `parseStrictNumber`   —— 严格数值解析，拒绝 '116.4abc' 这类宽松前缀
 */

/** 严格的十进制数字（可选正负号、小数、科学计数法） */
const STRICT_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/

/**
 * 严格解析数字字符串
 *
 * 与 `parseFloat` 的区别：`parseFloat('116.4abc')` 返回 116.4（宽松前缀解析），
 * 本函数对该输入返回 null。对于从其他系统复制粘贴来的坐标，这是常见场景。
 *
 * @param raw 表格单元格的原始值（string / number / undefined / null）
 * @returns 有限数字，或 null（表示"无法解析"）
 */
export function parseStrictNumber(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null
  }
  if (raw === undefined || raw === null) return null

  const trimmed = String(raw).trim()
  if (trimmed === '') return null
  if (!STRICT_NUMBER.test(trimmed)) return null

  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

/**
 * 解析坐标值并做范围校验
 *
 * @param raw   表格单元格原始值
 * @param min   允许的最小值（经度 -180 / 纬度 -90）
 * @param max   允许的最大值（经度 +180 / 纬度 +90）
 * @returns     合法坐标值，或 null（空值、非数字、越界）
 */
export function parseCoordinateValue(
  raw: unknown,
  min: number,
  max: number,
): number | null {
  const value = parseStrictNumber(raw)
  if (value === null) return null
  if (value < min || value > max) return null
  return value
}
