import { describe, it, expect, vi, afterEach } from 'vitest'
import JSZip from 'jszip'
import { parseKML, parseKMZ } from '../geoDataService'

/**
 * C4 阶段 1（审计缺陷 B）：`parseKML` / `parseKMZ` 的要素循环原本是同步 `forEach`，
 * `onProgress` 被同步调用几千次，浏览器一次都重绘不了 —— 用户看到进度条死在 70%
 * （KMZ 甚至停在 80%），直到整个循环跑完才一把跳 100%。
 *
 * 本文件把"有没有让出主线程"变成**可自动化的断言**（计划 §六 指标 1）：
 * 不去肉眼看进度条，而是数「控制权交还事件循环的次数」——
 * yieldToUI 走 setTimeout(…, 0)，因此统计解析期间的 0ms setTimeout 调用即可。
 */

function fileFromString(content: string, name = 'test.kml'): File {
  return new File([content], name, { type: 'application/vnd.google-earth.kml+xml' })
}

/** 生成 N 个 Placemark 的 KML，用于撑大要素循环 */
function buildKml(placemarkCount: number): string {
  const placemarks = Array.from(
    { length: placemarkCount },
    (_, i) =>
      `<Placemark><name>P${i}</name><Point><coordinates>116.${i % 90},39.${i % 80},0</coordinates></Point></Placemark>`,
  ).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${placemarks}</Document></kml>`
}

async function buildKmz(placemarkCount: number): Promise<File> {
  return buildKmzFromKml(buildKml(placemarkCount))
}

async function buildKmzFromKml(kmlContent: string): Promise<File> {
  const zip = new JSZip()
  zip.file('doc.kml', kmlContent)
  const blob = await zip.generateAsync({ type: 'blob' })
  return new File([blob], 'test.kmz', { type: 'application/vnd.google-earth.kmz' })
}

/**
 * 统计解析期间「让出主线程」的次数。
 * yieldToUI(ms=0) 走 setTimeout(resolve, 0)，所以 0ms 的 setTimeout 调用数
 * 就是控制权交还事件循环的次数。其余 setTimeout（如 100ms 的下载清理）不计入。
 */
function countYields() {
  const realSetTimeout = globalThis.setTimeout.bind(globalThis)
  let zeroDelayCalls = 0
  const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    fn: () => void,
    ms?: number,
  ) => {
    if (ms === 0) zeroDelayCalls++
    return realSetTimeout(fn, ms)
  }) as unknown as typeof setTimeout)
  return { getCount: () => zeroDelayCalls, restore: () => spy.mockRestore() }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseKML - 真进度与真让出（C4 阶段 1 / 审计缺陷 B）', () => {
  it('1200 要素下至少 yield 3 次，证明循环真的让出主线程', async () => {
    const counter = countYields()
    let result
    try {
      result = await parseKML(fileFromString(buildKml(1200)), () => {})
    } finally {
      counter.restore()
    }
    expect(result.features).toHaveLength(1200)
    // 让出粒度 = 每 500 要素一次（index 0 / 500 / 1000）
    expect(counter.getCount()).toBeGreaterThanOrEqual(3)
  })

  it('进度在 70% 之后逐级上报，且回调次数远小于要素数（不再一次性灌几千次）', async () => {
    const reports: number[] = []
    // 用不被 30 整除的要素数：1200 时 1% 步长恰好落在整数上，
    // 取整断言会「假绿」（旧实现按要素上报的 71.0002 才是真实症状）。
    await parseKML(fileFromString(buildKml(1207)), (percent) => reports.push(percent))

    // 70% 之后必须有多个中间值（1% 粒度）
    const intermediate = reports.filter((p) => p > 70 && p < 100)
    expect(intermediate.length).toBeGreaterThan(3)

    // 单调不减，且最终确实到 100
    for (let i = 1; i < reports.length; i++) {
      expect(reports[i]!).toBeGreaterThanOrEqual(reports[i - 1]!)
    }
    expect(reports[reports.length - 1]).toBe(100)

    // 旧实现每个要素同步回调一次：1200 要素 → 约 1200 次调用，浏览器一次都重绘不了。
    // 现在按 1% 粒度节流，1200 要素只应触发几十次。
    expect(reports.length).toBeLessThan(50)

    // 上报值必须是整数百分比：5 万要素首帧算出来是 71.0002，
    // 不取整页面会渲染出 "71.0002%"
    for (const p of reports) {
      expect(Number.isInteger(p)).toBe(true)
    }
  })

  it('解析期间外部宏任务确实在推进（不是一次性同步灌完）', async () => {
    // 比"数 setTimeout 调用次数"更硬：在进度回调里起一个 0ms 探针。
    // 只有控制权真的交还事件循环，探针才会在解析 resolve 之前触发。
    // 旧实现（同步 forEach）下所有探针只能在解析结束后才跑 → 计数为 0。
    let probesFired = 0
    const probeIds: ReturnType<typeof setTimeout>[] = []
    await parseKML(fileFromString(buildKml(1200)), (percent) => {
      if (percent > 70 && percent < 100) {
        probeIds.push(
          setTimeout(() => {
            probesFired++
          }, 0),
        )
      }
    })
    // 此处仍在微任务里：await 恢复先于任何挂起的 0ms 宏任务
    const firedBeforeResolve = probesFired
    for (const id of probeIds) clearTimeout(id)
    expect(firedBeforeResolve).toBeGreaterThan(0)
  })

  it('让出是「按批」而非逐要素：1200 要素只 yield 寥寥数次（计划风险 R4）', async () => {
    const counter = countYields()
    let result
    try {
      result = await parseKML(fileFromString(buildKml(1200)), () => {})
    } finally {
      counter.restore()
    }
    // 让出粒度 = 每 500 要素一次。逐要素 yield 会产生上千次微任务，
    // 反而拖慢整体吞吐，因此上界也必须钉住。
    expect(counter.getCount()).toBeLessThanOrEqual(5)
    expect(result.features).toHaveLength(1200)
  })
})

describe('parseKMZ - 真进度与真让出（C4 阶段 1 / 审计缺陷 B）', () => {
  it('1200 要素下至少 yield 3 次', async () => {
    const counter = countYields()
    let result
    try {
      result = await parseKMZ(await buildKmz(1200), () => {})
    } finally {
      counter.restore()
    }
    expect(result.features).toHaveLength(1200)
    expect(counter.getCount()).toBeGreaterThanOrEqual(3)
  })

  it('要素循环期间有 80→100 的进度上报（旧实现整段没有任何进度）', async () => {
    const reports: number[] = []
    await parseKMZ(await buildKmz(1200), (percent) => reports.push(percent))
    const inFeatureLoop = reports.filter((p) => p >= 80 && p < 100)
    expect(inFeatureLoop.length).toBeGreaterThan(3)
    expect(reports[reports.length - 1]).toBe(100)
  })

  it('混合 fixture：要素数量、类型、计数正确（守护 continue 被误写成 break 的静默截断）', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark><name>无几何</name></Placemark>
  <Placemark><name>点</name><Point><coordinates>116.4,39.9,0</coordinates></Point></Placemark>
  <Placemark><name>线</name><LineString><coordinates>116.1,39.1,0 116.2,39.2,0</coordinates></LineString></Placemark>
  <Placemark><name>面</name><Polygon><outerBoundaryIs><LinearRing><coordinates>116,39,0 117,39,0 117,40,0 116,39,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
</Document></kml>`
    const result = await parseKMZ(await buildKmzFromKml(kml))

    expect(result.success).toBe(true)
    // 无几何的 Placemark 被跳过（continue），但其后的要素必须全部保留。
    // 若这里被写成 break，则只剩 0 个要素 —— 5 万要素会静默截断且全测试绿。
    expect(result.features.map((f) => f.type)).toEqual(['Point', 'LineString', 'Polygon'])
    expect(result.features.map((f) => f.name)).toEqual(['点', '线', '面'])
    expect(result.totalPoints).toBe(1)
    expect(result.totalLines).toBe(1)
    expect(result.totalPolygons).toBe(1)

    // 注：KML 的 <MultiGeometry>（togeojson → GeometryCollection）在 parseKMZ 里
    // 仍会走 default 分支被整块丢弃 —— 与 parseKML 已修的 P0-4 同类，
    // 属本批次外的既有缺陷（已记入 deepwork 文件），故此处不断言其行为。
  })
})
