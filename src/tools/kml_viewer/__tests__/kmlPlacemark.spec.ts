import { describe, it, expect } from 'vitest'
import {
  detectGeometryType,
  getPlacemarkMeta,
  parseCoordinatesElement,
  parseTrackCoordinates,
} from '../kmlPlacemark'

function parseXml(source: string): Document {
  return new DOMParser().parseFromString(source, 'application/xml')
}

describe('detectGeometryType', () => {
  it('按旧实现的优先级返回第一个命中的几何类型', () => {
    const doc = parseXml(`
      <Placemark>
        <LineString />
        <Polygon />
      </Placemark>
    `)
    expect(detectGeometryType(doc.documentElement)).toBe('LineString')
  })

  it('没有已知几何时返回空串', () => {
    const doc = parseXml('<Placemark><name>x</name></Placemark>')
    expect(detectGeometryType(doc.documentElement)).toBe('')
  })
})

describe('getPlacemarkMeta', () => {
  it('读取名称 / 描述 / 内联 Style 颜色', () => {
    const doc = parseXml(`
      <Placemark>
        <name>基站 A</name>
        <description>&lt;b&gt;备注&lt;/b&gt;</description>
        <Style><IconStyle><color>ff0000ff</color></IconStyle></Style>
        <Point><coordinates>116.4,39.9</coordinates></Point>
      </Placemark>
    `)
    const meta = getPlacemarkMeta(doc.documentElement, new Map())
    expect(meta.name).toBe('基站 A')
    expect(meta.description).toBe('<b>备注</b>')
    expect(meta.color).toBe('#ff0000')
    expect(meta.geometryType).toBe('Point')
  })

  it('内联 Style 优先于 styleUrl 引用', () => {
    const doc = parseXml(`
      <Placemark>
        <styleUrl>#from-map</styleUrl>
        <Style><IconStyle><color>ff00ff00</color></IconStyle></Style>
        <Point><coordinates>0,0</coordinates></Point>
      </Placemark>
    `)
    const meta = getPlacemarkMeta(doc.documentElement, new Map([['#from-map', '#0000ff']]))
    expect(meta.color).toBe('#00ff00')
  })

  it('没有内联 Style 时使用 styleUrl 颜色', () => {
    const doc = parseXml(`
      <Placemark>
        <styleUrl> #from-map </styleUrl>
        <Point><coordinates>0,0</coordinates></Point>
      </Placemark>
    `)
    const meta = getPlacemarkMeta(doc.documentElement, new Map([['#from-map', '#0000ff']]))
    expect(meta.color).toBe('#0000ff')
  })

  it('缺少 name 时使用兜底名称', () => {
    const doc = parseXml('<Placemark><Point><coordinates>0,0</coordinates></Point></Placemark>')
    expect(getPlacemarkMeta(doc.documentElement, new Map()).name).toBe('未命名要素')
  })
})

describe('parseCoordinatesElement', () => {
  it('兼容无空格分隔的 coordinates', () => {
    const doc = parseXml(
      '<LineString><coordinates>116.3,39.9,116.4,40.0,116.5,40.1</coordinates></LineString>',
    )
    expect(parseCoordinatesElement(doc.documentElement)).toEqual([
      { lat: 39.9, lng: 116.3 },
      { lat: 40.0, lng: 116.4 },
      { lat: 40.1, lng: 116.5 },
    ])
  })

  it('没有 coordinates 时返回空数组', () => {
    const doc = parseXml('<Point />')
    expect(parseCoordinatesElement(doc.documentElement)).toEqual([])
  })
})

describe('parseTrackCoordinates', () => {
  it('解析 gx:coord 并过滤 NaN / 越界点', () => {
    const doc = parseXml(`
      <Track>
        <coord>116.4 39.9 0</coord>
        <coord>bad 39.9</coord>
        <coord>200 39.9</coord>
        <coord>116.5 40.0 0</coord>
      </Track>
    `)
    expect(parseTrackCoordinates(doc.documentElement)).toEqual([
      { lat: 39.9, lng: 116.4 },
      { lat: 40.0, lng: 116.5 },
    ])
  })
})
