<template>
  <div class="sheet-canvas" :style="{ width: `${zoom * 100}%` }">
    <svg
      ref="svgRef"
      :viewBox="viewBox"
      class="sheet-svg"
      role="img"
      aria-label="图框图签预览"
      @pointerdown="onCanvasPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <rect :x="0" :y="0" :width="layout.paper.w" :height="layout.paper.h" :fill="template.theme.paper" />

      <g v-if="showGrid" opacity="0.55" pointer-events="none">
        <line
          v-for="x in gridXs"
          :key="`gx-${x}`"
          :x1="x"
          :y1="0"
          :x2="x"
          :y2="layout.paper.h"
          :stroke="template.theme.grid"
          stroke-width="0.15"
        />
        <line
          v-for="y in gridYs"
          :key="`gy-${y}`"
          :x1="0"
          :y1="y"
          :x2="layout.paper.w"
          :y2="y"
          :stroke="template.theme.grid"
          stroke-width="0.15"
        />
      </g>

      <g id="sheet-guides">
        <rect
          v-for="(shape, index) in visibleShapes"
          :key="`shape-${index}`"
          :x="shape.x"
          :y="shape.y"
          :width="shape.w"
          :height="shape.h"
          :fill="shape.fill"
          :opacity="shape.opacity ?? 1"
          :data-semantic-id="shape.semanticId"
          :data-name="shape.name"
          :data-standard="shape.standard"
          :data-group="shape.group"
          :data-layer="shape.layer"
          :data-value="shapeValue(shape)"
          @pointerenter="onElementEnter($event, shape.semanticId, shape.name, shape.standard, shape.group, shape.layer, shapeValue(shape))"
          @pointermove="onElementMove"
          @pointerleave="scheduleHide"
        />
      </g>

      <g id="sheet-frame">
        <line
          v-for="(line, index) in visibleLines"
          :key="`line-${index}`"
          :x1="line.x1"
          :y1="line.y1"
          :x2="line.x2"
          :y2="line.y2"
          :stroke="line.color"
          :stroke-width="line.width"
          :stroke-dasharray="line.dash"
          stroke-linecap="square"
          :data-semantic-id="line.semanticId"
          :data-name="line.name"
          :data-standard="line.standard"
          :data-group="line.group"
          :data-layer="line.layer"
          :data-value="lineValue(line)"
          pointer-events="none"
        />
      </g>

      <!-- 细线命中层：让 0.3mm 的线也能 hover -->
      <g id="sheet-hit-lines">
        <line
          v-for="(line, index) in visibleLines"
          :key="`hit-${index}`"
          :x1="line.x1"
          :y1="line.y1"
          :x2="line.x2"
          :y2="line.y2"
          stroke="transparent"
          stroke-width="6"
          pointer-events="stroke"
          style="cursor: help"
          :data-semantic-id="line.semanticId"
          :data-name="line.name"
          :data-standard="line.standard"
          :data-group="line.group"
          :data-layer="line.layer"
          :data-value="lineValue(line)"
          @pointerenter="onElementEnter($event, line.semanticId, line.name, line.standard, line.group, line.layer, lineValue(line))"
          @pointermove="onElementMove"
          @pointerleave="scheduleHide"
        />
      </g>

      <!-- 单元格命中层放在文字下方，文字仍可单独 hover -->
      <g id="sheet-cells">
        <rect
          v-for="cell in layout.cells"
          :key="`hit-${cell.id}`"
          :x="cell.x"
          :y="cell.y"
          :width="cell.w"
          :height="cell.h"
          fill="transparent"
          stroke="transparent"
          :style="{ cursor: readonly ? 'pointer' : 'move' }"
          :data-semantic-id="`titleBlock.cell.${cell.id}`"
          data-name="单元格"
          data-standard="GB/T 10609.1-2008"
          data-group="titleBlock.cell"
          data-layer="title"
          :data-value="cellValue(cell)"
          @pointerdown.stop.prevent="onCellPointerDown($event, cell.id, 'move')"
          @pointerenter="onElementEnter($event, `titleBlock.cell.${cell.id}`, '单元格', 'GB/T 10609.1-2008', 'titleBlock.cell', 'title', cellValue(cell))"
          @pointermove="onElementMove"
          @pointerleave="scheduleHide"
        />
      </g>

      <g id="sheet-text">
        <text
          v-for="(text, index) in visibleTexts"
          :key="`text-${index}`"
          :x="text.x"
          :y="text.y"
          :font-size="text.fontSize"
          :fill="text.color"
          :text-anchor="text.anchor === 'left' ? 'start' : text.anchor === 'right' ? 'end' : 'middle'"
          :dominant-baseline="baselineAttr(text.baseline)"
          :font-weight="text.bold ? 700 : 400"
          :font-family="template.styles.fontFamily"
          :data-semantic-id="text.semanticId"
          :data-name="text.name"
          :data-standard="text.standard"
          :data-group="text.group"
          :data-layer="text.layer"
          :data-value="textValue(text)"
          style="cursor: help"
          @pointerenter="onElementEnter($event, text.semanticId, text.name, text.standard, text.group, text.layer, textValue(text))"
          @pointermove="onElementMove"
          @pointerleave="scheduleHide"
          @pointerdown.stop.prevent="onTextPointerDown($event, text)"
        >
          {{ text.text }}
        </text>
      </g>

      <g v-if="selectedCell" id="sheet-selection">
        <rect
          :x="selectedCell.x"
          :y="selectedCell.y"
          :width="selectedCell.w"
          :height="selectedCell.h"
          fill="none"
          :stroke="template.theme.accent"
          stroke-width="0.5"
          stroke-dasharray="2 1.2"
          pointer-events="none"
        />
        <rect
          v-if="!readonly"
          :x="selectedCell.x + selectedCell.w - 3"
          :y="selectedCell.y + selectedCell.h - 3"
          width="6"
          height="6"
          :fill="template.theme.accent"
          stroke="#fff"
          stroke-width="0.3"
          style="cursor: nwse-resize"
          @pointerdown.stop.prevent="onCellPointerDown($event, selectedCell.id, 'resize')"
        />
      </g>
    </svg>

    <div
      v-if="hovered && viewState.showTooltips && !hideTooltip"
      class="sheet-tooltip"
      :style="{ left: `${hovered.x + 14}px`, top: `${hovered.y + 14}px` }"
      @pointerenter="cancelHide"
      @pointerleave="scheduleHide"
    >
      <div class="tooltip-title">{{ hovered.name || '图元' }}</div>
      <div v-if="hovered.standard" class="tooltip-meta">{{ hovered.standard }}</div>
      <div v-if="hovered.value" class="tooltip-value">{{ hovered.value }}</div>
      <div class="tooltip-actions">
        <label v-if="hovered.group" class="tooltip-toggle">
          <input
            type="checkbox"
            :checked="groupVisible(hovered.group)"
            @change="onTooltipToggle"
          />
          显示此类
        </label>
        <button type="button" class="tooltip-btn" @click="closeTooltip">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  buildSheetLayout,
  type LayoutCell,
  type LayoutLine,
  type LayoutShape,
  type LayoutText,
  type SheetFieldValues,
  type SheetTemplate,
  type TextVAlign,
} from './sheetTemplate'
import { isGroupVisible, type ViewState } from './sheetView'

const props = defineProps<{
  template: SheetTemplate
  values: SheetFieldValues
  selectedCellId: string | null
  zoom: number
  showGrid: boolean
  snapStep: number
  viewState: ViewState
  readonly?: boolean
  cropToTitleBlock?: boolean
  hideTooltip?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-cell', id: string | null): void
  (e: 'begin-edit'): void
  (e: 'update-cell', id: string, patch: { x?: number; y?: number; w?: number; h?: number }): void
  (e: 'end-edit'): void
  (e: 'toggle-group', group: string, visible: boolean): void
}>()

interface HoverState {
  semanticId?: string
  name?: string
  standard?: string
  group?: string
  layer?: string
  value?: string
  x: number
  y: number
  pinned: boolean
}

const svgRef = ref<SVGSVGElement | null>(null)
const layout = computed(() => buildSheetLayout(props.template, props.values))
const selectedCell = computed(() =>
  layout.value.cells.find((cell) => cell.id === props.selectedCellId) ?? null,
)
const visibleShapes = computed(() => layout.value.shapes.filter((shape) => isGroupVisible(props.viewState, shape.group)))
const visibleLines = computed(() => layout.value.lines.filter((line) => isGroupVisible(props.viewState, line.group)))
const visibleTexts = computed(() => layout.value.texts.filter((text) => isGroupVisible(props.viewState, text.group)))
const viewBox = computed(() => {
  if (props.cropToTitleBlock) {
    const tb = layout.value.titleBlock
    const pad = 6
    return `${tb.x - pad} ${tb.y - pad} ${tb.w + pad * 2} ${tb.h + pad * 2}`
  }
  const pad = 10
  return `${-pad} ${-pad} ${layout.value.paper.w + pad * 2} ${layout.value.paper.h + pad * 2}`
})
const gridXs = computed(() => {
  const out: number[] = []
  for (let x = 10; x < layout.value.paper.w; x += 10) out.push(x)
  return out
})
const gridYs = computed(() => {
  const out: number[] = []
  for (let y = 10; y < layout.value.paper.h; y += 10) out.push(y)
  return out
})

const hovered = ref<HoverState | null>(null)
let hoverTimer: number | undefined
let hideTimer: number | undefined
let pinned = false

function baselineAttr(baseline: TextVAlign): string {
  if (baseline === 'top') return 'text-before-edge'
  if (baseline === 'bottom') return 'text-after-edge'
  return 'middle'
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function lineValue(line: LayoutLine): string {
  const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1)
  return `线宽 ${format(line.width)}mm · 长度 ${format(length)}mm`
}

function textValue(text: LayoutText): string {
  return `字高 ${format(text.fontSize)}mm · “${text.text}”`
}

function shapeValue(shape: LayoutShape): string {
  return `${format(shape.w)}×${format(shape.h)}mm`
}

function cellValue(cell: LayoutCell): string {
  const label = cell.label ? `标签：${cell.label}` : ''
  const field = cell.field ? `字段：${cell.field}` : ''
  return [label, field].filter(Boolean).join(' · ') || cell.id
}

function groupVisible(group: string | undefined): boolean {
  return isGroupVisible(props.viewState, group)
}

function onElementEnter(
  event: PointerEvent,
  semanticId?: string,
  name?: string,
  standard?: string,
  group?: string,
  layer?: string,
  value?: string,
): void {
  if (!props.viewState.showTooltips || props.hideTooltip) return
  window.clearTimeout(hideTimer)
  window.clearTimeout(hoverTimer)
  const x = event.clientX
  const y = event.clientY
  hoverTimer = window.setTimeout(() => {
    if (pinned) return
    hovered.value = { semanticId, name, standard, group, layer, value, x, y, pinned: false }
  }, 320)
}

function onElementMove(event: PointerEvent): void {
  if (!hovered.value || hovered.value.pinned) return
  hovered.value = { ...hovered.value, x: event.clientX, y: event.clientY }
}

function scheduleHide(): void {
  if (pinned) return
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => {
    if (!pinned) hovered.value = null
  }, 180)
}

function cancelHide(): void {
  window.clearTimeout(hideTimer)
}

function closeTooltip(): void {
  pinned = false
  hovered.value = null
}

function onToggleGroup(group: string, visible: boolean): void {
  emit('toggle-group', group, visible)
}

function onTooltipToggle(event: Event): void {
  const group = hovered.value?.group
  if (!group) return
  onToggleGroup(group, (event.target as HTMLInputElement).checked)
}

function onCanvasPointerDown(): void {
  if (!drag.value) {
    closeTooltip()
    emit('select-cell', null)
  }
}

function onTextPointerDown(event: PointerEvent, text: LayoutText): void {
  if (text.cellId) {
    onCellPointerDown(event, text.cellId, 'move')
  }
}

interface DragState {
  id: string
  mode: 'move' | 'resize'
  startX: number
  startY: number
  origX: number
  origY: number
  origW: number
  origH: number
}

const drag = ref<DragState | null>(null)

function toMm(event: PointerEvent): { x: number; y: number } {
  const svg = svgRef.value
  if (!svg) return { x: 0, y: 0 }
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const matrix = svg.getScreenCTM()
  if (!matrix) return { x: 0, y: 0 }
  const transformed = point.matrixTransform(matrix.inverse())
  return { x: transformed.x, y: transformed.y }
}

function snap(value: number): number {
  const step = Math.max(0.1, props.snapStep)
  return Math.round(value / step) * step
}

function onCellPointerDown(event: PointerEvent, id: string, mode: 'move' | 'resize'): void {
  closeTooltip()
  emit('select-cell', id)
  if (props.readonly) return
  const cell = layout.value.cells.find((item) => item.id === id)
  if (!cell) return
  emit('begin-edit')
  const point = toMm(event)
  drag.value = {
    id,
    mode,
    startX: point.x,
    startY: point.y,
    origX: cell.x,
    origY: cell.y,
    origW: cell.w,
    origH: cell.h,
  }
  const target = event.currentTarget as Element | null
  target?.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  const state = drag.value
  if (!state) return
  const point = toMm(event)
  const dx = point.x - state.startX
  const dy = point.y - state.startY
  if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return
  const tb = props.template.titleBlock
  if (state.mode === 'move') {
    const x = Math.min(Math.max(0, snap(state.origX + dx)), Math.max(0, tb.width - state.origW))
    const y = Math.min(Math.max(0, snap(state.origY + dy)), Math.max(0, tb.height - state.origH))
    emit('update-cell', state.id, { x, y })
  } else {
    const w = Math.min(Math.max(4, snap(state.origW + dx)), Math.max(4, tb.width - state.origX))
    const h = Math.min(Math.max(4, snap(state.origH + dy)), Math.max(4, tb.height - state.origY))
    emit('update-cell', state.id, { w, h })
  }
}

function onPointerUp(): void {
  if (!drag.value) return
  emit('end-edit')
  drag.value = null
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeTooltip()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.clearTimeout(hoverTimer)
  window.clearTimeout(hideTimer)
})
</script>

<style scoped>
.sheet-canvas {
  position: relative;
  margin: 0 auto;
  background: #fff;
  box-shadow: 0 10px 36px rgb(15 23 42 / 0.10);
  border: 1px solid var(--color-base-300, #d7dde3);
  border-radius: 4px;
  overflow: hidden;
  transition: width 0.15s ease;
}
.sheet-svg {
  display: block;
  width: 100%;
  height: auto;
  touch-action: none;
  user-select: none;
}
.sheet-tooltip {
  position: fixed;
  z-index: 60;
  min-width: 150px;
  max-width: 260px;
  padding: 9px 11px;
  border-radius: 8px;
  background: rgb(30 38 48 / 0.96);
  color: #f2f5f8;
  box-shadow: 0 10px 28px rgb(15 23 42 / 0.28);
  font-size: 11px;
  line-height: 1.5;
  pointer-events: auto;
}
.tooltip-title {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 2px;
}
.tooltip-meta {
  font-size: 10px;
  color: #9fb0c0;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
.tooltip-value {
  margin-top: 3px;
  color: #d7e0e8;
}
.tooltip-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 7px;
  padding-top: 6px;
  border-top: 1px solid rgb(255 255 255 / 0.12);
}
.tooltip-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: #c8d4df;
  cursor: pointer;
}
.tooltip-toggle input {
  accent-color: #4c9aff;
}
.tooltip-btn {
  appearance: none;
  border: 1px solid rgb(255 255 255 / 0.18);
  background: transparent;
  color: #d7e0e8;
  border-radius: 5px;
  padding: 2px 6px;
  font-size: 10px;
  cursor: pointer;
  font-family: inherit;
}
.tooltip-btn:hover {
  background: rgb(255 255 255 / 0.1);
}
</style>
