/**
 * 电缆选型的“计算书”数据：把引擎结果拆成可读、可追溯的推导步骤。
 *
 * 这里只做展示层的组装，不参与选型计算；所有数值都取自 CableSizingResult，
 * 查表/插值细节由 traceability.ts 从同一份表数据生成。
 */

import {
  describeBreaker,
  describeGroupingFactor,
  describeHarmonicFactor,
  describeResistance,
  describeSoilFactor,
  describeTemperatureFactor,
  describeThermalK,
} from './traceability'
import type { CableSizingInput, CableSizingResult, ProtectionDevice } from './types'

export type SymbolSource = 'input' | 'table' | 'calc' | 'constant' | 'default'

export interface CalcSymbol {
  symbol: string
  name: string
  value: string
  unit?: string
  /** 对应输入控件的 data-symbol；计算值不填 */
  inputSymbol?: string
  source: SymbolSource
  /** 来源细节：表号、规则、常数说明等 */
  sourceDetail?: string
}

export interface CalcStep {
  key: string
  index: number
  title: string
  /** 折叠时显示的关键值，如 "Pjs = 24.00 kW" */
  keyValue: string
  formula: string
  substitution: string
  result: string
  symbols: CalcSymbol[]
  pass?: boolean
  controlling?: boolean
  note?: string
}

export interface ParameterDoc {
  symbol: string
  name: string
  meaning: string
  position: string
  impact: string
  source: string
  editable: string
  basis: string
}

function formatNumber(value: number, digits = 1): string {
  return value.toFixed(digits)
}

function formatSection(section: number): string {
  return Number.isInteger(section) ? String(section) : section.toFixed(1)
}

function formatPoints(points: ReadonlyArray<readonly [number, number]>): string {
  return points.map(([value, factor]) => `${value}→${factor.toFixed(2)}`).join('，')
}

function symbol(
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

function protectionLabel(device: ProtectionDevice): string {
  switch (device) {
    case 'mcb':
      return '微型断路器 MCB'
    case 'mccb':
      return '塑壳断路器 MCCB'
    case 'fuse':
      return '熔断器 gG'
  }
}

export function buildCalculationSteps(
  input: CableSizingInput,
  result: CableSizingResult,
): CalcStep[] {
  const isThreePhase = input.system === 'three-phase'
  const isDc = input.system === 'dc'
  const isBuried = input.method === 'D'
  const cosPhi = isDc ? 1 : input.powerFactor
  const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi))
  const voltage = input.voltage
  const lengthKm = input.lengthM / 1000
  const ib = result.designCurrentA
  const iz = result.totalAmpacityA
  const inA = result.breakerRatingA
  const section = result.selectedSection
  const n = result.parallelCables
  const kt = result.temperatureFactor
  const kg = result.groupFactor
  const ks = result.soilFactor
  const kh = result.harmonicFactor
  const isFuse = input.protectionDevice === 'fuse'
  const isc = Number.isFinite(input.shortCircuitKa) ? input.shortCircuitKa : 0
  const clearingTime = Number.isFinite(input.clearingTimeS) ? input.clearingTimeS : 0.1
  const protectionLimit = isFuse && result.fuseK3 ? iz / result.fuseK3 : iz
  const rawThd = Number(input.harmonicThdPercent)
  const thdPercent =
    isThreePhase && Number.isFinite(rawThd) ? Math.min(100, Math.max(0, rawThd)) : 0

  const temperature = describeTemperatureFactor(
    input.insulation,
    isBuried ? 'soil' : 'air',
    input.ambientTempC,
  )
  const grouping = describeGroupingFactor(
    input.method,
    result.groupingCount,
    input.buriedSpacing,
    isBuried,
  )
  const soil = describeSoilFactor(input.soilThermalResistivity, isBuried)
  const harmonic = describeHarmonicFactor(thdPercent)
  const resistance = describeResistance(input, result)
  const thermal = describeThermalK(input.material, input.insulation)
  const breaker = describeBreaker(result)
  const materialLabel = input.material === 'cu' ? '铜' : '铝'
  const insulationLabel = input.insulation === 'pvc' ? 'PVC' : 'XLPE'
  const tableDetail = `${materialLabel}/${insulationLabel}/${input.method}，${formatSection(section)} mm² → ${formatNumber(result.baseAmpacityA, 1)} A/根`
  const xSource: SymbolSource = input.reactanceOhmPerKm === 0.08 ? 'default' : 'input'
  const xSourceDetail = xSource === 'default' ? '默认 0.08 Ω/km' : '输入值'

  const steps: CalcStep[] = []

  // ① 计算负荷
  if (input.inputMode === 'power') {
    steps.push({
      key: 'load',
      index: 1,
      title: '计算负荷',
      keyValue: `Pjs = ${formatNumber(result.designPowerKw, 2)} kW`,
      formula: 'Pjs = P × Kd',
      substitution: `= ${formatNumber(input.powerKw, 2)} × ${formatNumber(input.demandFactor, 2)} = ${formatNumber(result.designPowerKw, 2)} kW`,
      result: `Pjs = ${formatNumber(result.designPowerKw, 2)} kW`,
      symbols: [
        symbol('负载功率', formatNumber(input.powerKw, 2), 'input', {
          symbol: 'P',
          unit: 'kW',
          inputSymbol: 'P',
        }),
        symbol('需要系数', formatNumber(input.demandFactor, 2), 'input', {
          symbol: 'Kd',
          inputSymbol: 'Kd',
        }),
        symbol('计算负荷', formatNumber(result.designPowerKw, 2), 'calc', {
          symbol: 'Pjs',
          unit: 'kW',
        }),
      ],
    })
  } else {
    const formula = isThreePhase
      ? 'Pjs = Ib × √3 × U × cosφ × η / 1000'
      : isDc
        ? 'Pjs = Ib × U × η / 1000'
        : 'Pjs = Ib × U × cosφ × η / 1000'
    const factors = isThreePhase
      ? `1.732 × ${formatNumber(voltage, 0)} × ${formatNumber(cosPhi, 2)} × ${formatNumber(input.efficiency, 2)}`
      : isDc
        ? `${formatNumber(voltage, 0)} × ${formatNumber(input.efficiency, 2)}`
        : `${formatNumber(voltage, 0)} × ${formatNumber(cosPhi, 2)} × ${formatNumber(input.efficiency, 2)}`

    steps.push({
      key: 'load',
      index: 1,
      title: '计算负荷',
      keyValue: `Pjs = ${formatNumber(result.designPowerKw, 2)} kW`,
      formula,
      substitution: `= ${formatNumber(ib, 2)} × ${factors} / 1000 = ${formatNumber(result.designPowerKw, 2)} kW`,
      result: `Pjs = ${formatNumber(result.designPowerKw, 2)} kW`,
      symbols: [
        symbol('负载电流', formatNumber(ib, 2), 'input', {
          symbol: 'Ib',
          unit: 'A',
          inputSymbol: 'Ib',
        }),
        symbol('标称电压', formatNumber(voltage, 0), 'input', {
          symbol: 'U',
          unit: 'V',
          inputSymbol: 'U',
        }),
        ...(isDc
          ? []
          : [
              symbol('功率因数', formatNumber(cosPhi, 2), 'input', {
                symbol: 'cosφ',
                inputSymbol: 'cosφ',
              }),
            ]),
        symbol('效率', formatNumber(input.efficiency, 2), 'input', {
          symbol: 'η',
          inputSymbol: 'η',
        }),
        symbol('计算负荷', formatNumber(result.designPowerKw, 2), 'calc', {
          symbol: 'Pjs',
          unit: 'kW',
        }),
      ],
    })
  }

  // ② 计算电流
  if (input.inputMode === 'current') {
    steps.push({
      key: 'current',
      index: 2,
      title: '计算电流',
      keyValue: `Ib = ${formatNumber(ib, 2)} A`,
      formula: 'Ib = 输入电流',
      substitution: `= ${formatNumber(ib, 2)} A`,
      result: `Ib = ${formatNumber(ib, 2)} A`,
      symbols: [
        symbol('负载电流', formatNumber(ib, 2), 'input', {
          symbol: 'Ib',
          unit: 'A',
          inputSymbol: 'Ib',
        }),
      ],
      note: '按电流输入时，计算负荷由 Ib 反算。',
    })
  } else {
    const formula = isThreePhase
      ? 'Ib = Pjs × 1000 / (√3 × U × cosφ × η)'
      : isDc
        ? 'Ib = Pjs × 1000 / (U × η)'
        : 'Ib = Pjs × 1000 / (U × cosφ × η)'
    const denominator = isThreePhase
      ? `1.732 × ${formatNumber(voltage, 0)} × ${formatNumber(cosPhi, 2)} × ${formatNumber(input.efficiency, 2)}`
      : isDc
        ? `${formatNumber(voltage, 0)} × ${formatNumber(input.efficiency, 2)}`
        : `${formatNumber(voltage, 0)} × ${formatNumber(cosPhi, 2)} × ${formatNumber(input.efficiency, 2)}`

    steps.push({
      key: 'current',
      index: 2,
      title: '计算电流',
      keyValue: `Ib = ${formatNumber(ib, 2)} A`,
      formula,
      substitution: `= ${formatNumber(result.designPowerKw, 2)} × 1000 / (${denominator}) = ${formatNumber(ib, 2)} A`,
      result: `Ib = ${formatNumber(ib, 2)} A`,
      symbols: [
        symbol('计算负荷', formatNumber(result.designPowerKw, 2), 'calc', {
          symbol: 'Pjs',
          unit: 'kW',
        }),
        symbol('标称电压', formatNumber(voltage, 0), 'input', {
          symbol: 'U',
          unit: 'V',
          inputSymbol: 'U',
        }),
        ...(isDc
          ? []
          : [
              symbol('功率因数', formatNumber(cosPhi, 2), 'input', {
                symbol: 'cosφ',
                inputSymbol: 'cosφ',
              }),
            ]),
        symbol('效率', formatNumber(input.efficiency, 2), 'input', {
          symbol: 'η',
          inputSymbol: 'η',
        }),
        symbol('计算电流', formatNumber(ib, 2), 'calc', { symbol: 'Ib', unit: 'A' }),
      ],
    })
  }

  // ③ 修正系数
  const factorLines = [
    `kt：${temperature.table}（${temperature.insulationLabel}，${temperature.mediumLabel}），基准 ${temperature.baseTemperature} ℃；${formatPoints(temperature.points)}；${temperature.expression}`,
    `kg：${grouping.table}（${grouping.rowLabel}），${grouping.count} 根${grouping.exact ? '' : '（按相邻表列）'} → ${formatNumber(grouping.factor, 2)}`,
    soil.applicable
      ? `ks：${soil.table}（直埋），${formatPoints(soil.points)}；${soil.expression}`
      : 'ks：B.52.16（非埋地，不适用）→ 1.00',
    `kh：${harmonic.table}，h3=${formatNumber(thdPercent, 0)}% → ${harmonic.band}，kh=${formatNumber(harmonic.factor, 2)}${harmonic.neutralBased ? '（按中性线选型）' : ''}`,
  ]

  steps.push({
    key: 'factors',
    index: 3,
    title: '修正系数',
    keyValue: `kt / kg / ks / kh = ${formatNumber(kt, 2)} / ${formatNumber(kg, 2)} / ${formatNumber(ks, 2)} / ${formatNumber(kh, 2)}`,
    formula: 'kt、kg、ks、kh 均为查表值；表列之间按线性插值',
    substitution: factorLines.join('\n'),
    result: `kt = ${formatNumber(kt, 2)}；kg = ${formatNumber(kg, 2)}（${result.groupingCount} 根）；ks = ${formatNumber(ks, 2)}；kh = ${formatNumber(kh, 2)}`,
    symbols: [
      symbol('温度修正', formatNumber(kt, 2), 'table', {
        symbol: 'kt',
        inputSymbol: 'θ',
        sourceDetail: temperature.table,
      }),
      symbol('成束修正', formatNumber(kg, 2), 'table', {
        symbol: 'kg',
        inputSymbol: 'G',
        sourceDetail: grouping.table,
      }),
      symbol('土壤热阻率修正', formatNumber(ks, 2), 'table', {
        symbol: 'ks',
        inputSymbol: 'ρ',
        sourceDetail: soil.applicable ? soil.table : '非埋地，不适用',
      }),
      symbol('谐波修正', formatNumber(kh, 2), 'table', {
        symbol: 'kh',
        inputSymbol: 'h3',
        sourceDetail: harmonic.table,
      }),
      symbol('每相并联根数', String(n), 'input', { symbol: 'n', inputSymbol: 'n' }),
    ],
    note: '查表点和插值过程见上方；完整表号见“数据与依据”。',
  })

  // ④ 载流量
  steps.push({
    key: 'ampacity',
    index: 4,
    title: '载流量',
    keyValue: `Iz = ${formatNumber(iz, 1)} A`,
    formula: 'Iz = I_table × kt × kg × ks × kh × n',
    substitution: `= ${formatNumber(result.baseAmpacityA, 1)} × ${formatNumber(kt, 2)} × ${formatNumber(kg, 2)} × ${formatNumber(ks, 2)} × ${formatNumber(kh, 2)} × ${n} = ${formatNumber(iz, 1)} A`,
    result: `Iz = ${formatNumber(iz, 1)} A ${result.totalAmpacityA >= result.ampacityDesignCurrentA ? '≥' : '<'} Ib = ${formatNumber(result.ampacityDesignCurrentA, 1)} A`,
    symbols: [
      symbol('基准载流量', formatNumber(result.baseAmpacityA, 1), 'table', {
        symbol: 'I_table',
        unit: 'A/根',
        sourceDetail: tableDetail,
      }),
      symbol('温度修正', formatNumber(kt, 2), 'table', {
        symbol: 'kt',
        inputSymbol: 'θ',
        sourceDetail: temperature.table,
      }),
      symbol('成束修正', formatNumber(kg, 2), 'table', {
        symbol: 'kg',
        inputSymbol: 'G',
        sourceDetail: grouping.table,
      }),
      symbol('土壤热阻率修正', formatNumber(ks, 2), 'table', {
        symbol: 'ks',
        inputSymbol: 'ρ',
        sourceDetail: soil.applicable ? soil.table : '非埋地，不适用',
      }),
      symbol('谐波修正', formatNumber(kh, 2), 'table', {
        symbol: 'kh',
        inputSymbol: 'h3',
        sourceDetail: harmonic.table,
      }),
      symbol('每相并联根数', String(n), 'input', { symbol: 'n', inputSymbol: 'n' }),
      symbol('校正载流量', formatNumber(iz, 1), 'calc', { symbol: 'Iz', unit: 'A' }),
    ],
    pass: result.totalAmpacityA >= result.ampacityDesignCurrentA - 1e-6,
    controlling: result.drivers.includes('载流量'),
    note: `查表：${tableDetail}；载流量裕度 ${formatNumber(result.ampacityMarginPercent, 1)}%。`,
  })

  // ⑤ 电压降
  const dropFormula = isThreePhase
    ? 'ΔU = √3 × Ib × L × (R × cosφ + X × sinφ)'
    : isDc
      ? 'ΔU = 2 × Ib × L × R'
      : 'ΔU = 2 × Ib × L × (R × cosφ + X × sinφ)'
  const dropSubstitution = isDc
    ? `= 2 × ${formatNumber(ib, 2)} × ${formatNumber(lengthKm, 3)} × ${formatNumber(result.resistanceMilliohm, 3)} = ${formatNumber(result.voltageDropV, 2)} V`
    : `= ${isThreePhase ? '1.732' : '2'} × ${formatNumber(ib, 2)} × ${formatNumber(lengthKm, 3)} × (${formatNumber(result.resistanceMilliohm, 3)} × ${formatNumber(cosPhi, 2)} + ${formatNumber(result.reactanceMilliohm, 3)} × ${formatNumber(sinPhi, 3)}) = ${formatNumber(result.voltageDropV, 2)} V`

  steps.push({
    key: 'voltage-drop',
    index: 5,
    title: '电压降',
    keyValue: `ΔU = ${formatNumber(result.voltageDropPercent, 2)} %`,
    formula: dropFormula,
    substitution: `R：${resistance.expression}\nΔU ${dropSubstitution}`,
    result: `ΔU = ${formatNumber(result.voltageDropV, 2)} V（${formatNumber(result.voltageDropPercent, 2)} %）`,
    symbols: [
      symbol('计算电流', formatNumber(ib, 2), 'calc', { symbol: 'Ib', unit: 'A' }),
      symbol('线路长度', formatNumber(lengthKm, 3), 'input', {
        symbol: 'L',
        unit: 'km',
        inputSymbol: 'L',
      }),
      symbol('导体电阻', formatNumber(result.resistanceMilliohm, 3), 'calc', {
        symbol: 'R',
        unit: 'Ω/km',
        sourceDetail: 'ρθ / S / n',
      }),
      symbol('线路电抗', formatNumber(result.reactanceMilliohm, 3), xSource, {
        symbol: 'X',
        unit: 'Ω/km',
        inputSymbol: 'X',
        sourceDetail: xSourceDetail,
      }),
      ...(isDc
        ? []
        : [
            symbol('功率因数', formatNumber(cosPhi, 2), 'input', {
              symbol: 'cosφ',
              inputSymbol: 'cosφ',
            }),
          ]),
      symbol('电压降', formatNumber(result.voltageDropV, 2), 'calc', {
        symbol: 'ΔU',
        unit: 'V',
      }),
    ],
    pass: result.voltageDropPercent <= input.allowedDropPercent + 1e-9,
    controlling: result.drivers.includes('电压降'),
    note: 'R、X 单位 Ω/km，L 已由 m 换算为 km；R 的推导见上方。',
  })

  // ⑥ 短路热稳定
  steps.push({
    key: 'thermal',
    index: 6,
    title: '短路热稳定',
    keyValue: `Smin = ${formatNumber(result.shortCircuitMinSection, 2)} mm²`,
    formula: 'Smin = Isc × √t / k',
    substitution: `= ${formatNumber(isc, 1)} × √${formatNumber(clearingTime, 2)} / ${thermal.k} = ${formatNumber(result.shortCircuitMinSection, 2)} mm²`,
    result: `Smin = ${formatNumber(result.shortCircuitMinSection, 2)} mm²；所选 ${formatSection(section)} × ${n} = ${formatNumber(section * n, 1)} mm²`,
    symbols: [
      symbol('预期短路电流', formatNumber(isc, 1), 'input', {
        symbol: 'Isc',
        unit: 'kA',
        inputSymbol: 'Isc',
      }),
      symbol('保护动作时间', formatNumber(clearingTime, 2), 'input', {
        symbol: 't',
        unit: 's',
        inputSymbol: 't',
      }),
      symbol('热稳定系数', String(thermal.k), 'constant', {
        symbol: 'k',
        sourceDetail: `${thermal.materialLabel}/${thermal.insulationLabel} → ${thermal.k}`,
      }),
      symbol('最小截面', formatNumber(result.shortCircuitMinSection, 2), 'calc', {
        symbol: 'Smin',
        unit: 'mm²',
      }),
    ],
    pass: section * n >= result.shortCircuitMinSection - 1e-6,
    controlling: result.drivers.includes('短路热稳定'),
    note: `热稳定耐受 ${formatNumber(result.shortCircuitWithstandKa, 1)} kA；k 查表：${thermal.materialLabel}/${thermal.insulationLabel} → ${thermal.k}（${thermal.table}）。`,
  })

  // ⑦ 保护配合
  const protectionFormula = isFuse ? 'Ib ≤ In ≤ Iz / k3' : 'Ib ≤ In ≤ Iz'
  const protectionSubstitution =
    isFuse && result.fuseK3
      ? `= ${formatNumber(ib, 2)} ≤ ${formatNumber(inA, 0)} ≤ ${formatNumber(iz, 1)} / ${formatNumber(result.fuseK3, 2)} = ${formatNumber(protectionLimit, 1)} A`
      : `= ${formatNumber(ib, 2)} ≤ ${formatNumber(inA, 0)} ≤ ${formatNumber(iz, 1)} A`

  steps.push({
    key: 'protection',
    index: 7,
    title: '保护配合',
    keyValue:
      isFuse && result.fuseK3
        ? `In = ${formatNumber(inA, 0)} A ≤ Iz/k3 = ${formatNumber(protectionLimit, 1)} A`
        : `In = ${formatNumber(inA, 0)} A ≤ Iz = ${formatNumber(iz, 1)} A`,
    formula: protectionFormula,
    substitution: protectionSubstitution,
    result: result.protectionPass ? '通过' : '不通过',
    symbols: [
      symbol('计算电流', formatNumber(ib, 2), 'calc', { symbol: 'Ib', unit: 'A' }),
      symbol('保护电器额定电流', formatNumber(inA, 0), breaker.auto ? 'calc' : 'input', {
        symbol: 'In',
        unit: 'A',
        ...(breaker.auto ? {} : { inputSymbol: 'In' }),
        sourceDetail: breaker.rule,
      }),
      symbol('校正载流量', formatNumber(iz, 1), 'calc', { symbol: 'Iz', unit: 'A' }),
      ...(isFuse && result.fuseK3
        ? [
            symbol('熔断器修正系数', formatNumber(result.fuseK3, 2), 'constant', {
              symbol: 'k3',
              sourceDetail: 'In < 16 A → 1.31；In ≥ 16 A → 1.10',
            }),
          ]
        : []),
    ],
    pass: result.protectionPass,
    controlling: result.drivers.includes('保护配合'),
    note: `${protectionLabel(input.protectionDevice)}；${breaker.rule}${breaker.fuseRule ? `；${breaker.fuseRule}` : ''}。`,
  })

  return steps
}

export function buildParameterDocs(): ParameterDoc[] {
  return [
    {
      symbol: 'P',
      name: '负载功率',
      meaning: '设备额定有功功率。',
      position: '用于计算负荷 Pjs。',
      impact: 'P 增大 → Ib 增大 → 所需截面增大。',
      source: '输入',
      editable: '是',
      basis: '设备铭牌。',
    },
    {
      symbol: 'Kd',
      name: '需要系数',
      meaning: '负荷同时率或满载率。',
      position: '用于 Pjs = P × Kd。',
      impact: 'Kd 增大 → Ib 增大 → 所需截面增大。',
      source: '输入',
      editable: '是',
      basis: 'GB 50054 / 设计手册。',
    },
    {
      symbol: 'Pjs',
      name: '计算负荷',
      meaning: '按需要系数法得到的负荷。',
      position: '用于计算电流 Ib。',
      impact: '中间值，随 P、Kd 变化。',
      source: '计算',
      editable: '间接',
      basis: 'GB 50054。',
    },
    {
      symbol: 'U',
      name: '标称电压',
      meaning: '系统线电压或直流电压。',
      position: '用于 Ib、ΔU。',
      impact: 'U 增大 → Ib 减小。',
      source: '输入',
      editable: '是',
      basis: '系统参数。',
    },
    {
      symbol: 'Ib',
      name: '计算电流',
      meaning: '负荷电流。',
      position: '用于载流量、压降和保护配合。',
      impact: '核心中间值。',
      source: '计算',
      editable: '间接',
      basis: 'GB 50054。',
    },
    {
      symbol: 'cosφ',
      name: '功率因数',
      meaning: '有功功率与视在功率之比。',
      position: '用于 Ib、ΔU。',
      impact: 'cosφ 增大 → Ib 减小。',
      source: '输入',
      editable: '是',
      basis: '负荷特性。',
    },
    {
      symbol: 'η',
      name: '效率',
      meaning: '设备输出与输入功率之比。',
      position: '用于 Ib。',
      impact: 'η 增大 → Ib 减小。',
      source: '输入',
      editable: '是',
      basis: '设备铭牌。',
    },
    {
      symbol: 'L',
      name: '线路长度',
      meaning: '单程敷设长度。',
      position: '用于 ΔU。',
      impact: 'L 增大 → ΔU 增大。',
      source: '输入',
      editable: '是',
      basis: '现场路径。',
    },
    {
      symbol: 'S',
      name: '导体截面',
      meaning: '标准截面序列中的推荐值。',
      position: '选型结果。',
      impact: 'S 增大 → 载流量增大、压降减小。',
      source: '计算（选型结果）',
      editable: '间接',
      basis: 'GB/T 16895.6。',
    },
    {
      symbol: 'kt',
      name: '温度修正',
      meaning: '环境或土壤温度对载流量的修正。',
      position: 'Iz 公式。',
      impact: '温度升高 → kt 减小。',
      source: '查表 B.52.14 / B.52.15',
      editable: '间接（改 θ / 绝缘 / 敷设方式）',
      basis: '表 B.52.14 / B.52.15。',
    },
    {
      symbol: 'kg',
      name: '成束修正',
      meaning: '多根电缆相互加热的修正。',
      position: 'Iz 公式。',
      impact: '成束根数增加 → kg 减小。',
      source: '查表 B.52.17 / B.52.18',
      editable: '间接（改敷设方式 / 回路数 / 并联根数）',
      basis: '表 B.52.17 / B.52.18。',
    },
    {
      symbol: 'ks',
      name: '土壤热阻率修正',
      meaning: '埋地土壤散热能力的修正。',
      position: 'Iz 公式（仅埋地）。',
      impact: '热阻率增大 → ks 减小。',
      source: '查表 B.52.16',
      editable: '间接（改 ρ；非埋地不适用）',
      basis: '表 B.52.16。',
    },
    {
      symbol: 'kh',
      name: '谐波修正',
      meaning: '三次谐波导致中性线载流的修正。',
      position: 'Iz 公式。',
      impact: '谐波含量增大 → kh 减小。',
      source: '查表 E.52.1',
      editable: '间接（改 h3）',
      basis: '表 E.52.1。',
    },
    {
      symbol: 'n',
      name: '每相并联根数',
      meaning: '大电流时每相并联的电缆根数。',
      position: 'Iz 公式。',
      impact: 'n 增大 → 总载流量增大，但成束系数下降。',
      source: '输入',
      editable: '是',
      basis: '设计选择。',
    },
    {
      symbol: 'Iz',
      name: '校正载流量',
      meaning: '实际敷设条件下的允许电流。',
      position: '与 Ib 比较。',
      impact: '选型结果。',
      source: '计算',
      editable: '间接',
      basis: 'GB/T 16895.6。',
    },
    {
      symbol: 'R',
      name: '导体电阻',
      meaning: '最高工作温度下的电阻。',
      position: 'ΔU 公式。',
      impact: 'R 增大 → ΔU 增大。',
      source: '计算（ρ20、α、θmax、S、n）',
      editable: '间接',
      basis: 'GB/T 16895.6。',
    },
    {
      symbol: 'X',
      name: '线路电抗',
      meaning: '多芯电缆约 0.08 Ω/km。',
      position: 'ΔU 公式。',
      impact: 'X 增大 → ΔU 增大。',
      source: '输入 / 默认 0.08 Ω/km',
      editable: '是',
      basis: '厂家数据 / 手册。',
    },
    {
      symbol: 'Isc',
      name: '预期短路电流',
      meaning: '安装处的短路电流。',
      position: '热稳定公式。',
      impact: 'Isc 增大 → Smin 增大。',
      source: '输入',
      editable: '是',
      basis: '系统短路计算。',
    },
    {
      symbol: 't',
      name: '保护动作时间',
      meaning: '短路持续时间。',
      position: '热稳定公式。',
      impact: 't 增大 → Smin 增大。',
      source: '输入',
      editable: '是',
      basis: '保护电器特性。',
    },
    {
      symbol: 'In',
      name: '保护电器额定电流',
      meaning: '断路器或熔断器的额定值。',
      position: '保护配合。',
      impact: 'In 需落在 Ib 与 Iz 之间。',
      source: '输入 / 自动',
      editable: '是',
      basis: '保护电器样本。',
    },
    {
      symbol: 'k',
      name: '热稳定系数',
      meaning: '导体和绝缘允许的 I²t 常数。',
      position: '热稳定公式。',
      impact: 'k 增大 → Smin 减小。',
      source: '常数',
      editable: '否',
      basis: 'GB/T 16895.5。',
    },
    {
      symbol: 'k3',
      name: '熔断器修正系数',
      meaning: '熔断器熔化系数与 1.45 的比值。',
      position: '保护配合（熔断器）。',
      impact: 'In < 16 A 取 1.31，In ≥ 16 A 取 1.10。',
      source: '常数',
      editable: '否',
      basis: 'IEC 60364-4-43 / 厂家数据。',
    },
    {
      symbol: 'h3',
      name: '三次谐波含量',
      meaning: '三次谐波电流占相电流的比例。',
      position: 'kh 与中性线电流。',
      impact: 'h3 增大 → 中性线电流增大。',
      source: '输入',
      editable: '是',
      basis: '负荷谐波测试。',
    },
    {
      symbol: 'θ',
      name: '环境 / 土壤温度',
      meaning: '电缆敷设处的温度。',
      position: 'kt。',
      impact: 'θ 升高 → kt 减小。',
      source: '输入',
      editable: '是',
      basis: '现场条件。',
    },
    {
      symbol: 'ρ',
      name: '土壤热阻率',
      meaning: '埋地土壤的散热能力。',
      position: 'ks。',
      impact: 'ρ 增大 → ks 减小。',
      source: '输入（仅埋地）',
      editable: '是（仅埋地）',
      basis: '现场条件 / GB 50217。',
    },
    {
      symbol: 'G',
      name: '并列回路数',
      meaning: '相互贴邻的负载回路数。',
      position: '成束根数。',
      impact: 'G 增大 → kg 减小。',
      source: '输入',
      editable: '是',
      basis: '敷设设计。',
    },
    {
      symbol: 's',
      name: '埋地间距',
      meaning: '埋地电缆之间的净距。',
      position: 'kg（埋地）。',
      impact: 's 增大 → kg 增大。',
      source: '输入（仅埋地）',
      editable: '是（仅埋地）',
      basis: '表 B.52.18。',
    },
    {
      symbol: 'ΔU',
      name: '电压降',
      meaning: '线路首末端电压差。',
      position: '与允许值比较。',
      impact: '选型结果。',
      source: '计算',
      editable: '间接',
      basis: 'GB 50054。',
    },
  ]
}
