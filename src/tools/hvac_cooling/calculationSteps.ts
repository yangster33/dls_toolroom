/**
 * 机房空调制冷量计算的“计算书”数据：把引擎结果拆成可读、可追溯的推导步骤。
 *
 * 这里只做展示层的组装，不参与冷负荷 / 机组选型计算；所有数值都取自
 * HvacCoolingResult，输入系数从 HvacCoolingInput 读取。步骤顺序对应
 * docs/2026-11-10-tool-26-hvac-cooling-transparency-plan.md 第 4 节。
 */

import {
  formatNumber,
  makeSymbol as symbol,
  stepLabelOf,
  type CalcSymbol,
  type CalcStep,
  type ParameterDoc,
  type SymbolSource,
} from '../shared/calcTrace'
import {
  getRoomTypePreset,
  STANDARD_UNIT_KW,
  type HvacCoolingInput,
  type HvacCoolingResult,
} from './hvacCooling'

export type { CalcSymbol, CalcStep, ParameterDoc, SymbolSource }

const fmt = (value: number, digits = 1) => formatNumber(value, digits)

/** 计算书步骤的显示名，如 "⑤ 机组台数 / 单台容量"。 */
export const stepLabel = stepLabelOf

function checkOf(result: HvacCoolingResult, key: string) {
  return result.checks.find((check) => check.key === key)
}

export function buildHvacSteps(input: HvacCoolingInput, result: HvacCoolingResult): CalcStep[] {
  const isArea = input.calculationMode === 'area'
  const isAirflow = input.freshAirMode === 'airflow'
  const areaM2 = result.areaM2
  const total = result.totalLoadKw
  const design = result.designLoadKw
  const required = result.requiredCapacityKw
  const margin = result.designMargin
  const correction = result.correctionFactor
  const loadSensibleRatio = result.loadSensibleRatio
  const unitSensibleRatio = result.unitSensibleRatio
  const maxStandardKw = STANDARD_UNIT_KW[STANDARD_UNIT_KW.length - 1] ?? 160
  const steps: CalcStep[] = []

  const autoRunningCount =
    input.redundancy === 'none'
      ? Math.max(1, Math.ceil(required / (0.9 * maxStandardKw)))
      : Math.max(2, Math.ceil(required / (0.9 * maxStandardKw)))
  const autoUnitCapacity = !(Number(input.unitCapacityKw) > 0)
  const autoRunning = !(Number(input.runningUnitCount) > 0)

  // ① 冷负荷分项
  const detailedSymbols: CalcSymbol[] = [
    symbol('通信 / IT 设备输入功率', fmt(Number(input.itPowerKw), 1), 'input', {
      symbol: 'P_IT',
      unit: 'kW',
      inputSymbol: 'P_IT',
    }),
    symbol('设备发热系数', fmt(Number(input.heatFactor), 2), 'input', {
      symbol: 'K_heat',
      inputSymbol: 'K_heat',
      sourceDetail: 'YD/T 5003：一般通信机房可取 1.00',
    }),
    symbol('电力设备损耗', fmt(Number(input.powerLossKw), 1), 'input', {
      symbol: 'P_loss',
      unit: 'kW',
      inputSymbol: 'P_loss',
    }),
    symbol('围护结构 + 太阳辐射', fmt(Number(input.envelopeLoadKw), 1), 'input', {
      symbol: 'Q_env',
      unit: 'kW',
      inputSymbol: 'Q_env',
    }),
    symbol('照明功率密度', fmt(Number(input.lightingWPerM2), 1), 'input', {
      symbol: 'L_light',
      unit: 'W/m²',
      inputSymbol: 'L_light',
    }),
    symbol('机房面积', fmt(areaM2, 0), 'input', {
      symbol: 'A',
      unit: 'm²',
      inputSymbol: 'A',
    }),
    symbol('人员数量', fmt(Number(input.peopleCount), 0), 'input', {
      symbol: 'N_people',
      unit: '人',
      inputSymbol: 'N_people',
    }),
    symbol('每人散热量', fmt(Number(input.peopleWPerPerson), 0), 'input', {
      symbol: 'q_people',
      unit: 'W/人',
      inputSymbol: 'q_people',
      sourceDetail: '轻作业',
    }),
    ...(isAirflow
      ? [
          symbol('新风量', fmt(Number(input.freshAirM3h), 0), 'input', {
            symbol: 'L_fresh',
            unit: 'm³/h',
            inputSymbol: 'L_fresh',
          }),
          symbol('新风焓差', fmt(Number(input.freshAirDeltaHKjKg), 1), 'input', {
            symbol: 'Δh',
            unit: 'kJ/kg',
            inputSymbol: 'Δh',
          }),
        ]
      : [
          symbol(
            '新风冷负荷',
            fmt(result.loadItems.find((item) => item.key === 'fresh-air')?.kw ?? 0, 2),
            'input',
            {
              symbol: 'Q_fresh',
              unit: 'kW',
              inputSymbol: 'Q_fresh',
            },
          ),
        ]),
    symbol('其他负荷', fmt(Number(input.otherLoadKw), 1), 'input', {
      symbol: 'Q_other',
      unit: 'kW',
      inputSymbol: 'Q_other',
    }),
    symbol('总冷负荷', fmt(total, 2), 'calc', { symbol: 'Q_total', unit: 'kW' }),
  ]

  const areaSymbols: CalcSymbol[] = [
    symbol('面积指标', fmt(Number(input.areaIndexWPerM2), 0), 'input', {
      symbol: 'q_A',
      unit: 'W/m²',
      inputSymbol: 'q_A',
      sourceDetail:
        input.roomType === 'custom'
          ? '自定义机房按项目值'
          : `${getRoomTypePreset(input.roomType).label}预设`,
    }),
    symbol('机房面积', fmt(areaM2, 0), 'input', { symbol: 'A', unit: 'm²', inputSymbol: 'A' }),
    symbol('总冷负荷', fmt(total, 2), 'calc', { symbol: 'Q_total', unit: 'kW' }),
  ]

  const maxItem = result.loadItems.reduce<{ label: string; percent: number; kw: number }>(
    (best, item) => (item.kw > best.kw ? item : best),
    { label: '—', percent: 0, kw: 0 },
  )

  steps.push({
    key: 'load-items',
    index: 1,
    title: '冷负荷分项',
    keyValue: `Q_total = ${fmt(total, 2)} kW`,
    formula: isArea
      ? 'Q_total = q_A × A / 1000'
      : 'Q_IT = P_IT × K_heat\nQ_light = L_light × A / 1000\nQ_people = N_people × q_people / 1000\nQ_fresh = 1.2 × L_fresh × Δh / 3600（或直接输入）\nQ_total = Σ Q_i',
    substitution: isArea
      ? `= ${fmt(Number(input.areaIndexWPerM2), 0)} W/m² × ${fmt(areaM2, 0)} m² / 1000 = ${fmt(total, 2)} kW`
      : `${result.loadItems
          .map(
            (item) =>
              `${item.label}：${item.note} = ${fmt(item.kw, 2)} kW（${fmt(item.percent, 1)}%）`,
          )
          .join('；')}；Q_total = ${fmt(total, 2)} kW`,
    result: `Q_total = ${fmt(total, 2)} kW`,
    symbols: isArea ? areaSymbols : detailedSymbols,
    note: isArea
      ? '面积指标法是方案估算；施工图应按 GB 50736 / GB 50019 逐项计算逐时冷负荷。'
      : `共 ${result.loadItems.length} 项，最大分项为${maxItem.label}（${fmt(maxItem.percent, 1)}%）；各项占比按合计值折算。`,
  })

  // ② 总冷负荷 / 设计冷负荷
  steps.push({
    key: 'design-load',
    index: 2,
    title: '总冷负荷 / 设计冷负荷',
    keyValue: `Q_design = ${fmt(design, 2)} kW`,
    formula: 'Q_design = Q_total × (1 + K_margin)',
    substitution: `= ${fmt(total, 2)} × (1 + ${fmt(margin, 2)}) = ${fmt(design, 2)} kW`,
    result: `Q_design = ${fmt(design, 2)} kW`,
    symbols: [
      symbol('总冷负荷', fmt(total, 2), 'calc', { symbol: 'Q_total', unit: 'kW' }),
      symbol('设计余量', `${fmt(margin * 100, 0)}%`, 'input', {
        symbol: 'K_margin',
        inputSymbol: 'K_margin',
      }),
      symbol('设计冷负荷', fmt(design, 2), 'calc', { symbol: 'Q_design', unit: 'kW' }),
    ],
    note: '设计余量用于覆盖负荷波动、设备老化与未预见项；无备份时 GB 50174-2017 7.5.3 要求留 15%~20%。',
  })

  // ③ 所需冷量
  steps.push({
    key: 'required',
    index: 3,
    title: '所需冷量',
    keyValue: `Q_req = ${fmt(required, 2)} kW`,
    formula: 'Q_req = Q_design / K_corr',
    substitution: `= ${fmt(design, 2)} / ${fmt(correction, 2)} = ${fmt(required, 2)} kW`,
    result: `Q_req = ${fmt(required, 2)} kW`,
    symbols: [
      symbol('设计冷负荷', fmt(design, 2), 'calc', { symbol: 'Q_design', unit: 'kW' }),
      symbol('综合修正系数', fmt(correction, 2), 'input', {
        symbol: 'K_corr',
        inputSymbol: 'K_corr',
        sourceDetail: '海拔 / 高温 / 管路 / 污垢',
      }),
      symbol('所需冷量', fmt(required, 2), 'calc', { symbol: 'Q_req', unit: 'kW' }),
    ],
    note:
      correction < 1
        ? `修正系数 ${fmt(correction, 2)} 小于 1，所需设备制冷量已按不利工况放大。`
        : '修正系数为 1 时不放大；海拔、高温或长管路场景应按厂家样本降低取值。',
  })

  // ④ 显热 / 潜热
  steps.push({
    key: 'sensible',
    index: 4,
    title: '显热 / 潜热',
    keyValue: `Q_sensible = ${fmt(result.sensibleLoadKw, 2)} kW / Q_latent = ${fmt(result.latentLoadKw, 2)} kW`,
    formula: 'Q_sensible = Q_design × SHR_load\nQ_latent = Q_design − Q_sensible',
    substitution: `= ${fmt(design, 2)} × ${fmt(loadSensibleRatio, 2)} = ${fmt(result.sensibleLoadKw, 2)} kW；Q_latent = ${fmt(design, 2)} − ${fmt(result.sensibleLoadKw, 2)} = ${fmt(result.latentLoadKw, 2)} kW`,
    result: `显热 ${fmt(result.sensibleLoadKw, 2)} kW，潜热 ${fmt(result.latentLoadKw, 2)} kW`,
    symbols: [
      symbol('设计冷负荷', fmt(design, 2), 'calc', { symbol: 'Q_design', unit: 'kW' }),
      symbol('负荷显热比', fmt(loadSensibleRatio, 2), 'input', {
        symbol: 'SHR_load',
        inputSymbol: 'SHR_load',
        sourceDetail: '通信机房常取 0.85~1.00',
      }),
      symbol('显热负荷', fmt(result.sensibleLoadKw, 2), 'calc', {
        symbol: 'Q_sensible',
        unit: 'kW',
      }),
      symbol('潜热负荷', fmt(result.latentLoadKw, 2), 'calc', {
        symbol: 'Q_latent',
        unit: 'kW',
      }),
    ],
    note: '显热比偏低意味着除湿潜热占比大，机组需要同时承担显热与潜热。',
  })

  // ⑤ 机组台数 / 单台容量
  const runningCount = result.runningCount
  const unitCapacity = result.unitCapacityKw
  const backupCount = result.backupCount
  const installedCount = result.installedCount
  const runningCapacity = result.runningCapacityKw
  const installedCapacity = result.installedCapacityKw

  steps.push({
    key: 'units',
    index: 5,
    title: '机组台数 / 单台容量',
    keyValue: `${runningCount} 运行 + ${backupCount} 备用 × ${fmt(unitCapacity, 1)} kW = ${fmt(installedCapacity, 1)} kW`,
    formula:
      `N_run,auto = max(${input.redundancy === 'none' ? 1 : 2}, ceil(Q_req / (0.9 × Q_unit,max)))\n` +
      'Q_unit = nextStandardUnitKw(Q_req / (N_run × 0.9))\n' +
      'N_backup = 无 ? 0 : N+1 ? 1 : N_run\n' +
      'N_install = N_run + N_backup\n' +
      'Q_run = N_run × Q_unit\n' +
      'Q_install = N_install × Q_unit',
    substitution:
      `N_run,auto = max(${input.redundancy === 'none' ? 1 : 2}, ceil(${fmt(required, 2)} / (0.9 × ${fmt(maxStandardKw, 0)}))) = ${autoRunningCount}；` +
      `${autoRunning ? `N_run = ${runningCount}` : `N_run = ${runningCount}（手动输入）`}；` +
      `${autoUnitCapacity ? `Q_unit = nextStandardUnitKw(${fmt(required, 2)} / (${runningCount} × 0.9) = ${fmt(required / (runningCount * 0.9), 2)}) = ${fmt(unitCapacity, 1)} kW` : `Q_unit = ${fmt(unitCapacity, 1)} kW（手动输入）`}；` +
      `N_backup = ${backupCount}；N_install = ${runningCount} + ${backupCount} = ${installedCount}；` +
      `Q_run = ${runningCount} × ${fmt(unitCapacity, 1)} = ${fmt(runningCapacity, 1)} kW；Q_install = ${installedCount} × ${fmt(unitCapacity, 1)} = ${fmt(installedCapacity, 1)} kW`,
    result: `${runningCount} 用 / ${backupCount} 备，共 ${installedCount} 台 × ${fmt(unitCapacity, 1)} kW；运行 ${fmt(runningCapacity, 1)} kW，安装 ${fmt(installedCapacity, 1)} kW`,
    symbols: [
      symbol('所需冷量', fmt(required, 2), 'calc', { symbol: 'Q_req', unit: 'kW' }),
      symbol('运行台数', String(runningCount), autoRunning ? 'calc' : 'input', {
        symbol: 'N_run',
        ...(autoRunning ? {} : { inputSymbol: 'N_run' }),
      }),
      symbol('单台容量', fmt(unitCapacity, 1), autoUnitCapacity ? 'table' : 'input', {
        symbol: 'Q_unit',
        unit: 'kW',
        ...(autoUnitCapacity
          ? { sourceDetail: `常用单机容量档（最大 ${fmt(maxStandardKw, 0)} kW）` }
          : { inputSymbol: 'Q_unit' }),
      }),
      symbol('冗余方式', input.redundancy, 'input', {
        symbol: 'redundancy',
        inputSymbol: 'redundancy',
      }),
      symbol('备用台数', String(backupCount), 'calc', { symbol: 'N_backup', unit: '台' }),
      symbol('安装台数', String(installedCount), 'calc', { symbol: 'N_install', unit: '台' }),
      symbol('运行冷量', fmt(runningCapacity, 1), 'calc', { symbol: 'Q_run', unit: 'kW' }),
      symbol('安装容量', fmt(installedCapacity, 1), 'calc', {
        symbol: 'Q_install',
        unit: 'kW',
      }),
    ],
    note: '运行台数与单台容量填 0 时自动推荐：先按 0.9 × 最大标准容量估算台数，再按 90% 负载率向上取标准容量档。',
  })

  // ⑥ 显冷量校核
  const sensibleCheck = checkOf(result, 'sensible')
  steps.push({
    key: 'sensible-check',
    index: 6,
    title: '显冷量校核',
    keyValue: `Q_sensible,unit = ${fmt(result.unitSensibleCapacityKw, 2)} kW`,
    formula: 'Q_sensible,unit = Q_run × SHR_unit\nQ_sensible,unit ≥ Q_sensible',
    substitution: `= ${fmt(runningCapacity, 2)} × ${fmt(unitSensibleRatio, 2)} = ${fmt(result.unitSensibleCapacityKw, 2)} kW ≥ ${fmt(result.sensibleLoadKw, 2)} kW（${sensibleCheck?.pass ? '通过' : '不通过'}）`,
    result: `机组显冷量 ${fmt(result.unitSensibleCapacityKw, 2)} kW，负荷显冷量 ${fmt(result.sensibleLoadKw, 2)} kW`,
    symbols: [
      symbol('运行冷量', fmt(runningCapacity, 2), 'calc', { symbol: 'Q_run', unit: 'kW' }),
      symbol('机组显热比', fmt(unitSensibleRatio, 2), 'input', {
        symbol: 'SHR_unit',
        inputSymbol: 'SHR_unit',
        sourceDetail: '精密空调约 0.90',
      }),
      symbol('机组显冷量', fmt(result.unitSensibleCapacityKw, 2), 'calc', {
        symbol: 'Q_sensible,unit',
        unit: 'kW',
      }),
      symbol('显热负荷', fmt(result.sensibleLoadKw, 2), 'calc', {
        symbol: 'Q_sensible',
        unit: 'kW',
      }),
    ],
    pass: sensibleCheck?.pass,
    controlling: result.drivers.includes('显冷量'),
    note: '显冷量不足时，机组冷量会被除湿占用，机房温度仍可能偏高。',
  })

  // ⑦ 负载率 / 面积指标
  const loadRateCheck = checkOf(result, 'load-rate')
  const areaCheck = checkOf(result, 'area-index')
  steps.push({
    key: 'load-rate',
    index: 7,
    title: '负载率 / 面积指标',
    keyValue: `η_load = ${fmt(result.unitLoadRate * 100, 1)}%；q_A = ${fmt(result.areaIndexActualWPerM2, 0)} W/m²`,
    formula: 'η_load = Q_req / Q_run\nq_A,actual = Q_total × 1000 / A',
    substitution: `= ${fmt(required, 2)} / ${fmt(runningCapacity, 2)} = ${fmt(result.unitLoadRate * 100, 1)}%；= ${fmt(total, 2)} × 1000 / ${fmt(areaM2, 0)} = ${fmt(result.areaIndexActualWPerM2, 0)} W/m²`,
    result: `单台负载率 ${fmt(result.unitLoadRate * 100, 1)}%（要求 ≤ 90%）；面积指标 ${fmt(result.areaIndexActualWPerM2, 0)} W/m²`,
    symbols: [
      symbol('所需冷量', fmt(required, 2), 'calc', { symbol: 'Q_req', unit: 'kW' }),
      symbol('运行冷量', fmt(runningCapacity, 2), 'calc', { symbol: 'Q_run', unit: 'kW' }),
      symbol('单台负载率', `${fmt(result.unitLoadRate * 100, 1)}%`, 'calc', {
        symbol: 'η_load',
      }),
      symbol('机房面积', fmt(areaM2, 0), 'input', { symbol: 'A', unit: 'm²', inputSymbol: 'A' }),
      symbol('实际面积指标', fmt(result.areaIndexActualWPerM2, 0), 'calc', {
        symbol: 'q_A,actual',
        unit: 'W/m²',
      }),
    ],
    pass: (loadRateCheck?.pass ?? true) && (areaCheck?.pass ?? true),
    note: '单台负载率 ≤ 90% 便于部分负荷调节和故障切换；面积指标只作经验范围校核，不是 GB 强制值。',
  })

  // ⑧ 匹数 / RT 换算
  steps.push({
    key: 'conversion',
    index: 8,
    title: '匹数 / RT 换算',
    keyValue: `${fmt(result.pValue, 1)} P / ${fmt(result.rtValue, 1)} RT`,
    formula: 'P = Q_req / p_basis\nRT = Q_req / 3.517',
    substitution: `= ${fmt(required, 2)} / ${fmt(result.pBasisKw, 3)} = ${fmt(result.pValue, 2)} P；= ${fmt(required, 2)} / 3.517 = ${fmt(result.rtValue, 2)} RT`,
    result: `约 ${fmt(result.pValue, 1)} P；约 ${fmt(result.rtValue, 1)} RT`,
    symbols: [
      symbol('所需冷量', fmt(required, 2), 'calc', { symbol: 'Q_req', unit: 'kW' }),
      symbol('匹数基准', `${fmt(result.pBasisKw, 3)} kW/P`, 'input', {
        symbol: 'p_basis',
        inputSymbol: 'p_basis',
        sourceDetail: '市场口径，常用 2.5 kW/P',
      }),
      symbol('市场匹数', fmt(result.pValue, 2), 'calc', { symbol: 'P', unit: 'P' }),
      symbol('冷吨', fmt(result.rtValue, 2), 'calc', { symbol: 'RT', unit: 'RT' }),
      symbol('冷吨换算常数', '3.517', 'constant', {
        symbol: '3.517',
        unit: 'kW/RT',
        sourceDetail: '1 RT = 3.517 kW',
      }),
    ],
    note: '“匹”不是法定计量单位，只用于市场沟通；设计文件应写 kW，冷水机组可按 RT 选型。',
  })

  return steps
}

export function buildParameterDocs(): ParameterDoc[] {
  const roomTypes = [
    '通信机房 400 W/m²',
    '数据中心 800 W/m²',
    '金融机房 550 W/m²',
    '计算机房 400 W/m²',
    '辅助机房 200 W/m²',
  ].join('；')

  return [
    {
      symbol: 'roomType',
      name: '机房类型',
      meaning: '按房间用途选择预设，决定面积指标与默认显热比。',
      position: '用于面积指标预设、面积指标校核范围。',
      impact: '类型改变会切换面积指标预设与经验范围。',
      source: '输入（预设表）',
      editable: '是',
      basis: `ROOM_TYPE_PRESETS：${roomTypes}；自定义机房按实际负荷。`,
    },
    {
      symbol: 'P_IT',
      name: '通信 / IT 设备输入功率',
      meaning: '机房内通信、IT 设备的铭牌输入功率。',
      position: '用于 IT 设备散热 Q_IT = P_IT × K_heat。',
      impact: 'P_IT 增大 → 总冷负荷与所需冷量同向增大。',
      source: '输入',
      editable: '是',
      basis: '设备铭牌功率；UPS 供电时应按输入功率换算。',
    },
    {
      symbol: 'K_heat',
      name: '设备发热系数',
      meaning: '设备输入功率中转化为机房热量的比例。',
      position: '用于 Q_IT。',
      impact: 'K_heat 增大 → IT 散热量增大。',
      source: '输入',
      editable: '是',
      basis: 'YD/T 5003：一般通信机房可按电能全部变为热能，取 1.00。',
    },
    {
      symbol: 'P_loss',
      name: '电力设备损耗',
      meaning: 'UPS、整流器、变压器、配电柜等效率损失。',
      position: '直接计入冷负荷分项。',
      impact: 'P_loss 增大 → 总冷负荷增大。',
      source: '输入',
      editable: '是',
      basis: '设备效率与损耗估算。',
    },
    {
      symbol: 'Q_env',
      name: '围护结构 + 太阳辐射',
      meaning: '外墙、屋面、门窗传热与太阳辐射形成的冷负荷。',
      position: '直接计入冷负荷分项。',
      impact: 'Q_env 增大 → 总冷负荷增大。',
      source: '输入',
      editable: '是',
      basis: '按 GB 50736 / GB 50019 逐时计算或方案估算。',
    },
    {
      symbol: 'L_light',
      name: '照明功率密度',
      meaning: '单位面积照明安装功率。',
      position: '用于 Q_light = L_light × A / 1000。',
      impact: '照明功率密度增大 → 照明散热增大。',
      source: '输入（规范 / 项目）',
      editable: '是',
      basis: 'LED 机房照明约 8~12 W/m²，按项目照明设计取值。',
    },
    {
      symbol: 'A',
      name: '机房面积',
      meaning: '机房建筑面积，用于照明、面积指标与面积法估算。',
      position: '用于 Q_light、q_A,actual 与面积法 Q_total。',
      impact: '面积增大 → 照明负荷与面积法总负荷增大，面积指标降低。',
      source: '输入',
      editable: '是',
      basis: '建筑图纸或现场实测。',
    },
    {
      symbol: 'N_people',
      name: '人员数量',
      meaning: '机房内维护、值班人员数量。',
      position: '用于 Q_people = N_people × q_people / 1000。',
      impact: '人数增大 → 人体散热增大。',
      source: '输入',
      editable: '是',
      basis: 'YD/T 5003 人体散热按轻作业考虑。',
    },
    {
      symbol: 'q_people',
      name: '每人散热量',
      meaning: '单个人体在机房环境下的散热量。',
      position: '用于 Q_people。',
      impact: 'q_people 增大 → 人体散热增大。',
      source: '输入（规范）',
      editable: '是',
      basis: '轻作业 100~150 W/人，常用 120 W/人。',
    },
    {
      symbol: 'L_fresh',
      name: '新风量',
      meaning: '按风量估算新风负荷时的新风体积流量。',
      position: '用于 Q_fresh = 1.2 × L_fresh × Δh / 3600。',
      impact: '新风量增大 → 新风负荷增大。',
      source: '输入',
      editable: '是',
      basis: '按人员卫生要求、正压与工艺排风确定。',
    },
    {
      symbol: 'Δh',
      name: '新风焓差',
      meaning: '室外空气与室内空气的比焓差。',
      position: '用于按风量估算新风负荷。',
      impact: '焓差增大 → 新风负荷增大。',
      source: '输入（项目 / 气象）',
      editable: '是',
      basis: '当地夏季空调室外计算参数与室内设计参数。',
    },
    {
      symbol: 'Q_fresh',
      name: '新风冷负荷',
      meaning: '直接输入的新风冷负荷，或按风量焓差折算值。',
      position: '直接计入冷负荷分项。',
      impact: 'Q_fresh 增大 → 总冷负荷增大。',
      source: '输入 / 计算',
      editable: '是（按风量或直接输入）',
      basis: '新风量 × 焓差，或项目实测 / 估算值。',
    },
    {
      symbol: 'Q_other',
      name: '其他负荷',
      meaning: '加湿器、水泵、工艺设备等未单列的冷负荷。',
      position: '直接计入冷负荷分项。',
      impact: 'Q_other 增大 → 总冷负荷增大。',
      source: '输入',
      editable: '是',
      basis: '项目工艺资料与设备清单。',
    },
    {
      symbol: 'q_A',
      name: '面积指标',
      meaning: '单位机房面积的经验冷负荷指标。',
      position: '用于面积法 Q_total = q_A × A / 1000。',
      impact: 'q_A 增大 → 面积法总冷负荷增大。',
      source: '查表 / 输入',
      editable: '是（专业模式；简易模式按机房类型预设）',
      basis: `经验指标：${roomTypes}；不是 GB 强制值。`,
    },
    {
      symbol: 'Q_total',
      name: '总冷负荷',
      meaning: '详细法各分项之和，或面积法估算值。',
      position: '用于设计冷负荷与面积指标校核。',
      impact: '核心中间值。',
      source: '计算',
      editable: '间接',
      basis: 'Σ 分项 或 q_A × A / 1000。',
    },
    {
      symbol: 'K_margin',
      name: '设计余量',
      meaning: '在总冷负荷基础上预留的选型放大系数。',
      position: '用于 Q_design = Q_total × (1 + K_margin)。',
      impact: '余量增大 → 设计冷负荷与所需冷量增大。',
      source: '输入',
      editable: '是',
      basis: 'GB 50174-2017 7.5.3：无备份时留 15%~20%。',
    },
    {
      symbol: 'Q_design',
      name: '设计冷负荷',
      meaning: '计入设计余量后的冷负荷。',
      position: '用于所需冷量与显热 / 潜热。',
      impact: '最终选型的基准负荷。',
      source: '计算',
      editable: '间接',
      basis: 'Q_total × (1 + K_margin)。',
    },
    {
      symbol: 'K_corr',
      name: '综合修正系数',
      meaning: '按海拔、室外工况、管路长度、污垢等对设备制冷量的修正。',
      position: '用于 Q_req = Q_design / K_corr。',
      impact: '系数减小 → 所需设备制冷量增大。',
      source: '输入（厂家 / 项目）',
      editable: '是',
      basis: '厂家样本的海拔、温度、管路修正曲线。',
    },
    {
      symbol: 'Q_req',
      name: '所需冷量',
      meaning: '修正后需要空调设备提供的制冷量。',
      position: '用于机组台数、单台容量、负载率与匹数换算。',
      impact: '最终结果之一。',
      source: '计算',
      editable: '间接',
      basis: 'Q_design / K_corr。',
    },
    {
      symbol: 'SHR_load',
      name: '负荷显热比',
      meaning: '显热负荷占设计冷负荷的比例。',
      position: '用于 Q_sensible = Q_design × SHR_load。',
      impact: '显热比降低 → 潜热占比增大，显冷量校核更紧。',
      source: '输入',
      editable: '是（简易模式固定 0.90）',
      basis: '通信机房通常 0.85~1.00；按设备与新风散湿复核。',
    },
    {
      symbol: 'Q_sensible',
      name: '显热负荷',
      meaning: '需要由空调显冷量承担、不包含除湿潜热的负荷。',
      position: '与机组显冷量比较。',
      impact: '显热负荷增大 → 显冷量校核更紧。',
      source: '计算',
      editable: '间接',
      basis: 'Q_design × SHR_load。',
    },
    {
      symbol: 'Q_latent',
      name: '潜热负荷',
      meaning: '新风与人员等带来的除湿潜热。',
      position: '用于说明显热 / 潜热构成。',
      impact: '潜热增大 → 机组冷量中被除湿占用的部分增大。',
      source: '计算',
      editable: '间接',
      basis: 'Q_design − Q_sensible。',
    },
    {
      symbol: 'N_run',
      name: '运行台数',
      meaning: '实际投入运行的空调台数；0 表示自动推荐。',
      position: '用于运行冷量、备用台数与安装台数。',
      impact: '运行台数增大 → 单台容量可减小，负载率降低。',
      source: '输入 / 计算',
      editable: '是（0 = 自动）',
      basis: '按所需冷量与 90% 负载率目标确定。',
    },
    {
      symbol: 'Q_unit',
      name: '单台容量',
      meaning: '单台空调的额定制冷量；0 表示按标准容量档自动推荐。',
      position: '用于运行冷量、安装容量与显冷量。',
      impact: '单台容量增大 → 运行冷量增大、负载率降低。',
      source: '输入 / 查表',
      editable: '是（0 = 自动）',
      basis: '厂家样本；自动推荐取常用单机容量档。',
    },
    {
      symbol: 'N_backup',
      name: '备用台数',
      meaning: '按冗余方式增加的备用空调台数。',
      position: '用于安装台数与故障后可用冷量。',
      impact: '无 = 0，N+1 = 1，2N = 运行台数。',
      source: '计算',
      editable: '间接（改冗余方式）',
      basis: '冗余方式定义。',
    },
    {
      symbol: 'N_install',
      name: '安装台数',
      meaning: '运行台数与备用台数之和。',
      position: '用于安装容量。',
      impact: '冗余越高，安装台数与装机容量越大。',
      source: '计算',
      editable: '间接',
      basis: 'N_run + N_backup。',
    },
    {
      symbol: 'Q_run',
      name: '运行冷量',
      meaning: '全部运行机组的名义制冷量之和。',
      position: '用于运行冷量校核、负载率与显冷量。',
      impact: '必须不小于所需冷量。',
      source: '计算',
      editable: '间接',
      basis: 'N_run × Q_unit。',
    },
    {
      symbol: 'Q_install',
      name: '安装容量',
      meaning: '含备用机组的装机总容量。',
      position: '结论卡与结果速览。',
      impact: '最终结果之一。',
      source: '计算',
      editable: '间接',
      basis: 'N_install × Q_unit。',
    },
    {
      symbol: 'Q_fault',
      name: '故障后可用冷量',
      meaning: '一台运行机组故障后，剩余机组仍能提供的名义冷量。',
      position: '结论卡与选型建议。',
      impact: 'N+1 / 2N 配置下应仍不小于所需冷量。',
      source: '计算',
      editable: '间接',
      basis: '无备份 = 0；有备份 = N_run × Q_unit。',
    },
    {
      symbol: 'SHR_unit',
      name: '机组显热比',
      meaning: '空调机组显冷量与名义制冷量之比。',
      position: '用于 Q_sensible,unit = Q_run × SHR_unit。',
      impact: '显热比降低 → 机组显冷量不足，机房温度可能偏高。',
      source: '输入（厂家数据）',
      editable: '是（简易模式固定 0.90）',
      basis: 'GB/T 19413 机房空调名义工况；精密空调约 0.90。',
    },
    {
      symbol: 'Q_sensible,unit',
      name: '机组显冷量',
      meaning: '运行机组能够承担的显热冷量。',
      position: '与显热负荷比较。',
      impact: '必须不小于显热负荷。',
      source: '计算',
      editable: '间接',
      basis: 'Q_run × SHR_unit。',
    },
    {
      symbol: 'η_load',
      name: '单台负载率',
      meaning: '所需冷量与运行冷量之比，反映单台机组的负荷水平。',
      position: '用于负载率校核。',
      impact: '负载率过高不利于部分负荷调节与故障切换。',
      source: '计算',
      editable: '间接',
      basis: 'Q_req / Q_run ≤ 90%。',
    },
    {
      symbol: 'q_A,actual',
      name: '实际面积指标',
      meaning: '按总冷负荷与机房面积折算的实际单位面积冷负荷。',
      position: '与机房类型经验范围比较。',
      impact: '偏高说明设备密度大或面积偏小，需要复核。',
      source: '计算',
      editable: '间接',
      basis: 'Q_total × 1000 / A。',
    },
    {
      symbol: 'p_basis',
      name: '匹数基准',
      meaning: '市场俗称“匹”与 kW 的换算基准。',
      position: '用于 P = Q_req / p_basis。',
      impact: '基准越大，同一冷量对应的匹数越小。',
      source: '输入（市场口径）',
      editable: '是（简易模式固定 2.5）',
      basis: '市场习惯 1P≈2.5 kW；老口径约 2.324 kW。',
    },
    {
      symbol: 'P',
      name: '市场匹数',
      meaning: '按市场口径折算的匹数。',
      position: '结论与报告。',
      impact: '只用于沟通，不作为设计依据。',
      source: '计算',
      editable: '间接',
      basis: 'Q_req / p_basis。',
    },
    {
      symbol: 'RT',
      name: '冷吨',
      meaning: '按 1 RT = 3.517 kW 折算的冷吨数。',
      position: '冷水机组选型参考。',
      impact: '只做单位换算，不改变容量。',
      source: '计算',
      editable: '间接',
      basis: '1 RT = 3.517 kW（常数）。',
    },
    {
      symbol: 'Q_unit,max',
      name: '最大标准单机容量',
      meaning: '自动推荐台数时使用的单机容量上限。',
      position: '用于 N_run,auto 估算。',
      impact: '上限越大，自动推荐台数越少。',
      source: '常数',
      editable: '否',
      basis: `STANDARD_UNIT_KW 最大档 ${STANDARD_UNIT_KW[STANDARD_UNIT_KW.length - 1] ?? 160} kW。`,
    },
    {
      symbol: 'unitType',
      name: '机组类型',
      meaning: '精密空调、舒适性空调、冷水机组或基站空调。',
      position: '决定默认显热比与适用场景。',
      impact: '舒适性空调显热比低，不建议用于主机房。',
      source: '输入',
      editable: '是（简易模式固定精密空调）',
      basis: 'GB/T 19413 机房空调产品分类。',
    },
    {
      symbol: 'redundancy',
      name: '冗余方式',
      meaning: '无备份 / N+1 / 2N。',
      position: '用于备用台数、安装容量与故障后可用冷量。',
      impact: '冗余越高，安装容量与投资越大。',
      source: '输入',
      editable: '是',
      basis: 'GB 50174-2017 机房可靠性等级与项目要求。',
    },
  ]
}
