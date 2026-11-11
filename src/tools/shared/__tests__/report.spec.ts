import { describe, expect, it } from 'vitest'
import type { CalcStep } from '../calcTrace'
import { formatCheckLines, formatStepLines } from '../report'

function step(overrides: Partial<CalcStep> = {}): CalcStep {
  return {
    key: 'load',
    index: 1,
    title: '负荷功率',
    keyValue: 'P = 72.00 kW',
    formula: 'P = S × K_load × cosφ',
    substitution: '= 100 × 0.8 × 0.9 = 72.00 kW',
    result: 'P = 72.00 kW',
    symbols: [],
    ...overrides,
  }
}

describe('formatStepLines', () => {
  it('每步三行：标题+公式、代入、结果', () => {
    expect(formatStepLines([step()])).toEqual([
      '1. 负荷功率：P = S × K_load × cosφ',
      '   代入：= 100 × 0.8 × 0.9 = 72.00 kW',
      '   结果：P = 72.00 kW',
    ])
  })

  it('多行公式用分号压成一行', () => {
    const lines = formatStepLines([step({ formula: 'A = B\nC = D' })])

    expect(lines[0]).toBe('1. 负荷功率：A = B；C = D')
  })
})

describe('formatCheckLines', () => {
  const checks = [
    { label: '安时容量', pass: true, required: '≥ 237 Ah', actual: '250 Ah' },
    { label: '恒功率', pass: false, required: '≥ 398 W', actual: '100 W' },
  ]

  it('默认“通过 / 不通过”', () => {
    expect(formatCheckLines(checks)).toEqual([
      '- 安时容量：通过；要求 ≥ 237 Ah；实际 250 Ah',
      '- 恒功率：不通过；要求 ≥ 398 W；实际 100 W',
    ])
  })

  it('可自定义结论用词', () => {
    expect(formatCheckLines(checks, { fail: '复核' })[1]).toContain('：复核；')
  })
})
