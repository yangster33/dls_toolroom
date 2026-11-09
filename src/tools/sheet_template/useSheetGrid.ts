/**
 * 图框图签的网格编辑（从 SheetTemplatePage.vue 抽出）。
 *
 * 负责行列增删、合并拆分、尺寸调整、自适应、归一化与网格/绝对坐标转换。
 */
import type { ComputedRef, Ref } from 'vue'
import {
  autoFitGridColumns,
  autoFitGridRows,
  deleteGridColumn,
  deleteGridRow,
  equalizeGridColumns,
  equalizeGridRows,
  insertGridColumn,
  insertGridRow,
  mergeGridCells,
  migrateToGrid,
  normalizeGrid,
  splitGridCell,
  syncCellsFromGrid,
  type GridCell,
  type GridRange,
  type SheetDocument,
  type TitleBlockCell,
  type TitleBlockGrid,
} from './sheetTemplate'

export interface SheetGridOptions {
  doc: Ref<SheetDocument>
  selectedCellId: Ref<string | null>
  selectedGridCell: ComputedRef<GridCell | null>
  isGridMode: ComputedRef<boolean>
  centerTab: Ref<'grid' | 'preview'>
  mutate: (fn: () => void) => void
  flash: (message: string) => void
}

export function useSheetGrid(options: SheetGridOptions) {
  const { doc, selectedCellId, selectedGridCell, isGridMode, centerTab, mutate, flash } = options

  function gridOf(): TitleBlockGrid | null {
    return doc.value.template.titleBlock.grid ?? null
  }

  function withGrid(fn: (grid: TitleBlockGrid) => void, message?: string): void {
    const grid = gridOf()
    if (!grid) {
      flash('当前不是网格模式')
      return
    }
    mutate(() => {
      fn(grid)
      syncCellsFromGrid(doc.value.template)
      if (message) flash(message)
    })
  }

  function splitCellsAcrossRow(grid: TitleBlockGrid, index: number): number {
    const additions: GridCell[] = []
    let count = 0
    for (const cell of grid.cells) {
      if (cell.row < index && cell.row + cell.rowSpan > index) {
        const bottomSpan = cell.row + cell.rowSpan - index
        cell.rowSpan = index - cell.row
        additions.push({
          ...cell,
          id: `${cell.id}-split-${index}`,
          row: index,
          rowSpan: bottomSpan,
          label: undefined,
          field: undefined,
          text: undefined,
        })
        count += 1
      }
    }
    grid.cells.push(...additions)
    return count
  }

  function splitCellsAcrossColumn(grid: TitleBlockGrid, index: number): number {
    const additions: GridCell[] = []
    let count = 0
    for (const cell of grid.cells) {
      if (cell.col < index && cell.col + cell.colSpan > index) {
        const rightSpan = cell.col + cell.colSpan - index
        cell.colSpan = index - cell.col
        additions.push({
          ...cell,
          id: `${cell.id}-split-${index}`,
          col: index,
          colSpan: rightSpan,
          label: undefined,
          field: undefined,
          text: undefined,
        })
        count += 1
      }
    }
    grid.cells.push(...additions)
    return count
  }

  function createGridCellAt(row: number, col: number, rowSpan = 1, colSpan = 1): GridCell {
    return {
      id: `cell-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      row,
      col,
      rowSpan,
      colSpan,
      label: '新单元格',
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
      border: true,
    }
  }

  function gridInsertRow(index: number): void {
    const grid = gridOf()
    if (!grid) return
    const selected = selectedGridCell.value
    mutate(() => {
      const split = splitCellsAcrossRow(grid, index)
      insertGridRow(grid, index)
      normalizeGrid(grid, doc.value.template.titleBlock.width, doc.value.template.titleBlock.height)
      const cell = createGridCellAt(index, selected?.col ?? 0, 1, selected?.colSpan ?? 1)
      grid.cells.push(cell)
      selectedCellId.value = cell.id
      syncCellsFromGrid(doc.value.template)
      flash(split > 0 ? '已插入行并创建新单元格（跨行合并单元格已拆分）' : '已插入行并创建新单元格')
    })
  }

  function gridDeleteRow(index: number): void {
    withGrid((grid) => {
      deleteGridRow(grid, index)
      normalizeGrid(grid, doc.value.template.titleBlock.width, doc.value.template.titleBlock.height)
    }, '已删除行')
  }

  function gridInsertColumn(index: number): void {
    const grid = gridOf()
    if (!grid) return
    const selected = selectedGridCell.value
    mutate(() => {
      const split = splitCellsAcrossColumn(grid, index)
      insertGridColumn(grid, index)
      normalizeGrid(grid, doc.value.template.titleBlock.width, doc.value.template.titleBlock.height)
      const cell = createGridCellAt(selected?.row ?? 0, index, selected?.rowSpan ?? 1, 1)
      grid.cells.push(cell)
      selectedCellId.value = cell.id
      syncCellsFromGrid(doc.value.template)
      flash(split > 0 ? '已插入列并创建新单元格（跨列合并单元格已拆分）' : '已插入列并创建新单元格')
    })
  }

  function gridDeleteColumn(index: number): void {
    withGrid((grid) => {
      deleteGridColumn(grid, index)
      normalizeGrid(grid, doc.value.template.titleBlock.width, doc.value.template.titleBlock.height)
    }, '已删除列')
  }

  function gridAddCellAt(row: number, col: number): void {
    const grid = gridOf()
    if (!grid) return
    const occupied = grid.cells.some(
      (cell) =>
        row >= cell.row &&
        row < cell.row + cell.rowSpan &&
        col >= cell.col &&
        col < cell.col + cell.colSpan,
    )
    if (occupied) {
      flash('该位置已有单元格')
      return
    }
    mutate(() => {
      const cell = createGridCellAt(row, col)
      grid.cells.push(cell)
      selectedCellId.value = cell.id
      syncCellsFromGrid(doc.value.template)
    })
    flash('已添加单元格')
  }

  function gridUpdateField(field: string, value: string): void {
    mutate(() => {
      doc.value.values[field] = value
    })
  }

  function gridUpdateCellText(cellId: string, value: string, target: 'label' | 'text'): void {
    const grid = gridOf()
    if (!grid) return
    mutate(() => {
      const cell = grid.cells.find((item) => item.id === cellId)
      if (!cell) return
      if (target === 'text') cell.text = value
      else cell.label = value
      syncCellsFromGrid(doc.value.template)
    })
  }

  function gridMerge(range: GridRange): void {
    const grid = gridOf()
    if (!grid) return
    mutate(() => {
      const result = mergeGridCells(grid, range)
      if (!result.ok) {
        flash(result.reason ?? '无法合并')
        return
      }
      if (result.cell) selectedCellId.value = result.cell.id
      syncCellsFromGrid(doc.value.template)
    })
  }

  function gridSplit(cellId: string | null): void {
    if (!cellId) return
    const grid = gridOf()
    const cell = grid?.cells.find((item) => item.id === cellId)
    if (!cell) return
    if (cell.rowSpan === 1 && cell.colSpan === 1) {
      flash('该单元格不是合并单元格')
      return
    }
    withGrid((gridValue) => {
      splitGridCell(gridValue, cellId)
      selectedCellId.value = null
    }, '已拆分单元格')
  }

  function gridResizeColumn(index: number, size: number): void {
    const grid = gridOf()
    const track = grid?.columns[index]
    if (track) track.size = Math.max(2, Math.round(size * 10) / 10)
  }

  function gridResizeRow(index: number, size: number): void {
    const grid = gridOf()
    const track = grid?.rows[index]
    if (track) track.size = Math.max(2, Math.round(size * 10) / 10)
  }

  function gridEqualizeColumns(): void {
    withGrid((grid) => equalizeGridColumns(grid, doc.value.template.titleBlock.width), '已等宽列')
  }

  function gridEqualizeRows(): void {
    withGrid((grid) => equalizeGridRows(grid, doc.value.template.titleBlock.height), '已等高行')
  }

  function gridAutoFit(): void {
    const grid = gridOf()
    if (!grid) return
    const bodySize = doc.value.template.styles.textStyles.body?.fontSize ?? 5
    withGrid((gridValue) => {
      autoFitGridColumns(
        gridValue,
        doc.value.template.titleBlock.width,
        doc.value.values,
        doc.value.template.styles.fontFamily,
        bodySize,
      )
      autoFitGridRows(gridValue, doc.value.template.titleBlock.height, doc.value.values, bodySize)
    }, '已按内容自适应')
  }

  function gridNormalize(): void {
    withGrid(
      (grid) =>
        normalizeGrid(
          grid,
          doc.value.template.titleBlock.width,
          doc.value.template.titleBlock.height,
        ),
      '已归一化到图签尺寸',
    )
  }

  function findFreeSlot(grid: TitleBlockGrid): { row: number; col: number } | null {
    for (let row = 0; row < grid.rows.length; row += 1) {
      for (let col = 0; col < grid.columns.length; col += 1) {
        const occupied = grid.cells.some(
          (cell) =>
            row >= cell.row &&
            row < cell.row + cell.rowSpan &&
            col >= cell.col &&
            col < cell.col + cell.colSpan,
        )
        if (!occupied) return { row, col }
      }
    }
    return null
  }

  function addGridCell(): void {
    const grid = gridOf()
    if (!grid) return
    const slot = findFreeSlot(grid)
    if (!slot) {
      flash('没有空位，请先插入行列')
      return
    }
    mutate(() => {
      const cell: GridCell = {
        id: `cell-${Date.now().toString(36)}`,
        row: slot.row,
        col: slot.col,
        rowSpan: 1,
        colSpan: 1,
        label: '新单元格',
        textStyle: 'body',
        align: 'center',
        valign: 'middle',
        border: true,
      }
      grid.cells.push(cell)
      selectedCellId.value = cell.id
      syncCellsFromGrid(doc.value.template)
    })
  }

  function duplicateGridCell(current: TitleBlockCell): void {
    const grid = gridOf()
    if (!grid) return
    const slot = findFreeSlot(grid)
    if (!slot) {
      flash('没有空位，请先插入行列')
      return
    }
    mutate(() => {
      const source = grid.cells.find((cell) => cell.id === current.id)
      const clone: GridCell = {
        ...(source ?? {
          id: current.id,
          row: slot.row,
          col: slot.col,
          rowSpan: 1,
          colSpan: 1,
          label: current.label,
          field: current.field,
          text: current.text,
          textStyle: current.textStyle,
          align: current.align,
          valign: current.valign,
          border: current.border,
        }),
        id: `${current.id}-copy-${Date.now().toString(36)}`,
        row: slot.row,
        col: slot.col,
        rowSpan: 1,
        colSpan: 1,
      }
      grid.cells.push(clone)
      selectedCellId.value = clone.id
      syncCellsFromGrid(doc.value.template)
    })
  }

  function gridColumnLabel(index: number): string {
    let value = index + 1
    let label = ''
    while (value > 0) {
      const remainder = (value - 1) % 26
      label = String.fromCharCode(65 + remainder) + label
      value = Math.floor((value - 1) / 26)
    }
    return label
  }

  function convertToGrid(): void {
    if (isGridMode.value) return
    mutate(() => {
      migrateToGrid(doc.value.template)
      syncCellsFromGrid(doc.value.template)
      selectedCellId.value = null
      centerTab.value = 'grid'
      flash('已转换为网格模式')
    })
  }

  function setCenterTab(tab: 'grid' | 'preview'): void {
    if (tab === 'grid' && !isGridMode.value) {
      convertToGrid()
      return
    }
    centerTab.value = tab
  }

  return {
    withGrid,
    gridInsertRow,
    gridDeleteRow,
    gridInsertColumn,
    gridDeleteColumn,
    gridAddCellAt,
    gridUpdateField,
    gridUpdateCellText,
    gridMerge,
    gridSplit,
    gridResizeColumn,
    gridResizeRow,
    gridEqualizeColumns,
    gridEqualizeRows,
    gridAutoFit,
    gridNormalize,
    addGridCell,
    duplicateGridCell,
    gridColumnLabel,
    convertToGrid,
    setCenterTab,
  }
}
