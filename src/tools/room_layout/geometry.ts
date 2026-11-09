import type { Point, Rect, RoomParams } from './types'

export function roomOutline(room: RoomParams): Point[] {
  const { width: w, depth: d, shape, notchW, notchD } = room
  if (shape === 'L') {
    const nw = Math.min(Math.max(notchW, 0), w / 2)
    const nd = Math.min(Math.max(notchD, 0), d / 2)
    return [
      { x: 0, y: 0 },
      { x: w - nw, y: 0 },
      { x: w - nw, y: nd },
      { x: w, y: nd },
      { x: w, y: d },
      { x: 0, y: d },
    ]
  }
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: d },
    { x: 0, y: d },
  ]
}

export function polygonArea(points: Point[]): number {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    area += a.x * b.y - b.x * a.y
  }
  return Math.abs(area) / 2
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!
    const pj = polygon[j]!
    const intersects =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y || 1e-9) + pi.x
    if (intersects) inside = !inside
  }
  return inside
}

export function rectCorners(rect: Rect): Point[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ]
}

export function rectInsideRoom(rect: Rect, room: RoomParams, outline = roomOutline(room)): boolean {
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > room.width || rect.y + rect.h > room.depth) {
    return false
  }
  return rectCorners(rect).every((corner) => pointInPolygon(corner, outline))
}

export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  )
}

export function overlapsAny(rect: Rect, others: Rect[], gap = 0): boolean {
  return others.some((other) => rectsOverlap(rect, other, gap))
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
}

export function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** 把 mm 取整到 10mm，避免浮点噪声 */
export function snap10(value: number): number {
  return Math.round(value / 10) * 10
}
