import { describe, expect, it } from 'vitest'
import {
  calculateHvacCooling,
  createDefaultInput,
  createSimpleInput,
  type HvacCoolingInput,
} from '../hvacCooling'
import { buildHvacCheckDetails } from '../checkDetails'

function withInput(overrides: Partial<HvacCoolingInput>): HvacCoolingInput {
  return { ...createDefaultInput(), ...overrides }
}

function detailsOf(overrides: Partial<HvacCoolingInput> = {}) {
  const input = withInput(overrides)
  const result = calculateHvacCooling(input)
  expect(result).not.toBeNull()
  return { input, result: result!, details: buildHvacCheckDetails(input, result!) }
}

describe('buildHvacCheckDetails', () => {
  it('把引擎 5 条校核转成可展开卡片', () => {
    const { details } = detailsOf()

    expect(details.map((detail) => detail.key)).toEqual([
      'capacity',
      'sensible',
      'load-rate',
      'margin',
      'area-index',
    ])
    for (const detail of details) {
      expect(detail.keyValue.length).toBeGreaterThan(0)
      expect(detail.required.length).toBeGreaterThan(0)
      expect(detail.actual.length).toBeGreaterThan(0)
      expect(detail.margin.length).toBeGreaterThan(0)
      expect(detail.formula.length).toBeGreaterThan(0)
      expect(detail.substitution.length).toBeGreaterThan(0)
      expect(detail.why.length).toBeGreaterThan(0)
      expect(detail.symbols.every((symbol) => symbol.source.length > 0)).toBe(true)
    }
  })

  it('默认由运行冷量与单台负载率控制，显冷量 / 面积指标不控制', () => {
    const { details } = detailsOf()

    expect(details.find((detail) => detail.key === 'capacity')?.controlling).toBe(true)
    expect(details.find((detail) => detail.key === 'load-rate')?.controlling).toBe(true)
    expect(details.find((detail) => detail.key === 'sensible')?.controlling).toBe(false)
    expect(details.find((detail) => detail.key === 'margin')?.controlling).toBe(false)
    expect(details.find((detail) => detail.key === 'area-index')?.controlling).toBe(false)
  })

  it('裕度按引擎结果计算，控制项写进“为什么”', () => {
    const { details } = detailsOf()
    const capacity = details.find((detail) => detail.key === 'capacity')
    const sensible = details.find((detail) => detail.key === 'sensible')
    const loadRate = details.find((detail) => detail.key === 'load-rate')
    const margin = details.find((detail) => detail.key === 'margin')
    const area = details.find((detail) => detail.key === 'area-index')

    expect(capacity?.margin).toBe('+7.2 kW')
    expect(capacity?.why).toContain('控制项')
    expect(sensible?.margin).toBe('+6.5 kW')
    expect(sensible?.why).toContain('未控制最终容量')
    expect(sensible?.why).toContain('运行冷量')
    expect(loadRate?.margin).toBe('+4.3 pp')
    expect(loadRate?.why).toContain('控制项')
    expect(margin?.margin).toBe('+0 pp')
    expect(margin?.why).toContain('满足')
    expect(margin?.why).toContain('15%')
    expect(area?.margin).toBe('+22 W/m²')
    expect(area?.why).toContain('经验值')
  })

  it('显冷量不足时显冷量行成为控制项并写明不通过', () => {
    const { details } = detailsOf({ unitType: 'comfort', unitSensibleRatio: 0.75 })
    const sensible = details.find((detail) => detail.key === 'sensible')

    expect(sensible?.pass).toBe(false)
    expect(sensible?.controlling).toBe(true)
    expect(sensible?.why).toContain('不满足')
    expect(sensible?.why).toContain('缺口')
  })

  it('手动单台容量不足时运行冷量与负载率同时不通过', () => {
    const { details } = detailsOf({ unitCapacityKw: 20, runningUnitCount: 2 })
    const capacity = details.find((detail) => detail.key === 'capacity')
    const loadRate = details.find((detail) => detail.key === 'load-rate')
    const sensible = details.find((detail) => detail.key === 'sensible')

    expect(capacity?.pass).toBe(false)
    expect(capacity?.controlling).toBe(true)
    expect(capacity?.margin).toBe('-2.8 kW')
    expect(capacity?.why).toContain('不满足')
    expect(loadRate?.pass).toBe(false)
    expect(loadRate?.controlling).toBe(true)
    expect(loadRate?.margin).toBe('-17.1 pp')
    expect(sensible?.pass).toBe(false)
  })

  it('面积法默认面积指标在通信机房经验范围内', () => {
    const { details } = detailsOf({ calculationMode: 'area' })
    const area = details.find((detail) => detail.key === 'area-index')

    expect(area?.pass).toBe(true)
    expect(area?.keyValue).toBe('400 W/m²')
    expect(area?.margin).toBe('+50 W/m²')
    expect(area?.required).toBe('350~450 W/m²')
  })

  it('面积指标超出机房类型范围时给出缺口与复核建议', () => {
    const { details } = detailsOf({ roomType: 'data_center' })
    const area = details.find((detail) => detail.key === 'area-index')

    expect(area?.pass).toBe(false)
    expect(area?.controlling).toBe(false)
    expect(area?.margin).toBe('-228 W/m²')
    expect(area?.why).toContain('不满足')
    expect(area?.why).toContain('缺口')
    expect(area?.why).toContain('600~1200 W/m²')
  })

  it('自定义机房不做经验范围判断', () => {
    const { details } = detailsOf({ roomType: 'custom' })
    const area = details.find((detail) => detail.key === 'area-index')

    expect(area?.pass).toBe(true)
    expect(area?.required).toBe('按实际负荷')
    expect(area?.why).toContain('自定义机房')
  })

  it('每条校核关联到对应计算书步骤', () => {
    const { details } = detailsOf()

    expect(details.find((detail) => detail.key === 'capacity')?.stepLabel).toBe(
      '⑤ 机组台数 / 单台容量',
    )
    expect(details.find((detail) => detail.key === 'sensible')?.stepLabel).toBe('⑥ 显冷量校核')
    expect(details.find((detail) => detail.key === 'load-rate')?.stepLabel).toBe(
      '⑦ 负载率 / 面积指标',
    )
    expect(details.find((detail) => detail.key === 'margin')?.stepLabel).toBe(
      '② 总冷负荷 / 设计冷负荷',
    )
    expect(details.find((detail) => detail.key === 'area-index')?.stepLabel).toBe(
      '⑦ 负载率 / 面积指标',
    )
  })

  it('简易输入同样生成完整校核卡', () => {
    const input = createSimpleInput()
    const result = calculateHvacCooling(input)
    expect(result).not.toBeNull()

    const details = buildHvacCheckDetails(input, result!)
    const area = details.find((detail) => detail.key === 'area-index')

    expect(details).toHaveLength(5)
    expect(details.find((detail) => detail.key === 'capacity')?.controlling).toBe(true)
    expect(area?.keyValue).toBe('372 W/m²')
  })
})
