/**
 * 甘特图导出（SVG / PNG / JPG / JSON）
 *
 * D4 第一步：原为 `GanttChartPage.vue` 内联的 ~480 行（`collectGanttCSS` /
 * `injectHeaderToSvg` / `cropEmptyDates` / `exportSVG` / `exportPNG` /
 * `exportJPG` / `dataURLToBlob` / `exportTasks`）。这些函数只依赖
 * **甘特图容器元素**与一个错误提示回调，不依赖任何 Vue 状态，抽出后可单测。
 *
 * 抽取时合并了两处近似实现（审计 P3-4 的同一模式）：
 *   - `exportPNG` 与 `exportJPG` 原本是两份几乎相同的代码（SVG → canvas →
 *     dataURL → Blob → 下载），差异只有 mime / quality / 扩展名 →
 *     合并为 `exportGanttRaster(ctx, { format, scale, quality })`。
 *   - 三处「克隆 SVG → 嵌 CSS → 注入头部 → 裁剪空白」的重复前置 →
 *     合并为 `prepareSvg`。
 *
 * ⚠ 行为变化（有意）：下载统一走 `utils/download.ts` 的 `downloadBlob`
 * （appendChild 进文档 + **延迟 100ms** 再 revokeObjectURL）。原实现在
 * `click()` 后立即 revoke，Firefox 上会下载到空文件（2026-09-27 审计
 * 已记录该风险，C4 只修了 xlsx 路径）。
 */
import type { GanttTask } from '@/stores/ganttStore'
import { logger } from '@/utils/logger'
import { downloadBlob } from '@/utils/download'

/** 导出所需的上下文：容器元素 + 错误提示（页面传入 `showErrorDialog`） */
export interface GanttExportContext {
  container: HTMLElement | null
  onError: (message: string) => void
}

/** 日期戳：与旧实现的 `YYYYMMDD` 一致 */
function dateStamp(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
}

/** dataURL → Blob（用于 canvas.toDataURL 的产物） */
export function dataURLToBlob(dataUrl: string): Blob | null {
  const parts = dataUrl.split(',')
  if (parts.length !== 2) return null

  const mime = parts[0]!.match(/:(.*?);/)
  if (!mime) return null

  const byteString = atob(parts[1]!)
  const arrayBuffer = new ArrayBuffer(byteString.length)
  const uint8Array = new Uint8Array(arrayBuffer)

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i)
  }

  return new Blob([uint8Array], { type: mime[1] })
}

/**
 * 收集甘特图相关 CSS，使导出的 SVG 自带样式。
 *
 * 三个来源：
 *  1. 页面内联 `<style>` 标签中含 gantt 的规则；
 *  2. 外部样式表中含 gantt 的规则（跨域样式表读不了，跳过）；
 *  3. **当前主题**下 `.gantt` 元素上 CSS 变量的计算值 —— 少了这份，
 *     导出的 SVG 会退回默认主题配色。
 */
export function collectGanttCSS(container: HTMLElement | null): string {
  const parts: string[] = []

  // 收集内联 <style> 标签中的甘特图 CSS
  for (const styleEl of document.querySelectorAll('style')) {
    const text = styleEl.textContent || ''
    if (text.includes('gantt') || text.includes('--g-arrow-color')) {
      parts.push(text)
    }
  }

  // 收集外部样式表中的甘特图 CSS
  for (const sheet of document.styleSheets) {
    try {
      if (!sheet.cssRules) continue
      let css = ''
      for (const rule of sheet.cssRules) {
        css += rule.cssText + '\n'
      }
      if (css.includes('gantt') || css.includes('--g-arrow-color')) {
        parts.push(css)
      }
    } catch {
      // 跨域样式表无法访问，跳过
    }
  }

  // 注入当前主题的 CSS 变量计算值，确保导出的 SVG 与当前视图一致
  const ganttEl = container?.querySelector('.gantt') as HTMLElement | null
  if (ganttEl) {
    const cs = window.getComputedStyle(ganttEl)
    const varNames = [
      '--g-arrow-color',
      '--g-bar-color',
      '--g-bar-border',
      '--g-tick-color-thick',
      '--g-tick-color',
      '--g-actions-background',
      '--g-border-color',
      '--g-text-muted',
      '--g-text-light',
      '--g-text-dark',
      '--g-progress-color',
      '--g-handle-color',
      '--g-weekend-label-color',
      '--g-expected-progress',
      '--g-header-background',
      '--g-row-color',
      '--g-row-border-color',
      '--g-today-highlight',
      '--g-popup-actions',
      '--g-weekend-highlight-color',
    ]
    let rootVars = ':root {\n'
    for (const name of varNames) {
      const value = cs.getPropertyValue(name).trim()
      if (value) {
        rootVars += `  ${name}: ${value};\n`
      }
    }
    rootVars += '}\n'
    parts.push(rootVars)

    // 同时注入 gv- 变量（frappe-gantt 运行时设置的）
    const gvNames = [
      '--gv-grid-height',
      '--gv-column-width',
      '--gv-upper-header-height',
      '--gv-lower-header-height',
    ]
    let gvVars = '.gantt-container {\n'
    for (const name of gvNames) {
      const value = cs.getPropertyValue(name).trim()
      if (value) {
        gvVars += `  ${name}: ${value};\n`
      }
    }
    gvVars += '}\n'
    parts.push(gvVars)
  }

  return parts.join('\n')
}

/**
 * 将 HTML 渲染的甘特图时间轴头部转换为 SVG 元素并插入到 SVG 顶部。
 * Frappe Gantt 的 .grid-header 是 HTML（非 SVG），直接导出 SVG 会丢失头部时间轴。
 *
 * @returns 头部下方内容整体下移的距离（0 = 没有可注入的头部）
 */
export function injectHeaderToSvg(svg: SVGSVGElement, container: HTMLElement | null): number {
  const gridHeader = container?.querySelector('.grid-header') as HTMLElement | null
  if (!gridHeader) return 0

  const headerHeight = gridHeader.offsetHeight
  if (headerHeight === 0) return 0

  const headerCS = window.getComputedStyle(gridHeader)
  const headerBg = headerCS.backgroundColor || 'transparent'

  const svgWidth = parseFloat(svg.getAttribute('width') || '0') || svg.viewBox.baseVal.width || 800
  const svgHeight =
    parseFloat(svg.getAttribute('height') || '0') || svg.viewBox.baseVal.height || 400

  const upperTexts = gridHeader.querySelectorAll('.upper-text')
  const lowerTexts = gridHeader.querySelectorAll('.lower-text')

  const ns = 'http://www.w3.org/2000/svg'
  const g = document.createElementNS(ns, 'g')
  g.setAttribute('class', 'timeline-header')

  // 背景
  const bg = document.createElementNS(ns, 'rect')
  bg.setAttribute('x', '0')
  bg.setAttribute('y', '0')
  bg.setAttribute('width', String(svgWidth))
  bg.setAttribute('height', String(headerHeight))
  bg.setAttribute('fill', headerBg)
  g.appendChild(bg)

  // 底部分隔线
  const line = document.createElementNS(ns, 'line')
  line.setAttribute('x1', '0')
  line.setAttribute('y1', String(headerHeight - 1))
  line.setAttribute('x2', String(svgWidth))
  line.setAttribute('y2', String(headerHeight - 1))
  line.setAttribute('stroke', '#d4d4d4')
  line.setAttribute('stroke-width', '1')
  g.appendChild(line)

  // 转换 upper/lower text -> SVG text，同时处理今日高亮背景
  const appendSvgTexts = (texts: NodeListOf<Element>) => {
    texts.forEach((el) => {
      const htmlEl = el as HTMLElement
      const t = htmlEl.textContent?.trim()
      if (!t) return
      const s = window.getComputedStyle(htmlEl)
      const left = parseFloat(s.left) || parseFloat(htmlEl.style.left) || 0
      const top = parseFloat(s.top) || parseFloat(htmlEl.style.top) || 0
      const w = htmlEl.offsetWidth
      const h = htmlEl.offsetHeight

      // 今日高亮：为 .current-date-highlight 元素添加背景圆角矩形
      if (htmlEl.classList.contains('current-date-highlight')) {
        const hlBg = s.backgroundColor
        if (hlBg && hlBg !== 'rgba(0, 0, 0, 0)' && hlBg !== 'transparent') {
          const hl = document.createElementNS(ns, 'rect')
          hl.setAttribute('x', String(left + 2))
          hl.setAttribute('y', String(top + 2))
          hl.setAttribute('width', String(w - 4))
          hl.setAttribute('height', String(h - 4))
          hl.setAttribute('fill', hlBg)
          hl.setAttribute('rx', '4')
          g.appendChild(hl)
        }
      }

      const txt = document.createElementNS(ns, 'text')
      txt.setAttribute('x', String(left + w / 2))
      txt.setAttribute('y', String(top + h / 2))
      txt.setAttribute('text-anchor', 'middle')
      txt.setAttribute('dominant-baseline', 'central')
      txt.setAttribute('font-size', s.fontSize || '12px')
      txt.setAttribute('font-weight', s.fontWeight || '400')
      txt.setAttribute('fill', s.color || '#333')
      txt.textContent = t
      g.appendChild(txt)
    })
  }
  appendSvgTexts(upperTexts)
  appendSvgTexts(lowerTexts)

  // 找到第一个任务条的 y 坐标，确保头部和内容紧密贴合
  const bars = svg.querySelectorAll('.bar-wrapper .bar')
  let minBarY = 0
  bars.forEach((bar) => {
    const y = parseFloat(bar.getAttribute('y') || '0')
    if (!isNaN(y) && (minBarY === 0 || y < minBarY)) minBarY = y
  })

  // 让第一个 bar 紧贴头部下方（只留 2px 间距）
  const gap = 2
  const shiftY = headerHeight + gap - minBarY

  Array.from(svg.children).forEach((child) => {
    if (child === g) return
    const el = child as HTMLElement & { _shifted?: boolean }
    if (el._shifted) return
    el._shifted = true
    const cur = el.getAttribute('transform') || ''
    el.setAttribute('transform', (cur ? cur + ' ' : '') + `translate(0, ${shiftY})`)
  })

  svg.insertBefore(g, svg.firstChild)

  // 扩展 SVG 高度
  const newH = svgHeight + shiftY
  svg.setAttribute('height', String(newH))
  if (svg.hasAttribute('viewBox')) {
    const vb = svg.viewBox.baseVal
    svg.setAttribute('viewBox', `0 0 ${vb.width || svgWidth} ${newH}`)
  } else {
    svg.setAttribute('viewBox', `0 0 ${svgWidth} ${newH}`)
  }

  return shiftY
}

/**
 * 裁剪无任务的空白日期区域：按任务条的实际包围盒收窄 viewBox
 * （左右各留 60px、下方留 30px 内边距）。
 */
export function cropEmptyDates(svg: SVGSVGElement): void {
  const bars = svg.querySelectorAll('.bar-wrapper .bar')
  if (bars.length === 0) return

  let minX = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  bars.forEach((bar) => {
    const x = parseFloat(bar.getAttribute('x') || '0')
    const w = parseFloat(bar.getAttribute('width') || '0')
    const y = parseFloat(bar.getAttribute('y') || '0')
    const h = parseFloat(bar.getAttribute('height') || '0')
    if (!isNaN(x) && !isNaN(w)) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x + w)
    }
    if (!isNaN(y) && !isNaN(h)) {
      maxY = Math.max(maxY, y + h)
    }
  })
  if (!isFinite(minX) || !isFinite(maxX)) return

  const padX = 60
  const padY = 30
  const svgHeight = parseFloat(svg.getAttribute('height') || '0') || svg.viewBox.baseVal.height
  const origWidth = parseFloat(svg.getAttribute('width') || '0') || svg.viewBox.baseVal.width

  // 左右裁剪
  const cropX = Math.max(0, minX - padX)
  const cropW = Math.min(origWidth - cropX, maxX - cropX + padX)

  // 下方裁剪：去除最后一个任务条下方的空白
  const cropH = isFinite(maxY) ? Math.min(svgHeight, maxY + padY) : svgHeight

  if (cropW > 0 && cropW < origWidth) {
    svg.setAttribute('viewBox', `${cropX} 0 ${cropW} ${cropH}`)
    svg.setAttribute('width', String(Math.round(cropW)))
    svg.setAttribute('height', String(Math.round(cropH)))
  }
}

/**
 * 三种导出公用的前置：克隆 SVG → 写 xmlns → 嵌 CSS → 注入 HTML 头部 → 裁剪空白。
 *
 * @returns 处理好的深克隆 SVG；容器/SVG 不存在时**已通过 onError 提示**并返回 null
 */
function prepareSvg(ctx: GanttExportContext): SVGSVGElement | null {
  const { container, onError } = ctx
  if (!container) {
    onError('无法找到甘特图容器')
    return null
  }

  const originalSvg = container.querySelector('svg')
  if (!originalSvg) {
    onError('无法找到SVG元素，请确保甘特图已正确加载')
    return null
  }

  // 深克隆 SVG，避免修改原始 DOM
  const svgClone = originalSvg.cloneNode(true) as SVGSVGElement
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  // 嵌入甘特图 CSS，使导出的 SVG 自带样式
  const cssText = collectGanttCSS(container)
  if (cssText) {
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    styleEl.textContent = `\n${cssText}\n`
    svgClone.insertBefore(styleEl, svgClone.firstChild)
  }

  // 注入 HTML 渲染的甘特图时间轴头部到 SVG
  injectHeaderToSvg(svgClone, container)

  // 裁剪无任务的空白日期区域（右侧）
  cropEmptyDates(svgClone)

  return svgClone
}

/** 导出 SVG */
export function exportGanttSvg(ctx: GanttExportContext): void {
  const svg = prepareSvg(ctx)
  if (!svg) return

  const svgString = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`
  downloadBlob(
    new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }),
    `gantt-chart-${dateStamp()}.svg`,
  )
}

/**
 * 导出位图（PNG / JPG）。
 *
 * 旧实现是 `exportPNG` / `exportJPG` 两份近似拷贝，这里合并：SVG → Image →
 * canvas 按 scale 放大 → toDataURL → Blob → 下载。
 */
export function exportGanttRaster(
  ctx: GanttExportContext,
  options: { format: 'png' | 'jpg'; scale?: number; quality?: number },
): void {
  const svg = prepareSvg(ctx)
  if (!svg) return

  const scale = options.scale ?? 2
  const mime = options.format === 'png' ? 'image/png' : 'image/jpeg'
  const extension = options.format === 'png' ? 'png' : 'jpg'

  const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
    type: 'image/svg+xml;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)

  const img = new Image()

  img.onload = () => {
    URL.revokeObjectURL(url)

    const canvas = document.createElement('canvas')
    const canvasCtx = canvas.getContext('2d')
    if (!canvasCtx) {
      ctx.onError('无法创建Canvas上下文')
      return
    }

    const canvasWidth = img.width * scale
    const canvasHeight = img.height * scale
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    canvasCtx.scale(scale, scale)

    canvasCtx.fillStyle = '#ffffff'
    canvasCtx.fillRect(0, 0, img.width, img.height)
    canvasCtx.drawImage(img, 0, 0)

    const dataUrl = canvas.toDataURL(mime, options.quality)
    const imageBlob = dataURLToBlob(dataUrl)

    if (!imageBlob) {
      ctx.onError('图片转换失败')
      return
    }

    downloadBlob(imageBlob, `gantt-chart-${dateStamp()}.${extension}`)
  }

  img.onerror = (e) => {
    URL.revokeObjectURL(url)
    logger.error('SVG加载失败:', e)
    ctx.onError('图片转换失败，请检查控制台')
  }

  img.src = url
}

/** 导出任务列表为 JSON */
export function exportTasksAsJson(tasks: readonly GanttTask[]): void {
  const data = JSON.stringify(tasks, null, 2)
  downloadBlob(new Blob([data], { type: 'application/json' }), `gantt-tasks-${dateStamp()}.json`)
}
