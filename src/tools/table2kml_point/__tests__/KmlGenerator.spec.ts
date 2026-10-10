import { describe, it, expect } from 'vitest'
import { generateKml } from '../KmlGenerator'
import type { PointRow } from '../TemplateValidator'

/**
 * 注意：这里的 `point()` 辅助函数故意只用 `color`（不设 colorRaw），
 * 用来保证「调用方未提供原始输入」时的兜底行为仍然正确。
 *
 * 但生产链路的真实输入是 `TemplateValidator` 产出的
 * `{ color: '#FF0000', colorRaw: '红色' }` —— 只有带 colorRaw 的用例
 * 才能证明 P0-3（中文色名图钉失效）真的被修好了。
 */
function point(overrides: Partial<PointRow> = {}): PointRow {
  return { name: '站1', lng: 116.4, lat: 39.9, folder: '北京', color: '红色', ...overrides }
}

/** 模拟 TemplateValidator 的真实产出：color 规范化 + 保留 colorRaw */
function validatedPoint(rawColor: string, overrides: Partial<PointRow> = {}): PointRow {
  const hex = rawColor === '红色' ? '#FF0000' : rawColor
  return { name: '站1', lng: 116.4, lat: 39.9, folder: '北京', color: hex, colorRaw: rawColor, ...overrides }
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

describe('generateKml - 中文色名图钉（P0-3 回归）', () => {
  // 历史 Bug：`isChineseColor` 用 `!color.startsWith('#')` 判断，
  // 而 TemplateValidator 已把 color 规范化为 #RRGGBB → 恒为 false → 死代码。
  // 只有「color 已规范化 + colorRaw 保留原值」这种真实输入才能复现。
  it('规范化后的红色仍走官方红图钉（这是修复前失败的用例）', () => {
    const kml = generateKml([validatedPoint('红色')])
    expect(kml).toContain('<href>http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png</href>')
    expect(kml).toContain('<color>FFFFFFFF</color>')
  })

  it('深红同样映射到 red 图钉', () => {
    const kml = generateKml([validatedPoint('深红')])
    expect(kml).toContain('red-pushpin.png')
  })

  it('蓝色中文名走 blue 图钉', () => {
    const kml = generateKml([validatedPoint('蓝色')])
    expect(kml).toContain('blue-pushpin.png')
  })

  it('黄色中文名走 ylw 图钉', () => {
    const kml = generateKml([validatedPoint('黄色')])
    expect(kml).toContain('ylw-pushpin.png')
  })

  it('hex 输入（即使写成小写）走白底 + 叠色，不用官方图钉', () => {
    const kml = generateKml([validatedPoint('#ff0000')])
    expect(kml).toContain('wht-pushpin.png')
    expect(kml).toContain('<color>ff0000FF</color>')
  })

  it('不在 6 色映射内的中文色名（如橙色）回退白底图标', () => {
    const kml = generateKml([validatedPoint('橙色')])
    expect(kml).toContain('wht-pushpin.png')
  })

  it('未提供 colorRaw 时按 color 兜底判定（兼容旧调用方）', () => {
    const kml = generateKml([point()]) // color: '红色'，无 colorRaw
    expect(kml).toContain('red-pushpin.png')
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