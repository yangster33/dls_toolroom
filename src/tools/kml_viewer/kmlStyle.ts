/**
 * KML 样式解析（纯 DOM，不依赖 Leaflet）。
 *
 * 从 KmlViewerPage.vue 抽出，便于单测覆盖 Style / StyleMap / 颜色转换。
 */

/** 把 KML AABBGGRR 或 BBGGRR 颜色转成 #RRGGBB */
export function kmlColorToHex(kmlColor: string): string {
  const cleaned = kmlColor.trim()
  // 6 位无 alpha 前缀（BBGGRR）
  if (cleaned.length === 6) {
    const rr = cleaned.substring(4, 6)
    const gg = cleaned.substring(2, 4)
    const bb = cleaned.substring(0, 2)
    return '#' + rr + gg + bb
  }
  // 标准 KML：AABBGGRR → #RRGGBB
  if (cleaned.length >= 8) {
    const rr = cleaned.substring(6, 8)
    const gg = cleaned.substring(4, 6)
    const bb = cleaned.substring(2, 4)
    return '#' + rr + gg + bb
  }
  return '#3388ff'
}

/** 读取元素下第一个 <color> 并转为 CSS hex */
export function parseKmlColorEl(el: Element): string | null {
  const colorEl = el.getElementsByTagName('color')[0]
  if (!colorEl?.textContent) return null
  return kmlColorToHex(colorEl.textContent.trim())
}

/**
 * 解析文档内所有 <Style> / <StyleMap>，返回 styleId（带 #）→ 颜色。
 *
 * 优先级：IconStyle（无 color 时用默认红色）→ LineStyle → PolyStyle；
 * StyleMap 的 normal 项会解析到目标 Style 的颜色。
 */
export function parseKmlStyles(xmlDoc: Document): Map<string, string> {
  const styles = new Map<string, string>()
  const styleEls = xmlDoc.getElementsByTagName('Style')
  for (let i = 0; i < styleEls.length; i++) {
    const el = styleEls[i]!
    const id = el.getAttribute('id')
    if (!id) continue
    // Try IconStyle first
    const iconStyle = el.getElementsByTagName('IconStyle')[0]
    if (iconStyle) {
      const color = parseKmlColorEl(iconStyle)
      // 即使没有 <color>，IconStyle 存在也登记默认图钉色
      styles.set('#' + id, color || '#EA4335')
    }
    // 再尝试 LineStyle / PolyStyle（IconStyle 已登记则不覆盖）
    if (!styles.has('#' + id)) {
      const lineStyle = el.getElementsByTagName('LineStyle')[0]
      if (lineStyle) {
        const color = parseKmlColorEl(lineStyle)
        if (color) styles.set('#' + id, color)
      }
    }
    if (!styles.has('#' + id)) {
      const polyStyle = el.getElementsByTagName('PolyStyle')[0]
      if (polyStyle) {
        const color = parseKmlColorEl(polyStyle)
        if (color) styles.set('#' + id, color)
      }
    }
  }
  // Parse StyleMap
  const styleMaps = xmlDoc.getElementsByTagName('StyleMap')
  for (let i = 0; i < styleMaps.length; i++) {
    const sm = styleMaps[i]!
    const mapId = sm.getAttribute('id')
    if (!mapId) continue
    const pairs = sm.getElementsByTagName('Pair')
    for (let j = 0; j < pairs.length; j++) {
      const pair = pairs[j]!
      const keyEl = pair.getElementsByTagName('key')[0]
      const styleUrlEl = pair.getElementsByTagName('styleUrl')[0]
      if (keyEl && styleUrlEl && keyEl.textContent === 'normal') {
        const refColor = styles.get(styleUrlEl.textContent?.trim() || '')
        if (refColor) styles.set('#' + mapId, refColor)
      }
    }
  }
  return styles
}
