/**
 * 校核明细的展示层：把每条校核整理成“要求式 / 实际式 / 裕度 / 来源 / 为什么”。
 *
 * 计算仍由 dcPowerCabinet.ts 完成；这里只读取结果，不改变容量 / 模块 / 柜体选型。
 * 除引擎 result.checks 的 7 条外，另补“模块降额”“均充电流”两行，避免
 * derating、k_charge 变成孤儿参数。
 */

import {
  formatNumber as fmt,
  makeSymbol,
  signed,
  whyText as baseWhyText,
  type CheckDetail,
} from '../shared/calcTrace'
import type { DcCabinetInput, DcCabinetResult } from './dcPowerCabinet'
import { buildDcCabinetSteps, stepLabel, type CalcStep } from './calculationSteps'

export type { CheckDetail }

const WHY = { subject: '容量', failHint: '需要调整负荷、模块规格、冗余方式或柜体配置。' }

function whyText(pass: boolean, controlling: boolean, margin: string, drivers: string[]): string {
  return baseWhyText(pass, controlling, margin, drivers, WHY)
}

function checkOf(result: DcCabinetResult, key: string) {
  return result.checks.find((check) => check.key === key)
}

export function buildDcCabinetCheckDetails(
  input: DcCabinetInput,
  result: DcCabinetResult,
): CheckDetail[] {
  const drivers = result.drivers
  const steps = buildDcCabinetSteps(input, result)

  const linkOf = (key: string): { stepKey: string; stepLabel?: string } => {
    const step: CalcStep | undefined = steps.find((candidate) => candidate.key === key)
    return { stepKey: key, ...(step ? { stepLabel: stepLabel(step) } : {}) }
  }

  const moduleCurrent = Number(input.moduleCurrentA)
  const derating = Number(input.moduleDerating)
  const chargeRate = Number(input.chargeRate)
  const detail: CheckDetail[] = []

  // ① 整流容量：安装的降额后容量 ≥ 近期设计电流
  const capacityCheck = checkOf(result, 'capacity')
  const capacityControlling = drivers.includes('整流容量')
  const capacityMargin = `${signed(result.installedEffectiveA - result.designCurrentA, 1)} A`
  detail.push({
    key: 'capacity',
    label: '整流容量',
    keyValue: `安装 ${fmt(result.installedNameplateA, 0)} A 标称`,
    required: capacityCheck?.required ?? `≥ ${fmt(result.designCurrentA, 1)} A（近期负荷 + 均充）`,
    actual:
      capacityCheck?.actual ??
      `${fmt(result.installedEffectiveA, 1)} A（降额后）/ ${fmt(result.installedNameplateA, 0)} A 标称`,
    pass: capacityCheck?.pass ?? result.installedEffectiveA >= result.designCurrentA,
    controlling: capacityControlling,
    margin: capacityMargin,
    formula: 'totalModules × I_module × derating ≥ I_design',
    substitution: `${result.totalModules} × ${fmt(moduleCurrent, 0)} × ${fmt(derating, 2)} = ${fmt(result.installedEffectiveA, 1)} A ≥ ${fmt(result.designCurrentA, 1)} A`,
    symbols: [
      makeSymbol('设计电流', fmt(result.designCurrentA, 1), 'calc', {
        symbol: 'I_design',
        unit: 'A',
      }),
      makeSymbol('单模块额定电流', fmt(moduleCurrent, 0), 'input', {
        symbol: 'I_module',
        unit: 'A',
        inputSymbol: 'I_module',
      }),
      makeSymbol('模块降额系数', fmt(derating, 2), 'input', {
        symbol: 'derating',
        inputSymbol: 'derating',
      }),
      makeSymbol('总模块数', String(result.totalModules), 'calc', { symbol: 'totalModules' }),
      makeSymbol('安装有效容量', fmt(result.installedEffectiveA, 1), 'calc', {
        symbol: 'installedEffectiveA',
        unit: 'A',
      }),
    ],
    why: whyText(
      capacityCheck?.pass ?? result.installedEffectiveA >= result.designCurrentA,
      capacityControlling,
      capacityMargin,
      drivers,
    ),
    ...linkOf('modules'),
  })

  // ② 冗余配置：备用模块数量
  const redundancyCheck = checkOf(result, 'redundancy')
  detail.push({
    key: 'redundancy',
    label: '冗余配置',
    keyValue: `${result.mainModules} + ${result.redundantModules} = ${result.totalModules} 个`,
    required:
      redundancyCheck?.required ?? `${input.redundancy}（${result.redundantModules} 个备用模块）`,
    actual:
      redundancyCheck?.actual ??
      `${result.mainModules} 主用 + ${result.redundantModules} 备用 = ${result.totalModules} 个`,
    pass:
      redundancyCheck?.pass ?? result.totalModules - result.mainModules >= result.redundantModules,
    controlling: drivers.includes('冗余配置'),
    margin: `${result.redundantModules} 个备用模块`,
    formula: 'totalModules − mainModules ≥ redundantModules',
    substitution: `${result.totalModules} − ${result.mainModules} = ${result.totalModules - result.mainModules} ≥ ${result.redundantModules}`,
    symbols: [
      makeSymbol('冗余方式', input.redundancy, 'input', {
        symbol: 'redundancy',
        inputSymbol: 'redundancy',
      }),
      makeSymbol('主用模块数', String(result.mainModules), 'calc', { symbol: 'mainModules' }),
      makeSymbol('备用模块数', String(result.redundantModules), 'calc', {
        symbol: 'redundantModules',
      }),
      makeSymbol('总模块数', String(result.totalModules), 'calc', { symbol: 'totalModules' }),
    ],
    why:
      (redundancyCheck?.pass ?? true)
        ? `满足；${result.mainModules} 主用 + ${result.redundantModules} 备用 = ${result.totalModules}，备用模块同样参与降额后的容量校核。`
        : `不满足；按 ${input.redundancy} 需要 ${result.redundantModules} 个备用模块，当前配置不足。`,
    ...linkOf('modules'),
  })

  // ③ 满架容量：满架降额后容量 ≥ 远期电流
  const frameCheck = checkOf(result, 'frame')
  const frameControlling = drivers.includes('满架容量')
  const frameMargin = `${signed(result.frameCapacityA - result.frameCurrentA, 1)} A`
  detail.push({
    key: 'frame',
    label: '满架容量',
    keyValue: `满架 ${result.frameModules} 个 / ${fmt(result.frameCapacityA, 1)} A`,
    required: frameCheck?.required ?? `≥ ${fmt(result.frameCurrentA, 1)} A（远期）`,
    actual:
      frameCheck?.actual ??
      `${fmt(result.frameCapacityA, 1)} A（${result.frameModules} 个模块槽位）`,
    pass: frameCheck?.pass ?? result.frameCapacityA >= result.frameCurrentA,
    controlling: frameControlling,
    margin: frameMargin,
    formula: 'frameModules × I_module × derating ≥ I_frame',
    substitution: `${result.frameModules} × ${fmt(moduleCurrent, 0)} × ${fmt(derating, 2)} = ${fmt(result.frameCapacityA, 1)} A ≥ ${fmt(result.frameCurrentA, 1)} A`,
    symbols: [
      makeSymbol('远期电流', fmt(result.frameCurrentA, 1), 'calc', {
        symbol: 'I_frame',
        unit: 'A',
      }),
      makeSymbol('满架模块数', String(result.frameModules), 'calc', { symbol: 'frameModules' }),
      makeSymbol('满架容量', fmt(result.frameCapacityA, 1), 'calc', {
        symbol: 'frameCapacityA',
        unit: 'A',
      }),
    ],
    why: whyText(
      frameCheck?.pass ?? result.frameCapacityA >= result.frameCurrentA,
      frameControlling,
      frameMargin,
      drivers,
    ),
    ...linkOf('frame'),
  })

  // ④ 模块槽位：远期槽位不超过单柜上限 × 柜数
  const slotCheck = checkOf(result, 'module-slots')
  const slotControlling = drivers.includes('模块槽位')
  const slotMargin = `${signed(Number(input.maxModulesPerCabinet) * result.cabinetCount - result.moduleSlots, 0)} 个`
  detail.push({
    key: 'module-slots',
    label: '模块槽位',
    keyValue: `${result.moduleSlots} 个槽位`,
    required:
      slotCheck?.required ?? `≤ ${input.maxModulesPerCabinet} 个/柜 × ${result.cabinetCount} 柜`,
    actual: slotCheck?.actual ?? `${result.moduleSlots} 个槽位`,
    pass:
      slotCheck?.pass ??
      result.moduleSlots <= Number(input.maxModulesPerCabinet) * result.cabinetCount,
    controlling: slotControlling,
    margin: slotMargin,
    formula: 'max(totalModules, frameModules) ≤ maxModulesPerCabinet × cabinetCount',
    substitution: `${result.moduleSlots} ≤ ${fmt(Number(input.maxModulesPerCabinet), 0)} × ${result.cabinetCount} = ${fmt(Number(input.maxModulesPerCabinet) * result.cabinetCount, 0)}`,
    symbols: [
      makeSymbol('满架模块数', String(result.frameModules), 'calc', { symbol: 'frameModules' }),
      makeSymbol('单柜最大模块数', fmt(Number(input.maxModulesPerCabinet), 0), 'input', {
        symbol: 'maxModulesPerCabinet',
        unit: '个',
        inputSymbol: 'maxModulesPerCabinet',
      }),
      makeSymbol('柜数', String(result.cabinetCount), 'calc', {
        symbol: 'cabinetCount',
        unit: '面',
      }),
    ],
    why: whyText(slotCheck?.pass ?? true, slotControlling, slotMargin, drivers),
    ...linkOf('cabinet'),
  })

  // ⑤ 柜内 U 位：所需 U 位不超过可用 U 位 × 柜数
  const uCheck = checkOf(result, 'u-height')
  const uControlling = drivers.includes('柜内 U 位')
  const uMargin = `${signed(result.usableU * result.cabinetCount - result.requiredU, 0)} U`
  detail.push({
    key: 'u-height',
    label: '柜内 U 位',
    keyValue: `占用 ${fmt(result.requiredU, 0)}U`,
    required: uCheck?.required ?? `≤ ${result.usableU}U × ${result.cabinetCount} 柜`,
    actual: uCheck?.actual ?? `占用 ${fmt(result.requiredU, 0)}U（模块 + 监控/配电/备用）`,
    pass: uCheck?.pass ?? result.requiredU <= result.usableU * result.cabinetCount + 1e-6,
    controlling: uControlling,
    margin: uMargin,
    formula: 'requiredU ≤ usableU × cabinetCount',
    substitution: `${fmt(result.requiredU, 0)}U ≤ ${result.usableU}U × ${result.cabinetCount} = ${result.usableU * result.cabinetCount}U`,
    symbols: [
      makeSymbol('所需 U 位', fmt(result.requiredU, 0), 'calc', {
        symbol: 'requiredU',
        unit: 'U',
      }),
      makeSymbol('柜高可用 U', String(result.usableU), 'table', {
        symbol: 'usableU',
        unit: 'U',
        sourceDetail: `${fmt(result.selectedHeightMm, 0)} mm 柜`,
      }),
      makeSymbol('柜数', String(result.cabinetCount), 'calc', {
        symbol: 'cabinetCount',
        unit: '面',
      }),
    ],
    why: whyText(uCheck?.pass ?? true, uControlling, uMargin, drivers),
    ...linkOf('cabinet'),
  })

  // ⑥ 直流主断路器
  const dcCheck = checkOf(result, 'dc-breaker')
  const dcMargin = `${signed(result.mainBreakerA - result.designCurrentA, 1)} A（相对近期电流）`
  detail.push({
    key: 'dc-breaker',
    label: '直流主断路器',
    keyValue: `${result.mainBreakerA} A`,
    required:
      dcCheck?.required ??
      `≥ ${fmt(result.designCurrentA * Number(input.breakerMargin), 1)} A（1.25 倍）`,
    actual: dcCheck?.actual ?? `${fmt(result.mainBreakerA, 0)} A 标准壳架`,
    pass: dcCheck?.pass ?? result.mainBreakerA >= result.designCurrentA,
    controlling: false,
    margin: dcMargin,
    formula: 'mainBreakerA = nextStandardBreaker(I_design × breakerMargin)',
    substitution: `${result.mainBreakerA} = nextStandardBreaker(${fmt(result.designCurrentA, 1)} × ${fmt(Number(input.breakerMargin), 2)} = ${fmt(result.designCurrentA * Number(input.breakerMargin), 1)})`,
    symbols: [
      makeSymbol('设计电流', fmt(result.designCurrentA, 1), 'calc', {
        symbol: 'I_design',
        unit: 'A',
      }),
      makeSymbol('断路器余量', fmt(Number(input.breakerMargin), 2), 'input', {
        symbol: 'breakerMargin',
        inputSymbol: 'breakerMargin',
      }),
      makeSymbol('直流主断路器', String(result.mainBreakerA), 'table', {
        symbol: 'mainBreakerA',
        unit: 'A',
        sourceDetail: '标准壳架',
      }),
    ],
    why:
      (dcCheck?.pass ?? true)
        ? `满足；按 ${fmt(Number(input.breakerMargin), 2)} 倍余量 ${fmt(result.designCurrentA * Number(input.breakerMargin), 1)} A 向上取标准壳架 ${result.mainBreakerA} A，正式设计还需与上级保护做选择性校验。`
        : `不满足；${result.mainBreakerA} A 小于近期设计电流 ${fmt(result.designCurrentA, 1)} A，需要重新选壳架。`,
    ...linkOf('breakers'),
  })

  // ⑦ 交流输入断路器
  const acCheck = checkOf(result, 'ac-breaker')
  const acMargin = `${signed(result.acBreakerA - result.acInputCurrentA, 1)} A（相对交流电流）`
  detail.push({
    key: 'ac-breaker',
    label: '交流输入断路器',
    keyValue: `${result.acBreakerA} A`,
    required:
      acCheck?.required ??
      `≥ ${fmt(result.acInputCurrentA * Number(input.breakerMargin), 1)} A（1.25 倍）`,
    actual: acCheck?.actual ?? `${fmt(result.acBreakerA, 0)} A 标准壳架`,
    pass: acCheck?.pass ?? result.acBreakerA >= result.acInputCurrentA,
    controlling: false,
    margin: acMargin,
    formula: 'acBreakerA = nextStandardBreaker(I_ac × breakerMargin)',
    substitution: `${result.acBreakerA} = nextStandardBreaker(${fmt(result.acInputCurrentA, 2)} × ${fmt(Number(input.breakerMargin), 2)} = ${fmt(result.acInputCurrentA * Number(input.breakerMargin), 1)})`,
    symbols: [
      makeSymbol('交流输入电流', fmt(result.acInputCurrentA, 2), 'calc', {
        symbol: 'I_ac',
        unit: 'A',
      }),
      makeSymbol('断路器余量', fmt(Number(input.breakerMargin), 2), 'input', {
        symbol: 'breakerMargin',
        inputSymbol: 'breakerMargin',
      }),
      makeSymbol('交流输入断路器', String(result.acBreakerA), 'table', {
        symbol: 'acBreakerA',
        unit: 'A',
        sourceDetail: '标准壳架',
      }),
    ],
    why:
      (acCheck?.pass ?? true)
        ? `满足；按 ${fmt(Number(input.breakerMargin), 2)} 倍余量 ${fmt(result.acInputCurrentA * Number(input.breakerMargin), 1)} A 向上取标准壳架 ${result.acBreakerA} A；交流电流按效率、功率因数与相数估算。`
        : `不满足；${result.acBreakerA} A 小于交流输入电流 ${fmt(result.acInputCurrentA, 2)} A，需要重新选壳架。`,
    ...linkOf('breakers'),
  })

  // ⑧ 模块降额（补一行，避免 derating 成为孤儿参数）
  const deratingPass = derating >= 0.9
  const effective = result.moduleEffectiveA
  detail.push({
    key: 'derating',
    label: '模块降额',
    keyValue: `I_module,eff = ${fmt(effective, 1)} A`,
    required: 'derating ≥ 0.90（高温 / 高海拔按厂家曲线）',
    actual: `derating = ${fmt(derating, 2)}；I_module,eff = ${fmt(moduleCurrent, 0)} × ${fmt(derating, 2)} = ${fmt(effective, 1)} A`,
    pass: deratingPass,
    controlling: false,
    margin: `${signed(derating - 0.9, 2)}（相对 0.90）`,
    formula: 'I_module,eff = I_module × derating',
    substitution: `${fmt(moduleCurrent, 0)} × ${fmt(derating, 2)} = ${fmt(effective, 1)} A`,
    symbols: [
      makeSymbol('单模块额定电流', fmt(moduleCurrent, 0), 'input', {
        symbol: 'I_module',
        unit: 'A',
        inputSymbol: 'I_module',
      }),
      makeSymbol('模块降额系数', fmt(derating, 2), 'input', {
        symbol: 'derating',
        inputSymbol: 'derating',
      }),
      makeSymbol('模块有效电流', fmt(effective, 1), 'calc', {
        symbol: 'I_module,eff',
        unit: 'A',
      }),
    ],
    why: deratingPass
      ? `满足；${fmt(moduleCurrent, 0)} × ${fmt(derating, 2)} = ${fmt(effective, 1)} A 已参与模块数量计算，不是孤立系数。`
      : `不满足；降额系数 ${fmt(derating, 2)} 低于常见值 0.90，应按厂家高低温 / 高海拔曲线复核，必要时增加模块。`,
    ...linkOf('modules'),
  })

  // ⑨ 均充电流（补一行，避免 k_charge 成为孤儿参数）
  const chargePass = chargeRate <= 0.15
  detail.push({
    key: 'charge',
    label: '均充电流',
    keyValue: `I_charge = ${fmt(result.chargeCurrentA, 1)} A`,
    required: 'k_charge ≤ 0.15C10（常用 0.1C10）',
    actual: `k_charge = ${fmt(chargeRate, 2)}C10；I_charge = ${fmt(Number(input.batteryAh), 0)} × ${fmt(chargeRate, 2)} = ${fmt(result.chargeCurrentA, 1)} A`,
    pass: chargePass,
    controlling: false,
    margin: `${signed(0.15 - chargeRate, 2)} C`,
    formula: 'I_charge = C10 × k_charge',
    substitution: `${fmt(Number(input.batteryAh), 0)} × ${fmt(chargeRate, 2)} = ${fmt(result.chargeCurrentA, 1)} A`,
    symbols: [
      makeSymbol('电池额定容量', fmt(Number(input.batteryAh), 0), 'input', {
        symbol: 'C10',
        unit: 'Ah',
        inputSymbol: 'C10',
      }),
      makeSymbol('均充倍率', `${fmt(chargeRate, 2)}C10`, 'input', {
        symbol: 'k_charge',
        inputSymbol: 'k_charge',
        sourceDetail: 'GB 51194 常用 0.1C10',
      }),
      makeSymbol('均充电流', fmt(result.chargeCurrentA, 1), 'calc', {
        symbol: 'I_charge',
        unit: 'A',
      }),
    ],
    why: chargePass
      ? `满足；均充电流 ${fmt(result.chargeCurrentA, 1)} A 已计入近期设计电流，参与模块数量与断路器计算。`
      : `不满足；均充倍率 ${fmt(chargeRate, 2)}C 高于常用 0.15C10，请核对电池厂家均充电流与充电机限流值。`,
    ...linkOf('charge'),
  })

  return detail
}
