/**
 * 校核明细的展示层：把每条校核整理成“要求式 / 实际式 / 裕度 / 来源 / 为什么”。
 *
 * 计算仍由 batterySizing.ts 完成；这里只读取结果，不改变容量选型。
 */

import {
  formatNumber as fmt,
  makeSymbol,
  signed,
  whyText as baseWhyText,
  type CheckDetail,
} from '../shared/calcTrace'
import type { BatterySizingInput, BatterySizingResult } from './batterySizing'
import { buildBatterySteps, stepLabel, type CalcStep } from './calculationSteps'
import { describeAlpha, describeCapacityCoefficient } from './traceability'

export type { CheckDetail }

const WHY = { subject: '容量', failHint: '需要调整容量、并联组数或厂家选型。' }

function whyText(pass: boolean, controlling: boolean, margin: string, drivers: string[]): string {
  return baseWhyText(pass, controlling, margin, drivers, WHY)
}

function checkOf(result: BatterySizingResult, key: string) {
  return result.checks.find((check) => check.key === key)
}

export function buildBatteryCheckDetails(
  input: BatterySizingInput,
  result: BatterySizingResult,
): CheckDetail[] {
  const isLeadAcid = result.batteryType === 'lead-acid'
  const drivers = result.drivers
  const steps = buildBatterySteps(input, result)

  const linkOf = (key: string): { stepKey: string; stepLabel?: string } => {
    const step: CalcStep | undefined = steps.find((candidate) => candidate.key === key)
    return { stepKey: key, ...(step ? { stepLabel: stepLabel(step) } : {}) }
  }

  const details: CheckDetail[] = []

  if (isLeadAcid) {
    // ① 安时容量
    const capacityCheck = checkOf(result, 'capacity')
    const capacityDriven = drivers.includes('安时容量')
    const capacityMargin = `${signed(result.configuredAh - result.requiredAh, 1)} Ah`
    details.push({
      key: 'capacity',
      label: '安时容量',
      keyValue: `Q_cfg = ${fmt(result.configuredAh, 0)} Ah`,
      required: capacityCheck?.required ?? `Q_cfg ≥ ${fmt(result.requiredAh, 1)} Ah`,
      actual:
        capacityCheck?.actual ??
        `${fmt(result.configuredAh, 0)} Ah（${fmt(result.unitAh, 0)} Ah × ${result.parallelStrings} 组）`,
      pass: capacityCheck?.pass ?? result.configuredAh >= result.requiredAh,
      controlling: capacityDriven,
      margin: capacityMargin,
      formula: 'Q_cfg ≥ Q_req = K × I × T / (η_ah × Kt)',
      substitution: `${fmt(result.configuredAh, 0)} ≥ ${fmt(result.requiredAh, 1)} = ${fmt(Number(input.designMargin), 2)} × ${fmt(result.dischargeCurrentA, 2)} × ${fmt(result.backupHours, 3)} / (${fmt(result.capacityCoefficient, 2)} × ${fmt(result.temperatureFactor, 3)})`,
      symbols: [
        makeSymbol('所需容量', fmt(result.requiredAh, 1), 'calc', { symbol: 'Q_req', unit: 'Ah' }),
        makeSymbol('配置容量', fmt(result.configuredAh, 0), 'calc', {
          symbol: 'Q_cfg',
          unit: 'Ah',
        }),
        makeSymbol('设计余量', fmt(Number(input.designMargin), 2), 'input', {
          symbol: 'K',
          inputSymbol: 'K',
        }),
        makeSymbol('放电容量系数', fmt(result.capacityCoefficient, 2), 'input', {
          symbol: 'η_ah',
          inputSymbol: 'η_ah',
        }),
        makeSymbol('温度修正系数', fmt(result.temperatureFactor, 3), 'calc', { symbol: 'Kt' }),
      ],
      why: whyText(
        capacityCheck?.pass ?? result.configuredAh >= result.requiredAh,
        capacityDriven,
        capacityMargin,
        drivers,
      ),
      ...linkOf('capacity'),
    })

    // ② 并联组数
    const parallelCheck = checkOf(result, 'parallel')
    const maxParallel = Math.max(1, Math.round(Number(input.maxParallelStrings)))
    const parallelMargin = `${signed(maxParallel - result.parallelStrings, 0)} 组`
    details.push({
      key: 'parallel',
      label: '并联组数',
      keyValue: `${result.parallelStrings} 组`,
      required: parallelCheck?.required ?? `n ≤ ${maxParallel} 组`,
      actual: parallelCheck?.actual ?? `${result.parallelStrings} 组`,
      pass: parallelCheck?.pass ?? result.parallelStrings <= maxParallel,
      controlling: false,
      margin: parallelMargin,
      formula: `n ≤ ${maxParallel}`,
      substitution: `${result.parallelStrings} ≤ ${maxParallel}`,
      symbols: [
        makeSymbol('并联组数', String(result.parallelStrings), 'calc', {
          symbol: 'n',
          unit: '组',
        }),
        makeSymbol('最大并联组数', String(maxParallel), 'input', {
          symbol: 'n_max',
          unit: '组',
          inputSymbol: 'N_par',
        }),
      ],
      why:
        (parallelCheck?.pass ?? result.parallelStrings <= maxParallel)
          ? `满足。并联组数由 Q / Q_max 派生，不参与容量反推；但多组并联需同规格、同长度、同路径，并校验均流与保护配合。`
          : `不满足：并联 ${result.parallelStrings} 组超过限值 ${maxParallel} 组，需增大单只容量或调整方案。`,
      ...linkOf('strings'),
    })

    // ③ 终止电压
    const voltageCheck = checkOf(result, 'voltage')
    const dcMinVoltage = Math.max(0, Number(input.dcMinVoltage) || 0)
    const voltagePass = voltageCheck?.pass ?? true
    const voltageMargin =
      dcMinVoltage > 0
        ? `${signed(result.endVoltageActual - dcMinVoltage, 1)} V`
        : '—（未设置下限）'
    details.push({
      key: 'voltage',
      label: '终止电压',
      keyValue: `U_end = ${fmt(result.endVoltageActual, 0)} V`,
      required:
        voltageCheck?.required ??
        (dcMinVoltage > 0 ? `U_end ≥ ${fmt(dcMinVoltage, 0)} V` : '未设置最低直流输入'),
      actual:
        voltageCheck?.actual ??
        `${fmt(result.endVoltageActual, 0)} V（${fmt(result.endVoltagePerCellActual, 2)} V/单体 × ${result.seriesCells}）`,
      pass: voltagePass,
      controlling: false,
      margin: voltageMargin,
      formula: dcMinVoltage > 0 ? 'U_end ≥ U_min' : 'U_end 与 UPS 最低直流输入比较（未设置下限）',
      substitution: `U_end = ${result.seriesCells} × ${fmt(result.endVoltagePerCellActual, 2)} = ${fmt(result.endVoltageActual, 0)} V`,
      symbols: [
        makeSymbol('串联单体数', String(result.seriesCells), 'calc', { symbol: 'N_c', unit: '只' }),
        makeSymbol('单体终止电压', fmt(result.endVoltagePerCellActual, 2), 'input', {
          symbol: 'U_end,cell',
          unit: 'V',
          inputSymbol: 'U_end,cell',
        }),
        makeSymbol('电池组终止电压', fmt(result.endVoltageActual, 0), 'calc', {
          symbol: 'U_end',
          unit: 'V',
        }),
        makeSymbol('UPS 最低直流输入', fmt(dcMinVoltage, 0), 'input', {
          symbol: 'U_min',
          unit: 'V',
          inputSymbol: 'U_min',
          ...(dcMinVoltage > 0 ? {} : { sourceDetail: '0 = 暂不校核' }),
        }),
      ],
      why:
        dcMinVoltage > 0
          ? voltagePass
            ? `满足；终止电压高于 UPS 直流输入下限 ${fmt(result.endVoltageActual - dcMinVoltage, 1)} V，不会提前关机。`
            : `不满足；终止电压低于 UPS 直流输入下限 ${fmt(dcMinVoltage - result.endVoltageActual, 1)} V，UPS 会先于电池放电终止而关机。`
          : '未设置 UPS 最低直流输入，本条不参与判定；建议按 UPS 样本补齐。',
      ...linkOf('series'),
    })

    // ④ 恒功率
    const powerCheck = checkOf(result, 'power')
    const hasManufacturerW = result.manufacturerWPerCell > 0
    const powerMargin = hasManufacturerW
      ? `${signed(result.manufacturerWPerCell - result.requiredWPerCell, 1)} W/单体`
      : '—（未输入厂家值）'
    details.push({
      key: 'power',
      label: '恒功率',
      keyValue: `W_cell = ${fmt(result.requiredWPerCell, 1)} W/单体`,
      required: powerCheck?.required ?? `W_man ≥ ${fmt(result.requiredWPerCell, 1)} W/单体`,
      actual:
        powerCheck?.actual ??
        (hasManufacturerW
          ? `${fmt(result.manufacturerWPerCell, 1)} W/单体（厂家表）`
          : '未输入厂家 W/单体'),
      pass: powerCheck?.pass ?? result.powerCheckPass,
      controlling: false,
      margin: powerMargin,
      formula: 'W_man ≥ W_cell = P × 1000 × K / (N_c × η × η_line)',
      substitution: hasManufacturerW
        ? `${fmt(result.manufacturerWPerCell, 1)} ≥ ${fmt(result.requiredWPerCell, 1)} = ${fmt(result.loadPowerKw, 2)} × 1000 × ${fmt(Number(input.designMargin), 2)} / (${result.seriesCells} × ${fmt(Number(input.efficiency), 2)} × ${fmt(Number(input.lineEfficiency), 2)})`
        : `需求 ${fmt(result.requiredWPerCell, 1)} W/单体；未输入厂家值，不参与判定`,
      symbols: [
        makeSymbol('恒功率需求', fmt(result.requiredWPerCell, 1), 'calc', {
          symbol: 'W_cell',
          unit: 'W/单体',
        }),
        makeSymbol(
          '厂家 W/单体',
          hasManufacturerW ? fmt(result.manufacturerWPerCell, 1) : '未输入',
          hasManufacturerW ? 'input' : 'default',
          {
            symbol: 'W_man',
            unit: hasManufacturerW ? 'W/单体' : undefined,
            ...(hasManufacturerW ? { inputSymbol: 'W_man' } : {}),
          },
        ),
      ],
      why: hasManufacturerW
        ? whyText(result.powerCheckPass, false, powerMargin, drivers)
        : '仅安时法估算，恒功率需求用于对照厂家恒功率放电表；未输入厂家值时不参与判定。',
      ...linkOf('power'),
    })

    // ⑤ 容量系数 / 温度（把 α、Kt、η_ah 显式列出来）
    const capacity = describeCapacityCoefficient(result.backupHours, result.capacityCoefficient)
    const alpha = describeAlpha(result.backupHours)
    const factorMargin = `η_ah ${signed(capacity.deviation, 2)}；Kt − 1 = ${signed(result.temperatureFactor - 1, 3)}`
    details.push({
      key: 'factors',
      label: '容量系数 / 温度',
      keyValue: `η_ah = ${fmt(result.capacityCoefficient, 2)}，Kt = ${fmt(result.temperatureFactor, 3)}`,
      required: '按标准表 / 厂家放电曲线取值',
      actual: `η_ah = ${fmt(result.capacityCoefficient, 2)}（备电 ${fmt(result.backupHours, 1)} h 建议 ${fmt(capacity.suggested, 2)}）；Kt = ${fmt(result.temperatureFactor, 3)}`,
      pass: true,
      controlling: false,
      margin: factorMargin,
      formula: 'Kt = 1 + α × (t − 25)；η_ah = f(放电小时率)',
      substitution: `${alpha.expression}；${capacity.expression}`,
      symbols: [
        makeSymbol('温度系数', String(alpha.alpha), 'constant', {
          symbol: 'α',
          sourceDetail: 'GB 51194-2016 分段常数',
        }),
        makeSymbol('温度修正系数', fmt(result.temperatureFactor, 3), 'calc', { symbol: 'Kt' }),
        makeSymbol('放电容量系数', fmt(result.capacityCoefficient, 2), 'input', {
          symbol: 'η_ah',
          inputSymbol: 'η_ah',
          sourceDetail: `${capacity.table}：${fmt(capacity.suggested, 2)}`,
        }),
        makeSymbol('最低环境温度', fmt(Number(input.ambientTempC), 0), 'input', {
          symbol: 't',
          unit: '℃',
          inputSymbol: 't',
        }),
      ],
      why:
        capacity.deviationNote ??
        `η_ah 与典型表一致（偏差 ${signed(capacity.deviation, 2)}）；Kt 与 η_ah 均已参与 Q 计算，不是孤立变量。`,
      ...linkOf('factors'),
    })
  } else {
    // ① 能量容量
    const energyCheck = checkOf(result, 'energy')
    const energyDriven = drivers.includes('能量容量')
    const energyMargin = `${signed(result.configuredEnergyKwh - result.requiredEnergyKwh, 2)} kWh`
    details.push({
      key: 'energy',
      label: '能量容量',
      keyValue: `E_cfg = ${fmt(result.configuredEnergyKwh, 2)} kWh`,
      required: energyCheck?.required ?? `E_cfg ≥ ${fmt(result.requiredEnergyKwh, 2)} kWh`,
      actual: energyCheck?.actual ?? `${fmt(result.configuredEnergyKwh, 2)} kWh`,
      pass: energyCheck?.pass ?? result.configuredEnergyKwh >= result.requiredEnergyKwh,
      controlling: energyDriven,
      margin: energyMargin,
      formula: 'E_cfg ≥ E_req = P × T / (η × η_line) × K / (DOD × SOH × K_T)',
      substitution: `${fmt(result.configuredEnergyKwh, 2)} ≥ ${fmt(result.requiredEnergyKwh, 2)}`,
      symbols: [
        makeSymbol('降额后能量', fmt(result.requiredEnergyKwh, 2), 'calc', {
          symbol: 'E_req',
          unit: 'kWh',
        }),
        makeSymbol('配置能量', fmt(result.configuredEnergyKwh, 2), 'calc', {
          symbol: 'E_cfg',
          unit: 'kWh',
        }),
        makeSymbol('放电深度', fmt(Number(input.dod), 2), 'input', {
          symbol: 'DOD',
          inputSymbol: 'DOD',
        }),
        makeSymbol('寿命末期容量保持', fmt(Number(input.soh), 2), 'input', {
          symbol: 'SOH',
          inputSymbol: 'SOH',
        }),
        makeSymbol('温度降额', fmt(Number(input.tempDerating), 2), 'input', {
          symbol: 'K_T',
          inputSymbol: 'KT',
        }),
      ],
      why: whyText(
        energyCheck?.pass ?? result.configuredEnergyKwh >= result.requiredEnergyKwh,
        energyDriven,
        energyMargin,
        drivers,
      ),
      ...linkOf('energy'),
    })

    // ② 放电倍率
    const cRateCheck = checkOf(result, 'c-rate')
    const rateDriven = drivers.includes('放电倍率')
    const maxCRate = Number(input.maxCRate)
    const rateMargin = `${signed(maxCRate - result.cRate, 2)} C`
    details.push({
      key: 'c-rate',
      label: '放电倍率',
      keyValue: `C = ${fmt(result.cRate, 2)} C`,
      required: cRateCheck?.required ?? `C ≤ ${fmt(maxCRate, 2)} C`,
      actual: cRateCheck?.actual ?? `${fmt(result.cRate, 2)} C`,
      pass: cRateCheck?.pass ?? result.cRate <= maxCRate,
      controlling: rateDriven,
      margin: rateMargin,
      formula: `C = I / Q_cfg ≤ ${fmt(maxCRate, 2)} C`,
      substitution: `C = ${fmt(result.dischargeCurrentA, 2)} / ${fmt(result.unitAh, 0)} = ${fmt(result.cRate, 2)} C`,
      symbols: [
        makeSymbol('放电电流', fmt(result.dischargeCurrentA, 2), 'calc', {
          symbol: 'I',
          unit: 'A',
        }),
        makeSymbol('配置容量', fmt(result.unitAh, 0), 'calc', { symbol: 'Q_cfg', unit: 'Ah' }),
        makeSymbol('最大放电倍率', fmt(maxCRate, 2), 'input', {
          symbol: 'C_max',
          unit: 'C',
          inputSymbol: 'C_max',
        }),
      ],
      why: rateDriven
        ? `满足，且是控制项：倍率下限 Q_min,C = ${fmt(result.minAhByCRate, 1)} Ah 大于能量法容量 ${fmt(result.requiredAh, 1)} Ah，容量由倍率决定；余量 ${rateMargin}。`
        : whyText(result.cRate <= maxCRate, false, rateMargin, drivers),
      ...linkOf('capacity'),
    })

    // ③ 温度降额
    const temperatureCheck = checkOf(result, 'temperature')
    const tempDerating = Number(input.tempDerating)
    const tempMargin = `${signed(tempDerating - 0.8, 2)}`
    details.push({
      key: 'temperature',
      label: '温度降额',
      keyValue: `K_T = ${fmt(tempDerating, 2)}`,
      required: temperatureCheck?.required ?? 'K_T ≥ 0.80',
      actual:
        temperatureCheck?.actual ??
        `K_T=${fmt(tempDerating, 2)}，环境 ${fmt(Number(input.ambientTempC), 0)} ℃`,
      pass: temperatureCheck?.pass ?? tempDerating >= 0.8,
      controlling: false,
      margin: tempMargin,
      formula: 'K_T ≥ 0.80（低于此值需加热或降额）',
      substitution: `${fmt(tempDerating, 2)} ≥ 0.80`,
      symbols: [
        makeSymbol('温度降额', fmt(tempDerating, 2), 'input', {
          symbol: 'K_T',
          inputSymbol: 'KT',
        }),
        makeSymbol('最低环境温度', fmt(Number(input.ambientTempC), 0), 'input', {
          symbol: 't',
          unit: '℃',
          inputSymbol: 't',
        }),
      ],
      why:
        tempDerating >= 0.8
          ? `满足；K_T 已参与 E_req 计算。低温会降低可用容量，高温加速老化并增加热失控风险。`
          : '不满足：温度降额低于 0.80，需配置加热或按厂家低温放电曲线重新核算。',
      ...linkOf('energy'),
    })
  }

  return details
}
