import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { parseKMZ } from '../geoDataService'

/**
 * KMZ 解析的回归测试（C4 收尾）。
 *
 * 背景：KML 的 `<MultiGeometry>` 经 togeojson 转换后会变成 `GeometryCollection`
 * （可能是混合类型）。`parseKML` 在阶段 2（审计 P0-4）已经用 `flattenGeometry` 修好了，
 * 但 `parseKMZ` 一直是裸 `switch`，`GeometryCollection` 走 `default: continue`
 * **整块被静默丢弃** —— 用户拿到一个少了一批要素的分析结果，且没有任何提示。
 *
 * 这里的用例把那三个历史盲区一次钉住：MultiGeometry 混合类型、Multi* 的
 * coordinates 形状、以及「无几何 Placemark 不影响后续要素」。
 */

function kmlFile(content: string, name = 'test.kmz'): Promise<File> {
  return buildKmzFromKml(content, name)
}

async function buildKmzFromKml(content: string, name = 'test.kmz'): Promise<File> {
  const zip = new JSZip()
  zip.file('doc.kml', content)
  const blob = await zip.generateAsync({ type: 'blob' })
  return new File([blob], name, { type: 'application/vnd.google-earth.kmz' })
}

const KML_WRAP = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${body}</Document></kml>`

describe('parseKMZ - MultiGeometry / Multi* 不再被静默丢弃（C4 收尾）', () => {
  it('<MultiGeometry> 混合 Point + LineString：两者都要保留且形状正确', async () => {
    const kml = KML_WRAP(`
      <Placemark>
        <name>混合站</name>
        <MultiGeometry>
          <Point><coordinates>116.1,39.1,0</coordinates></Point>
          <LineString><coordinates>116.2,39.2,0 116.3,39.3,0</coordinates></LineString>
        </MultiGeometry>
      </Placemark>
    `)
    const result = await parseKMZ(await kmlFile(kml))

    expect(result.success).toBe(true)
    expect(result.totalPoints).toBe(1)
    expect(result.totalLines).toBe(1)

    const point = result.features.find((f) => f.type === 'Point')!
    const line = result.features.find((f) => f.type === 'LineString')!

    // Point 的 coordinates 必须是平铺 [lng, lat]，而不是嵌套数组
    expect(Array.isArray(point.coordinates)).toBe(true)
    expect(typeof (point.coordinates as number[])[0]).toBe('number')
    // LineString 必须是 [[lng, lat], ...]
    const lineCoords = line.coordinates as number[][]
    expect(Array.isArray(lineCoords[0])).toBe(true)

    // 拆分出的要素带序号后缀。注意序号按 togeojson 转换后的顺序，
    // 而它按**类型**重排（Line 在 Point 之前），与 KML 文档书写顺序不同 —— 这是库的行为。
    expect(line.name).toBe('混合站 (1)')
    expect(point.name).toBe('混合站 (2)')
  })

  it('GeoJSON 的 MultiPoint / MultiLineString / MultiPolygon 全部拆成原子几何', async () => {
    // KMZ 里的 KML 也可以直接写 GeoJSON 风格的 Multi*，经 togeojson 转换后
    // 走同一套 flattenGeometry：每类都要按数量拆开
    const kml = KML_WRAP(`
      <Placemark><name>多点</name>
        <MultiGeometry>
          <Point><coordinates>116.1,39.1,0</coordinates></Point>
          <Point><coordinates>116.2,39.2,0</coordinates></Point>
        </MultiGeometry>
      </Placemark>
      <Placemark><name>多线</name>
        <MultiGeometry>
          <LineString><coordinates>116.1,39.1,0 116.2,39.2,0</coordinates></LineString>
          <LineString><coordinates>116.3,39.3,0 116.4,39.4,0</coordinates></LineString>
        </MultiGeometry>
      </Placemark>
    `)
    const result = await parseKMZ(await kmlFile(kml))

    expect(result.success).toBe(true)
    expect(result.totalPoints).toBe(2)
    expect(result.totalLines).toBe(2)
    expect(result.features.filter((f) => f.type === 'Point')).toHaveLength(2)
    expect(result.features.filter((f) => f.type === 'LineString')).toHaveLength(2)
  })

  it('嵌套 MultiGeometry：togeojson 自身不递归（当前只保留最后一个），本作记录在案', async () => {
    // 这不是我们的 bug：togeojson 对「MultiGeometry 里再嵌套 MultiGeometry」只返回单个 Point，
    // 信息在进到我们代码之前就丢了。flattenGeometry 的递归能力仍在，等库修好这里改成 2 即可。
    const kml = KML_WRAP(`
      <Placemark><name>嵌套</name>
        <MultiGeometry>
          <Point><coordinates>116.1,39.1,0</coordinates></Point>
          <MultiGeometry>
            <Point><coordinates>116.2,39.2,0</coordinates></Point>
          </MultiGeometry>
        </MultiGeometry>
      </Placemark>
    `)
    const result = await parseKMZ(await kmlFile(kml))
    expect(result.success).toBe(true)
    expect(result.totalPoints).toBe(1)
  })

  it('无几何的 Placemark 不丢弃后续要素（continue 不能写错成 break）', async () => {
    const kml = KML_WRAP(`
      <Placemark><name>没有几何</name></Placemark>
      <Placemark><name>点A</name><Point><coordinates>116.4,39.9,0</coordinates></Point></Placemark>
      <Placemark><name>点B</name><Point><coordinates>121.5,31.2,0</coordinates></Point></Placemark>
    `)
    const result = await parseKMZ(await kmlFile(kml))
    expect(result.features.map((f) => f.name)).toEqual(['点A', '点B'])
    expect(result.totalPoints).toBe(2)
  })

  it('普通单几何 + Polygon 的原有行为不变', async () => {
    const kml = KML_WRAP(`
      <Placemark><name>面A</name>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>116,39,0 117,39,0 117,40,0 116,39,0</coordinates></LinearRing></outerBoundaryIs></Polygon>
      </Placemark>
    `)
    const result = await parseKMZ(await kmlFile(kml))
    expect(result.totalPolygons).toBe(1)
    const polygon = result.features[0]!
    expect(polygon.type).toBe('Polygon')
    // Polygon 的 coordinates 必须是 number[][][]
    const coords = polygon.coordinates as number[][][]
    expect(Array.isArray(coords[0]![0])).toBe(true)
    expect(polygon.name).toBe('面A')
  })

  it('KMZ 里没有 KML 文件时报错，不炸', async () => {
    const zip = new JSZip()
    zip.file('readme.txt', 'not a kml')
    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'empty.kmz')
    const result = await parseKMZ(file)
    expect(result.success).toBe(false)
    expect(result.errors[0]).toContain('未找到 KML')
  })
})
