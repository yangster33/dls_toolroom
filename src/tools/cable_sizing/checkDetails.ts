/**
 * 校核明细的展示层：把每条校核整理成“要求式 / 实际式 / 裕度 / 来源 / 为什么”。
 *
 * 计算仍由 cableSizing.ts 完成；这里只读取结果，不改变选型。
 */

import type { CalcSymbol, SymbolSource } from './calculationSteps'
import type { CableSizingInput, CableSizingResult } from './types'

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

function fmt(value: number, digits = 1): string {
  return value.toFixed(digits)
}

function fmtSection(section: number): string {
  return Number.isInteger(section) ? String(section) : section.toFixed(1)
}

function signed(value: number, digits = 1): string {
  return `${value >= 0 ? '+' : ''}${fmt(value, digits)}`
}

function makeSymbol(
  name: string,
  value: string,
  source: SymbolSource,
  options: { symbol?: string; unit?: string; inputSymbol?: string; sourceDetail?: string } = {},
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

function whyText(pass: boolean, controlling: boolean, margin: string, drivers: string[]): string {
  if (!pass) return `不满足；缺口 ${margin}，需要调整截面、保护整定或敷设条件。`
  if (controlling) return `满足，且是控制项；余量 ${margin}。`
  const driverText = drivers.length ? drivers.join(' / ') : '其他约束'
  return `满足，但未控制最终截面；当前由 ${driverText} 控制，余量 ${margin}。`
}

function checkOf(result: CableSizingResult, key: string) {
  return result.checks.find((check) => check.key === key)
}

export function buildCheckDetails(
  input: CableSizingInput,
  result: CableSizingResult,
): CheckDetail[] {
  const isThreePhase = input.system === 'three-phase'
  const isDc = input.system === 'dc'
  const ib = result.designCurrentA
  const iz = result.totalAmpacityA
  const inA = result.breakerRatingA
  const section = result.selectedSection
  const n = result.parallelCables
  const drivers = result.drivers
  const details: CheckDetail[] = []

  // ① 载流量
  const ampacityCheck = checkOf(result, 'ampacity')
  const ampacityControlling = drivers.includes('载流量')
  const ampacityGap = iz - result.ampacityDesignCurrentA
  const ampacityMargin = `${signed(ampacityGap, 1)} A（${signed(result.ampacityMarginPercent, 1)}%）`
  const ampacitySymbols: CalcSymbol[] = [
    makeSymbol('基准载流量', fmt(result.baseAmpacityA, 1), 'table', {
      symbol: 'I_table',
      unit: 'A/根',
      sourceDetail: result.ampacitySourceLabel,
    }),
    makeSymbol('温度修正', fmt(result.temperatureFactor, 2), 'table', {
      symbol: 'kt',
      inputSymbol: 'θ',
      sourceDetail: 'B.52.14 / B.52.15',
    }),
    makeSymbol('成束修正', fmt(result.groupFactor, 2), 'table', {
      symbol: 'kg',
      inputSymbol: 'G',
      sourceDetail: 'B.52.17 / B.52.18',
    }),
    makeSymbol('土壤热阻率修正', fmt(result.soilFactor, 2), 'table', {
      symbol: 'ks',
      inputSymbol: 'ρ',
      sourceDetail: input.method === 'D' ? 'B.52.16' : '非埋地，不适用',
    }),
    ...(isDc
      ? []
      : [
          makeSymbol('谐波修正', fmt(result.harmonicFactor, 2), 'table', {
            symbol: 'kh',
            inputSymbol: 'h3',
            sourceDetail: 'E.52.1',
          }),
        ]),
    makeSymbol('每相并联根数', String(n), 'input', { symbol: 'n', inputSymbol: 'n' }),
    makeSymbol('校正载流量', fmt(iz, 1), 'calc', { symbol: 'Iz', unit: 'A' }),
    makeSymbol('计算电流', fmt(ib, 2), 'calc', { symbol: 'Ib', unit: 'A' }),
    ...(result.neutralCurrentA > 0
      ? [
          makeSymbol('中性线电流', fmt(result.neutralCurrentA, 2), 'calc', {
            symbol: 'IN',
            unit: 'A',
          }),
        ]
      : []),
  ]
  const ampacitySubstitution = isDc
    ? `Iz = ${fmt(result.baseAmpacityA, 1)} × ${fmt(result.temperatureFactor, 2)} × ${fmt(result.groupFactor, 2)} × ${fmt(result.soilFactor, 2)} × ${n} = ${fmt(iz, 1)} A；Ib = ${fmt(ib, 2)} A`
    : `Iz = ${fmt(result.baseAmpacityA, 1)} × ${fmt(result.temperatureFactor, 2)} × ${fmt(result.groupFactor, 2)} × ${fmt(result.soilFactor, 2)} × ${fmt(result.harmonicFactor, 2)} × ${n} = ${fmt(iz, 1)} A；Ib = ${fmt(ib, 2)} A${result.neutralCurrentA > 0 ? `，IN = ${fmt(result.neutralCurrentA, 2)} A` : ''}`

  details.push({
    key: 'ampacity',
    label: '载流量',
    keyValue: `Iz = ${fmt(iz, 1)} A`,
    required: ampacityCheck?.required ?? `Iz ≥ Ib = ${fmt(ib, 1)} A`,
    actual: ampacityCheck?.actual ?? `Iz = ${fmt(iz, 1)} A`,
    pass: ampacityCheck?.pass ?? iz >= result.ampacityDesignCurrentA,
    controlling: ampacityControlling,
    margin: ampacityMargin,
    formula: 'Iz ≥ max(Ib, IN)',
    substitution: ampacitySubstitution,
    symbols: ampacitySymbols,
    why: whyText(
      ampacityCheck?.pass ?? iz >= result.ampacityDesignCurrentA,
      ampacityControlling,
      ampacityMargin,
      drivers,
    ),
    stepKey: 'ampacity',
    stepLabel: '④ 载流量',
  })

  // ② 谐波 / 中性线（仅三相）
  if (isThreePhase) {
    const rawH3 = Number(input.harmonicThdPercent)
    const h3 = Number.isFinite(rawH3) ? Math.min(100, Math.max(0, rawH3)) : 0
    const neutralBased = result.neutralCurrentA > 0
    const kh = result.harmonicFactor
    const harmonicPass = !neutralBased || iz >= result.neutralCurrentA - 1e-6
    const harmonicControlling = (kh < 1 || neutralBased) && drivers.includes('载流量')
    const harmonicMargin = neutralBased
      ? `Iz - IN = ${signed(iz - result.neutralCurrentA, 1)} A`
      : `kh = ${fmt(kh, 2)}，不修正`
    const harmonicFormula = neutralBased ? 'IN = 3 × h3 × Ib' : 'kh = f(h3)'
    const harmonicSubstitution = neutralBased
      ? `h3 = ${fmt(h3, 0)}% → kh = ${fmt(kh, 2)}；IN = 3 × ${fmt(h3, 0)}% × ${fmt(ib, 2)} = ${fmt(result.neutralCurrentA, 1)} A`
      : `h3 = ${fmt(h3, 0)}% → kh = ${fmt(kh, 2)}；IN = 0 A（不按中性线选型）`
    const harmonicWhy =
      h3 === 0
        ? 'h3=0，kh=1.00，不修正；未控制。'
        : neutralBased
          ? `h3=${fmt(h3, 0)}% > 33%，按中性线电流选型；${harmonicControlling ? '是控制项' : '未控制最终截面'}。`
          : kh < 1
            ? `kh=0.86，载流量按 0.86 修正；${harmonicControlling ? '是控制项' : '未控制最终截面'}。`
            : 'kh=1.00，不修正；未控制。'

    details.push({
      key: 'harmonic',
      label: '谐波 / 中性线',
      keyValue: neutralBased ? `IN = ${fmt(result.neutralCurrentA, 1)} A` : `kh = ${fmt(kh, 2)}`,
      required: `Iz ≥ ${neutralBased ? 'IN' : 'Ib'} = ${fmt(neutralBased ? result.neutralCurrentA : ib, 1)} A`,
      actual: `Iz = ${fmt(iz, 1)} A；kh = ${fmt(kh, 2)}；IN = ${fmt(result.neutralCurrentA, 1)} A`,
      pass: harmonicPass,
      controlling: harmonicControlling,
      margin: harmonicMargin,
      formula: harmonicFormula,
      substitution: harmonicSubstitution,
      symbols: [
        makeSymbol('三次谐波含量', fmt(h3, 0), 'input', {
          symbol: 'h3',
          unit: '%',
          inputSymbol: 'h3',
        }),
        makeSymbol('谐波修正', fmt(kh, 2), 'table', {
          symbol: 'kh',
          inputSymbol: 'h3',
          sourceDetail: 'E.52.1',
        }),
        makeSymbol('中性线电流', fmt(result.neutralCurrentA, 1), 'calc', {
          symbol: 'IN',
          unit: 'A',
        }),
        makeSymbol('计算电流', fmt(ib, 2), 'calc', { symbol: 'Ib', unit: 'A' }),
      ],
      why: harmonicWhy,
      stepKey: 'factors',
      stepLabel: '③ 修正系数',
    })
  }

  // ③ 电压降
  const voltageCheck = checkOf(result, 'voltage-drop')
  const voltageControlling = drivers.includes('电压降')
  const voltageMargin = `${signed(input.allowedDropPercent - result.voltageDropPercent, 2)} 个百分点`
  details.push({
    key: 'voltage-drop',
    label: '电压降',
    keyValue: `ΔU = ${fmt(result.voltageDropPercent, 2)} %`,
    required: voltageCheck?.required ?? `ΔU ≤ ${fmt(input.allowedDropPercent, 1)} %`,
    actual: voltageCheck?.actual ?? `${fmt(result.voltageDropPercent, 2)} %`,
    pass: voltageCheck?.pass ?? result.voltageDropPercent <= input.allowedDropPercent,
    controlling: voltageControlling,
    margin: voltageMargin,
    formula: `ΔU% ≤ ${fmt(input.allowedDropPercent, 1)}%`,
    substitution: `ΔU = ${fmt(result.voltageDropV, 2)} V；ΔU% = ${fmt(result.voltageDropV, 2)} / ${fmt(input.voltage, 0)} × 100 = ${fmt(result.voltageDropPercent, 2)}%`,
    symbols: [
      makeSymbol('计算电流', fmt(ib, 2), 'calc', { symbol: 'Ib', unit: 'A' }),
      makeSymbol('线路长度', fmt(input.lengthM / 1000, 3), 'input', {
        symbol: 'L',
        unit: 'km',
        inputSymbol: 'L',
      }),
      makeSymbol('导体电阻', fmt(result.resistanceMilliohm, 3), 'calc', {
        symbol: 'R',
        unit: 'Ω/km',
        sourceDetail: 'ρθ / S / n',
      }),
      ...(isDc
        ? []
        : [
            makeSymbol('线路电抗', fmt(result.reactanceMilliohm, 3), 'input', {
              symbol: 'X',
              unit: 'Ω/km',
              inputSymbol: 'X',
              sourceDetail: input.reactanceOhmPerKm === 0.08 ? '默认 0.08 Ω/km' : '输入值',
            }),
            makeSymbol('功率因数', fmt(input.powerFactor, 2), 'input', {
              symbol: 'cosφ',
              inputSymbol: 'cosφ',
            }),
          ]),
      makeSymbol('电压降', fmt(result.voltageDropV, 2), 'calc', { symbol: 'ΔU', unit: 'V' }),
    ],
    why: whyText(
      voltageCheck?.pass ?? result.voltageDropPercent <= input.allowedDropPercent,
      voltageControlling,
      voltageMargin,
      drivers,
    ),
    stepKey: 'voltage-drop',
    stepLabel: '⑤ 电压降',
  })

  // ④ 短路热稳定
  const thermalCheck = checkOf(result, 'thermal')
  const thermalControlling = drivers.includes('短路热稳定')
  const thermalMargin = `${signed(section * n - result.shortCircuitMinSection, 2)} mm²`
  details.push({
    key: 'thermal',
    label: '短路热稳定',
    keyValue: `Smin = ${fmt(result.shortCircuitMinSection, 2)} mm²`,
    required: thermalCheck?.required ?? `S ≥ ${fmt(result.shortCircuitMinSection, 1)} mm²`,
    actual: thermalCheck?.actual ?? `${fmtSection(section)} mm² × ${n}`,
    pass: thermalCheck?.pass ?? section * n >= result.shortCircuitMinSection,
    controlling: thermalControlling,
    margin: thermalMargin,
    formula: 'S ≥ Isc × √t / k',
    substitution: `Smin = ${fmt(input.shortCircuitKa, 1)} × √${fmt(input.clearingTimeS, 2)} / ${result.thermalK} = ${fmt(result.shortCircuitMinSection, 2)} mm²；所选 ${fmtSection(section)} × ${n} = ${fmt(section * n, 1)} mm²`,
    symbols: [
      makeSymbol('预期短路电流', fmt(input.shortCircuitKa, 1), 'input', {
        symbol: 'Isc',
        unit: 'kA',
        inputSymbol: 'Isc',
      }),
      makeSymbol('保护动作时间', fmt(input.clearingTimeS, 2), 'input', {
        symbol: 't',
        unit: 's',
        inputSymbol: 't',
      }),
      makeSymbol('热稳定系数', String(result.thermalK), 'constant', {
        symbol: 'k',
        sourceDetail: 'GB/T 16895.5',
      }),
      makeSymbol('最小截面', fmt(result.shortCircuitMinSection, 2), 'calc', {
        symbol: 'Smin',
        unit: 'mm²',
      }),
      makeSymbol('所选截面', fmtSection(section), 'calc', { symbol: 'S', unit: 'mm²' }),
    ],
    why: whyText(
      thermalCheck?.pass ?? section * n >= result.shortCircuitMinSection,
      thermalControlling,
      thermalMargin,
      drivers,
    ),
    stepKey: 'thermal',
    stepLabel: '⑥ 短路热稳定',
  })

  // ⑤ 机械强度
  const mechanicalCheck = checkOf(result, 'mechanical')
  const mechanicalMin = input.material === 'cu' ? 1.5 : 10
  const mechanicalControlling = drivers.includes('机械强度')
  const mechanicalMargin = `${signed(section - mechanicalMin, 1)} mm²`
  details.push({
    key: 'mechanical',
    label: '机械强度',
    keyValue: `S = ${fmtSection(section)} mm²`,
    required: mechanicalCheck?.required ?? `S ≥ ${fmtSection(mechanicalMin)} mm²`,
    actual: mechanicalCheck?.actual ?? `${fmtSection(section)} mm²`,
    pass: mechanicalCheck?.pass ?? section >= mechanicalMin,
    controlling: mechanicalControlling,
    margin: mechanicalMargin,
    formula: 'S ≥ Smin,mech',
    substitution: `${fmtSection(section)} mm² ≥ ${fmtSection(mechanicalMin)} mm²`,
    symbols: [
      makeSymbol('所选截面', fmtSection(section), 'calc', { symbol: 'S', unit: 'mm²' }),
      makeSymbol('最小机械截面', fmtSection(mechanicalMin), 'constant', {
        symbol: 'Smin,mech',
        unit: 'mm²',
        sourceDetail: input.material === 'al' ? '铝芯固定敷设 10 mm²' : '铜芯固定敷设 1.5 mm²',
      }),
    ],
    why: whyText(
      mechanicalCheck?.pass ?? section >= mechanicalMin,
      mechanicalControlling,
      mechanicalMargin,
      drivers,
    ),
  })

  // ⑥ 保护配合
  const protectionCheck = checkOf(result, 'protection')
  const protectionControlling = drivers.includes('保护配合')
  const fuseK3 = result.fuseK3
  const upperLimit = fuseK3 ? iz / fuseK3 : iz
  const protectionMargin = fuseK3
    ? `In - Ib = ${signed(inA - ib, 1)} A；Iz/k3 - In = ${signed(upperLimit - inA, 1)} A`
    : `In - Ib = ${signed(inA - ib, 1)} A；Iz - In = ${signed(iz - inA, 1)} A`
  details.push({
    key: 'protection',
    label: '保护配合',
    keyValue: `In = ${fmt(inA, 0)} A`,
    required: protectionCheck?.required ?? `Ib ≤ In ≤ Iz`,
    actual: protectionCheck?.actual ?? `In = ${fmt(inA, 0)} A`,
    pass: protectionCheck?.pass ?? result.protectionPass,
    controlling: protectionControlling,
    margin: protectionMargin,
    formula: fuseK3 ? 'Ib ≤ In ≤ Iz / k3' : 'Ib ≤ In ≤ Iz',
    substitution: fuseK3
      ? `${fmt(ib, 2)} ≤ ${fmt(inA, 0)} ≤ ${fmt(iz, 1)} / ${fmt(fuseK3, 2)} = ${fmt(upperLimit, 1)} A`
      : `${fmt(ib, 2)} ≤ ${fmt(inA, 0)} ≤ ${fmt(iz, 1)} A`,
    symbols: [
      makeSymbol('计算电流', fmt(ib, 2), 'calc', { symbol: 'Ib', unit: 'A' }),
      makeSymbol('保护电器额定电流', fmt(inA, 0), result.breakerAuto ? 'calc' : 'input', {
        symbol: 'In',
        unit: 'A',
        ...(result.breakerAuto ? {} : { inputSymbol: 'In' }),
        sourceDetail: result.breakerAuto ? '自动匹配' : '手动输入',
      }),
      makeSymbol('校正载流量', fmt(iz, 1), 'calc', { symbol: 'Iz', unit: 'A' }),
      ...(fuseK3
        ? [
            makeSymbol('熔断器修正系数', fmt(fuseK3, 2), 'constant', {
              symbol: 'k3',
              sourceDetail: 'In < 16 A → 1.31；In ≥ 16 A → 1.10',
            }),
          ]
        : []),
    ],
    why: whyText(
      protectionCheck?.pass ?? result.protectionPass,
      protectionControlling,
      protectionMargin,
      drivers,
    ),
    stepKey: 'protection',
    stepLabel: '⑦ 保护配合',
  })

  // ⑦ 电机启动压降（可选，不参与截面选择）
  if (result.startingVoltageDropPercent !== null && result.startingPass !== null) {
    const startingMargin = `${signed(input.allowedStartingDropPercent - result.startingVoltageDropPercent, 2)} 个百分点`
    details.push({
      key: 'motor-start',
      label: '电机启动压降',
      keyValue: `ΔU_start = ${fmt(result.startingVoltageDropPercent, 2)} %`,
      required: `ΔU_start ≤ ${fmt(input.allowedStartingDropPercent, 1)} %`,
      actual: `${fmt(result.startingVoltageDropPercent, 2)} %`,
      pass: result.startingPass,
      controlling: false,
      margin: startingMargin,
      formula: `ΔU_start ≤ ${fmt(input.allowedStartingDropPercent, 1)}%`,
      substitution: `ΔU_start = ${fmt(result.startingVoltageDropPercent, 2)}%`,
      symbols: [
        makeSymbol('启动电流倍数', fmt(input.startingCurrentMultiple, 1), 'input', {
          symbol: 'k_start',
          unit: '×Ib',
          inputSymbol: 'k_start',
        }),
        makeSymbol('启动压降', fmt(result.startingVoltageDropPercent, 2), 'calc', {
          symbol: 'ΔU_start',
          unit: '%',
        }),
      ],
      why: whyText(result.startingPass, false, startingMargin, drivers),
    })
  }

  return details
}
