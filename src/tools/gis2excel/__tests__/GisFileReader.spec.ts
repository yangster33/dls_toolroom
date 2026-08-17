import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'
import shp from 'shpjs'
import {
  parseKmlXml,
  convertGeoJsonToFeatures,
  parseShpFile,
  readAndValidateGisFile,
} from '../GisFileReader'

vi.mock('shpjs', () => ({ default: vi.fn() }))

const mockedShp = vi.mocked(shp)

const pointKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>站点A</name>
      <Point><coordinates>116.4,39.9,0</coordinates></Point>
      <ExtendedData>
        <Data name="高度"><value>100</value></Data>
      </ExtendedData>
    </Placemark>
  </Document>
</kml>`

const lineKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <name>路线1</name>
    <LineString><coordinates>116.4,39.9,0 116.5,39.95,0 116.6,40.0,0</coordinates></LineString>
  </Placemark>
</kml>`

const polygonKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <name>区域1</name>
    <Polygon>
      <outerBoundaryIs>
        <LinearRing><coordinates>116.4,39.9 116.5,39.9 116.5,40.0 116.4,39.9</coordinates></LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>
</kml>`

const folderKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <name>测试文件夹</name>
      <Placemark>
        <name>文件夹内点</name>
        <Point><coordinates>116.4,39.9</coordinates></Point>
      </Placemark>
    </Folder>
  </Document>
</kml>`

describe('parseKmlXml', () => {
  it('解析 Point 要素（含名称、坐标与 ExtendedData）', () => {
    const features = parseKmlXml(pointKml)
    expect(features).toHaveLength(1)
    expect(features[0]).toMatchObject({
      id: 'feature_1',
      type: 'Point',
      name: '站点A',
      coordinates: '116.4,39.9',
      properties: { 高度: '100' },
    })
  })

  it('解析 LineString 坐标以分号连接（保留高程）', () => {
    const features = parseKmlXml(lineKml)
    expect(features[0]).toMatchObject({
      type: 'LineString',
      coordinates: '116.4,39.9,0;116.5,39.95,0;116.6,40.0,0',
    })
  })

  it('解析 Polygon 外环坐标', () => {
    const features = parseKmlXml(polygonKml)
    expect(features[0]).toMatchObject({
      type: 'Polygon',
      coordinates: '116.4,39.9;116.5,39.9;116.5,40.0;116.4,39.9',
    })
  })

  it('Folder 内要素路径为文件夹名，且支持嵌套拼接', () => {
    const features = parseKmlXml(folderKml)
    expect(features[0]).toMatchObject({
      name: '文件夹内点',
      path: '测试文件夹',
    })
    const nested = parseKmlXml(
      folderKml.replace('测试文件夹', '外层/内层'),
    )
    expect(nested[0]!.path).toBe('外层/内层')
  })

  it('无名要素回退为 要素N', () => {
    const xml = '<kml><Placemark><Point><coordinates>1,2</coordinates></Point></Placemark></kml>'
    expect(parseKmlXml(xml)[0]!.name).toBe('要素1')
  })

  it('无坐标的要素被排除', () => {
    const xml = '<kml><Placemark><name>空</name></Placemark></kml>'
    expect(parseKmlXml(xml)).toEqual([])
  })
})

describe('convertGeoJsonToFeatures', () => {
  it('转换 FeatureCollection 中的 Point / LineString / Polygon', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [116.4, 39.9] }, properties: { name: '点1' } },
        { type: 'Feature', geometry: { type: 'LineString', coordinates: [[1, 2], [3, 4]] }, properties: { NAME: '线1' } },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, properties: { Name: '面1' } },
      ],
    }
    const features = convertGeoJsonToFeatures(geojson)
    expect(features.map((f) => [f.type, f.coordinates, f.name])).toEqual([
      ['Point', '116.4,39.9', '点1'],
      ['LineString', '1,2;3,4', '线1'],
      ['Polygon', '0,0;1,0;1,1;0,0', '面1'],
    ])
  })

  it('Multi 几何取首点或合并线段', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [[1, 2], [3, 4]] }, properties: {} },
        { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [[[1, 2], [3, 4]], [[5, 6], [7, 8]]] }, properties: {} },
        { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]] }, properties: {} },
      ],
    }
    const features = convertGeoJsonToFeatures(geojson)
    expect(features.map((f) => [f.type, f.coordinates])).toEqual([
      ['Point', '1,2'],
      ['LineString', '1,2;3,4;5,6;7,8'],
      ['Polygon', '0,0;1,0;1,1;0,0'],
    ])
  })

  it('无几何或未知几何类型的要素被跳过', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: null, properties: {} },
        { type: 'Feature', geometry: { type: 'MultiSurface', coordinates: [] }, properties: {} },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: {} },
      ],
    }
    const features = convertGeoJsonToFeatures(geojson)
    expect(features).toHaveLength(1)
  })

  it('无 name 属性时回退要素序号，且补充 _fid/_type 兜底字段', () => {
    const features = convertGeoJsonToFeatures({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { 其他: 'x' } },
      ],
    })
    expect(features[0]).toMatchObject({
      name: '要素1',
      properties: { _fid: 1, _type: 'Point', 其他: 'x' },
    })
  })

  it('单个 Feature 或数组输入均支持', () => {
    const single = { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { name: '单' } }
    expect(convertGeoJsonToFeatures(single)).toHaveLength(1)
    expect(convertGeoJsonToFeatures([single])).toHaveLength(1)
  })
})

describe('parseShpFile', () => {
  beforeEach(() => {
    mockedShp.mockReset()
  })

  it('多文件模式：传入 shp 与 dbf', async () => {
    mockedShp.mockResolvedValue({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { name: 'a' } },
      ],
    })
    const shpFile = new File([new Uint8Array([1])], 'a.shp')
    const dbfFile = new File([new Uint8Array([1])], 'a.dbf')
    const features = await parseShpFile([shpFile, dbfFile])
    expect(mockedShp).toHaveBeenCalledWith(expect.objectContaining({ shp: expect.anything(), dbf: expect.anything() }))
    expect(features).toHaveLength(1)
  })

  it('多文件模式：缺少 shp 时抛错', async () => {
    await expect(parseShpFile([new File([], 'a.dbf')])).rejects.toThrow('未找到 .shp 文件')
  })

  it('zip 模式：直接传压缩包字节', async () => {
    mockedShp.mockResolvedValue({ type: 'FeatureCollection', features: [] })
    await parseShpFile(new File([new Uint8Array([1])], 'a.zip'))
    expect(mockedShp).toHaveBeenCalledWith(expect.anything())
  })

  it('单 shp 文件模式（无 dbf）', async () => {
    mockedShp.mockResolvedValue({ type: 'FeatureCollection', features: [] })
    await parseShpFile(new File([new Uint8Array([1])], 'a.shp'))
    expect(mockedShp).toHaveBeenCalledWith(expect.objectContaining({ shp: expect.anything() }))
  })
})

describe('readAndValidateGisFile', () => {
  it('KML 文件解析成功并统计要素类型', async () => {
    const mixedKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark><name>站点A</name><Point><coordinates>116.4,39.9,0</coordinates></Point></Placemark>
    <Placemark><name>路线1</name><LineString><coordinates>116.4,39.9,0 116.5,39.95,0</coordinates></LineString></Placemark>
    <Placemark><name>区域1</name><Polygon><outerBoundaryIs><LinearRing><coordinates>116.4,39.9 116.5,39.9 116.4,39.9</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
  </Document>
</kml>`
    const file = new File([mixedKml], '数据.kml')
    const result = await readAndValidateGisFile(file)
    expect(result.isValid).toBe(true)
    expect(result.totalFeatures).toBe(3)
    expect(result.pointCount).toBe(1)
    expect(result.lineCount).toBe(1)
    expect(result.polygonCount).toBe(1)
  })

  it('KMZ 文件解压后解析其中的 KML', async () => {
    const zip = new JSZip()
    zip.file('root/数据.kml', pointKml)
    const buf = await zip.generateAsync({ type: 'arraybuffer' })
    const file = new File([buf], '数据.kmz')
    const result = await readAndValidateGisFile(file)
    expect(result.isValid).toBe(true)
    expect(result.features[0]).toMatchObject({
      name: '站点A',
      path: 'root',
    })
  })

  it('不支持的文件格式报错', async () => {
    const file = new File(['x'], 'a.csv')
    const result = await readAndValidateGisFile(file)
    expect(result.isValid).toBe(false)
    expect(result.errors[0]).toContain('不支持的文件格式')
  })

  it('KML 中无要素时报错', async () => {
    const file = new File(['<kml><Document/></kml>'], 'a.kml')
    const result = await readAndValidateGisFile(file)
    expect(result.isValid).toBe(false)
    expect(result.errors[0]).toBe('文件中未找到任何地理要素')
  })
})