import { describe, expect, it } from 'vitest'
import {
  calculateDcCabinet,
  createDefaultInput,
  createSimpleInput,
  type DcCabinetInput,
} from '../dcPowerCabinet'
import { buildDcCabinetCheckDetails } from '../checkDetails'

function withInput(overrides: Partial<DcCabinetInput>): DcCabinetInput {
  return { ...createDefaultInput(), ...overrides }
}

function detailsOf(overrides: Partial<DcCabinetInput> = {}) {
  const input = withInput(overrides)
  const result = calculateDcCabinet(input)
  expect(result).not.toBeNull()
  return { input, result: result!, details: buildDcCabinetCheckDetails(input, result!) }
}

describe('buildDcCabinetCheckDetails', () => {
  it('列出 7 条引擎校核，另补模块降额与均充两行', () => {
    const { details } = detailsOf()

    expect(details.map((detail) => detail.key)).toEqual([
      'capacity',
      'redundancy',
      'frame',
      'module-slots',
      'u-height',
      'dc-breaker',
      'ac-breaker',
      'derating',
      'charge',
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

  it('默认由整流容量 / 冗余 / 满架控制，槽位与 U 位不控制', () => {
    const { details } = detailsOf()

    expect(details.find((detail) => detail.key === 'capacity')?.controlling).toBe(true)
    expect(details.find((detail) => detail.key === 'redundancy')?.controlling).toBe(true)
    expect(details.find((detail) => detail.key === 'frame')?.controlling).toBe(true)
    expect(details.find((detail) => detail.key === 'module-slots')?.controlling).toBe(false)
    expect(details.find((detail) => detail.key === 'u-height')?.controlling).toBe(false)
  })

  it('裕度按引擎结果计算，控制项写进“为什么”', () => {
    const { details } = detailsOf()
    const capacity = details.find((detail) => detail.key === 'capacity')
    const frame = details.find((detail) => detail.key === 'frame')
    const slots = details.find((detail) => detail.key === 'module-slots')

    expect(capacity?.margin).toBe('+110.0 A')
    expect(capacity?.why).toContain('控制项')
    expect(frame?.margin).toBe('+125.0 A')
    expect(slots?.margin).toBe('+19 个')
    expect(slots?.why).toContain('未控制最终容量')
    expect(slots?.why).toContain('整流容量')
  })

  it('多柜时模块槽位成为控制项，U 位不控制', () => {
    const { details } = detailsOf({
      loadCurrentA: 2000,
      batteryAh: 0,
      moduleDerating: 1,
      moduleCurrentA: 100,
      futureGrowth: 1.3,
    })
    const slots = details.find((detail) => detail.key === 'module-slots')
    const uHeight = details.find((detail) => detail.key === 'u-height')

    expect(slots?.controlling).toBe(true)
    expect(slots?.why).toContain('控制项')
    expect(uHeight?.controlling).toBe(false)
  })

  it('U 位不足时柜内 U 位成为控制项', () => {
    const { details } = detailsOf({ reserveU: 100 })
    const slots = details.find((detail) => detail.key === 'module-slots')
    const uHeight = details.find((detail) => detail.key === 'u-height')

    expect(uHeight?.controlling).toBe(true)
    expect(uHeight?.why).toContain('控制项')
    expect(slots?.controlling).toBe(false)
  })

  it('断路器行给出标准壳架与选择性校验提示', () => {
    const { details } = detailsOf()
    const dc = details.find((detail) => detail.key === 'dc-breaker')
    const ac = details.find((detail) => detail.key === 'ac-breaker')

    expect(dc?.pass).toBe(true)
    expect(dc?.keyValue).toBe('315 A')
    expect(dc?.margin).toContain('+')
    expect(dc?.why).toContain('标准壳架')
    expect(ac?.pass).toBe(true)
    expect(ac?.keyValue).toBe('32 A')
    expect(ac?.why).toContain('标准壳架')
  })

  it('模块降额与均充两行把系数关联到计算书', () => {
    const { details } = detailsOf()
    const derating = details.find((detail) => detail.key === 'derating')
    const charge = details.find((detail) => detail.key === 'charge')

    expect(derating?.keyValue).toBe('I_module,eff = 90.0 A')
    expect(derating?.formula).toBe('I_module,eff = I_module × derating')
    expect(derating?.stepLabel).toBe('⑤ 模块数量')
    expect(charge?.keyValue).toBe('I_charge = 50.0 A')
    expect(charge?.substitution).toBe('500 × 0.10 = 50.0 A')
    expect(charge?.stepLabel).toBe('② 均充电流')
  })

  it('降额过低与均充倍率偏高时给出不通过理由', () => {
    const { details } = detailsOf({ moduleDerating: 0.8, chargeRate: 0.2 })
    const derating = details.find((detail) => detail.key === 'derating')
    const charge = details.find((detail) => detail.key === 'charge')

    expect(derating?.pass).toBe(false)
    expect(derating?.why).toContain('不满足')
    expect(charge?.pass).toBe(false)
    expect(charge?.why).toContain('不满足')
  })

  it('简易输入同样生成完整校核卡', () => {
    const input = createSimpleInput()
    const result = calculateDcCabinet(input)
    expect(result).not.toBeNull()

    const details = buildDcCabinetCheckDetails(input, result!)
    const uHeight = details.find((detail) => detail.key === 'u-height')

    expect(details).toHaveLength(9)
    expect(uHeight?.required).toBe('≤ 42U × 1 柜')
    expect(uHeight?.stepLabel).toBe('⑦ 柜体 U 位 / 柜数')
  })
})
