import { describe, expect, it } from 'vitest'
import {
  calculateBatterySizing,
  createDefaultInput,
  type BatterySizingInput,
} from '../batterySizing'
import { buildBatteryCheckDetails } from '../checkDetails'

function withInput(overrides: Partial<BatterySizingInput>): BatterySizingInput {
  return { ...createDefaultInput(), ...overrides }
}

function detailsOf(overrides: Partial<BatterySizingInput> = {}) {
  const input = withInput(overrides)
  const result = calculateBatterySizing(input)
  expect(result).not.toBeNull()
  return buildBatteryCheckDetails(input, result!)
}

describe('buildBatteryCheckDetails · 铅酸', () => {
  it('列出容量、并联、终止电压、恒功率与容量系数五行', () => {
    const details = detailsOf()

    expect(details.map((detail) => detail.key)).toEqual([
      'capacity',
      'parallel',
      'voltage',
      'power',
      'factors',
    ])
    for (const detail of details) {
      expect(detail.margin.length).toBeGreaterThan(0)
      expect(detail.formula.length).toBeGreaterThan(0)
      expect(detail.why.length).toBeGreaterThan(0)
    }
  })

  it('容量是唯一控制项，并联与终止电压不控制容量', () => {
    const details = detailsOf()
    const capacity = details.find((detail) => detail.key === 'capacity')
    const parallel = details.find((detail) => detail.key === 'parallel')

    expect(capacity?.controlling).toBe(true)
    expect(parallel?.controlling).toBe(false)
    expect(parallel?.why).toContain('派生')
  })

  it('未设置最低直流输入时终止电压不判定通过理由', () => {
    const voltage = detailsOf().find((detail) => detail.key === 'voltage')

    expect(voltage?.margin).toContain('未设置')
    expect(voltage?.why).toContain('不参与判定')
  })

  it('未输入厂家 W/单体时裕度标注待补', () => {
    const power = detailsOf().find((detail) => detail.key === 'power')

    expect(power?.margin).toContain('未输入')
    expect(power?.pass).toBe(true)
    expect(power?.why).toContain('不参与判定')
  })

  it('容量系数行把 α、Kt、η_ah 关联到计算书第④步', () => {
    const factors = detailsOf().find((detail) => detail.key === 'factors')

    expect(factors?.stepLabel).toBe('④ 容量系数与温度修正')
    expect(factors?.symbols.map((symbol) => symbol.symbol)).toEqual(['α', 'Kt', 'η_ah', 't'])
  })
})

describe('buildBatteryCheckDetails · 锂电', () => {
  it('默认由放电倍率控制', () => {
    const details = detailsOf({ batteryType: 'lithium' })
    const rate = details.find((detail) => detail.key === 'c-rate')
    const energy = details.find((detail) => detail.key === 'energy')

    expect(details.map((detail) => detail.key)).toEqual(['energy', 'c-rate', 'temperature'])
    expect(rate?.controlling).toBe(true)
    expect(energy?.controlling).toBe(false)
    expect(rate?.why).toContain('控制项')
  })

  it('倍率上限放宽后由能量控制', () => {
    const details = detailsOf({ batteryType: 'lithium', maxCRate: 10 })
    const rate = details.find((detail) => detail.key === 'c-rate')
    const energy = details.find((detail) => detail.key === 'energy')

    expect(energy?.controlling).toBe(true)
    expect(rate?.controlling).toBe(false)
    expect(energy?.why).toContain('控制项')
  })

  it('温度降额低于 0.8 时给出不通过理由', () => {
    const details = detailsOf({ batteryType: 'lithium', tempDerating: 0.7 })
    const temperature = details.find((detail) => detail.key === 'temperature')

    expect(temperature?.pass).toBe(false)
    expect(temperature?.why).toContain('不满足')
  })
})
