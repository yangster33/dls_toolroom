import { describe, it, expect } from 'vitest'
import { generateKml, type ShpExportEntry, type GisStyle } from '../ShpToKmlGenerator'
import type { GisFeature } from '../../gis2excel/GisFileReader'

function feature(
  name: string,
  coordinates: string,
  properties: Record<string, unknown> = {},
): GisFeature {
  return { id: name, type: 'Point', name, coordinates, path: '', properties }
}

function entry(overrides: Partial<ShpExportEntry> = {}): ShpExportEntry {
  return {
    folderName: '测试',
    type: 'Point',
    features: [feature('点1', '116.3,39.9')],
    style: { color: '#FF0000' } as GisStyle,
    ...overrides,
  }
}

describe('generateKml - 几何类型', () => {
  it('Point 输出 Point 几何', () => {
    const kml = generateKml([entry()])
    expect(kml).toContain('<Point>')
    expect(kml).toContain('<coordinates>116.3,39.9,0</coordinates>')
  })

  it('LineString 输出 LineString 几何', () => {
    const kml = generateKml([entry({ type: 'LineString', style: { color: '#00FF00', width: 2 } })])
    expect(kml).toContain('<LineString>')
  })

  it('Polygon 输出 Polygon 几何', () => {
    const kml = generateKml([
      entry({
        type: 'Polygon',
        style: { strokeColor: '#FF0000', fillColor: '#00FF00', strokeWidth: 1 },
      }),
    ])
    expect(kml).toContain('<Polygon>')
    expect(kml).toContain('<outerBoundaryIs>')
  })

  it('坐标字符串分号分隔转为空格分隔', () => {
    const kml = generateKml([entry({ features: [feature('多段', '116.3,39.9;116.4,40.0')] })])
    expect(kml).toContain('<coordinates>116.3,39.9,0 116.4,40.0,0</coordinates>')
  })

  it('每个条目生成独立 Folder', () => {
    const kml = generateKml([entry(), entry({ folderName: '第二个', type: 'Point' })])
    expect(kml).toContain('<name>测试</name>')
    expect(kml).toContain('<name>第二个</name>')
  })
})

describe('generateKml - 样式去重', () => {
  it('相同样式只生成一个 Style 定义', () => {
    const kml = generateKml([
      entry({ features: [feature('a', '116.3,39.9'), feature('b', '116.4,39.9')] }),
    ])
    expect(kml.match(/<Style id=/g)).toHaveLength(1)
  })

  it('不同样式生成不同 Style id', () => {
    const kml = generateKml([
      entry({ folderName: 'f1' }),
      entry({ folderName: 'f2', style: { color: '#00FF00' } }),
    ])
    expect(kml).toContain('<Style id="p_ff0000">')
    expect(kml).toContain('<Style id="p_00ff00">')
  })

  it('Point 样式使用白色图钉', () => {
    const kml = generateKml([entry()])
    expect(kml).toContain('wht-pushpin.png')
  })

  it('LineString 样式输出线宽', () => {
    const kml = generateKml([entry({ type: 'LineString', style: { color: '#00FF00', width: 3 } })])
    expect(kml).toContain('<width>3</width>')
  })

  it('Polygon 填充色透明度 0.5', () => {
    const kml = generateKml([
      entry({
        type: 'Polygon',
        style: { strokeColor: '#FF0000', fillColor: '#00FF00', strokeWidth: 1 },
      }),
    ])
    expect(kml).toContain('<color>8000FF00</color>')
  })

  it('placemark 引用正确 styleUrl', () => {
    const kml = generateKml([
      entry({ folderName: 'f1' }),
      entry({ folderName: 'f2', style: { color: '#00FF00' } }),
    ])
    expect(kml).toContain('<styleUrl>#p_ff0000</styleUrl>')
    expect(kml).toContain('<styleUrl>#p_00ff00</styleUrl>')
  })
})

describe('generateKml - 名称模板', () => {
  it('无模板时使用原始名称', () => {
    const kml = generateKml([entry({ features: [feature('点1', '116.3,39.9')] })])
    expect(kml).toContain('<name>点1</name>')
  })

  it('模板替换属性占位符', () => {
    const kml = generateKml([
      entry({
        nameTemplate: '{name}-{code}',
        features: [feature('点1', '116.3,39.9', { code: 'X1' })],
      }),
    ])
    expect(kml).toContain('<name>点1-X1</name>')
  })

  it('模板缺失属性时替换为空', () => {
    const kml = generateKml([
      entry({ nameTemplate: '{name}-{missing}', features: [feature('点1', '116.3,39.9')] }),
    ])
    expect(kml).toContain('<name>点1-</name>')
  })

  it('名称与文件夹做 XML 转义', () => {
    const kml = generateKml([
      entry({ folderName: 'A&B', features: [feature('C<D>', '116.3,39.9')] }),
    ])
    expect(kml).toContain('<name>A&amp;B</name>')
    expect(kml).toContain('<name>C&lt;D&gt;</name>')
  })
})

describe('generateKml - 边界', () => {
  it('空条目列表输出空文档', () => {
    const kml = generateKml([])
    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">')
    expect(kml).toContain('<name>SHP转KML数据</name>')
    expect(kml).not.toContain('<Folder>')
  })

  it('空要素列表生成空 Folder', () => {
    const kml = generateKml([entry({ features: [] })])
    expect(kml).toContain('<Folder>')
    expect(kml).not.toContain('<Placemark>')
  })
})
