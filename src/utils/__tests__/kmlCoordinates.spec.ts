import { describe, it, expect } from 'vitest'
import {
  parseKmlCoordinates,
  formatCoordinates,
  toKmlCoordinatesString,
} from '../kmlCoordinates'

describe('parseKmlCoordinates', () => {
  describe('各主流 KML 写法（回归用例）', () => {
    it('KML 2.0 紧凑写法：lon,lat,alt 空格分隔', () => {
      // Google Earth / ArcGIS 默认输出
      expect(parseKmlCoordinates('116.3,39.9,0 116.4,40.0,0')).toEqual([
        { lat: 39.9, lng: 116.3 },
        { lat: 40.0, lng: 116.4 },
      ])
    })

    it('逗号后带空格（历史 Bug 触发条件）', () => {
      // 旧实现 text.split(/[\s\n]+/) 在这里会把元组切开 → 返回 []
      const result = parseKmlCoordinates('116.3, 39.9,0 116.4, 40.0,0')
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ lat: 39.9, lng: 116.3 })
      expect(result[1]).toEqual({ lat: 40.0, lng: 116.4 })
    })

    it('KML 2.2 无高程：lon,lat 空格分隔', () => {
      expect(parseKmlCoordinates('116.3,39.9 116.4,40.0')).toEqual([
        { lat: 39.9, lng: 116.3 },
        { lat: 40.0, lng: 116.4 },
      ])
    })

    it('无空白分隔：全逗号连接', () => {
      expect(parseKmlCoordinates('116.3,39.9,0,116.4,40.0,0')).toEqual([
        { lat: 39.9, lng: 116.3 },
        { lat: 40.0, lng: 116.4 },
      ])
    })

    it('纯空格分隔无逗号（数量可被 2 整除时按 2 分组）', () => {
      expect(parseKmlCoordinates('116.3 39.9 116.4 40.0')).toEqual([
        { lat: 39.9, lng: 116.3 },
        { lat: 40.0, lng: 116.4 },
      ])
    })

    it('换行 / 多重空白 / Tab 混排', () => {
      expect(
        parseKmlCoordinates('116.3,39.9,0\n  116.4,40.0,0\t116.5,40.1,0'),
      ).toEqual([
        { lat: 39.9, lng: 116.3 },
        { lat: 40.0, lng: 116.4 },
        { lat: 40.1, lng: 116.5 },
      ])
    })

    it('CRLF 换行', () => {
      expect(parseKmlCoordinates('116.3,39.9,0\r\n116.4,40.0,0')).toHaveLength(2)
    })

    it('带 BOM 头', () => {
      expect(parseKmlCoordinates('\uFEFF116.3,39.9,0')).toEqual([{ lat: 39.9, lng: 116.3 }])
    })

    it('负经度 / 负纬度', () => {
      expect(parseKmlCoordinates('-73.98,40.75,0 -0.12,51.5,0')).toEqual([
        { lat: 40.75, lng: -73.98 },
        { lat: 51.5, lng: -0.12 },
      ])
    })

    it('科学计数法', () => {
      expect(parseKmlCoordinates('1.163e2,3.99e1,0')).toEqual([{ lat: 39.9, lng: 116.3 }])
    })

    it('非零高程被正确跳过（只取前两个数）', () => {
      expect(parseKmlCoordinates('116.3,39.9,1200 116.4,40.0,1300')).toEqual([
        { lat: 39.9, lng: 116.3 },
        { lat: 40.0, lng: 116.4 },
      ])
    })

    it('单个点（Point 要素）', () => {
      expect(parseKmlCoordinates('116.3,39.9,0')).toEqual([{ lat: 39.9, lng: 116.3 }])
    })

    it('KML 2.2 单点无高程', () => {
      expect(parseKmlCoordinates('116.3,39.9')).toEqual([{ lat: 39.9, lng: 116.3 }])
    })
  })

  describe('边界与异常输入', () => {
    it('null / undefined / 空串返回空数组', () => {
      expect(parseKmlCoordinates(null)).toEqual([])
      expect(parseKmlCoordinates(undefined)).toEqual([])
      expect(parseKmlCoordinates('')).toEqual([])
      expect(parseKmlCoordinates('   \n  ')).toEqual([])
    })

    it('只有一个数字时返回空数组（无法构成点）', () => {
      expect(parseKmlCoordinates('116.3')).toEqual([])
    })

    it('不含任何数字的文本返回空数组', () => {
      expect(parseKmlCoordinates('abc def')).toEqual([])
    })

    it('不完整元组被丢弃，不产生 NaN 点', () => {
      // 5 个数字 + stride 3 → 最后一个不完整元组应被丢弃
      const result = parseKmlCoordinates('116.3,39.9,0 116.4')
      expect(result).toEqual([{ lat: 39.9, lng: 116.3 }])
      expect(result.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))).toBe(true)
    })

    it('超出经度范围的点被剔除（180 / 90 边界）', () => {
      expect(parseKmlCoordinates('181,39.9,0 116.4,40.0,0')).toEqual([
        { lat: 40.0, lng: 116.4 },
      ])
      expect(parseKmlCoordinates('116.3,91,0')).toEqual([])
    })

    it('边界值 ±180 / ±90 合法', () => {
      expect(parseKmlCoordinates('180,90,0 -180,-90,0')).toEqual([
        { lat: 90, lng: 180 },
        { lat: -90, lng: -180 },
      ])
    })
  })

  describe('Polygon 闭环场景', () => {
    it('3 点未闭合环仍能解析出 3 个点（由调用方决定是否闭合）', () => {
      // 审计 P1-3 提到 turf 会因未闭合环抛错；解析层不应吞掉数据
      expect(parseKmlCoordinates('116.3,39.9,0 116.4,40.0,0 116.5,39.95,0')).toHaveLength(3)
    })

    it('5 点已闭合环', () => {
      expect(
        parseKmlCoordinates('116.3,39.9,0 116.4,40.0,0 116.5,39.95,0 116.3,39.9,0'),
      ).toHaveLength(4)
    })
  })
})

describe('formatCoordinates', () => {
  it('默认保留原始精度，不做舍入', () => {
    expect(
      formatCoordinates([
        { lat: 39.9, lng: 116.3 },
        { lat: 40.0, lng: 116.4 },
      ]),
    ).toBe('116.3,39.9;116.4,40')
  })

  it('高精度输入不被截断（GIS→Excel 场景）', () => {
    expect(formatCoordinates([{ lat: 39.912345678, lng: 116.398765432 }])).toBe(
      '116.398765432,39.912345678',
    )
  })

  it('支持显式指定精度', () => {
    expect(formatCoordinates([{ lat: 39.9, lng: 116.3 }], 2)).toBe('116.30,39.90')
    expect(formatCoordinates([{ lat: 39.9, lng: 116.3 }], 6)).toBe('116.300000,39.900000')
  })

  it('空数组返回空字符串（不再返回 ,undefined 垃圾）', () => {
    expect(formatCoordinates([])).toBe('')
  })

  it('往返一致性：parse → format → parse 结果等价', () => {
    const original = [
      { lat: 39.9, lng: 116.3 },
      { lat: 40.0, lng: 116.4 },
    ]
    expect(parseKmlCoordinates(formatCoordinates(original))).toEqual(original)
  })
})

describe('toKmlCoordinatesString', () => {
  it('输出标准 KML 格式', () => {
    expect(
      toKmlCoordinatesString([
        { lat: 39.9, lng: 116.3 },
        { lat: 40.0, lng: 116.4 },
      ]),
    ).toBe('116.3,39.9,0 116.4,40,0')
  })

  it('支持自定义高程', () => {
    expect(toKmlCoordinatesString([{ lat: 39.9, lng: 116.3 }], 1200)).toBe(
      '116.3,39.9,1200',
    )
  })

  it('空数组返回空字符串', () => {
    expect(toKmlCoordinatesString([])).toBe('')
  })
})
