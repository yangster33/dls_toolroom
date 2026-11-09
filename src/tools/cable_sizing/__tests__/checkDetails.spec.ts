import { describe, expect, it } from 'vitest'
import { calculateCableSizing, createDefaultInput, type CableSizingInput } from '../cableSizing'
import { buildCheckDetails } from '../checkDetails'

function withInput(overrides: Partial<CableSizingInput>): CableSizingInput {
  return { ...createDefaultInput(), ...overrides }
}

function detailsFor(overrides: Partial<CableSizingInput> = {}) {
  const input = withInput(overrides)
  const result = calculateCableSizing(input)
  expect(result).not.toBeNull()
  return buildCheckDetails(input, result!)
}

describe('buildCheckDetails', () => {
  it('默认三相生成载流量/谐波/压降/热稳定/机械/保护六行', () => {
    const details = detailsFor()

    expect(details.map((detail) => detail.key)).toEqual([
      'ampacity',
      'harmonic',
      'voltage-drop',
      'thermal',
      'mechanical',
      'protection',
    ])
    for (const detail of details) {
      expect(detail.formula.length).toBeGreaterThan(0)
      expect(detail.substitution.length).toBeGreaterThan(0)
      expect(detail.margin.length).toBeGreaterThan(0)
      expect(detail.symbols.length).toBeGreaterThan(0)
      expect(detail.symbols.every((symbol) => symbol.source.length > 0)).toBe(true)
    }
  })

  it('h3=0 时谐波行显示不修正', () => {
    const harmonic = detailsFor({ harmonicThdPercent: 0 }).find(
      (detail) => detail.key === 'harmonic',
    )

    expect(harmonic?.keyValue).toBe('kh = 1.00')
    expect(harmonic?.pass).toBe(true)
    expect(harmonic?.controlling).toBe(false)
    expect(harmonic?.why).toContain('不修正')
  })

  it('h3=20 时 kh=0.86', () => {
    const harmonic = detailsFor({ harmonicThdPercent: 20 }).find(
      (detail) => detail.key === 'harmonic',
    )

    expect(harmonic?.keyValue).toBe('kh = 0.86')
    expect(harmonic?.why).toContain('0.86')
  })

  it('h3=40 时按中性线电流选型', () => {
    const harmonic = detailsFor({ harmonicThdPercent: 40 }).find(
      (detail) => detail.key === 'harmonic',
    )

    expect(harmonic?.keyValue).toContain('IN =')
    expect(harmonic?.why).toContain('中性线')
    expect(harmonic?.symbols.some((symbol) => symbol.symbol === 'IN')).toBe(true)
  })

  it('控制项标记、裕度和计算书步骤', () => {
    const details = detailsFor()
    const thermal = details.find((detail) => detail.key === 'thermal')

    expect(thermal?.controlling).toBe(true)
    expect(thermal?.margin).toContain('+')
    expect(thermal?.stepKey).toBe('thermal')
    expect(thermal?.stepLabel).toContain('短路热稳定')
  })

  it('电机启动开启时增加一行且不控制截面', () => {
    const details = detailsFor({ motorStarting: true })
    const motor = details.find((detail) => detail.key === 'motor-start')

    expect(motor).toBeDefined()
    expect(motor?.controlling).toBe(false)
    expect(motor?.pass).toBe(true)
  })

  it('直流不生成谐波行', () => {
    const details = detailsFor({ system: 'dc' })

    expect(details.some((detail) => detail.key === 'harmonic')).toBe(false)
  })
})
