import { describe, expect, it } from 'vitest'
import {
  calculateDcCabinet,
  createDefaultInput,
  createSimpleInput,
  type DcCabinetInput,
} from '../dcPowerCabinet'
import { buildDcCabinetSteps, buildParameterDocs, stepLabel } from '../calculationSteps'

function withInput(overrides: Partial<DcCabinetInput>): DcCabinetInput {
  return { ...createDefaultInput(), ...overrides }
}

function stepsOf(overrides: Partial<DcCabinetInput> = {}) {
  const input = withInput(overrides)
  const result = calculateDcCabinet(input)
  expect(result).not.toBeNull()
  return { input, result: result!, steps: buildDcCabinetSteps(input, result!) }
}

describe('buildDcCabinetSteps · 专业默认', () => {
  it('输出 8 步计算书，顺序与公式正确', () => {
    const { steps } = stepsOf()

    expect(steps.map((step) => step.key)).toEqual([
      'load',
      'charge',
      'design',
      'future',
      'modules',
      'frame',
      'cabinet',
      'breakers',
    ])
    expect(steps.map((step) => step.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])

    expect(steps[0]?.keyValue).toBe('I_load = 200.0 A')
    expect(steps[1]?.keyValue).toBe('I_charge = 50.0 A')
    expect(steps[2]?.keyValue).toBe('I_design = 250.0 A')
    expect(steps[3]?.keyValue).toBe('I_frame = 325.0 A')
    expect(steps[4]?.keyValue).toBe('3 主用 + 1 备用 = 4 个模块')
    expect(steps[5]?.keyValue).toBe('满架 5 个模块 / 450.0 A')
    expect(steps[6]?.keyValue).toBe('占用 13U，2000 mm / 42U 柜 × 1 面')
    expect(steps[7]?.keyValue).toBe('DC 315 A / AC 32 A')

    expect(steps[2]?.formula).toBe('I_design = I_load + I_charge')
    expect(steps[4]?.formula).toContain('I_module,eff = I_module × derating')
    expect(steps[5]?.formula).toContain('frameModules = frameMainModules + redundantModules')
    expect(steps[6]?.formula).toContain('cabinetCount = max(1')
    expect(steps[7]?.formula).toContain('nextStandardBreaker(I_design × breakerMargin)')
  })

  it('关键代入值来自引擎结果', () => {
    const { steps } = stepsOf()

    expect(steps[1]?.substitution).toContain('500 × 0.10 = 50.00')
    expect(steps[4]?.substitution).toContain('100 × 0.90 = 90.0 A')
    expect(steps[4]?.substitution).toContain('ceil(250.0 / 90.0) = 3')
    expect(steps[6]?.substitution).toContain('requiredU = max(12, 13) = 13U')
    expect(steps[7]?.substitution).toContain('315 = nextStandardBreaker(250.0 × 1.25 = 312.5)')
    expect(steps[7]?.substitution).toContain('20.02 A')
  })

  it('符号带来源标签，输入符号带 inputSymbol', () => {
    const { steps } = stepsOf()
    const modules = steps.find((step) => step.key === 'modules')

    expect(modules?.symbols.find((symbol) => symbol.symbol === 'I_module')?.source).toBe('input')
    expect(modules?.symbols.find((symbol) => symbol.symbol === 'I_module')?.inputSymbol).toBe(
      'I_module',
    )
    expect(modules?.symbols.find((symbol) => symbol.symbol === 'derating')?.source).toBe('input')
    expect(modules?.symbols.find((symbol) => symbol.symbol === 'I_module,eff')?.source).toBe('calc')
    expect(steps[7]?.symbols.find((symbol) => symbol.symbol === 'mainBreakerA')?.source).toBe(
      'table',
    )
    expect(steps[6]?.symbols.find((symbol) => symbol.symbol === 'usableU')?.source).toBe('table')
  })
})

describe('buildDcCabinetSteps · 功率输入', () => {
  it('按功率输入时用 P_load × 1000 / U_dc 折算', () => {
    const { steps } = stepsOf({ loadMode: 'power', loadPowerKw: 9.6 })
    const load = steps.find((step) => step.key === 'load')

    expect(load?.formula).toBe('I_load = P_load × 1000 / U_dc')
    expect(load?.substitution).toContain('9.60 × 1000 / 48')
    expect(load?.symbols.some((symbol) => symbol.symbol === 'P_load')).toBe(true)
    expect(
      load?.symbols.some((symbol) => symbol.symbol === 'I_load' && symbol.source === 'calc'),
    ).toBe(true)
  })
})

describe('buildDcCabinetSteps · 简易输入', () => {
  it('固定值按实际代入值显示，不改变步骤结构', () => {
    const input = createSimpleInput()
    const result = calculateDcCabinet(input)
    expect(result).not.toBeNull()

    const steps = buildDcCabinetSteps(input, result!)

    expect(steps).toHaveLength(8)
    expect(steps[4]?.substitution).toContain('100 × 0.90 = 90.0 A')
    expect(steps[6]?.symbols.find((symbol) => symbol.symbol === 'usableU')?.sourceDetail).toContain(
      '2000 mm',
    )
  })
})

describe('stepLabel', () => {
  it('按序号给出带圈步骤名', () => {
    const { steps } = stepsOf()

    expect(stepLabel(steps[0]!)).toBe('① 负荷电流')
    expect(stepLabel(steps[4]!)).toBe('⑤ 模块数量')
    expect(stepLabel(steps[7]!)).toBe('⑧ 直流主断路器 / 交流输入')
  })
})

describe('buildParameterDocs', () => {
  it('每个参数都有来源、可修改与依据', () => {
    const docs = buildParameterDocs()

    expect(docs.length).toBeGreaterThan(20)
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

  it('核心中间量与常数来源标注清楚', () => {
    const docs = buildParameterDocs()

    expect(docs.find((doc) => doc.symbol === 'I_design')?.source).toContain('计算')
    expect(docs.find((doc) => doc.symbol === 'usableU')?.source).toContain('查表')
    expect(docs.find((doc) => doc.symbol === 'mainBreakerA')?.source).toContain('查表')
    expect(docs.find((doc) => doc.symbol === 'derating')?.editable).toContain('简易模式固定')
  })
})
