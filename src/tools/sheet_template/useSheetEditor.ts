/**
 * 图框图签页的编辑器状态与动作（从 SheetTemplatePage.vue 抽出）。
 *
 * 页面只保留模板；文档/历史/纸张/字体/字段/视图/快捷键/本地草稿都收在这里。
 * 网格编辑与导出分别拆到 useSheetGrid / useSheetExport。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  createDefaultDocument,
  createDefaultValues,
  createTemplate,
  defaultMargins,
  FIELD_DEFINITIONS,
  formatPaper,
  migrateToGrid,
  paperDimensions,
  recommendedFontSizes,
  resolveTitleBlockCells,
  snapToSeries,
  syncCellsFromGrid,
  validateTemplate,
  type GridCell,
  type Orientation,
  type PaperSize,
  type SheetDocument,
  type SheetTemplate,
  type TitleBlockCell,
} from './sheetTemplate'
import {
  createDefaultViewState,
  groupState,
  isGroupVisible,
  setGroupState,
  VIEW_TREE,
  type ViewGroup,
  type ViewState,
} from './sheetView'
import {
  alignOptions,
  commonFields,
  fontPresets,
  guidedSteps,
  paperCardLabel,
  paperSizes,
  templateDesc,
  templateKinds,
  templateName,
  templateThumbnail,
  valignOptions,
} from './sheetTemplateUi'
import { useSheetStatus } from './useSheetStatus'
import { useSheetGrid } from './useSheetGrid'
import { useSheetExport } from './useSheetExport'

const STORAGE_KEY = 'dls.sheet-template.v1'
const VIEW_STATE_KEY = 'dls.sheet-template.view.v1'
const UI_MODE_KEY = 'dls.sheet-template.ui-mode'
const WIZARD_STEP_KEY = 'dls.sheet-template.wizard-step'
const DXF_SETTINGS_KEY = 'dls.sheet-template.dxf-settings'

export function useSheetEditor() {
  const { status, flash, dispose: disposeStatus } = useSheetStatus()

  const doc = ref<SheetDocument>(createDefaultDocument('gb'))
  const activeTemplateKind = ref<'gb' | 'simple' | 'minimal'>('gb')
  const selectedCellId = ref<string | null>(null)
  const zoom = ref(1)
  const snapEnabled = ref(true)
  const snapStep = ref(1)
  const history = ref<SheetDocument[]>([])
  const future = ref<SheetDocument[]>([])
  const dragSnapshot = ref<SheetDocument | null>(null)
  const canvasScrollRef = ref<HTMLDivElement | null>(null)
  const viewState = ref<ViewState>(createDefaultViewState())
  const centerTab = ref<'grid' | 'preview'>('grid')
  const uiMode = ref<'guided' | 'advanced'>('guided')
  const wizardStep = ref(0)
  const showHelp = ref(false)
  const focusMode = ref(false)
  const fontCustom = ref(false)
  const newFieldLabel = ref('')
  const newFieldKey = ref('')
  const draftNotice = ref<{ errors: number; warnings: number } | null>(null)
  const brokenDraft = ref<SheetDocument | null>(null)
  let saveTimer: number | undefined
  let viewSaveTimer: number | undefined

  const issues = computed(() => validateTemplate(doc.value.template, doc.value.values))
  const errorCount = computed(
    () => issues.value.filter((issue) => issue.severity === 'error').length,
  )
  const warningCount = computed(
    () => issues.value.filter((issue) => issue.severity === 'warning').length,
  )
  const titleBlockCells = computed(() => resolveTitleBlockCells(doc.value.template))
  const isGridMode = computed(
    () =>
      doc.value.template.titleBlock.layoutMode === 'grid' &&
      Boolean(doc.value.template.titleBlock.grid),
  )
  const selectedCell = computed<TitleBlockCell | null>(
    () => titleBlockCells.value.find((cell) => cell.id === selectedCellId.value) ?? null,
  )
  const selectedGridCell = computed<GridCell | null>(
    () =>
      doc.value.template.titleBlock.grid?.cells.find((cell) => cell.id === selectedCellId.value) ??
      null,
  )
  const editCell = computed<GridCell | TitleBlockCell | null>(
    () => selectedGridCell.value ?? selectedCell.value,
  )
  const absoluteCell = computed<TitleBlockCell>(
    () => selectedCell.value ?? { id: '', x: 0, y: 0, w: 0, h: 0 },
  )
  const paperLabel = computed(() =>
    formatPaper(
      doc.value.template.paper.size,
      doc.value.template.paper.orientation,
      doc.value.template.paper.width,
      doc.value.template.paper.height,
    ),
  )
  const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`)
  const textStyleKeys = computed(() => Object.keys(doc.value.template.styles.textStyles))
  const customFields = computed(() => doc.value.customFields ?? [])
  const fieldDefinitions = computed(() => [...FIELD_DEFINITIONS, ...customFields.value])
  const fontPreset = computed(() => {
    if (fontCustom.value) return 'custom'
    return (
      fontPresets.find((preset) => preset.value === doc.value.template.styles.fontFamily)?.value ??
      'custom'
    )
  })
  const viewTree = VIEW_TREE
  const fontRows = computed(() => [
    { key: 'title', label: '标题', style: doc.value.template.styles.textStyles.title! },
    { key: 'body', label: '正文', style: doc.value.template.styles.textStyles.body! },
    { key: 'note', label: '注释', style: doc.value.template.styles.textStyles.note! },
    { key: 'label', label: '标签', style: doc.value.template.styles.textStyles.label! },
  ])
  const templateThumbs = computed<Record<'gb' | 'simple' | 'minimal', string>>(() => ({
    gb: templateThumbnail('gb'),
    simple: templateThumbnail('simple'),
    minimal: templateThumbnail('minimal'),
  }))

  function snapshot(): SheetDocument {
    return JSON.parse(JSON.stringify(doc.value)) as SheetDocument
  }

  function mutate(fn: () => void): void {
    history.value.push(snapshot())
    if (history.value.length > 60) history.value.shift()
    future.value = []
    fn()
  }

  function setUiMode(mode: 'guided' | 'advanced'): void {
    uiMode.value = mode
    if (mode === 'guided') {
      wizardStep.value = 2
      focusMode.value = false
    }
  }

  function setFontPreset(event: Event): void {
    const value = (event.target as HTMLSelectElement).value
    if (value === 'custom') {
      fontCustom.value = true
    } else {
      fontCustom.value = false
      doc.value.template.styles.fontFamily = value
    }
  }

  function addCustomField(): void {
    const label = newFieldLabel.value.trim()
    const key = newFieldKey.value.trim() || `custom${customFields.value.length + 1}`
    if (!label) {
      flash('请填写字段名称')
      return
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      flash('字段键只能使用字母、数字、下划线，且不能以数字开头')
      return
    }
    if (fieldDefinitions.value.some((field) => field.key === key)) {
      flash('字段键已存在，请换一个')
      return
    }
    mutate(() => {
      doc.value.customFields = [...customFields.value, { key, label }]
      if (doc.value.values[key] === undefined) doc.value.values[key] = ''
    })
    newFieldLabel.value = ''
    newFieldKey.value = ''
    flash(`已添加自定义字段：${label}`)
  }

  function removeCustomField(key: string): void {
    const label = fieldLabel(key)
    mutate(() => {
      doc.value.customFields = customFields.value.filter((field) => field.key !== key)
      delete doc.value.values[key]
      const grid = doc.value.template.titleBlock.grid
      if (grid) {
        for (const cell of grid.cells) {
          if (cell.field === key) cell.field = undefined
        }
      }
      for (const cell of doc.value.template.titleBlock.cells) {
        if (cell.field === key) cell.field = undefined
      }
      syncCellsFromGrid(doc.value.template)
    })
    flash(`已删除自定义字段：${label}`)
  }

  function setCellFontSize(event: Event): void {
    const cell = editCell.value
    if (!cell) return
    const raw = (event.target as HTMLInputElement).value.trim()
    const value = Number(raw)
    mutate(() => {
      if (!raw || !Number.isFinite(value) || value <= 0) delete cell.fontSize
      else cell.fontSize = value
      syncCellsFromGrid(doc.value.template)
    })
  }

  function setCellBold(event: Event): void {
    const cell = editCell.value
    if (!cell) return
    const value = (event.target as HTMLSelectElement).value
    mutate(() => {
      if (value === '') delete cell.bold
      else cell.bold = value === '1'
      syncCellsFromGrid(doc.value.template)
    })
  }

  function nextStep(): void {
    wizardStep.value = Math.min(3, wizardStep.value + 1)
  }

  function prevStep(): void {
    wizardStep.value = Math.max(0, wizardStep.value - 1)
  }

  function fieldLabel(key?: string): string {
    if (!key) return ''
    return fieldDefinitions.value.find((field) => field.key === key)?.label ?? key
  }

  function updateGuidedText(event: Event): void {
    const cell = editCell.value
    if (!cell) return
    const value = (event.target as HTMLInputElement).value
    if (cell.text !== undefined) cell.text = value
    else cell.label = value
  }

  function fillSampleData(): void {
    mutate(() => {
      doc.value.values = createDefaultValues()
    })
    flash('已填入示例数据')
  }

  function finishGuided(): void {
    uiMode.value = 'advanced'
    flash('已完成，已切换到专业模式，可继续调整结构')
  }

  function setPaper(size: PaperSize): void {
    mutate(() => {
      const orientation = doc.value.template.paper.orientation
      const dims = paperDimensions(size, orientation)
      doc.value.template.paper = { size, orientation, width: dims.width, height: dims.height }
      doc.value.template.margins = defaultMargins(
        size,
        doc.value.template.bindingEdge,
        doc.value.template.margins.binding,
      )
      applyRecommendedFontsInternal()
    })
  }

  function setOrientation(orientation: Orientation): void {
    mutate(() => {
      const t = doc.value.template
      const dims = paperDimensions(t.paper.size, orientation)
      t.paper.orientation = orientation
      t.paper.width = dims.width
      t.paper.height = dims.height
      t.margins = defaultMargins(t.paper.size, t.bindingEdge, t.margins.binding)
    })
  }

  function setBindingEdge(edge: 'left' | 'right'): void {
    mutate(() => {
      const t = doc.value.template
      t.bindingEdge = edge
      t.margins = defaultMargins(t.paper.size, edge, t.margins.binding)
    })
  }

  function applyBindingMargins(): void {
    mutate(() => {
      const t = doc.value.template
      t.margins = defaultMargins(t.paper.size, t.bindingEdge, t.margins.binding)
    })
  }

  function applyRecommendedFontsInternal(): void {
    const f = recommendedFontSizes(doc.value.template.paper.size)
    const styles = doc.value.template.styles.textStyles
    styles.title = { ...styles.title!, fontSize: f.title }
    styles.body = { ...styles.body!, fontSize: f.body }
    styles.note = { ...styles.note!, fontSize: f.note }
    styles.label = { ...styles.label!, fontSize: f.note }
  }

  function ensureTextStyles(template: SheetTemplate): void {
    const f = recommendedFontSizes(template.paper.size)
    const defaults: Record<string, number> = {
      title: f.title,
      body: f.body,
      note: f.note,
      label: f.note,
    }
    for (const [key, fontSize] of Object.entries(defaults)) {
      if (!template.styles.textStyles[key]) {
        template.styles.textStyles[key] = {
          fontSize,
          lineHeight: 1.2,
          bold: key === 'title',
          widthFactor: 1,
        }
      }
    }
  }

  function applyRecommendedFonts(): void {
    mutate(() => {
      applyRecommendedFontsInternal()
      flash('已按图幅应用推荐字高')
    })
  }

  function snapFont(key: string): void {
    mutate(() => {
      const style = doc.value.template.styles.textStyles[key]
      if (style) style.fontSize = snapToSeries(style.fontSize)
    })
  }

  function setTemplateKind(kind: 'gb' | 'simple' | 'minimal'): void {
    mutate(() => {
      const current = doc.value.template
      const next = createTemplate(kind, current.paper.size, current.paper.orientation)
      next.paper = { ...current.paper }
      next.margins = { ...current.margins }
      next.bindingEdge = current.bindingEdge
      next.frame = { ...current.frame }
      next.styles = { ...current.styles }
      next.theme = { ...current.theme }
      doc.value.template = next
      activeTemplateKind.value = kind
      selectedCellId.value = null
    })
  }

  function onCanvasUpdateCell(
    id: string,
    patch: { x?: number; y?: number; w?: number; h?: number },
  ): void {
    if (isGridMode.value) return
    const cell = doc.value.template.titleBlock.cells.find((item) => item.id === id)
    if (!cell) return
    Object.assign(cell, patch)
  }

  function onBeginEdit(): void {
    dragSnapshot.value = snapshot()
  }

  function onEndEdit(): void {
    const before = dragSnapshot.value
    dragSnapshot.value = null
    if (!before) return
    if (JSON.stringify(before) === JSON.stringify(doc.value)) return
    history.value.push(before)
    if (history.value.length > 60) history.value.shift()
    future.value = []
  }

  function undo(): void {
    const previous = history.value.pop()
    if (!previous) return
    future.value.push(snapshot())
    doc.value = previous
    selectedCellId.value = null
    flash('已撤销')
  }

  function redo(): void {
    const next = future.value.pop()
    if (!next) return
    history.value.push(snapshot())
    doc.value = next
    selectedCellId.value = null
    flash('已重做')
  }

  function reset(): void {
    mutate(() => {
      doc.value = createDefaultDocument(activeTemplateKind.value)
      selectedCellId.value = resolveTitleBlockCells(doc.value.template)[0]?.id ?? null
      draftNotice.value = null
      brokenDraft.value = null
      zoom.value = 1
      flash('已恢复默认模板')
    })
  }

  function restoreDraft(): void {
    const draft = brokenDraft.value
    if (!draft) return
    ensureTextStyles(draft.template)
    migrateToGrid(draft.template)
    syncCellsFromGrid(draft.template)
    doc.value = draft
    selectedCellId.value = resolveTitleBlockCells(draft.template)[0]?.id ?? null
    draftNotice.value = null
    brokenDraft.value = null
    centerTab.value = 'grid'
    flash('已恢复上次草稿，请处理校验问题')
  }

  function dismissDraft(): void {
    draftNotice.value = null
    brokenDraft.value = null
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* 忽略 */
    }
    flash('已忽略上次草稿')
  }

  function nudge(dx: number, dy: number): void {
    if (isGridMode.value) {
      flash('网格模式下请用行列工具调整')
      return
    }
    const cell = selectedCell.value
    if (!cell) return
    mutate(() => {
      const tb = doc.value.template.titleBlock
      cell.x = Math.min(Math.max(0, cell.x + dx), Math.max(0, tb.width - cell.w))
      cell.y = Math.min(Math.max(0, cell.y + dy), Math.max(0, tb.height - cell.h))
    })
  }

  function isViewVisible(id: string): boolean {
    if (id === 'grid') return viewState.value.showGrid
    if (id === 'tooltip') return viewState.value.showTooltips
    return isGroupVisible(viewState.value, id)
  }

  function toggleView(id: string, visible: boolean): void {
    if (id === 'grid') {
      viewState.value.showGrid = visible
      viewState.value.groups.grid = visible
      return
    }
    if (id === 'tooltip') {
      viewState.value.showTooltips = visible
      viewState.value.groups.tooltip = visible
      return
    }
    viewState.value.groups[id] = visible
  }

  function onViewCheck(id: string, event: Event): void {
    toggleView(id, (event.target as HTMLInputElement).checked)
  }

  function onBorderChange(event: Event): void {
    if (!editCell.value) return
    editCell.value.border = (event.target as HTMLInputElement).checked
  }

  function toggleParent(group: ViewGroup, visible: boolean): void {
    setGroupState(viewState.value, group, visible)
    viewState.value.showGrid = viewState.value.groups.grid !== false
    viewState.value.showTooltips = viewState.value.groups.tooltip !== false
  }

  function setAllView(visible: boolean): void {
    for (const group of viewTree) setGroupState(viewState.value, group, visible)
    viewState.value.showGrid = visible
    viewState.value.showTooltips = visible
  }

  function viewGroupState(group: ViewGroup): 'all' | 'some' | 'none' {
    return groupState(viewState.value, group)
  }

  function viewGroupStateLabel(group: ViewGroup): string {
    const state = viewGroupState(group)
    return state === 'all' ? '全显' : state === 'none' ? '全隐' : '部分'
  }

  const grid = useSheetGrid({
    doc,
    selectedCellId,
    selectedGridCell,
    isGridMode,
    centerTab,
    mutate,
    flash,
  })

  function addCell(): void {
    if (isGridMode.value) {
      grid.addGridCell()
      return
    }
    mutate(() => {
      const cells = doc.value.template.titleBlock.cells
      const id = `cell-${Date.now().toString(36)}`
      const cell: TitleBlockCell = {
        id,
        label: '新单元格',
        x: 0,
        y: 0,
        w: 40,
        h: 10,
        textStyle: 'body',
        align: 'center',
        valign: 'middle',
        border: true,
      }
      cells.push(cell)
      selectedCellId.value = id
    })
  }

  function deleteCell(): void {
    const id = selectedCellId.value
    if (!id) return
    if (isGridMode.value) {
      grid.withGrid((gridValue) => {
        gridValue.cells = gridValue.cells.filter((cell) => cell.id !== id)
        selectedCellId.value = null
      }, '已删除单元格')
      return
    }
    mutate(() => {
      const cells = doc.value.template.titleBlock.cells
      const index = cells.findIndex((cell) => cell.id === id)
      if (index >= 0) cells.splice(index, 1)
      selectedCellId.value = null
    })
  }

  function duplicateCell(): void {
    const current = selectedCell.value
    if (!current) return
    if (isGridMode.value) {
      grid.duplicateGridCell(current)
      return
    }
    mutate(() => {
      const cells = doc.value.template.titleBlock.cells
      const clone: TitleBlockCell = {
        ...current,
        id: `${current.id}-copy-${Date.now().toString(36)}`,
        x: current.x + 2,
        y: current.y + 2,
      }
      cells.push(clone)
      selectedCellId.value = clone.id
    })
  }

  function setZoom(next: number): void {
    zoom.value = Math.min(2.5, Math.max(0.5, Math.round(next * 100) / 100))
  }

  function focusTitleBlock(): void {
    zoom.value = 2.2
    nextTick(() => {
      window.setTimeout(() => {
        const element = canvasScrollRef.value
        if (!element) return
        element.scrollTo({
          left: element.scrollWidth,
          top: element.scrollHeight,
          behavior: 'smooth',
        })
      }, 240)
    })
  }

  const exporter = useSheetExport({
    doc,
    viewState,
    activeTemplateKind,
    selectedCellId,
    centerTab,
    snapshot,
    mutate,
    flash,
    ensureTextStyles,
  })

  function onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault()
      redo()
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selectedCell.value) {
        event.preventDefault()
        deleteCell()
      }
      return
    }
    const step = event.shiftKey ? 5 : 1
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      nudge(-step, 0)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      nudge(step, 0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      nudge(0, -step)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      nudge(0, step)
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as SheetDocument
        if (parsed?.schemaVersion === 1 && parsed.template && parsed.values) {
          ensureTextStyles(parsed.template)
          migrateToGrid(parsed.template)
          syncCellsFromGrid(parsed.template)
          const savedIssues = validateTemplate(parsed.template, parsed.values)
          const savedErrors = savedIssues.filter((issue) => issue.severity === 'error').length
          const savedWarnings = savedIssues.filter((issue) => issue.severity === 'warning').length
          if (savedErrors > 0) {
            brokenDraft.value = parsed
            draftNotice.value = { errors: savedErrors, warnings: savedWarnings }
          } else {
            doc.value = parsed
          }
        }
      }
      const rawView = window.localStorage.getItem(VIEW_STATE_KEY)
      if (rawView) {
        const parsedView = JSON.parse(rawView) as ViewState
        if (parsedView?.groups) {
          const defaults = createDefaultViewState()
          viewState.value = {
            ...defaults,
            ...parsedView,
            groups: { ...defaults.groups, ...parsedView.groups },
          }
        }
      }
      const savedMode = window.localStorage.getItem(UI_MODE_KEY)
      if (savedMode === 'guided' || savedMode === 'advanced') {
        uiMode.value = savedMode
      } else {
        showHelp.value = true
      }
      const savedStep = Number(window.localStorage.getItem(WIZARD_STEP_KEY))
      if (Number.isFinite(savedStep)) {
        wizardStep.value = Math.max(0, Math.min(3, Math.round(savedStep)))
        if (wizardStep.value > 0) showHelp.value = false
      }
      const rawDxfSettings = window.localStorage.getItem(DXF_SETTINGS_KEY)
      if (rawDxfSettings) {
        const parsed = JSON.parse(rawDxfSettings) as { calibrate?: boolean; textScale?: number }
        if (typeof parsed.calibrate === 'boolean') exporter.dxfCalibrate.value = parsed.calibrate
        if (typeof parsed.textScale === 'number' && parsed.textScale > 0) {
          exporter.dxfTextScale.value = parsed.textScale
        }
      }
    } catch {
      /* localStorage 不可用时忽略 */
    }
    if (!selectedCellId.value) {
      const first = resolveTitleBlockCells(doc.value.template)[0]
      if (first) selectedCellId.value = first.id
    }
  })

  watch(
    doc,
    () => {
      window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => {
        try {
          const data = snapshot()
          syncCellsFromGrid(data.template)
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        } catch {
          /* 隐私模式/配额不足时忽略 */
        }
      }, 250)
    },
    { deep: true },
  )

  watch(
    viewState,
    () => {
      window.clearTimeout(viewSaveTimer)
      viewSaveTimer = window.setTimeout(() => {
        try {
          window.localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(viewState.value))
        } catch {
          /* 忽略 */
        }
      }, 250)
    },
    { deep: true },
  )

  watch([uiMode, wizardStep], ([, step]) => {
    if (step > 0) showHelp.value = false
    try {
      window.localStorage.setItem(UI_MODE_KEY, uiMode.value)
      window.localStorage.setItem(WIZARD_STEP_KEY, String(wizardStep.value))
    } catch {
      /* 忽略 */
    }
  })

  watch([exporter.dxfCalibrate, exporter.dxfTextScale], () => {
    try {
      window.localStorage.setItem(
        DXF_SETTINGS_KEY,
        JSON.stringify({
          calibrate: exporter.dxfCalibrate.value,
          textScale: exporter.dxfTextScale.value,
        }),
      )
    } catch {
      /* 忽略 */
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    disposeStatus()
    window.clearTimeout(saveTimer)
    window.clearTimeout(viewSaveTimer)
  })

  return {
    status,
    flash,
    doc,
    activeTemplateKind,
    selectedCellId,
    zoom,
    snapEnabled,
    snapStep,
    history,
    future,
    dragSnapshot,
    canvasScrollRef,
    viewState,
    centerTab,
    uiMode,
    wizardStep,
    showHelp,
    focusMode,
    fontCustom,
    newFieldLabel,
    newFieldKey,
    draftNotice,
    brokenDraft,
    issues,
    errorCount,
    warningCount,
    titleBlockCells,
    isGridMode,
    selectedCell,
    selectedGridCell,
    editCell,
    absoluteCell,
    paperLabel,
    zoomLabel,
    textStyleKeys,
    customFields,
    fieldDefinitions,
    fontPreset,
    viewTree,
    fontRows,
    templateThumbs,
    commonFields,
    paperSizes,
    fontPresets,
    templateKinds,
    guidedSteps,
    alignOptions,
    valignOptions,
    paperCardLabel: (size: PaperSize) => paperCardLabel(size, doc.value.template.paper.orientation),
    templateName,
    templateDesc,
    setUiMode,
    setFontPreset,
    addCustomField,
    removeCustomField,
    setCellFontSize,
    setCellBold,
    nextStep,
    prevStep,
    fieldLabel,
    updateGuidedText,
    fillSampleData,
    finishGuided,
    setPaper,
    setOrientation,
    setBindingEdge,
    applyBindingMargins,
    applyRecommendedFonts,
    snapFont,
    setTemplateKind,
    onCanvasUpdateCell,
    onBeginEdit,
    onEndEdit,
    undo,
    redo,
    reset,
    restoreDraft,
    dismissDraft,
    nudge,
    isViewVisible,
    toggleView,
    onViewCheck,
    onBorderChange,
    toggleParent,
    setAllView,
    viewGroupState,
    viewGroupStateLabel,
    addCell,
    deleteCell,
    duplicateCell,
    setZoom,
    focusTitleBlock,
    ...grid,
    ...exporter,
  }
}
