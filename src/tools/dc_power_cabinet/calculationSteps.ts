/**
 * 通信直流电源柜选型的“计算书”数据：把引擎结果拆成可读、可追溯的推导步骤。
 *
 * 这里只做展示层的组装，不参与容量 / 模块 / 柜体计算；所有数值都取自
 * DcCabinetResult，输入系数从 DcCabinetInput 读取。步骤顺序对应
 * docs/2026-11-10-tool-25-dc-power-cabinet-transparency-plan.md 第 4 节。
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
import type { DcCabinetInput, DcCabinetResult } from './dcPowerCabinet'

export type { CalcSymbol, CalcStep, ParameterDoc, SymbolSource }

const fmt = (value: number, digits = 1) => formatNumber(value, digits)

/** 计算书步骤的显示名，如 "⑤ 模块数量"。 */
export const stepLabel = stepLabelOf

export function buildDcCabinetSteps(input: DcCabinetInput, result: DcCabinetResult): CalcStep[] {
  const isCurrentMode = input.loadMode === 'current'
  const isThreePhase = input.acPhase === 3
  const u = Number(input.dcVoltage)
  const moduleCurrent = Number(input.moduleCurrentA)
  const derating = Number(input.moduleDerating)
  const futureGrowth = Number(input.futureGrowth)
  const moduleU = Number(input.moduleU)
  const reserveU = Number(input.reserveU)
  const maxModulesPerCabinet = Number(input.maxModulesPerCabinet)
  const breakerMargin = Number(input.breakerMargin)
  const efficiency = Number(input.rectifierEfficiency)
  const powerFactor = Number(input.acPowerFactor)
  const acVoltage = Number(input.acVoltage)
  const steps: CalcStep[] = []

  // ① 负荷电流
  steps.push({
    key: 'load',
    index: 1,
    title: '负荷电流',
    keyValue: `I_load = ${fmt(result.loadCurrentA, 1)} A`,
    formula: isCurrentMode ? 'I_load = 输入负荷电流' : 'I_load = P_load × 1000 / U_dc',
    substitution: isCurrentMode
      ? `= ${fmt(result.loadCurrentA, 2)} A（按负荷电流输入）`
      : `= ${fmt(Number(input.loadPowerKw), 2)} × 1000 / ${fmt(u, 0)} = ${fmt(result.loadCurrentA, 2)} A`,
    result: `I_load = ${fmt(result.loadCurrentA, 2)} A`,
    symbols: [
      symbol('直流标称电压', fmt(u, 0), 'input', {
        symbol: 'U_dc',
        unit: 'V',
        inputSymbol: 'U_dc',
      }),
      ...(isCurrentMode
        ? [
            symbol('近期负荷电流', fmt(result.loadCurrentA, 2), 'input', {
              symbol: 'I_load',
              unit: 'A',
              inputSymbol: 'I_load',
            }),
          ]
        : [
            symbol('近期负荷功率', fmt(Number(input.loadPowerKw), 2), 'input', {
              symbol: 'P_load',
              unit: 'kW',
              inputSymbol: 'P_load',
            }),
            symbol('负荷电流', fmt(result.loadCurrentA, 2), 'calc', {
              symbol: 'I_load',
              unit: 'A',
            }),
          ]),
    ],
    note: isCurrentMode
      ? '按设备额定电流直接输入，不再按电压折算。'
      : '按设备铭牌功率折算为直流侧电流。',
  })

  // ② 均充电流
  steps.push({
    key: 'charge',
    index: 2,
    title: '均充电流',
    keyValue: `I_charge = ${fmt(result.chargeCurrentA, 1)} A`,
    formula: 'I_charge = C10 × k_charge',
    substitution: `= ${fmt(Number(input.batteryAh), 0)} × ${fmt(Number(input.chargeRate), 2)} = ${fmt(result.chargeCurrentA, 2)} A`,
    result: `I_charge = ${fmt(result.chargeCurrentA, 2)} A`,
    symbols: [
      symbol('电池额定容量', fmt(Number(input.batteryAh), 0), 'input', {
        symbol: 'C10',
        unit: 'Ah',
        inputSymbol: 'C10',
      }),
      symbol('均充倍率', `${fmt(Number(input.chargeRate), 2)}C10`, 'input', {
        symbol: 'k_charge',
        inputSymbol: 'k_charge',
        sourceDetail: 'GB 51194 常用 0.1C10',
      }),
      symbol('均充电流', fmt(result.chargeCurrentA, 2), 'calc', {
        symbol: 'I_charge',
        unit: 'A',
      }),
    ],
    note:
      Number(input.batteryAh) <= 0
        ? '未配置蓄电池，均充电流按 0 计；配置电池后需要重新校核整流容量。'
        : '均充倍率按电池厂家均充电流取值，工程初选常用 10h 率 0.1C10。',
  })

  // ③ 设计电流
  steps.push({
    key: 'design',
    index: 3,
    title: '设计电流',
    keyValue: `I_design = ${fmt(result.designCurrentA, 1)} A`,
    formula: 'I_design = I_load + I_charge',
    substitution: `= ${fmt(result.loadCurrentA, 2)} + ${fmt(result.chargeCurrentA, 2)} = ${fmt(result.designCurrentA, 2)} A`,
    result: `I_design = ${fmt(result.designCurrentA, 2)} A`,
    symbols: [
      symbol('负荷电流', fmt(result.loadCurrentA, 2), 'calc', { symbol: 'I_load', unit: 'A' }),
      symbol('均充电流', fmt(result.chargeCurrentA, 2), 'calc', {
        symbol: 'I_charge',
        unit: 'A',
      }),
      symbol('设计电流', fmt(result.designCurrentA, 2), 'calc', {
        symbol: 'I_design',
        unit: 'A',
      }),
    ],
    note: '近期负荷 + 均充，用于模块数量和直流主断路器。',
  })

  // ④ 远期电流
  steps.push({
    key: 'future',
    index: 4,
    title: '远期电流',
    keyValue: `I_frame = ${fmt(result.frameCurrentA, 1)} A`,
    formula: 'I_frame = I_design × futureGrowth',
    substitution: `= ${fmt(result.designCurrentA, 2)} × ${fmt(futureGrowth, 2)} = ${fmt(result.frameCurrentA, 2)} A`,
    result: `I_frame = ${fmt(result.frameCurrentA, 2)} A`,
    symbols: [
      symbol('设计电流', fmt(result.designCurrentA, 2), 'calc', {
        symbol: 'I_design',
        unit: 'A',
      }),
      symbol('远期 / 近期比', fmt(futureGrowth, 2), 'input', {
        symbol: 'futureGrowth',
        inputSymbol: 'futureGrowth',
        sourceDetail: '1.3 = 预留 30%',
      }),
      symbol('远期电流', fmt(result.frameCurrentA, 2), 'calc', {
        symbol: 'I_frame',
        unit: 'A',
      }),
    ],
    note: '只校核满架容量和柜体 U 位预留，不直接决定近期模块数。',
  })

  // ⑤ 模块数量
  steps.push({
    key: 'modules',
    index: 5,
    title: '模块数量',
    keyValue: `${result.mainModules} 主用 + ${result.redundantModules} 备用 = ${result.totalModules} 个模块`,
    formula:
      'I_module,eff = I_module × derating\nmainModules = ceil(I_design / I_module,eff)\nredundantModules = N ? 0 : N+1 ? 1 : 2\ntotalModules = mainModules + redundantModules',
    substitution: `I_module,eff = ${fmt(moduleCurrent, 0)} × ${fmt(derating, 2)} = ${fmt(result.moduleEffectiveA, 1)} A；mainModules = ceil(${fmt(result.designCurrentA, 1)} / ${fmt(result.moduleEffectiveA, 1)}) = ${result.mainModules}；redundantModules = ${result.redundantModules}；totalModules = ${result.mainModules} + ${result.redundantModules} = ${result.totalModules}`,
    result: `安装 ${result.totalModules} × ${fmt(moduleCurrent, 0)} A = ${fmt(result.installedNameplateA, 0)} A 标称（降额后 ${fmt(result.installedEffectiveA, 1)} A）`,
    symbols: [
      symbol('单模块额定电流', fmt(moduleCurrent, 0), 'input', {
        symbol: 'I_module',
        unit: 'A',
        inputSymbol: 'I_module',
      }),
      symbol('模块降额系数', fmt(derating, 2), 'input', {
        symbol: 'derating',
        inputSymbol: 'derating',
        sourceDetail: '高温 / 高海拔按厂家曲线',
      }),
      symbol('模块有效电流', fmt(result.moduleEffectiveA, 1), 'calc', {
        symbol: 'I_module,eff',
        unit: 'A',
      }),
      symbol('冗余方式', input.redundancy, 'input', {
        symbol: 'redundancy',
        inputSymbol: 'redundancy',
      }),
      symbol('主用模块数', String(result.mainModules), 'calc', { symbol: 'mainModules' }),
      symbol('备用模块数', String(result.redundantModules), 'calc', {
        symbol: 'redundantModules',
      }),
      symbol('总模块数', String(result.totalModules), 'calc', { symbol: 'totalModules' }),
      symbol('安装标称容量', fmt(result.installedNameplateA, 0), 'calc', {
        symbol: 'installedNameplateA',
        unit: 'A',
      }),
      symbol('安装有效容量', fmt(result.installedEffectiveA, 1), 'calc', {
        symbol: 'installedEffectiveA',
        unit: 'A',
      }),
    ],
    note: `冗余方式 ${input.redundancy}，备用 ${result.redundantModules} 个模块；主用模块按近期设计电流向上取整。`,
  })

  // ⑥ 满架容量
  steps.push({
    key: 'frame',
    index: 6,
    title: '满架容量',
    keyValue: `满架 ${result.frameModules} 个模块 / ${fmt(result.frameCapacityA, 1)} A`,
    formula:
      'frameMainModules = ceil(I_frame / I_module,eff)\nframeModules = frameMainModules + redundantModules\nframeCapacityA = frameModules × I_module,eff',
    substitution: `ceil(${fmt(result.frameCurrentA, 1)} / ${fmt(result.moduleEffectiveA, 1)}) = ${result.frameMainModules}；frameModules = ${result.frameMainModules} + ${result.redundantModules} = ${result.frameModules}；frameCapacityA = ${result.frameModules} × ${fmt(result.moduleEffectiveA, 1)} = ${fmt(result.frameCapacityA, 1)} A`,
    result: `满架 ${result.frameModules} 个模块槽位 / ${fmt(result.frameCapacityA, 1)} A（降额后）`,
    symbols: [
      symbol('远期电流', fmt(result.frameCurrentA, 1), 'calc', {
        symbol: 'I_frame',
        unit: 'A',
      }),
      symbol('模块有效电流', fmt(result.moduleEffectiveA, 1), 'calc', {
        symbol: 'I_module,eff',
        unit: 'A',
      }),
      symbol('满架主用模块数', String(result.frameMainModules), 'calc', {
        symbol: 'frameMainModules',
      }),
      symbol('满架模块数', String(result.frameModules), 'calc', { symbol: 'frameModules' }),
      symbol('满架容量', fmt(result.frameCapacityA, 1), 'calc', {
        symbol: 'frameCapacityA',
        unit: 'A',
      }),
    ],
    note: '满架按远期负荷预留，柜体 U 位和配电分路应按远期一次预留。',
  })

  // ⑦ 柜体 U 位 / 柜数
  const cabinetU = result.usableU * result.cabinetCount
  steps.push({
    key: 'cabinet',
    index: 7,
    title: '柜体 U 位 / 柜数',
    keyValue: `占用 ${fmt(result.requiredU, 0)}U，${fmt(result.selectedHeightMm, 0)} mm / ${result.usableU}U 柜 × ${result.cabinetCount} 面`,
    formula:
      'installedU = totalModules × moduleU + reserveU\nframeU = frameModules × moduleU + reserveU\nrequiredU = max(installedU, frameU)\nusableU = 柜高对应可用 U 数\ncabinetCount = max(1, ceil(requiredU / usableU), ceil(max(totalModules, frameModules) / maxModulesPerCabinet))',
    substitution: `installedU = ${result.totalModules} × ${fmt(moduleU, 1)} + ${fmt(reserveU, 0)} = ${fmt(result.installedU, 0)}U；frameU = ${result.frameModules} × ${fmt(moduleU, 1)} + ${fmt(reserveU, 0)} = ${fmt(result.frameU, 0)}U；requiredU = max(${fmt(result.installedU, 0)}, ${fmt(result.frameU, 0)}) = ${fmt(result.requiredU, 0)}U；usableU = ${result.usableU}U；cabinetCount = max(1, ceil(${fmt(result.requiredU, 0)} / ${result.usableU}), ceil(${result.moduleSlots} / ${fmt(maxModulesPerCabinet, 0)})) = ${result.cabinetCount}`,
    result: `${fmt(result.requiredU, 0)}U / ${cabinetU}U（${result.cabinetCount} 面柜，余 ${cabinetU - result.requiredU}U）`,
    symbols: [
      symbol('模块占用 U', fmt(moduleU, 1), 'input', {
        symbol: 'moduleU',
        unit: 'U',
        inputSymbol: 'moduleU',
        sourceDetail: '按厂家模块型谱',
      }),
      symbol('备用 U', fmt(reserveU, 0), 'input', {
        symbol: 'reserveU',
        unit: 'U',
        inputSymbol: 'reserveU',
        sourceDetail: '监控 / 配电 / 备用占位',
      }),
      symbol('安装占用 U', fmt(result.installedU, 0), 'calc', {
        symbol: 'installedU',
        unit: 'U',
      }),
      symbol('满架占用 U', fmt(result.frameU, 0), 'calc', { symbol: 'frameU', unit: 'U' }),
      symbol('所需 U 位', fmt(result.requiredU, 0), 'calc', {
        symbol: 'requiredU',
        unit: 'U',
      }),
      symbol('柜高可用 U', String(result.usableU), 'table', {
        symbol: 'usableU',
        unit: 'U',
        sourceDetail: `${fmt(result.selectedHeightMm, 0)} mm 柜对应 ${result.usableU}U`,
      }),
      symbol('单柜最大模块数', fmt(maxModulesPerCabinet, 0), 'input', {
        symbol: 'maxModulesPerCabinet',
        unit: '个',
        inputSymbol: 'maxModulesPerCabinet',
        sourceDetail: '按厂家型谱',
      }),
      symbol('柜数', String(result.cabinetCount), 'calc', {
        symbol: 'cabinetCount',
        unit: '面',
      }),
    ],
    note: `${fmt(result.selectedWidthMm, 0)}×${fmt(result.selectedDepthMm, 0)}×${fmt(result.selectedHeightMm, 0)} mm 为拟用柜体；推荐柜体为 ${result.recommendedWidthMm}×${result.recommendedDepthMm}×${result.recommendedHeightMm} mm × ${result.recommendedCount}。`,
  })

  // ⑧ 直流主断路器 / 交流输入
  steps.push({
    key: 'breakers',
    index: 8,
    title: '直流主断路器 / 交流输入',
    keyValue: `DC ${result.mainBreakerA} A / AC ${result.acBreakerA} A`,
    formula: `mainBreakerA = nextStandardBreaker(I_design × breakerMargin)\nP_dc = I_design × U_dc / 1000\nP_ac = P_dc / η_rect\n${isThreePhase ? 'I_ac = P_ac × 1000 / (√3 × U_ac × PF)' : 'I_ac = P_ac × 1000 / (U_ac × PF)'}\nacBreakerA = nextStandardBreaker(I_ac × breakerMargin)`,
    substitution: `${result.mainBreakerA} = nextStandardBreaker(${fmt(result.designCurrentA, 1)} × ${fmt(breakerMargin, 2)} = ${fmt(result.designCurrentA * breakerMargin, 1)})；P_dc = ${fmt(result.designCurrentA, 1)} × ${fmt(u, 0)} / 1000 = ${fmt(result.dcOutputPowerKw, 2)} kW；P_ac = ${fmt(result.dcOutputPowerKw, 2)} / ${fmt(efficiency, 2)} = ${fmt(result.acInputPowerKw, 2)} kW；I_ac = ${fmt(result.acInputPowerKw, 2)} × 1000 / ${isThreePhase ? `(√3 × ${fmt(acVoltage, 0)} × ${fmt(powerFactor, 2)})` : `(${fmt(acVoltage, 0)} × ${fmt(powerFactor, 2)})`} = ${fmt(result.acInputCurrentA, 2)} A；${result.acBreakerA} = nextStandardBreaker(${fmt(result.acInputCurrentA, 1)} × ${fmt(breakerMargin, 2)} = ${fmt(result.acInputCurrentA * breakerMargin, 1)})`,
    result: `直流主断路器 ${result.mainBreakerA} A；交流输入 ${fmt(result.acInputPowerKw, 2)} kW / ${fmt(result.acInputCurrentA, 2)} A / ${result.acBreakerA} A`,
    symbols: [
      symbol('断路器余量', fmt(breakerMargin, 2), 'input', {
        symbol: 'breakerMargin',
        inputSymbol: 'breakerMargin',
        sourceDetail: '常取 1.25',
      }),
      symbol('直流主断路器', String(result.mainBreakerA), 'table', {
        symbol: 'mainBreakerA',
        unit: 'A',
        sourceDetail: '标准壳架',
      }),
      symbol('直流输出功率', fmt(result.dcOutputPowerKw, 2), 'calc', {
        symbol: 'P_dc',
        unit: 'kW',
      }),
      symbol('整流效率', fmt(efficiency, 2), 'input', {
        symbol: 'η_rect',
        inputSymbol: 'η_rect',
      }),
      symbol('交流输入功率', fmt(result.acInputPowerKw, 2), 'calc', {
        symbol: 'P_ac',
        unit: 'kW',
      }),
      symbol('交流电压', fmt(acVoltage, 0), 'input', {
        symbol: 'U_ac',
        unit: 'V',
        inputSymbol: 'U_ac',
        sourceDetail: isThreePhase ? '三相 380 V 进线' : '单相 220 V 进线',
      }),
      symbol('交流功率因数', fmt(powerFactor, 2), 'input', {
        symbol: 'PF',
        inputSymbol: 'PF',
      }),
      symbol('交流输入电流', fmt(result.acInputCurrentA, 2), 'calc', {
        symbol: 'I_ac',
        unit: 'A',
      }),
      symbol('交流输入断路器', String(result.acBreakerA), 'table', {
        symbol: 'acBreakerA',
        unit: 'A',
        sourceDetail: '标准壳架',
      }),
    ],
    note: '断路器按计算电流乘余量后向上取标准壳架，最终按保护选择性校验；交流输入电流按效率、功率因数和相数估算。',
  })

  return steps
}

export function buildParameterDocs(): ParameterDoc[] {
  return [
    {
      symbol: 'U_dc',
      name: '直流标称电压',
      meaning: '通信直流系统的标称电压，-48 V 最常用，也有 -24 V、240 V、336 V。',
      position: '用于功率折算负荷电流（功率模式）和 DC 输出功率 P_dc。',
      impact: '电压越高，同一功率下负荷电流越小，但绝缘与防触电要求更高。',
      source: '输入',
      editable: '是',
      basis: 'GB 51194-2016 通信电源系统电压系列。',
    },
    {
      symbol: 'I_load',
      name: '近期负荷电流',
      meaning: '近期通信设备的直流负荷电流；按功率输入时由 P_load 折算。',
      position: '用于设计电流 I_design。',
      impact: 'I_load 增大 → I_design、模块数、断路器同向增大。',
      source: '输入 / 计算',
      editable: '是（改负荷电流或功率）',
      basis: '设备铭牌与近期负荷统计。',
    },
    {
      symbol: 'P_load',
      name: '近期负荷功率',
      meaning: '按功率输入时的近期直流负荷功率。',
      position: '用于 I_load = P_load × 1000 / U_dc。',
      impact: 'P_load 增大 → 负荷电流与模块数增大。',
      source: '输入',
      editable: '是',
      basis: '设备铭牌功率统计。',
    },
    {
      symbol: 'C10',
      name: '电池额定容量',
      meaning: '蓄电池 10h 额定容量，0 表示暂不配置电池。',
      position: '用于均充电流 I_charge = C10 × k_charge。',
      impact: 'C10 增大 → 均充电流增大 → 设计电流与模块数增大。',
      source: '输入',
      editable: '是',
      basis: '蓄电池计算工具结果或电池厂家规格。',
    },
    {
      symbol: 'k_charge',
      name: '均充倍率',
      meaning: '均充电流与电池额定容量的比值，常用 0.1C10。',
      position: '用于均充电流。',
      impact: '倍率增大 → 均充电流、设计电流与模块数增大。',
      source: '输入',
      editable: '是（专业模式；简易模式固定 0.1）',
      basis: 'GB 51194-2016 第 5.2 节与电池厂家均充参数。',
    },
    {
      symbol: 'I_charge',
      name: '均充电流',
      meaning: '电池均充时叠加在负荷上的直流电流。',
      position: '用于设计电流。',
      impact: '直接抬高近期设计电流。',
      source: '计算',
      editable: '间接（改 C10 / k_charge）',
      basis: '0.1C10 工程估算。',
    },
    {
      symbol: 'I_design',
      name: '近期设计电流',
      meaning: '近期负荷电流与均充电流之和。',
      position: '用于模块数量、满架主用模块和直流主断路器。',
      impact: '核心中间值。',
      source: '计算',
      editable: '间接',
      basis: 'GB 51194 5.3.1：整流器按近期负荷配置。',
    },
    {
      symbol: 'futureGrowth',
      name: '远期 / 近期比',
      meaning: '远期负荷相对近期负荷的增长倍数。',
      position: '用于远期电流 I_frame。',
      impact: '增大 → 满架模块数、柜体 U 位预留增大。',
      source: '输入',
      editable: '是',
      basis: '项目负荷预测，常用 1.3。',
    },
    {
      symbol: 'I_frame',
      name: '远期电流',
      meaning: '按增长倍数预留的远期设计电流。',
      position: '用于满架模块数。',
      impact: '只影响满架与柜体预留，不直接决定近期模块数。',
      source: '计算',
      editable: '间接',
      basis: 'GB 51194 5.3.2：满架容量考虑远期。',
    },
    {
      symbol: 'I_module',
      name: '单模块额定电流',
      meaning: '单个整流模块的额定输出电流。',
      position: '用于模块有效电流与模块数量。',
      impact: '模块电流越大，所需模块数越少。',
      source: '输入（厂家数据）',
      editable: '是',
      basis: '整流模块厂家样本（常见 50/75/100/150/200 A）。',
    },
    {
      symbol: 'derating',
      name: '模块降额系数',
      meaning: '高温、高海拔等条件下模块输出能力的折减。',
      position: '用于 I_module,eff = I_module × derating。',
      impact: '降额越大，有效电流越小，模块数越多。',
      source: '输入（厂家数据）',
      editable: '是（专业模式；简易模式固定 0.90）',
      basis: '模块厂家降额曲线；简易模式取常见值 0.90。',
    },
    {
      symbol: 'I_module,eff',
      name: '模块有效电流',
      meaning: '降额后单个模块可用的输出电流。',
      position: '用于主用模块数、满架模块数与容量校核。',
      impact: '减小 → 模块数增加。',
      source: '计算',
      editable: '间接',
      basis: 'I_module × derating。',
    },
    {
      symbol: 'redundancy',
      name: '冗余方式',
      meaning: 'N / N+1 / N+2，决定备用模块数量。',
      position: '用于 totalModules 与 frameModules。',
      impact: '冗余越高，安装容量与柜体占用越大。',
      source: '输入',
      editable: '是',
      basis: '通信局站常用 N+1，重要局站可 N+2。',
    },
    {
      symbol: 'mainModules',
      name: '主用模块数',
      meaning: '满足近期设计电流所需的最少模块数。',
      position: '用于总模块数与安装容量。',
      impact: '随 I_design 增大、I_module,eff 减小而增大。',
      source: '计算',
      editable: '间接',
      basis: 'ceil(I_design / I_module,eff)。',
    },
    {
      symbol: 'redundantModules',
      name: '备用模块数',
      meaning: '按冗余方式增加的备用模块数量。',
      position: '用于总模块数与满架模块数。',
      impact: 'N=0，N+1=1，N+2=2。',
      source: '计算',
      editable: '间接（改冗余方式）',
      basis: '冗余方式定义。',
    },
    {
      symbol: 'totalModules',
      name: '总模块数',
      meaning: '主用模块与备用模块之和。',
      position: '用于安装容量与柜体 U 位。',
      impact: '决定安装标称 / 有效容量。',
      source: '计算',
      editable: '间接',
      basis: 'mainModules + redundantModules。',
    },
    {
      symbol: 'installedNameplateA',
      name: '安装标称容量',
      meaning: '按模块铭牌电流累计的安装容量。',
      position: '结论卡与结果速览。',
      impact: '最终结果之一。',
      source: '计算',
      editable: '间接',
      basis: 'totalModules × I_module。',
    },
    {
      symbol: 'installedEffectiveA',
      name: '安装有效容量',
      meaning: '降额后可用的安装容量。',
      position: '整流容量校核。',
      impact: '必须不小于近期设计电流。',
      source: '计算',
      editable: '间接',
      basis: 'totalModules × I_module,eff。',
    },
    {
      symbol: 'frameMainModules',
      name: '满架主用模块数',
      meaning: '按远期电流所需的主用模块数。',
      position: '用于满架模块数。',
      impact: '随远期电流增大而增大。',
      source: '计算',
      editable: '间接',
      basis: 'ceil(I_frame / I_module,eff)。',
    },
    {
      symbol: 'frameModules',
      name: '满架模块数',
      meaning: '满架主用模块数加备用模块数。',
      position: '用于满架容量与柜体 U 位。',
      impact: '决定远期预留槽位。',
      source: '计算',
      editable: '间接',
      basis: 'frameMainModules + redundantModules。',
    },
    {
      symbol: 'frameCapacityA',
      name: '满架容量',
      meaning: '满架模块降额后的总输出能力。',
      position: '满架容量校核。',
      impact: '必须不小于远期电流。',
      source: '计算',
      editable: '间接',
      basis: 'frameModules × I_module,eff。',
    },
    {
      symbol: 'moduleU',
      name: '模块占用 U',
      meaning: '单个整流模块占用的机柜 U 数。',
      position: '用于安装 / 满架 U 位。',
      impact: 'U 数越大，所需柜体空间越大。',
      source: '输入（厂家数据）',
      editable: '是（专业模式；简易模式固定 1U）',
      basis: '模块厂家型谱。',
    },
    {
      symbol: 'reserveU',
      name: '备用 U',
      meaning: '监控、配电与备用空间占用的 U 数。',
      position: '用于安装 / 满架 U 位。',
      impact: '增大 → 所需 U 位与柜数增大。',
      source: '输入',
      editable: '是（专业模式；简易模式固定 8U）',
      basis: '常见组合电源柜配置，常取 6~10U。',
    },
    {
      symbol: 'installedU',
      name: '安装占用 U',
      meaning: '近期模块与监控配电占用的 U 位。',
      position: '与 frameU 比较取大者。',
      impact: '影响柜数。',
      source: '计算',
      editable: '间接',
      basis: 'totalModules × moduleU + reserveU。',
    },
    {
      symbol: 'frameU',
      name: '满架占用 U',
      meaning: '按远期满架模块预留的 U 位。',
      position: '与 installedU 比较取大者。',
      impact: '影响柜数。',
      source: '计算',
      editable: '间接',
      basis: 'frameModules × moduleU + reserveU。',
    },
    {
      symbol: 'requiredU',
      name: '所需 U 位',
      meaning: '安装 U 位与满架 U 位的较大者。',
      position: '用于柜数计算与柜内 U 位校核。',
      impact: '增大 → 柜数增加。',
      source: '计算',
      editable: '间接',
      basis: 'max(installedU, frameU)。',
    },
    {
      symbol: 'usableU',
      name: '柜高可用 U',
      meaning: '所选柜高对应的可用 U 数。',
      position: '用于柜数计算与 U 位校核。',
      impact: '可用 U 越大，单柜装得越多。',
      source: '查表 / 常数',
      editable: '间接（改柜高）',
      basis: '常用 19in 机柜高度与可用 U 数；不同厂家有差异。',
    },
    {
      symbol: 'maxModulesPerCabinet',
      name: '单柜最大模块数',
      meaning: '单面柜允许安装的整流模块上限。',
      position: '用于柜数计算与模块槽位校核。',
      impact: '上限越小，所需柜数可能越多。',
      source: '输入（厂家数据）',
      editable: '是（专业模式；简易模式固定 24）',
      basis: '常见 2 m 柜厂家型谱。',
    },
    {
      symbol: 'cabinetCount',
      name: '柜数',
      meaning: '按 U 位与单柜模块上限计算的柜体数量。',
      position: '结论与校核。',
      impact: '最终结果之一。',
      source: '计算',
      editable: '间接',
      basis: 'max(1, ceil(requiredU/usableU), ceil(moduleSlots/maxModulesPerCabinet))。',
    },
    {
      symbol: 'breakerMargin',
      name: '断路器余量',
      meaning: '按计算电流选择断路器时预留的倍数。',
      position: '用于直流主断路器与交流输入断路器。',
      impact: '余量越大，所选壳架越大。',
      source: '输入（规范 / 项目）',
      editable: '是（专业模式；简易模式固定 1.25）',
      basis: '常用整定余量 1.25。',
    },
    {
      symbol: 'mainBreakerA',
      name: '直流主断路器',
      meaning: '直流输出侧主断路器的标准壳架电流。',
      position: '结论与直流断路器校核。',
      impact: '最终结果之一。',
      source: '查表 / 计算',
      editable: '间接',
      basis: 'nextStandardBreaker(I_design × breakerMargin)。',
    },
    {
      symbol: 'P_dc',
      name: '直流输出功率',
      meaning: '设计电流对应的直流输出功率。',
      position: '用于交流输入功率。',
      impact: '随设计电流与电压增大。',
      source: '计算',
      editable: '间接',
      basis: 'I_design × U_dc / 1000。',
    },
    {
      symbol: 'η_rect',
      name: '整流效率',
      meaning: '整流模块的转换效率。',
      position: '用于 P_ac = P_dc / η_rect。',
      impact: '效率越高，交流输入功率与电流越小。',
      source: '输入（厂家数据）',
      editable: '是（专业模式；简易模式固定 0.92）',
      basis: '高频开关整流模块样本。',
    },
    {
      symbol: 'P_ac',
      name: '交流输入功率',
      meaning: '计入整流效率后的交流侧输入功率。',
      position: '用于交流输入电流。',
      impact: '随 P_dc 增大、效率降低而增大。',
      source: '计算',
      editable: '间接',
      basis: 'P_dc / η_rect。',
    },
    {
      symbol: 'U_ac',
      name: '交流电压',
      meaning: '交流进线标称电压，三相 380 V 或单相 220 V。',
      position: '用于交流输入电流。',
      impact: '电压越高，同一功率下电流越小。',
      source: '输入',
      editable: '是（专业模式；简易模式固定三相 380 V）',
      basis: '机房常规进线。',
    },
    {
      symbol: 'PF',
      name: '交流功率因数',
      meaning: '整流模块交流侧的功率因数。',
      position: '用于交流输入电流。',
      impact: '功率因数越高，交流电流越小。',
      source: '输入（厂家数据）',
      editable: '是（专业模式；简易模式固定 0.99）',
      basis: '高频整流模块典型值。',
    },
    {
      symbol: 'I_ac',
      name: '交流输入电流',
      meaning: '按输入功率、电压、相数与功率因数折算的交流电流。',
      position: '用于交流输入断路器。',
      impact: '随 P_ac 增大、电压与 PF 降低而增大。',
      source: '计算',
      editable: '间接',
      basis: '三相 / 单相交流功率公式。',
    },
    {
      symbol: 'acBreakerA',
      name: '交流输入断路器',
      meaning: '交流进线断路器的标准壳架电流。',
      position: '结论与交流断路器校核。',
      impact: '最终结果之一。',
      source: '查表 / 计算',
      editable: '间接',
      basis: 'nextStandardBreaker(I_ac × breakerMargin)。',
    },
    {
      symbol: 'cabinetHeightMm',
      name: '拟用柜高',
      meaning: '拟选机柜高度，决定可用 U 数。',
      position: '用于 usableU 与柜数。',
      impact: '柜高越高，单柜可用 U 越多。',
      source: '输入',
      editable: '是（专业模式；简易模式固定 2000 mm）',
      basis: '机房净高与 GB/T 3047.1 尺寸系列。',
    },
    {
      symbol: 'cabinetWidthMm',
      name: '拟用柜宽',
      meaning: '拟选机柜宽度。',
      position: '柜体建议与布置校核。',
      impact: '只影响布置，不改变容量。',
      source: '输入',
      editable: '是（专业模式；简易模式固定 600 mm）',
      basis: 'GB/T 3047.1 与厂家型谱。',
    },
    {
      symbol: 'cabinetDepthMm',
      name: '拟用柜深',
      meaning: '拟选机柜深度。',
      position: '柜体建议与布置校核。',
      impact: '只影响布置，不改变容量。',
      source: '输入',
      editable: '是（专业模式；简易模式固定 600 mm）',
      basis: 'GB/T 3047.1 与厂家型谱。',
    },
  ]
}
