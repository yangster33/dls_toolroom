import { describe, it, expect } from 'vitest'
import { generateSolutions } from '../simulatedAnnealing'
import { DEFAULT_RULES } from '../rules'
import { rectInsideRoom, rectsOverlap } from '../geometry'
import type { RoomParams } from '../types'

const BASE: RoomParams = {
  width: 12000,
  depth: 8000,
  shape: 'rect',
  notchW: 3000,
  notchD: 3000,
  cabinetCount: 12,
  powerCount: 3,
  batteryCount: 4,
  acCount: 4,
  seed: 20261109,
  reservedRatio: 0,
}

describe('room_layout 生成器', () => {
  it('同一 seed 生成完全一致的结果（可复现）', () => {
    const a = generateSolutions(BASE, DEFAULT_RULES, { chains: 2, iterations: 20 })
    const b = generateSolutions(BASE, DEFAULT_RULES, { chains: 2, iterations: 20 })
    expect(a.length).toBeGreaterThan(0)
    expect(JSON.stringify(a[0]!.equipment)).toBe(JSON.stringify(b[0]!.equipment))
    expect(a[0]!.metrics).toEqual(b[0]!.metrics)
  })

  it('设备在房间内且互不重叠', () => {
    const solutions = generateSolutions(BASE, DEFAULT_RULES, { chains: 3, iterations: 30 })
    for (const solution of solutions) {
      for (const item of solution.equipment) {
        expect(rectInsideRoom(item, solution.room, solution.outline)).toBe(true)
      }
      for (let i = 0; i < solution.equipment.length; i += 1) {
        for (let j = i + 1; j < solution.equipment.length; j += 1) {
          expect(rectsOverlap(solution.equipment[i]!, solution.equipment[j]!)).toBe(false)
        }
      }
    }
  })

  it('输出 Top 3 以内的方案，并包含机柜、走线架与线缆', () => {
    const solutions = generateSolutions(BASE, DEFAULT_RULES, { chains: 3, iterations: 30 })
    expect(solutions.length).toBeGreaterThan(0)
    expect(solutions.length).toBeLessThanOrEqual(3)
    for (const solution of solutions) {
      expect(solution.rows.length).toBeGreaterThan(0)
      expect(solution.trays.length).toBeGreaterThan(0)
      expect(solution.cables.length).toBeGreaterThan(0)
      expect(solution.metrics.cableLengthM).toBeGreaterThan(0)
      expect(solution.metrics.trayLengthM).toBeGreaterThan(0)
    }
  })

  it('L 形房间不会把设备放进缺口', () => {
    const lRoom: RoomParams = { ...BASE, shape: 'L', cabinetCount: 10 }
    const solutions = generateSolutions(lRoom, DEFAULT_RULES, { chains: 2, iterations: 20 })
    for (const solution of solutions) {
      for (const item of solution.equipment) {
        const inNotch = item.x + item.w > lRoom.width - lRoom.notchW && item.y < lRoom.notchD
        expect(inNotch).toBe(false)
      }
    }
  })

  it('房间过小时给出 warning / invalid，而不是静默产出越界设备', () => {
    const small: RoomParams = { ...BASE, width: 2400, depth: 2400, cabinetCount: 20 }
    const solutions = generateSolutions(small, DEFAULT_RULES, { chains: 1, iterations: 5 })
    expect(solutions.length).toBeGreaterThan(0)
    expect(solutions[0]!.valid).toBe(false)
    expect(solutions[0]!.warnings.length).toBeGreaterThan(0)
  })
})
