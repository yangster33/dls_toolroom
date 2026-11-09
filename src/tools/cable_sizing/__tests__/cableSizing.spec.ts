import { describe, expect, it } from 'vitest'
import {
  calculateCableSizing,
  createDefaultInput,
  formatSection,
  type CableSizingInput,
} from '../cableSizing'
import {
  airGroupingFactor,
  buriedGroupingFactor,
  harmonicFactor,
  soilResistivityFactor,
} from '../correctionFactors'

function withInput(overrides: Partial<CableSizingInput>): CableSizingInput {
  return { ...createDefaultInput(), ...overrides }
}

describe('calculateCableSizing', () => {
  it('按三相负荷计算电流并完成多约束选型', () => {
    const result = calculateCableSizing(withInput({ demandFactor: 1, lengthM: 50 }))

    expect(result).not.toBeNull()
    expect(result!.designPowerKw).toBeCloseTo(30, 6)
    expect(result!.designCurrentA).toBeCloseTo(59.58, 1)
    expect(result!.selectedSection).toBe(16)
    expect(result!.overallPass).toBe(true)
    expect(result!.cableLabel).toContain('YJV-0.6/1kV')
    expect(result!.cableLabel).toContain('16')
  })

  it('单相负荷按 220 V 与功率因数计算', () => {
    const result = calculateCableSizing(
      withInput({
        system: 'single-phase',
        voltage: 220,
        powerKw: 3,
        demandFactor: 1,
        powerFactor: 0.9,
        efficiency: 1,
        lengthM: 30,
        ambientTempC: 30,
        shortCircuitKa: 3,
        clearingTimeS: 0.1,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.designCurrentA).toBeCloseTo(15.15, 1)
    expect(result!.selectedSection).toBe(10)
    expect(result!.overallPass).toBe(true)
  })

  it('长线路由电压降控制截面', () => {
    const result = calculateCableSizing(
      withInput({
        powerKw: 2,
        demandFactor: 1,
        lengthM: 1000,
        allowedDropPercent: 5,
        shortCircuitKa: 0,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.selectedSection).toBeGreaterThanOrEqual(10)
    expect(result!.drivers).toContain('电压降')
    expect(result!.voltageDropPercent).toBeLessThanOrEqual(5)
  })

  it('短路热稳定控制截面', () => {
    const result = calculateCableSizing(
      withInput({
        shortCircuitKa: 20,
        clearingTimeS: 0.5,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.shortCircuitMinSection).toBeCloseTo(98.9, 0)
    expect(result!.selectedSection).toBe(120)
    expect(result!.drivers).toContain('短路热稳定')
    expect(result!.overallPass).toBe(true)
  })

  it('铝芯固定敷设不小于 10 mm²', () => {
    const result = calculateCableSizing(
      withInput({
        powerKw: 1,
        demandFactor: 1,
        material: 'al',
        lengthM: 10,
        ambientTempC: 30,
        shortCircuitKa: 0,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.selectedSection).toBe(10)
    expect(result!.cableLabel).toContain('YJLV')
  })

  it('每相并联电缆可降低单根截面', () => {
    const single = calculateCableSizing(withInput({ powerKw: 200, demandFactor: 1, lengthM: 100 }))
    const parallel = calculateCableSizing(
      withInput({ powerKw: 200, demandFactor: 1, lengthM: 100, parallelCables: 2 }),
    )

    expect(single).not.toBeNull()
    expect(parallel).not.toBeNull()
    expect(parallel!.selectedSection).toBeLessThan(single!.selectedSection)
    expect(parallel!.parallelCables).toBe(2)
    expect(parallel!.drivers.length).toBeGreaterThan(0)
    expect(single!.protectionPass).toBe(true)
    expect(parallel!.protectionPass).toBe(true)
  })

  it('按电流输入时反算计算负荷', () => {
    const result = calculateCableSizing(
      withInput({
        inputMode: 'current',
        currentA: 100,
        voltage: 380,
        lengthM: 50,
        ambientTempC: 30,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.designCurrentA).toBeCloseTo(100, 6)
    expect(result!.designPowerKw).toBeCloseTo(50.35, 1)
  })

  it('自动匹配断路器并校核保护配合', () => {
    const result = calculateCableSizing(withInput({ demandFactor: 1, lengthM: 50 }))

    expect(result).not.toBeNull()
    expect(result!.breakerAuto).toBe(true)
    expect(result!.breakerRatingA).toBe(63)
    expect(result!.protectionPass).toBe(true)
  })

  it('直流回路按往返电阻计算电压降', () => {
    const result = calculateCableSizing(
      withInput({
        system: 'dc',
        voltage: 48,
        powerKw: 3,
        efficiency: 0.95,
        demandFactor: 1,
        lengthM: 20,
        ambientTempC: 30,
        shortCircuitKa: 3,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.designCurrentA).toBeCloseTo(65.79, 1)
    expect(result!.selectedSection).toBe(25)
    expect(result!.voltageDropPercent).toBeLessThanOrEqual(5)
  })

  it('无效输入返回 null', () => {
    expect(calculateCableSizing(withInput({ powerKw: 0 }))).toBeNull()
    expect(calculateCableSizing(withInput({ lengthM: 0 }))).toBeNull()
    expect(calculateCableSizing(withInput({ voltage: 0 }))).toBeNull()
    expect(calculateCableSizing(withInput({ inputMode: 'current', currentA: 0 }))).toBeNull()
    expect(calculateCableSizing(withInput({ powerFactor: 0 }))).toBeNull()
    expect(calculateCableSizing(withInput({ efficiency: 0 }))).toBeNull()
    expect(calculateCableSizing(withInput({ demandFactor: 0 }))).toBeNull()
    expect(calculateCableSizing(withInput({ allowedDropPercent: 0 }))).toBeNull()
  })
})

describe('formatSection', () => {
  it('整数截面不带小数，非整数保留一位', () => {
    expect(formatSection(16)).toBe('16')
    expect(formatSection(1.5)).toBe('1.5')
  })
})

describe('分组与修正系数', () => {
  it('空气成束系数按敷设方式取表值', () => {
    expect(airGroupingFactor('bunched', 1)).toBe(1)
    expect(airGroupingFactor('bunched', 4)).toBe(0.65)
    expect(airGroupingFactor('bunched', 10)).toBe(0.45)
    expect(airGroupingFactor('singleLayer', 4)).toBe(0.75)
    expect(airGroupingFactor('tray', 4)).toBe(0.77)
    expect(airGroupingFactor('ladder', 4)).toBe(0.8)
    expect(airGroupingFactor('singleLayer', 12)).toBe(0.7)
  })

  it('埋地系数按间距取表值，13～19 回路按 20 回路保守取值', () => {
    expect(buriedGroupingFactor('touching', 2)).toBe(0.75)
    expect(buriedGroupingFactor('touching', 3)).toBe(0.65)
    expect(buriedGroupingFactor('gap500', 3)).toBe(0.85)
    expect(buriedGroupingFactor('touching', 15)).toBe(0.29)
  })

  it('土壤热阻率与谐波修正取表值', () => {
    expect(soilResistivityFactor(2.5).factor).toBe(1)
    expect(soilResistivityFactor(3).factor).toBe(0.9)
    expect(harmonicFactor(10)).toMatchObject({ factor: 1, neutralBased: false })
    expect(harmonicFactor(20)).toMatchObject({ factor: 0.86, neutralBased: false })
    expect(harmonicFactor(40)).toMatchObject({ factor: 0.86, neutralBased: true })
    expect(harmonicFactor(50)).toMatchObject({ factor: 1, neutralBased: true })
  })
})

describe('口径调整后的选型行为', () => {
  it('并联电缆计入成束根数', () => {
    const result = calculateCableSizing(withInput({ groupedCircuits: 3, parallelCables: 2 }))

    expect(result).not.toBeNull()
    expect(result!.groupingCount).toBe(6)
    expect(result!.groupFactor).toBe(0.72)
  })

  it('直埋按间距与土壤热阻率修正', () => {
    const touching = calculateCableSizing(
      withInput({ method: 'D', ambientTempC: 20, groupedCircuits: 3 }),
    )
    expect(touching).not.toBeNull()
    expect(touching!.groupFactor).toBe(0.65)
    expect(touching!.soilFactor).toBe(1)

    const spaced = calculateCableSizing(
      withInput({
        method: 'D',
        ambientTempC: 20,
        groupedCircuits: 3,
        buriedSpacing: 'gap500',
        soilThermalResistivity: 3,
      }),
    )
    expect(spaced).not.toBeNull()
    expect(spaced!.groupFactor).toBe(0.85)
    expect(spaced!.soilFactor).toBe(0.9)
  })

  it('谐波 >33% 时按中性线电流选型', () => {
    const result = calculateCableSizing(withInput({ harmonicThdPercent: 40 }))

    expect(result).not.toBeNull()
    expect(result!.harmonicFactor).toBe(0.86)
    expect(result!.neutralCurrentA).toBeCloseTo(result!.designCurrentA * 1.2, 6)
    expect(result!.ampacityDesignCurrentA).toBeCloseTo(result!.neutralCurrentA, 6)
    expect(result!.drivers).toContain('谐波')
  })

  it('熔断器 gG 按 k3 校核保护配合', () => {
    const result = calculateCableSizing(
      withInput({
        demandFactor: 1,
        lengthM: 50,
        protectionDevice: 'fuse',
        breakerRatingA: 100,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.fuseK3).toBe(1.1)
    expect(result!.protectionPass).toBe(true)
    expect(result!.selectedSection).toBe(25)

    const small = calculateCableSizing(withInput({ protectionDevice: 'fuse', breakerRatingA: 10 }))
    expect(small).not.toBeNull()
    expect(small!.fuseK3).toBe(1.31)
  })

  it('电机启动压降校核', () => {
    const result = calculateCableSizing(
      withInput({
        motorStarting: true,
        startingCurrentMultiple: 6,
        allowedStartingDropPercent: 15,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.startingVoltageDropPercent).toBeCloseTo(12.61, 1)
    expect(result!.startingPass).toBe(true)
    expect(result!.checks.some((check) => check.key === 'motor-start')).toBe(true)
  })

  it('线路电抗无效时回退默认值并提示', () => {
    const result = calculateCableSizing(withInput({ reactanceOhmPerKm: Number.NaN }))

    expect(result).not.toBeNull()
    expect(result!.warnings.some((warning) => warning.includes('线路电抗输入无效'))).toBe(true)
  })
})
