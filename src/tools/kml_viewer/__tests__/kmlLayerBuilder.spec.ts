import { describe, it, expect } from 'vitest'
import L from 'leaflet'
import { buildKmlTree, createLayerForPlacemark } from '../kmlLayerBuilder'

function parseXml(source: string): Document {
  return new DOMParser().parseFromString(source, 'application/xml')
}

function fakeIcon() {
  return L.divIcon({ className: 'test-icon', html: '' })
}

describe('createLayerForPlacemark', () => {
  it('Point → Marker，颜色传给图标工厂', () => {
    const doc = parseXml(`
      <Placemark>
        <name>点 A</name>
        <Point><coordinates>116.4,39.9</coordinates></Point>
      </Placemark>
    `)
    let receivedColor: string | undefined
    const layer = createLayerForPlacemark(
      doc.documentElement,
      { name: '点 A', color: '#ff0000' },
      (color) => {
        receivedColor = color
        return fakeIcon()
      },
    )
    expect(layer).toBeInstanceOf(L.Marker)
    expect(receivedColor).toBe('#ff0000')
  })

  it('LineString → Polyline', () => {
    const doc = parseXml(`
      <Placemark>
        <LineString><coordinates>116.3,39.9 116.4,40.0</coordinates></LineString>
      </Placemark>
    `)
    const layer = createLayerForPlacemark(doc.documentElement, { name: '线' }, fakeIcon)
    expect(layer).toBeInstanceOf(L.Polyline)
    expect((layer as L.Polyline).getLatLngs()).toHaveLength(2)
  })

  it('Polygon → Polygon', () => {
    const doc = parseXml(`
      <Placemark>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing><coordinates>0,0 1,0 1,1 0,1 0,0</coordinates></LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>
    `)
    const layer = createLayerForPlacemark(doc.documentElement, { name: '面' }, fakeIcon)
    expect(layer).toBeInstanceOf(L.Polygon)
  })

  it('Track → Polyline', () => {
    const doc = parseXml(`
      <Placemark>
        <Track>
          <coord>116.3 39.9 0</coord>
          <coord>116.4 40.0 0</coord>
        </Track>
      </Placemark>
    `)
    const layer = createLayerForPlacemark(doc.documentElement, { name: '轨迹' }, fakeIcon)
    expect(layer).toBeInstanceOf(L.Polyline)
  })

  it('MultiGeometry 取第一个能创建的子几何', () => {
    const doc = parseXml(`
      <Placemark>
        <MultiGeometry>
          <Point><coordinates>116.4,39.9</coordinates></Point>
        </MultiGeometry>
      </Placemark>
    `)
    const layer = createLayerForPlacemark(doc.documentElement, { name: '多几何' }, fakeIcon)
    expect(layer).toBeInstanceOf(L.Marker)
  })

  it('没有可识别几何时返回 null', () => {
    const doc = parseXml('<Placemark><name>空</name></Placemark>')
    expect(createLayerForPlacemark(doc.documentElement, { name: '空' }, fakeIcon)).toBeNull()
  })

  it('buildKmlTree 递归解析 Folder / Placemark 并挂载图层', () => {
    const doc = parseXml(`
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Folder>
            <name>机房</name>
            <Placemark>
              <name>站点 A</name>
              <Point><coordinates>116.4,39.9</coordinates></Point>
            </Placemark>
          </Folder>
        </Document>
      </kml>
    `)

    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 800 })
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 600 })
    const map = L.map(container).setView([39.9, 116.4], 10)

    const file = new File(['<kml />'], 'test.kml', { type: 'application/xml' })
    const root = buildKmlTree(doc, file, map, fakeIcon)

    const folder = root.children.find((node) => node.type === 'folder')
    expect(folder?.name).toBe('机房')
    const placemark = folder?.children.find((node) => node.type === 'placemark')
    expect(placemark?.name).toBe('站点 A')
    expect(placemark?.leafletLayer).toBeTruthy()
    expect(map.hasLayer(placemark!.leafletLayer as L.Layer)).toBe(true)

    map.remove()
  })

  it('popup 内容经过 DOMPurify 清洗', () => {
    const doc = parseXml(`
      <Placemark>
        <Point><coordinates>0,0</coordinates></Point>
      </Placemark>
    `)
    const layer = createLayerForPlacemark(
      doc.documentElement,
      {
        name: '<img src=x onerror=alert(1)>A',
        description: '<b>hi</b><script>alert(1)</script>',
      },
      fakeIcon,
    ) as L.Marker
    const content = String(layer.getPopup()?.getContent() ?? '')
    expect(content).toContain('A')
    expect(content).not.toContain('onerror')
    expect(content).not.toContain('<script')
  })
})
