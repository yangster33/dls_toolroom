/**
 * 通信机房空调冷负荷 / 制冷量估算
 *
 * 计算依据：
 * - GB 50174-2017《数据中心设计规范》7.2.1~7.2.3、7.5.3；
 * - YD/T 5003《信息通信建筑工程设计规范》（现行 2025 版；2014 版 9.2.4~9.2.6 可作参考）；
 * - GB 50736-2012 / GB 50019-2015 的逐时冷负荷计算方法；
 * - GB/T 19413-2024《数据中心和通信机房用空气调节机组》。
 *
 * 边界：
 * - 本工具用于方案初选和设计复核，不替代施工图逐时冷负荷计算；
 * - 面积指标、匹数换算均为行业经验值，不是国家标准强制规定；
 * - 设备制冷量还应按厂家样本做海拔、室外温度、管路长度等修正。
 */

export type RoomTypeKey =
  | 'telecom'
  | 'data_center'
  | 'financial'
  | 'computer'
  | 'auxiliary'
  | 'custom'

export type CalculationMode = 'detailed' | 'area'
export type RedundancyMode = 'none' | 'n+1' | '2n'
export type AcUnitType = 'precision' | 'comfort' | 'chilled-water' | 'base-station'
export type FreshAirMode = 'airflow' | 'load'

export interface RoomTypePreset {
  key: RoomTypeKey
  label: string
  areaIndexWPerM2: number
  areaIndexRange: readonly [number, number]
  defaultSensibleRatio: number
  description: string
}

export interface AcUnitTypeOption {
  key: AcUnitType
  label: string
  defaultSensibleRatio: number
  description: string
}

export interface HvacCoolingInput {
  roomType: RoomTypeKey
  calculationMode: CalculationMode
  areaM2: number
  areaIndexWPerM2: number

  itPowerKw: number
  heatFactor: number
  powerLossKw: number
  envelopeLoadKw: number
  lightingWPerM2: number
  peopleCount: number
  peopleWPerPerson: number
  freshAirMode: FreshAirMode
  freshAirM3h: number
  freshAirDeltaHKjKg: number
  freshAirLoadKw: number
  otherLoadKw: number

  designMargin: number
  redundancy: RedundancyMode
  unitType: AcUnitType
  unitCapacityKw: number
  runningUnitCount: number
  loadSensibleRatio: number
  unitSensibleRatio: number
  correctionFactor: number
  pBasisKw: number
}

export interface LoadItem {
  key: string
  label: string
  kw: number
  percent: number
  note: string
}

export interface CheckResult {
  key: string
  label: string
  required: string
  actual: string
  pass: boolean
  note: string
}

export interface HvacCoolingResult {
  roomType: RoomTypeKey
  calculationMode: CalculationMode
  areaM2: number
  totalLoadKw: number
  designLoadKw: number
  requiredCapacityKw: number
  sensibleLoadKw: number
  latentLoadKw: number
  loadSensibleRatio: number
  areaIndexActualWPerM2: number
  loadItems: LoadItem[]

  pBasisKw: number
  pValue: number
  rtValue: number

  unitType: AcUnitType
  unitCapacityKw: number
  runningCount: number
  backupCount: number
  installedCount: number
  installedCapacityKw: number
  runningCapacityKw: number
  faultCapacityKw: number
  unitLoadRate: number
  unitSensibleRatio: number
  unitSensibleCapacityKw: number

  designMargin: number
  correctionFactor: number
  /** 控制最终选型的约束，如 ['运行冷量', '单台负载率'] */
  drivers: string[]
  checks: CheckResult[]
  warnings: string[]
  overallPass: boolean
}

export const ROOM_TYPE_PRESETS: readonly RoomTypePreset[] = [
  {
    key: 'telecom',
    label: '通信交换机房 / 基站',
    areaIndexWPerM2: 400,
    areaIndexRange: [350, 450],
    defaultSensibleRatio: 0.9,
    description: '交换、传输、路由等通信设备为主，设备密度中等。',
  },
  {
    key: 'data_center',
    label: '数据中心 / IDC',
    areaIndexWPerM2: 800,
    areaIndexRange: [600, 1200],
    defaultSensibleRatio: 0.9,
    description: '服务器、存储、网络设备为主，热密度高，按机柜功率复核。',
  },
  {
    key: 'financial',
    label: '金融机房',
    areaIndexWPerM2: 550,
    areaIndexRange: [500, 600],
    defaultSensibleRatio: 0.9,
    description: '金融行业机房，设备密度和可靠性要求较高。',
  },
  {
    key: 'computer',
    label: '计算机房 / 控制中心',
    areaIndexWPerM2: 400,
    areaIndexRange: [350, 450],
    defaultSensibleRatio: 0.9,
    description: '计算机、控制、计费等设备为主。',
  },
  {
    key: 'auxiliary',
    label: '辅助机房 / 值班室',
    areaIndexWPerM2: 200,
    areaIndexRange: [150, 250],
    defaultSensibleRatio: 0.85,
    description: '设备少、人员停留较多，可选用舒适性空调。',
  },
  {
    key: 'custom',
    label: '自定义',
    areaIndexWPerM2: 400,
    areaIndexRange: [0, 5000],
    defaultSensibleRatio: 0.9,
    description: '按实际设备功率和围护结构逐项计算，不套用经验指标。',
  },
]

export const AC_UNIT_TYPE_OPTIONS: readonly AcUnitTypeOption[] = [
  {
    key: 'precision',
    label: '机房专用空调（精密空调）',
    defaultSensibleRatio: 0.9,
    description: '恒温恒湿、显热比高、可全年连续运行，通信主机房首选。',
  },
  {
    key: 'comfort',
    label: '舒适性分体 / 柜机',
    defaultSensibleRatio: 0.75,
    description: '显热比低、无恒湿、寿命短，只建议用于辅助房间。',
  },
  {
    key: 'chilled-water',
    label: '中央空调 / 冷水机组',
    defaultSensibleRatio: 0.9,
    description: '按 kW 或冷吨选型，适合大型数据中心和集中冷源。',
  },
  {
    key: 'base-station',
    label: '基站空调',
    defaultSensibleRatio: 0.9,
    description: '宽温、耐候、高显热比，适合基站和小型机房。',
  },
]

/**
 * 常用单机容量档（kW）。
 * 不是标准强制序列，只用于自动推荐；用户可手动输入厂家实际容量。
 */
export const STANDARD_UNIT_KW: readonly number[] = [
  2.5, 3.5, 5, 7.1, 12, 14, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 120, 140, 160,
]

export function getRoomTypePreset(key: RoomTypeKey): RoomTypePreset {
  return ROOM_TYPE_PRESETS.find((item) => item.key === key) ?? ROOM_TYPE_PRESETS[0]!
}

export function getAcUnitTypeOption(key: AcUnitType): AcUnitTypeOption {
  return AC_UNIT_TYPE_OPTIONS.find((item) => item.key === key) ?? AC_UNIT_TYPE_OPTIONS[0]!
}

export function createDefaultInput(): HvacCoolingInput {
  return {
    roomType: 'telecom',
    calculationMode: 'detailed',
    areaM2: 100,
    areaIndexWPerM2: 400,

    itPowerKw: 30,
    heatFactor: 1,
    powerLossKw: 0,
    envelopeLoadKw: 3,
    lightingWPerM2: 10,
    peopleCount: 2,
    peopleWPerPerson: 120,
    freshAirMode: 'load',
    freshAirM3h: 1000,
    freshAirDeltaHKjKg: 10,
    freshAirLoadKw: 2,
    otherLoadKw: 1,

    designMargin: 0.15,
    redundancy: 'n+1',
    unitType: 'precision',
    unitCapacityKw: 0,
    runningUnitCount: 0,
    loadSensibleRatio: 0.9,
    unitSensibleRatio: 0.9,
    correctionFactor: 1,
    pBasisKw: 2.5,
  }
}

/**
 * 简易模式固定值：只固定厂家 / 规范类与方案假定（经验值）两组参数。
 *
 * 负荷侧输入（房间类型、计算方式、面积、IT 功率、设计余量、冗余方式）仍由用户选择；
 * 面积指标按房间类型预设取值，见 createSimpleInput。
 * 这些值全部是引擎合法输入，不改变 createDefaultInput() 与任何公式。
 */
export const SIMPLE_MODE_FIXED = {
  /** 厂家 / 规范类：机房专用机型 */
  unitType: 'precision' as AcUnitType,
  /** 负荷显热比，机房常规 0.90 */
  loadSensibleRatio: 0.9,
  /** 机组显热比，精密空调常规 0.90 */
  unitSensibleRatio: 0.9,
  /** 不做海拔 / 工况 / 污垢修正 */
  correctionFactor: 1,
  /** 匹数换算基准，常用 2.5 kW/P */
  pBasisKw: 2.5,
  /** 0 = 自动推荐 */
  unitCapacityKw: 0,
  runningUnitCount: 0,
  /** 方案假定（经验值）：电能全部转热 */
  heatFactor: 1,
  /** 100 m² 量级机房的围护结构经验值 */
  envelopeLoadKw: 3,
  otherLoadKw: 1,
  lightingWPerM2: 10,
  peopleCount: 2,
  peopleWPerPerson: 120,
  freshAirMode: 'load' as FreshAirMode,
  /** 按冷负荷直接输入，不做焓差换算 */
  freshAirLoadKw: 2,
} as const

/**
 * 简易模式默认输入：核心字段与 createDefaultInput 相同，其余按方案初选的假定值固定。
 *
 * 面积指标取房间类型预设（通信机房 400 W/m² 等）；自定义机房保留传入值。
 * 这里只是输入值组合，不改变引擎口径；专业模式仍使用 createDefaultInput()。
 */
export function createSimpleInput(overrides: Partial<HvacCoolingInput> = {}): HvacCoolingInput {
  const merged: HvacCoolingInput = { ...createDefaultInput(), ...overrides }
  const areaIndexWPerM2 =
    merged.roomType === 'custom'
      ? merged.areaIndexWPerM2
      : getRoomTypePreset(merged.roomType).areaIndexWPerM2

  return {
    ...merged,
    areaIndexWPerM2,
    unitType: SIMPLE_MODE_FIXED.unitType,
    loadSensibleRatio: SIMPLE_MODE_FIXED.loadSensibleRatio,
    unitSensibleRatio: SIMPLE_MODE_FIXED.unitSensibleRatio,
    correctionFactor: SIMPLE_MODE_FIXED.correctionFactor,
    pBasisKw: SIMPLE_MODE_FIXED.pBasisKw,
    unitCapacityKw: SIMPLE_MODE_FIXED.unitCapacityKw,
    runningUnitCount: SIMPLE_MODE_FIXED.runningUnitCount,
    heatFactor: SIMPLE_MODE_FIXED.heatFactor,
    envelopeLoadKw: SIMPLE_MODE_FIXED.envelopeLoadKw,
    otherLoadKw: SIMPLE_MODE_FIXED.otherLoadKw,
    lightingWPerM2: SIMPLE_MODE_FIXED.lightingWPerM2,
    peopleCount: SIMPLE_MODE_FIXED.peopleCount,
    peopleWPerPerson: SIMPLE_MODE_FIXED.peopleWPerPerson,
    freshAirMode: SIMPLE_MODE_FIXED.freshAirMode,
    freshAirLoadKw: SIMPLE_MODE_FIXED.freshAirLoadKw,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

/** 新风冷负荷：Q = 1.2 × L × Δh / 3600，L 为 m³/h，Δh 为 kJ/kg，结果为 kW。 */
export function freshAirLoadFromAirflow(m3h: number, deltaHKjKg: number): number {
  if (!Number.isFinite(m3h) || !Number.isFinite(deltaHKjKg)) return 0
  if (m3h <= 0 || deltaHKjKg <= 0) return 0
  return (1.2 * m3h * deltaHKjKg) / 3600
}

/** 向上取常用单机容量档；超过最大档时返回最大值。 */
export function nextStandardUnitKw(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return STANDARD_UNIT_KW[0] ?? 2.5
  const match = STANDARD_UNIT_KW.find((candidate) => candidate >= value)
  return match ?? STANDARD_UNIT_KW[STANDARD_UNIT_KW.length - 1] ?? value
}

export function calculateHvacCooling(input: HvacCoolingInput): HvacCoolingResult | null {
  const areaM2 = Number(input.areaM2)
  if (!Number.isFinite(areaM2) || areaM2 <= 0) return null

  const designMargin = Number(input.designMargin)
  if (!Number.isFinite(designMargin) || designMargin < 0 || designMargin > 1) return null

  const correctionFactor = Number(input.correctionFactor)
  if (!Number.isFinite(correctionFactor) || correctionFactor <= 0 || correctionFactor > 1.5) {
    return null
  }

  const pBasisKw = Number(input.pBasisKw)
  if (!Number.isFinite(pBasisKw) || pBasisKw <= 0) return null

  const loadSensibleRatio = clamp(Number(input.loadSensibleRatio), 0.5, 1)
  const unitSensibleRatio = clamp(Number(input.unitSensibleRatio), 0.5, 1)
  const roomPreset = getRoomTypePreset(input.roomType)

  const loadItems: LoadItem[] = []
  let totalLoadKw = 0

  if (input.calculationMode === 'area') {
    const areaIndex = Number(input.areaIndexWPerM2)
    if (!Number.isFinite(areaIndex) || areaIndex <= 0) return null
    totalLoadKw = (areaIndex * areaM2) / 1000
    loadItems.push({
      key: 'area-index',
      label: '面积指标法',
      kw: totalLoadKw,
      percent: 100,
      note: `${areaIndex.toFixed(0)} W/m² × ${areaM2.toFixed(0)} m²`,
    })
  } else {
    const itPowerKw = Math.max(0, safeNumber(Number(input.itPowerKw)))
    const heatFactor = clamp(safeNumber(Number(input.heatFactor)), 0, 1.2)
    const powerLossKw = Math.max(0, safeNumber(Number(input.powerLossKw)))
    const envelopeLoadKw = Math.max(0, safeNumber(Number(input.envelopeLoadKw)))
    const lightingWPerM2 = Math.max(0, safeNumber(Number(input.lightingWPerM2)))
    const peopleCount = Math.max(0, safeNumber(Number(input.peopleCount)))
    const peopleWPerPerson = Math.max(0, safeNumber(Number(input.peopleWPerPerson)))
    const otherLoadKw = Math.max(0, safeNumber(Number(input.otherLoadKw)))

    const itLoadKw = itPowerKw * heatFactor
    const lightingLoadKw = (lightingWPerM2 * areaM2) / 1000
    const peopleLoadKw = (peopleCount * peopleWPerPerson) / 1000
    const freshAirLoadKw =
      input.freshAirMode === 'airflow'
        ? freshAirLoadFromAirflow(Number(input.freshAirM3h), Number(input.freshAirDeltaHKjKg))
        : Math.max(0, safeNumber(Number(input.freshAirLoadKw)))

    const rawItems: Array<{ key: string; label: string; kw: number; note: string }> = [
      {
        key: 'it',
        label: '通信 / IT 设备散热',
        kw: itLoadKw,
        note: `${itPowerKw.toFixed(1)} kW × ${heatFactor.toFixed(2)}（发热系数）`,
      },
      {
        key: 'power-loss',
        label: '电力设备损耗',
        kw: powerLossKw,
        note: 'UPS、整流器、变压器、配电柜等效率损失',
      },
      {
        key: 'envelope',
        label: '围护结构 + 太阳辐射',
        kw: envelopeLoadKw,
        note: '按 GB 50736 / GB 50019 逐时计算或估算',
      },
      {
        key: 'lighting',
        label: '照明散热',
        kw: lightingLoadKw,
        note: `${lightingWPerM2.toFixed(1)} W/m² × ${areaM2.toFixed(0)} m²`,
      },
      {
        key: 'people',
        label: '人体散热',
        kw: peopleLoadKw,
        note: `${peopleCount.toFixed(0)} 人 × ${peopleWPerPerson.toFixed(0)} W/人（轻作业）`,
      },
      {
        key: 'fresh-air',
        label: '新风负荷',
        kw: freshAirLoadKw,
        note:
          input.freshAirMode === 'airflow'
            ? `1.2 × ${Number(input.freshAirM3h).toFixed(0)} m³/h × ${Number(input.freshAirDeltaHKjKg).toFixed(1)} kJ/kg / 3600`
            : '直接输入的新风冷负荷',
      },
      {
        key: 'other',
        label: '其他负荷',
        kw: otherLoadKw,
        note: '加湿器、水泵、工艺设备等',
      },
    ]

    totalLoadKw = rawItems.reduce((sum, item) => sum + item.kw, 0)
    for (const item of rawItems) {
      loadItems.push({
        ...item,
        percent: totalLoadKw > 0 ? (item.kw / totalLoadKw) * 100 : 0,
      })
    }
  }

  if (!Number.isFinite(totalLoadKw) || totalLoadKw <= 0) return null

  const designLoadKw = totalLoadKw * (1 + designMargin)
  const requiredCapacityKw = designLoadKw / correctionFactor
  const sensibleLoadKw = designLoadKw * loadSensibleRatio
  const latentLoadKw = Math.max(0, designLoadKw - sensibleLoadKw)
  const areaIndexActualWPerM2 = (totalLoadKw * 1000) / areaM2

  const maxStandardKw = STANDARD_UNIT_KW[STANDARD_UNIT_KW.length - 1] ?? 160
  const autoRunningCount =
    input.redundancy === 'none'
      ? Math.max(1, Math.ceil(requiredCapacityKw / (0.9 * maxStandardKw)))
      : Math.max(2, Math.ceil(requiredCapacityKw / (0.9 * maxStandardKw)))

  const requestedRunningCount = Number(input.runningUnitCount)
  const runningCount =
    Number.isFinite(requestedRunningCount) && requestedRunningCount > 0
      ? clamp(Math.round(requestedRunningCount), 1, 8)
      : autoRunningCount

  const requestedUnitCapacity = Number(input.unitCapacityKw)
  const unitCapacityKw =
    Number.isFinite(requestedUnitCapacity) && requestedUnitCapacity > 0
      ? requestedUnitCapacity
      : nextStandardUnitKw(requiredCapacityKw / (runningCount * 0.9))

  const backupCount =
    input.redundancy === 'none' ? 0 : input.redundancy === 'n+1' ? 1 : runningCount
  const installedCount = runningCount + backupCount
  const installedCapacityKw = installedCount * unitCapacityKw
  const runningCapacityKw = runningCount * unitCapacityKw
  const faultCapacityKw = input.redundancy === 'none' ? 0 : runningCount * unitCapacityKw
  const unitLoadRate = requiredCapacityKw / runningCapacityKw
  const unitSensibleCapacityKw = runningCapacityKw * unitSensibleRatio

  const checks: CheckResult[] = []
  const warnings: string[] = []

  checks.push({
    key: 'capacity',
    label: '运行冷量',
    required: `≥ ${requiredCapacityKw.toFixed(1)} kW`,
    actual: `${runningCapacityKw.toFixed(1)} kW（${runningCount} × ${unitCapacityKw.toFixed(1)} kW）`,
    pass: runningCapacityKw >= requiredCapacityKw - 1e-6,
    note: `设计冷负荷 ${designLoadKw.toFixed(1)} kW，修正系数 ${correctionFactor.toFixed(2)}`,
  })

  checks.push({
    key: 'sensible',
    label: '显冷量',
    required: `≥ ${sensibleLoadKw.toFixed(1)} kW`,
    actual: `${unitSensibleCapacityKw.toFixed(1)} kW（SHR ${unitSensibleRatio.toFixed(2)}）`,
    pass: unitSensibleCapacityKw >= sensibleLoadKw - 1e-6,
    note: `负荷显热比 ${loadSensibleRatio.toFixed(2)}；空调显热比 ${unitSensibleRatio.toFixed(2)}`,
  })

  checks.push({
    key: 'load-rate',
    label: '单台负载率',
    required: '≤ 90%',
    actual: `${(unitLoadRate * 100).toFixed(1)}%`,
    pass: unitLoadRate <= 0.9 + 1e-6,
    note: '单台负载率 = 所需冷量 / 运行冷量',
  })

  checks.push({
    key: 'margin',
    label: '设计余量',
    required: input.redundancy === 'none' ? '≥ 15%' : '有备用时可放宽',
    actual: `${(designMargin * 100).toFixed(0)}%`,
    pass: input.redundancy !== 'none' || designMargin >= 0.15 - 1e-6,
    note: 'GB 50174-2017 7.5.3：无备份设备时单台制冷能力留 15%~20% 余量',
  })

  const inAreaRange =
    input.roomType === 'custom' ||
    (areaIndexActualWPerM2 >= roomPreset.areaIndexRange[0] &&
      areaIndexActualWPerM2 <= roomPreset.areaIndexRange[1])

  checks.push({
    key: 'area-index',
    label: '面积指标',
    required:
      input.roomType === 'custom'
        ? '按实际负荷'
        : `${roomPreset.areaIndexRange[0]}~${roomPreset.areaIndexRange[1]} W/m²`,
    actual: `${areaIndexActualWPerM2.toFixed(0)} W/m²`,
    pass: inAreaRange,
    note: '经验指标，不是 GB 强制值；施工图应逐项计算',
  })

  if (input.calculationMode === 'area') {
    warnings.push('面积指标法只适用于方案估算；施工图应按 GB 50736 / GB 50019 逐项计算逐时冷负荷。')
  }
  if (input.unitType === 'comfort' && input.roomType !== 'auxiliary') {
    warnings.push(
      '舒适性空调显热比低、无恒湿功能、设计寿命短，不建议用于通信主机房；如必须使用，应按显冷量校核并降低单台负载率。',
    )
  }
  if (loadSensibleRatio < 0.85) {
    warnings.push(
      `机房显热比假设为 ${loadSensibleRatio.toFixed(2)}，通信机房通常为 0.85~1.0；请按设备与新风实际散湿复核。`,
    )
  }
  if (unitSensibleRatio < 0.85) {
    warnings.push(
      `所选空调显热比为 ${unitSensibleRatio.toFixed(2)}，冷量可能被除湿占用，建议选用机房专用空调。`,
    )
  }
  if (input.redundancy === 'none' && designMargin < 0.15) {
    warnings.push('无备份且设计余量低于 15%，不符合 GB 50174-2017 7.5.3 的余量要求。')
  }
  if (unitLoadRate > 0.9) {
    warnings.push(
      '单台负载率超过 90%，不利于部分负荷调节和故障切换；建议增大单台容量或增加运行台数。',
    )
  }
  if (!inAreaRange && input.roomType !== 'custom') {
    warnings.push(
      `当前面积指标 ${areaIndexActualWPerM2.toFixed(0)} W/m² 超出“${roomPreset.label}”经验范围 ${roomPreset.areaIndexRange[0]}~${roomPreset.areaIndexRange[1]} W/m²，请复核设备功率或面积。`,
    )
  }
  if (correctionFactor < 0.8) {
    warnings.push(
      `修正系数 ${correctionFactor.toFixed(2)} 偏低，通常意味着高海拔、高温或长管路等不利条件；请按厂家样本逐项修正。`,
    )
  }
  if (Math.abs(pBasisKw - 2.5) > 0.01) {
    warnings.push(
      `匹数换算基准为 ${pBasisKw.toFixed(3)} kW/P，不是常用的 2.5 kW/P；结果仅用于市场沟通。`,
    )
  }
  if (input.unitType === 'chilled-water') {
    warnings.push('冷水机组应按 kW 或冷吨（RT）选型，匹数仅作参考；1 RT = 3.517 kW。')
  }
  if (input.redundancy === 'none') {
    warnings.push('当前按无备份设计，单台空调故障会直接影响机房；关键机房建议采用 N+1。')
  }
  if (runningCount >= 4) {
    warnings.push('运行台数较多，建议评估集中冷源、增大单台容量或采用模块化机房空调。')
  }

  // 只记录真正决定选型的约束：运行冷量决定所需容量与运行台数，90% 单台负载率
  // 是自动选单台容量的设计目标。显冷量通常由这两者派生，只有校核不通过时才单独控制。
  const drivers: string[] = ['运行冷量', '单台负载率']
  if (unitSensibleCapacityKw < sensibleLoadKw - 1e-6) drivers.push('显冷量')

  return {
    roomType: input.roomType,
    calculationMode: input.calculationMode,
    areaM2,
    totalLoadKw,
    designLoadKw,
    requiredCapacityKw,
    sensibleLoadKw,
    latentLoadKw,
    loadSensibleRatio,
    areaIndexActualWPerM2,
    loadItems,
    pBasisKw,
    pValue: requiredCapacityKw / pBasisKw,
    rtValue: requiredCapacityKw / 3.517,
    unitType: input.unitType,
    unitCapacityKw,
    runningCount,
    backupCount,
    installedCount,
    installedCapacityKw,
    runningCapacityKw,
    faultCapacityKw,
    unitLoadRate,
    unitSensibleRatio,
    unitSensibleCapacityKw,
    designMargin,
    correctionFactor,
    drivers,
    checks,
    warnings,
    overallPass: checks.every((check) => check.pass),
  }
}
