/**
 * 电缆选型的“计算书”数据：把引擎结果拆成可读的推导步骤。
 *
 * 这里只做展示层的组装，不参与选型计算；所有数值都取自 CableSizingResult，
 * 避免页面模板另算一套。
 */

import type { CableSizingInput, CableSizingResult, ProtectionDevice } from './types'

export interface CalcSymbol {
  symbol: string
  name: string
  value: string
  unit?: string
  /** 对应输入控件的 data-symbol；计算值不填 */
  inputSymbol?: string
}

export interface CalcStep {
  key: string
  index: number
  title: string
  formula: string
  substitution: string
  result: string
  symbols: CalcSymbol[]
  pass?: boolean
  note?: string
}

export interface ParameterDoc {
  symbol: string
  name: string
  meaning: string
  position: string
  impact: string
  basis: string
}

function formatNumber(value: number, digits = 1): string {
  return value.toFixed(digits)
}

function formatSection(section: number): string {
  return Number.isInteger(section) ? String(section) : section.toFixed(1)
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

  const steps: CalcStep[] = []

  // ① 计算负荷
  if (input.inputMode === 'power') {
    steps.push({
      key: 'load',
      index: 1,
      title: '计算负荷',
      formula: 'Pjs = P × Kd',
      substitution: `= ${formatNumber(input.powerKw, 2)} × ${formatNumber(input.demandFactor, 2)} = ${formatNumber(result.designPowerKw, 2)} kW`,
      result: `Pjs = ${formatNumber(result.designPowerKw, 2)} kW`,
      symbols: [
        {
          symbol: 'P',
          name: '负载功率',
          value: formatNumber(input.powerKw, 2),
          unit: 'kW',
          inputSymbol: 'P',
        },
        {
          symbol: 'Kd',
          name: '需要系数',
          value: formatNumber(input.demandFactor, 2),
          inputSymbol: 'Kd',
        },
        {
          symbol: 'Pjs',
          name: '计算负荷',
          value: formatNumber(result.designPowerKw, 2),
          unit: 'kW',
        },
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
      formula,
      substitution: `= ${formatNumber(ib, 2)} × ${factors} / 1000 = ${formatNumber(result.designPowerKw, 2)} kW`,
      result: `Pjs = ${formatNumber(result.designPowerKw, 2)} kW`,
      symbols: [
        {
          symbol: 'Ib',
          name: '负载电流',
          value: formatNumber(ib, 2),
          unit: 'A',
          inputSymbol: 'Ib',
        },
        {
          symbol: 'U',
          name: '标称电压',
          value: formatNumber(voltage, 0),
          unit: 'V',
          inputSymbol: 'U',
        },
        ...(isDc
          ? []
          : [
              {
                symbol: 'cosφ',
                name: '功率因数',
                value: formatNumber(cosPhi, 2),
                inputSymbol: 'cosφ',
              },
            ]),
        {
          symbol: 'η',
          name: '效率',
          value: formatNumber(input.efficiency, 2),
          inputSymbol: 'η',
        },
        {
          symbol: 'Pjs',
          name: '计算负荷',
          value: formatNumber(result.designPowerKw, 2),
          unit: 'kW',
        },
      ],
    })
  }

  // ② 计算电流
  if (input.inputMode === 'current') {
    steps.push({
      key: 'current',
      index: 2,
      title: '计算电流',
      formula: 'Ib = 输入电流',
      substitution: `= ${formatNumber(ib, 2)} A`,
      result: `Ib = ${formatNumber(ib, 2)} A`,
      symbols: [
        {
          symbol: 'Ib',
          name: '负载电流',
          value: formatNumber(ib, 2),
          unit: 'A',
          inputSymbol: 'Ib',
        },
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
      formula,
      substitution: `= ${formatNumber(result.designPowerKw, 2)} × 1000 / (${denominator}) = ${formatNumber(ib, 2)} A`,
      result: `Ib = ${formatNumber(ib, 2)} A`,
      symbols: [
        {
          symbol: 'Pjs',
          name: '计算负荷',
          value: formatNumber(result.designPowerKw, 2),
          unit: 'kW',
        },
        {
          symbol: 'U',
          name: '标称电压',
          value: formatNumber(voltage, 0),
          unit: 'V',
          inputSymbol: 'U',
        },
        ...(isDc
          ? []
          : [
              {
                symbol: 'cosφ',
                name: '功率因数',
                value: formatNumber(cosPhi, 2),
                inputSymbol: 'cosφ',
              },
            ]),
        {
          symbol: 'η',
          name: '效率',
          value: formatNumber(input.efficiency, 2),
          inputSymbol: 'η',
        },
        {
          symbol: 'Ib',
          name: '计算电流',
          value: formatNumber(ib, 2),
          unit: 'A',
        },
      ],
    })
  }

  // ③ 修正系数
  steps.push({
    key: 'factors',
    index: 3,
    title: '修正系数',
    formula: 'kt = f(θ)；kg = f(敷设方式, 成束根数)；ks = f(ρ)；kh = f(h3)',
    substitution: `kt = ${formatNumber(kt, 2)}；kg = ${formatNumber(kg, 2)}（${result.groupingCount} 根）；ks = ${formatNumber(ks, 2)}；kh = ${formatNumber(kh, 2)}`,
    result: `成束根数 = ${Math.round(result.groupingCount / n)} × ${n} = ${result.groupingCount} 根；每相并联 n = ${n} 根`,
    symbols: [
      { symbol: 'kt', name: '温度修正', value: formatNumber(kt, 2), inputSymbol: 'θ' },
      { symbol: 'kg', name: '成束修正', value: formatNumber(kg, 2), inputSymbol: 'G' },
      { symbol: 'ks', name: '土壤热阻率修正', value: formatNumber(ks, 2), inputSymbol: 'ρ' },
      { symbol: 'kh', name: '谐波修正', value: formatNumber(kh, 2), inputSymbol: 'h3' },
      { symbol: 'n', name: '每相并联根数', value: String(n), inputSymbol: 'n' },
    ],
    note: 'kg 同时受敷设方式和成束根数影响；ks 仅埋地时生效。',
  })

  // ④ 载流量
  steps.push({
    key: 'ampacity',
    index: 4,
    title: '载流量',
    formula: 'Iz = I_table × kt × kg × ks × kh × n',
    substitution: `= ${formatNumber(result.baseAmpacityA, 1)} × ${formatNumber(kt, 2)} × ${formatNumber(kg, 2)} × ${formatNumber(ks, 2)} × ${formatNumber(kh, 2)} × ${n} = ${formatNumber(iz, 1)} A`,
    result: `Iz = ${formatNumber(iz, 1)} A ${result.totalAmpacityA >= result.ampacityDesignCurrentA ? '≥' : '<'} Ib = ${formatNumber(result.ampacityDesignCurrentA, 1)} A`,
    symbols: [
      {
        symbol: 'I_table',
        name: '基准载流量',
        value: formatNumber(result.baseAmpacityA, 1),
        unit: 'A/根',
      },
      { symbol: 'kt', name: '温度修正', value: formatNumber(kt, 2), inputSymbol: 'θ' },
      { symbol: 'kg', name: '成束修正', value: formatNumber(kg, 2), inputSymbol: 'G' },
      { symbol: 'ks', name: '土壤热阻率修正', value: formatNumber(ks, 2), inputSymbol: 'ρ' },
      { symbol: 'kh', name: '谐波修正', value: formatNumber(kh, 2), inputSymbol: 'h3' },
      { symbol: 'n', name: '每相并联根数', value: String(n), inputSymbol: 'n' },
      { symbol: 'Iz', name: '校正载流量', value: formatNumber(iz, 1), unit: 'A' },
    ],
    pass: result.totalAmpacityA >= result.ampacityDesignCurrentA - 1e-6,
    note: `所选截面 ${formatSection(section)} mm²，基准载流量 ${formatNumber(result.baseAmpacityA, 1)} A/根；载流量裕度 ${formatNumber(result.ampacityMarginPercent, 1)}%。`,
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
    formula: dropFormula,
    substitution: dropSubstitution,
    result: `ΔU = ${formatNumber(result.voltageDropV, 2)} V（${formatNumber(result.voltageDropPercent, 2)} %）`,
    symbols: [
      { symbol: 'Ib', name: '计算电流', value: formatNumber(ib, 2), unit: 'A' },
      {
        symbol: 'L',
        name: '线路长度',
        value: formatNumber(lengthKm, 3),
        unit: 'km',
        inputSymbol: 'L',
      },
      {
        symbol: 'R',
        name: '导体电阻',
        value: formatNumber(result.resistanceMilliohm, 3),
        unit: 'Ω/km',
      },
      {
        symbol: 'X',
        name: '线路电抗',
        value: formatNumber(result.reactanceMilliohm, 3),
        unit: 'Ω/km',
        inputSymbol: 'X',
      },
      ...(isDc
        ? []
        : [
            {
              symbol: 'cosφ',
              name: '功率因数',
              value: formatNumber(cosPhi, 2),
              inputSymbol: 'cosφ',
            },
          ]),
      { symbol: 'ΔU', name: '电压降', value: formatNumber(result.voltageDropV, 2), unit: 'V' },
    ],
    pass: result.voltageDropPercent <= input.allowedDropPercent + 1e-9,
    note: 'R、X 单位 Ω/km，L 已由 m 换算为 km。',
  })

  // ⑥ 短路热稳定
  steps.push({
    key: 'thermal',
    index: 6,
    title: '短路热稳定',
    formula: 'Smin = Isc × √t / k',
    substitution: `= ${formatNumber(isc, 1)} × √${formatNumber(clearingTime, 2)} / ${result.thermalK} = ${formatNumber(result.shortCircuitMinSection, 2)} mm²`,
    result: `Smin = ${formatNumber(result.shortCircuitMinSection, 2)} mm²；所选 ${formatSection(section)} × ${n} = ${formatNumber(section * n, 1)} mm²`,
    symbols: [
      {
        symbol: 'Isc',
        name: '预期短路电流',
        value: formatNumber(isc, 1),
        unit: 'kA',
        inputSymbol: 'Isc',
      },
      {
        symbol: 't',
        name: '保护动作时间',
        value: formatNumber(clearingTime, 2),
        unit: 's',
        inputSymbol: 't',
      },
      { symbol: 'k', name: '热稳定系数', value: String(result.thermalK) },
      {
        symbol: 'Smin',
        name: '最小截面',
        value: formatNumber(result.shortCircuitMinSection, 2),
        unit: 'mm²',
      },
    ],
    pass: section * n >= result.shortCircuitMinSection - 1e-6,
    note: `热稳定耐受 ${formatNumber(result.shortCircuitWithstandKa, 1)} kA；k 按导体/绝缘取值：铜/PVC 115、铜/XLPE 143、铝/PVC 76、铝/XLPE 94。`,
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
    formula: protectionFormula,
    substitution: protectionSubstitution,
    result: result.protectionPass ? '通过' : '不通过',
    symbols: [
      { symbol: 'Ib', name: '计算电流', value: formatNumber(ib, 2), unit: 'A' },
      {
        symbol: 'In',
        name: '保护电器额定电流',
        value: formatNumber(inA, 0),
        unit: 'A',
        inputSymbol: 'In',
      },
      { symbol: 'Iz', name: '校正载流量', value: formatNumber(iz, 1), unit: 'A' },
      ...(isFuse && result.fuseK3
        ? [
            {
              symbol: 'k3',
              name: '熔断器修正系数',
              value: formatNumber(result.fuseK3, 2),
            },
          ]
        : []),
    ],
    pass: result.protectionPass,
    note: `保护电器：${protectionLabel(input.protectionDevice)}。`,
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
      basis: '设备铭牌。',
    },
    {
      symbol: 'Kd',
      name: '需要系数',
      meaning: '负荷同时率或满载率。',
      position: '用于 Pjs = P × Kd。',
      impact: 'Kd 增大 → Ib 增大 → 所需截面增大。',
      basis: 'GB 50054 / 设计手册。',
    },
    {
      symbol: 'Pjs',
      name: '计算负荷',
      meaning: '按需要系数法得到的负荷。',
      position: '用于计算电流 Ib。',
      impact: '中间值，随 P、Kd 变化。',
      basis: 'GB 50054。',
    },
    {
      symbol: 'U',
      name: '标称电压',
      meaning: '系统线电压或直流电压。',
      position: '用于 Ib、ΔU。',
      impact: 'U 增大 → Ib 减小。',
      basis: '系统参数。',
    },
    {
      symbol: 'Ib',
      name: '计算电流',
      meaning: '负荷电流。',
      position: '用于载流量、压降和保护配合。',
      impact: '核心中间值。',
      basis: 'GB 50054。',
    },
    {
      symbol: 'cosφ',
      name: '功率因数',
      meaning: '有功功率与视在功率之比。',
      position: '用于 Ib、ΔU。',
      impact: 'cosφ 增大 → Ib 减小。',
      basis: '负荷特性。',
    },
    {
      symbol: 'η',
      name: '效率',
      meaning: '设备输出与输入功率之比。',
      position: '用于 Ib。',
      impact: 'η 增大 → Ib 减小。',
      basis: '设备铭牌。',
    },
    {
      symbol: 'L',
      name: '线路长度',
      meaning: '单程敷设长度。',
      position: '用于 ΔU。',
      impact: 'L 增大 → ΔU 增大。',
      basis: '现场路径。',
    },
    {
      symbol: 'S',
      name: '导体截面',
      meaning: '标准截面序列中的推荐值。',
      position: '选型结果。',
      impact: 'S 增大 → 载流量增大、压降减小。',
      basis: 'GB/T 16895.6。',
    },
    {
      symbol: 'kt',
      name: '温度修正',
      meaning: '环境或土壤温度对载流量的修正。',
      position: 'Iz 公式。',
      impact: '温度升高 → kt 减小。',
      basis: '表 B.52.14 / B.52.15。',
    },
    {
      symbol: 'kg',
      name: '成束修正',
      meaning: '多根电缆相互加热的修正。',
      position: 'Iz 公式。',
      impact: '成束根数增加 → kg 减小。',
      basis: '表 B.52.17 / B.52.18。',
    },
    {
      symbol: 'ks',
      name: '土壤热阻率修正',
      meaning: '埋地土壤散热能力的修正。',
      position: 'Iz 公式（仅埋地）。',
      impact: '热阻率增大 → ks 减小。',
      basis: '表 B.52.16。',
    },
    {
      symbol: 'kh',
      name: '谐波修正',
      meaning: '三次谐波导致中性线载流的修正。',
      position: 'Iz 公式。',
      impact: '谐波含量增大 → kh 减小。',
      basis: '表 E.52.1。',
    },
    {
      symbol: 'n',
      name: '每相并联根数',
      meaning: '大电流时每相并联的电缆根数。',
      position: 'Iz 公式。',
      impact: 'n 增大 → 总载流量增大，但成束系数下降。',
      basis: '设计选择。',
    },
    {
      symbol: 'Iz',
      name: '校正载流量',
      meaning: '实际敷设条件下的允许电流。',
      position: '与 Ib 比较。',
      impact: '选型结果。',
      basis: 'GB/T 16895.6。',
    },
    {
      symbol: 'R',
      name: '导体电阻',
      meaning: '最高工作温度下的电阻。',
      position: 'ΔU 公式。',
      impact: 'R 增大 → ΔU 增大。',
      basis: 'GB/T 16895.6。',
    },
    {
      symbol: 'X',
      name: '线路电抗',
      meaning: '多芯电缆约 0.08 Ω/km。',
      position: 'ΔU 公式。',
      impact: 'X 增大 → ΔU 增大。',
      basis: '厂家数据 / 手册。',
    },
    {
      symbol: 'Isc',
      name: '预期短路电流',
      meaning: '安装处的短路电流。',
      position: '热稳定公式。',
      impact: 'Isc 增大 → Smin 增大。',
      basis: '系统短路计算。',
    },
    {
      symbol: 't',
      name: '保护动作时间',
      meaning: '短路持续时间。',
      position: '热稳定公式。',
      impact: 't 增大 → Smin 增大。',
      basis: '保护电器特性。',
    },
    {
      symbol: 'In',
      name: '保护电器额定电流',
      meaning: '断路器或熔断器的额定值。',
      position: '保护配合。',
      impact: 'In 需落在 Ib 与 Iz 之间。',
      basis: '保护电器样本。',
    },
    {
      symbol: 'k',
      name: '热稳定系数',
      meaning: '导体和绝缘允许的 I²t 常数。',
      position: '热稳定公式。',
      impact: 'k 增大 → Smin 减小。',
      basis: 'GB/T 16895.5。',
    },
    {
      symbol: 'k3',
      name: '熔断器修正系数',
      meaning: '熔断器熔化系数与 1.45 的比值。',
      position: '保护配合（熔断器）。',
      impact: 'In < 16 A 取 1.31，In ≥ 16 A 取 1.10。',
      basis: 'IEC 60364-4-43 / 厂家数据。',
    },
    {
      symbol: 'h3',
      name: '三次谐波含量',
      meaning: '三次谐波电流占相电流的比例。',
      position: 'kh 与中性线电流。',
      impact: 'h3 增大 → 中性线电流增大。',
      basis: '负荷谐波测试。',
    },
    {
      symbol: 'θ',
      name: '环境 / 土壤温度',
      meaning: '电缆敷设处的温度。',
      position: 'kt。',
      impact: 'θ 升高 → kt 减小。',
      basis: '现场条件。',
    },
    {
      symbol: 'ρ',
      name: '土壤热阻率',
      meaning: '埋地土壤的散热能力。',
      position: 'ks。',
      impact: 'ρ 增大 → ks 减小。',
      basis: '现场条件 / GB 50217。',
    },
    {
      symbol: 'G',
      name: '并列回路数',
      meaning: '相互贴邻的负载回路数。',
      position: '成束根数。',
      impact: 'G 增大 → kg 减小。',
      basis: '敷设设计。',
    },
    {
      symbol: 's',
      name: '埋地间距',
      meaning: '埋地电缆之间的净距。',
      position: 'kg（埋地）。',
      impact: 's 增大 → kg 增大。',
      basis: '表 B.52.18。',
    },
    {
      symbol: 'ΔU',
      name: '电压降',
      meaning: '线路首末端电压差。',
      position: '与允许值比较。',
      impact: '选型结果。',
      basis: 'GB 50054。',
    },
  ]
}
