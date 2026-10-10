import { describe, it, expect } from 'vitest'
import { parseKML } from '../geoDataService'

/**
 * 审计 P0-4 的端到端验证：KML 解析层把 Multi* 拆成单几何，
 * 而不是改个 type 标签。这一步做对了，下游 analyze* 才拿到正确形状的
 * coordinates（number[] / number[][] / number[][][]），不会出现
 * 「Excel 单元格里是 [lng,lat] 数组字符串」或 turf 抛错。
 */

function fileFromString(content: string, name = 'test.kml'): File {
  return new File([content], name, { type: 'application/vnd.google-earth.kml+xml' })
}

const KML_MULTIPOINT = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>多点</name>
      <MultiGeometry>
        <Point><coordinates>116.1,39.1,0</coordinates></Point>
        <Point><coordinates>116.2,39.2,0</coordinates></Point>
        <Point><coordinates>116.3,39.3,0</coordinates></Point>
      </MultiGeometry>
    </Placemark>
  </Document>
</kml>`

const KML_MULTILINESTRING = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>多线</name>
      <MultiGeometry>
        <LineString><coordinates>116.1,39.1,0 116.2,39.2,0</coordinates></LineString>
        <LineString><coordinates>116.3,39.3,0 116.4,39.4,0</coordinates></LineString>
      </MultiGeometry>
    </Placemark>
  </Document>
</kml>`

describe('parseKML - Multi* 拆分（P0-4）', () => {
  it('MultiPoint 拆成 3 个独立 Point 要素，每个 coordinates 是 [lng,lat]', async () => {
    const result = await parseKML(fileFromString(KML_MULTIPOINT))

    expect(result.success).toBe(true)
    const points = result.features.filter((f) => f.type === 'Point')
    expect(points).toHaveLength(3)
    // 每个要素的 coordinates 必须是平铺的 [lng, lat]，不是嵌套数组
    for (const p of points) {
      expect(Array.isArray(p.coordinates)).toBe(true)
      expect(typeof (p.coordinates as number[])[0]).toBe('number')
      expect(typeof (p.coordinates as number[])[1]).toBe('number')
    }
    // 名称带序号后缀，便于区分
    expect(points.map((p) => p.name)).toEqual(['多点 (1)', '多点 (2)', '多点 (3)'])
  })

  it('MultiLineString 拆成 2 个独立 LineString 要素', async () => {
    const result = await parseKML(fileFromString(KML_MULTILINESTRING))

    expect(result.success).toBe(true)
    const lines = result.features.filter((f) => f.type === 'LineString')
    expect(lines).toHaveLength(2)
    // 每条线的 coordinates 是 [[lng,lat], ...]
    for (const l of lines) {
      const coords = l.coordinates as number[][]
      expect(Array.isArray(coords)).toBe(true)
      expect(coords.length).toBeGreaterThanOrEqual(2)
      expect(Array.isArray(coords[0])).toBe(true)
      expect(typeof coords[0]![0]).toBe('number')
    }
  })

  it('单 Point 不受影响，coordinates 原样保留（含高程）', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>单点</name>
<Point><coordinates>116.4,39.9,0</coordinates></Point></Placemark></Document></kml>`
    const result = await parseKML(fileFromString(kml))
    const p = result.features.find((f) => f.type === 'Point')!
    // KML 的 coordinates 是 lon,lat[,alt]，带高程时 GeoJSON 保留第三个分量
    expect((p.coordinates as number[]).slice(0, 2)).toEqual([116.4, 39.9])
    expect(p.name).toBe('单点')
  })
})
