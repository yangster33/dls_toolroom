/**
 * 图框图签页的导出 / 导入（从 SheetTemplatePage.vue 抽出）。
 */
import { ref, type Ref } from 'vue'
import type { ValidateFunction } from 'ajv'
import { downloadBlob } from '@/utils/download'
import {
  migrateToGrid,
  syncCellsFromGrid,
  type SheetDocument,
  type SheetTemplate,
} from './sheetTemplate'
import type { ViewState } from './sheetView'
import { sheetToSvg } from './sheetSvg'
import { SHEET_TEMPLATE_SCHEMA, sheetTemplateSchemaJson } from './sheetTemplateSchema'

export interface SheetExportOptions {
  doc: Ref<SheetDocument>
  viewState: Ref<ViewState>
  activeTemplateKind: Ref<'gb' | 'simple' | 'minimal'>
  selectedCellId: Ref<string | null>
  centerTab: Ref<'grid' | 'preview'>
  snapshot: () => SheetDocument
  mutate: (fn: () => void) => void
  flash: (message: string) => void
  ensureTextStyles: (template: SheetTemplate) => void
}

let validateDocumentSchema: ValidateFunction | null = null

async function getDocumentValidator(): Promise<ValidateFunction> {
  if (validateDocumentSchema) return validateDocumentSchema
  const { default: Ajv2020 } = await import('ajv/dist/2020')
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  validateDocumentSchema = ajv.compile(SHEET_TEMPLATE_SCHEMA as object)
  return validateDocumentSchema
}

export function useSheetExport(options: SheetExportOptions) {
  const {
    doc,
    viewState,
    activeTemplateKind,
    selectedCellId,
    centerTab,
    snapshot,
    mutate,
    flash,
    ensureTextStyles,
  } = options

  const fileInputRef = ref<HTMLInputElement | null>(null)
  const dxfCalibrate = ref(true)
  const dxfTextScale = ref(1)

  async function exportPng(): Promise<void> {
    try {
      const svg = sheetToSvg(doc.value.template, doc.value.values, { viewState: viewState.value })
      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('SVG 渲染失败'))
        image.src = url
      })
      const scale = 4
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(doc.value.template.paper.width * scale)
      canvas.height = Math.round(doc.value.template.paper.height * scale)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('无法创建画布')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('PNG 生成失败')
      downloadBlob(
        blob,
        `sheet-${doc.value.template.paper.size}-${doc.value.template.paper.orientation}.png`,
      )
      flash('PNG 已导出')
    } catch (error) {
      flash(`PNG 导出失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  function exportJson(): void {
    const data = snapshot()
    syncCellsFromGrid(data.template)
    data.exportedAt = new Date().toISOString()
    downloadBlob(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }),
      `sheet-${doc.value.template.paper.size}-${doc.value.template.paper.orientation}.json`,
    )
    flash('JSON 已导出')
  }

  function exportSchema(): void {
    downloadBlob(
      new Blob([sheetTemplateSchemaJson()], { type: 'application/schema+json;charset=utf-8' }),
      'sheet-template.schema.json',
    )
    flash('JSON Schema 已导出')
  }

  function exportSvg(): void {
    const svg = sheetToSvg(doc.value.template, doc.value.values, { viewState: viewState.value })
    downloadBlob(
      new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
      `sheet-${doc.value.template.paper.size}-${doc.value.template.paper.orientation}.svg`,
    )
    flash('SVG 已导出')
  }

  async function exportDxf(): Promise<void> {
    try {
      const { sheetToDxf } = await import('./sheetDxf')
      const dxf = sheetToDxf(doc.value.template, doc.value.values, {
        viewState: viewState.value,
        textScale: dxfTextScale.value,
        calibrateTextHeight: dxfCalibrate.value,
      })
      downloadBlob(
        new Blob([dxf], { type: 'application/dxf;charset=utf-8' }),
        `sheet-${doc.value.template.paper.size}-${doc.value.template.paper.orientation}.dxf`,
      )
      flash('DXF 已导出')
    } catch (error) {
      flash(`DXF 导出失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  function triggerImport(): void {
    fileInputRef.value?.click()
  }

  async function onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const validator = await getDocumentValidator()
      if (!validator(parsed)) {
        const messages = (validator.errors ?? [])
          .map((error) => `${error.instancePath || '/'} ${error.message ?? ''}`.trim())
          .slice(0, 4)
          .join('；')
        flash(`JSON Schema 校验失败：${messages}`)
        return
      }
      const imported = parsed as SheetDocument
      ensureTextStyles(imported.template)
      migrateToGrid(imported.template)
      syncCellsFromGrid(imported.template)
      mutate(() => {
        doc.value = imported
        selectedCellId.value = null
        centerTab.value = 'grid'
        activeTemplateKind.value = imported.template.id.startsWith('simple')
          ? 'simple'
          : imported.template.id.startsWith('minimal')
            ? 'minimal'
            : 'gb'
      })
      flash('JSON 已导入并通过 Schema 校验')
    } catch (error) {
      flash(`导入失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      input.value = ''
    }
  }

  return {
    fileInputRef,
    dxfCalibrate,
    dxfTextScale,
    exportPng,
    exportJson,
    exportSchema,
    exportSvg,
    exportDxf,
    triggerImport,
    onImportFile,
  }
}
