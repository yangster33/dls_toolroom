/**
 * 方案评估与模拟退火（MVP 单目标加权）。
 *
 * 目标：线缆长度 + 走线架长度 - 面积利用率奖励 + 违规罚分。
 * 多起点 4 条链，每链 120 次迭代，取 Top 3 去重方案。
 */
import { buildLayout } from './generator'
import { createRng, type Rng } from './rng'
import type { Genome, LayoutRules, LayoutSolution, RoomParams } from './types'

export function randomGenome(params: RoomParams, rules: LayoutRules, rng: Rng): Genome {
  const maxPerRow = Math.max(1, Math.floor((params.width - 2 * rules.perimeter) / rules.cabinetW))
  const perRow = Math.max(1, Math.min(maxPerRow, rng.int(Math.ceil(maxPerRow * 0.5), maxPerRow)))
  return {
    perRow,
    powerSide: rng.pick(['left', 'right'] as const),
    batterySide: rng.pick(['left', 'right'] as const),
    reservedRatio: Math.round(rng.next() * 20) / 100,
  }
}

export function mutateGenome(
  genome: Genome,
  params: RoomParams,
  rules: LayoutRules,
  rng: Rng,
): Genome {
  const maxPerRow = Math.max(1, Math.floor((params.width - 2 * rules.perimeter) / rules.cabinetW))
  const next: Genome = { ...genome }
  const action = rng.int(0, 4)
  if (action === 0) {
    next.perRow = Math.max(1, Math.min(maxPerRow, next.perRow + (rng.next() < 0.5 ? -1 : 1)))
  } else if (action === 1) {
    next.powerSide = next.powerSide === 'left' ? 'right' : 'left'
  } else if (action === 2) {
    next.batterySide = next.batterySide === 'left' ? 'right' : 'left'
  } else {
    next.reservedRatio =
      Math.round(
        Math.min(0.3, Math.max(0, next.reservedRatio + (rng.next() < 0.5 ? -0.05 : 0.05))) * 100,
      ) / 100
  }
  return next
}

export function generateSolutions(
  params: RoomParams,
  rules: LayoutRules,
  options: { chains?: number; iterations?: number } = {},
): LayoutSolution[] {
  const chains = options.chains ?? 4
  const iterations = options.iterations ?? 120
  const solutions: LayoutSolution[] = []

  for (let chain = 0; chain < chains; chain += 1) {
    const rng = createRng(params.seed + chain * 9973)
    let current = randomGenome(params, rules, rng)
    let currentSolution = buildLayout({ params, rules, genome: current })
    let best = currentSolution
    let temperature = Math.max(1, currentSolution.metrics.score * 0.15)

    for (let i = 0; i < iterations; i += 1) {
      const candidate = mutateGenome(current, params, rules, rng)
      const candidateSolution = buildLayout({ params, rules, genome: candidate })
      const delta = candidateSolution.metrics.score - currentSolution.metrics.score
      if (delta <= 0 || rng.next() < Math.exp(-delta / Math.max(temperature, 1e-6))) {
        current = candidate
        currentSolution = candidateSolution
        if (candidateSolution.metrics.score < best.metrics.score) best = candidateSolution
      }
      temperature *= 0.985
    }
    solutions.push(best)
  }

  const unique = new Map<string, LayoutSolution>()
  for (const solution of solutions) {
    const key = `${solution.genome.perRow}-${solution.genome.powerSide}-${solution.genome.batterySide}-${solution.genome.reservedRatio}`
    const existing = unique.get(key)
    if (!existing || solution.metrics.score < existing.metrics.score) unique.set(key, solution)
  }

  return [...unique.values()]
    .sort((a, b) => Number(b.valid) - Number(a.valid) || a.metrics.score - b.metrics.score)
    .slice(0, 3)
    .map((solution, index) => ({ ...solution, id: `方案 ${index + 1}` }))
}
