/**
 * 图框图签页的静态选项与展示辅助（从 SheetTemplatePage.vue 抽出）。
 *
 * 这里只放不依赖组件状态的东西：选项常量、模板缩略图、模板名称/描述。
 */
import {
  buildSheetLayout,
  createDefaultValues,
  createTemplate,
  FIELD_DEFINITIONS,
  paperDimensions,
  type Orientation,
  type PaperSize,
} from './sheetTemplate'
import { sheetToSvg } from './sheetSvg'

export const paperSizes = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'] as const

export const fontPresets = [
  {
    label: '微软雅黑 / 苹方',
    value: "'Microsoft YaHei', 'Noto Sans SC', 'PingFang SC', sans-serif",
  },
  { label: '宋体', value: "SimSun, 'Songti SC', serif" },
  { label: '黑体', value: "SimHei, 'Heiti SC', sans-serif" },
  { label: 'Noto Sans SC', value: "'Noto Sans SC', sans-serif" },
  { label: '思源黑体', value: "'Source Han Sans SC', sans-serif" },
] as const

export const templateKinds = ['gb', 'simple', 'minimal'] as const

export const guidedSteps = [
  { title: '图幅' },
  { title: '图签' },
  { title: '内容' },
  { title: '导出' },
] as const

export const alignOptions = [
  { value: 'left', label: '左' },
  { value: 'center', label: '中' },
  { value: 'right', label: '右' },
] as const

export const valignOptions = [
  { value: 'top', label: '上' },
  { value: 'middle', label: '中' },
  { value: 'bottom', label: '下' },
] as const

export const commonFields = FIELD_DEFINITIONS.filter((field) =>
  [
    'projectName',
    'drawingName',
    'drawingNo',
    'scale',
    'date',
    'designer',
    'checker',
    'company',
  ].includes(field.key),
)

/** 图签缩略图：裁切到图签区域，去掉 id 避免同页重复 */
export function templateThumbnail(kind: 'gb' | 'simple' | 'minimal'): string {
  const template = createTemplate(kind, 'A2', 'landscape')
  const values = createDefaultValues()
  const layout = buildSheetLayout(template, values)
  const tb = layout.titleBlock
  const pad = 4
  return sheetToSvg(template, values)
    .replace(
      /viewBox="[^"]*"/,
      `viewBox="${tb.x - pad} ${tb.y - pad} ${tb.w + pad * 2} ${tb.h + pad * 2}"`,
    )
    .replace(/ id="[^"]*"/g, '')
}

export function templateName(kind: 'gb' | 'simple' | 'minimal'): string {
  if (kind === 'gb') return '国标风格'
  if (kind === 'simple') return '简洁图签'
  return '极简图签'
}

export function templateDesc(kind: 'gb' | 'simple' | 'minimal'): string {
  if (kind === 'gb') return '更改区 / 签字区 / 名称及代号区，适合正式出图'
  if (kind === 'simple') return '工程名称、图名、图号、比例、设计、审核，适合项目图'
  return '只保留图名、图号、比例、日期，适合快速出图'
}

export function paperCardLabel(size: PaperSize, orientation: Orientation): string {
  const dims = paperDimensions(size, orientation)
  return `${dims.width}×${dims.height} mm`
}
