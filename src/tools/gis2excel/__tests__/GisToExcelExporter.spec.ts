import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { GisFeature } from '../GisFileReader'
import {
  formatCoordinates,
  exportToExcel,
  exportSeparateFiles,
  type ExportOptions,
} from '../GisToExcelExporter'

const defaultOptions: ExportOptions = {
  lonLatSeparator: ',',
  coordSeparator: ';',
  polygonLonLatSeparator: ',',
  polygonCoordSeparator: ';',
  closePolygon: false,
}

function makeFeature(
  type: 'Point' | 'LineString' | 'Polygon',
  name: string,
  coordinates: string,
  path = '',
): GisFeature {
  return { id: 'f1', type, name, coordinates, path, properties: {} }
}

let anchors: HTMLAnchorElement[] = []
let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>

beforeEach(() => {
  anchors = []
  createObjectURL = vi.fn(() => 'blob:mock')
  revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', {
    value: createObjectURL,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: revokeObjectURL,
    writable: true,
    configurable: true,
  })
  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'a') return originalCreateElement(tag)
    const anchor = originalCreateElement('a')
    vi.spyOn(anchor, 'click').mockImplementation(() => {})
    anchors.push(anchor)
    return anchor
  })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('formatCoordinates', () => {
  it('Point 使用经纬度分隔符', () => {
    const options = { ...defaultOptions, lonLatSeparator: '，' }
    expect(formatCoordinates('116.4,39.9', 'Point', options)).toBe('116.4，39.9')
  })

  it('LineString 使用坐标分隔符', () => {
    const options = { ...defaultOptions, coordSeparator: '; ' }
    expect(formatCoordinates('1,2;3,4', 'LineString', options)).toBe('1,2; 3,4')
  })

  it('Polygon 使用专用分隔符', () => {
    const options = {
      ...defaultOptions,
      polygonLonLatSeparator: ':',
      polygonCoordSeparator: '|',
    }
    expect(formatCoordinates('1,2;3,4', 'Polygon', options)).toBe('1:2|3:4')
  })

  it('Polygon 开启闭合且首尾不同时追加首点', () => {
    const options = { ...defaultOptions, closePolygon: true }
    expect(formatCoordinates('1,2;3,4', 'Polygon', options)).toBe('1,2;3,4;1,2')
  })

  it('Polygon 已闭合时不重复追加', () => {
    const options = { ...defaultOptions, closePolygon: true }
    expect(formatCoordinates('1,2;3,4;1,2', 'Polygon', options)).toBe('1,2;3,4;1,2')
  })

  it('Polygon 未开启闭合时不追加', () => {
    expect(formatCoordinates('1,2;3,4', 'Polygon', defaultOptions)).toBe('1,2;3,4')
  })

  it('空坐标退化为 ,undefined（保持原实现行为）', () => {
    expect(formatCoordinates('', 'Polygon', defaultOptions)).toBe(',undefined')
  })
})

describe('exportToExcel / exportSeparateFiles', () => {
  it('csv 导出：按类型分组生成区块并下载', async () => {
    const groups = [
      [makeFeature('Point', '站点A', '116.4,39.9')],
      [makeFeature('Polygon', '甲,乙', '1,2;3,4')],
    ]
    await exportToExcel(groups, 'csv', defaultOptions)
    expect(anchors[0]!.getAttribute('download')).toBe('gis_export.csv')
    const blob = createObjectURL.mock.calls[0]![0] as Blob
    const text = await blob.text()
    expect(text).toContain('[点]')
    expect(text).toContain('名称,经纬度,路径')
    expect(text).toContain('站点A,"116.4,39.9",')
    expect(text).toContain('[面]')
    expect(text).toContain('"甲,乙","1,2;3,4",')
    vi.advanceTimersByTime(200)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('xlsx 导出：生成 xlsx Blob 并下载', async () => {
    const pending = exportToExcel(
      [[makeFeature('Point', '站点A', '116.4,39.9')]],
      'xlsx',
      defaultOptions,
    )
    await vi.advanceTimersByTimeAsync(0)
    await pending
    const blob = createObjectURL.mock.calls[0]![0] as Blob
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(anchors[0]!.getAttribute('download')).toBe('gis_export.xlsx')
  })

  it('exportSeparateFiles：真的让出主线程，不再有伪 yield', async () => {
    // 审计缺陷 A：旧实现是 `setTimeout(() => {}, 200)` —— 未 await、空回调、在 forEach 里，
    // 所有文件在一次同步任务里全部下载完，"让出"从未发生。
    // 现在每组之间 await yieldToUI(200)：第一份同步产出，第二份必须等定时器落地。
    const groups = [
      [makeFeature('Point', '站点A', '116.4,39.9')],
      [makeFeature('LineString', '线1', '1,2;3,4')],
    ]
    const pending = exportSeparateFiles(groups, 'csv', defaultOptions)
    expect(anchors.map((a) => a.getAttribute('download'))).toEqual(['gis_点.csv'])

    await vi.advanceTimersByTimeAsync(200)
    expect(anchors.map((a) => a.getAttribute('download'))).toEqual(['gis_点.csv', 'gis_线.csv'])

    await pending
    const text = await (createObjectURL.mock.calls[0]![0] as Blob).text()
    expect(text).toContain('站点A,"116.4,39.9",')
  })

  it('exportSeparateFiles：xlsx 模式', async () => {
    const pending = exportSeparateFiles(
      [[makeFeature('Point', '站点A', '116.4,39.9')]],
      'xlsx',
      defaultOptions,
    )
    await vi.advanceTimersByTimeAsync(0)
    await pending
    expect(anchors[0]!.getAttribute('download')).toBe('gis_点.xlsx')
  })

  it('空分组被跳过（且首组的 yield 不影响后续组）', async () => {
    const pending = exportSeparateFiles(
      [[], [makeFeature('Point', 'a', '1,2')]],
      'csv',
      defaultOptions,
    )
    expect(anchors).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(200)
    await pending
    expect(anchors).toHaveLength(1)
  })
})
