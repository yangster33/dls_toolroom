import { describe, expect, it } from 'vitest'
import {
  calculateBatterySizing,
  createDefaultInput,
  createSimpleInput,
  type BatterySizingInput,
} from '../batterySizing'
import { buildBatterySteps, buildParameterDocs, stepLabel } from '../calculationSteps'

function withInput(overrides: Partial<BatterySizingInput>): BatterySizingInput {
  return { ...createDefaultInput(), ...overrides }
}

function stepsOf(overrides: Partial<BatterySizingInput> = {}) {
  const input = withInput(overrides)
  const result = calculateBatterySizing(input)
  expect(result).not.toBeNull()
  return { input, result: result!, steps: buildBatterySteps(input, result!) }
}

describe('buildBatterySteps · 铅酸', () => {
  it('输出 8 步计算书，顺序与公式正确', () => {
    const { steps } = stepsOf()

    expect(steps.map((step) => step.key)).toEqual([
      'load',
      'current',
      'series',
      'factors',
      'capacity',
      'strings',
      'power',
      'runtime',
    ])
    expect(steps.map((step) => step.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])

    const capacity = steps.find((step) => step.key === 'capacity')
    expect(capacity?.formula).toBe('Q = K × I × T / (η_ah × Kt)')
    expect(capacity?.keyValue).toBe('Q = 237.3 Ah')
    expect(capacity?.substitution).toContain('1.25 × 159.49 × 0.500')
  })

  it('符号带来源标签，容量系数标记为输入并带查表建议', () => {
    const { steps } = stepsOf()
    const factors = steps.find((step) => step.key === 'factors')
    const capacityCoefficient = factors?.symbols.find((symbol) => symbol.symbol === 'η_ah')

    expect(capacityCoefficient?.source).toBe('input')
    expect(capacityCoefficient?.sourceDetail).toContain('0.42')
    expect(factors?.symbols.find((symbol) => symbol.symbol === 'α')?.source).toBe('constant')
    expect(factors?.symbols.find((symbol) => symbol.symbol === 'Kt')?.source).toBe('calc')
  })

  it('容量系数偏离典型表时在备注里说明方向', () => {
    const { steps } = stepsOf({ capacityCoefficient: 0.3 })
    const factors = steps.find((step) => step.key === 'factors')

    expect(factors?.note).toContain('保守')
  })

  it('终止电压超范围时限幅并写进备注', () => {
    const { steps } = stepsOf({ endVoltagePerCell: 2.2 })
    const series = steps.find((step) => step.key === 'series')

    expect(series?.note).toContain('限幅')
  })

  it('未输入厂家 W/单体时该步不出判定', () => {
    const { steps } = stepsOf()
    const power = steps.find((step) => step.key === 'power')

    expect(power?.pass).toBeUndefined()
    expect(power?.symbols.find((symbol) => symbol.symbol === 'W_man')?.source).toBe('default')
  })

  it('输入厂家 W/单体后给出通过判定', () => {
    const { steps } = stepsOf({ manufacturerWPerCell: 450 })
    const power = steps.find((step) => step.key === 'power')

    expect(power?.pass).toBe(true)
    expect(power?.symbols.find((symbol) => symbol.symbol === 'W_man')?.source).toBe('input')
  })
})

describe('buildBatterySteps · 锂电', () => {
  it('输出 6 步，跳过串联与恒功率', () => {
    const { steps } = stepsOf({ batteryType: 'lithium' })

    expect(steps.map((step) => step.key)).toEqual([
      'load',
      'current',
      'energy',
      'capacity',
      'strings',
      'runtime',
    ])
    expect(steps.map((step) => step.index)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('倍率下限与能量法容量都出现在容量步骤里', () => {
    const { steps } = stepsOf({ batteryType: 'lithium' })
    const capacity = steps.find((step) => step.key === 'capacity')

    expect(capacity?.keyValue).toContain('Q_min,C')
    expect(capacity?.substitution).toContain('159.49 / 1.00')
    expect(capacity?.note).toContain('倍率')
  })
})

describe('buildBatterySteps · 简易模式', () => {
  it('容量系数标为查表，并说明按备电时长自动取值', () => {
    const input = createSimpleInput()
    const result = calculateBatterySizing(input)
    expect(result).not.toBeNull()

    const steps = buildBatterySteps(input, result!, { simple: true })
    const factors = steps.find((step) => step.key === 'factors')
    const capacityCoefficient = factors?.symbols.find((symbol) => symbol.symbol === 'η_ah')

    expect(capacityCoefficient?.source).toBe('table')
    expect(capacityCoefficient?.inputSymbol).toBeUndefined()
    expect(capacityCoefficient?.sourceDetail).toContain('简易模式自动取值')
    expect(factors?.note).toContain('简易模式')
  })

  it('专业模式仍标为输入', () => {
    const input = withInput({})
    const result = calculateBatterySizing(input)
    expect(result).not.toBeNull()

    const steps = buildBatterySteps(input, result!)
    const factors = steps.find((step) => step.key === 'factors')

    expect(factors?.symbols.find((symbol) => symbol.symbol === 'η_ah')?.source).toBe('input')
    expect(factors?.note).toContain('典型值')
  })
})

describe('stepLabel', () => {
  it('按序号给出带圈步骤名', () => {
    const { steps } = stepsOf()

    expect(stepLabel(steps[4]!)).toBe('⑤ 所需容量（安时法）')
    expect(stepLabel(steps[7]!)).toBe('⑧ 备电时间与放电倍率')
  })
})

describe('buildParameterDocs', () => {
  it('每个参数都有来源、可修改与依据', () => {
    const docs = buildParameterDocs()

    expect(docs.length).toBeGreaterThan(20)
    for (const doc of docs) {
      expect(doc.symbol.length).toBeGreaterThan(0)
      expect(doc.source.length).toBeGreaterThan(0)
      expect(doc.editable.length).toBeGreaterThan(0)
      expect(doc.basis.length).toBeGreaterThan(0)
    }
  })

  it('容量系数标为输入，α 标为常数', () => {
    const docs = buildParameterDocs()

    expect(docs.find((doc) => doc.symbol === 'η_ah')?.source).toContain('输入')
    expect(docs.find((doc) => doc.symbol === 'α')?.source).toContain('常数')
  })
})
