/**
 * 机房 / UPS 蓄电池容量估算
 *
 * 铅酸：按 GB 51194-2016《通信电源设备安装工程设计规范》的安时法估算，
 *       并用恒功率法（W/单体）提示厂家放电表校核。
 * 锂电：按能量法计算，叠加 DOD、SOH、温度降额与最大放电倍率校核。
 *
 * 说明：
 * - GB 50174-2017 只规定 UPS 电池最少备用时间，不规定容量算法；
 * - 内置放电容量系数为常用典型值，正式设计应以现行标准表格和厂家数据为准；
 * - 本工具用于方案初选，不能替代注册电气工程师的施工图计算。
 */

export type BatteryType = 'lead-acid' | 'lithium'
export type LoadMode = 'ups' | 'power'
export type CellVoltage = 2 | 12

export interface BatterySizingInput {
  batteryType: BatteryType
  loadMode: LoadMode
  upsKva: number
  loadRate: number
  powerFactor: number
  loadPowerKw: number
  backupMinutes: number
  efficiency: number
  lineEfficiency: number
  ambientTempC: number
  dcVoltage: number
  cellVoltage: CellVoltage
  endVoltagePerCell: number
  dcMinVoltage: number
  designMargin: number
  capacityCoefficient: number
  manufacturerWPerCell: number
  maxParallelStrings: number
  dod: number
  soh: number
  tempDerating: number
  maxCRate: number
}

export interface CheckResult {
  key: string
  label: string
  required: string
  actual: string
  pass: boolean
  note: string
}

export interface BatterySizingResult {
  batteryType: BatteryType
  loadPowerKw: number
  backupHours: number
  backupMinutes: number
  dcVoltageActual: number
  seriesUnits: number
  seriesCells: number
  endVoltageActual: number
  dischargeCurrentA: number
  requiredAh: number
  unitAh: number
  parallelStrings: number
  configuredAh: number
  configuredEnergyKwh: number
  estimatedRuntimeMinutes: number
  alpha: number
  temperatureFactor: number
  capacityCoefficient: number
  requiredWPerCell: number
  manufacturerWPerCell: number
  powerCheckPass: boolean
  baseEnergyKwh: number
  requiredEnergyKwh: number
  cRate: number
  minAhByCRate: number
  checks: CheckResult[]
  warnings: string[]
  overallPass: boolean
}

export const STANDARD_AH: ReadonlyArray<number> = [
  7, 9, 12, 17, 24, 26, 33, 38, 40, 50, 55, 65, 75, 80, 90, 100, 120, 134, 150, 200, 230, 250,
  280, 300, 314, 400, 500, 600, 800, 1000, 1200, 1500, 2000, 3000,
]

/** 常用 VRLA 放电容量系数的典型值（10h 额定容量为 1.0），正式设计请查标准表/厂家表。 */
const CAPACITY_COEFFICIENT_TABLE: ReadonlyArray<readonly [number, number]> = [
  [0.5, 0.42],
  [1, 0.52],
  [2, 0.61],
  [3, 0.7],
  [4, 0.76],
  [5, 0.8],
  [6, 0.84],
  [8, 0.91],
  [10, 1.0],
]

const MAX_UNIT_AH = 1000

export function createDefaultInput(): BatterySizingInput {
  return {
    batteryType: 'lead-acid',
    loadMode: 'ups',
    upsKva: 100,
    loadRate: 0.8,
    powerFactor: 0.9,
    loadPowerKw: 72,
    backupMinutes: 30,
    efficiency: 0.95,
    lineEfficiency: 0.99,
    ambientTempC: 25,
    dcVoltage: 480,
    cellVoltage: 12,
    endVoltagePerCell: 1.75,
    dcMinVoltage: 0,
    designMargin: 1.25,
    capacityCoefficient: 0.42,
    manufacturerWPerCell: 0,
    maxParallelStrings: 4,
    dod: 0.9,
    soh: 0.8,
    tempDerating: 1,
    maxCRate: 1,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 按备电小时数取典型放电容量系数，线性插值。 */
export function capacityCoefficientForHours(hours: number): number {
  const table = CAPACITY_COEFFICIENT_TABLE
  const first = table[0]
  const last = table[table.length - 1]
  if (!first || !last) return 0.6
  if (hours <= first[0]) return first[1]
  if (hours >= last[0]) return last[1]

  for (let i = 1; i < table.length; i += 1) {
    const previous = table[i - 1]
    const current = table[i]
    if (!previous || !current) continue
    if (hours <= current[0]) {
      const ratio = (hours - previous[0]) / (current[0] - previous[0])
      return previous[1] + ratio * (current[1] - previous[1])
    }
  }
  return last[1]
}

/** 温度系数 α：放电小时率 ≥10h 取 0.006，1~10h 取 0.008，<1h 取 0.01。 */
export function alphaForHours(hours: number): number {
  if (hours >= 10) return 0.006
  if (hours >= 1) return 0.008
  return 0.01
}

export function nextStandardAh(value: number): number {
  const match = STANDARD_AH.find((candidate) => candidate >= value)
  return match ?? STANDARD_AH[STANDARD_AH.length - 1] ?? value
}

function formatNumber(value: number, digits = 1): string {
  return value.toFixed(digits)
}

export function calculateBatterySizing(input: BatterySizingInput): BatterySizingResult | null {
  const warnings: string[] = []

  const backupMinutes = Number(input.backupMinutes)
  const dcVoltage = Number(input.dcVoltage)
  const efficiency = Number(input.efficiency)
  const lineEfficiency = Number(input.lineEfficiency)
  const designMargin = Number(input.designMargin)
  const ambientTempC = Number(input.ambientTempC)
  const dcMinVoltage = Math.max(0, Number(input.dcMinVoltage) || 0)

  if (!Number.isFinite(backupMinutes) || backupMinutes <= 0) return null
  if (!Number.isFinite(dcVoltage) || dcVoltage <= 0) return null
  if (!Number.isFinite(efficiency) || efficiency <= 0 || efficiency > 1) return null
  if (!Number.isFinite(lineEfficiency) || lineEfficiency <= 0 || lineEfficiency > 1) return null
  if (!Number.isFinite(designMargin) || designMargin < 1) return null
  if (!Number.isFinite(ambientTempC)) return null

  const loadPowerKw =
    input.loadMode === 'ups'
      ? (Number(input.upsKva) * Number(input.loadRate) * Number(input.powerFactor)) / 1
      : Number(input.loadPowerKw)

  if (!Number.isFinite(loadPowerKw) || loadPowerKw <= 0) return null

  const backupHours = backupMinutes / 60
  const isLeadAcid = input.batteryType === 'lead-acid'

  let dcVoltageActual = dcVoltage
  let seriesUnits = 0
  let seriesCells = 0
  let endVoltageActual = 0

  if (isLeadAcid) {
    const cellVoltage = input.cellVoltage === 2 ? 2 : 12
    seriesUnits = Math.max(1, Math.round(dcVoltage / cellVoltage))
    dcVoltageActual = seriesUnits * cellVoltage
    seriesCells = seriesUnits * (cellVoltage === 12 ? 6 : 1)
    endVoltageActual =
      seriesCells * clamp(Number(input.endVoltagePerCell) || 1.75, 1.5, 1.9)
    if (seriesUnits < 1) return null
  }

  const dischargeCurrentA = (loadPowerKw * 1000) / (dcVoltageActual * efficiency * lineEfficiency)
  if (!Number.isFinite(dischargeCurrentA) || dischargeCurrentA <= 0) return null

  let requiredAh = 0
  let unitAh = 0
  let parallelStrings = 0
  let configuredAh = 0
  let configuredEnergyKwh = 0
  let estimatedRuntimeMinutes = 0
  let alpha = 0
  let temperatureFactor = 1
  let capacityCoefficient = 0
  let requiredWPerCell = 0
  let manufacturerWPerCell = 0
  let powerCheckPass = true
  let baseEnergyKwh = 0
  let requiredEnergyKwh = 0
  let cRate = 0
  let minAhByCRate = 0
  const checks: CheckResult[] = []

  if (isLeadAcid) {
    alpha = alphaForHours(backupHours)
    temperatureFactor = Math.max(0.5, 1 + alpha * (ambientTempC - 25))
    capacityCoefficient = clamp(Number(input.capacityCoefficient), 0.1, 1.2)

    requiredAh =
      (designMargin * dischargeCurrentA * backupHours) /
      (capacityCoefficient * temperatureFactor)

    parallelStrings = Math.max(1, Math.ceil(requiredAh / MAX_UNIT_AH))
    unitAh = nextStandardAh(requiredAh / parallelStrings)
    configuredAh = unitAh * parallelStrings

    requiredWPerCell =
      (loadPowerKw * 1000 * designMargin) / (seriesCells * efficiency * lineEfficiency)
    manufacturerWPerCell = Math.max(0, Number(input.manufacturerWPerCell) || 0)
    powerCheckPass = manufacturerWPerCell <= 0 || manufacturerWPerCell >= requiredWPerCell

    estimatedRuntimeMinutes =
      requiredAh > 0 ? backupMinutes * (configuredAh / requiredAh) : backupMinutes

    checks.push({
      key: 'capacity',
      label: '安时容量',
      required: `Q ≥ ${formatNumber(requiredAh, 1)} Ah`,
      actual: `${formatNumber(configuredAh, 0)} Ah（${formatNumber(unitAh, 0)} Ah × ${parallelStrings} 组）`,
      pass: configuredAh >= requiredAh - 1e-6,
      note: `K=${formatNumber(designMargin, 2)}，η=${formatNumber(capacityCoefficient, 2)}，kt=${formatNumber(temperatureFactor, 2)}`,
    })

    checks.push({
      key: 'parallel',
      label: '并联组数',
      required: `≤ ${formatNumber(input.maxParallelStrings, 0)} 组`,
      actual: `${parallelStrings} 组`,
      pass: parallelStrings <= Math.max(1, Math.round(input.maxParallelStrings)),
      note: 'GB 51194 建议 UPS 电池组并联不超过 4 组',
    })

    checks.push({
      key: 'voltage',
      label: '终止电压',
      required: dcMinVoltage > 0 ? `≥ UPS 最低直流输入 ${formatNumber(dcMinVoltage, 0)} V` : '未设置最低直流输入',
      actual: `${formatNumber(endVoltageActual, 0)} V（${formatNumber(input.endVoltagePerCell, 2)} V/单体）`,
      pass: dcMinVoltage <= 0 || endVoltageActual >= dcMinVoltage - 1e-6,
      note: '按电池组终止电压与 UPS 直流输入下限比较',
    })

    checks.push({
      key: 'power',
      label: '恒功率校核',
      required: `≥ ${formatNumber(requiredWPerCell, 1)} W/单体`,
      actual:
        manufacturerWPerCell > 0
          ? `${formatNumber(manufacturerWPerCell, 1)} W/单体（厂家表）`
          : '未输入厂家 W/单体',
      pass: powerCheckPass,
      note:
        manufacturerWPerCell > 0
          ? '按厂家恒功率放电表，在备电时长和终止电压下比较'
          : '仅安时法估算，建议补充厂家恒功率表复核',
    })

    if (backupHours < 1) {
      warnings.push(
        `备电时长 ${formatNumber(backupMinutes, 0)} min 小于 1h，安时法对短时大电流放电偏差较大，务必用厂家恒功率放电表复核。`,
      )
    }
    if (manufacturerWPerCell <= 0) {
      warnings.push('未输入厂家 W/单体，当前结果仅为安时法初选；正式选型应查对应备电时长和终止电压的恒功率表。')
    }
    if (ambientTempC < 5) {
      warnings.push(
        `最低环境温度 ${formatNumber(ambientTempC, 0)} ℃ 偏低，已按 α=${alpha} 修正容量，仍需确认电池低温放电能力。`,
      )
    }
    if (ambientTempC > 30) {
      warnings.push(
        `环境温度 ${formatNumber(ambientTempC, 0)} ℃ 偏高，铅酸电池寿命会明显缩短，建议电池室控制在 20~25 ℃。`,
      )
    }
    if (parallelStrings > 1) {
      warnings.push('多组并联需同规格、同长度、同敷设路径，并校验均流与保护配合。')
    }
    if (parallelStrings > Math.max(1, Math.round(input.maxParallelStrings))) {
      warnings.push('并联组数超过设定限值，请增大单只容量、减少并联或调整电池方案。')
    }
  } else {
    if (input.dod <= 0 || input.dod > 1) return null
    if (input.soh <= 0 || input.soh > 1) return null
    if (input.tempDerating <= 0) return null
    if (input.maxCRate <= 0) return null

    const dod = clamp(Number(input.dod), 0.1, 1)
    const soh = clamp(Number(input.soh), 0.1, 1)
    const tempDerating = clamp(Number(input.tempDerating), 0.1, 2)
    const maxCRate = clamp(Number(input.maxCRate), 0.1, 10)

    requiredEnergyKwh =
      ((loadPowerKw * backupHours) / (efficiency * lineEfficiency)) *
      (designMargin / (dod * soh * tempDerating))
    baseEnergyKwh = (loadPowerKw * backupHours) / (efficiency * lineEfficiency)
    requiredAh = (requiredEnergyKwh * 1000) / dcVoltageActual
    minAhByCRate = dischargeCurrentA / maxCRate
    const requiredAhWithRate = Math.max(requiredAh, minAhByCRate)
    unitAh = nextStandardAh(requiredAhWithRate)
    parallelStrings = 0
    configuredAh = unitAh
    configuredEnergyKwh = (configuredAh * dcVoltageActual) / 1000
    cRate = dischargeCurrentA / configuredAh
    estimatedRuntimeMinutes =
      (configuredEnergyKwh * dod * soh * tempDerating * efficiency * lineEfficiency * 60) /
      loadPowerKw

    checks.push({
      key: 'energy',
      label: '能量容量',
      required: `E ≥ ${formatNumber(requiredEnergyKwh, 1)} kWh`,
      actual: `${formatNumber(configuredEnergyKwh, 1)} kWh（${formatNumber(configuredAh, 0)} Ah）`,
      pass: configuredEnergyKwh >= requiredEnergyKwh - 1e-6,
      note: `DOD=${formatNumber(dod, 2)}，SOH=${formatNumber(soh, 2)}，KT=${formatNumber(tempDerating, 2)}`,
    })

    checks.push({
      key: 'c-rate',
      label: '放电倍率',
      required: `≤ ${formatNumber(maxCRate, 2)} C`,
      actual: `${formatNumber(cRate, 2)} C（${formatNumber(dischargeCurrentA, 1)} A）`,
      pass: cRate <= maxCRate + 1e-6,
      note: `按 ${formatNumber(dcVoltageActual, 0)} V 直流母线计算`,
    })

    checks.push({
      key: 'temperature',
      label: '温度降额',
      required: '按厂家温度曲线取值',
      actual: `KT=${formatNumber(tempDerating, 2)}，环境 ${formatNumber(ambientTempC, 0)} ℃`,
      pass: tempDerating >= 0.8,
      note: '低温容量下降；高温加速老化并增加热失控风险',
    })

    warnings.push('锂电按能量法计算，不能套用铅酸温度系数 α；最终容量应以厂家放电曲线和 BMS 限值为准。')
    if (ambientTempC < 0) {
      warnings.push('环境温度低于 0 ℃，多数锂电禁止充电，需配置加热或降低充电电流。')
    }
    if (ambientTempC > 35) {
      warnings.push('环境温度高于 35 ℃，锂电老化加快，需加强热管理与消防措施。')
    }
    if (tempDerating < 0.9) {
      warnings.push(`已按 KT=${formatNumber(tempDerating, 2)} 做温度降额，请确认厂家低温放电曲线。`)
    }
    if (cRate > maxCRate) {
      warnings.push('放电倍率超过设定上限，需增大容量、提高并联或选用高倍率电芯。')
    }
    if (minAhByCRate > requiredAh) {
      warnings.push('当前配置由最大放电倍率控制，而不是由备电能量控制。')
    }
    if (input.maxCRate >= 2) {
      warnings.push('高倍率放电会降低可用容量并增加发热，需用厂家倍率曲线复核。')
    }
  }

  const overallPass = checks.every((check) => check.pass)

  return {
    batteryType: input.batteryType,
    loadPowerKw,
    backupHours,
    backupMinutes,
    dcVoltageActual,
    seriesUnits,
    seriesCells,
    endVoltageActual,
    dischargeCurrentA,
    requiredAh,
    unitAh,
    parallelStrings,
    configuredAh,
    configuredEnergyKwh,
    estimatedRuntimeMinutes,
    alpha,
    temperatureFactor,
    capacityCoefficient,
    requiredWPerCell,
    manufacturerWPerCell,
    powerCheckPass,
    baseEnergyKwh,
    requiredEnergyKwh,
    cRate,
    minAhByCRate,
    checks,
    warnings,
    overallPass,
  }
}
