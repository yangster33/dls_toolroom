import { describe, expect, it } from 'vitest'
import {
  ROOM_TYPE_PRESETS,
  SIMPLE_MODE_FIXED,
  calculateHvacCooling,
  createDefaultInput,
  createSimpleInput,
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

describe('createSimpleInput · 简易模式', () => {
  it('固定厂家 / 规范类参数', () => {
    const input = createSimpleInput()

    expect(input.unitType).toBe('precision')
    expect(input.loadSensibleRatio).toBe(0.9)
    expect(input.unitSensibleRatio).toBe(0.9)
    expect(input.correctionFactor).toBe(1)
    expect(input.pBasisKw).toBe(2.5)
    expect(input.unitCapacityKw).toBe(0)
    expect(input.runningUnitCount).toBe(0)
    expect(input.unitType).toBe(SIMPLE_MODE_FIXED.unitType)
  })

  it('固定方案假定（经验值）参数', () => {
    const input = createSimpleInput()

    expect(input.heatFactor).toBe(1)
    expect(input.envelopeLoadKw).toBe(3)
    expect(input.otherLoadKw).toBe(1)
    expect(input.lightingWPerM2).toBe(10)
    expect(input.peopleCount).toBe(2)
    expect(input.peopleWPerPerson).toBe(120)
    expect(input.freshAirMode).toBe('load')
    expect(input.freshAirLoadKw).toBe(2)
  })

  it('面积指标按房间类型预设，自定义机房保留传入值', () => {
    expect(createSimpleInput().areaIndexWPerM2).toBe(400)
    expect(createSimpleInput({ roomType: 'data_center' }).areaIndexWPerM2).toBe(800)
    expect(createSimpleInput({ roomType: 'auxiliary' }).areaIndexWPerM2).toBe(200)
    expect(createSimpleInput({ roomType: 'custom', areaIndexWPerM2: 650 }).areaIndexWPerM2).toBe(
      650,
    )

    for (const preset of ROOM_TYPE_PRESETS) {
      if (preset.key === 'custom') continue
      expect(createSimpleInput({ roomType: preset.key }).areaIndexWPerM2).toBe(
        preset.areaIndexWPerM2,
      )
    }
  })

  it('负荷侧输入保持可见 / 可改，overrides 不被固定值覆盖', () => {
    const input = createSimpleInput({
      roomType: 'data_center',
      calculationMode: 'area',
      areaM2: 200,
      itPowerKw: 80,
      designMargin: 0.2,
      redundancy: '2n',
    })

    expect(input.roomType).toBe('data_center')
    expect(input.calculationMode).toBe('area')
    expect(input.areaM2).toBe(200)
    expect(input.itPowerKw).toBe(80)
    expect(input.designMargin).toBe(0.2)
    expect(input.redundancy).toBe('2n')
    // 固定值仍按简易模式生效
    expect(input.unitType).toBe('precision')
    expect(input.correctionFactor).toBe(1)
    expect(input.heatFactor).toBe(1)
    expect(input.envelopeLoadKw).toBe(3)
    expect(input.areaIndexWPerM2).toBe(800)
  })

  it('简易默认结果锚点：100 m² 通信机房详细法', () => {
    const result = calculateHvacCooling(createSimpleInput())

    expect(result).not.toBeNull()
    expect(result!.totalLoadKw).toBeCloseTo(37.24, 6)
    expect(result!.designLoadKw).toBeCloseTo(42.826, 6)
    expect(result!.requiredCapacityKw).toBeCloseTo(42.826, 6)
    expect(result!.runningCount).toBe(2)
    expect(result!.backupCount).toBe(1)
    expect(result!.unitCapacityKw).toBe(25)
    expect(result!.installedCapacityKw).toBe(75)
    expect(result!.overallPass).toBe(true)
  })

  it('简易默认结果锚点：100 m² 通信机房面积法', () => {
    const result = calculateHvacCooling(createSimpleInput({ calculationMode: 'area' }))

    expect(result).not.toBeNull()
    expect(result!.totalLoadKw).toBeCloseTo(40, 6)
    expect(result!.designLoadKw).toBeCloseTo(46, 6)
    expect(result!.requiredCapacityKw).toBeCloseTo(46, 6)
    expect(result!.runningCount).toBe(2)
    expect(result!.backupCount).toBe(1)
    expect(result!.unitCapacityKw).toBe(30)
    expect(result!.installedCapacityKw).toBe(90)
    expect(result!.overallPass).toBe(true)
  })

  it('简易默认与专业默认结果一致（固定值均等于专业默认值）', () => {
    const simple = calculateHvacCooling(createSimpleInput())
    const professional = calculateHvacCooling(createDefaultInput())

    expect(simple).not.toBeNull()
    expect(professional).not.toBeNull()
    expect(simple!.totalLoadKw).toBeCloseTo(professional!.totalLoadKw, 6)
    expect(simple!.requiredCapacityKw).toBeCloseTo(professional!.requiredCapacityKw, 6)
    expect(simple!.unitCapacityKw).toBe(professional!.unitCapacityKw)
    expect(simple!.installedCapacityKw).toBe(professional!.installedCapacityKw)
    expect(simple!.drivers).toEqual(professional!.drivers)
  })
})

describe('drivers · 控制项', () => {
  it('默认由运行冷量与单台负载率控制，显冷量不单独控制', () => {
    const result = calculateHvacCooling(withInput({}))

    expect(result).not.toBeNull()
    expect(result!.drivers).toEqual(['运行冷量', '单台负载率'])
    expect(result!.drivers).not.toContain('显冷量')
  })

  it('显冷量校核不通过时单独记为控制项', () => {
    const result = calculateHvacCooling(withInput({ unitType: 'comfort', unitSensibleRatio: 0.75 }))

    expect(result).not.toBeNull()
    expect(result!.drivers).toContain('运行冷量')
    expect(result!.drivers).toContain('单台负载率')
    expect(result!.drivers).toContain('显冷量')
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
