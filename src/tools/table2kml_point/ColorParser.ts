/**
 * 中文颜色名 → 十六进制映射，以及 KML 颜色格式转换
 * KML 颜色格式: AABBGGRR (Alpha/Blue/Green/Red)
 */

const CHINESE_COLOR_MAP: Record<string, string> = {
  红: '#FF0000', 红色: '#FF0000', 赤: '#FF0000', 朱: '#FF3422', 丹: '#FF4500',
  深红: '#8B0000', 暗红: '#8B0000', 浅红: '#FF6B6B', 大红: '#FF0000',
  粉红: '#FFC0CB', 桃红: '#F47983', 品红: '#FF00FF', 洋红: '#FF00FF',

  橙: '#FFA500', 橙色: '#FFA500', 橘: '#FF8C00', 橘色: '#FF8C00', 桔: '#FF8C00',
  深橙: '#FF8C00', 浅橙: '#FFD39B',

  黄: '#FFFF00', 黄色: '#FFFF00', 金黄: '#FFD700', 深黄: '#CC9900',
  浅黄: '#FFFF99', 明黄: '#FFEF00',

  绿: '#00FF00', 绿色: '#00FF00', 深绿: '#006400', 浅绿: '#90EE90',
  墨绿: '#003300', 翠绿: '#00C957', 碧绿: '#00A86B', 草绿: '#7CFC00',

  蓝: '#0000FF', 蓝色: '#0000FF', 深蓝: '#00008B', 浅蓝: '#ADD8E6',
  天蓝: '#87CEEB', 湖蓝: '#30B4FF', 宝蓝: '#0033AA', 靛蓝: '#4B0080',
  蔚蓝: '#007FFF',

  青: '#00FFFF', 青色: '#00FFFF',

  紫: '#800080', 紫色: '#800080', 深紫: '#4B0080', 浅紫: '#DDA0DD',
  蓝紫: '#8A2BE2', 薰衣草: '#E6E6FA',

  黑: '#000000', 黑色: '#000000', 墨: '#000000',

  白: '#FFFFFF', 白色: '#FFFFFF', 素: '#F5F5F5',

  灰: '#808080', 灰色: '#808080', 银灰: '#C0C0C0', 深灰: '#555555',
  浅灰: '#D3D3D3', 银: '#C0C0C0', 银色: '#C0C0C0',

  粉: '#FFC0CB', 粉色: '#FFC0CB',

  棕: '#A52A2A', 棕色: '#A52A2A', 褐色: '#8B4513', 咖啡: '#6B4226',
  茶色: '#D2B48C', 栗色: '#800000',

  金: '#FFD700', 金色: '#FFD700',
}

const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * 识别颜色字符串（中文名或 hex）并返回标准 hex 6 位格式
 * 无法识别时返回 null
 */
export function parseColor(input: string | null | undefined): string | null {
  if (!input) return null

  const trimmed = input.trim()

  // 先查中文映射
  if (CHINESE_COLOR_MAP[trimmed]) {
    return CHINESE_COLOR_MAP[trimmed]!
  }

  // 再匹配 hex
  const hexMatch = trimmed.match(HEX_REGEX)
  if (hexMatch) {
    let hex = hexMatch[0]!
    if (hex.length === 4) {
      // 3 位短写 → 6 位
      hex = '#' + hex[1]! + hex[1]! + hex[2]! + hex[2]! + hex[3]! + hex[3]!
    }
    return hex.toUpperCase()
  }

  return null
}

/**
 * 将 CSS hex (#RRGGBB) 转为 KML 颜色格式 (AABBGGRR)
 * @param hex CSS 颜色，如 "#FF0000"
 * @param alpha 透明度 0-1，默认 1（不透明）
 */
export function hexToKmlColor(hex: string, alpha: number = 1): string {
  // 去掉 # 前缀
  const clean = hex.replace('#', '')
  const r = clean.substring(0, 2)
  const g = clean.substring(2, 4)
  const b = clean.substring(4, 6)
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
  // KML: AABBGGRR
  return `${a}${b}${g}${r}`
}

/**
 * 验证颜色是否合法（中文名或 hex）
 */
export function isValidColor(input: string | null | undefined): boolean {
  return parseColor(input) !== null
}
