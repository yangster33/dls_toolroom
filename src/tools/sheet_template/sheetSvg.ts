import { buildSheetLayout, type SheetFieldValues, type SheetTemplate } from './sheetTemplate'
import { isGroupVisible, type ViewState } from './sheetView'

export interface SvgRenderOptions {
  /** 是否绘制纸张底色，默认 true */
  background?: boolean
  /** 是否在 SVG 中保留毫米单位，默认 true */
  physicalUnits?: boolean
  /** 视图状态；传入时按元素分组过滤 */
  viewState?: ViewState
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function baselineAttr(baseline: 'top' | 'middle' | 'bottom'): string {
  if (baseline === 'top') return 'text-before-edge'
  if (baseline === 'bottom') return 'text-after-edge'
  return 'middle'
}

function semanticAttrs(item: {
  semanticId?: string
  name?: string
  standard?: string
  group?: string
  layer?: string
}): string {
  let attrs = ''
  if (item.semanticId) attrs += ` data-semantic-id="${escapeXml(item.semanticId)}"`
  if (item.name) attrs += ` data-name="${escapeXml(item.name)}"`
  if (item.standard) attrs += ` data-standard="${escapeXml(item.standard)}"`
  if (item.group) attrs += ` data-group="${escapeXml(item.group)}"`
  if (item.layer) attrs += ` data-layer="${escapeXml(item.layer)}"`
  return attrs
}

/**
 * 把图框/图签渲染为独立 SVG 字符串。
 * 坐标单位 mm，viewBox 与纸张 1:1。
 */
export function sheetToSvg(
  template: SheetTemplate,
  values: SheetFieldValues,
  options: SvgRenderOptions = {},
): string {
  const layout = buildSheetLayout(template, values)
  const { paper } = layout
  const width = paper.w
  const height = paper.h
  const physical = options.physicalUnits !== false
  const widthAttr = physical ? `${width}mm` : String(width)
  const heightAttr = physical ? `${height}mm` : String(height)
  const theme = template.theme
  const fontFamily = escapeXml(template.styles.fontFamily)
  const viewState = options.viewState
  const parts: string[] = []

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${widthAttr}" height="${heightAttr}" role="img" aria-label="${escapeXml(template.name)}">`,
  )

  if (options.background !== false) {
    parts.push(
      `<rect id="sheet-paper" x="0" y="0" width="${width}" height="${height}" fill="${theme.paper}"/>`,
    )
  }

  // 视图辅助形状（装订边参考区等）
  const visibleShapes = layout.shapes.filter((shape) => isGroupVisible(viewState, shape.group))
  if (visibleShapes.length) {
    parts.push(`<g id="sheet-guides">`)
    for (const shape of visibleShapes) {
      parts.push(
        `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" fill="${shape.fill}" opacity="${shape.opacity ?? 1}"${semanticAttrs(shape)}/>`,
      )
    }
    parts.push(`</g>`)
  }

  parts.push(`<g id="sheet-frame" fill="none" stroke-linecap="square">`)
  for (const line of layout.lines) {
    if (!isGroupVisible(viewState, line.group)) continue
    const dash = line.dash ? ` stroke-dasharray="${line.dash}"` : ''
    parts.push(
      `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${line.color}" stroke-width="${line.width}"${dash}${semanticAttrs(line)}/>`,
    )
  }
  parts.push(`</g>`)
  parts.push(`<g id="sheet-text" font-family="${fontFamily}">`)
  for (const text of layout.texts) {
    if (!isGroupVisible(viewState, text.group)) continue
    const weight = text.bold ? ' font-weight="700"' : ''
    const anchor = text.anchor === 'left' ? 'start' : text.anchor === 'right' ? 'end' : 'middle'
    parts.push(
      `<text x="${text.x}" y="${text.y}" font-size="${text.fontSize}" fill="${text.color}" text-anchor="${anchor}" dominant-baseline="${baselineAttr(text.baseline)}"${weight}${semanticAttrs(text)}>${escapeXml(text.text)}</text>`,
    )
  }
  parts.push(`</g>`)
  parts.push(`</svg>`)
  return parts.join('')
}

/** 生成带交互命中信息的 SVG（用于编辑器/预览）。 */
export function sheetToInteractiveSvg(template: SheetTemplate, values: SheetFieldValues): string {
  const svg = sheetToSvg(template, values)
  return svg.replace(
    '<g id="sheet-text"',
    `<g id="sheet-cells" fill="none" stroke="transparent" pointer-events="all">${buildSheetLayout(
      template,
      values,
    )
      .cells.map(
        (cell) =>
          `<rect data-cell-id="${escapeXml(cell.id)}" x="${cell.x}" y="${cell.y}" width="${cell.w}" height="${cell.h}" fill="transparent" stroke="transparent"/>`,
      )
      .join('')}</g><g id="sheet-text"`,
  )
}
