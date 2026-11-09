import { describe, expect, it } from 'vitest'
import {
  buildSheetLayout,
  createDefaultDocument,
  createDefaultValues,
  createTemplate,
  defaultMargins,
  deleteGridRow,
  gridFromAbsolute,
  insertGridRow,
  measureTextWidth,
  mergeGridCells,
  normalizeGrid,
  paperDimensions,
  recommendedFontSizes,
  resolveTitleBlockCells,
  snapToSeries,
  splitGridCell,
  validateTemplate,
} from '../sheetTemplate'
import { createDefaultViewState, groupState, setGroupState, VIEW_TREE } from '../sheetView'
import { sheetToSvg } from '../sheetSvg'
import { sheetToDxf } from '../sheetDxf'
import { SHEET_TEMPLATE_SCHEMA } from '../sheetTemplateSchema'

function textEntityY(dxf: string, text: string): number | null {
  const lines = dxf.split(/\r?\n/).map((line) => line.trim())
  let lastY = 0
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = lines[index]
    const value = lines[index + 1]!
    if (code === '20') lastY = Number(value)
    else if (code === '1' && value === text) return lastY
  }
  return null
}

function textEntityHeight(dxf: string, text: string): number | null {
  const lines = dxf.split(/\r?\n/).map((line) => line.trim())
  let lastHeight = 0
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = lines[index]
    const value = lines[index + 1]!
    if (code === '40') lastHeight = Number(value)
    else if (code === '1' && value === text) return lastHeight
  }
  return null
}

describe('paper sizes', () => {
  it('A0~A5 portrait dimensions follow ISO 216', () => {
    expect(paperDimensions('A0', 'portrait')).toEqual({ width: 841, height: 1189 })
    expect(paperDimensions('A1', 'portrait')).toEqual({ width: 594, height: 841 })
    expect(paperDimensions('A2', 'portrait')).toEqual({ width: 420, height: 594 })
    expect(paperDimensions('A3', 'portrait')).toEqual({ width: 297, height: 420 })
    expect(paperDimensions('A4', 'portrait')).toEqual({ width: 210, height: 297 })
    expect(paperDimensions('A5', 'portrait')).toEqual({ width: 148, height: 210 })
  })

  it('landscape swaps width and height', () => {
    expect(paperDimensions('A2', 'landscape')).toEqual({ width: 594, height: 420 })
    expect(paperDimensions('A4', 'landscape')).toEqual({ width: 297, height: 210 })
  })

  it('default margins use 25mm binding and 10/5mm other edges', () => {
    expect(defaultMargins('A2', 'left')).toMatchObject({ binding: 25, left: 25, right: 10, top: 10, bottom: 10 })
    expect(defaultMargins('A4', 'left')).toMatchObject({ binding: 25, left: 25, right: 5, top: 5, bottom: 5 })
    expect(defaultMargins('A4', 'right')).toMatchObject({ left: 5, right: 25 })
  })

  it('recommended font sizes follow the paper table', () => {
    expect(recommendedFontSizes('A0').title).toBe(10)
    expect(recommendedFontSizes('A2').body).toBe(5)
    expect(recommendedFontSizes('A5').note).toBe(1.8)
  })
})

describe('sheet layout', () => {
  it('builds a frame and title block inside the paper', () => {
    const template = createTemplate('gb', 'A2', 'landscape')
    const layout = buildSheetLayout(template, createDefaultValues())

    expect(layout.paper).toMatchObject({ x: 0, y: 0, w: 594, h: 420 })
    expect(layout.frame.x).toBe(25)
    expect(layout.frame.y).toBe(10)
    expect(layout.frame.w).toBe(559)
    expect(layout.frame.h).toBe(400)
    expect(layout.titleBlock.x + layout.titleBlock.w).toBeLessThanOrEqual(layout.frame.x + layout.frame.w + 0.001)
    expect(layout.titleBlock.y + layout.titleBlock.h).toBeLessThanOrEqual(layout.frame.y + layout.frame.h + 0.001)
    expect(layout.cells.length).toBeGreaterThan(30)
  })

  it('scales the title block down on a narrow A5 sheet', () => {
    const template = createTemplate('gb', 'A5', 'portrait')
    const layout = buildSheetLayout(template, createDefaultValues())
    expect(layout.titleBlock.w).toBeLessThanOrEqual(layout.frame.w + 0.001)
    expect(layout.titleBlock.h).toBeLessThanOrEqual(layout.frame.h + 0.001)
    for (const cell of layout.cells) {
      expect(cell.x).toBeGreaterThanOrEqual(layout.titleBlock.x - 0.01)
      expect(cell.y).toBeGreaterThanOrEqual(layout.titleBlock.y - 0.01)
      expect(cell.x + cell.w).toBeLessThanOrEqual(layout.titleBlock.x + layout.titleBlock.w + 0.01)
      expect(cell.y + cell.h).toBeLessThanOrEqual(layout.titleBlock.y + layout.titleBlock.h + 0.01)
    }
  })

  it('is deterministic for the same template and values', () => {
    const doc = createDefaultDocument('gb')
    const a = buildSheetLayout(doc.template, doc.values)
    const b = buildSheetLayout(doc.template, doc.values)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('validation', () => {
  it('warns when the title block is wider than the frame', () => {
    const template = createTemplate('gb', 'A5', 'portrait')
    const issues = validateTemplate(template, createDefaultValues())
    expect(issues.some((issue) => issue.message.includes('图签宽度'))).toBe(true)
  })

  it('warns when a cell is outside the title block', () => {
    const template = createTemplate('simple', 'A2', 'landscape')
    template.titleBlock.layoutMode = 'absolute'
    template.titleBlock.cells[0]!.x = 999
    const issues = validateTemplate(template, createDefaultValues())
    expect(issues.some((issue) => issue.cellId === template.titleBlock.cells[0]!.id)).toBe(true)
  })

  it('warns when font size is below the paper minimum', () => {
    const template = createTemplate('gb', 'A0', 'landscape')
    template.styles.textStyles.body = { ...template.styles.textStyles.body!, fontSize: 1.2 }
    const issues = validateTemplate(template, createDefaultValues())
    expect(issues.some((issue) => issue.message.includes('低于'))).toBe(true)
  })

  it('detects text overflow in a narrow cell', () => {
    const template = createTemplate('simple', 'A2', 'landscape')
    template.titleBlock.layoutMode = 'absolute'
    const cell = template.titleBlock.cells.find((item) => item.id === 's-project-value')!
    cell.w = 5
    const issues = validateTemplate(template, createDefaultValues())
    expect(issues.some((issue) => issue.cellId === cell.id && issue.message.includes('溢出'))).toBe(true)
  })
})

describe('text measurement', () => {
  it('counts CJK as full width and ASCII as narrower', () => {
    const cjk = measureTextWidth('图框', 5)
    const ascii = measureTextWidth('AB', 5)
    expect(cjk).toBeGreaterThan(ascii)
    expect(cjk).toBeCloseTo(10, 6)
  })

  it('snaps to the standard height series', () => {
    expect(snapToSeries(4.6)).toBe(5)
    expect(snapToSeries(6.4)).toBe(7)
    expect(snapToSeries(1.9)).toBe(1.8)
  })
})

describe('grid model', () => {
  it('builds grid tracks from absolute rectangles', () => {
    const grid = gridFromAbsolute(
      [
        { id: 'a', x: 0, y: 0, w: 50, h: 25 },
        { id: 'b', x: 50, y: 0, w: 50, h: 25 },
      ],
      100,
      50,
    )
    expect(grid.columns.length).toBe(2)
    expect(grid.rows.length).toBe(2)
    expect(grid.cells.map((cell) => cell.id)).toEqual(['a', 'b'])
  })

  it('migrates the GB template into grid tracks and spans', () => {
    const template = createTemplate('gb', 'A2', 'landscape')
    const grid = template.titleBlock.grid!
    expect(grid.columns.length).toBeGreaterThan(5)
    expect(grid.rows.length).toBeGreaterThan(5)
    expect(grid.cells.find((cell) => cell.id === 'chg-mark')).toMatchObject({
      row: 0,
      col: 0,
      rowSpan: 1,
      colSpan: 1,
    })
    expect(grid.cells.find((cell) => cell.id === 'chg-count')!.colSpan).toBeGreaterThan(1)
    expect(resolveTitleBlockCells(template).length).toBe(grid.cells.length)
  })

  it('inserts and deletes rows while keeping cells inside bounds', () => {
    const template = createTemplate('gb', 'A2', 'landscape')
    const grid = template.titleBlock.grid!
    const beforeRows = grid.rows.length
    insertGridRow(grid, 0, 6)
    expect(grid.rows.length).toBe(beforeRows + 1)
    expect(grid.cells.every((cell) => cell.row + cell.rowSpan <= grid.rows.length)).toBe(true)
    deleteGridRow(grid, 0)
    expect(grid.rows.length).toBe(beforeRows)
  })

  it('merges and splits a rectangular range', () => {
    const template = createTemplate('simple', 'A2', 'landscape')
    const grid = template.titleBlock.grid!
    const before = grid.cells.length
    const result = mergeGridCells(grid, { row: 0, col: 0, rowSpan: 2, colSpan: 2 })
    expect(result.ok).toBe(true)
    expect(grid.cells.length).toBeLessThan(before)
    const created = splitGridCell(grid, result.cell!.id)
    expect(created.length).toBe(4)
  })

  it('normalizes track sizes to the title block size', () => {
    const template = createTemplate('gb', 'A2', 'landscape')
    const grid = template.titleBlock.grid!
    normalizeGrid(grid, template.titleBlock.width, template.titleBlock.height)
    const width = grid.columns.reduce((sum, column) => sum + column.size, 0)
    const height = grid.rows.reduce((sum, row) => sum + row.size, 0)
    expect(width).toBeCloseTo(template.titleBlock.width, 1)
    expect(height).toBeCloseTo(template.titleBlock.height, 1)
  })
})

describe('semantic view', () => {
  it('tags frame, symbols and title block elements', () => {
    const doc = createDefaultDocument('gb')
    const layout = buildSheetLayout(doc.template, doc.values)
    expect(layout.lines.some((line) => line.semanticId === 'frame.top' && line.group === 'frame.line')).toBe(true)
    expect(layout.lines.some((line) => line.group === 'symbol.centering')).toBe(true)
    expect(layout.texts.some((text) => text.group === 'titleBlock.value')).toBe(true)
  })

  it('filters SVG by view state groups', () => {
    const doc = createDefaultDocument('gb')
    const state = createDefaultViewState()
    state.groups['symbol.centering'] = false
    const svg = sheetToSvg(doc.template, doc.values, { viewState: state })
    expect(svg).not.toContain('symbol.centering')
    expect(svg).toContain('frame.top')
  })

  it('computes parent group state', () => {
    const state = createDefaultViewState()
    const frame = VIEW_TREE.find((group) => group.id === 'frame')!
    expect(groupState(state, frame)).toBe('some')
    setGroupState(state, frame, false)
    expect(groupState(state, frame)).toBe('none')
  })
})

describe('exports', () => {
  it('renders SVG with frame, title text and paper size', () => {
    const doc = createDefaultDocument('gb')
    const svg = sheetToSvg(doc.template, doc.values)
    expect(svg).toContain('<svg')
    expect(svg).toContain('viewBox="0 0 594 420"')
    expect(svg).toContain('sheet-frame')
    expect(svg).toContain('sheet-text')
    expect(svg).toContain('DLS-RL-001')
    expect(svg).toContain('</svg>')
  })

  it('renders DXF with layers and entities', () => {
    const doc = createDefaultDocument('gb')
    const dxf = sheetToDxf(doc.template, doc.values)
    expect(dxf).toContain('SECTION')
    expect(dxf).toContain('ENTITIES')
    expect(dxf).toContain('SHEET-FRAME')
    expect(dxf).toContain('SHEET-TEXT')
    expect(dxf).toContain('LINE')
    expect(dxf).toContain('TEXT')
    expect(dxf).toContain('EOF')
  })

  it('flips DXF Y axis so the title block stays bottom-right', () => {
    const doc = createDefaultDocument('gb')
    const dxf = sheetToDxf(doc.template, doc.values)
    const y = textEntityY(dxf, 'DLS-RL-001')
    expect(y).not.toBeNull()
    expect(y!).toBeGreaterThan(0)
    expect(y!).toBeLessThan(doc.template.paper.height / 2)
  })

  it('keeps cell font size and bold overrides in the layout', () => {
    const template = createTemplate('minimal', 'A2', 'landscape')
    const cell = template.titleBlock.grid?.cells.find((item) => item.field === 'drawingName')
    expect(cell).toBeTruthy()
    cell!.fontSize = 9
    cell!.bold = false
    const layout = buildSheetLayout(template, createDefaultValues())
    const value = layout.texts.find((text) => text.semanticId === `titleBlock.cell.${cell!.id}.value`)
    expect(value?.fontSize).toBeCloseTo(9)
    expect(value?.bold).toBe(false)
  })

  it('accepts custom fields in the exported schema', async () => {
    const { default: Ajv2020 } = await import('ajv/dist/2020')
    const ajv = new Ajv2020({ strict: false })
    const validate = ajv.compile(SHEET_TEMPLATE_SCHEMA as object)
    const doc = createDefaultDocument('gb')
    doc.customFields = [{ key: 'clientName', label: '建设单位' }]
    doc.values.clientName = '某单位'
    expect(validate(doc)).toBe(true)
    doc.customFields.push({ key: 'bad key', label: '错误' })
    expect(validate(doc)).toBe(false)
  })

  it('calibrates DXF text height for CJK and Latin text', () => {
    const doc = createDefaultDocument('gb')
    const nominal = sheetToDxf(doc.template, doc.values, { calibrateTextHeight: false })
    const calibrated = sheetToDxf(doc.template, doc.values, { calibrateTextHeight: true })
    expect(textEntityHeight(nominal, '机房设备布置平面图')).toBeCloseTo(5)
    expect(textEntityHeight(calibrated, '机房设备布置平面图')).toBeCloseTo(5.6)
    expect(textEntityHeight(nominal, 'DLS-RL-001')).toBeCloseTo(5)
    expect(textEntityHeight(calibrated, 'DLS-RL-001')).toBeCloseTo(4)
  })

  it('keeps JSON round-trip stable', () => {
    const doc = createDefaultDocument('gb')
    const text = JSON.stringify(doc)
    const restored = JSON.parse(text) as typeof doc
    expect(restored).toEqual(doc)
  })
})
