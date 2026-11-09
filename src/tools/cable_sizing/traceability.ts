/**
 * 计算书可追溯描述：把“查表/插值/推导”的细节整理成可展示的文本。
 *
 * 这里不参与选型计算，只读取 correctionFactors / ampacityTables 的同一份数据，
 * 保证页面显示的系数与引擎实际使用的系数一致。
 */

import { ALPHA, MAX_TEMPERATURE, RHO20, THERMAL_K } from './ampacityTables'
import {
  AIR_GROUPING,
  AIR_TEMPERATURE_FACTORS,
  BURIED_GROUPING,
  SOIL_RESISTIVITY_FACTORS,
  SOIL_TEMPERATURE_FACTORS,
  airGroupingCategory,
  airGroupingFactor,
  buriedGroupingFactor,
  harmonicFactor,
  interpolateFactor,
  soilResistivityFactor,
  type AirGroupingCategory,
  type FactorPoint,
} from './correctionFactors'
import type {
  BuriedSpacing,
  CableSizingInput,
  CableSizingResult,
  InstallationMethod,
  Insulation,
  Material,
} from './types'

export interface TemperatureFactorDescription {
  factor: number
  table: string
  mediumLabel: string
  baseTemperature: number
  insulationLabel: string
  points: ReadonlyArray<FactorPoint>
  interpolated: boolean
  clamped: boolean
  expression: string
}

export interface GroupingFactorDescription {
  factor: number
  table: string
  rowLabel: string
  count: number
  exact: boolean
  capped: boolean
}

export interface SoilFactorDescription {
  factor: number
  table: string
  applicable: boolean
  points: ReadonlyArray<FactorPoint>
  interpolated: boolean
  clamped: boolean
  expression: string
}

export interface HarmonicFactorDescription {
  factor: number
  table: string
  band: string
  neutralBased: boolean
}

export interface ResistanceDescription {
  materialLabel: string
  insulationLabel: string
  rho20: number
  alpha: number
  maxTemperature: number
  rhoTheta: number
  section: number
  parallelCables: number
  resistanceMilliohm: number
  resistanceOhmPerKm: number
  expression: string
}

export interface ThermalKDescription {
  k: number
  table: string
  materialLabel: string
  insulationLabel: string
}

export interface BreakerDescription {
  auto: boolean
  targetCurrentA: number
  ratingA: number
  rule: string
  fuseK3: number | null
  fuseRule: string | null
}

const INSULATION_LABELS: Record<Insulation, string> = { pvc: 'PVC', xlpe: 'XLPE' }
const MATERIAL_LABELS: Record<Material, string> = { cu: '铜', al: '铝' }

const AIR_CATEGORY_LABELS: Record<AirGroupingCategory, string> = {
  bunched: '成束在空气中',
  singleLayer: '单层墙/地/无孔托盘',
  tray: '有孔托盘',
  ladder: '梯架/夹板',
}

const BURIED_SPACING_LABELS: Record<BuriedSpacing, string> = {
  touching: '相触',
  oneDiameter: '1 倍外径',
  gap125: '0.125 m',
  gap250: '0.25 m',
  gap500: '0.5 m',
}

function formatNumber(value: number, digits = 1): string {
  return value.toFixed(digits)
}

function findBracket(
  table: ReadonlyArray<FactorPoint>,
  value: number,
): { lower: FactorPoint; upper: FactorPoint; clamped: boolean } {
  const first = table[0]
  const last = table[table.length - 1]
  if (!first || !last) return { lower: [value, 1], upper: [value, 1], clamped: true }
  if (value <= first[0]) {
    return { lower: first, upper: table[1] ?? first, clamped: value < first[0] }
  }
  if (value >= last[0]) {
    return { lower: table[table.length - 2] ?? last, upper: last, clamped: value > last[0] }
  }
  for (let i = 1; i < table.length; i += 1) {
    const previous = table[i - 1]
    const current = table[i]
    if (!previous || !current) continue
    if (value <= current[0]) {
      return { lower: previous, upper: current, clamped: false }
    }
  }
  return { lower: table[table.length - 2] ?? last, upper: last, clamped: true }
}

export function describeTemperatureFactor(
  insulation: Insulation,
  medium: 'air' | 'soil',
  temperature: number,
): TemperatureFactorDescription {
  const table =
    medium === 'air' ? AIR_TEMPERATURE_FACTORS[insulation] : SOIL_TEMPERATURE_FACTORS[insulation]
  const bracket = findBracket(table, temperature)
  const { factor } = interpolateFactor(table, temperature)
  const interpolated =
    !bracket.clamped && temperature !== bracket.lower[0] && temperature !== bracket.upper[0]

  let expression: string
  if (bracket.clamped) {
    const boundary = temperature < bracket.lower[0] ? bracket.lower : bracket.upper
    expression = `θ=${formatNumber(temperature, 0)} ℃ 超出表范围，按边界 ${boundary[0]} ℃ 的 ${formatNumber(boundary[1], 2)} 取值`
  } else if (!interpolated) {
    expression = `θ=${formatNumber(temperature, 0)} ℃ 正好是表点 → ${formatNumber(factor, 2)}`
  } else {
    expression = `${formatNumber(bracket.lower[1], 2)} + (${formatNumber(temperature, 0)} - ${bracket.lower[0]}) / (${bracket.upper[0]} - ${bracket.lower[0]}) × (${formatNumber(bracket.upper[1], 2)} - ${formatNumber(bracket.lower[1], 2)}) = ${formatNumber(factor, 3)}`
  }

  return {
    factor,
    table: medium === 'air' ? 'B.52.14' : 'B.52.15',
    mediumLabel: medium === 'air' ? '空气' : '土壤',
    baseTemperature: medium === 'air' ? 30 : 20,
    insulationLabel: INSULATION_LABELS[insulation],
    points: [bracket.lower, bracket.upper],
    interpolated,
    clamped: bracket.clamped,
    expression,
  }
}

export function describeGroupingFactor(
  method: InstallationMethod,
  count: number,
  spacing: BuriedSpacing,
  buried: boolean,
): GroupingFactorDescription {
  if (buried) {
    const points = BURIED_GROUPING[spacing] ?? BURIED_GROUPING.touching
    const last = points[points.length - 1]
    return {
      factor: buriedGroupingFactor(spacing, count),
      table: 'B.52.18',
      rowLabel: `埋地·${BURIED_SPACING_LABELS[spacing] ?? '相触'}`,
      count,
      exact: points.some((point) => point.count === count),
      capped: last ? count > last.count : false,
    }
  }

  const category = airGroupingCategory(method) ?? 'bunched'
  const points = AIR_GROUPING[category]
  const last = points[points.length - 1]
  return {
    factor: airGroupingFactor(category, count),
    table: 'B.52.17',
    rowLabel: AIR_CATEGORY_LABELS[category],
    count,
    exact: points.some((point) => point.count === count),
    capped: last ? count > last.count : false,
  }
}

export function describeSoilFactor(rho: number, buried: boolean): SoilFactorDescription {
  if (!buried) {
    return {
      factor: 1,
      table: 'B.52.16',
      applicable: false,
      points: [],
      interpolated: false,
      clamped: false,
      expression: '非埋地，不修正',
    }
  }

  const bracket = findBracket(SOIL_RESISTIVITY_FACTORS, rho)
  const { factor } = soilResistivityFactor(rho)
  const clamped = rho < 0.5 || rho > 3
  const interpolated = !clamped && rho !== bracket.lower[0] && rho !== bracket.upper[0]

  let expression: string
  if (clamped) {
    const boundary = rho < 0.5 ? bracket.lower : bracket.upper
    expression = `ρ=${formatNumber(rho, 2)} 超出 0.5–3.0 范围，按边界 ${boundary[0]} 的 ${formatNumber(boundary[1], 2)} 取值`
  } else if (!interpolated) {
    expression = `ρ=${formatNumber(rho, 2)} 正好是表点 → ${formatNumber(factor, 2)}`
  } else {
    expression = `${formatNumber(bracket.lower[1], 2)} + (${formatNumber(rho, 2)} - ${bracket.lower[0]}) / (${bracket.upper[0]} - ${bracket.lower[0]}) × (${formatNumber(bracket.upper[1], 2)} - ${formatNumber(bracket.lower[1], 2)}) = ${formatNumber(factor, 3)}`
  }

  return {
    factor,
    table: 'B.52.16',
    applicable: true,
    points: [bracket.lower, bracket.upper],
    interpolated,
    clamped,
    expression,
  }
}

export function describeHarmonicFactor(thdPercent: number): HarmonicFactorDescription {
  const info = harmonicFactor(thdPercent)
  let band = '0–15%'
  if (thdPercent > 45) band = '>45%'
  else if (thdPercent > 33) band = '33–45%'
  else if (thdPercent > 15) band = '15–33%'

  return { factor: info.factor, table: 'E.52.1', band, neutralBased: info.neutralBased }
}

export function describeResistance(
  input: CableSizingInput,
  result: CableSizingResult,
): ResistanceDescription {
  const { material, insulation } = input
  const rho20 = RHO20[material]
  const alpha = ALPHA[material]
  const maxTemperature = MAX_TEMPERATURE[insulation]
  const rhoTheta = rho20 * (1 + alpha * (maxTemperature - 20))
  const section = result.selectedSection
  const parallelCables = result.parallelCables
  const resistanceMilliohm = (rhoTheta / section / parallelCables) * 1000
  const resistanceOhmPerKm = resistanceMilliohm

  const expression =
    `ρθ = ${rho20} × [1 + ${alpha} × (${maxTemperature} - 20)] = ${rhoTheta.toFixed(5)} Ω·mm²/m；` +
    `R = ${rhoTheta.toFixed(5)} / ${section} / ${parallelCables} = ${resistanceMilliohm.toFixed(3)} mΩ/m = ${resistanceOhmPerKm.toFixed(3)} Ω/km`

  return {
    materialLabel: MATERIAL_LABELS[material],
    insulationLabel: INSULATION_LABELS[insulation],
    rho20,
    alpha,
    maxTemperature,
    rhoTheta,
    section,
    parallelCables,
    resistanceMilliohm,
    resistanceOhmPerKm,
    expression,
  }
}

export function describeThermalK(material: Material, insulation: Insulation): ThermalKDescription {
  return {
    k: THERMAL_K[material][insulation],
    table: 'GB/T 16895.5 / IEC 60364-5-54',
    materialLabel: MATERIAL_LABELS[material],
    insulationLabel: INSULATION_LABELS[insulation],
  }
}

export function describeBreaker(result: CableSizingResult): BreakerDescription {
  const targetCurrentA = Math.max(result.designCurrentA, result.neutralCurrentA)
  const auto = result.breakerAuto
  const rule = auto
    ? `取不小于 max(Ib, IN) = ${formatNumber(targetCurrentA, 1)} A 的最小标准壳架`
    : '手动输入值'
  const fuseK3 = result.fuseK3
  const fuseRule = fuseK3 ? '熔断器 gG：In < 16 A → k3=1.31；In ≥ 16 A → k3=1.10' : null

  return {
    auto,
    targetCurrentA,
    ratingA: result.breakerRatingA,
    rule,
    fuseK3,
    fuseRule,
  }
}
