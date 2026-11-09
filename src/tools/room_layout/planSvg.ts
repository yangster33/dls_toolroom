/**
 * 机房平面图 SVG 渲染（分层、可导出）。
 * 所有几何坐标 mm，通过 viewBox 缩放；不依赖 Vue，便于单测与导出。
 */
import type { Equipment, LayoutSolution, Point } from './types'

export interface PlanViewOptions {
  zones?: boolean
  equipment?: boolean
  trays?: boolean
  cables?: boolean
  labels?: boolean
  dimensions?: boolean
  titleBlock?: boolean
}

const COLORS: Record<Equipment['kind'], string> = {
  cabinet: '#dbe7f3',
  power: '#f7c873',
  battery: '#9ad0c2',
  ac: '#b9c2ff',
  column: '#8b8b8b',
  feeder: '#e07a5f',
}

const CABLE_COLORS = {
  ac: '#e63946',
  dc: '#1d3557',
  fiber: '#2a9d8f',
  signal: '#8e44ad',
}

export function planToSvg(solution: LayoutSolution, options: PlanViewOptions = {}): string {
  const opts: Required<PlanViewOptions> = {
    zones: true,
    equipment: true,
    trays: true,
    cables: true,
    labels: true,
    dimensions: true,
    titleBlock: true,
    ...options,
  }
  const { room, outline } = solution
  const margin = 900
  const width = room.width
  const depth = room.depth
  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-margin} ${-margin} ${width + margin * 2} ${depth + margin * 2 + 500}" width="1200" font-family="'Microsoft YaHei','Noto Sans SC',sans-serif">`,
  )
  parts.push(
    `<rect x="${-margin}" y="${-margin}" width="${width + margin * 2}" height="${depth + margin * 2 + 500}" fill="#ffffff"/>`,
  )
  parts.push(`<g id="layer-room" data-layer="room">`)
  parts.push(
    `<polygon points="${outline.map((p) => `${p.x},${p.y}`).join(' ')}" fill="#fbfaf6" stroke="#374151" stroke-width="40"/>`,
  )
  parts.push(`</g>`)

  if (opts.zones) {
    parts.push(`<g id="layer-zones" data-layer="zones" opacity="0.35">`)
    for (let i = 1; i < solution.rows.length; i += 1) {
      const prev = solution.rows[i - 1]!
      const row = solution.rows[i]!
      const y1 = prev.y + prev.h
      const y2 = row.y
      if (y2 > y1) {
        const cold = i % 2 === 1
        parts.push(
          `<rect x="${Math.min(prev.x, row.x)}" y="${y1}" width="${Math.max(prev.w, row.w)}" height="${y2 - y1}" fill="${cold ? '#dceeff' : '#ffe8d6'}"/>`,
        )
      }
    }
    parts.push(`</g>`)
  }

  parts.push(`<g id="layer-grid" data-layer="grid" opacity="0.35">`)
  for (let x = 6000; x < width; x += 6000) {
    parts.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${depth}" stroke="#9ca3af" stroke-width="12" stroke-dasharray="120 120"/>`,
    )
  }
  for (let y = 6000; y < depth; y += 6000) {
    parts.push(
      `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#9ca3af" stroke-width="12" stroke-dasharray="120 120"/>`,
    )
  }
  parts.push(`</g>`)

  if (opts.equipment) {
    parts.push(`<g id="layer-equipment" data-layer="equipment">`)
    for (const item of solution.equipment) {
      if (item.kind === 'column') {
        parts.push(
          `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" fill="${COLORS.column}" stroke="#4b5563" stroke-width="8"/>`,
        )
        continue
      }
      const fill = COLORS[item.kind]
      parts.push(
        `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" fill="${fill}" stroke="#374151" stroke-width="10" rx="20"/>`,
      )
      if (opts.labels && item.kind !== 'feeder') {
        parts.push(
          `<text x="${item.x + item.w / 2}" y="${item.y + item.h / 2}" text-anchor="middle" dominant-baseline="middle" font-size="180" fill="#111827">${escapeXml(item.label)}</text>`,
        )
      }
      if (item.kind === 'feeder') {
        parts.push(
          `<text x="${item.x + item.w / 2}" y="${item.y - 80}" text-anchor="middle" font-size="160" fill="#b91c1c">馈线窗</text>`,
        )
      }
    }
    parts.push(`</g>`)
  }

  if (opts.trays) {
    parts.push(`<g id="layer-trays" data-layer="trays">`)
    for (const tray of solution.trays) {
      parts.push(
        `<line x1="${tray.x1}" y1="${tray.y1}" x2="${tray.x2}" y2="${tray.y2}" stroke="#b08968" stroke-width="${tray.width}" stroke-linecap="square" opacity="0.75"/>`,
      )
    }
    parts.push(`</g>`)
  }

  if (opts.cables) {
    parts.push(`<g id="layer-cables" data-layer="cables" opacity="0.55">`)
    for (const cable of solution.cables) {
      parts.push(
        `<polyline points="${cable.points.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${CABLE_COLORS[cable.kind]}" stroke-width="24" stroke-linejoin="round"/>`,
      )
    }
    parts.push(`</g>`)
  }

  if (opts.dimensions) {
    parts.push(`<g id="layer-dimensions" data-layer="dimensions" fill="#374151" font-size="180">`)
    parts.push(
      `<line x1="0" y1="-250" x2="${width}" y2="-250" stroke="#374151" stroke-width="10"/>`,
    )
    parts.push(
      `<text x="${width / 2}" y="-330" text-anchor="middle">${Math.round(width)} mm</text>`,
    )
    parts.push(
      `<line x1="${-250}" y1="0" x2="${-250}" y2="${depth}" stroke="#374151" stroke-width="10"/>`,
    )
    parts.push(
      `<text x="${-330}" y="${depth / 2}" text-anchor="middle" transform="rotate(-90 ${-330} ${depth / 2})">${Math.round(depth)} mm</text>`,
    )
    parts.push(`</g>`)
  }

  if (opts.titleBlock) {
    parts.push(`<g id="layer-title" data-layer="title" transform="translate(0 ${depth + 200})">`)
    parts.push(
      `<rect x="0" y="0" width="${width}" height="420" fill="#ffffff" stroke="#374151" stroke-width="10"/>`,
    )
    parts.push(
      `<text x="40" y="100" font-size="220" font-weight="700" fill="#111827">通信机房平面方案 · ${escapeXml(solution.id)}</text>`,
    )
    parts.push(
      `<text x="40" y="230" font-size="150" fill="#4b5563">${Math.round(width)}×${Math.round(depth)} mm · 机柜 ${solution.metrics.cabinetCount} 台 · 线缆 ${solution.metrics.cableLengthM.toFixed(1)} m · 走线架 ${solution.metrics.trayLengthM.toFixed(1)} m</text>`,
    )
    parts.push(
      `<text x="40" y="350" font-size="130" fill="#9ca3af">seed ${solution.seed} · 方案示意，需工程师复核</text>`,
    )
    parts.push(`</g>`)
  }

  parts.push(`</svg>`)
  return parts.join('')
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case '"':
        return '&quot;'
      default:
        return '&apos;'
    }
  })
}

export function planPointsToPath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
}
