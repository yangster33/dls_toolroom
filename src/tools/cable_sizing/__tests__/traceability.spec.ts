import { describe, expect, it } from 'vitest'
import { calculateCableSizing, createDefaultInput, type CableSizingInput } from '../cableSizing'
import {
  describeBreaker,
  describeGroupingFactor,
  describeHarmonicFactor,
  describeResistance,
  describeSoilFactor,
  describeTemperatureFactor,
  describeThermalK,
} from '../traceability'

function withInput(overrides: Partial<CableSizingInput>): CableSizingInput {
  return { ...createDefaultInput(), ...overrides }
}

describe('describeTemperatureFactor', () => {
  it('表点直接取值', () => {
    const info = describeTemperatureFactor('xlpe', 'air', 35)

    expect(info.table).toBe('B.52.14')
    expect(info.factor).toBe(0.96)
    expect(info.interpolated).toBe(false)
    expect(info.expression).toContain('正好是表点')
    expect(info.points).toHaveLength(2)
  })

  it('两点之间线性插值', () => {
    const info = describeTemperatureFactor('xlpe', 'air', 33)

    expect(info.interpolated).toBe(true)
    expect(info.factor).toBeCloseTo(0.976, 3)
    expect(info.expression).toContain('(33 - 30)')
  })

  it('超出范围按边界值', () => {
    const info = describeTemperatureFactor('pvc', 'air', 0)

    expect(info.clamped).toBe(true)
    expect(info.factor).toBe(1.22)
    expect(info.expression).toContain('超出表范围')
  })
})

describe('describeGroupingFactor', () => {
  it('空气按敷设方式查 B.52.17', () => {
    const info = describeGroupingFactor('C', 6, 'touching', false)

    expect(info.table).toBe('B.52.17')
    expect(info.factor).toBe(0.72)
    expect(info.rowLabel).toContain('单层')
  })

  it('埋地按间距查 B.52.18', () => {
    const info = describeGroupingFactor('D', 6, 'touching', true)

    expect(info.table).toBe('B.52.18')
    expect(info.factor).toBe(0.5)
    expect(info.rowLabel).toContain('相触')
  })
})

describe('describeSoilFactor', () => {
  it('埋地按表 B.52.16 取值', () => {
    const info = describeSoilFactor(3, true)

    expect(info.applicable).toBe(true)
    expect(info.table).toBe('B.52.16')
    expect(info.factor).toBe(0.9)
  })

  it('非埋地不适用', () => {
    const info = describeSoilFactor(2.5, false)

    expect(info.applicable).toBe(false)
    expect(info.expression).toContain('非埋地')
  })
})

describe('describeHarmonicFactor', () => {
  it('按 h3 分档', () => {
    expect(describeHarmonicFactor(10)).toMatchObject({ band: '0–15%', factor: 1 })
    expect(describeHarmonicFactor(20)).toMatchObject({ band: '15–33%', factor: 0.86 })
    expect(describeHarmonicFactor(40)).toMatchObject({ band: '33–45%', neutralBased: true })
    expect(describeHarmonicFactor(50)).toMatchObject({ band: '>45%', factor: 1 })
  })
})

describe('describeResistance', () => {
  it('显示 ρθ 与 R 的推导', () => {
    const input = withInput({})
    const result = calculateCableSizing(input)

    expect(result).not.toBeNull()
    const info = describeResistance(input, result!)
    expect(info.expression).toContain('ρθ')
    expect(info.expression).toContain('0.02198')
    expect(info.resistanceMilliohm).toBeCloseTo(1.374, 3)
  })
})

describe('describeThermalK', () => {
  it('按材料/绝缘查 k', () => {
    expect(describeThermalK('cu', 'xlpe').k).toBe(143)
    expect(describeThermalK('al', 'pvc').k).toBe(76)
  })
})

describe('describeBreaker', () => {
  it('自动匹配显示规则', () => {
    const result = calculateCableSizing(withInput({ demandFactor: 1, lengthM: 50 }))

    expect(result).not.toBeNull()
    const info = describeBreaker(result!)
    expect(info.auto).toBe(true)
    expect(info.rule).toContain('最小标准壳架')
  })

  it('熔断器显示 k3 规则', () => {
    const result = calculateCableSizing(
      withInput({ protectionDevice: 'fuse', breakerRatingA: 100, demandFactor: 1, lengthM: 50 }),
    )

    expect(result).not.toBeNull()
    const info = describeBreaker(result!)
    expect(info.fuseK3).toBe(1.1)
    expect(info.fuseRule).toContain('k3')
  })
})
