/**
 * 蓄电池容量计算的“计算书”数据：把引擎结果拆成可读、可追溯的推导步骤。
 *
 * 这里只做展示层的组装，不参与容量计算；所有数值都取自 BatterySizingResult，
 * 查表 / 插值 / 限幅细节由 traceability.ts 从同一份表数据生成。
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
import { MAX_UNIT_AH, type BatterySizingInput, type BatterySizingResult } from './batterySizing'
import {
  describeAlpha,
  describeCapacityCoefficient,
  describeEndVoltage,
  describeStandardAh,
  describeTemperatureFactor,
} from './traceability'

export type { CalcSymbol, CalcStep, ParameterDoc, SymbolSource }

const fmt = (value: number, digits = 1) => formatNumber(value, digits)

/** 计算书步骤的显示名，如 "⑤ 所需容量"。 */
export const stepLabel = stepLabelOf

/** 计算书选项：简易模式下部分符号的来源与注释不同。 */
export interface BatteryStepOptions {
  simple?: boolean
}

export function buildBatterySteps(
  input: BatterySizingInput,
  result: BatterySizingResult,
  options: BatteryStepOptions = {},
): CalcStep[] {
  const isSimple = options.simple === true
  const isLeadAcid = input.batteryType === 'lead-acid'
  const isUps = input.loadMode === 'ups'
  const p = result.loadPowerKw
  const i = result.dischargeCurrentA
  const u = result.dcVoltageActual
  const eta = Number(input.efficiency)
  const etaLine = Number(input.lineEfficiency)
  const k = Number(input.designMargin)
  const hours = result.backupHours
  const steps: CalcStep[] = []

  // ① 负荷功率
  steps.push({
    key: 'load',
    index: 1,
    title: '负荷功率',
    keyValue: `P = ${fmt(p, 2)} kW`,
    formula: isUps ? 'P = S × K_load × cosφ' : 'P = 输入负荷功率',
    substitution: isUps
      ? `= ${fmt(Number(input.upsKva), 1)} × ${fmt(Number(input.loadRate), 2)} × ${fmt(Number(input.powerFactor), 2)} = ${fmt(p, 2)} kW`
      : `= ${fmt(p, 2)} kW（按已知有功功率输入）`,
    result: `P = ${fmt(p, 2)} kW`,
    symbols: [
      ...(isUps
        ? [
            symbol('UPS 额定容量', fmt(Number(input.upsKva), 1), 'input', {
              symbol: 'S',
              unit: 'kVA',
              inputSymbol: 'S',
            }),
            symbol('负载率', fmt(Number(input.loadRate), 2), 'input', {
              symbol: 'K_load',
              inputSymbol: 'K_load',
            }),
            symbol('输出功率因数', fmt(Number(input.powerFactor), 2), 'input', {
              symbol: 'cosφ',
              inputSymbol: 'cosφ',
            }),
          ]
        : []),
      symbol('负荷功率', fmt(p, 2), isUps ? 'calc' : 'input', {
        symbol: 'P',
        unit: 'kW',
        ...(isUps ? {} : { inputSymbol: 'P' }),
      }),
    ],
    note: isUps
      ? '按 UPS 铭牌视在功率折算有功负荷（不考虑 UPS 效率，效率在放电电流里扣除）。'
      : undefined,
  })

  // ② 放电电流
  steps.push({
    key: 'current',
    index: 2,
    title: '放电电流',
    keyValue: `I = ${fmt(i, 1)} A`,
    formula: 'I = P × 1000 / (U × η × η_line)',
    substitution: `= ${fmt(p, 2)} × 1000 / (${fmt(u, 0)} × ${fmt(eta, 2)} × ${fmt(etaLine, 2)}) = ${fmt(i, 2)} A`,
    result: `I = ${fmt(i, 2)} A`,
    symbols: [
      symbol('负荷功率', fmt(p, 2), isUps ? 'calc' : 'input', {
        symbol: 'P',
        unit: 'kW',
        ...(isUps ? {} : { inputSymbol: 'P' }),
      }),
      symbol(isLeadAcid ? '串联后直流电压' : '直流电压', fmt(u, 0), isLeadAcid ? 'calc' : 'input', {
        symbol: 'U',
        unit: 'V',
        ...(isLeadAcid
          ? { sourceDetail: `${result.seriesUnits} × ${input.cellVoltage} V = ${fmt(u, 0)} V` }
          : { inputSymbol: 'U' }),
      }),
      symbol('逆变效率', fmt(eta, 2), 'input', { symbol: 'η', inputSymbol: 'η' }),
      symbol('线路效率', fmt(etaLine, 2), 'input', { symbol: 'η_line', inputSymbol: 'η_line' }),
      symbol('放电电流', fmt(i, 2), 'calc', { symbol: 'I', unit: 'A' }),
    ],
    note: isLeadAcid
      ? 'U 取串联后的实际直流电压，而不是输入的标称电压。'
      : '锂电不做串联换算，U 直接取输入的直流母线电压。',
  })

  if (isLeadAcid) {
    const endVoltage = describeEndVoltage(
      Number(input.endVoltagePerCell),
      result.seriesCells,
      result.endVoltagePerCellActual,
    )
    const cellsPerUnit = input.cellVoltage === 12 ? 6 : 1

    // ③ 串联单元 / 单体 / 终止电压
    steps.push({
      key: 'series',
      index: 3,
      title: '串联单元与终止电压',
      keyValue: `N_c = ${result.seriesCells} 只单体`,
      formula: `N_s = max(1, round(U / U_cell))\nN_c = N_s × ${cellsPerUnit}（${input.cellVoltage} V 单元）\nU_end = N_c × U_end,cell`,
      substitution: `N_s = round(${fmt(u, 0)} / ${input.cellVoltage}) = ${result.seriesUnits}；N_c = ${result.seriesUnits} × ${cellsPerUnit} = ${result.seriesCells}；U_end = ${result.seriesCells} × ${fmt(result.endVoltagePerCellActual, 2)} = ${fmt(result.endVoltageActual, 0)} V`,
      result: `U_dc = ${fmt(result.dcVoltageActual, 0)} V；U_end = ${fmt(result.endVoltageActual, 0)} V`,
      symbols: [
        symbol('标称直流电压', fmt(Number(input.dcVoltage), 0), 'input', {
          symbol: 'U',
          unit: 'V',
          inputSymbol: 'U',
        }),
        symbol('单体规格', `${input.cellVoltage} V`, 'input', {
          symbol: 'U_cell',
          inputSymbol: 'cellVoltage',
        }),
        symbol('串联单元数', String(result.seriesUnits), 'calc', { symbol: 'N_s', unit: '只' }),
        symbol('串联单体数', String(result.seriesCells), 'calc', { symbol: 'N_c', unit: '只' }),
        symbol('单体终止电压', fmt(result.endVoltagePerCellActual, 2), 'input', {
          symbol: 'U_end,cell',
          unit: 'V',
          inputSymbol: 'U_end,cell',
          ...(endVoltage.clamped ? { sourceDetail: '已按 1.5~1.9 V 限幅' } : {}),
        }),
        symbol('电池组终止电压', fmt(result.endVoltageActual, 0), 'calc', {
          symbol: 'U_end',
          unit: 'V',
        }),
      ],
      note: endVoltage.clamped
        ? `输入 ${fmt(endVoltage.requested, 2)} V/单体超出 1.50~1.90 V 范围，已限幅为 ${fmt(endVoltage.applied, 2)} V/单体计算。`
        : undefined,
    })

    const capacity = describeCapacityCoefficient(hours, result.capacityCoefficient)
    const alpha = describeAlpha(hours)
    const temperature = describeTemperatureFactor(alpha.alpha, Number(input.ambientTempC))

    // ④ 容量系数 / α / 温度
    steps.push({
      key: 'factors',
      index: 4,
      title: '容量系数与温度修正',
      keyValue: `η_ah = ${fmt(result.capacityCoefficient, 2)}，Kt = ${fmt(result.temperatureFactor, 3)}`,
      formula:
        'α = f(放电小时率)\nKt = 1 + α × (t − 25)\nη_ah = 查表 / 厂家曲线（10 h 额定 = 1.0）',
      substitution: `${alpha.expression}；${temperature.expression}；${capacity.expression}`,
      result: `α = ${alpha.alpha}，Kt = ${fmt(result.temperatureFactor, 3)}，η_ah = ${fmt(result.capacityCoefficient, 2)}`,
      symbols: [
        symbol('最低环境温度', fmt(Number(input.ambientTempC), 0), 'input', {
          symbol: 't',
          unit: '℃',
          inputSymbol: 't',
        }),
        symbol('温度系数', String(alpha.alpha), 'constant', {
          symbol: 'α',
          sourceDetail: 'GB 51194-2016：≥10 h 取 0.006，1~10 h 取 0.008，<1 h 取 0.01',
        }),
        symbol('温度修正系数', fmt(result.temperatureFactor, 3), 'calc', { symbol: 'Kt' }),
        symbol('放电容量系数', fmt(result.capacityCoefficient, 2), isSimple ? 'table' : 'input', {
          symbol: 'η_ah',
          ...(isSimple ? {} : { inputSymbol: 'η_ah' }),
          sourceDetail: isSimple
            ? `${capacity.table}：T=${fmt(hours, 1)} h → ${fmt(capacity.suggested, 2)}（简易模式自动取值）`
            : `${capacity.table}：备电 ${fmt(hours, 1)} h → ${fmt(capacity.suggested, 2)}`,
        }),
      ],
      note: isSimple
        ? `简易模式按备电时长自动取 η_ah = ${fmt(result.capacityCoefficient, 2)}；需要按厂家放电曲线取值时请切「专业」模式手动输入。`
        : (capacity.deviationNote ??
          `η_ah 与典型值 ${fmt(capacity.suggested, 2)} 一致（偏差在 ±0.02 内）。`),
    })

    // ⑤ 所需容量
    steps.push({
      key: 'capacity',
      index: 5,
      title: '所需容量（安时法）',
      keyValue: `Q = ${fmt(result.requiredAh, 1)} Ah`,
      formula: 'Q = K × I × T / (η_ah × Kt)',
      substitution: `= ${fmt(k, 2)} × ${fmt(i, 2)} × ${fmt(hours, 3)} / (${fmt(result.capacityCoefficient, 2)} × ${fmt(result.temperatureFactor, 3)}) = ${fmt(result.requiredAh, 1)} Ah`,
      result: `Q = ${fmt(result.requiredAh, 1)} Ah`,
      symbols: [
        symbol('设计余量', fmt(k, 2), 'input', { symbol: 'K', inputSymbol: 'K' }),
        symbol('放电电流', fmt(i, 2), 'calc', { symbol: 'I', unit: 'A' }),
        symbol('备电时长', fmt(hours, 3), 'input', {
          symbol: 'T',
          unit: 'h',
          inputSymbol: 'T',
          sourceDetail: `${fmt(result.backupMinutes, 0)} min ÷ 60`,
        }),
        symbol('放电容量系数', fmt(result.capacityCoefficient, 2), 'input', {
          symbol: 'η_ah',
          inputSymbol: 'η_ah',
        }),
        symbol('温度修正系数', fmt(result.temperatureFactor, 3), 'calc', { symbol: 'Kt' }),
        symbol('所需容量', fmt(result.requiredAh, 1), 'calc', { symbol: 'Q', unit: 'Ah' }),
      ],
    })

    // ⑥ 并联组数 / 标准容量
    const perString = result.requiredAh / Math.max(1, result.parallelStrings)
    const std = describeStandardAh(perString)
    steps.push({
      key: 'strings',
      index: 6,
      title: '并联组数与标准容量',
      keyValue: `${result.parallelStrings} 组 × ${fmt(result.unitAh, 0)} Ah = ${fmt(result.configuredAh, 0)} Ah`,
      formula: 'n = max(1, ceil(Q / Q_max))\nQ_cell = 标准序列 ≥ Q / n\nQ_cfg = Q_cell × n',
      substitution: `n = ceil(${fmt(result.requiredAh, 1)} / ${MAX_UNIT_AH}) = ${result.parallelStrings}；Q/n = ${fmt(perString, 1)} → ${fmt(result.unitAh, 0)} Ah；Q_cfg = ${fmt(result.unitAh, 0)} × ${result.parallelStrings} = ${fmt(result.configuredAh, 0)} Ah`,
      result: `Q_cfg = ${fmt(result.configuredAh, 0)} Ah`,
      symbols: [
        symbol('所需容量', fmt(result.requiredAh, 1), 'calc', { symbol: 'Q', unit: 'Ah' }),
        symbol('单只容量上限', String(MAX_UNIT_AH), 'constant', {
          symbol: 'Q_max',
          unit: 'Ah',
          sourceDetail: '超过上限则分组并联',
        }),
        symbol('并联组数', String(result.parallelStrings), 'calc', { symbol: 'n', unit: '组' }),
        symbol('单只容量', fmt(result.unitAh, 0), 'table', {
          symbol: 'Q_cell',
          unit: 'Ah',
          sourceDetail: std.expression,
        }),
        symbol('配置容量', fmt(result.configuredAh, 0), 'calc', { symbol: 'Q_cfg', unit: 'Ah' }),
      ],
    })

    // ⑦ 恒功率 / W 单体
    const hasManufacturerW = result.manufacturerWPerCell > 0
    steps.push({
      key: 'power',
      index: 7,
      title: '恒功率校核（W/单体）',
      keyValue: `W_cell = ${fmt(result.requiredWPerCell, 1)} W/单体`,
      formula: 'W_cell = P × 1000 × K / (N_c × η × η_line)',
      substitution: `= ${fmt(p, 2)} × 1000 × ${fmt(k, 2)} / (${result.seriesCells} × ${fmt(eta, 2)} × ${fmt(etaLine, 2)}) = ${fmt(result.requiredWPerCell, 1)} W/单体`,
      result: hasManufacturerW
        ? `需求 ${fmt(result.requiredWPerCell, 1)} W/单体 ≤ 厂家 ${fmt(result.manufacturerWPerCell, 1)} W/单体`
        : `需求 ${fmt(result.requiredWPerCell, 1)} W/单体（未输入厂家值）`,
      symbols: [
        symbol('负荷功率', fmt(p, 2), isUps ? 'calc' : 'input', {
          symbol: 'P',
          unit: 'kW',
          ...(isUps ? {} : { inputSymbol: 'P' }),
        }),
        symbol('设计余量', fmt(k, 2), 'input', { symbol: 'K', inputSymbol: 'K' }),
        symbol('串联单体数', String(result.seriesCells), 'calc', { symbol: 'N_c', unit: '只' }),
        symbol('逆变效率', fmt(eta, 2), 'input', { symbol: 'η', inputSymbol: 'η' }),
        symbol('线路效率', fmt(etaLine, 2), 'input', { symbol: 'η_line', inputSymbol: 'η_line' }),
        symbol('恒功率需求', fmt(result.requiredWPerCell, 1), 'calc', {
          symbol: 'W_cell',
          unit: 'W/单体',
        }),
        symbol(
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
      pass: hasManufacturerW ? result.powerCheckPass : undefined,
      controlling: false,
      note: hasManufacturerW
        ? '按厂家在该备电时长和终止电压下的恒功率放电表比较。'
        : '未输入厂家 W/单体，本条只给需求值、不参与判定；正式选型应查厂家恒功率放电表。',
    })
  } else {
    // ③ 负载能量 / 降额后能量
    steps.push({
      key: 'energy',
      index: 3,
      title: '能量降额',
      keyValue: `E_req = ${fmt(result.requiredEnergyKwh, 2)} kWh`,
      formula: 'E = P × T / (η × η_line)\nE_req = E × K / (DOD × SOH × K_T)',
      substitution: `E = ${fmt(p, 2)} × ${fmt(hours, 3)} / (${fmt(eta, 2)} × ${fmt(etaLine, 2)}) = ${fmt(result.baseEnergyKwh, 2)} kWh；E_req = ${fmt(result.baseEnergyKwh, 2)} × ${fmt(k, 2)} / (${fmt(Number(input.dod), 2)} × ${fmt(Number(input.soh), 2)} × ${fmt(Number(input.tempDerating), 2)}) = ${fmt(result.requiredEnergyKwh, 2)} kWh`,
      result: `E_req = ${fmt(result.requiredEnergyKwh, 2)} kWh`,
      symbols: [
        symbol('负荷功率', fmt(p, 2), isUps ? 'calc' : 'input', {
          symbol: 'P',
          unit: 'kW',
          ...(isUps ? {} : { inputSymbol: 'P' }),
        }),
        symbol('备电时长', fmt(hours, 3), 'input', {
          symbol: 'T',
          unit: 'h',
          inputSymbol: 'T',
          sourceDetail: `${fmt(result.backupMinutes, 0)} min ÷ 60`,
        }),
        symbol('逆变效率', fmt(eta, 2), 'input', { symbol: 'η', inputSymbol: 'η' }),
        symbol('线路效率', fmt(etaLine, 2), 'input', { symbol: 'η_line', inputSymbol: 'η_line' }),
        symbol('设计余量', fmt(k, 2), 'input', { symbol: 'K', inputSymbol: 'K' }),
        symbol('放电深度', fmt(Number(input.dod), 2), 'input', {
          symbol: 'DOD',
          inputSymbol: 'DOD',
        }),
        symbol('寿命末期容量保持', fmt(Number(input.soh), 2), 'input', {
          symbol: 'SOH',
          inputSymbol: 'SOH',
        }),
        symbol('温度降额', fmt(Number(input.tempDerating), 2), 'input', {
          symbol: 'K_T',
          inputSymbol: 'KT',
        }),
        symbol('负载能量', fmt(result.baseEnergyKwh, 2), 'calc', { symbol: 'E', unit: 'kWh' }),
        symbol('降额后能量', fmt(result.requiredEnergyKwh, 2), 'calc', {
          symbol: 'E_req',
          unit: 'kWh',
        }),
      ],
      note: '锂电按能量法：DOD / SOH / K_T 都是“可用容量打折”，不能套用铅酸温度系数 α。',
    })

    // ④ 所需容量 / 倍率下限
    steps.push({
      key: 'capacity',
      index: 4,
      title: '所需容量与倍率下限',
      keyValue: `Q = ${fmt(result.requiredAh, 1)} Ah；Q_min,C = ${fmt(result.minAhByCRate, 1)} Ah`,
      formula: 'Q = E_req × 1000 / U\nQ_min,C = I / C_max',
      substitution: `Q = ${fmt(result.requiredEnergyKwh, 2)} × 1000 / ${fmt(u, 0)} = ${fmt(result.requiredAh, 1)} Ah；Q_min,C = ${fmt(i, 2)} / ${fmt(Number(input.maxCRate), 2)} = ${fmt(result.minAhByCRate, 1)} Ah`,
      result: `取 max(Q, Q_min,C) = ${fmt(Math.max(result.requiredAh, result.minAhByCRate), 1)} Ah`,
      symbols: [
        symbol('降额后能量', fmt(result.requiredEnergyKwh, 2), 'calc', {
          symbol: 'E_req',
          unit: 'kWh',
        }),
        symbol('直流电压', fmt(u, 0), 'input', { symbol: 'U', unit: 'V', inputSymbol: 'U' }),
        symbol('放电电流', fmt(i, 2), 'calc', { symbol: 'I', unit: 'A' }),
        symbol('最大放电倍率', fmt(Number(input.maxCRate), 2), 'input', {
          symbol: 'C_max',
          unit: 'C',
          inputSymbol: 'C_max',
        }),
        symbol('能量法容量', fmt(result.requiredAh, 1), 'calc', { symbol: 'Q', unit: 'Ah' }),
        symbol('倍率下限容量', fmt(result.minAhByCRate, 1), 'calc', {
          symbol: 'Q_min,C',
          unit: 'Ah',
        }),
      ],
      note:
        result.minAhByCRate > result.requiredAh
          ? '倍率下限大于能量法容量，容量由放电倍率控制。'
          : '能量法容量大于倍率下限，容量由备电能量控制。',
    })

    // ⑤ 标准容量
    const target = Math.max(result.requiredAh, result.minAhByCRate)
    const std = describeStandardAh(target)
    steps.push({
      key: 'strings',
      index: 5,
      title: '标准容量与能量',
      keyValue: `${fmt(result.unitAh, 0)} Ah · ${fmt(result.configuredEnergyKwh, 2)} kWh`,
      formula: 'Q_cfg = 标准序列 ≥ max(Q, Q_min,C)\nE_cfg = Q_cfg × U / 1000',
      substitution: `max(${fmt(result.requiredAh, 1)}, ${fmt(result.minAhByCRate, 1)}) = ${fmt(target, 1)} → ${fmt(result.unitAh, 0)} Ah；E_cfg = ${fmt(result.unitAh, 0)} × ${fmt(u, 0)} / 1000 = ${fmt(result.configuredEnergyKwh, 2)} kWh`,
      result: `Q_cfg = ${fmt(result.unitAh, 0)} Ah，E_cfg = ${fmt(result.configuredEnergyKwh, 2)} kWh`,
      symbols: [
        symbol('能量法容量', fmt(result.requiredAh, 1), 'calc', { symbol: 'Q', unit: 'Ah' }),
        symbol('倍率下限容量', fmt(result.minAhByCRate, 1), 'calc', {
          symbol: 'Q_min,C',
          unit: 'Ah',
        }),
        symbol('配置容量', fmt(result.unitAh, 0), 'table', {
          symbol: 'Q_cfg',
          unit: 'Ah',
          sourceDetail: std.expression,
        }),
        symbol('配置能量', fmt(result.configuredEnergyKwh, 2), 'calc', {
          symbol: 'E_cfg',
          unit: 'kWh',
        }),
      ],
    })
  }

  // ⑧ / ⑥ 备电时间与放电倍率
  const index = steps.length + 1
  steps.push({
    key: 'runtime',
    index,
    title: '备电时间与放电倍率',
    keyValue: `t_run = ${fmt(result.estimatedRuntimeMinutes, 0)} min；C = ${fmt(result.cRate, 2)} C`,
    formula: isLeadAcid
      ? 't_run = Q_cfg / Q_req × T\nC = I / Q_cfg'
      : 't_run = E_cfg × DOD × SOH × K_T × η × η_line × 60 / P\nC = I / Q_cfg',
    substitution: isLeadAcid
      ? `t_run = ${fmt(result.configuredAh, 0)} / ${fmt(result.requiredAh, 1)} × ${fmt(result.backupMinutes, 0)} = ${fmt(result.estimatedRuntimeMinutes, 0)} min；C = ${fmt(i, 2)} / ${fmt(result.configuredAh, 0)} = ${fmt(result.cRate, 2)} C`
      : `t_run = ${fmt(result.configuredEnergyKwh, 2)} × ${fmt(Number(input.dod), 2)} × ${fmt(Number(input.soh), 2)} × ${fmt(Number(input.tempDerating), 2)} × ${fmt(eta, 2)} × ${fmt(etaLine, 2)} × 60 / ${fmt(p, 2)} = ${fmt(result.estimatedRuntimeMinutes, 0)} min；C = ${fmt(i, 2)} / ${fmt(result.unitAh, 0)} = ${fmt(result.cRate, 2)} C`,
    result: `预估备电 ${fmt(result.estimatedRuntimeMinutes, 0)} min，放电倍率 ${fmt(result.cRate, 2)} C`,
    symbols: [
      ...(isLeadAcid
        ? [
            symbol('所需容量', fmt(result.requiredAh, 1), 'calc', { symbol: 'Q_req', unit: 'Ah' }),
            symbol('配置容量', fmt(result.configuredAh, 0), 'calc', {
              symbol: 'Q_cfg',
              unit: 'Ah',
            }),
          ]
        : [
            symbol('配置能量', fmt(result.configuredEnergyKwh, 2), 'calc', {
              symbol: 'E_cfg',
              unit: 'kWh',
            }),
            symbol('放电深度', fmt(Number(input.dod), 2), 'input', {
              symbol: 'DOD',
              inputSymbol: 'DOD',
            }),
            symbol('寿命末期容量保持', fmt(Number(input.soh), 2), 'input', {
              symbol: 'SOH',
              inputSymbol: 'SOH',
            }),
            symbol('温度降额', fmt(Number(input.tempDerating), 2), 'input', {
              symbol: 'K_T',
              inputSymbol: 'KT',
            }),
            symbol('配置容量', fmt(result.unitAh, 0), 'calc', { symbol: 'Q_cfg', unit: 'Ah' }),
          ]),
      symbol('备电时长', fmt(result.backupMinutes, 0), 'input', {
        symbol: 'T',
        unit: 'min',
        inputSymbol: 'T',
      }),
      symbol('放电电流', fmt(i, 2), 'calc', { symbol: 'I', unit: 'A' }),
      symbol('预估备电', fmt(result.estimatedRuntimeMinutes, 0), 'calc', {
        symbol: 't_run',
        unit: 'min',
      }),
      symbol('放电倍率', fmt(result.cRate, 2), 'calc', { symbol: 'C', unit: 'C' }),
    ],
    note: isLeadAcid
      ? '按配置容量与所需容量之比折算；实际还受厂家放电曲线和并联均流影响。'
      : '锂电按配置能量与降额系数反算；实际以厂家放电曲线和 BMS 限值为准。',
  })

  return steps
}

export function buildParameterDocs(): ParameterDoc[] {
  return [
    {
      symbol: 'P',
      name: '负荷功率',
      meaning: 'UPS 实际带载的有功功率；按 UPS 容量输入时由 S × K_load × cosφ 折算。',
      position: '用于放电电流 I 与恒功率需求 W_cell。',
      impact: 'P 增大 → I、Q、W_cell 同比例增大。',
      source: '计算（或输入）',
      editable: '间接（改 S / 负载率 / 功率因数），或直接按功率输入',
      basis: 'UPS 铭牌与实测负载。',
    },
    {
      symbol: 'S',
      name: 'UPS 额定容量',
      meaning: 'UPS 铭牌视在功率。',
      position: '用于 P = S × K_load × cosφ。',
      impact: 'S 增大 → P 增大 → 容量增大。',
      source: '输入',
      editable: '是',
      basis: 'UPS 铭牌。',
    },
    {
      symbol: 'K_load',
      name: '负载率',
      meaning: '实际负载占 UPS 额定容量的比例。',
      position: '用于 P。',
      impact: '负载率增大 → 容量增大。',
      source: '输入',
      editable: '是',
      basis: '设计负载率或实测负载率。',
    },
    {
      symbol: 'cosφ',
      name: '输出功率因数',
      meaning: 'UPS 负载功率因数，用于视在功率折算有功功率。',
      position: '用于 P。',
      impact: 'cosφ 增大 → P 增大（同一 kVA 下）。',
      source: '输入',
      editable: '是',
      basis: 'UPS 规格与负载特性。',
    },
    {
      symbol: 'T',
      name: '备电时长',
      meaning: 'UPS 电池需要支撑的放电时间。',
      position: '用于 Q（铅酸）或 E_req（锂电），以及备电时间折算。',
      impact: 'T 增大 → 容量近似同比例增大；同时改变 α 与容量系数取值。',
      source: '输入',
      editable: '是',
      basis: 'GB 50174-2017 附录 A 规定最少备用时间，具体按时长要求取值。',
    },
    {
      symbol: 't',
      name: '最低环境温度',
      meaning: '电池室最不利温度，用于铅酸温度修正。',
      position: '用于 Kt = 1 + α(t − 25)。',
      impact: 't 降低 → Kt 减小 → 所需容量增大；高温只影响寿命，不增大容量。',
      source: '输入',
      editable: '是',
      basis: 'GB 51194-2016；电池室温度设计值。',
    },
    {
      symbol: 'η',
      name: '逆变效率',
      meaning: 'UPS 逆变器效率，直流侧取电大于交流输出。',
      position: '用于 I 与 W_cell。',
      impact: 'η 增大 → I 减小 → 容量减小。',
      source: '输入',
      editable: '是',
      basis: 'UPS 样本（高频机约 0.94~0.96）。',
    },
    {
      symbol: 'η_line',
      name: '线路效率',
      meaning: '电池到 UPS 的直流线路与保护器件损耗。',
      position: '用于 I 与 W_cell。',
      impact: '线路效率增大 → I 减小。',
      source: '输入',
      editable: '是',
      basis: '线路压降与损耗估算。',
    },
    {
      symbol: 'U',
      name: '直流电压',
      meaning: '电池组标称直流电压；铅酸按串联单元折算为实际电压。',
      position: '用于 I、Q（锂电）、E_cfg。',
      impact: 'U 增大 → I 减小，所需 Ah 减小；但串联单体数增加。',
      source: '输入',
      editable: '是',
      basis: 'UPS 直流母线电压。',
    },
    {
      symbol: 'U_cell',
      name: '单体规格',
      meaning: '2 V 单体或 12 V 电池块。',
      position: '用于 N_s = round(U / U_cell) 与 N_c 换算。',
      impact: '只改变串联只数与单体计数，不改变总容量。',
      source: '输入',
      editable: '是',
      basis: '产品规格。',
    },
    {
      symbol: 'U_end,cell',
      name: '单体终止电压',
      meaning: '放电终止时允许的单体电压，限幅 1.5~1.9 V。',
      position: '用于 U_end = N_c × U_end,cell。',
      impact: '终止电压降低 → 可用容量略增，但接近 UPS 直流输入下限时不允许。',
      source: '输入',
      editable: '是',
      basis: 'GB/T 19638.1-2014；UPS 直流输入范围。',
    },
    {
      symbol: 'U_min',
      name: 'UPS 最低直流输入',
      meaning: 'UPS 允许的最低直流输入电压，0 表示暂不校核。',
      position: '与 U_end 比较。',
      impact: '不参与容量计算，只影响终止电压校核。',
      source: '输入',
      editable: '是',
      basis: 'UPS 样本。',
    },
    {
      symbol: 'K',
      name: '设计余量',
      meaning: '容量设计余量系数。',
      position: '用于 Q（铅酸）与 E_req（锂电）。',
      impact: 'K 增大 → 容量增大。',
      source: '输入',
      editable: '是',
      basis: 'GB 51194-2016 取 1.25；锂电常取 1.1~1.2。',
    },
    {
      symbol: 'η_ah',
      name: '放电容量系数',
      meaning: '电池在给定放电小时率下可放出的容量与 10 h 额定容量之比。',
      position: '用作 Q 公式的分母（10 h 额定 = 1.0）。',
      impact: 'η_ah 减小 → 所需容量增大；偏离典型表超过 0.02 时计算书会提示。',
      source: '输入（查表建议值）',
      editable: '是',
      basis: 'GB 51194-2016 典型放电容量系数表 / 厂家放电曲线。',
    },
    {
      symbol: 'α',
      name: '温度系数',
      meaning: '铅酸容量随温度变化的经验系数，按放电小时率分段。',
      position: '用于 Kt。',
      impact: 'α 增大 → 低温时 Kt 更小、容量更大。',
      source: '常数（分段）',
      editable: '否',
      basis: 'GB 51194-2016：≥10 h 取 0.006，1~10 h 取 0.008，<1 h 取 0.01。',
    },
    {
      symbol: 'Kt',
      name: '温度修正系数',
      meaning: '按最低环境温度修正容量，下限 0.5。',
      position: 'Q 公式的分母。',
      impact: 'Kt 减小 → 所需容量增大。',
      source: '计算',
      editable: '间接（改 t / T）',
      basis: 'GB 51194-2016。',
    },
    {
      symbol: 'I',
      name: '放电电流',
      meaning: '备电时电池组的直流放电电流。',
      position: '用于 Q、W_cell、C。',
      impact: '核心中间值，随 P 增大、U / η 减小而增大。',
      source: '计算',
      editable: '间接',
      basis: '能量守恒。',
    },
    {
      symbol: 'N_s',
      name: '串联单元数',
      meaning: '按标称电压折算的串联单元数量。',
      position: '用于 N_c。',
      impact: '随 U / U_cell 增大。',
      source: '计算',
      editable: '间接',
      basis: '串联取整规则。',
    },
    {
      symbol: 'N_c',
      name: '串联单体数',
      meaning: '串联后的 2 V 单体总数（12 V 电池块按 6 只单体计）。',
      position: '用于 U_end 与 W_cell。',
      impact: '随 U / U_cell 增大。',
      source: '计算',
      editable: '间接',
      basis: '产品结构。',
    },
    {
      symbol: 'U_end',
      name: '电池组终止电压',
      meaning: '整组放电终止电压。',
      position: '与 UPS 最低直流输入比较。',
      impact: '终止电压过低会导致 UPS 提前关机。',
      source: '计算',
      editable: '间接',
      basis: 'N_c × 单体终止电压。',
    },
    {
      symbol: 'Q',
      name: '所需容量',
      meaning: '满足备电要求所需的最低安时容量。',
      position: '用于 n、Q_cfg。',
      impact: '随 I、T、K 增大而增大。',
      source: '计算',
      editable: '间接',
      basis: 'GB 51194-2016 安时法。',
    },
    {
      symbol: 'Q_max',
      name: '单只容量上限',
      meaning: '单只电池允许的最大标称容量，超过则并联分组。',
      position: '用于 n = ceil(Q / Q_max)。',
      impact: '上限越小 → 并联组数越多。',
      source: '常数',
      editable: '否',
      basis: '常用产品上限 1000 Ah。',
    },
    {
      symbol: 'n',
      name: '并联组数',
      meaning: '电池组并联数量。',
      position: '用于 Q_cfg。',
      impact: '组数越多，均流与保护配合越复杂。',
      source: '计算',
      editable: '间接（改单只容量 / 上限）',
      basis: 'GB 51194-2016 建议 UPS 电池并联不超过 4 组。',
    },
    {
      symbol: 'Q_cfg',
      name: '配置容量',
      meaning: '按标准序列选型后的实际配置容量。',
      position: '结论与备电时间折算。',
      impact: '最终结果。',
      source: '计算（查标准序列）',
      editable: '间接',
      basis: '标准 Ah 序列。',
    },
    {
      symbol: 'W_cell',
      name: '恒功率需求',
      meaning: '按恒功率法折算的每单体放电功率，用于对照厂家 W/单体表。',
      position: '与厂家 W/单体比较。',
      impact: '随 P、K 增大而增大。',
      source: '计算',
      editable: '间接',
      basis: '恒功率法（GB 51194-2016 提示用厂家放电表复核）。',
    },
    {
      symbol: 'W_man',
      name: '厂家 W/单体',
      meaning: '厂家在该备电时长和终止电压下的单只恒功率放电能力。',
      position: '与 W_cell 比较。',
      impact: '不改变容量，只影响恒功率校核结论。',
      source: '输入（厂家数据）',
      editable: '是',
      basis: '厂家恒功率放电表。',
    },
    {
      symbol: 'DOD',
      name: '放电深度',
      meaning: '允许放出的电量占额定容量的比例（锂电）。',
      position: 'E_req 的分母。',
      impact: 'DOD 减小 → 所需能量增大。',
      source: '输入',
      editable: '是',
      basis: '电芯规格与 BMS 策略，常取 0.8~0.9。',
    },
    {
      symbol: 'SOH',
      name: '寿命末期容量保持',
      meaning: '寿命末期仍可用的容量比例（锂电）。',
      position: 'E_req 的分母。',
      impact: 'SOH 减小 → 所需能量增大。',
      source: '输入',
      editable: '是',
      basis: '厂家质保曲线，常取 0.8。',
    },
    {
      symbol: 'K_T',
      name: '温度降额',
      meaning: '低温或高温下可用容量的折减系数（锂电）。',
      position: 'E_req 的分母。',
      impact: 'K_T 减小 → 所需能量增大。',
      source: '输入',
      editable: '是',
      basis: '厂家温度降额曲线；不能套用铅酸 α。',
    },
    {
      symbol: 'C_max',
      name: '最大放电倍率',
      meaning: '电芯 / 模组允许的最大持续放电倍率。',
      position: '用于 Q_min,C = I / C_max。',
      impact: 'C_max 减小 → 倍率下限容量增大，可能成为控制项。',
      source: '输入',
      editable: '是',
      basis: '电芯规格书 / BMS 限值。',
    },
    {
      symbol: 'E_req',
      name: '降额后能量',
      meaning: '计入 DOD、SOH、K_T 与设计余量后所需的电池能量（锂电）。',
      position: '用于 Q 与标准容量。',
      impact: '最终结果之一。',
      source: '计算',
      editable: '间接',
      basis: '能量法。',
    },
    {
      symbol: 'C',
      name: '放电倍率',
      meaning: '放电电流与配置容量之比。',
      position: '用于倍率校核。',
      impact: '倍率过高会降低可用容量并增加发热。',
      source: '计算',
      editable: '间接',
      basis: 'I / Q_cfg。',
    },
  ]
}
