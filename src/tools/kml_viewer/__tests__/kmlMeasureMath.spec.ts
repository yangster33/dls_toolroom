import { describe, it, expect } from 'vitest'
import { calculateAngle, formatArea, formatLength, polygonAreaM2 } from '../kmlMeasureMath'

describe('calculateAngle', () => {
  it('直角返回 90°', () => {
    const angle = calculateAngle({ lat: 1, lng: 0 }, { lat: 0, lng: 0 }, { lat: 0, lng: 1 })
    expect(angle).toBeCloseTo(90, 6)
  })

  it('共线反向返回 180°', () => {
    const angle = calculateAngle({ lat: 0, lng: -1 }, { lat: 0, lng: 0 }, { lat: 0, lng: 1 })
    expect(angle).toBeCloseTo(180, 6)
  })
})

describe('polygonAreaM2', () => {
  it('赤道附近 1°×1° 面积约 1.239e10 m²', () => {
    const area = polygonAreaM2([
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 1, lng: 1 },
      { lat: 1, lng: 0 },
    ])
    expect(area).toBeGreaterThan(1.23e10)
    expect(area).toBeLessThan(1.25e10)
  })

  it('少于 3 点返回 0', () => {
    expect(polygonAreaM2([{ lat: 0, lng: 0 }])).toBe(0)
  })
})

describe('formatLength / formatArea', () => {
  it('长度按 km / m 切换', () => {
    expect(formatLength(999)).toBe('999.0 m')
    expect(formatLength(1500)).toBe('1.50 km')
  })

  it('面积按 km² / m² 切换', () => {
    expect(formatArea(999_999)).toBe('999999.0 m²')
    expect(formatArea(2_500_000)).toBe('2.50 km²')
  })
})
