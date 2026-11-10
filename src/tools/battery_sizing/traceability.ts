/**
 * 蓄电池容量计算的可追溯描述：把“查表 / 插值 / 限幅 / 标准序列”整理成可展示文本。
 *
 * 这里不参与计算，只读取 batterySizing.ts 的同一份表数据，保证页面显示的系数
 * 与引擎实际使用的系数一致。
 */

import {
  CAPACITY_COEFFICIENT_TABLE,
  END_VOLTAGE_PER_CELL_MAX,
  END_VOLTAGE_PER_CELL_MIN,
  STANDARD_AH,
  alphaForHours,
  capacityCoefficientForHours,
} from './batterySizing'

export const CAPACITY_TABLE_NAME = 'GB 51194-2016 典型放电容量系数（10 h 额定容量 = 1.0）'

export interface CapacityCoefficientDescription {
  suggested: number
  input: number
  deviation: number
  table: string
  points: ReadonlyArray<readonly [number, number]>
  interpolated: boolean
  clamped: boolean
  expression: string
  deviationNote: string | null
}

export interface AlphaDescription {
  alpha: number
  band: string
  expression: string
}

export interface StandardAhDescription {
  next: number
  index: number
  overflow: boolean
  expression: string
}

export interface EndVoltageDescription {
  requested: number
  applied: number
  clamped: boolean
  expression: string
}

export interface TemperatureFactorDescription {
  factor: number
  raw: number
  clamped: boolean
  expression: string
}

function fmt(value: number, digits = 2): string {
  return value.toFixed(digits)
}

function findBracket(hours: number): {
  lower: readonly [number, number]
  upper: readonly [number, number]
  clamped: boolean
} {
  const table = CAPACITY_COEFFICIENT_TABLE
  const first = table[0] ?? [0.5, 0.42]
  const last = table[table.length - 1] ?? [10, 1]
  if (hours <= first[0]) {
    return { lower: first, upper: table[1] ?? first, clamped: hours < first[0] }
  }
  if (hours >= last[0]) {
    return { lower: table[table.length - 2] ?? last, upper: last, clamped: hours > last[0] }
  }
  for (let i = 1; i < table.length; i += 1) {
    const previous = table[i - 1]
    const current = table[i]
    if (!previous || !current) continue
    if (hours <= current[0]) {
      return { lower: previous, upper: current, clamped: false }
    }
  }
  return { lower: table[table.length - 2] ?? last, upper: last, clamped: true }
}

/** 容量系数：按备电时长查表/插值得到建议值，并与输入值比对。 */
export function describeCapacityCoefficient(
  hours: number,
  input: number,
): CapacityCoefficientDescription {
  const suggested = capacityCoefficientForHours(hours)
  const bracket = findBracket(hours)
  const interpolated = !bracket.clamped && hours !== bracket.lower[0] && hours !== bracket.upper[0]

  let expression: string
  if (bracket.clamped) {
    const boundary = hours < bracket.lower[0] ? bracket.lower : bracket.upper
    expression = `T=${fmt(hours)} h 超出表范围 0.5~10 h，按边界 ${fmt(boundary[0])} h 的 ${fmt(boundary[1])} 取值`
  } else if (!interpolated) {
    expression = `T=${fmt(hours)} h 正好是表点 → ${fmt(suggested)}`
  } else {
    expression =
      `${fmt(bracket.lower[1])} + (${fmt(hours)} - ${fmt(bracket.lower[0])}) / ` +
      `(${fmt(bracket.upper[0])} - ${fmt(bracket.lower[0])}) × ` +
      `(${fmt(bracket.upper[1])} - ${fmt(bracket.lower[1])}) = ${fmt(suggested, 3)}`
  }

  const deviation = input - suggested
  let deviationNote: string | null = null
  if (Number.isFinite(input) && Math.abs(deviation) > 0.02) {
    deviationNote =
      deviation < 0
        ? `输入 ${fmt(input)} 比典型值 ${fmt(suggested)} 低 ${fmt(Math.abs(deviation))}：分母偏小，所需容量偏大，结果偏保守。`
        : `输入 ${fmt(input)} 比典型值 ${fmt(suggested)} 高 ${fmt(deviation)}：所需容量偏小，需用厂家放电曲线复核，避免欠容。`
  }

  return {
    suggested,
    input,
    deviation,
    table: CAPACITY_TABLE_NAME,
    points: [bracket.lower, bracket.upper],
    interpolated,
    clamped: bracket.clamped,
    expression,
    deviationNote,
  }
}

/** α：按放电小时率分段的常数（≥10 h 取 0.006，1~10 h 取 0.008，<1 h 取 0.01）。 */
export function describeAlpha(hours: number): AlphaDescription {
  const alpha = alphaForHours(hours)
  const band = hours >= 10 ? '≥10 h' : hours >= 1 ? '1~10 h' : '<1 h'
  return {
    alpha,
    band,
    expression: `T=${fmt(hours)} h（${band}）→ α = ${alpha}`,
  }
}

/** 温度系数 Kt = 1 + α(t − 25)，下限按 0.5 取值。 */
export function describeTemperatureFactor(
  alpha: number,
  ambientTempC: number,
): TemperatureFactorDescription {
  const raw = 1 + alpha * (ambientTempC - 25)
  const factor = Math.max(0.5, raw)
  const clamped = raw < 0.5
  const expression = clamped
    ? `Kt = 1 + ${alpha} × (${fmt(ambientTempC, 0)} - 25) = ${fmt(raw, 3)}，低于下限 0.5，按 0.5 取值`
    : `Kt = 1 + ${alpha} × (${fmt(ambientTempC, 0)} - 25) = ${fmt(factor, 3)}`
  return { factor, raw, clamped, expression }
}

/** 标准 Ah 序列：向上取整到第一个不小于目标值的档位。 */
export function describeStandardAh(value: number): StandardAhDescription {
  const index = STANDARD_AH.findIndex((candidate) => candidate >= value)
  if (index < 0) {
    const last = STANDARD_AH[STANDARD_AH.length - 1] ?? value
    return {
      next: last,
      index: STANDARD_AH.length,
      overflow: true,
      expression: `目标 ${fmt(value, 1)} Ah 超出内置序列上限 ${last} Ah，按上限取值`,
    }
  }
  const next = STANDARD_AH[index] ?? value
  return {
    next,
    index: index + 1,
    overflow: false,
    expression: `标准序列中 ≥ ${fmt(value, 1)} Ah 的最小档 = ${next} Ah（第 ${index + 1} 档）`,
  }
}

/** 终止电压：单体值限幅到 1.5~1.9 V，再乘串联单体数。 */
export function describeEndVoltage(
  requested: number,
  seriesCells: number,
  applied: number,
): EndVoltageDescription {
  const clamped = requested < END_VOLTAGE_PER_CELL_MIN || requested > END_VOLTAGE_PER_CELL_MAX
  const expression = clamped
    ? `输入 ${fmt(requested)} V/单体超出 ${END_VOLTAGE_PER_CELL_MIN}~${END_VOLTAGE_PER_CELL_MAX} V 范围，按 ${fmt(applied)} V/单体计算：U_end = ${seriesCells} × ${fmt(applied)} = ${fmt(seriesCells * applied, 0)} V`
    : `U_end = ${seriesCells} × ${fmt(applied)} = ${fmt(seriesCells * applied, 0)} V`
  return { requested, applied, clamped, expression }
}
