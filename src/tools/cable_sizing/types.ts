/**
 * 低压电缆 / 导线选型（0.6/1 kV）的公共类型与标准截面序列。
 *
 * 这里只放类型与常量，计算逻辑在 cableSizing.ts，基础数据在 ampacityTables.ts，
 * 修正系数在 correctionFactors.ts。
 */

export type SystemType = 'three-phase' | 'single-phase' | 'dc'
export type Material = 'cu' | 'al'
export type Insulation = 'pvc' | 'xlpe'
export type InstallationMethod = 'A1' | 'A2' | 'B1' | 'B2' | 'C' | 'D' | 'E' | 'F' | 'G'
export type InputMode = 'power' | 'current'

/** 保护电器类型：决定过载保护按 In ≤ Iz 还是 In ≤ Iz/k3 校核 */
export type ProtectionDevice = 'mcb' | 'mccb' | 'fuse'

/** 埋地电缆间距（B.52.18 的列） */
export type BuriedSpacing = 'touching' | 'oneDiameter' | 'gap125' | 'gap250' | 'gap500'

export const STANDARD_SECTIONS = [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300,
] as const

export type CrossSection = (typeof STANDARD_SECTIONS)[number]

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
  /** 三次谐波含量（%，仅三相四线有意义） */
  harmonicThdPercent: number
  /** 保护电器类型 */
  protectionDevice: ProtectionDevice
  /** 埋地电缆间距（仅 D 直埋有意义） */
  buriedSpacing: BuriedSpacing
  /** 土壤热阻率（K·m/W，仅 D 直埋有意义） */
  soilThermalResistivity: number
  /** 是否校核电机启动压降 */
  motorStarting: boolean
  /** 启动电流倍数（× Ib） */
  startingCurrentMultiple: number
  /** 启动时允许电压降（%） */
  allowedStartingDropPercent: number
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
  /** 计入并联根数后的成束电缆根数 */
  groupingCount: number
  soilFactor: number
  harmonicFactor: number
  neutralCurrentA: number
  /** 用于载流量选型的电流（谐波 >33% 时取中性线电流） */
  ampacityDesignCurrentA: number
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
  protectionDevice: ProtectionDevice
  fuseK3: number | null
  protectionPass: boolean
  startingVoltageDropPercent: number | null
  startingPass: boolean | null
  cableLabel: string
  drivers: string[]
  checks: CheckResult[]
  warnings: string[]
  overallPass: boolean
}
