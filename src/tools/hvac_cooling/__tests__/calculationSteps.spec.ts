import { describe, expect, it } from 'vitest'
import {
  calculateHvacCooling,
  createDefaultInput,
  createSimpleInput,
  type HvacCoolingInput,
} from '../hvacCooling'
import { buildHvacSteps, buildParameterDocs, stepLabel } from '../calculationSteps'

function withInput(overrides: Partial<HvacCoolingInput>): HvacCoolingInput {
  return { ...createDefaultInput(), ...overrides }
}

function stepsOf(overrides: Partial<HvacCoolingInput> = {}) {
  const input = withInput(overrides)
  const result = calculateHvacCooling(input)
  expect(result).not.toBeNull()
  return { input, result: result!, steps: buildHvacSteps(input, result!) }
}

describe('buildHvacSteps · 专业默认（详细法）', () => {
  it('输出 8 步计算书，顺序与公式正确', () => {
    const { steps } = stepsOf()

    expect(steps.map((step) => step.key)).toEqual([
      'load-items',
      'design-load',
      'required',
      'sensible',
      'units',
      'sensible-check',
      'load-rate',
      'conversion',
    ])
    expect(steps.map((step) => step.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])

    expect(steps[0]?.keyValue).toBe('Q_total = 37.24 kW')
    expect(steps[1]?.keyValue).toBe('Q_design = 42.83 kW')
    expect(steps[2]?.keyValue).toBe('Q_req = 42.83 kW')
    expect(steps[3]?.keyValue).toBe('Q_sensible = 38.54 kW / Q_latent = 4.28 kW')
    expect(steps[4]?.keyValue).toBe('2 运行 + 1 备用 × 25.0 kW = 75.0 kW')
    expect(steps[5]?.keyValue).toBe('Q_sensible,unit = 45.00 kW')
    expect(steps[6]?.keyValue).toBe('η_load = 85.7%；q_A = 372 W/m²')
    expect(steps[7]?.keyValue).toBe('17.1 P / 12.2 RT')

    expect(steps[0]?.formula).toContain('Q_IT = P_IT × K_heat')
    expect(steps[1]?.formula).toBe('Q_design = Q_total × (1 + K_margin)')
    expect(steps[2]?.formula).toBe('Q_req = Q_design / K_corr')
    expect(steps[4]?.formula).toContain('N_run,auto')
    expect(steps[4]?.formula).toContain('Q_unit = nextStandardUnitKw')
    expect(steps[5]?.formula).toContain('Q_sensible,unit = Q_run × SHR_unit')
    expect(steps[6]?.formula).toContain('η_load = Q_req / Q_run')
    expect(steps[7]?.formula).toContain('RT = Q_req / 3.517')
  })

  it('关键代入值来自引擎结果', () => {
    const { steps } = stepsOf()

    expect(steps[0]?.substitution).toContain('通信 / IT 设备散热')
    expect(steps[0]?.substitution).toContain('Q_total = 37.24 kW')
    expect(steps[1]?.substitution).toBe('= 37.24 × (1 + 0.15) = 42.83 kW')
    expect(steps[2]?.substitution).toBe('= 42.83 / 1.00 = 42.83 kW')
    expect(steps[4]?.substitution).toContain(
      'nextStandardUnitKw(42.83 / (2 × 0.9) = 23.79) = 25.0 kW',
    )
    expect(steps[4]?.substitution).toContain('Q_run = 2 × 25.0 = 50.0 kW')
    expect(steps[5]?.substitution).toContain('50.00 × 0.90 = 45.00 kW ≥ 38.54 kW（通过）')
    expect(steps[6]?.substitution).toContain('42.83 / 50.00 = 85.7%')
    expect(steps[6]?.substitution).toContain('37.24 × 1000 / 100 = 372 W/m²')
    expect(steps[7]?.substitution).toContain('42.83 / 2.500 = 17.13 P')
    expect(steps[7]?.substitution).toContain('= 12.18 RT')
  })

  it('符号带来源标签，输入符号带 inputSymbol', () => {
    const { steps } = stepsOf()
    const load = steps.find((step) => step.key === 'load-items')
    const units = steps.find((step) => step.key === 'units')
    const conversion = steps.find((step) => step.key === 'conversion')

    expect(load?.symbols.find((symbol) => symbol.symbol === 'P_IT')?.source).toBe('input')
    expect(load?.symbols.find((symbol) => symbol.symbol === 'P_IT')?.inputSymbol).toBe('P_IT')
    expect(load?.symbols.find((symbol) => symbol.symbol === 'K_heat')?.inputSymbol).toBe('K_heat')
    expect(load?.symbols.find((symbol) => symbol.symbol === 'Q_total')?.source).toBe('calc')
    expect(units?.symbols.find((symbol) => symbol.symbol === 'Q_unit')?.source).toBe('table')
    expect(units?.symbols.find((symbol) => symbol.symbol === 'N_run')?.source).toBe('calc')
    expect(units?.symbols.find((symbol) => symbol.symbol === 'redundancy')?.inputSymbol).toBe(
      'redundancy',
    )
    expect(conversion?.symbols.find((symbol) => symbol.symbol === 'p_basis')?.source).toBe('input')
    expect(conversion?.symbols.find((symbol) => symbol.symbol === '3.517')?.source).toBe('constant')
  })

  it('显冷量与负载率步骤带通过状态，默认显冷量不控制', () => {
    const { steps } = stepsOf()
    const sensible = steps.find((step) => step.key === 'sensible-check')
    const loadRate = steps.find((step) => step.key === 'load-rate')

    expect(sensible?.pass).toBe(true)
    expect(sensible?.controlling).toBe(false)
    expect(loadRate?.pass).toBe(true)
  })
})

describe('buildHvacSteps · 面积法', () => {
  it('第一步按面积指标分支，只列一个分项', () => {
    const { result, steps } = stepsOf({ calculationMode: 'area' })
    const load = steps.find((step) => step.key === 'load-items')

    expect(result.loadItems).toHaveLength(1)
    expect(load?.formula).toBe('Q_total = q_A × A / 1000')
    expect(load?.substitution).toBe('= 400 W/m² × 100 m² / 1000 = 40.00 kW')
    expect(load?.keyValue).toBe('Q_total = 40.00 kW')
    expect(load?.symbols.some((symbol) => symbol.symbol === 'q_A')).toBe(true)
    expect(load?.note).toContain('面积指标法')
  })
})

describe('buildHvacSteps · 简易输入', () => {
  it('固定值按实际代入值显示，不改变步骤结构', () => {
    const input = createSimpleInput()
    const result = calculateHvacCooling(input)
    expect(result).not.toBeNull()

    const steps = buildHvacSteps(input, result!)

    expect(steps).toHaveLength(8)
    expect(steps[0]?.keyValue).toBe('Q_total = 37.24 kW')
    expect(steps[4]?.substitution).toContain(
      'nextStandardUnitKw(42.83 / (2 × 0.9) = 23.79) = 25.0 kW',
    )
    expect(steps[7]?.symbols.find((symbol) => symbol.symbol === 'p_basis')?.value).toBe(
      '2.500 kW/P',
    )
  })
})

describe('buildHvacSteps · 显冷量不足', () => {
  it('显冷量步骤标记不通过与控制项', () => {
    const { steps } = stepsOf({ unitType: 'comfort', unitSensibleRatio: 0.75 })
    const sensible = steps.find((step) => step.key === 'sensible-check')

    expect(sensible?.pass).toBe(false)
    expect(sensible?.controlling).toBe(true)
    expect(sensible?.substitution).toContain('不通过')
  })
})

describe('stepLabel', () => {
  it('按序号给出带圈步骤名', () => {
    const { steps } = stepsOf()

    expect(stepLabel(steps[0]!)).toBe('① 冷负荷分项')
    expect(stepLabel(steps[4]!)).toBe('⑤ 机组台数 / 单台容量')
    expect(stepLabel(steps[7]!)).toBe('⑧ 匹数 / RT 换算')
  })
})

describe('buildParameterDocs', () => {
  it('每个参数都有来源、可修改与依据', () => {
    const docs = buildParameterDocs()

    expect(docs.length).toBeGreaterThan(30)
    for (const doc of docs) {
      expect(doc.symbol.length).toBeGreaterThan(0)
      expect(doc.name.length).toBeGreaterThan(0)
      expect(doc.meaning.length).toBeGreaterThan(0)
      expect(doc.position.length).toBeGreaterThan(0)
      expect(doc.impact.length).toBeGreaterThan(0)
      expect(doc.source.length).toBeGreaterThan(0)
      expect(doc.editable.length).toBeGreaterThan(0)
      expect(doc.basis.length).toBeGreaterThan(0)
    }
  })

  it('核心中间量与简易固定值来源标注清楚', () => {
    const docs = buildParameterDocs()

    expect(docs.find((doc) => doc.symbol === 'Q_total')?.source).toContain('计算')
    expect(docs.find((doc) => doc.symbol === 'q_A')?.source).toContain('查表')
    expect(docs.find((doc) => doc.symbol === 'q_A')?.editable).toContain('简易模式')
    expect(docs.find((doc) => doc.symbol === 'SHR_unit')?.editable).toContain('简易模式')
    expect(docs.find((doc) => doc.symbol === 'p_basis')?.editable).toContain('简易模式')
    expect(docs.find((doc) => doc.symbol === 'Q_unit,max')?.source).toContain('常数')
  })
})
