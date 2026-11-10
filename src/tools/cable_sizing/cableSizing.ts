/**
 * 低压电缆 / 导线选型计算（0.6/1 kV）
 *
 * 计算思路：先按负荷求计算电流，再分别按载流量、电压降、短路热稳定、
 * 机械强度求最小截面，最后取四者中的最大值，并做保护配合校核。
 *
 * 主要依据：
 * - GB/T 16895.6-2014 低压电气装置 第5-52部分：电气设备的选择和安装 布线系统
 * - GB 50054-2011 低压配电设计规范
 * - GB 51348-2019 民用建筑电气设计标准
 * - GB 50217-2018 电力工程电缆设计标准
 * - GB 55024-2022 建筑电气与智能化通用规范
 *
 * 说明：内置载流量为常用表整理值，用于方案初选；正式设计应以现行标准表格、
 * 电缆厂家数据和实际敷设条件复核。
 */

import {
  ALPHA,
  AMPACITY,
  AMPACITY_DATA_NOTE,
  BREAKER_RATINGS,
  MAX_TEMPERATURE,
  RHO20,
  THERMAL_K,
} from './ampacityTables'
import {
  AIR_TEMPERATURE_FACTORS,
  SOIL_TEMPERATURE_FACTORS,
  airGroupingCategory,
  airGroupingFactor,
  buriedGroupingFactor,
  harmonicFactor,
  interpolateFactor,
  soilResistivityFactor,
} from './correctionFactors'
import {
  STANDARD_SECTIONS,
  type BuriedSpacing,
  type CableSizingInput,
  type CableSizingResult,
  type CheckResult,
  type DcAmpacitySource,
  type DcCircuitType,
  type DcWiring,
  type InstallationMethod,
  type Insulation,
  type Material,
  type ProtectionDevice,
  type SystemType,
} from './types'

export type {
  BuriedSpacing,
  CableSizingInput,
  CableSizingResult,
  CheckResult,
  CrossSection,
  InputMode,
  InstallationMethod,
  Insulation,
  Material,
  ProtectionDevice,
  SystemType,
} from './types'
export { AMPACITY_DATA_NOTE, BREAKER_RATINGS, STANDARD_SECTIONS }

export interface SystemOption {
  key: SystemType
  label: string
  shortLabel: string
  defaultVoltage: number
  /** 用于载流量表的负载导体数；内置表按 3 根负载导体整理 */
  loadedConductors: number
}

export const SYSTEM_OPTIONS: ReadonlyArray<SystemOption> = [
  {
    key: 'three-phase',
    label: '三相交流（380 V）',
    shortLabel: '三相',
    defaultVoltage: 380,
    loadedConductors: 3,
  },
  {
    key: 'single-phase',
    label: '单相交流（220 V）',
    shortLabel: '单相',
    defaultVoltage: 220,
    loadedConductors: 2,
  },
  {
    key: 'dc',
    label: '直流（48 V 默认）',
    shortLabel: '直流',
    defaultVoltage: 48,
    loadedConductors: 2,
  },
]

export interface MaterialOption {
  key: Material
  label: string
  shortLabel: string
}

export const MATERIAL_OPTIONS: ReadonlyArray<MaterialOption> = [
  { key: 'cu', label: '铜芯', shortLabel: 'Cu' },
  { key: 'al', label: '铝芯', shortLabel: 'Al' },
]

export interface InsulationOption {
  key: Insulation
  label: string
  shortLabel: string
  maxTemp: number
}

export const INSULATION_OPTIONS: ReadonlyArray<InsulationOption> = [
  { key: 'pvc', label: 'PVC 聚氯乙烯（70 ℃）', shortLabel: 'PVC', maxTemp: 70 },
  { key: 'xlpe', label: 'XLPE 交联聚乙烯（90 ℃）', shortLabel: 'XLPE', maxTemp: 90 },
]

export interface InstallationOption {
  key: InstallationMethod
  label: string
  description: string
  buried: boolean
}

export const INSTALLATION_OPTIONS: ReadonlyArray<InstallationOption> = [
  {
    key: 'A1',
    label: 'A1 · 隔热墙内导管',
    description: '敷设在隔热墙体内的导管中，散热条件最差。',
    buried: false,
  },
  {
    key: 'A2',
    label: 'A2 · 非隔热墙内导管',
    description: '敷设在非隔热墙体内的导管中。',
    buried: false,
  },
  {
    key: 'B1',
    label: 'B1 · 独立导管',
    description: '敷设在独立导管中，导管周围有空气流通。',
    buried: false,
  },
  {
    key: 'B2',
    label: 'B2 · 封闭线槽',
    description: '敷设在封闭电缆槽或线槽中。',
    buried: false,
  },
  {
    key: 'C',
    label: 'C · 墙面 / 支架明敷',
    description: '直接固定在墙面、支架或梯架上，单层排列。',
    buried: false,
  },
  {
    key: 'D',
    label: 'D · 直埋土中',
    description: '直接埋地敷设，按 20 ℃ 土壤、2.5 K·m/W 热阻率整理。',
    buried: true,
  },
  {
    key: 'E',
    label: 'E · 桥架空气中敷设',
    description: '敷设在电缆桥架内，空气中多根排列。',
    buried: false,
  },
  {
    key: 'F',
    label: 'F · 空气中集束',
    description: '多根电缆集束敷设，相互加热明显。',
    buried: false,
  },
  {
    key: 'G',
    label: 'G · 空气中单层排列',
    description: '桥架或支架上单层分开排列，散热较好。',
    buried: false,
  },
]

export interface ProtectionDeviceOption {
  key: ProtectionDevice
  label: string
  description: string
}

export const PROTECTION_DEVICE_OPTIONS: ReadonlyArray<ProtectionDeviceOption> = [
  {
    key: 'mcb',
    label: '微型断路器 MCB',
    description: 'I2 = 1.45 In，In ≤ Iz 即可满足 I2 ≤ 1.45 Iz。',
  },
  {
    key: 'mccb',
    label: '塑壳断路器 MCCB',
    description: 'I2 ≤ 1.45 In，In ≤ Iz 即可满足 I2 ≤ 1.45 Iz。',
  },
  {
    key: 'fuse',
    label: '熔断器 gG',
    description: '按 In ≤ Iz / k3 校核：In < 16 A 取 k3 = 1.31，In ≥ 16 A 取 k3 = 1.10。',
  },
]

export interface BuriedSpacingOption {
  key: BuriedSpacing
  label: string
}

export const BURIED_SPACING_OPTIONS: ReadonlyArray<BuriedSpacingOption> = [
  { key: 'touching', label: '相触（无间距）' },
  { key: 'oneDiameter', label: '1 倍电缆外径' },
  { key: 'gap125', label: '0.125 m' },
  { key: 'gap250', label: '0.25 m' },
  { key: 'gap500', label: '0.5 m' },
]

export interface DcCircuitTypeOption {
  key: DcCircuitType
  label: string
  hint: string
}

export const DC_CIRCUIT_TYPE_OPTIONS: ReadonlyArray<DcCircuitTypeOption> = [
  { key: 'load', label: '负荷回路', hint: '稳态负荷电流，按 P/U 或负荷清单' },
  { key: 'charge', label: '充电回路', hint: '常见 0.1C10，按电池厂家' },
  { key: 'discharge', label: '放电回路', hint: '按最低母线电压 U_min' },
  { key: 'rectifier', label: '整流器输出', hint: '负荷 + 充电，N+1' },
  { key: 'bus', label: '母线 / 分路', hint: '单路分路电流' },
]

export interface DcWiringOption {
  key: DcWiring
  label: string
  hint: string
}

export const DC_WIRING_OPTIONS: ReadonlyArray<DcWiringOption> = [
  { key: 'twoWire', label: '2 线（正/负）', hint: '标签 2×S' },
  { key: 'twoWirePe', label: '2 线 + PE', hint: '标签 2×S+1×PE' },
  { key: 'positiveEarthed', label: '正极接地', hint: '标签 2×S，PE 按接地系统' },
]

export interface DcAmpacitySourceOption {
  key: DcAmpacitySource
  label: string
  hint: string
}

export const DC_AMPACITY_SOURCE_OPTIONS: ReadonlyArray<DcAmpacitySourceOption> = [
  { key: 'standard', label: '国家标准表', hint: '内置 3 根导体表，DC 偏保守' },
  { key: 'manufacturer', label: '厂家 DC 表', hint: '填当前组合的 16 个截面值' },
]

export function createDefaultInput(): CableSizingInput {
  return {
    system: 'three-phase',
    voltage: 380,
    inputMode: 'power',
    powerKw: 30,
    currentA: 60,
    powerFactor: 0.85,
    efficiency: 0.9,
    demandFactor: 0.8,
    lengthM: 80,
    material: 'cu',
    insulation: 'xlpe',
    method: 'C',
    ambientTempC: 35,
    groupedCircuits: 1,
    parallelCables: 1,
    allowedDropPercent: 5,
    shortCircuitKa: 6,
    clearingTimeS: 0.1,
    breakerRatingA: null,
    reactanceOhmPerKm: 0.08,
    harmonicThdPercent: 0,
    protectionDevice: 'mcb',
    buriedSpacing: 'touching',
    soilThermalResistivity: 2.5,
    motorStarting: false,
    startingCurrentMultiple: 6,
    allowedStartingDropPercent: 15,
    dcCircuitType: 'load',
    dcWiring: 'twoWire',
    dcAmpacitySource: 'standard',
    dcManufacturerAmpacity: [],
    dcManufacturerName: '',
  }
}

/** 简易模式固定值：方案初选时不需要用户输入的参数，集中在这里便于页面同步展示。 */
export const SIMPLE_MODE_FIXED = {
  ambientTempC: 40,
  shortCircuitKa: 6,
  clearingTimeS: 0.1,
  reactanceOhmPerKm: 0.08,
} as const

/**
 * 简易模式默认输入：核心字段与 createDefaultInput 相同，
 * 其余参数按方案初选的假定值固定（cosφ=1、η=1、Kd=1、h3=0、单回路单根、40 ℃、6 kA）。
 *
 * 这里只是输入值组合，不改变引擎口径；专业模式仍使用 createDefaultInput()。
 */
export function createSimpleInput(): CableSizingInput {
  return {
    ...createDefaultInput(),
    powerFactor: 1,
    efficiency: 1,
    demandFactor: 1,
    ambientTempC: SIMPLE_MODE_FIXED.ambientTempC,
    shortCircuitKa: SIMPLE_MODE_FIXED.shortCircuitKa,
    clearingTimeS: SIMPLE_MODE_FIXED.clearingTimeS,
    reactanceOhmPerKm: SIMPLE_MODE_FIXED.reactanceOhmPerKm,
    groupedCircuits: 1,
    parallelCables: 1,
    harmonicThdPercent: 0,
    motorStarting: false,
    breakerRatingA: null,
    protectionDevice: 'mcb',
    buriedSpacing: 'touching',
    soilThermalResistivity: 2.5,
    dcCircuitType: 'load',
    dcWiring: 'twoWire',
    dcAmpacitySource: 'standard',
    dcManufacturerAmpacity: [],
    dcManufacturerName: '',
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function standardIndexAtLeast(section: number): number {
  const index = STANDARD_SECTIONS.findIndex((candidate) => candidate >= section)
  return index === -1 ? STANDARD_SECTIONS.length - 1 : index
}

function formatNumber(value: number, digits = 1): string {
  return value.toFixed(digits)
}

export function formatSection(section: number): string {
  return Number.isInteger(section) ? String(section) : section.toFixed(1)
}

function protectiveEarthSection(section: number): number {
  if (section <= 16) return section
  if (section <= 35) return 16
  return STANDARD_SECTIONS[standardIndexAtLeast(section / 2)] ?? section
}

function cableFamily(material: Material, insulation: Insulation): string {
  if (material === 'cu') return insulation === 'xlpe' ? 'YJV' : 'VV'
  return insulation === 'xlpe' ? 'YJLV' : 'VLV'
}

function computeVoltageDropVolts(params: {
  system: SystemType
  currentA: number
  lengthM: number
  resistanceOhmPerM: number
  reactanceOhmPerM: number
  powerFactor: number
}): number {
  if (params.system === 'dc') {
    return 2 * params.currentA * params.lengthM * params.resistanceOhmPerM
  }
  const cosPhi = params.powerFactor
  const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi))
  const impedance = params.resistanceOhmPerM * cosPhi + params.reactanceOhmPerM * sinPhi
  const multiplier = params.system === 'three-phase' ? Math.sqrt(3) : 2
  return multiplier * params.currentA * params.lengthM * impedance
}

/**
 * 执行多约束选型。输入无效时返回 null。
 */
const DC_CIRCUIT_LABELS: Record<DcCircuitType, string> = {
  load: '负荷电流',
  charge: '充电电流',
  discharge: '放电电流',
  rectifier: '整流器输出电流',
  bus: '分路电流',
}

const DC_WIRING_LABELS: Record<DcWiring, string> = {
  twoWire: '2 线',
  twoWirePe: '2 线+PE',
  positiveEarthed: '正极接地',
}

export function calculateCableSizing(input: CableSizingInput): CableSizingResult | null {
  const warnings: string[] = []

  const voltage = Number(input.voltage)
  const lengthM = Number(input.lengthM)
  const powerKw = Number(input.powerKw)
  const currentA = Number(input.currentA)

  if (!Number.isFinite(voltage) || voltage <= 0) return null
  if (!Number.isFinite(lengthM) || lengthM <= 0) return null

  if (input.inputMode === 'power') {
    if (!Number.isFinite(powerKw) || powerKw <= 0) return null
  } else if (!Number.isFinite(currentA) || currentA <= 0) {
    return null
  }

  const rawPowerFactor = Number(input.powerFactor)
  const rawEfficiency = Number(input.efficiency)
  const rawDemandFactor = Number(input.demandFactor)
  const rawAllowedDropPercent = Number(input.allowedDropPercent)

  if (input.system !== 'dc' && (!Number.isFinite(rawPowerFactor) || rawPowerFactor <= 0)) {
    return null
  }
  if (!Number.isFinite(rawEfficiency) || rawEfficiency <= 0) return null
  if (input.inputMode === 'power' && (!Number.isFinite(rawDemandFactor) || rawDemandFactor <= 0)) {
    return null
  }
  if (!Number.isFinite(rawAllowedDropPercent) || rawAllowedDropPercent <= 0) return null

  const powerFactor = input.system === 'dc' ? 1 : clamp(rawPowerFactor, 0.1, 1)
  const efficiency = clamp(rawEfficiency, 0.1, 1)
  const demandFactor = clamp(rawDemandFactor, 0.1, 1)
  const allowedDropPercent = clamp(rawAllowedDropPercent, 0.1, 20)

  let designCurrentA = 0
  let designPowerKw = 0

  if (input.inputMode === 'current') {
    designCurrentA = currentA
    const powerMultiplier =
      input.system === 'three-phase'
        ? Math.sqrt(3) * voltage * powerFactor * efficiency
        : voltage * (input.system === 'single-phase' ? powerFactor : 1) * efficiency
    designPowerKw = (designCurrentA * powerMultiplier) / 1000
  } else {
    designPowerKw = powerKw * demandFactor
    if (input.system === 'three-phase') {
      designCurrentA = (designPowerKw * 1000) / (Math.sqrt(3) * voltage * powerFactor * efficiency)
    } else if (input.system === 'single-phase') {
      designCurrentA = (designPowerKw * 1000) / (voltage * powerFactor * efficiency)
    } else {
      designCurrentA = (designPowerKw * 1000) / (voltage * efficiency)
    }
  }

  if (!Number.isFinite(designCurrentA) || designCurrentA <= 0) return null

  const apparentPowerKva =
    input.system === 'three-phase'
      ? (Math.sqrt(3) * voltage * designCurrentA) / 1000
      : (voltage * designCurrentA) / 1000

  const ambientTempC = Number(input.ambientTempC)
  if (!Number.isFinite(ambientTempC)) return null

  const methodInfo = INSTALLATION_OPTIONS.find((option) => option.key === input.method)
  const isBuried = methodInfo?.buried ?? false
  const temperatureTable = isBuried
    ? SOIL_TEMPERATURE_FACTORS[input.insulation]
    : AIR_TEMPERATURE_FACTORS[input.insulation]
  const { factor: temperatureFactor, clamped: temperatureClamped } = interpolateFactor(
    temperatureTable,
    ambientTempC,
  )
  if (temperatureClamped) {
    warnings.push(
      `${isBuried ? '土壤' : '环境'}温度 ${formatNumber(ambientTempC, 0)} ℃ 超出修正表范围，已按边界值 ${formatNumber(temperatureFactor, 2)} 取值。`,
    )
  }

  const rawGrouped = Number(input.groupedCircuits)
  const groupedCircuits = clamp(Math.round(Number.isFinite(rawGrouped) ? rawGrouped : 1), 1, 12)
  if (rawGrouped > 12) {
    warnings.push('并列回路数超过 12，按 12 回路取值，建议分层敷设或补充计算。')
  }

  const rawParallel = Number(input.parallelCables)
  const parallelCables = clamp(Math.round(Number.isFinite(rawParallel) ? rawParallel : 1), 1, 4)
  if (rawParallel > 4) {
    warnings.push('每相并联电缆数超过 4，按 4 根计算；多根并联需校验均流与敷设间距。')
  }

  // 并联电缆本身也参与相互加热，按电缆根数（回路数 × 并联根数）查成束系数
  const groupingCount = Math.max(1, groupedCircuits * parallelCables)
  const groupingCategory = airGroupingCategory(input.method)
  const groupingFactor = isBuried
    ? buriedGroupingFactor(input.buriedSpacing, groupingCount)
    : groupingCategory
      ? airGroupingFactor(groupingCategory, groupingCount)
      : 1
  if (groupingCount > 20) {
    warnings.push('成束电缆根数超过 20，按 20 根对应的系数取值，建议分层敷设或补充计算。')
  } else if (isBuried && groupingCount > 12) {
    warnings.push('埋地成束超过 12 回路，按 20 回路系数保守取值，建议校核敷设间距。')
  }

  const rawSoil = Number(input.soilThermalResistivity)
  const soilThermalResistivity = Number.isFinite(rawSoil) && rawSoil > 0 ? rawSoil : 2.5
  const soilInfo = isBuried
    ? soilResistivityFactor(soilThermalResistivity)
    : { factor: 1, clamped: false }
  if (isBuried && (soilThermalResistivity < 0.5 || soilThermalResistivity > 3)) {
    warnings.push(
      `土壤热阻率 ${formatNumber(soilThermalResistivity, 2)} K·m/W 超出 0.5～3.0 范围，已按边界值修正。`,
    )
  }

  const rawThd = Number(input.harmonicThdPercent)
  const thdPercent =
    input.system === 'three-phase' && Number.isFinite(rawThd) ? clamp(rawThd, 0, 100) : 0
  const harmonic = harmonicFactor(thdPercent)
  const neutralCurrentA = harmonic.neutralBased ? harmonic.neutralMultiplier * designCurrentA : 0
  const ampacityDesignCurrentA = Math.max(designCurrentA, neutralCurrentA)
  if (thdPercent > 33) {
    warnings.push(
      `三次谐波 ${formatNumber(thdPercent, 0)}%，已按中性线电流 ${formatNumber(neutralCurrentA, 1)} A 选型。`,
    )
  }

  const isDc = input.system === 'dc'
  const manufacturerValues = Array.isArray(input.dcManufacturerAmpacity)
    ? input.dcManufacturerAmpacity
    : []
  const manufacturerTableValid =
    manufacturerValues.length === STANDARD_SECTIONS.length &&
    manufacturerValues.every((value) => Number.isFinite(value) && value > 0)
  const useManufacturerTable =
    isDc && input.dcAmpacitySource === 'manufacturer' && manufacturerTableValid
  if (isDc && input.dcAmpacitySource === 'manufacturer' && !manufacturerTableValid) {
    warnings.push('厂家 DC 表未填满 16 个截面或存在无效值，已回退国家标准表。')
  }
  const ampacitySource: DcAmpacitySource = useManufacturerTable ? 'manufacturer' : 'standard'
  const ampacitySourceLabel = useManufacturerTable
    ? `厂家表${input.dcManufacturerName ? ` · ${input.dcManufacturerName}` : ''}`
    : isDc
      ? '国家标准表（3 根导体，DC 保守）'
      : '国家标准表'

  const table = useManufacturerTable
    ? manufacturerValues
    : AMPACITY[input.material][input.insulation][input.method]
  const requiredBaseAmpacityA =
    ampacityDesignCurrentA /
    Math.max(
      0.01,
      temperatureFactor * groupingFactor * soilInfo.factor * harmonic.factor * parallelCables,
    )

  let ampacityIndex = table.findIndex((value) => value >= requiredBaseAmpacityA)
  let ampacityLimited = false
  if (ampacityIndex === -1) {
    ampacityIndex = STANDARD_SECTIONS.length - 1
    ampacityLimited = true
  }

  const rawReactance = Number(input.reactanceOhmPerKm)
  const reactanceOhmPerKm = Number.isFinite(rawReactance) ? clamp(rawReactance, 0, 1) : 0.08
  if (!Number.isFinite(rawReactance)) {
    warnings.push('线路电抗输入无效，已按 0.08 Ω/km 取值。')
  }

  const maxTemperature = MAX_TEMPERATURE[input.insulation]
  const resistivityAtTemperature =
    RHO20[input.material] * (1 + ALPHA[input.material] * (maxTemperature - 20))

  let voltageDropIndex = -1
  for (let i = 0; i < STANDARD_SECTIONS.length; i += 1) {
    const section = STANDARD_SECTIONS[i]
    if (!section) continue
    const resistanceOhmPerM = resistivityAtTemperature / section / parallelCables
    const reactanceOhmPerM = reactanceOhmPerKm / 1000 / parallelCables
    const dropV = computeVoltageDropVolts({
      system: input.system,
      currentA: designCurrentA,
      lengthM,
      resistanceOhmPerM,
      reactanceOhmPerM,
      powerFactor,
    })
    if ((dropV / voltage) * 100 <= allowedDropPercent) {
      voltageDropIndex = i
      break
    }
  }
  let voltageDropLimited = false
  if (voltageDropIndex === -1) {
    voltageDropIndex = STANDARD_SECTIONS.length - 1
    voltageDropLimited = true
  }

  const shortCircuitKa = clamp(Number(input.shortCircuitKa), 0, 100)
  const clearingTimeS = clamp(Number(input.clearingTimeS), 0.01, 5)
  const thermalK = THERMAL_K[input.material][input.insulation]
  const shortCircuitMinSection = (shortCircuitKa * 1000 * Math.sqrt(clearingTimeS)) / thermalK
  const shortCircuitMinSectionPerCable = shortCircuitMinSection / parallelCables

  let thermalIndex = STANDARD_SECTIONS.findIndex(
    (section) => section >= shortCircuitMinSectionPerCable,
  )
  let thermalLimited = false
  if (thermalIndex === -1) {
    thermalIndex = STANDARD_SECTIONS.length - 1
    thermalLimited = true
  }

  const mechanicalMinSection = input.material === 'cu' ? 1.5 : 10
  const mechanicalIndex = standardIndexAtLeast(mechanicalMinSection)

  const requiredInA = Math.max(designCurrentA, neutralCurrentA)
  const requestedBreaker = Number(input.breakerRatingA)
  const breakerAuto = !Number.isFinite(requestedBreaker) || requestedBreaker <= 0
  const breakerRatingA = breakerAuto
    ? (BREAKER_RATINGS.find((rating) => rating >= requiredInA) ??
      BREAKER_RATINGS[BREAKER_RATINGS.length - 1] ??
      1600)
    : requestedBreaker
  const fuseK3 =
    !isDc && input.protectionDevice === 'fuse' ? (breakerRatingA < 16 ? 1.31 : 1.1) : null

  if (breakerAuto && breakerRatingA < requiredInA) {
    warnings.push('自动选择的断路器额定电流仍小于计算电流，请采用更大壳架或并联方案。')
  }

  const ampacityAtIndex = (index: number) =>
    (table[index] ?? table[table.length - 1] ?? 0) *
    temperatureFactor *
    groupingFactor *
    soilInfo.factor *
    harmonic.factor *
    parallelCables
  const protectionLimitAtIndex = (index: number) => {
    const corrected = ampacityAtIndex(index)
    return fuseK3 ? corrected / fuseK3 : corrected
  }

  let finalIndex = Math.max(ampacityIndex, voltageDropIndex, thermalIndex, mechanicalIndex)
  let protectionDriven = false
  while (
    finalIndex < STANDARD_SECTIONS.length - 1 &&
    protectionLimitAtIndex(finalIndex) < breakerRatingA - 1e-6
  ) {
    finalIndex += 1
    protectionDriven = true
  }

  const selectedSection = STANDARD_SECTIONS[finalIndex] ?? STANDARD_SECTIONS[0]
  const baseAmpacityA = table[finalIndex] ?? table[table.length - 1] ?? 0
  const ampacityPerCableA =
    baseAmpacityA * temperatureFactor * groupingFactor * soilInfo.factor * harmonic.factor
  const totalAmpacityA = ampacityPerCableA * parallelCables

  const resistanceMilliohm = (resistivityAtTemperature / selectedSection / parallelCables) * 1000
  const reactanceMilliohm = (reactanceOhmPerKm / 1000 / parallelCables) * 1000
  const voltageDropV = computeVoltageDropVolts({
    system: input.system,
    currentA: designCurrentA,
    lengthM,
    resistanceOhmPerM: resistanceMilliohm / 1000,
    reactanceOhmPerM: reactanceMilliohm / 1000,
    powerFactor,
  })
  const voltageDropPercent = (voltageDropV / voltage) * 100
  const lineLossW =
    (input.system === 'three-phase' ? 3 : 2) *
    designCurrentA *
    designCurrentA *
    (resistanceMilliohm / 1000) *
    lengthM

  const shortCircuitWithstandKa =
    (thermalK * selectedSection * parallelCables) / (1000 * Math.sqrt(clearingTimeS))

  const ampacityPass = totalAmpacityA >= ampacityDesignCurrentA - 1e-6
  const voltageDropPass = voltageDropPercent <= allowedDropPercent + 1e-9
  const thermalPass = selectedSection * parallelCables >= shortCircuitMinSection - 1e-6
  const mechanicalPass = selectedSection >= mechanicalMinSection - 1e-9
  const protectionLimitA = fuseK3 ? totalAmpacityA / fuseK3 : totalAmpacityA
  const protectionPass =
    breakerRatingA >= requiredInA - 1e-6 && breakerRatingA <= protectionLimitA + 1e-6

  if (ampacityLimited) {
    warnings.push('按 300 mm² 单根载流量仍不足，请增加每相并联根数、缩短线路或改用母线槽。')
  }
  if (voltageDropLimited) {
    warnings.push('按 300 mm² 仍不能满足电压降要求，请缩短线路、增加并联根数或提高允许压降。')
  }
  if (thermalLimited) {
    warnings.push('短路热稳定要求的截面超过 300 mm²，请增加并联根数或缩短保护动作时间。')
  }
  if (!ampacityPass) {
    warnings.push('校正后的载流量小于计算电流，需增大截面或改善敷设散热条件。')
  }
  if (!voltageDropPass) {
    warnings.push('电压降超过允许值，需增大截面、缩短线路或增加并联根数。')
  }
  if (!thermalPass) {
    warnings.push('短路热稳定不满足，需增大截面或缩短保护动作时间。')
  }
  if (!protectionPass) {
    warnings.push(
      `保护电器额定电流 ${formatNumber(breakerRatingA, 0)} A 不在 Ib～${fuseK3 ? 'Iz/k3' : 'Iz'} 区间（${formatNumber(requiredInA, 1)}～${formatNumber(protectionLimitA, 1)} A），请调整保护整定或截面。`,
    )
  }
  if (parallelCables > 1) {
    warnings.push(
      `已按每相 ${parallelCables} 根并联计算，施工时需保证同规格、同长度、同敷设路径并校验均流。`,
    )
  }

  const startingMultiple = clamp(Number(input.startingCurrentMultiple) || 6, 1, 12)
  const allowedStartingDropPercent = clamp(Number(input.allowedStartingDropPercent) || 15, 1, 50)
  let startingVoltageDropPercent: number | null = null
  let startingPass: boolean | null = null
  if (input.motorStarting && input.system !== 'dc') {
    const startDropV = computeVoltageDropVolts({
      system: input.system,
      currentA: designCurrentA * startingMultiple,
      lengthM,
      resistanceOhmPerM: resistanceMilliohm / 1000,
      reactanceOhmPerM: reactanceMilliohm / 1000,
      powerFactor,
    })
    startingVoltageDropPercent = (startDropV / voltage) * 100
    startingPass = startingVoltageDropPercent <= allowedStartingDropPercent + 1e-9
    if (!startingPass) {
      warnings.push(
        `电机启动压降 ${formatNumber(startingVoltageDropPercent, 2)} % 超过允许值 ${formatNumber(allowedStartingDropPercent, 1)} %，需增大截面或缩短线路。`,
      )
    }
  }

  const drivers: string[] = []
  if (finalIndex === ampacityIndex) drivers.push('载流量')
  if (finalIndex === voltageDropIndex) drivers.push('电压降')
  if (finalIndex === thermalIndex) drivers.push('短路热稳定')
  if (finalIndex === mechanicalIndex) drivers.push('机械强度')
  if (protectionDriven) drivers.push('保护配合')
  if (harmonic.factor < 1 || harmonic.neutralBased) drivers.push('谐波')

  const peSection = protectiveEarthSection(selectedSection)
  const coreLabel =
    input.system === 'dc'
      ? input.dcWiring === 'twoWirePe'
        ? `2×${formatSection(selectedSection)}+1×${formatSection(peSection)}`
        : `2×${formatSection(selectedSection)}`
      : input.system === 'three-phase'
        ? `4×${formatSection(selectedSection)}+1×${formatSection(peSection)}`
        : `2×${formatSection(selectedSection)}+1×${formatSection(peSection)}`
  const cableLabel = `${cableFamily(input.material, input.insulation)}-0.6/1kV ${coreLabel}`

  const checks: CheckResult[] = [
    {
      key: 'ampacity',
      label: '载流量',
      required: `Iz ≥ ${harmonic.neutralBased ? 'IN' : 'Ib'} = ${formatNumber(ampacityDesignCurrentA, 1)} A`,
      actual: `${formatNumber(totalAmpacityA, 1)} A（${formatNumber(ampacityPerCableA, 1)} A/根）`,
      pass: ampacityPass,
      note: isDc
        ? `kt=${formatNumber(temperatureFactor, 2)}，kg=${formatNumber(groupingFactor, 2)}（${groupingCount} 根），ks=${formatNumber(soilInfo.factor, 2)}；${ampacitySourceLabel}`
        : `kt=${formatNumber(temperatureFactor, 2)}，kg=${formatNumber(groupingFactor, 2)}（${groupingCount} 根），ks=${formatNumber(soilInfo.factor, 2)}，kh=${formatNumber(harmonic.factor, 2)}`,
    },
    {
      key: 'voltage-drop',
      label: '电压降',
      required: `ΔU ≤ ${formatNumber(allowedDropPercent, 1)} %`,
      actual: `${formatNumber(voltageDropPercent, 2)} %（${formatNumber(voltageDropV, 1)} V）`,
      pass: voltageDropPass,
      note: isDc
        ? `R=${formatNumber(resistanceMilliohm, 2)} mΩ（DC 往返 2×）`
        : `R=${formatNumber(resistanceMilliohm, 2)} mΩ，X=${formatNumber(reactanceMilliohm, 2)} mΩ`,
    },
    {
      key: 'thermal',
      label: '短路热稳定',
      required: `S ≥ ${formatNumber(shortCircuitMinSection, 1)} mm²`,
      actual: `${formatSection(selectedSection)} mm² × ${parallelCables} = ${formatNumber(selectedSection * parallelCables, 1)} mm²`,
      pass: thermalPass,
      note: `k=${thermalK}，Isc=${formatNumber(shortCircuitKa, 1)} kA，t=${formatNumber(clearingTimeS, 2)} s`,
    },
    {
      key: 'mechanical',
      label: '机械强度',
      required: `S ≥ ${formatSection(mechanicalMinSection)} mm²`,
      actual: `${formatSection(selectedSection)} mm²`,
      pass: mechanicalPass,
      note: input.material === 'al' ? '铝芯固定敷设最小 10 mm²' : '铜芯固定敷设最小 1.5 mm²',
    },
    {
      key: 'protection',
      label: '保护配合',
      required: fuseK3 ? `Ib ≤ In ≤ Iz / ${formatNumber(fuseK3, 2)}` : `Ib ≤ In ≤ Iz`,
      actual: `In=${formatNumber(breakerRatingA, 0)} A，${fuseK3 ? `Iz/k3=${formatNumber(protectionLimitA, 1)} A` : `Iz=${formatNumber(totalAmpacityA, 1)} A`}`,
      pass: protectionPass,
      note: isDc
        ? `${protectionDeviceLabel(input.protectionDevice)}，DC 保护电器按产品样本复核；${breakerAuto ? 'In 为自动匹配' : 'In 为手动输入值'}`
        : breakerAuto
          ? `${protectionDeviceLabel(input.protectionDevice)}，In 为按计算电流自动匹配`
          : `${protectionDeviceLabel(input.protectionDevice)}，In 为手动输入值`,
    },
  ]

  if (startingVoltageDropPercent !== null && startingPass !== null) {
    checks.push({
      key: 'motor-start',
      label: '电机启动压降',
      required: `ΔU_start ≤ ${formatNumber(allowedStartingDropPercent, 1)} %`,
      actual: `${formatNumber(startingVoltageDropPercent, 2)} %`,
      pass: startingPass,
      note: `启动电流 ${formatNumber(startingMultiple, 1)} × Ib`,
    })
  }

  const overallPass = checks.every((check) => check.pass)
  const ampacityMarginPercent =
    ampacityDesignCurrentA > 0
      ? ((totalAmpacityA - ampacityDesignCurrentA) / ampacityDesignCurrentA) * 100
      : 0

  return {
    designPowerKw,
    designCurrentA,
    apparentPowerKva,
    temperatureFactor,
    groupFactor: groupingFactor,
    groupingCount,
    soilFactor: soilInfo.factor,
    harmonicFactor: harmonic.factor,
    neutralCurrentA,
    ampacityDesignCurrentA,
    requiredBaseAmpacityA,
    baseAmpacityA,
    ampacityPerCableA,
    totalAmpacityA,
    ampacityMarginPercent,
    selectedSection,
    parallelCables,
    voltageDropV,
    voltageDropPercent,
    resistanceMilliohm,
    reactanceMilliohm,
    lineLossW,
    thermalK,
    shortCircuitMinSection,
    shortCircuitMinSectionPerCable,
    shortCircuitWithstandKa,
    breakerRatingA,
    breakerAuto,
    protectionDevice: input.protectionDevice,
    fuseK3,
    protectionPass,
    startingVoltageDropPercent,
    startingPass,
    cableLabel,
    ampacitySource,
    ampacitySourceLabel,
    dcCircuitLabel: isDc ? DC_CIRCUIT_LABELS[input.dcCircuitType] : '',
    dcWiringLabel: isDc ? DC_WIRING_LABELS[input.dcWiring] : '',
    drivers,
    checks,
    warnings,
    overallPass,
  }
}

function protectionDeviceLabel(device: ProtectionDevice): string {
  switch (device) {
    case 'mcb':
      return '微型断路器 MCB'
    case 'mccb':
      return '塑壳断路器 MCCB'
    case 'fuse':
      return '熔断器 gG'
  }
}
