import { describe, expect, it } from 'vitest'
import {
  calculateHvacCooling,
  createDefaultInput,
  freshAirLoadFromAirflow,
  getRoomTypePreset,
  nextStandardUnitKw,
  type HvacCoolingInput,
} from '../hvacCooling'

function withInput(overrides: Partial<HvacCoolingInput>): HvacCoolingInput {
  return { ...createDefaultInput(), ...overrides }
}

describe('calculateHvacCooling', () => {
  it('按详细法逐项累加通信机房冷负荷', () => {
    const result = calculateHvacCooling(withInput({}))

    expect(result).not.toBeNull()
    expect(result!.totalLoadKw).toBeCloseTo(37.24, 6)
    expect(result!.designLoadKw).toBeCloseTo(42.826, 6)
    expect(result!.requiredCapacityKw).toBeCloseTo(42.826, 6)
    expect(result!.sensibleLoadKw).toBeCloseTo(38.5434, 6)
    expect(result!.latentLoadKw).toBeCloseTo(4.2826, 4)
    expect(result!.areaIndexActualWPerM2).toBeCloseTo(372.4, 6)
    expect(result!.pValue).toBeCloseTo(17.1304, 4)
  })

  it('N+1 自动推荐 2 用 1 备、单台 25 kW', () => {
    const result = calculateHvacCooling(withInput({}))

    expect(result).not.toBeNull()
    expect(result!.runningCount).toBe(2)
    expect(result!.backupCount).toBe(1)
    expect(result!.unitCapacityKw).toBe(25)
    expect(result!.installedCount).toBe(3)
    expect(result!.installedCapacityKw).toBe(75)
    expect(result!.runningCapacityKw).toBe(50)
    expect(result!.faultCapacityKw).toBe(50)
    expect(result!.unitLoadRate).toBeCloseTo(0.85652, 4)
    expect(result!.overallPass).toBe(true)
  })

  it('面积法按面积指标计算，并给出 N+1 配置', () => {
    const result = calculateHvacCooling(
      withInput({ calculationMode: 'area', areaIndexWPerM2: 400, areaM2: 100 }),
    )

    expect(result).not.toBeNull()
    expect(result!.totalLoadKw).toBeCloseTo(40, 6)
    expect(result!.designLoadKw).toBeCloseTo(46, 6)
    expect(result!.requiredCapacityKw).toBeCloseTo(46, 6)
    expect(result!.runningCount).toBe(2)
    expect(result!.unitCapacityKw).toBe(30)
    expect(result!.installedCapacityKw).toBe(90)
    expect(result!.pValue).toBeCloseTo(18.4, 6)
    expect(result!.warnings.some((warning) => warning.includes('面积指标法'))).toBe(true)
  })

  it('舒适性空调显热比不足时显冷量校核失败', () => {
    const result = calculateHvacCooling(withInput({ unitType: 'comfort', unitSensibleRatio: 0.75 }))

    expect(result).not.toBeNull()
    expect(result!.unitSensibleCapacityKw).toBeCloseTo(37.5, 6)
    expect(result!.sensibleLoadKw).toBeCloseTo(38.5434, 6)
    expect(result!.overallPass).toBe(false)
    expect(result!.warnings.some((warning) => warning.includes('舒适性空调'))).toBe(true)
  })

  it('修正系数降低时所需制冷量增大', () => {
    const result = calculateHvacCooling(withInput({ correctionFactor: 0.8 }))

    expect(result).not.toBeNull()
    expect(result!.requiredCapacityKw).toBeCloseTo(53.5325, 4)
    expect(result!.unitCapacityKw).toBe(30)
    expect(result!.runningCapacityKw).toBe(60)
    expect(result!.unitLoadRate).toBeCloseTo(0.8922, 4)
    expect(result!.overallPass).toBe(true)
  })

  it('2N 配置给出双倍备用', () => {
    const result = calculateHvacCooling(withInput({ redundancy: '2n' }))

    expect(result).not.toBeNull()
    expect(result!.runningCount).toBe(2)
    expect(result!.backupCount).toBe(2)
    expect(result!.installedCount).toBe(4)
    expect(result!.installedCapacityKw).toBe(100)
    expect(result!.faultCapacityKw).toBe(50)
    expect(result!.overallPass).toBe(true)
  })

  it('手动单台容量不足时冷量和负载率校核失败', () => {
    const result = calculateHvacCooling(withInput({ unitCapacityKw: 20, runningUnitCount: 2 }))

    expect(result).not.toBeNull()
    expect(result!.runningCapacityKw).toBe(40)
    expect(result!.unitLoadRate).toBeGreaterThan(1)
    expect(result!.overallPass).toBe(false)
  })

  it('无效输入返回 null', () => {
    expect(calculateHvacCooling(withInput({ areaM2: 0 }))).toBeNull()
    expect(
      calculateHvacCooling(withInput({ calculationMode: 'area', areaIndexWPerM2: 0 })),
    ).toBeNull()
    expect(calculateHvacCooling(withInput({ designMargin: -0.1 }))).toBeNull()
    expect(calculateHvacCooling(withInput({ correctionFactor: 0 }))).toBeNull()
    expect(calculateHvacCooling(withInput({ pBasisKw: 0 }))).toBeNull()
    expect(
      calculateHvacCooling(
        withInput({
          itPowerKw: 0,
          powerLossKw: 0,
          envelopeLoadKw: 0,
          lightingWPerM2: 0,
          peopleCount: 0,
          freshAirLoadKw: 0,
          otherLoadKw: 0,
        }),
      ),
    ).toBeNull()
  })
})

describe('辅助函数', () => {
  it('按风量和焓差计算新风冷负荷', () => {
    expect(freshAirLoadFromAirflow(1000, 10)).toBeCloseTo(3.3333, 4)
    expect(freshAirLoadFromAirflow(0, 10)).toBe(0)
    expect(freshAirLoadFromAirflow(1000, 0)).toBe(0)
  })

  it('向上取常用单机容量档', () => {
    expect(nextStandardUnitKw(23.79)).toBe(25)
    expect(nextStandardUnitKw(25)).toBe(25)
    expect(nextStandardUnitKw(0)).toBe(2.5)
  })

  it('机房类型预设包含经验指标范围', () => {
    const preset = getRoomTypePreset('telecom')
    expect(preset.areaIndexRange[0]).toBe(350)
    expect(preset.areaIndexRange[1]).toBe(450)
    expect(preset.defaultSensibleRatio).toBe(0.9)
  })
})
