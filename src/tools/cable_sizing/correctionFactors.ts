/**
 * 低压电缆载流量修正系数。
 *
 * 依据 GB/T 16895.6-2014 / IEC 60364-5-52 附录 B：
 * - B.52.14 / B.52.15：空气 / 土壤温度修正
 * - B.52.17：空气中成束、单层、托盘、梯架的分组修正
 * - B.52.18：埋地电缆按间距的分组修正
 * - B.52.16：土壤热阻率修正
 * - E.52.1：三次谐波修正
 *
 * 分组系数按“下一个更大的表列回路数”取值（保守），超过表列最大回路数时取最大值。
 */

import type { BuriedSpacing, InstallationMethod, Insulation } from './types'

export type FactorPoint = readonly [value: number, factor: number]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function interpolateFactor(
  table: ReadonlyArray<FactorPoint>,
  value: number,
): { factor: number; clamped: boolean } {
  const first = table[0]
  const last = table[table.length - 1]
  if (!first || !last) return { factor: 1, clamped: true }
  if (value <= first[0]) return { factor: first[1], clamped: value < first[0] }
  if (value >= last[0]) return { factor: last[1], clamped: value > last[0] }

  for (let i = 1; i < table.length; i += 1) {
    const previous = table[i - 1]
    const current = table[i]
    if (!previous || !current) continue
    if (value <= current[0]) {
      const ratio = (value - previous[0]) / (current[0] - previous[0])
      return { factor: previous[1] + ratio * (current[1] - previous[1]), clamped: false }
    }
  }
  return { factor: last[1], clamped: true }
}

export const AIR_TEMPERATURE_FACTORS: Record<Insulation, ReadonlyArray<FactorPoint>> = {
  pvc: [
    [10, 1.22],
    [15, 1.17],
    [20, 1.12],
    [25, 1.06],
    [30, 1.0],
    [35, 0.94],
    [40, 0.87],
    [45, 0.79],
    [50, 0.71],
    [55, 0.61],
    [60, 0.5],
  ],
  xlpe: [
    [10, 1.15],
    [15, 1.12],
    [20, 1.08],
    [25, 1.04],
    [30, 1.0],
    [35, 0.96],
    [40, 0.91],
    [45, 0.87],
    [50, 0.82],
    [55, 0.76],
    [60, 0.71],
    [65, 0.65],
    [70, 0.58],
    [75, 0.5],
    [80, 0.41],
  ],
}

export const SOIL_TEMPERATURE_FACTORS: Record<Insulation, ReadonlyArray<FactorPoint>> = {
  pvc: [
    [10, 1.1],
    [15, 1.05],
    [20, 1.0],
    [25, 0.95],
    [30, 0.89],
    [35, 0.84],
    [40, 0.77],
    [45, 0.71],
    [50, 0.63],
    [55, 0.55],
    [60, 0.45],
  ],
  xlpe: [
    [10, 1.07],
    [15, 1.04],
    [20, 1.0],
    [25, 0.96],
    [30, 0.93],
    [35, 0.89],
    [40, 0.85],
    [45, 0.8],
    [50, 0.76],
    [55, 0.71],
    [60, 0.65],
    [65, 0.6],
    [70, 0.53],
    [75, 0.46],
    [80, 0.38],
  ],
}

export type AirGroupingCategory = 'bunched' | 'singleLayer' | 'tray' | 'ladder'

export interface GroupingPoint {
  count: number
  factor: number
}

/** B.52.17：按敷设方式分行的空气中分组系数 */
export const AIR_GROUPING: Record<AirGroupingCategory, ReadonlyArray<GroupingPoint>> = {
  bunched: [
    { count: 1, factor: 1 },
    { count: 2, factor: 0.8 },
    { count: 3, factor: 0.7 },
    { count: 4, factor: 0.65 },
    { count: 5, factor: 0.6 },
    { count: 6, factor: 0.57 },
    { count: 7, factor: 0.54 },
    { count: 8, factor: 0.52 },
    { count: 9, factor: 0.5 },
    { count: 12, factor: 0.45 },
    { count: 16, factor: 0.41 },
    { count: 20, factor: 0.38 },
  ],
  singleLayer: [
    { count: 1, factor: 1 },
    { count: 2, factor: 0.85 },
    { count: 3, factor: 0.79 },
    { count: 4, factor: 0.75 },
    { count: 5, factor: 0.73 },
    { count: 6, factor: 0.72 },
    { count: 7, factor: 0.72 },
    { count: 8, factor: 0.71 },
    { count: 9, factor: 0.7 },
  ],
  tray: [
    { count: 1, factor: 1 },
    { count: 2, factor: 0.88 },
    { count: 3, factor: 0.82 },
    { count: 4, factor: 0.77 },
    { count: 5, factor: 0.75 },
    { count: 6, factor: 0.73 },
    { count: 7, factor: 0.73 },
    { count: 8, factor: 0.72 },
    { count: 9, factor: 0.72 },
  ],
  ladder: [
    { count: 1, factor: 1 },
    { count: 2, factor: 0.87 },
    { count: 3, factor: 0.82 },
    { count: 4, factor: 0.8 },
    { count: 5, factor: 0.8 },
    { count: 6, factor: 0.79 },
    { count: 7, factor: 0.79 },
    { count: 8, factor: 0.78 },
    { count: 9, factor: 0.78 },
  ],
}

/**
 * B.52.18：埋地电缆（D2 直埋）分组系数。
 * 13～19 回路按 20 回路保守取值。
 */
export const BURIED_GROUPING: Record<BuriedSpacing, ReadonlyArray<GroupingPoint>> = {
  touching: [
    { count: 1, factor: 1 },
    { count: 2, factor: 0.75 },
    { count: 3, factor: 0.65 },
    { count: 4, factor: 0.6 },
    { count: 5, factor: 0.55 },
    { count: 6, factor: 0.5 },
    { count: 7, factor: 0.45 },
    { count: 8, factor: 0.43 },
    { count: 9, factor: 0.41 },
    { count: 12, factor: 0.36 },
    { count: 20, factor: 0.29 },
  ],
  oneDiameter: [
    { count: 1, factor: 1 },
    { count: 2, factor: 0.8 },
    { count: 3, factor: 0.7 },
    { count: 4, factor: 0.6 },
    { count: 5, factor: 0.55 },
    { count: 6, factor: 0.55 },
    { count: 7, factor: 0.51 },
    { count: 8, factor: 0.48 },
    { count: 9, factor: 0.46 },
    { count: 12, factor: 0.42 },
    { count: 20, factor: 0.35 },
  ],
  gap125: [
    { count: 1, factor: 1 },
    { count: 2, factor: 0.85 },
    { count: 3, factor: 0.75 },
    { count: 4, factor: 0.7 },
    { count: 5, factor: 0.65 },
    { count: 6, factor: 0.6 },
    { count: 7, factor: 0.59 },
    { count: 8, factor: 0.57 },
    { count: 9, factor: 0.55 },
    { count: 12, factor: 0.51 },
    { count: 20, factor: 0.44 },
  ],
  gap250: [
    { count: 1, factor: 1 },
    { count: 2, factor: 0.9 },
    { count: 3, factor: 0.8 },
    { count: 4, factor: 0.75 },
    { count: 5, factor: 0.7 },
    { count: 6, factor: 0.7 },
    { count: 7, factor: 0.67 },
    { count: 8, factor: 0.65 },
    { count: 9, factor: 0.63 },
    { count: 12, factor: 0.59 },
    { count: 20, factor: 0.53 },
  ],
  gap500: [
    { count: 1, factor: 1 },
    { count: 2, factor: 0.9 },
    { count: 3, factor: 0.85 },
    { count: 4, factor: 0.8 },
    { count: 5, factor: 0.8 },
    { count: 6, factor: 0.8 },
    { count: 7, factor: 0.76 },
    { count: 8, factor: 0.75 },
    { count: 9, factor: 0.74 },
    { count: 12, factor: 0.71 },
    { count: 20, factor: 0.66 },
  ],
}

export function airGroupingCategory(method: InstallationMethod): AirGroupingCategory | null {
  switch (method) {
    case 'A1':
    case 'A2':
    case 'B1':
    case 'B2':
      return 'bunched'
    case 'C':
      return 'singleLayer'
    case 'E':
    case 'F':
      return 'tray'
    case 'G':
      return 'ladder'
    case 'D':
      return null
  }
}

function lookupGrouping(points: ReadonlyArray<GroupingPoint>, count: number): number {
  if (count <= 1) return 1
  for (const point of points) {
    if (count <= point.count) return point.factor
  }
  return points[points.length - 1]?.factor ?? 1
}

export function airGroupingFactor(category: AirGroupingCategory, count: number): number {
  return lookupGrouping(AIR_GROUPING[category], count)
}

export function buriedGroupingFactor(spacing: BuriedSpacing, count: number): number {
  const points = BURIED_GROUPING[spacing] ?? BURIED_GROUPING.touching
  return lookupGrouping(points, count)
}

/** B.52.16：直埋电缆土壤热阻率修正（基准 2.5 K·m/W） */
export const SOIL_RESISTIVITY_FACTORS: ReadonlyArray<FactorPoint> = [
  [0.5, 1.88],
  [0.7, 1.62],
  [1.0, 1.5],
  [1.5, 1.28],
  [2.0, 1.12],
  [2.5, 1.0],
  [3.0, 0.9],
]

export function soilResistivityFactor(rho: number): { factor: number; clamped: boolean } {
  return interpolateFactor(SOIL_RESISTIVITY_FACTORS, clamp(rho, 0.5, 3.0))
}

export interface HarmonicCorrection {
  factor: number
  neutralBased: boolean
  /** 中性线电流相对相电流的倍数（3 × h3） */
  neutralMultiplier: number
}

/** E.52.1：三次谐波修正 */
export function harmonicFactor(thdPercent: number): HarmonicCorrection {
  const h = clamp(thdPercent, 0, 100)
  if (h <= 15) return { factor: 1, neutralBased: false, neutralMultiplier: 0 }
  if (h <= 33) return { factor: 0.86, neutralBased: false, neutralMultiplier: 0 }
  const neutralMultiplier = (3 * h) / 100
  if (h <= 45) return { factor: 0.86, neutralBased: true, neutralMultiplier }
  return { factor: 1, neutralBased: true, neutralMultiplier }
}
