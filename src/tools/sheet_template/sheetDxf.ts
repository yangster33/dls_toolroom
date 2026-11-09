import {
  DxfWriter,
  TextHorizontalAlignment,
  TextVerticalAlignment,
  Units,
  point3d,
} from '@tarikjabiri/dxf'
import {
  buildSheetLayout,
  type LayoutLine,
  type LayoutText,
  type SheetFieldValues,
  type SheetTemplate,
} from './sheetTemplate'
import { isGroupVisible, type ViewState } from './sheetView'

/**
 * 使用 @tarikjabiri/dxf（MIT）输出 DXF。
 * - 单位 mm
 * - 图层：SHEET-FRAME / SHEET-TITLE / SHEET-TEXT
 * - 文字：TEXT + 中文样式
 *
 * 该库默认输出 AC1021（R2007+，UTF-8），适合中文。
 */

const FRAME_LAYER = 'SHEET-FRAME'
const TITLE_LAYER = 'SHEET-TITLE'
const TEXT_LAYER = 'SHEET-TEXT'
const STYLE_TITLE = 'SHEET-TITLE'
const STYLE_BODY = 'SHEET-BODY'

function isInsideTitleBlock(
  line: LayoutLine,
  tb: { x: number; y: number; w: number; h: number },
): boolean {
  const minX = Math.min(line.x1, line.x2)
  const maxX = Math.max(line.x1, line.x2)
  const minY = Math.min(line.y1, line.y2)
  const maxY = Math.max(line.y1, line.y2)
  return (
    minX >= tb.x - 0.01 &&
    maxX <= tb.x + tb.w + 0.01 &&
    minY >= tb.y - 0.01 &&
    maxY <= tb.y + tb.h + 0.01
  )
}

function horizontalAlignment(text: LayoutText): TextHorizontalAlignment {
  if (text.anchor === 'left') return TextHorizontalAlignment.Left
  if (text.anchor === 'right') return TextHorizontalAlignment.Right
  return TextHorizontalAlignment.Center
}

function verticalAlignment(text: LayoutText): TextVerticalAlignment {
  if (text.baseline === 'top') return TextVerticalAlignment.Top
  if (text.baseline === 'bottom') return TextVerticalAlignment.Bottom
  return TextVerticalAlignment.Middle
}

export interface DxfRenderOptions {
  viewState?: ViewState
  /** 全局字高倍率，默认 1 */
  textScale?: number
  /** 是否按预览的中英文视觉字高校准，默认 true */
  calibrateTextHeight?: boolean
}

function dxfTextHeight(text: LayoutText, options: DxfRenderOptions): number {
  const nominal = text.fontSize * (options.textScale ?? 1)
  if (options.calibrateTextHeight === false) return nominal
  const hasCjk = /[\u3400-\u9fff]/.test(text.text)
  return nominal * (hasCjk ? 1.12 : 0.8)
}

export function sheetToDxf(
  template: SheetTemplate,
  values: SheetFieldValues,
  options: DxfRenderOptions = {},
): string {
  const layout = buildSheetLayout(template, values)
  const flipY = (y: number): number => layout.paper.h - y
  const dxf = new DxfWriter()
  dxf.setUnits(Units.Millimeters)
  dxf.setVariable('$EXTMIN', { 10: 0, 20: 0, 30: 0 })
  dxf.setVariable('$EXTMAX', { 10: layout.paper.w, 20: layout.paper.h, 30: 0 })

  dxf.addLayer(FRAME_LAYER, 7, 'Continuous')
  dxf.addLayer(TITLE_LAYER, 7, 'Continuous')
  dxf.addLayer(TEXT_LAYER, 7, 'Continuous')
  dxf.addLType('DASHED', '__ __ __', [4, -2])

  const titleStyle = dxf.tables.addStyle(STYLE_TITLE)
  titleStyle.fontFileName = 'simhei.ttf'
  titleStyle.widthFactor = 1
  const bodyStyle = dxf.tables.addStyle(STYLE_BODY)
  bodyStyle.fontFileName = 'simhei.ttf'
  bodyStyle.widthFactor = 1

  for (const line of layout.lines) {
    if (!isGroupVisible(options.viewState, line.group)) continue
    const layerName = isInsideTitleBlock(line, layout.titleBlock) ? TITLE_LAYER : FRAME_LAYER
    dxf.addLine(point3d(line.x1, flipY(line.y1)), point3d(line.x2, flipY(line.y2)), {
      layerName,
      lineType: line.dash ? 'DASHED' : 'Continuous',
      colorNumber: 7,
    })
  }

  for (const text of layout.texts) {
    if (!isGroupVisible(options.viewState, text.group)) continue
    const entity = dxf.addText(
      point3d(text.x, flipY(text.y)),
      dxfTextHeight(text, options),
      text.text,
      {
        layerName: TEXT_LAYER,
        colorNumber: 7,
        horizontalAlignment: horizontalAlignment(text),
        verticalAlignment: verticalAlignment(text),
        secondAlignmentPoint: point3d(text.x, flipY(text.y)),
      },
    )
    entity.textStyle = text.bold || text.fontSize >= 7 ? STYLE_TITLE : STYLE_BODY
  }

  return dxf.stringify()
}
