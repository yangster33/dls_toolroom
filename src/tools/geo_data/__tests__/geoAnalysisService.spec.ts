import { describe, it, expect, vi } from 'vitest'
import {
  analyzePoints,
  analyzeLines,
  analyzePolygons,
  analyzePointToPoint,
  analyzePointToLine,
  analyzePointToPolygon,
  analyzeLineToLine,
  analyzeLineToPolygon,
  analyzePolygonToPolygon,
  getAnalysisLabel,
  getAvailableAnalysisTypes,
  type AnalysisType,
} from '../geoAnalysisService'
import type { PointFeature, LineFeature, PolygonFeature } from '../geoDataService'

function point(name: string, coordinates: [number, number]): PointFeature {
  return {
    id: name,
    name,
    type: 'Point',
    coordinates,
    properties: {},
    feature: { type: 'Feature', geometry: { type: 'Point', coordinates }, properties: {} },
  }
}

function line(name: string, coordinates: [number, number][]): LineFeature {
  return {
    id: name,
    name,
    type: 'LineString',
    coordinates,
    properties: {},
    feature: { type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} },
  }
}

function polygon(name: string, coordinates: [number, number][][]): PolygonFeature {
  return {
    id: name,
    name,
    type: 'Polygon',
    coordinates,
    properties: {},
    feature: { type: 'Feature', geometry: { type: 'Polygon', coordinates }, properties: {} },
  }
}

const SQUARE: [number, number][][] = [
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ],
]

describe('analyzePoints', () => {
  it('输出每点一行数据', async () => {
    const result = await analyzePoints([point('A', [116.4, 39.9]), point('B', [117, 40])])
    expect(result.type).toBe('point_analysis')
    expect(result.label).toBe('单点分析')
    expect(result.data).toHaveLength(2)
    expect(result.data[0]).toEqual({ 序号: 1, 名称: 'A', 类型: 'Point', 经度: 116.4, 纬度: 39.9 })
    expect(result.columns).toContain('名称')
  })

  it('进度回调最终到达 100', async () => {
    const onProgress = vi.fn()
    await analyzePoints([point('A', [0, 0]), point('B', [1, 1])], onProgress)
    expect(onProgress.mock.calls[onProgress.mock.calls.length - 1]).toEqual([100, '单点分析'])
  })

  it('取消时抛出错误', async () => {
    await expect(analyzePoints([point('A', [0, 0])], undefined, () => true)).rejects.toThrow('取消')
  })
})

describe('analyzeLines', () => {
  it('计算线长（1 度纬度约 110.6 公里）', async () => {
    const result = await analyzeLines([
      line('线1', [
        [0, 0],
        [0, 1],
      ]),
    ])
    const length = parseFloat(result.data[0]!['长度_km'] as string)
    expect(length).toBeGreaterThan(110)
    expect(length).toBeLessThan(111.2)
    expect(result.data[0]!['点数']).toBe(2)
  })
})

describe('analyzePolygons', () => {
  it('计算面积（赤道 1°×1° 约 12300 平方公里）', async () => {
    const result = await analyzePolygons([polygon('面1', SQUARE)])
    const area = parseFloat(result.data[0]!['面积_km2'] as string)
    expect(area).toBeGreaterThan(12200)
    expect(area).toBeLessThan(12400)
    expect(result.data[0]!['顶点数']).toBe(5)
    expect(result.data[0]!['是否有孔洞']).toBe('否')
  })

  it('多边形带孔洞被识别', async () => {
    const result = await analyzePolygons([
      polygon('带孔', [
        SQUARE[0]!,
        [
          [0.4, 0.4],
          [0.6, 0.4],
          [0.6, 0.6],
          [0.4, 0.6],
          [0.4, 0.4],
        ],
      ]),
    ])
    expect(result.data[0]!['是否有孔洞']).toBe('是')
  })
})

describe('analyzePointToPoint', () => {
  it('计算距离与方位角', async () => {
    const result = await analyzePointToPoint([point('A', [0, 0]), point('B', [0, 1])])
    expect(result.data).toHaveLength(1)
    const row = result.data[0]!
    expect(row['点A名称']).toBe('A')
    expect(row['点B名称']).toBe('B')
    expect(parseFloat(row['距离_km'] as string)).toBeGreaterThan(110)
    expect(Math.abs(parseFloat(row['方位角_度'] as string))).toBeLessThan(1)
    expect(row['是否重合']).toBe('否')
  })

  it('相同坐标判定为重合', async () => {
    const result = await analyzePointToPoint([point('A', [1, 1]), point('B', [1, 1])])
    expect(result.data[0]!['是否重合']).toBe('是')
    expect(result.data[0]!['距离_km']).toBe('0.0000')
  })
})

describe('analyzePointToLine', () => {
  it('线上的点判定在线上', async () => {
    const result = await analyzePointToLine(
      [point('P', [0, 0.5])],
      [
        line('L', [
          [0, 0],
          [0, 1],
        ]),
      ],
    )
    const row = result.data[0]!
    expect(row['是否在线上']).toBe('是')
    expect(parseFloat(row['到线距离_m'] as string)).toBeLessThan(1)
    expect(row['线名称']).toBe('L')
  })

  it('线外的点计算距离', async () => {
    const result = await analyzePointToLine(
      [point('P', [1, 0.5])],
      [
        line('L', [
          [0, 0],
          [0, 1],
        ]),
      ],
    )
    const distance = parseFloat(result.data[0]!['到线距离_m'] as string)
    expect(distance).toBeGreaterThan(110000)
    expect(distance).toBeLessThan(112000)
    expect(result.data[0]!['是否在线上']).toBe('否')
  })
})

describe('analyzePointToPolygon', () => {
  it('面内的点判定在面内，距离为负', async () => {
    const result = await analyzePointToPolygon([point('P', [0.5, 0.5])], [polygon('面', SQUARE)])
    expect(result.data[0]!['是否在面内']).toBe('是')
    expect(parseFloat(result.data[0]!['到面距离_m'] as string)).toBeLessThan(0)
  })

  it('面外的点判定在面外', async () => {
    const result = await analyzePointToPolygon([point('P', [5, 5])], [polygon('面', SQUARE)])
    expect(result.data[0]!['是否在面内']).toBe('否')
    const distance = parseFloat(result.data[0]!['到面距离_m'] as string)
    expect(distance).toBeGreaterThan(400000)
  })
})

describe('analyzeLineToLine', () => {
  it('交叉线检测相交与交点数量', async () => {
    const result = await analyzeLineToLine([
      line('线A', [
        [0, 0],
        [1, 1],
      ]),
      line('线B', [
        [0, 1],
        [1, 0],
      ]),
    ])
    const row = result.data[0]!
    expect(row['是否相交']).toBe('是')
    expect(row['交点数量']).toBe(1)
  })

  it('平行线检测平行', async () => {
    const result = await analyzeLineToLine([
      line('线A', [
        [0, 0],
        [1, 0],
      ]),
      line('线B', [
        [0, 1],
        [1, 1],
      ]),
    ])
    expect(result.data[0]!['是否平行']).toBe('是')
    expect(result.data[0]!['是否相交']).toBe('否')
  })
})

describe('analyzeLineToPolygon', () => {
  it('穿越面的线判定相交', async () => {
    const result = await analyzeLineToPolygon(
      [
        line('线A', [
          [-1, 0.5],
          [2, 0.5],
        ]),
      ],
      [polygon('面', SQUARE)],
    )
    expect(result.data[0]!['是否相交']).toBe('是')
    expect(parseInt(result.data[0]!['交点数量'] as string)).toBe(2)
  })
})

describe('analyzePolygonToPolygon', () => {
  it('重叠面检测交叠面积', async () => {
    const result = await analyzePolygonToPolygon([
      polygon('面A', SQUARE),
      polygon('面B', [
        [
          [0.5, 0.5],
          [1.5, 0.5],
          [1.5, 1.5],
          [0.5, 1.5],
          [0.5, 0.5],
        ],
      ]),
    ])
    const row = result.data[0]!
    expect(row['是否相交']).toBe('是')
    expect(parseFloat(row['交叠面积_km2'] as string)).toBeGreaterThan(3000)
  })

  it('分离面判定分离', async () => {
    const result = await analyzePolygonToPolygon([
      polygon('面A', SQUARE),
      polygon('面B', [
        [
          [5, 5],
          [6, 5],
          [6, 6],
          [5, 6],
          [5, 5],
        ],
      ]),
    ])
    expect(result.data[0]!['是否分离']).toBe('是')
    expect(result.data[0]!['交叠面积_km2']).toBe('0')
  })
})

describe('分析类型配置', () => {
  it('getAnalysisLabel 返回中文标签', () => {
    expect(getAnalysisLabel('point_analysis')).toBe('单点分析')
    expect(getAnalysisLabel('polygon_to_polygon')).toBe('面与面关系')
  })

  it('按数据量过滤可用类型', () => {
    const types = getAvailableAnalysisTypes(3, 0, 0)
    expect(types).toContain('point_analysis')
    expect(types).toContain('point_to_point')
    expect(types).not.toContain('line_analysis')
    expect(types).not.toContain('line_to_line')
  })

  it('满足多类数据时全部可用', () => {
    const types = getAvailableAnalysisTypes(2, 2, 2)
    expect(types).toHaveLength(9)
  })

  it('未知类型返回原值', () => {
    expect(getAnalysisLabel('unknown' as AnalysisType)).toBe('unknown')
  })
})

// ============================================================
// 审计 P0-4：畸形几何容错
// ============================================================
//
// turf 遇到「只有 1 个点的 LineString」「未闭合的 3 点 Polygon」会直接抛错，
// 而这些在真实 KML 里很常见。旧实现没有 try/catch，一个坏要素就让整场分析
// reject、已算完的结果全部作废，用户只看到一句
// 「分析失败: coordinates must contain at least 2 positions」。
//
// 现在逐要素容错：坏要素记入 result.errors 并跳过，其它要素照常产出。

/** 1 个点的 LineString —— turf.lineString 会抛错 */
const BAD_LINE = line('坏线', [[116.4, 39.9]])
/** 3 点未闭合的 Polygon —— turf.polygon 会抛错 */
const BAD_POLYGON = polygon('坏面', [
  [
    [116, 39],
    [117, 39],
    [117, 40],
  ],
])
const GOOD_LINE = line('好线', [
  [116.4, 39.9],
  [116.5, 39.95],
])

describe('analyzeLines - 畸形几何容错（P0-4）', () => {
  it('1 点 LineString 被跳过，其它线照常分析', async () => {
    const result = await analyzeLines([BAD_LINE, GOOD_LINE])

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({ 名称: '好线' })
    expect(result.errors).toHaveLength(1)
    expect(result.errors![0]).toContain('坏线')
  })

  it('全部畸形时 data 为空但不抛错', async () => {
    const result = await analyzeLines([BAD_LINE, line('b', [[3, 4]])])
    expect(result.data).toHaveLength(0)
    expect(result.errors).toHaveLength(2)
  })
})

describe('analyzePolygons - 畸形几何容错（P0-4）', () => {
  it('3 点未闭合环被跳过，合法面照常分析', async () => {
    const result = await analyzePolygons([BAD_POLYGON, polygon('好面', SQUARE)])

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({ 名称: '好面' })
    expect(result.errors).toHaveLength(1)
    expect(result.errors![0]).toContain('坏面')
  })
})

describe('analyzePointToLine - 畸形线只影响该组合（P0-4）', () => {
  it('坏线跳过、好线正常，不丢点自身的结果', async () => {
    const result = await analyzePointToLine(
      [point('P1', [116.4, 39.9]), point('P2', [116.5, 39.95])],
      [BAD_LINE, GOOD_LINE],
    )

    // 2 点 × 1 条好线 = 2 行
    expect(result.data).toHaveLength(2)
    expect(result.errors).toHaveLength(2)
    expect(result.errors![0]).toContain('坏线')
  })
})

describe('analyzePointToPolygon - 畸形面只影响该组合（P0-4）', () => {
  it('坏面跳过、好面正常', async () => {
    const result = await analyzePointToPolygon(
      [point('P1', [116.4, 39.9])],
      [BAD_POLYGON, polygon('好面', SQUARE)],
    )

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({ 面名称: '好面' })
    expect(result.errors).toHaveLength(1)
  })
})

describe('analyzeLineToLine - 一条坏线不影响其它配对（P0-4）', () => {
  it('3 条线中有 1 条畸形，其余 2 条之间的配对照常', async () => {
    const result = await analyzeLineToLine([
      BAD_LINE,
      line('A', [
        [116.4, 39.9],
        [116.5, 39.95],
      ]),
      line('B', [
        [116.4, 39.9],
        [116.6, 39.99],
      ]),
    ])

    // 3 条线 3 个配对，含坏线的 2 个失败，剩 A↔B 成功
    expect(result.data).toHaveLength(1)
    expect(result.errors).toHaveLength(2)
  })
})

describe('analyzeLineToPolygon - 畸形几何不影响其它组合（P0-4）', () => {
  it('坏面和坏线都被跳过，合法组合正常', async () => {
    const result = await analyzeLineToPolygon(
      [BAD_LINE, GOOD_LINE],
      [BAD_POLYGON, polygon('好面', SQUARE)],
    )

    // 2 线 × 2 面 = 4 组合，3 个失败（坏线×2 + 好线×坏面），1 个成功
    expect(result.data).toHaveLength(1)
    expect(result.errors).toHaveLength(3)
  })
})

describe('analyzePolygonToPolygon - 畸形面不影响其它配对（P0-4）', () => {
  it('坏面被跳过，好面之间照常分析', async () => {
    const result = await analyzePolygonToPolygon([
      BAD_POLYGON,
      polygon('A', SQUARE),
      polygon('B', [
        [
          [118, 41],
          [119, 41],
          [119, 42],
          [118, 42],
          [118, 41],
        ],
      ]),
    ])

    expect(result.data).toHaveLength(1) // 只剩 A↔B
    expect(result.errors).toHaveLength(2) // 坏↔A、坏↔B
  })
})

describe('analyzePoints - 正常路径不受影响（P0-4）', () => {
  it('合法点正常分析且没有 errors', async () => {
    const result = await analyzePoints([point('P1', [116.4, 39.9]), point('P2', [116.5, 39.95])])
    expect(result.data).toHaveLength(2)
    expect(result.errors).toEqual([])
  })
})

describe('取消操作仍然抛错，不被容错吞掉（P0-4）', () => {
  it('isCanceled 返回 true 时抛出"取消"', async () => {
    await expect(analyzeLines([GOOD_LINE], undefined, () => true)).rejects.toThrow('取消')
  })
})
