import { describe, it, expect } from 'vitest'
import { kmlColorToHex, parseKmlColorEl, parseKmlStyles } from '../kmlStyle'

function parseXml(source: string): Document {
  return new DOMParser().parseFromString(source, 'application/xml')
}

describe('kmlColorToHex', () => {
  it('8 位 AABBGGRR 转为 #RRGGBB', () => {
    expect(kmlColorToHex('ff0000ff')).toBe('#ff0000')
    expect(kmlColorToHex('ff00ff00')).toBe('#00ff00')
  })

  it('6 位 BBGGRR 同样转为 #RRGGBB', () => {
    expect(kmlColorToHex('0000ff')).toBe('#ff0000')
  })

  it('无法识别的长度回退到 Leaflet 默认蓝', () => {
    expect(kmlColorToHex('abc')).toBe('#3388ff')
  })
})

describe('parseKmlColorEl', () => {
  it('读取并 trim <color> 文本', () => {
    const doc = parseXml('<Style><IconStyle><color> ff0000ff </color></IconStyle></Style>')
    expect(parseKmlColorEl(doc.documentElement)).toBe('#ff0000')
  })

  it('没有 <color> 时返回 null', () => {
    const doc = parseXml('<Style><IconStyle /></Style>')
    expect(parseKmlColorEl(doc.documentElement)).toBeNull()
  })
})

describe('parseKmlStyles', () => {
  it('IconStyle 没有 color 时登记默认红色', () => {
    const doc = parseXml('<kml><Document><Style id="pin"><IconStyle /></Style></Document></kml>')
    expect(parseKmlStyles(doc).get('#pin')).toBe('#EA4335')
  })

  it('IconStyle 优先于 LineStyle / PolyStyle', () => {
    const doc = parseXml(`
      <kml><Document>
        <Style id="s">
          <IconStyle><color>ff0000ff</color></IconStyle>
          <LineStyle><color>ff00ff00</color></LineStyle>
        </Style>
      </Document></kml>
    `)
    expect(parseKmlStyles(doc).get('#s')).toBe('#ff0000')
  })

  it('没有 IconStyle 时回退 LineStyle / PolyStyle', () => {
    const doc = parseXml(`
      <kml><Document>
        <Style id="line"><LineStyle><color>ff00ff00</color></LineStyle></Style>
        <Style id="poly"><PolyStyle><color>ffff0000</color></PolyStyle></Style>
      </Document></kml>
    `)
    const styles = parseKmlStyles(doc)
    expect(styles.get('#line')).toBe('#00ff00')
    expect(styles.get('#poly')).toBe('#0000ff')
  })

  it('StyleMap 的 normal 项解析到目标 Style 颜色', () => {
    const doc = parseXml(`
      <kml><Document>
        <Style id="base"><IconStyle><color>ff0000ff</color></IconStyle></Style>
        <StyleMap id="map">
          <Pair><key>normal</key><styleUrl>#base</styleUrl></Pair>
        </StyleMap>
      </Document></kml>
    `)
    expect(parseKmlStyles(doc).get('#map')).toBe('#ff0000')
  })
})
