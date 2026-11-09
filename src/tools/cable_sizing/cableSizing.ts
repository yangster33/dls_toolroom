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

export type SystemType = 'three-phase' | 'single-phase' | 'dc'
export type Material = 'cu' | 'al'
export type Insulation = 'pvc' | 'xlpe'
export type InstallationMethod = 'A1' | 'A2' | 'B1' | 'B2' | 'C' | 'D' | 'E' | 'F' | 'G'
export type InputMode = 'power' | 'current'

export const STANDARD_SECTIONS = [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300,
] as const

export type CrossSection = (typeof STANDARD_SECTIONS)[number]

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

type AmpacityRow = readonly number[]

type AmpacityTable = Record<Material, Record<Insulation, Record<InstallationMethod, AmpacityRow>>>

/**
 * 基准载流量（A）：3 根负载导体、空气 30 ℃ / 土壤 20 ℃、土壤热阻率 2.5 K·m/W。
 * 截面顺序与 STANDARD_SECTIONS 一致。
 */
const AMPACITY: AmpacityTable = {
  cu: {
    pvc: {
      A1: [13.5, 18, 24, 31, 42, 56, 73, 89, 108, 136, 164, 188, 216, 245, 286, 328],
      A2: [12.5, 16.5, 22, 28, 38, 50, 66, 80, 97, 122, 147, 169, 194, 220, 257, 295],
      B1: [15.5, 21, 28, 36, 50, 68, 89, 110, 134, 171, 207, 239, 275, 314, 369, 424],
      B2: [15, 20, 27, 34, 46, 62, 80, 99, 118, 149, 179, 206, 236, 268, 313, 353],
      C: [17.5, 24, 32, 41, 57, 76, 101, 125, 151, 192, 232, 269, 309, 353, 415, 477],
      D: [18, 24, 31, 38, 51, 66, 84, 101, 122, 151, 179, 207, 235, 265, 305, 346],
      E: [18.5, 25, 34, 42, 58, 79, 104, 129, 159, 201, 244, 283, 325, 371, 437, 502],
      F: [19, 26, 35, 44, 61, 83, 110, 137, 169, 214, 260, 302, 347, 397, 468, 538],
      G: [20, 27, 37, 46, 64, 88, 116, 145, 179, 227, 276, 321, 369, 422, 498, 573],
    },
    xlpe: {
      A1: [16, 21, 28, 37, 50, 66, 86, 105, 127, 160, 193, 221, 254, 288, 337, 386],
      A2: [15, 20, 26, 33, 45, 59, 78, 94, 114, 143, 173, 199, 228, 259, 302, 347],
      B1: [18, 25, 33, 43, 59, 80, 105, 130, 158, 201, 243, 281, 323, 369, 434, 499],
      B2: [18, 24, 32, 40, 54, 73, 94, 116, 139, 175, 210, 242, 278, 315, 368, 415],
      C: [21, 28, 38, 48, 67, 89, 119, 147, 178, 226, 273, 316, 363, 415, 488, 561],
      D: [21, 28, 36, 45, 60, 78, 99, 119, 144, 178, 211, 244, 277, 312, 359, 407],
      E: [22, 30, 40, 50, 68, 93, 122, 152, 187, 236, 287, 333, 382, 436, 514, 590],
      F: [22, 31, 41, 52, 72, 98, 129, 161, 199, 252, 306, 355, 408, 467, 551, 633],
      G: [24, 32, 44, 54, 75, 103, 136, 170, 210, 267, 324, 377, 434, 496, 585, 674],
    },
  },
  al: {
    pvc: {
      A1: [10.5, 14, 19, 24, 33, 44, 57, 69, 84, 106, 128, 147, 168, 191, 223, 256],
      A2: [9.8, 13, 17, 22, 30, 39, 51, 62, 76, 95, 115, 132, 151, 172, 200, 230],
      B1: [12, 16, 22, 28, 39, 53, 69, 86, 105, 133, 161, 186, 215, 245, 288, 331],
      B2: [12, 16, 21, 27, 36, 48, 62, 77, 92, 116, 140, 161, 184, 209, 244, 275],
      C: [14, 19, 25, 32, 44, 59, 79, 98, 118, 150, 181, 210, 241, 275, 324, 372],
      D: [14, 19, 24, 30, 40, 51, 66, 79, 95, 118, 140, 161, 183, 207, 238, 270],
      E: [14, 20, 27, 33, 45, 62, 81, 101, 124, 157, 190, 221, 254, 289, 341, 392],
      F: [15, 20, 27, 34, 48, 65, 86, 107, 132, 167, 203, 236, 271, 310, 365, 420],
      G: [16, 21, 29, 36, 50, 69, 90, 113, 140, 177, 215, 250, 288, 329, 389, 447],
    },
    xlpe: {
      A1: [12.6, 16.6, 22, 29, 39.5, 52, 68, 83, 100, 126, 152, 175, 201, 228, 266, 305],
      A2: [11.9, 15.8, 20.5, 26, 35.5, 46.6, 61.6, 74, 90, 113, 137, 157, 180, 205, 239, 274],
      B1: [14.2, 19.8, 26, 34, 46.6, 63, 83, 103, 125, 159, 192, 222, 255, 291, 343, 394],
      B2: [14.2, 19, 25, 32, 42.7, 57.7, 74, 92, 110, 138, 166, 191, 220, 249, 291, 328],
      C: [16.6, 22, 30, 38, 53, 70, 94, 116, 141, 179, 216, 250, 287, 328, 386, 443],
      D: [16.6, 22, 28, 35.5, 47.4, 61.6, 78, 94, 114, 141, 167, 193, 219, 246, 284, 321],
      E: [17.4, 24, 32, 39.5, 53.7, 73.5, 96, 120, 148, 186, 227, 263, 302, 344, 406, 466],
      F: [17.4, 24.5, 32.4, 41, 57, 77, 102, 127, 157, 199, 242, 280, 322, 369, 435, 500],
      G: [19, 25, 35, 43, 59, 81, 107, 134, 166, 211, 256, 298, 343, 392, 462, 532],
    },
  },
}

export const AMPACITY_DATA_NOTE =
  '基准载流量按 GB/T 16895.6-2014 / IEC 60364-5-52 附录 B 常用表整理，' +
  '对应 3 根负载导体、空气 30 ℃ / 土壤 20 ℃、土壤热阻率 2.5 K·m/W。' +
  '单相与直流按 3 根负载导体表取值，结果偏保守。'

type FactorPoint = readonly [temperature: number, factor: number]

const AIR_TEMPERATURE_FACTORS: Record<Insulation, ReadonlyArray<FactorPoint>> = {
  pvc: [
    [10, 1.22],
    [15, 1.17],
    [20, 1.12],
    [25, 1.06],
    [30, 1.0],
    [35, 0.94],
    [40, 0.87],
    [45, 0.79],
    [50, 0.71],
    [55, 0.61],
    [60, 0.5],
  ],
  xlpe: [
    [10, 1.15],
    [15, 1.12],
    [20, 1.08],
    [25, 1.04],
    [30, 1.0],
    [35, 0.96],
    [40, 0.91],
    [45, 0.87],
    [50, 0.82],
    [55, 0.76],
    [60, 0.71],
    [65, 0.65],
    [70, 0.58],
    [75, 0.5],
    [80, 0.41],
  ],
}

const SOIL_TEMPERATURE_FACTORS: Record<Insulation, ReadonlyArray<FactorPoint>> = {
  pvc: [
    [10, 1.1],
    [15, 1.05],
    [20, 1.0],
    [25, 0.95],
    [30, 0.89],
    [35, 0.84],
    [40, 0.77],
    [45, 0.71],
    [50, 0.63],
    [55, 0.55],
    [60, 0.45],
  ],
  xlpe: [
    [10, 1.07],
    [15, 1.04],
    [20, 1.0],
    [25, 0.96],
    [30, 0.93],
    [35, 0.89],
    [40, 0.85],
    [45, 0.8],
    [50, 0.76],
    [55, 0.71],
    [60, 0.65],
    [65, 0.6],
    [70, 0.53],
    [75, 0.46],
    [80, 0.38],
  ],
}

/** 2～12 个并列回路的同时负载修正系数 */
const GROUP_FACTORS: ReadonlyArray<number> = [
  0.8, 0.7, 0.65, 0.6, 0.57, 0.54, 0.52, 0.5, 0.48, 0.47, 0.45,
]

export const BREAKER_RATINGS: ReadonlyArray<number> = [
  6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 225, 250, 315, 350, 400, 500, 630,
  800, 1000, 1250, 1600,
]

const RHO20: Record<Material, number> = { cu: 0.01724, al: 0.02826 }
const ALPHA: Record<Material, number> = { cu: 0.00393, al: 0.00403 }
const MAX_TEMPERATURE: Record<Insulation, number> = { pvc: 70, xlpe: 90 }

/** 短路热稳定系数 k（A·√s/mm²），按 GB/T 16895.5 常用值 */
const THERMAL_K: Record<Material, Record<Insulation, number>> = {
  cu: { pvc: 115, xlpe: 143 },
  al: { pvc: 76, xlpe: 94 },
}

export interface CableSizingInput {
  system: SystemType
  voltage: number
  inputMode: InputMode
  powerKw: number
  currentA: number
  powerFactor: number
  efficiency: number
  demandFactor: number
  lengthM: number
  material: Material
  insulation: Insulation
  method: InstallationMethod
  ambientTempC: number
  groupedCircuits: number
  parallelCables: number
  allowedDropPercent: number
  shortCircuitKa: number
  clearingTimeS: number
  breakerRatingA: number | null
  reactanceOhmPerKm: number
}

export interface CheckResult {
  key: string
  label: string
  required: string
  actual: string
  pass: boolean
  note: string
}

export interface CableSizingResult {
  designPowerKw: number
  designCurrentA: number
  apparentPowerKva: number
  temperatureFactor: number
  groupFactor: number
  requiredBaseAmpacityA: number
  baseAmpacityA: number
  ampacityPerCableA: number
  totalAmpacityA: number
  ampacityMarginPercent: number
  selectedSection: CrossSection
  parallelCables: number
  voltageDropV: number
  voltageDropPercent: number
  resistanceMilliohm: number
  reactanceMilliohm: number
  lineLossW: number
  thermalK: number
  shortCircuitMinSection: number
  shortCircuitMinSectionPerCable: number
  shortCircuitWithstandKa: number
  breakerRatingA: number
  breakerAuto: boolean
  protectionPass: boolean
  cableLabel: string
  drivers: string[]
  checks: CheckResult[]
  warnings: string[]
  overallPass: boolean
}

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
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function interpolateFactor(
  table: ReadonlyArray<FactorPoint>,
  temperature: number,
): { factor: number; clamped: boolean } {
  const first = table[0]
  const last = table[table.length - 1]
  if (!first || !last) return { factor: 1, clamped: true }
  if (temperature <= first[0]) return { factor: first[1], clamped: temperature < first[0] }
  if (temperature >= last[0]) return { factor: last[1], clamped: temperature > last[0] }

  for (let i = 1; i < table.length; i += 1) {
    const previous = table[i - 1]
    const current = table[i]
    if (!previous || !current) continue
    if (temperature <= current[0]) {
      const ratio = (temperature - previous[0]) / (current[0] - previous[0])
      return { factor: previous[1] + ratio * (current[1] - previous[1]), clamped: false }
    }
  }
  return { factor: last[1], clamped: true }
}

function groupFactor(circuitCount: number): number {
  if (circuitCount <= 1) return 1
  const index = Math.min(circuitCount - 2, GROUP_FACTORS.length - 1)
  return GROUP_FACTORS[index] ?? 0.45
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
    warnings.push('并列回路数超过 12，按 12 回路修正系数 0.45 取值，建议分层敷设或补充计算。')
  }
  const groupingFactor = groupFactor(groupedCircuits)

  const rawParallel = Number(input.parallelCables)
  const parallelCables = clamp(Math.round(Number.isFinite(rawParallel) ? rawParallel : 1), 1, 4)
  if (rawParallel > 4) {
    warnings.push('每相并联电缆数超过 4，按 4 根计算；多根并联需校验均流与敷设间距。')
  }

  const table = AMPACITY[input.material][input.insulation][input.method]
  const requiredBaseAmpacityA =
    designCurrentA / Math.max(0.01, temperatureFactor * groupingFactor * parallelCables)

  let ampacityIndex = table.findIndex((value) => value >= requiredBaseAmpacityA)
  let ampacityLimited = false
  if (ampacityIndex === -1) {
    ampacityIndex = STANDARD_SECTIONS.length - 1
    ampacityLimited = true
  }

  const reactanceOhmPerKm = clamp(Number(input.reactanceOhmPerKm), 0, 1)
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

  const requestedBreaker = Number(input.breakerRatingA)
  const breakerAuto = !Number.isFinite(requestedBreaker) || requestedBreaker <= 0
  const breakerRatingA = breakerAuto
    ? (BREAKER_RATINGS.find((rating) => rating >= designCurrentA) ??
      BREAKER_RATINGS[BREAKER_RATINGS.length - 1] ??
      1600)
    : requestedBreaker

  if (breakerAuto && breakerRatingA < designCurrentA) {
    warnings.push('自动选择的断路器额定电流仍小于计算电流，请采用更大壳架或并联方案。')
  }

  let finalIndex = Math.max(ampacityIndex, voltageDropIndex, thermalIndex, mechanicalIndex)
  let protectionDriven = false
  const ampacityAtIndex = (index: number) =>
    (table[index] ?? table[table.length - 1] ?? 0) *
    temperatureFactor *
    groupingFactor *
    parallelCables
  while (
    finalIndex < STANDARD_SECTIONS.length - 1 &&
    ampacityAtIndex(finalIndex) < breakerRatingA - 1e-6
  ) {
    finalIndex += 1
    protectionDriven = true
  }

  const selectedSection = STANDARD_SECTIONS[finalIndex] ?? STANDARD_SECTIONS[0]
  const baseAmpacityA = table[finalIndex] ?? table[table.length - 1] ?? 0
  const ampacityPerCableA = baseAmpacityA * temperatureFactor * groupingFactor
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

  const ampacityPass = totalAmpacityA >= designCurrentA - 1e-6
  const voltageDropPass = voltageDropPercent <= allowedDropPercent + 1e-9
  const thermalPass = selectedSection * parallelCables >= shortCircuitMinSection - 1e-6
  const mechanicalPass = selectedSection >= mechanicalMinSection - 1e-9
  const protectionPass =
    breakerRatingA >= designCurrentA - 1e-6 && breakerRatingA <= totalAmpacityA + 1e-6

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
      `断路器额定电流 ${formatNumber(breakerRatingA, 0)} A 不在 Ib～Iz 区间（${formatNumber(designCurrentA, 1)}～${formatNumber(totalAmpacityA, 1)} A），请调整保护整定或截面。`,
    )
  }
  if (parallelCables > 1) {
    warnings.push(
      `已按每相 ${parallelCables} 根并联计算，施工时需保证同规格、同长度、同敷设路径并校验均流。`,
    )
  }

  const drivers: string[] = []
  if (finalIndex === ampacityIndex) drivers.push('载流量')
  if (finalIndex === voltageDropIndex) drivers.push('电压降')
  if (finalIndex === thermalIndex) drivers.push('短路热稳定')
  if (finalIndex === mechanicalIndex) drivers.push('机械强度')
  if (protectionDriven) drivers.push('保护配合')

  const peSection = protectiveEarthSection(selectedSection)
  const coreLabel =
    input.system === 'three-phase'
      ? `4×${formatSection(selectedSection)}+1×${formatSection(peSection)}`
      : `2×${formatSection(selectedSection)}+1×${formatSection(peSection)}`
  const cableLabel = `${cableFamily(input.material, input.insulation)}-0.6/1kV ${coreLabel}`

  const checks: CheckResult[] = [
    {
      key: 'ampacity',
      label: '载流量',
      required: `Iz ≥ Ib = ${formatNumber(designCurrentA, 1)} A`,
      actual: `${formatNumber(totalAmpacityA, 1)} A（${formatNumber(ampacityPerCableA, 1)} A/根）`,
      pass: ampacityPass,
      note: `温度系数 ${formatNumber(temperatureFactor, 2)}，并列系数 ${formatNumber(groupingFactor, 2)}`,
    },
    {
      key: 'voltage-drop',
      label: '电压降',
      required: `ΔU ≤ ${formatNumber(allowedDropPercent, 1)} %`,
      actual: `${formatNumber(voltageDropPercent, 2)} %（${formatNumber(voltageDropV, 1)} V）`,
      pass: voltageDropPass,
      note: `R=${formatNumber(resistanceMilliohm, 2)} mΩ，X=${formatNumber(reactanceMilliohm, 2)} mΩ`,
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
      required: `Ib ≤ In ≤ Iz`,
      actual: `In=${formatNumber(breakerRatingA, 0)} A，Iz=${formatNumber(totalAmpacityA, 1)} A`,
      pass: protectionPass,
      note: breakerAuto ? 'In 为按计算电流自动匹配' : 'In 为手动输入值',
    },
  ]

  const overallPass = checks.every((check) => check.pass)
  const ampacityMarginPercent =
    designCurrentA > 0 ? ((totalAmpacityA - designCurrentA) / designCurrentA) * 100 : 0

  return {
    designPowerKw,
    designCurrentA,
    apparentPowerKva,
    temperatureFactor,
    groupFactor: groupingFactor,
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
    protectionPass,
    cableLabel,
    drivers,
    checks,
    warnings,
    overallPass,
  }
}
