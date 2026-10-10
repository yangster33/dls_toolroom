import { describe, it, expect } from 'vitest'
import { generateKml, type KmlSector } from '../KmlGenerator'

function sector(overrides: Partial<KmlSector> = {}): KmlSector {
  return {
    name: '小区A',
    longitude: 116.4,
    latitude: 39.9,
    azimuth: 90,
    halfPowerAngle: 65,
    radius: 500,
    ...overrides,
  }
}

describe('generateKml - 宏站扇形', () => {
  const kml = generateKml([sector()])

  it('输出标准 KML 结构与文档名', () => {
    expect(kml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">')
    expect(kml).toContain('<name><![CDATA[基站扇区图]]></name>')
    expect(kml).toContain('<open>1</open>')
  })

  it('包含扇区与名称两个文件夹', () => {
    expect(kml).toContain('<name><![CDATA[基站扇区]]></name>')
    expect(kml).toContain('<name><![CDATA[基站名称]]></name>')
  })

  it('扇形多边形坐标数量 = 中心点 + 31 采样点 + 闭合点', () => {
    const coords = kml
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^-?[\d.]+,-?[\d.]+,0$/.test(l))
    expect(coords).toHaveLength(33)
  })

  it('颜色按 KML AABBGGRR 输出（含透明度）', () => {
    // 默认蓝 #0000FF，opacity 0.5 → alpha 0x80 → "80FF0000"
    expect(kml).toContain('<color>80FF0000</color>')
  })

  it('名称写入 CDATA', () => {
    expect(kml).toContain('<name><![CDATA[小区A]]></name>')
  })

  it('描述表格包含方位角与坐标', () => {
    expect(kml).toContain('小区覆盖类型')
    expect(kml).toContain('方位角')
    expect(kml).toContain('经度')
  })

  it('名称标注点沿方位角外移 10 米', () => {
    const pointMatch = kml.match(/<Point>\s*<coordinates>([\d.-]+),([\d.-]+),0<\/coordinates>/)
    expect(pointMatch).not.toBeNull()
    const lng = parseFloat(pointMatch![1]!)
    expect(lng).toBeGreaterThan(116.4)
  })
})

describe('generateKml - 室分正方形', () => {
  const kml = generateKml([sector({ isIndoor: '是' })])

  it('正方形只有 5 个角点（闭合）', () => {
    const coords = kml
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^-?[\d.]+,-?[\d.]+,0$/.test(l))
    expect(coords).toHaveLength(5)
  })
})

describe('generateKml - 颜色处理', () => {
  it('未指定颜色时使用默认蓝色', () => {
    const kml = generateKml([sector({ color: undefined })])
    expect(kml).toContain('<color>80FF0000</color>')
  })

  it('3 位 hex 颜色扩展为 6 位', () => {
    const kml = generateKml([sector({ color: '#f00', opacity: 1 })])
    expect(kml).toContain('<color>FF0000FF</color>')
  })

  it('非法颜色回退为蓝色', () => {
    const kml = generateKml([sector({ color: 'not-a-color', opacity: 1 })])
    expect(kml).toContain('<color>FFFF0000</color>')
  })

  it('自定义透明度生效', () => {
    const kml = generateKml([sector({ color: '#00FF00', opacity: 0.5 })])
    expect(kml).toContain('<color>8000FF00</color>')
  })
})

describe('generateKml - 半透明度 opacity（P1-3 回归）', () => {
  // 历史 Bug：`formatColor(sector.color || '', sector.opacity || 0.5)`
  // `0 || 0.5` === 0.5，用户填 0 想要「完全透明的填充」但永远得到半透明，
  // 而填 0.0001 反而正常 —— 这个不对称性正是 `||` 误判 falsy 值的特征。
  //
  // KML 颜色格式是 AABBGGRR。红色 #FF0000 → alpha + 00(bb) + 00(gg) + FF(rr)
  it('opacity = 0 应产出全透明（alpha 00），不是 0.5', () => {
    const kml = generateKml([sector({ opacity: 0, color: '#FF0000' })])
    expect(kml).toContain('<color>000000FF</color>')
    expect(kml).not.toContain('<color>800000FF</color>') // 0.5 → 80
  })

  it('opacity = 1 应产出不透明（alpha FF）', () => {
    const kml = generateKml([sector({ opacity: 1, color: '#FF0000' })])
    expect(kml).toContain('<color>FF0000FF</color>')
  })

  it('opacity = 0.5 产出 alpha 80（保持原有默认行为）', () => {
    const kml = generateKml([sector({ opacity: 0.5, color: '#FF0000' })])
    expect(kml).toContain('<color>800000FF</color>')
  })

  it('opacity 未提供时默认 0.5', () => {
    const kml = generateKml([sector({ color: '#FF0000' })])
    expect(kml).toContain('<color>800000FF</color>')
  })
})

describe('generateKml - 属性', () => {
  it('自定义文档名与关闭状态', () => {
    const kml = generateKml([sector()], { name: '自定义名', open: false })
    expect(kml).toContain('<name><![CDATA[自定义名]]></name>')
    expect(kml).toContain('<open>0</open>')
  })

  it('描述字段按 | 拆分填充表格', () => {
    const kml = generateKml([sector({ description: '区域A|网管名|物理站X|室外|华为' })])
    expect(kml).toContain('区域A')
    expect(kml).toContain('网管名')
    expect(kml).toContain('物理站X')
    expect(kml).toContain('华为')
  })

  it('物理站名优先于描述中的物理站名', () => {
    const kml = generateKml([
      sector({ physicalStationName: '真实物理站', description: '区域A|网管名|描述物理站' }),
    ])
    expect(kml).toContain('<name><![CDATA[真实物理站]]></name>')
  })

  it('空扇区列表仍输出完整结构', () => {
    const kml = generateKml([])
    expect(kml).toContain('<kml')
    expect(kml).toContain('基站扇区')
    expect(kml).toContain('基站名称')
  })
})