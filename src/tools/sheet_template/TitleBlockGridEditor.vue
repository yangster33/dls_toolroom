<template>
  <div class="grid-editor">
    <div class="grid-toolbar">
      <div class="toolbar-group">
        <span class="toolbar-label">行</span>
        <button type="button" class="mini-btn" @click="emit('insert-row', selection.row, 'above')">
          上方插入
        </button>
        <button
          type="button"
          class="mini-btn"
          @click="emit('insert-row', selection.row + selection.rowSpan, 'below')"
        >
          下方插入
        </button>
        <button
          type="button"
          class="mini-btn danger"
          :disabled="grid.rows.length <= 1"
          @click="emit('delete-row', selection.row)"
        >
          删除行
        </button>
      </div>
      <div class="toolbar-group">
        <span class="toolbar-label">列</span>
        <button
          type="button"
          class="mini-btn"
          @click="emit('insert-column', selection.col, 'left')"
        >
          左侧插入
        </button>
        <button
          type="button"
          class="mini-btn"
          @click="emit('insert-column', selection.col + selection.colSpan, 'right')"
        >
          右侧插入
        </button>
        <button
          type="button"
          class="mini-btn danger"
          :disabled="grid.columns.length <= 1"
          @click="emit('delete-column', selection.col)"
        >
          删除列
        </button>
      </div>
      <div class="toolbar-group">
        <button
          type="button"
          class="mini-btn"
          :disabled="!canMerge"
          title="Shift+点击或拖动选择多个单元格后合并"
          @click="emit('merge', selection)"
        >
          合并
        </button>
        <button
          type="button"
          class="mini-btn"
          :disabled="!canSplit"
          @click="emit('split', currentCellId)"
        >
          拆分
        </button>
      </div>
      <div class="toolbar-group">
        <button type="button" class="mini-btn" @click="emit('equalize-columns')">等宽列</button>
        <button type="button" class="mini-btn" @click="emit('equalize-rows')">等高行</button>
        <button type="button" class="mini-btn" @click="emit('auto-fit')">内容自适应</button>
        <button type="button" class="mini-btn" @click="emit('normalize')">归一化</button>
      </div>
      <div class="toolbar-group zoom-group">
        <button type="button" class="mini-btn" @click="setScale(scale - 1)">−</button>
        <span class="zoom-label">{{ Math.round(scale * 25) }}%</span>
        <button type="button" class="mini-btn" @click="setScale(scale + 1)">+</button>
      </div>
    </div>

    <div class="grid-scroll">
      <div
        ref="tableRef"
        class="grid-table"
        :style="gridStyle"
        tabindex="0"
        @pointerdown="onTablePointerDown"
        @keydown="onGridKeydown"
      >
        <div class="grid-corner" :style="{ gridColumn: 1, gridRow: 1 }"></div>

        <div
          v-for="(column, index) in grid.columns"
          :key="`col-${column.id}`"
          class="grid-col-header"
          :style="{ gridColumn: index + 2, gridRow: 1 }"
        >
          <span>{{ columnLabel(index) }}</span>
          <span
            class="resize-handle resize-col"
            title="拖动调整列宽"
            @pointerdown.stop.prevent="startResizeColumn($event, index)"
          ></span>
        </div>

        <div
          v-for="(row, index) in grid.rows"
          :key="`row-${row.id}`"
          class="grid-row-header"
          :style="{ gridColumn: 1, gridRow: index + 2 }"
        >
          <span>{{ index + 1 }}</span>
          <span
            class="resize-handle resize-row"
            title="拖动调整行高"
            @pointerdown.stop.prevent="startResizeRow($event, index)"
          ></span>
        </div>

        <div
          v-for="cell in sortedCells"
          :key="cell.id"
          class="grid-cell"
          :class="{ selected: isSelected(cell), merged: cell.rowSpan > 1 || cell.colSpan > 1 }"
          :style="cellStyle(cell)"
          :title="cellTitle(cell)"
          @pointerdown.stop.prevent="onCellDown($event, cell)"
          @pointerenter="onCellEnter(cell)"
          @dblclick.stop.prevent="startEdit(cell)"
        >
          <input
            v-if="editingCellId === cell.id"
            v-model="editingValue"
            class="cell-editor"
            @pointerdown.stop
            @click.stop
            @keydown.enter.prevent="commitEdit"
            @keydown.esc.prevent="cancelEdit"
            @blur="commitEdit"
          />
          <template v-else>
            <span v-if="cell.label" class="cell-label">{{ cell.label }}</span>
            <span v-if="cell.field || cell.text" class="cell-value">{{ cellValue(cell) }}</span>
          </template>
        </div>

        <div
          v-for="slot in emptySlots"
          :key="`empty-${slot.row}-${slot.col}`"
          class="grid-empty-slot"
          :style="{ gridColumn: slot.col + 2, gridRow: slot.row + 2 }"
          title="双击添加单元格"
          @dblclick.stop.prevent="emit('add-cell-at', slot.row, slot.col)"
        >
          <span>+</span>
        </div>

        <div class="grid-selection" :style="selectionStyle" pointer-events="none"></div>
      </div>
    </div>

    <div class="grid-footer">
      <span
        >已选 {{ selection.rowSpan }} 行 × {{ selection.colSpan }} 列 · 行
        {{ selection.row + 1 }}，列 {{ columnLabel(selection.col) }}</span
      >
      <span>Shift+点击或按住拖动选择多个单元格；拖动列标/行号右侧手柄调整宽高。</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { GridCell, GridRange, SheetFieldValues, SheetTemplate } from './sheetTemplate'

const props = defineProps<{
  template: SheetTemplate
  values: SheetFieldValues
  selectedCellId: string | null
}>()

const emit = defineEmits<{
  (e: 'select-cell', id: string | null): void
  (e: 'begin-edit'): void
  (e: 'end-edit'): void
  (e: 'insert-row', index: number, position: 'above' | 'below'): void
  (e: 'delete-row', index: number): void
  (e: 'insert-column', index: number, position: 'left' | 'right'): void
  (e: 'delete-column', index: number): void
  (e: 'merge', range: GridRange): void
  (e: 'split', cellId: string | null): void
  (e: 'resize-column', index: number, size: number): void
  (e: 'resize-row', index: number, size: number): void
  (e: 'equalize-columns'): void
  (e: 'equalize-rows'): void
  (e: 'auto-fit'): void
  (e: 'normalize'): void
  (e: 'add-cell-at', row: number, col: number): void
  (e: 'update-field', field: string, value: string): void
  (e: 'update-cell-text', cellId: string, value: string, target: 'label' | 'text'): void
}>()

const grid = computed(() => props.template.titleBlock.grid!)
const tableRef = ref<HTMLElement | null>(null)
const scale = ref(4)
const selection = ref<GridRange>({ row: 0, col: 0, rowSpan: 1, colSpan: 1 })
const anchor = ref<{ row: number; col: number } | null>(null)
const dragging = ref(false)
const editingCellId = ref<string | null>(null)
const editingValue = ref('')
const currentCellId = computed(() => {
  const cell = grid.value.cells.find((item) => item.id === props.selectedCellId)
  return cell?.id ?? null
})
const currentCell = computed(
  () => grid.value.cells.find((item) => item.id === props.selectedCellId) ?? null,
)
const canMerge = computed(() => {
  const range = selection.value
  if (range.rowSpan === 1 && range.colSpan === 1) return false
  const cell = currentCell.value
  if (
    cell &&
    cell.row === range.row &&
    cell.col === range.col &&
    cell.rowSpan === range.rowSpan &&
    cell.colSpan === range.colSpan
  ) {
    return false
  }
  return true
})
const canSplit = computed(() => {
  const cell = currentCell.value
  return Boolean(cell && (cell.rowSpan > 1 || cell.colSpan > 1))
})
const sortedCells = computed(() =>
  [...grid.value.cells].sort((a, b) => a.row - b.row || a.col - b.col),
)
const emptySlots = computed(() => {
  const slots: Array<{ row: number; col: number }> = []
  for (let row = 0; row < grid.value.rows.length; row += 1) {
    for (let col = 0; col < grid.value.columns.length; col += 1) {
      const occupied = grid.value.cells.some(
        (cell) =>
          row >= cell.row &&
          row < cell.row + cell.rowSpan &&
          col >= cell.col &&
          col < cell.col + cell.colSpan,
      )
      if (!occupied) slots.push({ row, col })
    }
  }
  return slots
})
const gridStyle = computed(() => ({
  gridTemplateColumns: `30px ${grid.value.columns.map((column) => `${Math.max(22, column.size * scale.value)}px`).join(' ')}`,
  gridTemplateRows: `26px ${grid.value.rows.map((row) => `${Math.max(22, row.size * scale.value)}px`).join(' ')}`,
}))
const selectionStyle = computed(() => ({
  gridColumn: `${selection.value.col + 2} / span ${selection.value.colSpan}`,
  gridRow: `${selection.value.row + 2} / span ${selection.value.rowSpan}`,
}))

watch(
  () => props.selectedCellId,
  (id) => {
    if (!id) return
    const cell = grid.value.cells.find((item) => item.id === id)
    if (!cell) return
    const current = selection.value
    const withinCurrent =
      cell.row >= current.row &&
      cell.row + cell.rowSpan <= current.row + current.rowSpan &&
      cell.col >= current.col &&
      cell.col + cell.colSpan <= current.col + current.colSpan
    if (withinCurrent && (current.rowSpan > 1 || current.colSpan > 1)) return
    selection.value = { row: cell.row, col: cell.col, rowSpan: cell.rowSpan, colSpan: cell.colSpan }
  },
  { immediate: true },
)

function setScale(next: number): void {
  scale.value = Math.min(8, Math.max(2, Math.round(next)))
}

function columnLabel(index: number): string {
  let value = index + 1
  let label = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    label = String.fromCharCode(65 + remainder) + label
    value = Math.floor((value - 1) / 26)
  }
  return label
}

function cellValue(cell: GridCell): string {
  if (cell.field) return props.values[cell.field] ?? ''
  return cell.text ?? ''
}

function cellTitle(cell: GridCell): string {
  const parts = [cell.label, cell.field ? `字段：${cell.field}` : '', cellValue(cell)].filter(
    Boolean,
  )
  return parts.join(' · ') || cell.id
}

function startEdit(cell: GridCell, initialValue?: string, selectAll = true): void {
  editingCellId.value = cell.id
  editingValue.value =
    initialValue ??
    (cell.field ? (props.values[cell.field] ?? '') : (cell.text ?? cell.label ?? ''))
  nextTick(() => {
    const input = document.querySelector('.cell-editor') as HTMLInputElement | null
    if (!input) return
    input.focus()
    if (selectAll) input.select()
    else input.setSelectionRange(input.value.length, input.value.length)
  })
}

function commitEdit(): void {
  const id = editingCellId.value
  if (!id) return
  const cell = grid.value.cells.find((item) => item.id === id)
  const value = editingValue.value
  editingCellId.value = null
  editingValue.value = ''
  if (!cell) return
  if (cell.field) {
    emit('update-field', cell.field, value)
  } else if (cell.text !== undefined) {
    emit('update-cell-text', id, value, 'text')
  } else {
    emit('update-cell-text', id, value, 'label')
  }
}

function cancelEdit(): void {
  editingCellId.value = null
  editingValue.value = ''
}

function cellStyle(cell: GridCell): Record<string, string> {
  return {
    gridColumn: `${cell.col + 2} / span ${cell.colSpan}`,
    gridRow: `${cell.row + 2} / span ${cell.rowSpan}`,
  }
}

function isSelected(cell: GridCell): boolean {
  const range = selection.value
  return (
    cell.row === range.row &&
    cell.col === range.col &&
    cell.rowSpan === range.rowSpan &&
    cell.colSpan === range.colSpan
  )
}

function selectCell(cell: GridCell): void {
  selection.value = { row: cell.row, col: cell.col, rowSpan: cell.rowSpan, colSpan: cell.colSpan }
  emit('select-cell', cell.id)
}

function onCellDown(event: PointerEvent, cell: GridCell): void {
  const extend = event.shiftKey || event.ctrlKey || event.metaKey
  if (extend && anchor.value) {
    const rowStart = Math.min(anchor.value.row, cell.row)
    const colStart = Math.min(anchor.value.col, cell.col)
    const rowEnd = Math.max(anchor.value.row + 1, cell.row + cell.rowSpan)
    const colEnd = Math.max(anchor.value.col + 1, cell.col + cell.colSpan)
    selection.value = {
      row: rowStart,
      col: colStart,
      rowSpan: rowEnd - rowStart,
      colSpan: colEnd - colStart,
    }
    tableRef.value?.focus()
    return
  }
  anchor.value = { row: cell.row, col: cell.col }
  dragging.value = true
  selectCell(cell)
  tableRef.value?.focus()
  window.addEventListener('pointerup', endDrag, { once: true })
}

function onCellEnter(cell: GridCell): void {
  if (!dragging.value || !anchor.value) return
  const rowStart = Math.min(anchor.value.row, cell.row)
  const colStart = Math.min(anchor.value.col, cell.col)
  const rowEnd = Math.max(anchor.value.row + 1, cell.row + cell.rowSpan)
  const colEnd = Math.max(anchor.value.col + 1, cell.col + cell.colSpan)
  selection.value = {
    row: rowStart,
    col: colStart,
    rowSpan: rowEnd - rowStart,
    colSpan: colEnd - colStart,
  }
}

function endDrag(): void {
  dragging.value = false
}

function findCellAt(row: number, col: number): GridCell | null {
  return (
    grid.value.cells.find(
      (cell) =>
        row >= cell.row &&
        row < cell.row + cell.rowSpan &&
        col >= cell.col &&
        col < cell.col + cell.colSpan,
    ) ?? null
  )
}

function moveSelection(deltaRow: number, deltaCol: number): void {
  const current = selection.value
  if (deltaRow !== 0) {
    let row = deltaRow > 0 ? current.row + current.rowSpan : current.row - 1
    while (row >= 0 && row < grid.value.rows.length) {
      const cell = findCellAt(row, current.col)
      if (cell) {
        selectCell(cell)
        return
      }
      row += deltaRow > 0 ? 1 : -1
    }
    return
  }
  let col = deltaCol > 0 ? current.col + current.colSpan : current.col - 1
  while (col >= 0 && col < grid.value.columns.length) {
    const cell = findCellAt(current.row, col)
    if (cell) {
      selectCell(cell)
      return
    }
    col += deltaCol > 0 ? 1 : -1
  }
}

function onGridKeydown(event: KeyboardEvent): void {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLSelectElement
  ) {
    return
  }
  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
    const cell = findCellAt(selection.value.row, selection.value.col)
    if (cell) {
      event.preventDefault()
      event.stopPropagation()
      startEdit(cell, event.key, false)
    }
    return
  }
  let deltaRow = 0
  let deltaCol = 0
  if (event.key === 'ArrowLeft') deltaCol = -1
  else if (event.key === 'ArrowRight') deltaCol = 1
  else if (event.key === 'ArrowUp') deltaRow = -1
  else if (event.key === 'ArrowDown') deltaRow = 1
  else return
  event.preventDefault()
  event.stopPropagation()
  moveSelection(deltaRow, deltaCol)
}

onBeforeUnmount(() => {
  window.removeEventListener('pointerup', endDrag)
})

function onTablePointerDown(): void {
  // 点击空白区域不清空选区，避免误操作
}

interface ResizeState {
  axis: 'col' | 'row'
  index: number
  start: number
  size: number
}

const resize = ref<ResizeState | null>(null)

function startResizeColumn(event: PointerEvent, index: number): void {
  const column = grid.value.columns[index]
  if (!column) return
  emit('begin-edit')
  resize.value = { axis: 'col', index, start: event.clientX, size: column.size }
  const target = event.currentTarget as Element | null
  target?.setPointerCapture?.(event.pointerId)
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeEnd, { once: true })
}

function startResizeRow(event: PointerEvent, index: number): void {
  const row = grid.value.rows[index]
  if (!row) return
  emit('begin-edit')
  resize.value = { axis: 'row', index, start: event.clientY, size: row.size }
  const target = event.currentTarget as Element | null
  target?.setPointerCapture?.(event.pointerId)
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeEnd, { once: true })
}

function onResizeMove(event: PointerEvent): void {
  const state = resize.value
  if (!state) return
  const delta = state.axis === 'col' ? event.clientX - state.start : event.clientY - state.start
  const size = Math.max(2, Math.round((state.size + delta / scale.value) * 10) / 10)
  if (state.axis === 'col') emit('resize-column', state.index, size)
  else emit('resize-row', state.index, size)
}

function onResizeEnd(): void {
  window.removeEventListener('pointermove', onResizeMove)
  if (resize.value) emit('end-edit')
  resize.value = null
}
</script>

<style scoped>
.grid-editor {
  display: flex;
  flex-direction: column;
  min-height: 520px;
  background: var(--color-base-100);
  color: var(--color-base-content);
  border: 1px solid var(--color-base-300);
  border-radius: var(--radius-box, 0.25rem);
  overflow: hidden;
}
.grid-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--color-base-300);
  background: var(--color-base-200);
}
.toolbar-group {
  display: flex;
  align-items: center;
  gap: 3px;
  padding-right: 8px;
  border-right: 1px solid var(--color-base-300);
}
.toolbar-group:last-child {
  border-right: 0;
}
.toolbar-label {
  font-size: 9px;
  color: var(--text-muted);
  margin-right: 2px;
}
.zoom-group {
  margin-left: auto;
}
.zoom-label {
  min-width: 34px;
  text-align: center;
  font-size: 9px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.mini-btn {
  appearance: none;
  border: 1px solid var(--color-base-300);
  background: var(--color-base-100);
  color: var(--color-base-content);
  border-radius: 5px;
  padding: 3px 6px;
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}
.mini-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.mini-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.mini-btn:disabled:hover {
  border-color: var(--color-base-300);
  color: var(--color-base-content);
}
.mini-btn.danger:hover {
  border-color: var(--color-error);
  color: var(--color-error);
}
.grid-scroll {
  flex: 1;
  overflow: auto;
  padding: 14px;
  background: var(--color-base-200);
}
.grid-table {
  position: relative;
  display: grid;
  width: max-content;
  min-width: 100%;
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  user-select: none;
  outline: none;
}
.grid-table:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.grid-corner {
  background: var(--color-base-200);
  border-right: 1px solid var(--color-base-300);
  border-bottom: 1px solid var(--color-base-300);
}
.grid-col-header,
.grid-row-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-base-200);
  color: var(--text-muted);
  font-size: 9px;
  font-family: var(--font-mono);
}
.grid-col-header {
  border-right: 1px solid var(--color-base-300);
  border-bottom: 1px solid var(--color-base-300);
}
.grid-row-header {
  border-right: 1px solid var(--color-base-300);
  border-bottom: 1px solid var(--color-base-300);
}
.resize-handle {
  position: absolute;
  z-index: 3;
}
.resize-col {
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
}
.resize-row {
  left: 0;
  bottom: -3px;
  width: 100%;
  height: 6px;
  cursor: row-resize;
}
.resize-handle:hover {
  background: color-mix(in oklab, var(--color-primary) 30%, transparent);
}
.grid-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-width: 0;
  min-height: 0;
  padding: 2px 3px;
  overflow: hidden;
  border-right: 1px solid var(--color-base-300);
  border-bottom: 1px solid var(--color-base-300);
  background: var(--color-base-100);
  color: var(--color-base-content);
  font-size: 9px;
  line-height: 1.25;
  cursor: pointer;
}
.grid-empty-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  color: transparent;
  border-right: 1px dashed transparent;
  border-bottom: 1px dashed transparent;
  cursor: cell;
}
.grid-empty-slot:hover {
  color: var(--color-primary);
  background: color-mix(in oklab, var(--color-primary) 8%, var(--color-base-100));
  border-right-color: color-mix(in oklab, var(--color-primary) 30%, var(--color-base-300));
  border-bottom-color: color-mix(in oklab, var(--color-primary) 30%, var(--color-base-300));
}
.grid-empty-slot span {
  font-size: 13px;
  font-weight: 300;
  line-height: 1;
}
.grid-cell:hover {
  background: color-mix(in oklab, var(--color-primary) 6%, var(--color-base-100));
}
.grid-cell.selected {
  background: color-mix(in oklab, var(--color-primary) 14%, var(--color-base-100));
}
.grid-cell.merged {
  background: color-mix(in oklab, var(--color-warning) 18%, var(--color-base-100));
}
.cell-label {
  font-size: 8px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.cell-value {
  font-size: 9px;
  color: var(--color-base-content);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.cell-editor {
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 20px;
  padding: 0 2px;
  border: 1px solid var(--color-primary);
  border-radius: 2px;
  background: var(--color-base-100);
  color: var(--color-base-content);
  font-family: inherit;
  font-size: 9px;
  outline: none;
  text-align: center;
}
.grid-selection {
  border: 2px solid var(--color-primary);
  background: color-mix(in oklab, var(--color-primary) 6%, transparent);
  pointer-events: none;
  z-index: 2;
}
.grid-footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 10px;
  border-top: 1px solid var(--color-base-300);
  background: var(--color-base-100);
  font-size: 9px;
  color: var(--text-muted);
}
</style>
