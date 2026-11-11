/**
 * 通信直流电源柜选型
 *
 * 容量侧依据 GB 51194-2016《通信电源设备安装工程设计规范》：
 * - 5.3.1 整流器、变换器容量按近期负荷配置；
 * - 5.3.2 组合电源整流模块数按近期负荷配置，满架容量考虑远期发展；
 * - 5.2 铅酸蓄电池组的均充电流按 10h 率（约 0.1C10）估算。
 *
 * 柜体侧：GB 51194 第 10.2 节只规定设备布置与维护间距，不规定柜体外形尺寸。
 * 本工具的宽×深×高为工程建议，尺寸系列参考 GB/T 3047.1-1995、
 * GB/T 19520.1-2007，最终以厂家型谱和机房条件为准。
 */

export type LoadInputMode = 'current' | 'power'
export type RedundancyMode = 'N' | 'N+1' | 'N+2'
export type AcPhase = 1 | 3

export interface DcCabinetInput {
  /** 直流标称电压：48 / 24 / 240 / 336 V */
  dcVoltage: number
  loadMode: LoadInputMode
  loadCurrentA: number
  loadPowerKw: number
  /** 远期 / 近期负荷比 */
  futureGrowth: number
  /** 蓄电池额定容量，Ah；0 表示暂不配置电池 */
  batteryAh: number
  /** 均充倍率，0.1 = 0.1C10 */
  chargeRate: number
  moduleCurrentA: number
  /** 模块降额系数，高温、高海拔按厂家曲线取 */
  moduleDerating: number
  redundancy: RedundancyMode
  /** 单个整流模块占用 U 数 */
  moduleU: number
  /** 监控、配电、备用等非模块占用 U 数 */
  reserveU: number
  cabinetHeightMm: number
  cabinetWidthMm: number
  cabinetDepthMm: number
  maxModulesPerCabinet: number
  acPhase: AcPhase
  acVoltage: number
  acPowerFactor: number
  rectifierEfficiency: number
  /** 断路器计算余量，常取 1.25 */
  breakerMargin: number
}

export interface CheckResult {
  key: string
  label: string
  required: string
  actual: string
  pass: boolean
  note: string
}

export interface CabinetSizeOption {
  heightMm: number
  usableU: number
  label: string
}

export interface DcCabinetResult {
  voltageLabel: string
  loadCurrentA: number
  chargeCurrentA: number
  designCurrentA: number
  frameCurrentA: number
  moduleEffectiveA: number
  mainModules: number
  redundantModules: number
  totalModules: number
  installedNameplateA: number
  installedEffectiveA: number
  frameMainModules: number
  frameModules: number
  frameCapacityA: number
  moduleSlots: number
  installedU: number
  frameU: number
  requiredU: number
  usableU: number
  cabinetCount: number
  selectedHeightMm: number
  selectedWidthMm: number
  selectedDepthMm: number
  recommendedHeightMm: number
  recommendedWidthMm: number
  recommendedDepthMm: number
  recommendedCount: number
  mainBreakerA: number
  dcOutputPowerKw: number
  acInputPowerKw: number
  acInputCurrentA: number
  acBreakerA: number
  checks: CheckResult[]
  warnings: string[]
  overallPass: boolean
  recommendation: string
}

export const STANDARD_BREAKERS: ReadonlyArray<number> = [
  16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250,
  1600, 2000, 2500, 3200, 4000,
]

/** 常用 19in 机柜高度与可用 U 数；不同厂家会有差异。 */
export const CABINET_HEIGHTS: ReadonlyArray<CabinetSizeOption> = [
  { heightMm: 1600, usableU: 32, label: '1600 mm / 32U' },
  { heightMm: 2000, usableU: 42, label: '2000 mm / 42U' },
  { heightMm: 2200, usableU: 46, label: '2200 mm / 46U' },
  { heightMm: 2600, usableU: 54, label: '2600 mm / 54U' },
]

export function createDefaultInput(): DcCabinetInput {
  return {
    dcVoltage: 48,
    loadMode: 'current',
    loadCurrentA: 200,
    loadPowerKw: 10,
    futureGrowth: 1.3,
    batteryAh: 500,
    chargeRate: 0.1,
    moduleCurrentA: 100,
    moduleDerating: 0.9,
    redundancy: 'N+1',
    moduleU: 1,
    reserveU: 8,
    cabinetHeightMm: 2000,
    cabinetWidthMm: 600,
    cabinetDepthMm: 600,
    maxModulesPerCabinet: 24,
    acPhase: 3,
    acVoltage: 380,
    acPowerFactor: 0.99,
    rectifierEfficiency: 0.92,
    breakerMargin: 1.25,
  }
}

/**
 * 简易模式固定值：只固定厂家 / 规范类参数，负荷侧输入（电压、负荷、远期比、
 * 电池容量、模块电流、冗余）仍由用户选择。
 *
 * 这些值全部是引擎合法输入，不改变 createDefaultInput() 与任何公式。
 */
export const SIMPLE_MODE_FIXED = {
  /** GB 51194 常用值，约 0.1C10 */
  chargeRate: 0.1,
  /** 高温 / 高海拔按厂家曲线取的常用降额 */
  moduleDerating: 0.9,
  moduleU: 1,
  /** 监控、配电、备用等非模块占用 U 数 */
  reserveU: 8,
  cabinetHeightMm: 2000,
  cabinetWidthMm: 600,
  cabinetDepthMm: 600,
  /** 常见 2 m 柜的单柜模块上限 */
  maxModulesPerCabinet: 24,
  /** 机房常规三相 380 V 进线 */
  acPhase: 3 as AcPhase,
  acVoltage: 380,
  /** 高频整流模块典型功率因数 */
  acPowerFactor: 0.99,
  /** 高频整流模块典型效率 */
  rectifierEfficiency: 0.92,
  /** 常用整定余量 */
  breakerMargin: 1.25,
} as const

/**
 * 简易模式默认输入：核心字段与 createDefaultInput 相同，其余按方案初选的假定值固定。
 *
 * 假定：0.1C10 均充、模块降额 0.9、模块 1U / 备用 8U、柜体 2000×600×600 mm、
 * 单柜最多 24 个模块、三相 380 V、PF 0.99、整流效率 0.92、断路器余量 1.25。
 *
 * 这里只是输入值组合，不改变引擎口径；专业模式仍使用 createDefaultInput()。
 */
export function createSimpleInput(overrides: Partial<DcCabinetInput> = {}): DcCabinetInput {
  return {
    ...createDefaultInput(),
    ...overrides,
    chargeRate: SIMPLE_MODE_FIXED.chargeRate,
    moduleDerating: SIMPLE_MODE_FIXED.moduleDerating,
    moduleU: SIMPLE_MODE_FIXED.moduleU,
    reserveU: SIMPLE_MODE_FIXED.reserveU,
    cabinetHeightMm: SIMPLE_MODE_FIXED.cabinetHeightMm,
    cabinetWidthMm: SIMPLE_MODE_FIXED.cabinetWidthMm,
    cabinetDepthMm: SIMPLE_MODE_FIXED.cabinetDepthMm,
    maxModulesPerCabinet: SIMPLE_MODE_FIXED.maxModulesPerCabinet,
    acPhase: SIMPLE_MODE_FIXED.acPhase,
    acVoltage: SIMPLE_MODE_FIXED.acVoltage,
    acPowerFactor: SIMPLE_MODE_FIXED.acPowerFactor,
    rectifierEfficiency: SIMPLE_MODE_FIXED.rectifierEfficiency,
    breakerMargin: SIMPLE_MODE_FIXED.breakerMargin,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function formatNumber(value: number, digits = 1): string {
  return value.toFixed(digits)
}

export function voltageLabelFor(value: number): string {
  if (value === 48) return '-48V'
  if (value === 24) return '-24V'
  return `${value}V`
}

/** 向上取标准断路器壳架电流。 */
export function nextStandardBreaker(value: number): number {
  const match = STANDARD_BREAKERS.find((candidate) => candidate >= value)
  return match ?? STANDARD_BREAKERS[STANDARD_BREAKERS.length - 1] ?? value
}

/** 按所选柜高取可用 U 数。 */
export function usableUForHeight(heightMm: number): number {
  const match = CABINET_HEIGHTS.find((option) => option.heightMm === heightMm)
  return match?.usableU ?? 42
}

function recommendCabinetSize(
  requiredU: number,
  moduleSlots: number,
  maxModulesPerCabinet: number,
): { heightMm: number; count: number; widthMm: number; depthMm: number } {
  // 室内通信电源柜通常以 2000 mm 为起点；1600 mm 留给小型/室外场景手动选择。
  const candidates = CABINET_HEIGHTS.filter((option) => option.heightMm >= 2000)
  let best: { heightMm: number; count: number; waste: number } | null = null

  for (const option of candidates) {
    const count = Math.max(
      1,
      Math.ceil(requiredU / option.usableU),
      Math.ceil(moduleSlots / Math.max(1, maxModulesPerCabinet)),
    )
    const waste = count * option.usableU - requiredU
    if (
      !best ||
      count < best.count ||
      (count === best.count && waste < best.waste) ||
      (count === best.count && waste === best.waste && option.heightMm < best.heightMm)
    ) {
      best = { heightMm: option.heightMm, count, waste }
    }
  }

  return {
    heightMm: best?.heightMm ?? 2000,
    count: best?.count ?? 1,
    widthMm: 600,
    depthMm: 600,
  }
}

export function calculateDcCabinet(input: DcCabinetInput): DcCabinetResult | null {
  const warnings: string[] = []

  const dcVoltage = Number(input.dcVoltage)
  const loadCurrentInput = Number(input.loadCurrentA)
  const loadPowerKw = Number(input.loadPowerKw)
  const futureGrowth = Number(input.futureGrowth)
  const batteryAh = Number(input.batteryAh)
  const chargeRate = Number(input.chargeRate)
  const moduleCurrentA = Number(input.moduleCurrentA)
  const moduleDerating = Number(input.moduleDerating)
  const moduleU = Number(input.moduleU)
  const reserveU = Number(input.reserveU)
  const cabinetHeightMm = Number(input.cabinetHeightMm)
  const cabinetWidthMm = Number(input.cabinetWidthMm)
  const cabinetDepthMm = Number(input.cabinetDepthMm)
  const maxModulesPerCabinet = Number(input.maxModulesPerCabinet)
  const acVoltage = Number(input.acVoltage)
  const acPowerFactor = Number(input.acPowerFactor)
  const rectifierEfficiency = Number(input.rectifierEfficiency)
  const breakerMargin = Number(input.breakerMargin)

  if (!Number.isFinite(dcVoltage) || dcVoltage <= 0) return null
  if (!Number.isFinite(loadCurrentInput) || loadCurrentInput < 0) return null
  if (!Number.isFinite(loadPowerKw) || loadPowerKw < 0) return null
  if (!Number.isFinite(futureGrowth) || futureGrowth < 1) return null
  if (!Number.isFinite(batteryAh) || batteryAh < 0) return null
  if (!Number.isFinite(chargeRate) || chargeRate < 0 || chargeRate > 1) return null
  if (!Number.isFinite(moduleCurrentA) || moduleCurrentA <= 0) return null
  if (!Number.isFinite(moduleDerating) || moduleDerating <= 0 || moduleDerating > 1.2) return null
  if (!Number.isFinite(moduleU) || moduleU <= 0) return null
  if (!Number.isFinite(reserveU) || reserveU < 0) return null
  if (!Number.isFinite(cabinetHeightMm) || cabinetHeightMm <= 0) return null
  if (!Number.isFinite(cabinetWidthMm) || cabinetWidthMm <= 0) return null
  if (!Number.isFinite(cabinetDepthMm) || cabinetDepthMm <= 0) return null
  if (!Number.isFinite(maxModulesPerCabinet) || maxModulesPerCabinet < 1) return null
  if (!Number.isFinite(acVoltage) || acVoltage <= 0) return null
  if (!Number.isFinite(acPowerFactor) || acPowerFactor <= 0 || acPowerFactor > 1) return null
  if (!Number.isFinite(rectifierEfficiency) || rectifierEfficiency <= 0 || rectifierEfficiency > 1)
    return null
  if (!Number.isFinite(breakerMargin) || breakerMargin < 1) return null

  const loadCurrentA =
    input.loadMode === 'current' ? loadCurrentInput : (loadPowerKw * 1000) / dcVoltage

  if (!Number.isFinite(loadCurrentA) || loadCurrentA <= 0) return null

  const chargeCurrentA = batteryAh * chargeRate
  const designCurrentA = loadCurrentA + chargeCurrentA
  const frameCurrentA = designCurrentA * futureGrowth
  const moduleEffectiveA = moduleCurrentA * moduleDerating

  const mainModules = Math.max(1, Math.ceil(designCurrentA / moduleEffectiveA))
  const redundantModules = input.redundancy === 'N' ? 0 : input.redundancy === 'N+1' ? 1 : 2
  const totalModules = mainModules + redundantModules
  const installedNameplateA = totalModules * moduleCurrentA
  const installedEffectiveA = totalModules * moduleEffectiveA

  const frameMainModules = Math.max(1, Math.ceil(frameCurrentA / moduleEffectiveA))
  const frameModules = frameMainModules + redundantModules
  const frameCapacityA = frameModules * moduleEffectiveA

  const installedU = totalModules * moduleU + reserveU
  const frameU = frameModules * moduleU + reserveU
  const requiredU = Math.max(installedU, frameU)

  const usableU = usableUForHeight(cabinetHeightMm)
  const cabinetCount = Math.max(
    1,
    Math.ceil(requiredU / usableU),
    Math.ceil(Math.max(totalModules, frameModules) / maxModulesPerCabinet),
  )

  const recommended = recommendCabinetSize(
    requiredU,
    Math.max(totalModules, frameModules),
    maxModulesPerCabinet,
  )

  const recommendedWidthMm =
    installedNameplateA > 600 || Math.max(totalModules, frameModules) > 16 ? 800 : 600
  const recommendedDepthMm = installedNameplateA > 1000 ? 800 : 600

  const mainBreakerA = nextStandardBreaker(designCurrentA * breakerMargin)
  const dcOutputPowerKw = (designCurrentA * dcVoltage) / 1000
  const acInputPowerKw = dcOutputPowerKw / rectifierEfficiency
  const acInputCurrentA =
    input.acPhase === 3
      ? (acInputPowerKw * 1000) / (Math.sqrt(3) * acVoltage * acPowerFactor)
      : (acInputPowerKw * 1000) / (acVoltage * acPowerFactor)
  const acBreakerA = nextStandardBreaker(acInputCurrentA * breakerMargin)

  const checks: CheckResult[] = [
    {
      key: 'capacity',
      label: '整流容量',
      required: `≥ ${formatNumber(designCurrentA, 1)} A（近期负荷 + 均充）`,
      actual: `${formatNumber(installedEffectiveA, 1)} A（降额后）/ ${formatNumber(installedNameplateA, 0)} A 标称`,
      pass: installedEffectiveA >= designCurrentA - 1e-6,
      note: 'GB 51194 5.3.1：整流器容量按近期负荷配置',
    },
    {
      key: 'redundancy',
      label: '冗余配置',
      required: `${input.redundancy}（${redundantModules} 个备用模块）`,
      actual: `${mainModules} 主用 + ${redundantModules} 备用 = ${totalModules} 个`,
      pass: totalModules - mainModules >= redundantModules,
      note: '常用 N+1；备用模块也参与降额后的容量校核',
    },
    {
      key: 'frame',
      label: '满架容量',
      required: `≥ ${formatNumber(frameCurrentA, 1)} A（远期）`,
      actual: `${formatNumber(frameCapacityA, 1)} A（${frameModules} 个模块槽位）`,
      pass: frameCapacityA >= frameCurrentA - 1e-6,
      note: 'GB 51194 5.3.2：模块数按近期配置，满架容量考虑远期',
    },
    {
      key: 'module-slots',
      label: '模块槽位',
      required: `≤ ${maxModulesPerCabinet} 个/柜 × ${cabinetCount} 柜`,
      actual: `${Math.max(totalModules, frameModules)} 个槽位`,
      pass: Math.max(totalModules, frameModules) <= maxModulesPerCabinet * cabinetCount,
      note: '按所选柜高的模块安装数量校核',
    },
    {
      key: 'u-height',
      label: '柜内 U 位',
      required: `≤ ${usableU}U × ${cabinetCount} 柜`,
      actual: `占用 ${formatNumber(requiredU, 0)}U（模块 + 监控/配电/备用）`,
      pass: requiredU <= usableU * cabinetCount + 1e-6,
      note: 'U 位按远期模块槽位预留，避免后期无空间扩容',
    },
    {
      key: 'dc-breaker',
      label: '直流主断路器',
      required: `≥ ${formatNumber(designCurrentA * breakerMargin, 1)} A（1.25 倍）`,
      actual: `${formatNumber(mainBreakerA, 0)} A 标准壳架`,
      pass: mainBreakerA >= designCurrentA,
      note: '按计算电流乘余量后向上取标准壳架，最终按保护选择性校验',
    },
    {
      key: 'ac-breaker',
      label: '交流输入断路器',
      required: `≥ ${formatNumber(acInputCurrentA * breakerMargin, 1)} A（1.25 倍）`,
      actual: `${formatNumber(acBreakerA, 0)} A 标准壳架`,
      pass: acBreakerA >= acInputCurrentA,
      note: '按整流效率、功率因数和交流相数估算',
    },
  ]

  if (batteryAh <= 0) {
    warnings.push('未填写蓄电池容量，均充电流按 0 计；实际配置电池后应补充 Ah 并重新校核整流容量。')
  }
  if (chargeRate > 0.15) {
    warnings.push(
      `均充倍率 ${formatNumber(chargeRate, 2)}C 偏高，请核对电池厂家均充电流；常用 10h 率约 0.1C10。`,
    )
  }
  if (moduleDerating < 0.9) {
    warnings.push(
      `模块降额系数 ${formatNumber(moduleDerating, 2)} 已计入，高温、高海拔场景应按厂家降额曲线复核。`,
    )
  }
  if (input.redundancy === 'N') {
    warnings.push('当前为 N 配置，无备用模块；通信局站通常建议 N+1，重要局站可考虑 N+2。')
  }
  if (frameModules > totalModules) {
    warnings.push(
      `满架预留 ${frameModules - totalModules} 个模块槽位，柜体 U 位和配电分路应按远期一次预留。`,
    )
  }
  if (cabinetCount > 1) {
    warnings.push(
      `单柜容量不足，建议 ${cabinetCount} 面柜并联；多柜需校验均流、直流汇接和保护选择性。`,
    )
  }
  if (dcVoltage >= 240) {
    warnings.push(
      `${dcVoltage}V 直流系统绝缘、防触电、直流拉弧和保护选择性要求与 -48V 不同，需专项校核。`,
    )
  }
  if (batteryAh > 0) {
    warnings.push('均充电流按 0.1C10 估算；实际应以电池厂家均充电流和充电机限流值为准。')
  }
  warnings.push(
    '柜体宽×深×高为工程建议，GB 51194 不规定柜体外形尺寸；尺寸系列参考 GB/T 3047.1-1995、GB/T 19520.1-2007，最终按厂家型谱和机房条件确认。',
  )
  warnings.push(
    '电池与电源柜同室布置时，应按 GB 51194 第 10 章校核维护间距、通风、承重和消防要求。',
  )

  const overallPass = checks.every((check) => check.pass)
  const recommendation = `${voltageLabelFor(dcVoltage)} / ${formatNumber(installedNameplateA, 0)}A 组合电源柜；${formatNumber(moduleCurrentA, 0)}A × ${totalModules}（${mainModules}+${redundantModules}）；柜体 ${formatNumber(recommendedWidthMm, 0)}×${formatNumber(recommendedDepthMm, 0)}×${formatNumber(recommended.heightMm, 0)} mm × ${recommended.count}`

  return {
    voltageLabel: voltageLabelFor(dcVoltage),
    loadCurrentA,
    chargeCurrentA,
    designCurrentA,
    frameCurrentA,
    moduleEffectiveA,
    mainModules,
    redundantModules,
    totalModules,
    installedNameplateA,
    installedEffectiveA,
    frameMainModules,
    frameModules,
    frameCapacityA,
    moduleSlots: Math.max(totalModules, frameModules),
    installedU,
    frameU,
    requiredU,
    usableU,
    cabinetCount,
    selectedHeightMm: cabinetHeightMm,
    selectedWidthMm: cabinetWidthMm,
    selectedDepthMm: cabinetDepthMm,
    recommendedHeightMm: recommended.heightMm,
    recommendedWidthMm: clamp(recommendedWidthMm, 400, 1200),
    recommendedDepthMm: clamp(recommendedDepthMm, 400, 1200),
    recommendedCount: recommended.count,
    mainBreakerA,
    dcOutputPowerKw,
    acInputPowerKw,
    acInputCurrentA,
    acBreakerA,
    checks,
    warnings,
    overallPass,
    recommendation,
  }
}
