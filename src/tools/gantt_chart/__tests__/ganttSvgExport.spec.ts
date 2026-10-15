import { describe, it, expect } from 'vitest'
import { dataURLToBlob, cropEmptyDates, injectHeaderToSvg } from '../ganttSvgExport'

/**
 * 甘特图导出的回归测试（D4 抽取 `ganttSvgExport.ts` 时新增）
 *
 * 只覆盖 **确定性**的部分（dataURL 解析、裁剪数学、无头部时的短路）。
 * `collectGanttCSS` 依赖 getComputedStyle 的 CSS 变量计算值、`prepareSvg` 依赖
 * 甘特图真实 DOM，jsdom 下都拿不到有意义的值 —— 那些靠 e2e（工具页能打开、
 * 导出按钮不报错）与 type-check 保证，不写假绿断言。
 */

describe('dataURLToBlob', () => {
  it('解析合法的 dataURL', () => {
    const blob = dataURLToBlob('data:image/png;base64,SGVsbG8=')
    expect(blob).not.toBeNull()
    expect(blob!.type).toBe('image/png')
    expect(blob!.size).toBe(5) // "Hello"
  })

  it('解析 jpeg dataURL', () => {
    const blob = dataURLToBlob('data:image/jpeg;base64,SGVsbG8=')
    expect(blob!.type).toBe('image/jpeg')
  })

  it('没有逗号 → null', () => {
    expect(dataURLToBlob('data:image/png;base64SGVsbG8=')).toBeNull()
  })

  it('缺少 mime 段 → null', () => {
    expect(dataURLToBlob('dataimage/png;base64,SGVsbG8=')).toBeNull()
  })
})

describe('cropEmptyDates', () => {
  /** 构造一个带任务条的 SVG（jsdom 支持 createElementNS + setAttribute） */
  function makeSvg(width: number, height: number, bars: Array<[number, number, number, number]>) {
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(height))
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    for (const [x, y, w, h] of bars) {
      const wrapper = document.createElementNS(ns, 'g')
      wrapper.setAttribute('class', 'bar-wrapper')
      const bar = document.createElementNS(ns, 'rect')
      bar.setAttribute('class', 'bar')
      bar.setAttribute('x', String(x))
      bar.setAttribute('y', String(y))
      bar.setAttribute('width', String(w))
      bar.setAttribute('height', String(h))
      wrapper.appendChild(bar)
      svg.appendChild(wrapper)
    }
    return svg
  }

  it('按任务条包围盒收窄 viewBox（左右各留 60、下方留 30）', () => {
    const svg = makeSvg(1000, 500, [
      [200, 40, 100, 20],
      [260, 80, 100, 20],
    ])

    cropEmptyDates(svg)

    // minX=200 → cropX=140；maxX=360 → cropW=360-140+60=280
    expect(svg.getAttribute('viewBox')).toBe('140 0 280 130')
    expect(svg.getAttribute('width')).toBe('280')
    // maxY=100，min(500, 100+30)=130
    expect(svg.getAttribute('height')).toBe('130')
  })

  it('裁剪宽度不小于 0 且不超过原宽（ padX 会把 cropX 钳到 0 ）', () => {
    const svg = makeSvg(1000, 500, [[10, 40, 100, 20]])

    cropEmptyDates(svg)

    // minX=10 → max(0, 10-60)=0；cropW=min(1000-0, 110-0+60)=170
    expect(svg.getAttribute('viewBox')).toBe('0 0 170 90')
  })

  it('没有任务条时原样不动', () => {
    const svg = makeSvg(1000, 500, [])
    cropEmptyDates(svg)
    expect(svg.getAttribute('viewBox')).toBe('0 0 1000 500')
    expect(svg.getAttribute('width')).toBe('1000')
  })

  it('任务条铺满整幅时不裁剪（cropW >= origWidth）', () => {
    const svg = makeSvg(400, 500, [[0, 40, 400, 20]])
    cropEmptyDates(svg)
    // cropX=0，cropW=min(400, 400-0+60)=400 → 不满足 < origWidth，保持原样
    expect(svg.getAttribute('width')).toBe('400')
  })
})

describe('injectHeaderToSvg', () => {
  it('容器里没有 .grid-header → 返回 0 且不改 SVG', () => {
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('height', '400')
    const container = document.createElement('div')

    expect(injectHeaderToSvg(svg, container)).toBe(0)
    expect(svg.getAttribute('height')).toBe('400')
  })

  it('容器为 null → 返回 0', () => {
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    expect(injectHeaderToSvg(svg, null)).toBe(0)
  })

  it('grid-header 高度为 0（jsdom 无布局）→ 返回 0，不注入', () => {
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    const container = document.createElement('div')
    const header = document.createElement('div')
    header.className = 'grid-header'
    container.appendChild(header)

    // jsdom 下 offsetHeight 恒为 0，因此走「没有可注入头部」的短路
    expect(injectHeaderToSvg(svg, container)).toBe(0)
    expect(svg.querySelector('.timeline-header')).toBeNull()
  })
})
