/**
 * 图框 / 图签核心模型与布局引擎
 *
 * 参考：
 * - GB/T 14689-2008《技术制图 图纸幅面和格式》
 * - GB/T 10609.1-2008《技术制图 标题栏》
 * - GB/T 14691-1993《技术制图 字体》
 *
 * 说明：国标对标题栏的内部细分在不同行业/企业会有差异，本文件内置的是
 * 常用 GB 风格模板；所有单元格坐标、字高、边距都可在模板中覆盖。
 */

export type PaperSize = 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'custom'
export type Orientation = 'landscape' | 'portrait'
export type BindingEdge = 'left' | 'right'
export type TextAlign = 'left' | 'center' | 'right'
export type TextVAlign = 'top' | 'middle' | 'bottom'
export type IssueSeverity = 'error' | 'warning' | 'info'

export interface PaperSpec {
  /** 竖向尺寸（宽 × 高），mm */
  portrait: readonly [number, number]
}

/** ISO 216 / GB/T 14689 基本幅面，竖向。 */
export const PAPER_SIZES: Record<Exclude<PaperSize, 'custom'>, PaperSpec> = {
  A0: { portrait: [841, 1189] },
  A1: { portrait: [594, 841] },
  A2: { portrait: [420, 594] },
  A3: { portrait: [297, 420] },
  A4: { portrait: [210, 297] },
  A5: { portrait: [148, 210] },
}

/** GB/T 14691 常用字高系列，mm。 */
export const TEXT_HEIGHT_SERIES: readonly number[] = [1.8, 2.5, 3.5, 5, 7, 10, 14, 20]

export interface FontSizeSet {
  title: number
  body: number
  note: number
  min: number
}

/**
 * 图幅 → 建议字高（工程默认值，可在模板中覆盖）。
 * 最终以 GB/T 14691 和企业标准为准。
 */
export const FONT_SIZE_TABLE: Record<Exclude<PaperSize, 'custom'>, FontSizeSet> = {
  A0: { title: 10, body: 7, note: 5, min: 3.5 },
  A1: { title: 7, body: 5, note: 3.5, min: 2.5 },
  A2: { title: 7, body: 5, note: 3.5, min: 2.5 },
  A3: { title: 5, body: 3.5, note: 2.5, min: 1.8 },
  A4: { title: 5, body: 3.5, note: 2.5, min: 1.8 },
  A5: { title: 3.5, body: 2.5, note: 1.8, min: 1.8 },
}

export interface Margins {
  binding: number
  top: number
  right: number
  bottom: number
  left: number
}

export interface FrameSpec {
  /** 图框线宽，mm */
  lineWidth: number
  /** 内框相对图框线的额外偏移，mm */
  innerOffset: number
  /** 对中符号 */
  centeringMarks: boolean
  /** 分区标记 */
  zoneMarking: boolean
  /** 分区数量（横向 / 纵向），0 表示自动 */
  zoneColumns: number
  zoneRows: number
}

export interface TextStyle {
  fontSize: number
  lineHeight: number
  bold: boolean
  widthFactor: number
  fontFamily?: string
}

export interface TitleBlockCell {
  id: string
  /** 静态标签，如“设计”“审核” */
  label?: string
  /** 绑定字段，如 projectName / drawingNo / scale */
  field?: string
  /** 静态文本（没有 label/field 时使用） */
  text?: string
  /** 相对图签左上角，mm */
  x: number
  y: number
  w: number
  h: number
  textStyle?: string
  align?: TextAlign
  valign?: TextVAlign
  /** 标签单独对齐；默认跟随 align */
  labelAlign?: TextAlign
  /** 字段值单独对齐；默认跟随 align */
  valueAlign?: TextAlign
  border?: boolean
  /** 标签是否显示 */
  showLabel?: boolean
  /** 单元格字号覆盖（mm），不填则跟随文字样式 */
  fontSize?: number
  /** 单元格加粗覆盖，不填则跟随文字样式 */
  bold?: boolean
  /** 网格模式下的行列信息（由 resolveTitleBlockCells 填充） */
  gridRow?: number
  gridCol?: number
  gridRowSpan?: number
  gridColSpan?: number
}

export interface GridTrack {
  id: string
  /** mm */
  size: number
  min?: number
  max?: number
  locked?: boolean
}

export interface GridCell {
  id: string
  row: number
  col: number
  rowSpan: number
  colSpan: number
  label?: string
  field?: string
  text?: string
  textStyle?: string
  align?: TextAlign
  valign?: TextVAlign
  labelAlign?: TextAlign
  valueAlign?: TextAlign
  border?: boolean
  showLabel?: boolean
  /** 单元格字号覆盖（mm） */
  fontSize?: number
  /** 单元格加粗覆盖 */
  bold?: boolean
}

export interface TitleBlockGrid {
  columns: GridTrack[]
  rows: GridTrack[]
  cells: GridCell[]
}

export interface TitleBlockSpec {
  width: number
  height: number
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  /** absolute：传统 x/y/w/h；grid：行列轨道模型 */
  layoutMode?: 'absolute' | 'grid'
  /** 网格模式下的行列与单元格 */
  grid?: TitleBlockGrid
  /** 传统绝对坐标单元格；网格模式下可为空 */
  cells: TitleBlockCell[]
}

export interface SheetTemplate {
  schemaVersion: 1
  id: string
  name: string
  description?: string
  paper: {
    size: PaperSize
    orientation: Orientation
    width: number
    height: number
  }
  margins: Margins
  bindingEdge: BindingEdge
  frame: FrameSpec
  titleBlock: TitleBlockSpec
  styles: {
    fontFamily: string
    textStyles: Record<string, TextStyle>
  }
  theme: {
    paper: string
    ink: string
    muted: string
    frame: string
    titleBlock: string
    accent: string
    grid: string
  }
}

export interface SheetFieldValues {
  projectName: string
  drawingName: string
  drawingNo: string
  scale: string
  date: string
  designer: string
  checker: string
  approver: string
  process: string
  standardizer: string
  revision: string
  sheetNo: string
  sheetTotal: string
  company: string
  material: string
  weight: string
  [key: string]: string
}

export interface SheetDocument {
  schemaVersion: 1
  template: SheetTemplate
  values: SheetFieldValues
  /** 用户自定义字段（键 + 中文名） */
  customFields?: Array<{ key: string; label: string }>
  exportedAt?: string
}

export interface ValidationIssue {
  severity: IssueSeverity
  message: string
  cellId?: string
  path?: string
}

export interface LayoutRect {
  x: number
  y: number
  w: number
  h: number
}

export interface LayoutLine {
  x1: number
  y1: number
  x2: number
  y2: number
  width: number
  color: string
  dash?: string
  semanticId?: string
  name?: string
  standard?: string
  group?: string
  layer?: string
}

export interface LayoutText {
  x: number
  y: number
  text: string
  fontSize: number
  anchor: TextAlign
  baseline: TextVAlign
  bold: boolean
  color: string
  cellId?: string
  semanticId?: string
  name?: string
  standard?: string
  group?: string
  layer?: string
}

export interface LayoutCell extends LayoutRect {
  id: string
  label?: string
  field?: string
  textStyle?: string
  align: TextAlign
  valign: TextVAlign
  border: boolean
  gridRow?: number
  gridCol?: number
  gridRowSpan?: number
  gridColSpan?: number
}

export interface LayoutShape extends LayoutRect {
  fill: string
  opacity?: number
  semanticId?: string
  name?: string
  standard?: string
  group?: string
  layer?: string
}

export interface SheetLayout {
  paper: LayoutRect
  frame: LayoutRect
  titleBlock: LayoutRect
  shapes: LayoutShape[]
  lines: LayoutLine[]
  texts: LayoutText[]
  cells: LayoutCell[]
  fontSizes: FontSizeSet
}

const DEFAULT_THEME: SheetTemplate['theme'] = {
  paper: '#ffffff',
  ink: '#1f2328',
  muted: '#6b747d',
  frame: '#1f2328',
  titleBlock: '#ffffff',
  accent: '#2f6fb0',
  grid: '#e2e6ea',
}

const DEFAULT_TEXT_STYLES: Record<string, TextStyle> = {
  title: { fontSize: 7, lineHeight: 1.2, bold: true, widthFactor: 1 },
  body: { fontSize: 5, lineHeight: 1.2, bold: false, widthFactor: 1 },
  note: { fontSize: 3.5, lineHeight: 1.2, bold: false, widthFactor: 1 },
  label: { fontSize: 3.5, lineHeight: 1.1, bold: false, widthFactor: 1 },
}

export function paperDimensions(
  size: PaperSize,
  orientation: Orientation,
  custom?: { width: number; height: number },
): { width: number; height: number } {
  if (size === 'custom') {
    const w = custom?.width ?? 420
    const h = custom?.height ?? 297
    return orientation === 'landscape'
      ? { width: Math.max(w, h), height: Math.min(w, h) }
      : { width: Math.min(w, h), height: Math.max(w, h) }
  }
  const [w, h] = PAPER_SIZES[size].portrait
  return orientation === 'landscape' ? { width: h, height: w } : { width: w, height: h }
}

export function defaultMargins(
  size: PaperSize,
  bindingEdge: BindingEdge = 'left',
  binding = 25,
): Margins {
  const other = size === 'A4' || size === 'A5' ? 5 : 10
  return {
    binding,
    top: other,
    right: bindingEdge === 'right' ? binding : other,
    bottom: other,
    left: bindingEdge === 'left' ? binding : other,
  }
}

export function recommendedFontSizes(size: PaperSize): FontSizeSet {
  if (size === 'custom') return { title: 7, body: 5, note: 3.5, min: 2.5 }
  return { ...FONT_SIZE_TABLE[size] }
}

export function snapToSeries(value: number): number {
  return TEXT_HEIGHT_SERIES.reduce((best, candidate) =>
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best,
  )
}

export function createDefaultValues(): SheetFieldValues {
  return {
    projectName: '某通信机房配套工程',
    drawingName: '机房设备布置平面图',
    drawingNo: 'DLS-RL-001',
    scale: '1:50',
    date: '2026-11-08',
    designer: 'DLS',
    checker: '—',
    approver: '—',
    process: '—',
    standardizer: '—',
    revision: 'A',
    sheetNo: '1',
    sheetTotal: '1',
    company: 'DLS Toolroom',
    material: '—',
    weight: '—',
  }
}

export const FIELD_DEFINITIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'projectName', label: '工程名称' },
  { key: 'drawingName', label: '图名' },
  { key: 'drawingNo', label: '图号' },
  { key: 'scale', label: '比例' },
  { key: 'date', label: '日期' },
  { key: 'designer', label: '设计' },
  { key: 'checker', label: '审核' },
  { key: 'approver', label: '批准' },
  { key: 'process', label: '工艺' },
  { key: 'standardizer', label: '标准化' },
  { key: 'revision', label: '版本' },
  { key: 'sheetNo', label: '第几张' },
  { key: 'sheetTotal', label: '共几张' },
  { key: 'company', label: '单位名称' },
  { key: 'material', label: '材料' },
  { key: 'weight', label: '重量' },
]

function trackId(prefix: string, index: number): string {
  return `${prefix}-${index}-${Date.now().toString(36)}`
}

function rectKey(cell: TitleBlockCell): string {
  return `${cell.x},${cell.y},${cell.w},${cell.h}`
}

/**
 * 把绝对坐标单元格按矩形分组。
 * 同一个矩形上的“标签格 + 字段值格”会合并成一个单元格，
 * 用 labelAlign / valueAlign 分别控制左右对齐。
 */
function mergeCellsByRect(cells: TitleBlockCell[]): TitleBlockCell[] {
  const groups = new Map<string, TitleBlockCell[]>()
  for (const cell of cells) {
    const key = rectKey(cell)
    const list = groups.get(key)
    if (list) list.push(cell)
    else groups.set(key, [cell])
  }
  const merged: TitleBlockCell[] = []
  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push({ ...group[0]! })
      continue
    }
    const labelCell = group.find((cell) => Boolean(cell.label) && !cell.field)
    const valueCell = group.find((cell) => Boolean(cell.field) && !cell.label)
    if (labelCell && valueCell) {
      merged.push({
        ...labelCell,
        field: valueCell.field,
        labelAlign: labelCell.align ?? 'left',
        valueAlign: valueCell.align ?? 'right',
      })
    } else {
      merged.push({ ...group[0]! })
    }
  }
  return merged
}

export function gridFromAbsolute(
  cells: TitleBlockCell[],
  width: number,
  height: number,
): TitleBlockGrid {
  const merged = mergeCellsByRect(cells)
  const xs = Array.from(
    new Set([0, width, ...merged.map((cell) => cell.x), ...merged.map((cell) => cell.x + cell.w)]),
  )
    .filter((value) => value >= 0 && value <= width)
    .sort((a, b) => a - b)
  const ys = Array.from(
    new Set([0, height, ...merged.map((cell) => cell.y), ...merged.map((cell) => cell.y + cell.h)]),
  )
    .filter((value) => value >= 0 && value <= height)
    .sort((a, b) => a - b)
  const columns: GridTrack[] = []
  for (let index = 0; index < xs.length - 1; index += 1) {
    columns.push({ id: `col-${index}`, size: Math.max(0.1, xs[index + 1]! - xs[index]!) })
  }
  const rows: GridTrack[] = []
  for (let index = 0; index < ys.length - 1; index += 1) {
    rows.push({ id: `row-${index}`, size: Math.max(0.1, ys[index + 1]! - ys[index]!) })
  }
  const gridCells: GridCell[] = []
  for (const cell of merged) {
    const col = xs.indexOf(cell.x)
    const row = ys.indexOf(cell.y)
    if (col < 0 || row < 0) continue
    const colEnd = xs.indexOf(cell.x + cell.w)
    const rowEnd = ys.indexOf(cell.y + cell.h)
    const colSpan = Math.max(1, (colEnd > col ? colEnd : col + 1) - col)
    const rowSpan = Math.max(1, (rowEnd > row ? rowEnd : row + 1) - row)
    gridCells.push({
      id: cell.id,
      row,
      col,
      rowSpan,
      colSpan,
      label: cell.label,
      field: cell.field,
      text: cell.text,
      textStyle: cell.textStyle,
      align: cell.align,
      valign: cell.valign,
      labelAlign: cell.labelAlign,
      valueAlign: cell.valueAlign,
      border: cell.border,
      showLabel: cell.showLabel,
      fontSize: cell.fontSize,
      bold: cell.bold,
    })
  }
  return { columns, rows, cells: gridCells }
}

function trackOffsets(tracks: GridTrack[]): number[] {
  const offsets: number[] = [0]
  for (const track of tracks) {
    offsets.push(offsets[offsets.length - 1]! + Math.max(0, track.size))
  }
  return offsets
}

function spanSize(tracks: GridTrack[], start: number, span: number): number {
  let total = 0
  for (let index = start; index < start + span && index < tracks.length; index += 1) {
    total += tracks[index]!.size
  }
  return total
}

export function gridToAbsoluteCells(grid: TitleBlockGrid): TitleBlockCell[] {
  const colOffsets = trackOffsets(grid.columns)
  const rowOffsets = trackOffsets(grid.rows)
  return grid.cells
    .map((cell) => {
      const x = colOffsets[cell.col] ?? 0
      const y = rowOffsets[cell.row] ?? 0
      const w = spanSize(grid.columns, cell.col, cell.colSpan)
      const h = spanSize(grid.rows, cell.row, cell.rowSpan)
      return {
        id: cell.id,
        label: cell.label,
        field: cell.field,
        text: cell.text,
        x,
        y,
        w,
        h,
        textStyle: cell.textStyle,
        align: cell.align,
        valign: cell.valign,
        labelAlign: cell.labelAlign,
        valueAlign: cell.valueAlign,
        border: cell.border,
        showLabel: cell.showLabel,
        fontSize: cell.fontSize,
        bold: cell.bold,
        gridRow: cell.row,
        gridCol: cell.col,
        gridRowSpan: cell.rowSpan,
        gridColSpan: cell.colSpan,
      } satisfies TitleBlockCell
    })
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

export function resolveTitleBlockCells(template: SheetTemplate): TitleBlockCell[] {
  const titleBlock = template.titleBlock
  if (titleBlock.layoutMode === 'grid' && titleBlock.grid) {
    return gridToAbsoluteCells(titleBlock.grid)
  }
  return titleBlock.cells
}

export function syncCellsFromGrid(template: SheetTemplate): void {
  const titleBlock = template.titleBlock
  if (titleBlock.layoutMode === 'grid' && titleBlock.grid) {
    titleBlock.cells = gridToAbsoluteCells(titleBlock.grid)
  }
}

export function migrateToGrid(template: SheetTemplate): SheetTemplate {
  const titleBlock = template.titleBlock
  if (titleBlock.layoutMode === 'grid' && titleBlock.grid) return template
  const grid = gridFromAbsolute(titleBlock.cells, titleBlock.width, titleBlock.height)
  titleBlock.layoutMode = 'grid'
  titleBlock.grid = grid
  titleBlock.cells = gridToAbsoluteCells(grid)
  return template
}

export function insertGridRow(grid: TitleBlockGrid, index: number, size = 8): void {
  const at = Math.max(0, Math.min(grid.rows.length, index))
  grid.rows.splice(at, 0, { id: trackId('row', at), size: Math.max(1, size) })
  for (const cell of grid.cells) {
    if (cell.row >= at) cell.row += 1
    else if (cell.row + cell.rowSpan > at) cell.rowSpan += 1
  }
}

export function deleteGridRow(grid: TitleBlockGrid, index: number): void {
  if (grid.rows.length <= 1) return
  const at = Math.max(0, Math.min(grid.rows.length - 1, index))
  grid.rows.splice(at, 1)
  for (const cell of grid.cells) {
    if (cell.row > at) cell.row -= 1
    else if (cell.row <= at && cell.row + cell.rowSpan > at) cell.rowSpan -= 1
  }
  grid.cells = grid.cells.filter((cell) => cell.rowSpan > 0)
}

export function insertGridColumn(grid: TitleBlockGrid, index: number, size = 10): void {
  const at = Math.max(0, Math.min(grid.columns.length, index))
  grid.columns.splice(at, 0, { id: trackId('col', at), size: Math.max(1, size) })
  for (const cell of grid.cells) {
    if (cell.col >= at) cell.col += 1
    else if (cell.col + cell.colSpan > at) cell.colSpan += 1
  }
}

export function deleteGridColumn(grid: TitleBlockGrid, index: number): void {
  if (grid.columns.length <= 1) return
  const at = Math.max(0, Math.min(grid.columns.length - 1, index))
  grid.columns.splice(at, 1)
  for (const cell of grid.cells) {
    if (cell.col > at) cell.col -= 1
    else if (cell.col <= at && cell.col + cell.colSpan > at) cell.colSpan -= 1
  }
  grid.cells = grid.cells.filter((cell) => cell.colSpan > 0)
}

export interface GridRange {
  row: number
  col: number
  rowSpan: number
  colSpan: number
}

export interface MergeResult {
  ok: boolean
  reason?: string
  cell?: GridCell
}

export function mergeGridCells(grid: TitleBlockGrid, range: GridRange): MergeResult {
  const rowEnd = range.row + range.rowSpan
  const colEnd = range.col + range.colSpan
  if (range.row < 0 || range.col < 0 || rowEnd > grid.rows.length || colEnd > grid.columns.length) {
    return { ok: false, reason: '选区超出图签范围' }
  }
  if (range.rowSpan === 1 && range.colSpan === 1) {
    return { ok: false, reason: '至少选择两个单元格才能合并' }
  }
  const overlapping = grid.cells.filter(
    (cell) =>
      cell.row < rowEnd &&
      cell.row + cell.rowSpan > range.row &&
      cell.col < colEnd &&
      cell.col + cell.colSpan > range.col,
  )
  const partially = overlapping.find(
    (cell) =>
      cell.row < range.row ||
      cell.col < range.col ||
      cell.row + cell.rowSpan > rowEnd ||
      cell.col + cell.colSpan > colEnd,
  )
  if (partially) {
    return { ok: false, reason: '选区与已有合并单元格部分重叠，请先拆分' }
  }
  const topLeft = overlapping.find((cell) => cell.row === range.row && cell.col === range.col)
  grid.cells = grid.cells.filter((cell) => !overlapping.includes(cell))
  const merged: GridCell = {
    ...(topLeft ?? {
      id: `merged-${Date.now().toString(36)}`,
      label: '合并单元格',
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
      border: true,
    }),
    row: range.row,
    col: range.col,
    rowSpan: range.rowSpan,
    colSpan: range.colSpan,
  }
  grid.cells.push(merged)
  return { ok: true, cell: merged }
}

export function splitGridCell(grid: TitleBlockGrid, cellId: string): GridCell[] {
  const cell = grid.cells.find((item) => item.id === cellId)
  if (!cell) return []
  if (cell.rowSpan === 1 && cell.colSpan === 1) return [cell]
  grid.cells = grid.cells.filter((item) => item.id !== cellId)
  const created: GridCell[] = []
  for (let row = 0; row < cell.rowSpan; row += 1) {
    for (let col = 0; col < cell.colSpan; col += 1) {
      const isFirst = row === 0 && col === 0
      const next: GridCell = {
        ...cell,
        id: isFirst ? `${cell.id}-split` : `${cell.id}-${row}-${col}`,
        row: cell.row + row,
        col: cell.col + col,
        rowSpan: 1,
        colSpan: 1,
        label: isFirst ? cell.label : undefined,
        field: isFirst ? cell.field : undefined,
        text: isFirst ? cell.text : undefined,
      }
      grid.cells.push(next)
      created.push(next)
    }
  }
  return created
}

function normalizeTracks(tracks: GridTrack[], total: number): void {
  if (!tracks.length) return
  const current = tracks.reduce((sum, track) => sum + Math.max(0.1, track.size), 0)
  const factor = current > 0 ? total / current : 1
  let used = 0
  for (let index = 0; index < tracks.length; index += 1) {
    const track = tracks[index]!
    if (index === tracks.length - 1) {
      track.size = Math.max(0.1, Math.round((total - used) * 10) / 10)
    } else {
      track.size = Math.max(0.1, Math.round(track.size * factor * 10) / 10)
      used += track.size
    }
  }
}

export function normalizeGrid(grid: TitleBlockGrid, width: number, height: number): void {
  normalizeTracks(grid.columns, width)
  normalizeTracks(grid.rows, height)
}

export function equalizeGridColumns(grid: TitleBlockGrid, width: number): void {
  const size = width / Math.max(1, grid.columns.length)
  for (const track of grid.columns) track.size = Math.round(size * 10) / 10
  normalizeTracks(grid.columns, width)
}

export function equalizeGridRows(grid: TitleBlockGrid, height: number): void {
  const size = height / Math.max(1, grid.rows.length)
  for (const track of grid.rows) track.size = Math.round(size * 10) / 10
  normalizeTracks(grid.rows, height)
}

export function autoFitGridColumns(
  grid: TitleBlockGrid,
  width: number,
  values: SheetFieldValues,
  fontFamily: string,
  fontSize = 5,
): void {
  const required = grid.columns.map(() => 8)
  for (const cell of grid.cells) {
    const text = cell.field
      ? (values[cell.field] ?? cell.label ?? '')
      : cell.label || cell.text || ''
    if (!text) continue
    const textWidth = measureTextWidth(text, fontSize, fontFamily) + 3
    const perColumn = textWidth / Math.max(1, cell.colSpan)
    for (let index = 0; index < cell.colSpan; index += 1) {
      const target = cell.col + index
      if (target < required.length) required[target] = Math.max(required[target]!, perColumn)
    }
  }
  for (let index = 0; index < grid.columns.length; index += 1) {
    grid.columns[index]!.size = Math.round(required[index]! * 10) / 10
  }
  normalizeTracks(grid.columns, width)
}

export function autoFitGridRows(
  grid: TitleBlockGrid,
  height: number,
  values: SheetFieldValues,
  fontSize = 5,
): void {
  const required = grid.rows.map(() => 5)
  for (const cell of grid.cells) {
    const text = cell.field
      ? (values[cell.field] ?? cell.label ?? '')
      : cell.label || cell.text || ''
    const lines = Math.max(1, text.split('\n').length)
    const textHeight = lines * fontSize * 1.25 + 2
    const perRow = textHeight / Math.max(1, cell.rowSpan)
    for (let index = 0; index < cell.rowSpan; index += 1) {
      const target = cell.row + index
      if (target < required.length) required[target] = Math.max(required[target]!, perRow)
    }
  }
  for (let index = 0; index < grid.rows.length; index += 1) {
    grid.rows[index]!.size = Math.round(required[index]! * 10) / 10
  }
  normalizeTracks(grid.rows, height)
}

function textStylesFor(size: PaperSize): Record<string, TextStyle> {
  const f = recommendedFontSizes(size)
  return {
    title: { ...DEFAULT_TEXT_STYLES.title!, fontSize: f.title },
    body: { ...DEFAULT_TEXT_STYLES.body!, fontSize: f.body },
    note: { ...DEFAULT_TEXT_STYLES.note!, fontSize: f.note },
    label: { ...DEFAULT_TEXT_STYLES.label!, fontSize: f.note },
  }
}

/** 常用 GB 风格图签（180×56），单元格坐标可继续编辑。 */
function gbTitleBlockCells(): TitleBlockCell[] {
  const cells: TitleBlockCell[] = [
    // 更改区（上左）
    {
      id: 'chg-mark',
      label: '标记',
      x: 0,
      y: 0,
      w: 14,
      h: 7,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'chg-count',
      label: '处数',
      x: 14,
      y: 0,
      w: 14,
      h: 7,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'chg-zone',
      label: '分区',
      x: 28,
      y: 0,
      w: 14,
      h: 7,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'chg-doc',
      label: '更改文件号',
      x: 42,
      y: 0,
      w: 28,
      h: 7,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'chg-sign',
      label: '签名',
      x: 70,
      y: 0,
      w: 14,
      h: 7,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'chg-date',
      label: '年、月、日',
      x: 84,
      y: 0,
      w: 16,
      h: 7,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'chg-mark-v',
      x: 0,
      y: 7,
      w: 14,
      h: 8,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'chg-count-v',
      x: 14,
      y: 7,
      w: 14,
      h: 8,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'chg-zone-v',
      x: 28,
      y: 7,
      w: 14,
      h: 8,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'chg-doc-v',
      x: 42,
      y: 7,
      w: 28,
      h: 8,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'chg-sign-v',
      x: 70,
      y: 7,
      w: 14,
      h: 8,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'chg-date-v',
      x: 84,
      y: 7,
      w: 16,
      h: 8,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },

    // 签字区
    {
      id: 'sign-design',
      label: '设计',
      x: 0,
      y: 15,
      w: 20,
      h: 8,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'sign-check',
      label: '审核',
      x: 20,
      y: 15,
      w: 20,
      h: 8,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'sign-process',
      label: '工艺',
      x: 40,
      y: 15,
      w: 20,
      h: 8,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'sign-standard',
      label: '标准化',
      x: 60,
      y: 15,
      w: 20,
      h: 8,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'sign-approve',
      label: '批准',
      x: 80,
      y: 15,
      w: 20,
      h: 8,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'sign-design-v',
      field: 'designer',
      x: 0,
      y: 23,
      w: 20,
      h: 9,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'sign-check-v',
      field: 'checker',
      x: 20,
      y: 23,
      w: 20,
      h: 9,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'sign-process-v',
      field: 'process',
      x: 40,
      y: 23,
      w: 20,
      h: 9,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'sign-standard-v',
      field: 'standardizer',
      x: 60,
      y: 23,
      w: 20,
      h: 9,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'sign-approve-v',
      field: 'approver',
      x: 80,
      y: 23,
      w: 20,
      h: 9,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },

    // 其他区
    {
      id: 'material-label',
      label: '材料',
      x: 0,
      y: 32,
      w: 50,
      h: 8,
      textStyle: 'label',
      align: 'left',
      valign: 'middle',
    },
    {
      id: 'material-value',
      field: 'material',
      x: 0,
      y: 32,
      w: 50,
      h: 8,
      textStyle: 'body',
      align: 'right',
      valign: 'middle',
    },
    {
      id: 'scale-label',
      label: '比例',
      x: 50,
      y: 32,
      w: 50,
      h: 8,
      textStyle: 'label',
      align: 'left',
      valign: 'middle',
    },
    {
      id: 'scale-value',
      field: 'scale',
      x: 50,
      y: 32,
      w: 50,
      h: 8,
      textStyle: 'body',
      align: 'right',
      valign: 'middle',
    },
    {
      id: 'sheet-total-label',
      label: '共 张',
      x: 0,
      y: 40,
      w: 25,
      h: 8,
      textStyle: 'label',
      align: 'left',
      valign: 'middle',
    },
    {
      id: 'sheet-total-value',
      field: 'sheetTotal',
      x: 0,
      y: 40,
      w: 25,
      h: 8,
      textStyle: 'body',
      align: 'right',
      valign: 'middle',
    },
    {
      id: 'sheet-no-label',
      label: '第 张',
      x: 25,
      y: 40,
      w: 25,
      h: 8,
      textStyle: 'label',
      align: 'left',
      valign: 'middle',
    },
    {
      id: 'sheet-no-value',
      field: 'sheetNo',
      x: 25,
      y: 40,
      w: 25,
      h: 8,
      textStyle: 'body',
      align: 'right',
      valign: 'middle',
    },
    {
      id: 'revision-label',
      label: '版本',
      x: 50,
      y: 40,
      w: 50,
      h: 8,
      textStyle: 'label',
      align: 'left',
      valign: 'middle',
    },
    {
      id: 'revision-value',
      field: 'revision',
      x: 50,
      y: 40,
      w: 50,
      h: 8,
      textStyle: 'body',
      align: 'right',
      valign: 'middle',
    },
    {
      id: 'company-label',
      label: '单位名称',
      x: 0,
      y: 48,
      w: 20,
      h: 8,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'company-value',
      field: 'company',
      x: 20,
      y: 48,
      w: 80,
      h: 8,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },

    // 名称及代号区（右侧）
    {
      id: 'name-label',
      label: '名称',
      x: 100,
      y: 0,
      w: 18,
      h: 10,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'name-value',
      field: 'drawingName',
      x: 118,
      y: 0,
      w: 62,
      h: 10,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'code-label',
      label: '代号',
      x: 100,
      y: 10,
      w: 18,
      h: 10,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'code-value',
      field: 'drawingNo',
      x: 118,
      y: 10,
      w: 62,
      h: 10,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'project-label',
      label: '工程名称',
      x: 100,
      y: 20,
      w: 18,
      h: 10,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'project-value',
      field: 'projectName',
      x: 118,
      y: 20,
      w: 62,
      h: 10,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'date-label',
      label: '日期',
      x: 100,
      y: 30,
      w: 18,
      h: 10,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'date-value',
      field: 'date',
      x: 118,
      y: 30,
      w: 62,
      h: 10,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'company-right-label',
      label: '单位',
      x: 100,
      y: 40,
      w: 18,
      h: 16,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'company-right-value',
      field: 'company',
      x: 118,
      y: 40,
      w: 62,
      h: 16,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
  ]
  return cells
}

function simpleTitleBlockCells(): TitleBlockCell[] {
  return [
    {
      id: 's-project-label',
      label: '工程名称',
      x: 0,
      y: 0,
      w: 30,
      h: 14,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-project-value',
      field: 'projectName',
      x: 30,
      y: 0,
      w: 150,
      h: 14,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-name-label',
      label: '图名',
      x: 0,
      y: 14,
      w: 30,
      h: 14,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-name-value',
      field: 'drawingName',
      x: 30,
      y: 14,
      w: 150,
      h: 14,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-no-label',
      label: '图号',
      x: 0,
      y: 28,
      w: 30,
      h: 10,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-no-value',
      field: 'drawingNo',
      x: 30,
      y: 28,
      w: 70,
      h: 10,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-scale-label',
      label: '比例',
      x: 100,
      y: 28,
      w: 20,
      h: 10,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-scale-value',
      field: 'scale',
      x: 120,
      y: 28,
      w: 60,
      h: 10,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-date-label',
      label: '日期',
      x: 0,
      y: 38,
      w: 30,
      h: 9,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-date-value',
      field: 'date',
      x: 30,
      y: 38,
      w: 70,
      h: 9,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-rev-label',
      label: '版本',
      x: 100,
      y: 38,
      w: 20,
      h: 9,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-rev-value',
      field: 'revision',
      x: 120,
      y: 38,
      w: 60,
      h: 9,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-design-label',
      label: '设计',
      x: 0,
      y: 47,
      w: 20,
      h: 9,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-design-value',
      field: 'designer',
      x: 20,
      y: 47,
      w: 40,
      h: 9,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-check-label',
      label: '审核',
      x: 60,
      y: 47,
      w: 20,
      h: 9,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-check-value',
      field: 'checker',
      x: 80,
      y: 47,
      w: 40,
      h: 9,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-company-label',
      label: '单位',
      x: 120,
      y: 47,
      w: 20,
      h: 9,
      textStyle: 'label',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 's-company-value',
      field: 'company',
      x: 140,
      y: 47,
      w: 40,
      h: 9,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
  ]
}

function minimalTitleBlockCells(): TitleBlockCell[] {
  return [
    {
      id: 'm-name',
      field: 'drawingName',
      x: 0,
      y: 0,
      w: 120,
      h: 20,
      textStyle: 'title',
      align: 'left',
      valign: 'middle',
    },
    {
      id: 'm-no',
      label: '图号',
      field: 'drawingNo',
      x: 120,
      y: 0,
      w: 60,
      h: 20,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'm-project',
      field: 'projectName',
      x: 0,
      y: 20,
      w: 120,
      h: 14,
      textStyle: 'body',
      align: 'left',
      valign: 'middle',
    },
    {
      id: 'm-scale',
      label: '比例',
      field: 'scale',
      x: 120,
      y: 20,
      w: 30,
      h: 14,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'm-date',
      label: '日期',
      field: 'date',
      x: 150,
      y: 20,
      w: 30,
      h: 14,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
    {
      id: 'm-company',
      field: 'company',
      x: 0,
      y: 34,
      w: 180,
      h: 10,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
    },
  ]
}

export function createTemplate(
  kind: 'gb' | 'simple' | 'minimal' = 'gb',
  size: PaperSize = 'A2',
  orientation: Orientation = 'landscape',
): SheetTemplate {
  const dims = paperDimensions(size, orientation)
  const margins = defaultMargins(size, 'left')
  const textStyles = textStylesFor(size)
  const cells =
    kind === 'gb'
      ? gbTitleBlockCells()
      : kind === 'simple'
        ? simpleTitleBlockCells()
        : minimalTitleBlockCells()
  const grid = gridFromAbsolute(cells, 180, 56)
  return {
    schemaVersion: 1,
    id: `${kind}-${size.toLowerCase()}-${orientation}`,
    name:
      kind === 'gb'
        ? `GB 风格图签 ${size}`
        : kind === 'simple'
          ? `简洁图签 ${size}`
          : `极简图签 ${size}`,
    description:
      kind === 'gb'
        ? '参考 GB/T 14689 / GB/T 10609.1 常用格式，单元格可编辑'
        : '企业/项目常用简化图签，可自由调整',
    paper: { size, orientation, width: dims.width, height: dims.height },
    margins,
    bindingEdge: 'left',
    frame: {
      lineWidth: 0.7,
      innerOffset: 0,
      centeringMarks: true,
      zoneMarking: true,
      zoneColumns: 0,
      zoneRows: 0,
    },
    titleBlock: {
      width: 180,
      height: 56,
      position: 'bottom-right',
      layoutMode: 'grid',
      grid,
      cells: gridToAbsoluteCells(grid),
    },
    styles: {
      fontFamily: "'Microsoft YaHei', 'Noto Sans SC', 'PingFang SC', sans-serif",
      textStyles,
    },
    theme: { ...DEFAULT_THEME },
  }
}

export function createDefaultDocument(kind: 'gb' | 'simple' | 'minimal' = 'gb'): SheetDocument {
  return {
    schemaVersion: 1,
    template: createTemplate(kind),
    values: createDefaultValues(),
    customFields: [],
  }
}

function normalizeRect(x: number, y: number, w: number, h: number): LayoutRect {
  return { x, y, w: Math.max(0, w), h: Math.max(0, h) }
}

function resolveTitleBlockRect(template: SheetTemplate, frame: LayoutRect): LayoutRect {
  const tb = template.titleBlock
  const width = Math.min(tb.width, frame.w)
  const height = Math.min(tb.height, frame.h)
  let x = frame.x + frame.w - width
  let y = frame.y + frame.h - height
  if (tb.position === 'bottom-left') x = frame.x
  if (tb.position === 'top-right') y = frame.y
  if (tb.position === 'top-left') {
    x = frame.x
    y = frame.y
  }
  return normalizeRect(x, y, width, height)
}

function titleBlockScale(
  template: SheetTemplate,
  titleBlock: LayoutRect,
): { sx: number; sy: number } {
  return {
    sx: template.titleBlock.width > 0 ? Math.min(1, titleBlock.w / template.titleBlock.width) : 1,
    sy: template.titleBlock.height > 0 ? Math.min(1, titleBlock.h / template.titleBlock.height) : 1,
  }
}

function zoneCount(size: PaperSize, orientation: Orientation): { cols: number; rows: number } {
  if (size === 'A0' || size === 'A1')
    return orientation === 'landscape' ? { cols: 8, rows: 6 } : { cols: 6, rows: 8 }
  if (size === 'A2' || size === 'A3')
    return orientation === 'landscape' ? { cols: 6, rows: 4 } : { cols: 4, rows: 6 }
  return orientation === 'landscape' ? { cols: 4, rows: 3 } : { cols: 3, rows: 4 }
}

/**
 * 生成可直接渲染/导出的布局模型（单位 mm）。
 */
export function buildSheetLayout(template: SheetTemplate, values: SheetFieldValues): SheetLayout {
  const paper = normalizeRect(0, 0, template.paper.width, template.paper.height)
  const { margins } = template
  const frame = normalizeRect(
    margins.left,
    margins.top,
    Math.max(0, paper.w - margins.left - margins.right),
    Math.max(0, paper.h - margins.top - margins.bottom),
  )
  const titleBlock = resolveTitleBlockRect(template, frame)
  const { sx, sy } = titleBlockScale(template, titleBlock)
  const textScale = Math.min(sx, sy)
  const shapes: LayoutShape[] = []
  const lines: LayoutLine[] = []
  const texts: LayoutText[] = []
  const cells: LayoutCell[] = []
  const ink = template.theme.ink
  const frameColor = template.theme.frame
  const muted = template.theme.muted
  const frameStandard = 'GB/T 14689-2008'
  const titleStandard = 'GB/T 10609.1-2008'

  // 装订边参考区（视图辅助，不是国标图线）
  shapes.push({
    x: 0,
    y: 0,
    w: margins.left,
    h: paper.h,
    fill: template.theme.accent,
    opacity: 0.06,
    semanticId: 'frame.binding',
    name: '装订边参考区',
    standard: frameStandard,
    group: 'frame.binding',
    layer: 'frame',
  })

  // 纸张外边界（细线）
  lines.push({
    x1: 0,
    y1: 0,
    x2: paper.w,
    y2: 0,
    width: 0.2,
    color: template.theme.grid,
    semanticId: 'paper.border.top',
    name: '纸张边界',
    group: 'paper',
    layer: 'frame',
  })
  lines.push({
    x1: paper.w,
    y1: 0,
    x2: paper.w,
    y2: paper.h,
    width: 0.2,
    color: template.theme.grid,
    semanticId: 'paper.border.right',
    name: '纸张边界',
    group: 'paper',
    layer: 'frame',
  })
  lines.push({
    x1: paper.w,
    y1: paper.h,
    x2: 0,
    y2: paper.h,
    width: 0.2,
    color: template.theme.grid,
    semanticId: 'paper.border.bottom',
    name: '纸张边界',
    group: 'paper',
    layer: 'frame',
  })
  lines.push({
    x1: 0,
    y1: paper.h,
    x2: 0,
    y2: 0,
    width: 0.2,
    color: template.theme.grid,
    semanticId: 'paper.border.left',
    name: '纸张边界',
    group: 'paper',
    layer: 'frame',
  })

  // 图框
  const fw = Math.max(0.1, template.frame.lineWidth)
  lines.push({
    x1: frame.x,
    y1: frame.y,
    x2: frame.x + frame.w,
    y2: frame.y,
    width: fw,
    color: frameColor,
    semanticId: 'frame.top',
    name: '图框线',
    standard: frameStandard,
    group: 'frame.line',
    layer: 'frame',
  })
  lines.push({
    x1: frame.x + frame.w,
    y1: frame.y,
    x2: frame.x + frame.w,
    y2: frame.y + frame.h,
    width: fw,
    color: frameColor,
    semanticId: 'frame.right',
    name: '图框线',
    standard: frameStandard,
    group: 'frame.line',
    layer: 'frame',
  })
  lines.push({
    x1: frame.x + frame.w,
    y1: frame.y + frame.h,
    x2: frame.x,
    y2: frame.y + frame.h,
    width: fw,
    color: frameColor,
    semanticId: 'frame.bottom',
    name: '图框线',
    standard: frameStandard,
    group: 'frame.line',
    layer: 'frame',
  })
  lines.push({
    x1: frame.x,
    y1: frame.y + frame.h,
    x2: frame.x,
    y2: frame.y,
    width: fw,
    color: frameColor,
    semanticId: 'frame.left',
    name: '图框线',
    standard: frameStandard,
    group: 'frame.line',
    layer: 'frame',
  })

  // 对中符号
  if (template.frame.centeringMarks) {
    const mark = 5
    const cx = frame.x + frame.w / 2
    const cy = frame.y + frame.h / 2
    lines.push({
      x1: cx,
      y1: 0,
      x2: cx,
      y2: mark,
      width: 0.5,
      color: frameColor,
      semanticId: 'symbol.centering.top',
      name: '对中符号',
      standard: frameStandard,
      group: 'symbol.centering',
      layer: 'symbol',
    })
    lines.push({
      x1: cx,
      y1: paper.h - mark,
      x2: cx,
      y2: paper.h,
      width: 0.5,
      color: frameColor,
      semanticId: 'symbol.centering.bottom',
      name: '对中符号',
      standard: frameStandard,
      group: 'symbol.centering',
      layer: 'symbol',
    })
    lines.push({
      x1: 0,
      y1: cy,
      x2: mark,
      y2: cy,
      width: 0.5,
      color: frameColor,
      semanticId: 'symbol.centering.left',
      name: '对中符号',
      standard: frameStandard,
      group: 'symbol.centering',
      layer: 'symbol',
    })
    lines.push({
      x1: paper.w - mark,
      y1: cy,
      x2: paper.w,
      y2: cy,
      width: 0.5,
      color: frameColor,
      semanticId: 'symbol.centering.right',
      name: '对中符号',
      standard: frameStandard,
      group: 'symbol.centering',
      layer: 'symbol',
    })
  }

  // 分区标记
  if (template.frame.zoneMarking) {
    const auto = zoneCount(template.paper.size, template.paper.orientation)
    const cols = template.frame.zoneColumns > 0 ? template.frame.zoneColumns : auto.cols
    const rows = template.frame.zoneRows > 0 ? template.frame.zoneRows : auto.rows
    const tick = 4
    for (let i = 1; i < cols; i += 1) {
      const x = frame.x + (frame.w * i) / cols
      lines.push({
        x1: x,
        y1: frame.y,
        x2: x,
        y2: frame.y + tick,
        width: 0.3,
        color: muted,
        semanticId: `zone.tick.top.${i}`,
        name: '分区标记',
        standard: frameStandard,
        group: 'zone.mark',
        layer: 'frame',
      })
      lines.push({
        x1: x,
        y1: frame.y + frame.h - tick,
        x2: x,
        y2: frame.y + frame.h,
        width: 0.3,
        color: muted,
        semanticId: `zone.tick.bottom.${i}`,
        name: '分区标记',
        standard: frameStandard,
        group: 'zone.mark',
        layer: 'frame',
      })
    }
    for (let i = 1; i < rows; i += 1) {
      const y = frame.y + (frame.h * i) / rows
      lines.push({
        x1: frame.x,
        y1: y,
        x2: frame.x + tick,
        y2: y,
        width: 0.3,
        color: muted,
        semanticId: `zone.tick.left.${i}`,
        name: '分区标记',
        standard: frameStandard,
        group: 'zone.mark',
        layer: 'frame',
      })
      lines.push({
        x1: frame.x + frame.w - tick,
        y1: y,
        x2: frame.x + frame.w,
        y2: y,
        width: 0.3,
        color: muted,
        semanticId: `zone.tick.right.${i}`,
        name: '分区标记',
        standard: frameStandard,
        group: 'zone.mark',
        layer: 'frame',
      })
    }
    // 分区编号（上/下 1..cols，左/右 A..）
    for (let i = 0; i < cols; i += 1) {
      const x = frame.x + (frame.w * (i + 0.5)) / cols
      texts.push({
        x,
        y: frame.y - 2,
        text: String(i + 1),
        fontSize: template.styles.textStyles.label?.fontSize ?? 3.5,
        anchor: 'center',
        baseline: 'bottom',
        bold: false,
        color: muted,
        semanticId: `zone.number.top.${i + 1}`,
        name: '分区编号',
        standard: frameStandard,
        group: 'zone.number',
        layer: 'text',
      })
      texts.push({
        x,
        y: frame.y + frame.h + 2,
        text: String(i + 1),
        fontSize: template.styles.textStyles.label?.fontSize ?? 3.5,
        anchor: 'center',
        baseline: 'top',
        bold: false,
        color: muted,
        semanticId: `zone.number.bottom.${i + 1}`,
        name: '分区编号',
        standard: frameStandard,
        group: 'zone.number',
        layer: 'text',
      })
    }
    for (let i = 0; i < rows; i += 1) {
      const y = frame.y + (frame.h * (i + 0.5)) / rows
      const letter = String.fromCharCode(65 + i)
      texts.push({
        x: frame.x - 2,
        y,
        text: letter,
        fontSize: template.styles.textStyles.label?.fontSize ?? 3.5,
        anchor: 'right',
        baseline: 'middle',
        bold: false,
        color: muted,
        semanticId: `zone.letter.left.${letter}`,
        name: '分区编号',
        standard: frameStandard,
        group: 'zone.number',
        layer: 'text',
      })
      texts.push({
        x: frame.x + frame.w + 2,
        y,
        text: letter,
        fontSize: template.styles.textStyles.label?.fontSize ?? 3.5,
        anchor: 'left',
        baseline: 'middle',
        bold: false,
        color: muted,
        semanticId: `zone.letter.right.${letter}`,
        name: '分区编号',
        standard: frameStandard,
        group: 'zone.number',
        layer: 'text',
      })
    }
  }

  // 图签外框
  lines.push({
    x1: titleBlock.x,
    y1: titleBlock.y,
    x2: titleBlock.x + titleBlock.w,
    y2: titleBlock.y,
    width: 0.5,
    color: frameColor,
    semanticId: 'titleBlock.border.top',
    name: '图签外框',
    standard: titleStandard,
    group: 'titleBlock.border',
    layer: 'title',
  })
  lines.push({
    x1: titleBlock.x + titleBlock.w,
    y1: titleBlock.y,
    x2: titleBlock.x + titleBlock.w,
    y2: titleBlock.y + titleBlock.h,
    width: 0.5,
    color: frameColor,
    semanticId: 'titleBlock.border.right',
    name: '图签外框',
    standard: titleStandard,
    group: 'titleBlock.border',
    layer: 'title',
  })
  lines.push({
    x1: titleBlock.x + titleBlock.w,
    y1: titleBlock.y + titleBlock.h,
    x2: titleBlock.x,
    y2: titleBlock.y + titleBlock.h,
    width: 0.5,
    color: frameColor,
    semanticId: 'titleBlock.border.bottom',
    name: '图签外框',
    standard: titleStandard,
    group: 'titleBlock.border',
    layer: 'title',
  })
  lines.push({
    x1: titleBlock.x,
    y1: titleBlock.y + titleBlock.h,
    x2: titleBlock.x,
    y2: titleBlock.y,
    width: 0.5,
    color: frameColor,
    semanticId: 'titleBlock.border.left',
    name: '图签外框',
    standard: titleStandard,
    group: 'titleBlock.border',
    layer: 'title',
  })

  for (const cell of resolveTitleBlockCells(template)) {
    const x = titleBlock.x + cell.x * sx
    const y = titleBlock.y + cell.y * sy
    const w = cell.w * sx
    const h = cell.h * sy
    const border = cell.border !== false
    if (border) {
      lines.push({
        x1: x,
        y1: y,
        x2: x + w,
        y2: y,
        width: 0.3,
        color: frameColor,
        semanticId: `titleBlock.cell.${cell.id}.border.top`,
        name: '单元格边框',
        standard: titleStandard,
        group: 'titleBlock.cellBorder',
        layer: 'title',
      })
      lines.push({
        x1: x + w,
        y1: y,
        x2: x + w,
        y2: y + h,
        width: 0.3,
        color: frameColor,
        semanticId: `titleBlock.cell.${cell.id}.border.right`,
        name: '单元格边框',
        standard: titleStandard,
        group: 'titleBlock.cellBorder',
        layer: 'title',
      })
      lines.push({
        x1: x + w,
        y1: y + h,
        x2: x,
        y2: y + h,
        width: 0.3,
        color: frameColor,
        semanticId: `titleBlock.cell.${cell.id}.border.bottom`,
        name: '单元格边框',
        standard: titleStandard,
        group: 'titleBlock.cellBorder',
        layer: 'title',
      })
      lines.push({
        x1: x,
        y1: y + h,
        x2: x,
        y2: y,
        width: 0.3,
        color: frameColor,
        semanticId: `titleBlock.cell.${cell.id}.border.left`,
        name: '单元格边框',
        standard: titleStandard,
        group: 'titleBlock.cellBorder',
        layer: 'title',
      })
    }
    const style =
      template.styles.textStyles[cell.textStyle ?? 'body'] ?? template.styles.textStyles.body!
    const fontSize = (cell.fontSize ?? style.fontSize) * textScale
    const bold = cell.bold ?? style.bold
    const align = cell.align ?? 'center'
    const valign = cell.valign ?? 'middle'
    const labelAlign = cell.labelAlign ?? align
    const valueAlign = cell.valueAlign ?? align
    const fieldValue = cell.field ? (values[cell.field] ?? '') : ''
    const staticText = cell.text ?? ''
    const showLabel = cell.showLabel !== false && Boolean(cell.label)
    const value = fieldValue || staticText
    const hasBoth = showLabel && Boolean(value)
    const textXFor = (alignment: TextAlign): number =>
      alignment === 'left' ? x + 1.5 : alignment === 'right' ? x + w - 1.5 : x + w / 2
    const anchorFor = (alignment: TextAlign): TextAlign =>
      alignment === 'left' ? 'left' : alignment === 'right' ? 'right' : 'center'
    const labelTextX = textXFor(labelAlign)
    const valueTextX = textXFor(valueAlign)
    const labelAnchor = anchorFor(labelAlign)
    const valueAnchor = anchorFor(valueAlign)
    const linesOfText = wrapText(value, fontSize, Math.max(1, w - 3), template.styles.fontFamily)
    const baseLabelFont =
      (template.styles.textStyles.label?.fontSize ?? Math.min(style.fontSize, 3.5)) * textScale
    const labelTextWidth = cell.label
      ? measureTextWidth(cell.label, baseLabelFont, template.styles.fontFamily)
      : 0
    const labelFont =
      labelTextWidth > w - 3 && labelTextWidth > 0
        ? Math.max(1.8, (baseLabelFont * (w - 3)) / labelTextWidth)
        : baseLabelFont
    const labelWidth = cell.label
      ? measureTextWidth(cell.label, labelFont, template.styles.fontFamily)
      : 0
    const valueWidth = measureTextWidth(value, fontSize, template.styles.fontFamily)
    const inlineLabelAnchor: TextAlign = labelAnchor === valueAnchor ? 'left' : labelAnchor
    const inlineValueAnchor: TextAlign = labelAnchor === valueAnchor ? 'right' : valueAnchor
    const inlineLabelX = labelAnchor === valueAnchor ? x + 1.5 : labelTextX
    const inlineValueX = labelAnchor === valueAnchor ? x + w - 1.5 : valueTextX
    const canInline =
      hasBoth &&
      linesOfText.length === 1 &&
      h < labelFont + fontSize + 3.5 &&
      labelWidth + valueWidth + 4 <= w
    if (canInline) {
      texts.push({
        x: inlineLabelX,
        y: y + h / 2,
        text: cell.label!,
        fontSize: labelFont,
        anchor: inlineLabelAnchor,
        baseline: 'middle',
        bold: false,
        color: muted,
        cellId: cell.id,
        semanticId: `titleBlock.cell.${cell.id}.label`,
        name: '单元格标签',
        standard: titleStandard,
        group: 'titleBlock.label',
        layer: 'text',
      })
      texts.push({
        x: inlineValueX,
        y: y + h / 2,
        text: value,
        fontSize,
        anchor: inlineValueAnchor,
        baseline: 'middle',
        bold,
        color: ink,
        cellId: cell.id,
        semanticId: `titleBlock.cell.${cell.id}.value`,
        name: '字段值',
        standard: titleStandard,
        group: 'titleBlock.value',
        layer: 'text',
      })
    } else if (hasBoth) {
      texts.push({
        x: labelTextX,
        y: y + 1.5,
        text: cell.label!,
        fontSize: labelFont,
        anchor: labelAnchor,
        baseline: 'top',
        bold: false,
        color: muted,
        cellId: cell.id,
        semanticId: `titleBlock.cell.${cell.id}.label`,
        name: '单元格标签',
        standard: titleStandard,
        group: 'titleBlock.label',
        layer: 'text',
      })
      const valueCenterY = y + labelFont + (h - labelFont) / 2
      const startY = valueCenterY + (linesOfText.length > 1 ? -fontSize * 0.2 : 0)
      linesOfText.forEach((line, index) => {
        texts.push({
          x: valueTextX,
          y: startY + index * fontSize * style.lineHeight,
          text: line,
          fontSize,
          anchor: valueAnchor,
          baseline: 'middle',
          bold,
          color: ink,
          cellId: cell.id,
          semanticId: `titleBlock.cell.${cell.id}.value`,
          name: '字段值',
          standard: titleStandard,
          group: 'titleBlock.value',
          layer: 'text',
        })
      })
    } else if (showLabel && !value) {
      texts.push({
        x: labelTextX,
        y: y + h / 2,
        text: cell.label!,
        fontSize: labelFont,
        anchor: labelAnchor,
        baseline: 'middle',
        bold: false,
        color: muted,
        cellId: cell.id,
        semanticId: `titleBlock.cell.${cell.id}.label`,
        name: '单元格标签',
        standard: titleStandard,
        group: 'titleBlock.label',
        layer: 'text',
      })
    } else {
      const startY = y + h / 2 - ((linesOfText.length - 1) * fontSize * style.lineHeight) / 2
      linesOfText.forEach((line, index) => {
        texts.push({
          x: valueTextX,
          y: startY + index * fontSize * style.lineHeight,
          text: line,
          fontSize,
          anchor: valueAnchor,
          baseline: 'middle',
          bold,
          color: ink,
          cellId: cell.id,
          semanticId: `titleBlock.cell.${cell.id}.value`,
          name: '字段值',
          standard: titleStandard,
          group: 'titleBlock.value',
          layer: 'text',
        })
      })
    }
    cells.push({
      id: cell.id,
      x,
      y,
      w,
      h,
      label: cell.label,
      field: cell.field,
      textStyle: cell.textStyle,
      align,
      valign,
      border,
      gridRow: cell.gridRow,
      gridCol: cell.gridCol,
      gridRowSpan: cell.gridRowSpan,
      gridColSpan: cell.gridColSpan,
    })
  }

  return {
    paper,
    frame,
    titleBlock,
    shapes,
    lines,
    texts,
    cells,
    fontSizes: recommendedFontSizes(template.paper.size),
  }
}

/**
 * 近似文字宽度（mm）。CJK 按 1.0 字宽，ASCII 按 0.55 字宽。
 * 用于校验和换行；最终排版仍以 SVG/CAD 字体为准。
 */
export function measureTextWidth(text: string, fontSize: number, fontFamily = ''): number {
  const asciiRatio = /mono|consolas|courier/i.test(fontFamily) ? 0.6 : 0.55
  let units = 0
  for (const ch of text) {
    units += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 1 : asciiRatio
  }
  return units * fontSize
}

export function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
  fontFamily = '',
): string[] {
  if (!text) return []
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let current = ''
    for (const ch of paragraph) {
      const next = current + ch
      if (current && measureTextWidth(next, fontSize, fontFamily) > maxWidth) {
        lines.push(current)
        current = ch
      } else {
        current = next
      }
    }
    lines.push(current)
  }
  return lines.length ? lines : ['']
}

export function validateTemplate(
  template: SheetTemplate,
  values?: SheetFieldValues,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const dims = template.paper
  if (dims.width <= 0 || dims.height <= 0) {
    issues.push({ severity: 'error', message: '纸张尺寸必须大于 0', path: 'paper' })
  }
  if (template.margins.left + template.margins.right >= dims.width) {
    issues.push({ severity: 'error', message: '左右边距之和超过纸张宽度', path: 'margins' })
  }
  if (template.margins.top + template.margins.bottom >= dims.height) {
    issues.push({ severity: 'error', message: '上下边距之和超过纸张高度', path: 'margins' })
  }
  const frameW = dims.width - template.margins.left - template.margins.right
  const frameH = dims.height - template.margins.top - template.margins.bottom
  if (template.titleBlock.width > frameW + 0.01) {
    issues.push({
      severity: 'warning',
      message: `图签宽度 ${template.titleBlock.width}mm 超过图框宽度 ${frameW.toFixed(1)}mm，将按图框缩放`,
      path: 'titleBlock.width',
    })
  }
  if (template.titleBlock.height > frameH + 0.01) {
    issues.push({
      severity: 'warning',
      message: `图签高度 ${template.titleBlock.height}mm 超过图框高度 ${frameH.toFixed(1)}mm，将按图框缩放`,
      path: 'titleBlock.height',
    })
  }
  const ids = new Set<string>()
  const minFont = recommendedFontSizes(template.paper.size).min
  const resolvedCells = resolveTitleBlockCells(template)
  for (const cell of resolvedCells) {
    if (ids.has(cell.id)) {
      issues.push({ severity: 'error', message: `单元格 ID 重复：${cell.id}`, cellId: cell.id })
    }
    ids.add(cell.id)
    if (
      cell.x < -0.01 ||
      cell.y < -0.01 ||
      cell.x + cell.w > template.titleBlock.width + 0.01 ||
      cell.y + cell.h > template.titleBlock.height + 0.01
    ) {
      issues.push({
        severity: 'warning',
        message: `单元格“${cell.label ?? cell.id}”超出图签范围`,
        cellId: cell.id,
      })
    }
    if (cell.w <= 0 || cell.h <= 0) {
      issues.push({
        severity: 'error',
        message: `单元格“${cell.label ?? cell.id}”宽高必须大于 0`,
        cellId: cell.id,
      })
    }
    const style =
      template.styles.textStyles[cell.textStyle ?? 'body'] ?? template.styles.textStyles.body!
    if (style.fontSize < minFont - 0.01) {
      issues.push({
        severity: 'warning',
        message: `单元格“${cell.label ?? cell.id}”字高 ${style.fontSize}mm 低于 ${template.paper.size} 建议最小值 ${minFont}mm`,
        cellId: cell.id,
      })
    }
    const text = cell.field ? (values?.[cell.field] ?? '') : (cell.text ?? '')
    if (text && measureTextWidth(text, style.fontSize, template.styles.fontFamily) > cell.w - 2) {
      issues.push({
        severity: 'warning',
        message: `单元格“${cell.label ?? cell.id}”文字可能溢出`,
        cellId: cell.id,
      })
    }
  }
  if (template.titleBlock.layoutMode === 'grid') {
    const grid = template.titleBlock.grid
    if (!grid || !grid.columns.length || !grid.rows.length) {
      issues.push({ severity: 'error', message: '网格模式下缺少行列定义', path: 'titleBlock.grid' })
    } else {
      const totalW = grid.columns.reduce((sum, track) => sum + track.size, 0)
      const totalH = grid.rows.reduce((sum, track) => sum + track.size, 0)
      if (Math.abs(totalW - template.titleBlock.width) > 0.5) {
        issues.push({
          severity: 'warning',
          message: `网格列宽合计 ${totalW.toFixed(1)}mm 与图签宽度 ${template.titleBlock.width}mm 不一致`,
          path: 'titleBlock.grid.columns',
        })
      }
      if (Math.abs(totalH - template.titleBlock.height) > 0.5) {
        issues.push({
          severity: 'warning',
          message: `网格行高合计 ${totalH.toFixed(1)}mm 与图签高度 ${template.titleBlock.height}mm 不一致`,
          path: 'titleBlock.grid.rows',
        })
      }
      for (const cell of grid.cells) {
        if (
          cell.row < 0 ||
          cell.col < 0 ||
          cell.row + cell.rowSpan > grid.rows.length ||
          cell.col + cell.colSpan > grid.columns.length
        ) {
          issues.push({
            severity: 'warning',
            message: `网格单元格“${cell.label ?? cell.id}”超出网格范围`,
            cellId: cell.id,
          })
        }
        if (cell.rowSpan <= 0 || cell.colSpan <= 0) {
          issues.push({
            severity: 'error',
            message: `网格单元格“${cell.label ?? cell.id}”行列跨度必须大于 0`,
            cellId: cell.id,
          })
        }
      }
      for (let i = 0; i < grid.cells.length; i += 1) {
        for (let j = i + 1; j < grid.cells.length; j += 1) {
          const a = grid.cells[i]!
          const b = grid.cells[j]!
          const overlap =
            a.row < b.row + b.rowSpan &&
            a.row + a.rowSpan > b.row &&
            a.col < b.col + b.colSpan &&
            a.col + a.colSpan > b.col
          if (overlap) {
            issues.push({
              severity: 'error',
              message: `网格单元格“${a.label ?? a.id}”与“${b.label ?? b.id}”重叠`,
              cellId: a.id,
            })
          }
        }
      }
    }
  }
  return issues
}

export function cloneTemplate(template: SheetTemplate): SheetTemplate {
  return JSON.parse(JSON.stringify(template)) as SheetTemplate
}

export function formatPaper(
  size: PaperSize,
  orientation: Orientation,
  width: number,
  height: number,
): string {
  return `${size} ${orientation === 'landscape' ? '横版' : '竖版'} ${width}×${height}mm`
}
