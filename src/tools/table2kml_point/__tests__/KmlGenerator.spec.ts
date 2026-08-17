import { describe, it, expect } from 'vitest'
import { generateKml } from '../KmlGenerator'
import type { PointRow } from '../TemplateValidator'

function point(overrides: Partial<PointRow> = {}): PointRow {
  return { name: '站1', lng: 116.4, lat: 39.9, folder: '北京', color: '红色', ...overrides }
}

describe('generateKml - 分组', () => {
  const kml = generateKml([
    point({ name: '站1' }),
    point({ name: '站2', lng: 116.5, lat: 39.95 }),
    point({ name: '站3', folder: '', color: '#00FF00' }),
  ])

  it('按文件夹分组，无文件夹归入默认文件夹', () => {
    expect(kml).toContain('<name>北京</name>')
    expect(kml).toContain('<name>默认文件夹</name>')
  })

  it('文件夹内包含对应点', () => {
    expect(kml).toContain('<name>站1</name>')
    expect(kml).toContain('<name>站2</name>')
    expect(kml).toContain('<name>站3</name>')
  })

  it('坐标输出为 lng,lat,0', () => {
    expect(kml).toContain('<coordinates>116.4,39.9,0</coordinates>')
    expect(kml).toContain('<coordinates>116.5,39.95,0</coordinates>')
  })

  it('描述包含经纬度信息', () => {
    expect(kml).toContain('<description>经度: 116.4, 纬度: 39.9</description>')
  })

  it('点位名称做 XML 转义', () => {
    const escaped = generateKml([point({ name: 'A&B<C>' })])
    expect(escaped).toContain('<name>A&amp;B&lt;C&gt;</name>')
  })
})

describe('generateKml - 样式', () => {
  it('相同颜色去重生成单个 Style', () => {
    const kml = generateKml([point({ name: '站1' }), point({ name: '站2' }), point({ name: '站3', color: '深红' })])
    expect(kml.match(/<Style id=/g)).toHaveLength(2)
  })

  it('中文颜色使用官方图钉图标与白色叠加色', () => {
    const kml = generateKml([point()])
    expect(kml).toContain('<href>http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png</href>')
    expect(kml).toContain('<color>FFFFFFFF</color>')
  })

  it('hex 颜色使用白底图标 + AABBGGRR 颜色', () => {
    const kml = generateKml([point({ color: '#00FF00' })])
    expect(kml).toContain('<href>http://maps.google.com/mapfiles/kml/pushpin/wht-pushpin.png</href>')
    expect(kml).toContain('<color>ff00FF00</color>')
  })

  it('未知颜色回退到白色图标', () => {
    const kml = generateKml([point({ color: '#FFAA00' })])
    expect(kml).toContain('wht-pushpin.png')
  })

  it('placemark 引用正确的 styleUrl', () => {
    const kml = generateKml([point(), point({ color: '#00FF00' })])
    expect(kml).toContain('<styleUrl>#s0</styleUrl>')
    expect(kml).toContain('<styleUrl>#s1</styleUrl>')
  })
})

describe('generateKml - 结构', () => {
  it('输出标准 KML 结构', () => {
    const kml = generateKml([point()])
    expect(kml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">')
    expect(kml).toContain('<name>点位数据</name>')
    expect(kml).toContain('<Point>')
    expect(kml).toContain('<styleUrl>')
  })

  it('空点位列表输出空文档', () => {
    const kml = generateKml([])
    expect(kml).toContain('<name>点位数据</name>')
    expect(kml).not.toContain('<Placemark>')
  })
})