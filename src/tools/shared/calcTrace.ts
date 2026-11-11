/**
 * 选型工具共用的「计算书 / 可追溯」类型与格式化工具。
 *
 * 这里只有纯函数与类型，不依赖任何具体工具；各工具的 buildXxxSteps /
 * buildXxxCheckDetails 仍在自己的目录里，负责把引擎结果翻译成这些结构。
 */

export type SymbolSource = 'input' | 'table' | 'calc' | 'constant' | 'default'

export interface CalcSymbol {
  symbol: string
  name: string
  value: string
  unit?: string
  /** 对应输入控件的 data-symbol；计算值不填 */
  inputSymbol?: string
  source: SymbolSource
  /** 来源细节：表号、规则、常数说明等 */
  sourceDetail?: string
}

export interface CalcStep {
  key: string
  index: number
  title: string
  /** 折叠时显示的关键值，如 "Pjs = 24.00 kW" */
  keyValue: string
  formula: string
  substitution: string
  result: string
  symbols: CalcSymbol[]
  pass?: boolean
  controlling?: boolean
  note?: string
}

export interface ParameterDoc {
  symbol: string
  name: string
  meaning: string
  position: string
  impact: string
  source: string
  editable: string
  basis: string
}

export interface CheckDetail {
  key: string
  label: string
  /** 折叠时显示的关键值，如 "Iz = 85.4 A" */
  keyValue: string
  required: string
  actual: string
  pass: boolean
  controlling: boolean
  margin: string
  formula: string
  substitution: string
  symbols: CalcSymbol[]
  why: string
  /** 关联计算书步骤的 key，如 "ampacity" */
  stepKey?: string
  /** 关联计算书步骤的显示名，如 "④ 载流量" */
  stepLabel?: string
}

export interface SymbolOptions {
  symbol?: string
  unit?: string
  inputSymbol?: string
  sourceDetail?: string
}

export function makeSymbol(
  name: string,
  value: string,
  source: SymbolSource,
  options: SymbolOptions = {},
): CalcSymbol {
  return {
    symbol: options.symbol ?? name,
    name,
    value,
    source,
    ...(options.unit ? { unit: options.unit } : {}),
    ...(options.inputSymbol ? { inputSymbol: options.inputSymbol } : {}),
    ...(options.sourceDetail ? { sourceDetail: options.sourceDetail } : {}),
  }
}

export function formatNumber(value: number, digits = 1): string {
  return value.toFixed(digits)
}

export function signed(value: number, digits = 1): string {
  return `${value >= 0 ? '+' : ''}${formatNumber(value, digits)}`
}

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']

/** 步骤序号，如 5 → "⑤"。 */
export function circled(index: number): string {
  return CIRCLED[index - 1] ?? String(index)
}

/** 计算书步骤的显示名，如 "⑤ 所需容量"。 */
export function stepLabelOf(step: CalcStep): string {
  return `${circled(step.index)} ${step.title}`
}

/**
 * 校核卡里的“为什么”。
 *
 * subject 决定“未控制最终 X”的用词（截面 / 容量 …）；
 * failHint 是不通过时的处置建议，由各工具给。
 */
export function whyText(
  pass: boolean,
  controlling: boolean,
  margin: string,
  drivers: string[],
  options: { subject: string; failHint: string },
): string {
  if (!pass) return `不满足；缺口 ${margin}，${options.failHint}`
  if (controlling) return `满足，且是控制项；余量 ${margin}。`
  const driverText = drivers.length ? drivers.join(' / ') : '其他约束'
  return `满足，但未控制最终${options.subject}；当前由 ${driverText} 控制，余量 ${margin}。`
}

export const SOURCE_LABELS: Record<SymbolSource, string> = {
  input: '输入',
  table: '查表',
  calc: '计算',
  constant: '常数',
  default: '默认',
}

export function sourceLabel(source: SymbolSource): string {
  return SOURCE_LABELS[source]
}

export function sourceTitle(symbol: CalcSymbol): string {
  const detail = symbol.sourceDetail ? ` · ${symbol.sourceDetail}` : ''
  return `${symbol.name}：${sourceLabel(symbol.source)}${detail}`
}
