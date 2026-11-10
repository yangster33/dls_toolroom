import { describe, expect, it } from 'vitest'
import {
  alphaForHours,
  calculateBatterySizing,
  capacityCoefficientForHours,
  createDefaultInput,
  type BatterySizingInput,
} from '../batterySizing'

function withInput(overrides: Partial<BatterySizingInput>): BatterySizingInput {
  return { ...createDefaultInput(), ...overrides }
}

describe('calculateBatterySizing', () => {
  it('按 UPS 容量计算铅酸安时容量与恒功率需求', () => {
    const result = calculateBatterySizing(withInput({}))

    expect(result).not.toBeNull()
    expect(result!.loadPowerKw).toBeCloseTo(72, 6)
    expect(result!.seriesUnits).toBe(40)
    expect(result!.seriesCells).toBe(240)
    expect(result!.dischargeCurrentA).toBeCloseTo(159.49, 1)
    expect(result!.requiredAh).toBeCloseTo(237.3, 0)
    expect(result!.unitAh).toBe(250)
    expect(result!.parallelStrings).toBe(1)
    expect(result!.requiredWPerCell).toBeCloseTo(398.7, 0)
    expect(result!.overallPass).toBe(true)
  })

  it('低温按 α 修正后所需容量增大', () => {
    const normal = calculateBatterySizing(
      withInput({ backupMinutes: 60, capacityCoefficient: 0.52, ambientTempC: 25 }),
    )
    const cold = calculateBatterySizing(
      withInput({ backupMinutes: 60, capacityCoefficient: 0.52, ambientTempC: 5 }),
    )

    expect(normal).not.toBeNull()
    expect(cold).not.toBeNull()
    expect(cold!.temperatureFactor).toBeCloseTo(0.84, 6)
    expect(cold!.requiredAh).toBeGreaterThan(normal!.requiredAh)
  })

  it('2V 单体与 12V 电池块的串联单体数一致', () => {
    const block = calculateBatterySizing(withInput({ cellVoltage: 12 }))
    const cell = calculateBatterySizing(withInput({ cellVoltage: 2 }))

    expect(block).not.toBeNull()
    expect(cell).not.toBeNull()
    expect(block!.seriesUnits).toBe(40)
    expect(cell!.seriesUnits).toBe(240)
    expect(block!.seriesCells).toBe(cell!.seriesCells)
    expect(block!.requiredAh).toBeCloseTo(cell!.requiredAh, 6)
  })

  it('输入厂家 W/单体时进行恒功率校核', () => {
    const pass = calculateBatterySizing(withInput({ manufacturerWPerCell: 450 }))
    const fail = calculateBatterySizing(withInput({ manufacturerWPerCell: 100 }))

    expect(pass).not.toBeNull()
    expect(fail).not.toBeNull()
    expect(pass!.powerCheckPass).toBe(true)
    expect(fail!.powerCheckPass).toBe(false)
    expect(fail!.overallPass).toBe(false)
  })

  it('设置 UPS 最低直流输入时校核终止电压', () => {
    const pass = calculateBatterySizing(withInput({ dcMinVoltage: 400 }))
    const fail = calculateBatterySizing(withInput({ dcMinVoltage: 430 }))

    expect(pass).not.toBeNull()
    expect(fail).not.toBeNull()
    expect(pass!.endVoltageActual).toBeCloseTo(420, 6)
    expect(pass!.overallPass).toBe(true)
    expect(fail!.overallPass).toBe(false)
  })

  it('锂电按能量法计算并校核倍率', () => {
    const result = calculateBatterySizing(withInput({ batteryType: 'lithium', dcVoltage: 480 }))

    expect(result).not.toBeNull()
    expect(result!.baseEnergyKwh).toBeCloseTo(38.28, 1)
    expect(result!.requiredEnergyKwh).toBeCloseTo(66.46, 0)
    expect(result!.requiredAh).toBeCloseTo(138.5, 0)
    expect(result!.unitAh).toBe(200)
    expect(result!.cRate).toBeCloseTo(0.797, 2)
    expect(result!.overallPass).toBe(true)
  })

  it('锂电倍率超限时由倍率控制容量', () => {
    const result = calculateBatterySizing(
      withInput({
        batteryType: 'lithium',
        loadMode: 'power',
        loadPowerKw: 200,
        dcVoltage: 400,
        maxCRate: 0.5,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.minAhByCRate).toBeGreaterThan(result!.requiredAh)
    expect(result!.cRate).toBeLessThanOrEqual(0.5)
    expect(result!.warnings.some((warning) => warning.includes('最大放电倍率控制'))).toBe(true)
  })

  it('无效输入返回 null', () => {
    expect(calculateBatterySizing(withInput({ upsKva: 0 }))).toBeNull()
    expect(calculateBatterySizing(withInput({ backupMinutes: 0 }))).toBeNull()
    expect(calculateBatterySizing(withInput({ dcVoltage: 0 }))).toBeNull()
    expect(calculateBatterySizing(withInput({ efficiency: 0 }))).toBeNull()
    expect(calculateBatterySizing(withInput({ designMargin: 0 }))).toBeNull()
    expect(calculateBatterySizing(withInput({ batteryType: 'lithium', dod: 0 }))).toBeNull()
  })
})

describe('控制项与控制标记', () => {
  it('铅酸由安时容量控制，并同时给出放电倍率', () => {
    const result = calculateBatterySizing(withInput({}))

    expect(result).not.toBeNull()
    expect(result!.drivers).toEqual(['安时容量'])
    expect(result!.cRate).toBeCloseTo(159.49 / 250, 3)
  })

  it('锂电默认由放电倍率控制', () => {
    const result = calculateBatterySizing(withInput({ batteryType: 'lithium' }))

    expect(result).not.toBeNull()
    expect(result!.drivers).toEqual(['放电倍率'])
  })

  it('倍率上限放宽后由能量容量控制', () => {
    const result = calculateBatterySizing(withInput({ batteryType: 'lithium', maxCRate: 10 }))

    expect(result).not.toBeNull()
    expect(result!.drivers).toEqual(['能量容量'])
  })
})

describe('终止电压限幅', () => {
  it('超出 1.5~1.9 V 时按边界取值', () => {
    const high = calculateBatterySizing(withInput({ endVoltagePerCell: 2.2 }))
    const low = calculateBatterySizing(withInput({ endVoltagePerCell: 1.2 }))

    expect(high).not.toBeNull()
    expect(low).not.toBeNull()
    expect(high!.endVoltagePerCellActual).toBeCloseTo(1.9, 6)
    expect(high!.endVoltageActual).toBeCloseTo(456, 6)
    expect(low!.endVoltagePerCellActual).toBeCloseTo(1.5, 6)
  })
})

describe('容量系数与温度系数', () => {
  it('按备电时长取典型放电容量系数', () => {
    expect(capacityCoefficientForHours(0.5)).toBeCloseTo(0.42, 6)
    expect(capacityCoefficientForHours(1)).toBeCloseTo(0.52, 6)
    expect(capacityCoefficientForHours(10)).toBeCloseTo(1, 6)
    expect(capacityCoefficientForHours(20)).toBeCloseTo(1, 6)
  })

  it('α 按放电小时率分段', () => {
    expect(alphaForHours(0.5)).toBe(0.01)
    expect(alphaForHours(1)).toBe(0.008)
    expect(alphaForHours(10)).toBe(0.006)
  })
})
