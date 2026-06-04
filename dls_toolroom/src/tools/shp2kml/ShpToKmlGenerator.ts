/**
 * SHP → KML 生成器
 * 将多个 SHP 文件（含样式配置）合并导出为单个 KML 文件
 * 每个 SHP 一个 Folder，样式按 type+color+width 自动去重
 */

import type { GisFeature } from '../gis2excel/GisFileReader'
import { hexToKmlColor } from '../table2kml_point/ColorParser'

// ============================================================
// 类型定义
// ============================================================

export interface PointStyle {
  color: string // hex #RRGGBB
}

export interface LineStyle {
  color: string // hex #RRGGBB
  width: number
}

export interface PolygonStyle {
  strokeColor: string // hex #RRGGBB
  fillColor: string // hex #RRGGBB
  strokeWidth: number
}

export type GisStyle = PointStyle | LineStyle | PolygonStyle

export interface ShpExportEntry {
  folderName: string
  nameTemplate?: string
  type: 'Point' | 'LineString' | 'Polygon'
  features: GisFeature[]
  style: GisStyle
}

// ============================================================
// XML 工具
// ============================================================

const WHITE_PUSHPIN = 'http://maps.google.com/mapfiles/kml/pushpin/wht-pushpin.png'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function coordToKml(coordStr: string): string {
  // coordStr: "116.3,39.9;116.4,40.0"
  const pairs = coordStr.split(';').filter(Boolean)
  return pairs
    .map((pair) => {
      const [lng, lat] = pair.split(',')
      return `${lng},${lat},0`
    })
    .join(' ')
}

function generateNameFromTemplate(
  properties: Record<string, unknown>,
  name: string,
  template?: string
): string {
  if (!template) return name

  const context = {
    name,
    ...properties,
  }

  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const val = (context as Record<string, unknown>)[key]
    return val != null ? String(val) : ''
  })
}

// ============================================================
// Style ID 生成 & 去重
// ============================================================

function getStyleId(type: string, style: GisStyle): string {
  if (type === 'Point') {
    const s = style as PointStyle
    return `p_${s.color.replace('#', '').toLowerCase()}`
  }
  if (type === 'LineString') {
    const s = style as LineStyle
    return `l_${s.color.replace('#', '').toLowerCase()}_${s.width}`
  }
  // Polygon
  const s = style as PolygonStyle
  return `g_${s.fillColor.replace('#', '').toLowerCase()}_${s.strokeColor.replace('#', '').toLowerCase()}_${s.strokeWidth}`
}

function collectStyleDefs(entries: ShpExportEntry[]): Map<string, string> {
  const map = new Map<string, string>()
  const seen = new Set<string>()

  for (const entry of entries) {
    const id = getStyleId(entry.type, entry.style)
    if (seen.has(id)) continue
    seen.add(id)

    let xml = ''

    if (entry.type === 'Point') {
      const s = entry.style as PointStyle
      const kmlColor = hexToKmlColor(s.color)
      xml = `  <Style id="${id}">
    <IconStyle>
      <color>${kmlColor}</color>
      <scale>1.0</scale>
      <Icon>
        <href>${WHITE_PUSHPIN}</href>
      </Icon>
    </IconStyle>
    <LabelStyle>
      <scale>0.9</scale>
    </LabelStyle>
  </Style>`
    } else if (entry.type === 'LineString') {
      const s = entry.style as LineStyle
      const kmlColor = hexToKmlColor(s.color, 1)
      xml = `  <Style id="${id}">
    <LineStyle>
      <color>${kmlColor}</color>
      <width>${s.width}</width>
    </LineStyle>
  </Style>`
    } else {
      // Polygon
      const s = entry.style as PolygonStyle
      const fillKml = hexToKmlColor(s.fillColor, 0.5)
      const strokeKml = hexToKmlColor(s.strokeColor)
      xml = `  <Style id="${id}">
    <LineStyle>
      <color>${strokeKml}</color>
      <width>${s.strokeWidth}</width>
    </LineStyle>
    <PolyStyle>
      <color>${fillKml}</color>
      <fill>1</fill>
      <outline>1</outline>
    </PolyStyle>
  </Style>`
    }

    map.set(id, xml)
  }

  return map
}

// ============================================================
// KML 生成
// ============================================================

export function generateKml(entries: ShpExportEntry[]): string {
  const styleDefs = collectStyleDefs(entries)

  const folderXmls: string[] = []

  for (const entry of entries) {
    const styleId = getStyleId(entry.type, entry.style)
    const placemarks: string[] = []

    for (const feat of entry.features) {
      const koords = coordToKml(feat.coordinates)
      const placemarkName = generateNameFromTemplate(feat.properties, feat.name, entry.nameTemplate)

      let geomXml = ''
      if (entry.type === 'Point') {
        geomXml = `      <Point>
        <coordinates>${koords}</coordinates>
      </Point>`
      } else if (entry.type === 'LineString') {
        geomXml = `      <LineString>
        <coordinates>${koords}</coordinates>
      </LineString>`
      } else {
        geomXml = `      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${koords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>`
      }

      placemarks.push(`    <Placemark>
      <name>${escapeXml(placemarkName)}</name>
      <styleUrl>#${styleId}</styleUrl>
${geomXml}
    </Placemark>`)
    }

    folderXmls.push(`  <Folder>
    <name>${escapeXml(entry.folderName)}</name>
${placemarks.join('\n')}
  </Folder>`)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>SHP转KML数据</name>
${[...styleDefs.values()].join('\n')}

${folderXmls.join('\n')}
</Document>
</kml>`
}

// ============================================================
// 浏览器下载
// ============================================================

export function downloadKmlFile(entries: ShpExportEntry[], filename?: string): void {
  const kml = generateKml(entries)
  const name = filename || `SHP2KML_${new Date().toISOString().slice(0, 10)}.kml`
  const blob = new Blob(['\uFEFF' + kml], {
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
