import { describe, expect, it } from 'vitest'
import { calculateCableSizing, createDefaultInput, type CableSizingInput } from '../cableSizing'
import { buildCalculationSteps, buildParameterDocs } from '../calculationSteps'

function withInput(overrides: Partial<CableSizingInput>): CableSizingInput {
  return { ...createDefaultInput(), ...overrides }
}

function stepsFor(overrides: Partial<CableSizingInput> = {}) {
  const input = withInput(overrides)
  const result = calculateCableSizing(input)
  expect(result).not.toBeNull()
  return { input, result: result!, steps: buildCalculationSteps(input, result!) }
}

describe('buildCalculationSteps', () => {
  it('默认三相工况生成八步，并包含关键代入值', () => {
    const { steps } = stepsFor()

    expect(steps).toHaveLength(8)
    expect(steps.map((step) => step.key)).toEqual([
      'load',
      'current',
      'factors',
      'ampacity',
      'voltage-drop',
      'thermal',
      'protection',
      'conclusion',
    ])
    expect(steps[0]?.substitution).toContain('30.00 × 0.80')
    expect(steps[1]?.formula).toContain('√3')
    expect(steps[3]?.substitution).toContain('89.0')
    expect(steps[3]?.result).toContain('85.4')
    expect(steps[5]?.substitution).toContain('13.27')
    expect(steps[6]?.pass).toBe(true)
    expect(steps[7]?.result).toContain('16')
  })

  it('单相不出现 √3', () => {
    const { steps } = stepsFor({
      system: 'single-phase',
      voltage: 220,
      powerKw: 3,
      demandFactor: 1,
      powerFactor: 0.9,
      efficiency: 1,
      lengthM: 30,
      ambientTempC: 30,
      shortCircuitKa: 3,
    })

    expect(steps[1]?.formula).not.toContain('√3')
    expect(steps[1]?.formula).toContain('U × cosφ × η')
  })

  it('直流按 U × η 计算电流', () => {
    const { steps } = stepsFor({
      system: 'dc',
      voltage: 48,
      powerKw: 3,
      efficiency: 0.95,
      demandFactor: 1,
      lengthM: 20,
      ambientTempC: 30,
      shortCircuitKa: 3,
    })

    expect(steps[1]?.formula).toContain('U × η')
    expect(steps[1]?.formula).not.toContain('cosφ')
  })

  it('熔断器保护步骤包含 k3', () => {
    const { steps } = stepsFor({
      protectionDevice: 'fuse',
      breakerRatingA: 100,
      demandFactor: 1,
      lengthM: 50,
    })

    expect(steps[6]?.formula).toContain('k3')
    expect(steps[6]?.substitution).toContain('/ 1.10')
  })

  it('符号 chip 能映射回输入控件', () => {
    const { steps } = stepsFor()
    const symbols = steps.flatMap((step) => step.symbols)

    expect(symbols.some((symbol) => symbol.symbol === 'U' && symbol.inputSymbol === 'U')).toBe(true)
    expect(symbols.some((symbol) => symbol.symbol === 'kg' && symbol.inputSymbol === 'G')).toBe(
      true,
    )
  })
})

describe('buildParameterDocs', () => {
  it('覆盖主要符号且字段完整', () => {
    const docs = buildParameterDocs()
    const symbols = docs.map((doc) => doc.symbol)

    expect(symbols).toEqual(expect.arrayContaining(['U', 'Ib', 'Iz', 'k3', 'Isc']))
    for (const doc of docs) {
      expect(doc.name.length).toBeGreaterThan(0)
      expect(doc.meaning.length).toBeGreaterThan(0)
      expect(doc.position.length).toBeGreaterThan(0)
      expect(doc.impact.length).toBeGreaterThan(0)
      expect(doc.basis.length).toBeGreaterThan(0)
    }
  })
})
