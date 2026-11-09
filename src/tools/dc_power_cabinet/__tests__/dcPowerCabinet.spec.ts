import { describe, expect, it } from 'vitest'
import {
  calculateDcCabinet,
  createDefaultInput,
  nextStandardBreaker,
  usableUForHeight,
  voltageLabelFor,
  type DcCabinetInput,
} from '../dcPowerCabinet'

function withInput(overrides: Partial<DcCabinetInput>): DcCabinetInput {
  return { ...createDefaultInput(), ...overrides }
}

describe('calculateDcCabinet', () => {
  it('默认按近期负荷 + 均充电流计算 N+1 模块与柜体', () => {
    const result = calculateDcCabinet(withInput({}))

    expect(result).not.toBeNull()
    expect(result!.loadCurrentA).toBeCloseTo(200, 6)
    expect(result!.chargeCurrentA).toBeCloseTo(50, 6)
    expect(result!.designCurrentA).toBeCloseTo(250, 6)
    expect(result!.frameCurrentA).toBeCloseTo(325, 6)
    expect(result!.moduleEffectiveA).toBeCloseTo(90, 6)
    expect(result!.mainModules).toBe(3)
    expect(result!.redundantModules).toBe(1)
    expect(result!.totalModules).toBe(4)
    expect(result!.installedNameplateA).toBe(400)
    expect(result!.installedEffectiveA).toBe(360)
    expect(result!.frameModules).toBe(5)
    expect(result!.frameCapacityA).toBe(450)
    expect(result!.requiredU).toBe(13)
    expect(result!.cabinetCount).toBe(1)
    expect(result!.recommendedHeightMm).toBe(2000)
    expect(result!.mainBreakerA).toBe(315)
    expect(result!.overallPass).toBe(true)
  })

  it('按功率输入时与电流输入等效', () => {
    const byCurrent = calculateDcCabinet(withInput({ loadMode: 'current', loadCurrentA: 200 }))
    const byPower = calculateDcCabinet(withInput({ loadMode: 'power', loadPowerKw: 9.6 }))

    expect(byCurrent).not.toBeNull()
    expect(byPower).not.toBeNull()
    expect(byPower!.loadCurrentA).toBeCloseTo(byCurrent!.loadCurrentA, 6)
    expect(byPower!.totalModules).toBe(byCurrent!.totalModules)
  })

  it('N+2 比 N+1 多一个备用模块', () => {
    const n1 = calculateDcCabinet(withInput({ redundancy: 'N+1' }))
    const n2 = calculateDcCabinet(withInput({ redundancy: 'N+2' }))

    expect(n1).not.toBeNull()
    expect(n2).not.toBeNull()
    expect(n2!.redundantModules).toBe(2)
    expect(n2!.totalModules).toBe(n1!.totalModules + 1)
    expect(n2!.installedNameplateA).toBe(n1!.installedNameplateA + 100)
  })

  it('远期负荷增长会抬高满架模块数', () => {
    const normal = calculateDcCabinet(withInput({ futureGrowth: 1.3 }))
    const future = calculateDcCabinet(withInput({ futureGrowth: 2 }))

    expect(normal).not.toBeNull()
    expect(future).not.toBeNull()
    expect(future!.frameCurrentA).toBeGreaterThan(normal!.frameCurrentA)
    expect(future!.frameModules).toBeGreaterThan(normal!.frameModules)
    expect(future!.frameCapacityA).toBeGreaterThan(normal!.frameCapacityA)
  })

  it('不配置电池时均充电流为 0', () => {
    const result = calculateDcCabinet(withInput({ batteryAh: 0 }))

    expect(result).not.toBeNull()
    expect(result!.chargeCurrentA).toBe(0)
    expect(result!.designCurrentA).toBeCloseTo(200, 6)
    expect(result!.warnings.some((warning) => warning.includes('未填写蓄电池容量'))).toBe(true)
  })

  it('大负荷时单柜装不下会建议多柜', () => {
    const result = calculateDcCabinet(
      withInput({
        loadCurrentA: 2000,
        batteryAh: 0,
        moduleDerating: 1,
        moduleCurrentA: 100,
        futureGrowth: 1.3,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.totalModules).toBe(21)
    expect(result!.frameModules).toBe(27)
    expect(result!.cabinetCount).toBeGreaterThan(1)
    expect(result!.recommendedCount).toBeGreaterThan(1)
  })

  it('所选柜高不足时会增加柜数而不是硬塞', () => {
    const result = calculateDcCabinet(
      withInput({
        loadCurrentA: 2000,
        batteryAh: 0,
        moduleDerating: 1,
        moduleCurrentA: 100,
        cabinetHeightMm: 1600,
      }),
    )

    expect(result).not.toBeNull()
    expect(result!.usableU).toBe(32)
    expect(result!.cabinetCount).toBe(2)
    const uCheck = result!.checks.find((check) => check.key === 'u-height')
    expect(uCheck).toBeDefined()
    expect(uCheck!.pass).toBe(true)
  })

  it('无效输入返回 null', () => {
    expect(calculateDcCabinet(withInput({ dcVoltage: 0 }))).toBeNull()
    expect(calculateDcCabinet(withInput({ loadCurrentA: 0 }))).toBeNull()
    expect(calculateDcCabinet(withInput({ futureGrowth: 0.9 }))).toBeNull()
    expect(calculateDcCabinet(withInput({ moduleCurrentA: 0 }))).toBeNull()
    expect(calculateDcCabinet(withInput({ moduleDerating: 0 }))).toBeNull()
    expect(calculateDcCabinet(withInput({ acPowerFactor: 0 }))).toBeNull()
    expect(calculateDcCabinet(withInput({ rectifierEfficiency: 0 }))).toBeNull()
  })
})

describe('辅助函数', () => {
  it('电压标签', () => {
    expect(voltageLabelFor(48)).toBe('-48V')
    expect(voltageLabelFor(24)).toBe('-24V')
    expect(voltageLabelFor(240)).toBe('240V')
  })

  it('向上取标准断路器', () => {
    expect(nextStandardBreaker(312.5)).toBe(315)
    expect(nextStandardBreaker(20.1)).toBe(25)
    expect(nextStandardBreaker(5000)).toBe(4000)
  })

  it('柜高对应可用 U 数', () => {
    expect(usableUForHeight(1600)).toBe(32)
    expect(usableUForHeight(2000)).toBe(42)
    expect(usableUForHeight(2200)).toBe(46)
    expect(usableUForHeight(2600)).toBe(54)
  })
})
