/**
 * KML 生成器 — 将点位数据转为带颜色标记的 KML 文件
 *
 * 颜色方案：
 * - 中文颜色名：使用 Google 官方颜色 pushpin 图标（如 red-pushpin.png）
 * - Hex 颜色：使用白底图标 + IconStyle 颜色叠加
 * KML 颜色格式为 AABBGGRR（Alpha-Blue-Green-Red 各 2 位十六进制）。
 */
import type { PointRow } from './TemplateValidator'
import { hexToKmlColor, parseColor, isChineseColorName } from './ColorParser'

const WHITE_PUSHPIN = 'http://maps.google.com/mapfiles/kml/pushpin/wht-pushpin.png'

// 中文颜色名到 Google 图钉图标的映射
// Google Maps KML pushpin 官方图标只有 6 种：red, blue, grn(绿色), ylw(黄色), pink, wht(白色)
// 其他颜色（橙色、青色、紫色、灰色、棕色、黑色等）使用白底图标 + 颜色叠加
const CHINESE_COLOR_TO_PUSHPIN: Record<string, string> = {
  '#FF0000': 'red',
  '#FF3422': 'red',
  '#FF4500': 'red',
  '#8B0000': 'red',
  '#FF6B6B': 'red',
  '#FF00FF': 'pink',
  '#FFC0CB': 'pink',
  '#F47983': 'pink',
  '#FFFF00': 'ylw',
  '#FFD700': 'ylw',
  '#CC9900': 'ylw',
  '#FFFF99': 'ylw',
  '#FFEF00': 'ylw',
  '#00FF00': 'grn',
  '#006400': 'grn',
  '#90EE90': 'grn',
  '#003300': 'grn',
  '#00C957': 'grn',
  '#00A86B': 'grn',
  '#7CFC00': 'grn',
  '#0000FF': 'blue',
  '#00008B': 'blue',
  '#ADD8E6': 'blue',
  '#87CEEB': 'blue',
  '#30B4FF': 'blue',
  '#0033AA': 'blue',
  '#007FFF': 'blue',
  '#FFFFFF': 'wht',
  '#F5F5F5': 'wht',
}

/**
 * 判断是否应使用中文色名对应的 Google 官方图钉
 *
 * 必须看**用户原始输入**（colorRaw），不能看规范化后的 color —— 后者已被
 * `parseColor()` 转成 `#RRGGBB`，永远以 # 开头。审计报告 P0-3。
 */
function isChineseColor(row: PointRow): boolean {
  return isChineseColorName(row.colorRaw ?? row.color)
}

/** 获取中文颜色对应的 Google 图钉 URL */
function getChinesePushpinUrl(row: PointRow): string | null {
  const parsed = parseColor(row.colorRaw ?? row.color)
  if (!parsed) return null
  const pushpinColor = CHINESE_COLOR_TO_PUSHPIN[parsed]
  if (!pushpinColor) return null
  return `http://maps.google.com/mapfiles/kml/pushpin/${pushpinColor}-pushpin.png`
}

// 黑底白字的 LabelStyle 颜色（AABBGGRR：全透明背景 + 白色文字）
const LABEL_BLACK_BG_WHITE_TEXT = 'FFFFFFFF'

interface FolderGroup {
  name: string
  points: PointRow[]
}

/** 按文件夹分组 */
function groupByFolder(points: PointRow[]): FolderGroup[] {
  const map = new Map<string, PointRow[]>()
  for (const p of points) {
    const key = p.folder || '默认文件夹'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(p)
  }
  return [...map.entries()].map(([name, pts]) => ({ name, points: pts }))
}

/** 收集所有不重复的颜色，生成 Style 定义 */
function collectStyles(points: PointRow[]): Map<string, string> {
  const colorToId = new Map<string, string>()
  let idx = 0
  for (const p of points) {
    if (!colorToId.has(p.color)) {
      colorToId.set(p.color, `s${idx++}`)
    }
  }
  return colorToId
}

/**
 * 每种规范化颜色取一个代表行，用于读取 colorRaw（用户原始输入）。
 *
 * 审计报告 P0-3：样式去重以规范化 color 为 key，但中文色名图钉的判定
 * 需要原始输入，所以必须保留"这个颜色最早来自哪一行"。
 */
function collectRepresentativeRows(points: PointRow[]): Map<string, PointRow> {
  const rowByColor = new Map<string, PointRow>()
  for (const p of points) {
    if (!rowByColor.has(p.color)) rowByColor.set(p.color, p)
  }
  return rowByColor
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function generateKml(points: PointRow[]): string {
  const folders = groupByFolder(points)
  const styles = collectStyles(points)
  const stylesToRow = collectRepresentativeRows(points)

  const styleDefs: string[] = []
  for (const [color, id] of styles) {
    const row = stylesToRow.get(color)
    const isChinese = row ? isChineseColor(row) : false
    const pushpinUrl = isChinese && row ? getChinesePushpinUrl(row) : WHITE_PUSHPIN
    const kmlColor = isChinese ? 'FFFFFFFF' : hexToKmlColor(parseColor(color) || '#FFFFFF')

    styleDefs.push(`  <Style id="${id}">
    <IconStyle>
      <color>${kmlColor}</color>
      <scale>1.0</scale>
      <Icon>
        <href>${pushpinUrl || WHITE_PUSHPIN}</href>
      </Icon>
    </IconStyle>
    <LabelStyle>
      <color>${LABEL_BLACK_BG_WHITE_TEXT}</color>
      <scale>0.9</scale>
    </LabelStyle>
  </Style>`)
  }

  const folderXmls: string[] = []
  for (const folder of folders) {
    const placemarks: string[] = []
    for (const pt of folder.points) {
      const styleId = styles.get(pt.color) || 's0'
      placemarks.push(`    <Placemark>
      <name>${escapeXml(pt.name)}</name>
      <description>经度: ${pt.lng}, 纬度: ${pt.lat}</description>
      <styleUrl>#${styleId}</styleUrl>
      <Point>
        <coordinates>${pt.lng},${pt.lat},0</coordinates>
      </Point>
    </Placemark>`)
    }

    folderXmls.push(`  <Folder>
    <name>${escapeXml(folder.name)}</name>
${placemarks.join('\n')}
  </Folder>`)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>点位数据</name>
${styleDefs.join('\n')}

${folderXmls.join('\n')}
</Document>
</kml>`
}

/** 触发浏览器下载 KML 文件 */
export function downloadKml(points: PointRow[], filename?: string) {
  const kml = generateKml(points)
  const name = filename || `点位数据_${new Date().toISOString().slice(0, 10)}.kml`
  const blob = new Blob(['﻿' + kml], {
    type: 'application/vnd.google-earth.kml+xml;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}
