/**
 * 校核明细的展示层：把引擎 result.checks 的 5 条校核整理成
 * “要求式 / 实际式 / 裕度 / 来源 / 为什么”。
 *
 * 计算仍由 hvacCooling.ts 完成；这里只读取结果，不改变冷负荷 / 机组选型。
 */

import {
  formatNumber as fmt,
  makeSymbol,
  signed,
  whyText as baseWhyText,
  type CheckDetail,
} from '../shared/calcTrace'
import { getRoomTypePreset, type HvacCoolingInput, type HvacCoolingResult } from './hvacCooling'
import { buildHvacSteps, stepLabel, type CalcStep } from './calculationSteps'

export type { CheckDetail }

const WHY = { subject: '容量', failHint: '需要调整单台容量、运行台数、冗余方式或负荷输入。' }

function whyText(pass: boolean, controlling: boolean, margin: string, drivers: string[]): string {
  return baseWhyText(pass, controlling, margin, drivers, WHY)
}

function checkOf(result: HvacCoolingResult, key: string) {
  return result.checks.find((check) => check.key === key)
}

export function buildHvacCheckDetails(
  input: HvacCoolingInput,
  result: HvacCoolingResult,
): CheckDetail[] {
  const drivers = result.drivers
  const steps = buildHvacSteps(input, result)

  const linkOf = (key: string): { stepKey: string; stepLabel?: string } => {
    const step: CalcStep | undefined = steps.find((candidate) => candidate.key === key)
    return { stepKey: key, ...(step ? { stepLabel: stepLabel(step) } : {}) }
  }

  const unitAuto = !(Number(input.unitCapacityKw) > 0)
  const runningAuto = !(Number(input.runningUnitCount) > 0)
  const detail: CheckDetail[] = []

  // ① 运行冷量：运行机组名义冷量 ≥ 所需冷量
  const capacityCheck = checkOf(result, 'capacity')
  const capacityControlling = drivers.includes('运行冷量')
  const capacityMargin = `${signed(result.runningCapacityKw - result.requiredCapacityKw, 1)} kW`
  detail.push({
    key: 'capacity',
    label: '运行冷量',
    keyValue: `${fmt(result.runningCapacityKw, 1)} kW（${result.runningCount} × ${fmt(result.unitCapacityKw, 1)}）`,
    required: capacityCheck?.required ?? `≥ ${fmt(result.requiredCapacityKw, 1)} kW`,
    actual:
      capacityCheck?.actual ??
      `${fmt(result.runningCapacityKw, 1)} kW（${result.runningCount} × ${fmt(result.unitCapacityKw, 1)} kW）`,
    pass: capacityCheck?.pass ?? result.runningCapacityKw >= result.requiredCapacityKw,
    controlling: capacityControlling,
    margin: capacityMargin,
    formula: 'Q_run = N_run × Q_unit ≥ Q_req',
    substitution: `${result.runningCount} × ${fmt(result.unitCapacityKw, 1)} = ${fmt(result.runningCapacityKw, 1)} kW ≥ ${fmt(result.requiredCapacityKw, 1)} kW`,
    symbols: [
      makeSymbol('所需冷量', fmt(result.requiredCapacityKw, 1), 'calc', {
        symbol: 'Q_req',
        unit: 'kW',
      }),
      makeSymbol('运行台数', String(result.runningCount), runningAuto ? 'calc' : 'input', {
        symbol: 'N_run',
        ...(runningAuto ? {} : { inputSymbol: 'N_run' }),
      }),
      makeSymbol('单台容量', fmt(result.unitCapacityKw, 1), unitAuto ? 'table' : 'input', {
        symbol: 'Q_unit',
        unit: 'kW',
        ...(unitAuto ? { sourceDetail: '常用单机容量档' } : { inputSymbol: 'Q_unit' }),
      }),
      makeSymbol('运行冷量', fmt(result.runningCapacityKw, 1), 'calc', {
        symbol: 'Q_run',
        unit: 'kW',
      }),
    ],
    why: whyText(
      capacityCheck?.pass ?? result.runningCapacityKw >= result.requiredCapacityKw,
      capacityControlling,
      capacityMargin,
      drivers,
    ),
    ...linkOf('units'),
  })

  // ② 显冷量：机组显冷量 ≥ 显热负荷
  const sensibleCheck = checkOf(result, 'sensible')
  const sensibleControlling = drivers.includes('显冷量')
  const sensibleMargin = `${signed(result.unitSensibleCapacityKw - result.sensibleLoadKw, 1)} kW`
  detail.push({
    key: 'sensible',
    label: '显冷量',
    keyValue: `${fmt(result.unitSensibleCapacityKw, 1)} kW（SHR ${fmt(result.unitSensibleRatio, 2)}）`,
    required: sensibleCheck?.required ?? `≥ ${fmt(result.sensibleLoadKw, 1)} kW`,
    actual:
      sensibleCheck?.actual ??
      `${fmt(result.unitSensibleCapacityKw, 1)} kW（SHR ${fmt(result.unitSensibleRatio, 2)}）`,
    pass: sensibleCheck?.pass ?? result.unitSensibleCapacityKw >= result.sensibleLoadKw,
    controlling: sensibleControlling,
    margin: sensibleMargin,
    formula: 'Q_sensible,unit = Q_run × SHR_unit ≥ Q_sensible',
    substitution: `${fmt(result.runningCapacityKw, 1)} × ${fmt(result.unitSensibleRatio, 2)} = ${fmt(result.unitSensibleCapacityKw, 1)} kW ≥ ${fmt(result.sensibleLoadKw, 1)} kW`,
    symbols: [
      makeSymbol('运行冷量', fmt(result.runningCapacityKw, 1), 'calc', {
        symbol: 'Q_run',
        unit: 'kW',
      }),
      makeSymbol('机组显热比', fmt(result.unitSensibleRatio, 2), 'input', {
        symbol: 'SHR_unit',
        inputSymbol: 'SHR_unit',
      }),
      makeSymbol('机组显冷量', fmt(result.unitSensibleCapacityKw, 1), 'calc', {
        symbol: 'Q_sensible,unit',
        unit: 'kW',
      }),
      makeSymbol('显热负荷', fmt(result.sensibleLoadKw, 1), 'calc', {
        symbol: 'Q_sensible',
        unit: 'kW',
      }),
    ],
    why: whyText(
      sensibleCheck?.pass ?? result.unitSensibleCapacityKw >= result.sensibleLoadKw,
      sensibleControlling,
      sensibleMargin,
      drivers,
    ),
    ...linkOf('sensible-check'),
  })

  // ③ 单台负载率：所需冷量 / 运行冷量 ≤ 90%
  const loadRateCheck = checkOf(result, 'load-rate')
  const loadRateControlling = drivers.includes('单台负载率')
  const loadRateMargin = `${signed((0.9 - result.unitLoadRate) * 100, 1)} pp`
  detail.push({
    key: 'load-rate',
    label: '单台负载率',
    keyValue: `${fmt(result.unitLoadRate * 100, 1)}%`,
    required: loadRateCheck?.required ?? '≤ 90%',
    actual: loadRateCheck?.actual ?? `${fmt(result.unitLoadRate * 100, 1)}%`,
    pass: loadRateCheck?.pass ?? result.unitLoadRate <= 0.9,
    controlling: loadRateControlling,
    margin: loadRateMargin,
    formula: 'η_load = Q_req / Q_run ≤ 90%',
    substitution: `${fmt(result.requiredCapacityKw, 1)} / ${fmt(result.runningCapacityKw, 1)} = ${fmt(result.unitLoadRate * 100, 1)}%`,
    symbols: [
      makeSymbol('所需冷量', fmt(result.requiredCapacityKw, 1), 'calc', {
        symbol: 'Q_req',
        unit: 'kW',
      }),
      makeSymbol('运行冷量', fmt(result.runningCapacityKw, 1), 'calc', {
        symbol: 'Q_run',
        unit: 'kW',
      }),
      makeSymbol('单台负载率', `${fmt(result.unitLoadRate * 100, 1)}%`, 'calc', {
        symbol: 'η_load',
      }),
    ],
    why: whyText(
      loadRateCheck?.pass ?? result.unitLoadRate <= 0.9,
      loadRateControlling,
      loadRateMargin,
      drivers,
    ),
    ...linkOf('load-rate'),
  })

  // ④ 设计余量：无备份时 ≥ 15%
  const marginCheck = checkOf(result, 'margin')
  const designMarginPct = Number(input.designMargin) * 100
  const marginPp = designMarginPct - 15
  const marginString = `${signed(marginPp, 0)} pp`
  const marginPass = marginCheck?.pass ?? true
  detail.push({
    key: 'margin',
    label: '设计余量',
    keyValue: `${fmt(designMarginPct, 0)}%`,
    required: marginCheck?.required ?? '≥ 15%',
    actual: marginCheck?.actual ?? `${fmt(designMarginPct, 0)}%`,
    pass: marginPass,
    controlling: false,
    margin: marginString,
    formula: input.redundancy === 'none' ? 'K_margin ≥ 15%（无备份）' : '有备用台数时可放宽',
    substitution:
      input.redundancy === 'none'
        ? `${fmt(designMarginPct, 0)}% ≥ 15%`
        : `${fmt(designMarginPct, 0)}%（${input.redundancy} 配置，已设 ${result.backupCount} 台备用）`,
    symbols: [
      makeSymbol('设计余量', `${fmt(designMarginPct, 0)}%`, 'input', {
        symbol: 'K_margin',
        inputSymbol: 'K_margin',
      }),
      makeSymbol('冗余方式', input.redundancy, 'input', {
        symbol: 'redundancy',
        inputSymbol: 'redundancy',
      }),
      makeSymbol('设计冷负荷', fmt(result.designLoadKw, 1), 'calc', {
        symbol: 'Q_design',
        unit: 'kW',
      }),
    ],
    why: marginPass
      ? input.redundancy === 'none'
        ? `满足；无备份时设计余量 ${fmt(designMarginPct, 0)}%，符合 GB 50174-2017 7.5.3 的 15%~20% 要求。`
        : `满足；当前为 ${input.redundancy} 配置、${result.backupCount} 台备用，GB 50174-2017 7.5.3 的 15%~20% 余量要求可放宽。`
      : `不满足；缺口 ${marginString}，无备份时设计余量应 ≥15%，请提高余量或采用 N+1。`,
    ...linkOf('design-load'),
  })

  // ⑤ 面积指标：实际值落在机房类型经验范围内
  const areaCheck = checkOf(result, 'area-index')
  const preset = getRoomTypePreset(input.roomType)
  const areaActual = result.areaIndexActualWPerM2
  const isCustom = input.roomType === 'custom'
  const lowerGap = areaActual - preset.areaIndexRange[0]
  const upperGap = preset.areaIndexRange[1] - areaActual
  const closestGap = Math.abs(lowerGap) <= Math.abs(upperGap) ? lowerGap : upperGap
  const areaMargin = isCustom ? '—（按实际负荷）' : `${signed(closestGap, 0)} W/m²`
  const areaPass = areaCheck?.pass ?? true
  detail.push({
    key: 'area-index',
    label: '面积指标',
    keyValue: `${fmt(areaActual, 0)} W/m²`,
    required: areaCheck?.required ?? `${preset.areaIndexRange[0]}~${preset.areaIndexRange[1]} W/m²`,
    actual: areaCheck?.actual ?? `${fmt(areaActual, 0)} W/m²`,
    pass: areaPass,
    controlling: false,
    margin: areaMargin,
    formula: 'q_A,actual = Q_total × 1000 / A',
    substitution: `${fmt(result.totalLoadKw, 1)} × 1000 / ${fmt(result.areaM2, 0)} = ${fmt(areaActual, 0)} W/m²`,
    symbols: [
      makeSymbol('总冷负荷', fmt(result.totalLoadKw, 1), 'calc', {
        symbol: 'Q_total',
        unit: 'kW',
      }),
      makeSymbol('机房面积', fmt(result.areaM2, 0), 'input', {
        symbol: 'A',
        unit: 'm²',
        inputSymbol: 'A',
      }),
      makeSymbol('实际面积指标', fmt(areaActual, 0), 'calc', {
        symbol: 'q_A,actual',
        unit: 'W/m²',
      }),
      makeSymbol('面积指标', fmt(Number(input.areaIndexWPerM2), 0), 'input', {
        symbol: 'q_A',
        unit: 'W/m²',
        inputSymbol: 'q_A',
      }),
    ],
    why: isCustom
      ? `按实际负荷校核；自定义机房不套用经验范围，当前 ${fmt(areaActual, 0)} W/m²。`
      : areaPass
        ? `满足；${fmt(areaActual, 0)} W/m² 在 ${preset.areaIndexRange[0]}~${preset.areaIndexRange[1]} W/m² 范围内。面积指标是经验值，不是 GB 强制值，施工图应逐项计算。`
        : `不满足；缺口 ${areaMargin}，当前 ${fmt(areaActual, 0)} W/m² 超出 ${preset.areaIndexRange[0]}~${preset.areaIndexRange[1]} W/m²，请复核设备功率或面积，或改用详细法。`,
    ...linkOf('load-rate'),
  })

  return detail
}
