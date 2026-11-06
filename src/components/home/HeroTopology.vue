<template>
  <figure class="hero-topology">
    <div class="hero-canvas">
      <!-- 预渲染 / 禁用 JS 时的静态底图；canvas 首帧淡入后覆盖 -->
      <svg class="hero-poster" viewBox="0 0 920 380" aria-hidden="true" focusable="false">
        <g class="poster-contour">
          <ellipse cx="560" cy="118" rx="138" ry="118" />
          <ellipse cx="560" cy="118" rx="98" ry="84" />
          <ellipse cx="560" cy="118" rx="62" ry="53" />
          <ellipse cx="620" cy="230" rx="112" ry="96" />
          <ellipse cx="620" cy="230" rx="74" ry="63" />
          <ellipse cx="620" cy="230" rx="42" ry="36" />
          <path d="M 560 8 C 610 70 570 140 620 200 C 660 250 640 310 690 372" />
          <path d="M 500 0 C 552 64 512 136 562 198 C 604 250 584 312 632 380" />
        </g>

        <g class="poster-edge fiber">
          <path
            d="M 250 120 C 310 112 350 114 400 116 C 448 118 470 120 500 122 C 570 128 640 140 720 150"
          />
          <path
            d="M 150 180 C 220 188 270 214 320 232 C 360 246 390 250 430 258 C 510 274 590 292 660 300"
          />
          <path
            d="M 130 320 C 230 330 320 332 420 330 C 470 328 500 324 540 322 C 630 318 730 308 830 300"
          />
          <path
            d="M 110 90 C 180 96 250 130 310 160 C 380 194 440 206 500 214 C 580 226 650 178 720 150"
          />
          <path d="M 190 250 C 280 250 340 262 410 270 C 480 278 560 290 660 300" />
          <path
            d="M 300 300 C 360 280 420 246 470 220 C 520 194 540 202 560 210 C 600 226 620 262 660 300"
          />
          <path d="M 660 300 C 720 300 780 300 830 300" />
          <path d="M 720 150 C 748 196 786 250 830 300" />
          <path d="M 790 70 C 800 148 812 226 830 300" />
          <path d="M 660 300 C 690 250 700 200 720 150" />
        </g>

        <g class="poster-edge microwave">
          <path d="M 350 60 C 430 68 500 96 560 118 C 620 140 680 148 720 150" />
          <path d="M 300 300 C 400 300 480 300 560 300 C 600 300 630 300 660 300" />
        </g>

        <g class="poster-edge wireless">
          <path d="M 350 60 L 560 130" />
          <path d="M 230 60 Q 450 12 700 42" />
          <path d="M 700 42 Q 800 150 830 300" />
        </g>

        <g class="poster-node">
          <circle cx="110" cy="90" r="5" />
          <circle cx="150" cy="180" r="5" />
          <circle cx="190" cy="250" r="5" />
          <circle cx="130" cy="320" r="5" />
          <circle cx="250" cy="120" r="5" />
          <circle cx="300" cy="300" r="5" />
          <circle cx="350" cy="60" r="5" />
          <circle cx="230" cy="60" r="5" />
        </g>

        <g class="poster-base">
          <polygon points="560,118 572,138 548,138" />
          <polygon points="620,230 632,250 608,250" />
        </g>

        <g class="poster-device">
          <rect x="462" y="112" width="16" height="16" transform="rotate(45 470 120)" />
          <rect x="382" y="242" width="16" height="16" transform="rotate(45 390 250)" />
          <rect x="512" y="312" width="16" height="16" transform="rotate(45 520 320)" />
          <rect x="552" y="202" width="16" height="16" transform="rotate(45 560 210)" />
        </g>

        <g class="poster-room">
          <rect x="712" y="142" width="16" height="16" />
          <rect x="652" y="292" width="16" height="16" />
          <rect x="782" y="62" width="16" height="16" />
          <rect x="822" y="292" width="16" height="16" class="poster-core" />
        </g>

        <g class="poster-sat" transform="translate(700 42) rotate(-18)">
          <rect x="-3" y="-4.5" width="6" height="9" class="poster-sat-body" />
          <rect x="-11" y="-3.5" width="6" height="7" />
          <rect x="5" y="-3.5" width="6" height="7" />
        </g>
      </svg>

      <canvas ref="canvasRef" role="img" :aria-label="ariaLabel" />
    </div>

    <figcaption class="hero-foot">
      <div class="hero-legend" aria-hidden="true">
        <span class="legend-item">
          <svg class="legend-swatch" viewBox="0 0 26 8">
            <line class="fiber" x1="1" y1="4" x2="25" y2="4" />
          </svg>
          光缆
        </span>
        <span class="legend-item">
          <svg class="legend-swatch" viewBox="0 0 26 8">
            <line class="wireless" x1="1" y1="4" x2="25" y2="4" />
          </svg>
          无线
        </span>
        <span class="legend-item">
          <svg class="legend-swatch" viewBox="0 0 26 8">
            <line class="microwave" x1="1" y1="4" x2="25" y2="4" />
          </svg>
          微波
        </span>
        <span class="legend-item">
          <svg class="legend-node" viewBox="0 0 12 12">
            <rect x="2.5" y="2.5" width="7" height="7" />
          </svg>
          机房
        </span>
        <span class="legend-item">
          <svg class="legend-node" viewBox="0 0 12 12">
            <polygon points="6,2 10.2,9 1.8,9" />
          </svg>
          基站
        </span>
        <span class="legend-item">
          <svg class="legend-node" viewBox="0 0 12 12">
            <rect x="3.4" y="3.4" width="5.2" height="5.2" transform="rotate(45 6 6)" />
          </svg>
          设备
        </span>
        <span class="legend-item">
          <svg class="legend-node" viewBox="0 0 12 12">
            <circle cx="6" cy="6" r="3.4" />
          </svg>
          终端
        </span>
        <span class="legend-item">
          <svg class="legend-node legend-sat" viewBox="0 0 18 12">
            <g transform="rotate(-18 9 6)">
              <rect x="7" y="3" width="4" height="6" />
              <rect x="2" y="4" width="4" height="4" />
              <rect x="12" y="4" width="4" height="4" />
            </g>
          </svg>
          卫星
        </span>
      </div>

      <div class="hero-actions">
        <button type="button" class="hero-btn" @click="nextSeed">换一张</button>
        <button type="button" class="hero-btn" @click="togglePause">
          {{ paused ? '继续' : '暂停' }}
        </button>
      </div>
    </figcaption>

    <p class="hero-readout readout">
      <span>{{ readoutLine }}</span>
      <span class="hero-readout-detail">{{ readoutDetail }}</span>
    </p>
  </figure>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

// ═══════════════════════════════════════════════════════════════════════════
// 势场蔓生 · 首页首屏
// 标量场 → 等高线 → 分层落位 → 骨干成图 → 终端接入 → 生长 / 驻留 / 消融 / 换季
// ═══════════════════════════════════════════════════════════════════════════

const W = 920
const H = 380
const STATIC_SCALE = 2

const CYCLE = { grow: 1900, hold: 7200, fade: 1100, gap: 260 }

interface Rgb {
  r: number
  g: number
  b: number
}

interface Palette {
  paper: Rgb
  ink: Rgb
  fiber: Rgb
  wireless: Rgb
  microwave: Rgb
  accent: Rgb
}

// 兜底色：与 baitu 主题一致，读不到 CSS 变量时使用
const FALLBACK_PALETTE: Palette = {
  paper: { r: 244, g: 243, b: 239 },
  ink: { r: 42, g: 43, b: 40 },
  fiber: { r: 63, g: 111, b: 159 },
  wireless: { r: 47, g: 125, b: 101 },
  microwave: { r: 181, g: 118, b: 47 },
  accent: { r: 217, g: 164, b: 65 },
}

// 画布取色直接跟随站点主题，避免图例与线条两个蓝
const THEME_VARS: Record<keyof Palette, string> = {
  paper: '--color-base-100',
  ink: '--color-base-content',
  fiber: '--color-primary',
  wireless: '--color-success',
  microwave: '--color-warning',
  accent: '--color-accent',
}

type Medium = 'fiber' | 'wireless' | 'microwave'
type NodeType = 'room' | 'base' | 'device' | 'terminal' | 'satellite'
type RoomKind = 'core' | 'aggregation' | 'access'
type BaseKind = '6G' | '5G' | '4G'
type DeviceKind = 'odf' | 'splitter'

interface TerrainNode {
  id: string
  type: NodeType
  kind?: RoomKind | BaseKind | DeviceKind
  label?: string
  x: number
  y: number
  appear: number
}

interface TerrainEdge {
  a: string
  b: string
  pts: Point[]
  medium: Medium
  delay: number
  kind: 'backbone' | 'access' | 'satellite'
  dur: number
  phase: number
  from: Point
  to: Point
}

interface Point {
  x: number
  y: number
}

interface Room extends Point {
  k: number
}

interface Hill extends Point {
  a: number
  s: number
}

interface Stats {
  rooms: number
  bases: number
  devices: number
  terminals: number
  satellites: number
  edges: number
  fiber: number
  wireless: number
  microwave: number
  roomKinds: Record<RoomKind, number>
  baseKinds: Record<BaseKind, number>
}

const canvasRef = ref<HTMLCanvasElement | null>(null)

const paused = ref(false)
const stats = ref<Stats>({
  rooms: 0,
  bases: 0,
  devices: 0,
  terminals: 0,
  satellites: 0,
  edges: 0,
  fiber: 0,
  wireless: 0,
  microwave: 0,
  roomKinds: { core: 0, aggregation: 0, access: 0 },
  baseKinds: { '6G': 0, '5G': 0, '4G': 0 },
})
const seed = ref(20261106)
const reduced = ref(false)

const readoutLine = computed(
  () =>
    `种子 ${seed.value} · 机房 ${stats.value.rooms} · 基站 ${stats.value.bases}` +
    ` · 设备 ${stats.value.devices} · 终端 ${stats.value.terminals} · 卫星 ${stats.value.satellites}`,
)

const readoutDetail = computed(
  () =>
    `机房 核心 ${stats.value.roomKinds.core} · 汇聚 ${stats.value.roomKinds.aggregation}` +
    ` · 接入 ${stats.value.roomKinds.access} ｜ 基站 6G ${stats.value.baseKinds['6G']}` +
    ` · 5G ${stats.value.baseKinds['5G']} · 4G ${stats.value.baseKinds['4G']}` +
    ` ｜ 光缆 ${stats.value.fiber} · 无线 ${stats.value.wireless} · 微波 ${stats.value.microwave}`,
)

const ariaLabel = computed(
  () =>
    `通信拓扑示意：${stats.value.rooms} 个机房（核心 ${stats.value.roomKinds.core}、` +
    `汇聚 ${stats.value.roomKinds.aggregation}、接入 ${stats.value.roomKinds.access}）、` +
    `${stats.value.bases} 个基站（6G ${stats.value.baseKinds['6G']}、5G ${stats.value.baseKinds['5G']}、` +
    `4G ${stats.value.baseKinds['4G']}）、${stats.value.devices} 个设备、` +
    `${stats.value.terminals} 个终端、${stats.value.satellites} 颗卫星；` +
    `${stats.value.fiber} 条光缆、${stats.value.wireless} 条无线、${stats.value.microwave} 条微波链路。` +
    `机房、基站、设备连成一张图；终端只向下接入，卫星只走无线。`,
)

// ═══════════════════════════════════════════════════════════════════════════
// 工具
// ═══════════════════════════════════════════════════════════════════════════

function mulberry32(seedValue: number) {
  let a = seedValue >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeNoise(seedValue: number) {
  const rnd = mulberry32(seedValue)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const tmp = p[i]!
    p[i] = p[j]!
    p[j] = tmp
  }
  const perm = new Uint8Array(512)
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const mix = (a: number, b: number, t: number) => a + (b - a) * t
  const grad = (h: number, x: number, y: number, z: number) => {
    const g = h & 15
    const u = g < 8 ? x : y
    const v = g < 4 ? y : g === 12 || g === 14 ? x : z
    return (g & 1 ? -u : u) + (g & 2 ? -v : v)
  }

  return function noise3(x: number, y: number, z: number) {
    const X = Math.floor(x) & 255
    const Y = Math.floor(y) & 255
    const Z = Math.floor(z) & 255
    x -= Math.floor(x)
    y -= Math.floor(y)
    z -= Math.floor(z)
    const u = fade(x)
    const v = fade(y)
    const w = fade(z)
    const A = perm[X]! + Y
    const AA = perm[A]! + Z
    const AB = perm[A + 1]! + Z
    const B = perm[X + 1]! + Y
    const BA = perm[B]! + Z
    const BB = perm[B + 1]! + Z
    return (
      mix(
        mix(
          mix(grad(perm[AA]!, x, y, z), grad(perm[BA]!, x - 1, y, z), u),
          mix(grad(perm[AB]!, x, y - 1, z), grad(perm[BB]!, x - 1, y - 1, z), u),
          v,
        ),
        mix(
          mix(grad(perm[AA + 1]!, x, y, z - 1), grad(perm[BA + 1]!, x - 1, y, z - 1), u),
          mix(grad(perm[AB + 1]!, x, y - 1, z - 1), grad(perm[BB + 1]!, x - 1, y - 1, z - 1), u),
          v,
        ),
        w,
      ) *
        0.5 +
      0.5
    )
  }
}

let noise3 = makeNoise(1)

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  )
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

let colorProbe: HTMLCanvasElement | null = null

// 用 1×1 canvas 把 oklch() 之类的主题变量落成 rgb
function parseColor(css: string): Rgb | null {
  if (typeof document === 'undefined') return null
  if (css.startsWith('#')) return hexToRgb(css)

  if (!colorProbe) {
    colorProbe = document.createElement('canvas')
    colorProbe.width = 1
    colorProbe.height = 1
  }
  const g = colorProbe.getContext('2d', { willReadFrequently: true })
  if (!g) return null

  g.clearRect(0, 0, 1, 1)
  g.fillStyle = '#000000'
  g.fillStyle = css
  g.fillRect(0, 0, 1, 1)

  const data = g.getImageData(0, 0, 1, 1).data
  if (!data) return null
  return { r: data[0]!, g: data[1]!, b: data[2]! }
}

function readPalette(): Palette {
  const next = { ...FALLBACK_PALETTE }
  const root = getComputedStyle(document.documentElement)
  for (const key of Object.keys(THEME_VARS) as (keyof Palette)[]) {
    const raw = root.getPropertyValue(THEME_VARS[key]).trim()
    const parsed = raw ? parseColor(raw) : null
    if (parsed) next[key] = parsed
  }
  return next
}

function rgba(c: Rgb, alpha: number) {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`
}

function placePoints(
  n: number,
  minDx: number,
  minDy: number,
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number,
  tries = 4000,
) {
  const pts: Point[] = []
  for (let k = 0; k < tries && pts.length < n; k++) {
    const p = { x: lerp(xmin, xmax, rng()), y: lerp(ymin, ymax, rng()) }
    let ok = true
    for (const q of pts) {
      if (Math.abs(p.x - q.x) < minDx && Math.abs(p.y - q.y) < minDy) {
        ok = false
        break
      }
    }
    if (ok) pts.push(p)
  }
  return pts
}

function dist(a: number, b: number, c: number, d: number) {
  return Math.hypot(a - c, b - d)
}

function distToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return dist(p.x, p.y, a.x, a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2
  t = clamp(t, 0, 1)
  return dist(p.x, p.y, a.x + t * dx, a.y + t * dy)
}

function chaikin(pts: Point[], iters = 1): Point[] {
  let out = pts
  for (let k = 0; k < iters; k++) {
    if (out.length < 3) return out
    const next: Point[] = [out[0]!]
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i]!
      const b = out[i + 1]!
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 })
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 })
    }
    next.push(out[out.length - 1]!)
    out = next
  }
  return out
}

function pathLength(pts: Point[]) {
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    total += dist(pts[i - 1]!.x, pts[i - 1]!.y, pts[i]!.x, pts[i]!.y)
  }
  return total
}

function pointAt(pts: Point[], u: number): Point {
  const total = pathLength(pts)
  let target = total * clamp(u, 0, 1)
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1]!.x, pts[i - 1]!.y, pts[i]!.x, pts[i]!.y)
    if (target <= seg || i === pts.length - 1) {
      const f = seg > 0 ? target / seg : 0
      return {
        x: lerp(pts[i - 1]!.x, pts[i]!.x, f),
        y: lerp(pts[i - 1]!.y, pts[i]!.y, f),
      }
    }
    target -= seg
  }
  return pts[pts.length - 1]!
}

// ═══════════════════════════════════════════════════════════════════════════
// 地形
// ═══════════════════════════════════════════════════════════════════════════

class Terrain {
  ridgePhase: number
  ridgeBase = 0.36
  ridgeAmp = 0.05
  rooms: Room[] = []
  bases: Point[] = []
  peaks: Hill[] = []
  hills: Hill[] = []
  terminals: Point[] = []

  constructor() {
    this.ridgePhase = rng() * Math.PI * 2

    const roomCount = 3 + Math.floor(rng() * 2)
    const roomPts = placePoints(roomCount, 0.12, 0.24, 0.62, 0.9, 0.2, 0.8)

    this.rooms = roomPts.map((p, i) => ({
      x: p.x,
      y: p.y,
      k: i,
    }))

    while (this.rooms.length < 3) {
      const k = this.rooms.length
      this.rooms.push({ x: 0.64 + k * 0.12, y: 0.26 + k * 0.24, k })
    }

    this.rooms.sort((a, b) => a.x - b.x)
    // 机房是低地设施，不再抬成山峰；制高点留给基站
    // 基站站点先落位，再由这些站点构成高斯峰
    this.bases = placeAway(3, 0.4, 0.6, 0.12, 0.88, 0.2, this.rooms)
    this.peaks = this.bases.map((p) => ({
      x: p.x,
      y: p.y,
      a: 1.12 + rng() * 0.2,
      s: 0.078 + rng() * 0.018,
    }))

    const hillCount = 2 + Math.floor(rng() * 2)
    for (let i = 0; i < hillCount; i++) {
      for (let k = 0; k < 30; k++) {
        const cand = { x: lerp(0.28, 0.6, rng()), y: lerp(0.1, 0.9, rng()) }
        const clear = [...this.rooms, ...this.bases].every(
          (r) => Math.hypot((cand.x - r.x) * 2.4, cand.y - r.y) > 0.2,
        )
        if (clear) {
          this.hills.push({ x: cand.x, y: cand.y, a: 0.1 + rng() * 0.16, s: 0.08 + rng() * 0.04 })
          break
        }
      }
    }

    // 终端集中在左端，右侧依次留给设备、基站、机房
    const base = 6 + Math.floor(rng() * 3)
    const nTer = Math.max(6, Math.min(8, base))
    const cands = placePoints(nTer * 4, 0.055, 0.14, 0.035, 0.25, 0.12, 0.88)
    this.terminals = cands.slice(0, nTer)
  }

  baseValue(x: number, y: number) {
    let v = 0
    const m = H * 1.15

    for (const p of this.peaks) {
      const dx = (x - p.x) * W
      const dy = (y - p.y) * H
      const sig = p.s * m
      v += p.a * Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig))
    }

    for (const h of this.hills) {
      const dx = (x - h.x) * W
      const dy = (y - h.y) * H
      const sig = h.s * m
      v += h.a * Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig))
    }

    const dxr = (x - this.ridgeXAt(y)) * W
    const sigr = 0.07 * m
    v += 0.34 * Math.exp(-(dxr * dxr) / (2 * sigr * sigr))
    v += 0.28 * (noise3(x * 2.3, y * 2.3, 1.7) - 0.5)
    return v
  }

  value(x: number, y: number) {
    const wx = x + 0.03 * (noise3(x * 3.1, y * 3.1, 5.1) - 0.5)
    const wy = y + 0.03 * (noise3(x * 3.1, y * 3.1, 9.7) - 0.5)
    return (
      this.baseValue(wx, wy) +
      0.12 * (noise3(x * 6.1, y * 6.1, 4.2) - 0.5) +
      0.06 * (noise3(x * 13, y * 13, 8.8) - 0.5)
    )
  }

  // 噪声会让峰心轻微偏移，把基站吸附到附近真正的局部最高点
  snapToPeak(p: Point): Point {
    let bx = p.x
    let by = p.y
    let bv = this.value(bx, by)
    let rx = 0.03
    let ry = 0.045
    for (let pass = 0; pass < 2; pass++) {
      for (let i = -8; i <= 8; i++) {
        for (let j = -8; j <= 8; j++) {
          const x = clamp(bx + (i / 8) * rx, 0.01, 0.99)
          const y = clamp(by + (j / 8) * ry, 0.01, 0.99)
          const v = this.value(x, y)
          if (v > bv) {
            bv = v
            bx = x
            by = y
          }
        }
      }
      rx /= 4
      ry /= 4
    }
    return { x: bx, y: by }
  }

  ridgeXAt(y: number) {
    return this.ridgeBase + this.ridgeAmp * Math.sin(y * 3.4 + this.ridgePhase)
  }
}

let terrain: Terrain
let nodes: TerrainNode[] = []
let edges: TerrainEdge[] = []
let rng = Math.random

function straightPath(a: Point, b: Point): Point[] {
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: b.y },
  ]
}

// 路径与节点的最小间隙（像素），用来避免链路穿过无关节点造成“假连接”
function clearanceOf(pts: Point[], ignore: Set<string>): number {
  let min = Infinity
  for (const n of nodes) {
    if (ignore.has(n.id)) continue
    for (let i = 1; i < pts.length; i++) {
      const d = distToSegment(
        { x: n.x * W, y: n.y * H },
        { x: pts[i - 1]!.x * W, y: pts[i - 1]!.y * H },
        { x: pts[i]!.x * W, y: pts[i]!.y * H },
      )
      if (d < min) min = d
    }
  }
  return min
}

// 在同类候选里挑“视线最通畅”的一个，避免链路从别的节点身上穿过去
function pickClearTarget(from: TerrainNode, candidates: TerrainNode[]): TerrainNode | null {
  let best: TerrainNode | null = null
  let bestScore = -Infinity
  for (const c of candidates) {
    if (c.id === from.id) continue
    const clear = Math.min(clearanceOf(straightPath(from, c), new Set([from.id, c.id])), 40)
    const d = Math.hypot((from.x - c.x) * 2.2, from.y - c.y)
    const score = clear - d * 14
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

// 光缆：弯曲、带手绘颤动；两端严格落在节点上，并尽量绕开其他节点
function fiberPath(a: Point, b: Point, ignore: Set<string> = new Set()): Point[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const amp = Math.min(0.058, len * 0.2)
  const phase = rng() * 53
  const sign = rng() < 0.5 ? 1 : -1
  const bends = [0.55, 1, 1.6, 2.2].flatMap((v) => [v * sign, -v * sign])

  let best: Point[] = straightPath(a, b)
  let bestScore = -Infinity

  for (const k of bends) {
    for (const c2k of [-0.45, 0.45]) {
      const c1 = { x: a.x + dx * 0.33 + nx * amp * k, y: a.y + dy * 0.33 + ny * amp * k }
      const c2 = {
        x: a.x + dx * 0.66 + nx * amp * k * c2k,
        y: a.y + dy * 0.66 + ny * amp * k * c2k,
      }

      const pts: Point[] = []
      const steps = 14
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const u = 1 - t
        const x = u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x
        const y = u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y
        const w = (noise3(t * 3.6 + phase, phase * 0.7, 6.1) - 0.5) * 0.03 * Math.sin(Math.PI * t)
        pts.push({
          x: clamp(x + nx * w, 0.015, 0.985),
          y: clamp(y + ny * w, 0.015, 0.985),
        })
      }

      const curve = chaikin(pts, 2)
      const score = clearanceOf(curve, ignore)
      if (score > bestScore) {
        best = curve
        bestScore = score
      }
      if (bestScore >= 16) return best
    }
  }

  return best
}
// 无线 / 微波：优先直线；若被别的节点挡住，就弯一条平滑弧线绕开
function radioPath(a: Point, b: Point, ignore: Set<string> = new Set()): Point[] {
  const straight = straightPath(a, b)
  const clear = clearanceOf(straight, ignore)
  if (clear > 22) return straight

  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2

  let best = straight
  let bestScore = clear

  for (const bow of [0.05, -0.05, 0.1, -0.1, 0.15, -0.15]) {
    const px = mx + nx * bow
    const py = my + ny * bow
    const cx = 2 * px - mx
    const cy = 2 * py - my

    const pts: Point[] = []
    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      const u = 1 - t
      pts.push({
        x: clamp(u * u * a.x + 2 * u * t * cx + t * t * b.x, 0.015, 0.985),
        y: clamp(u * u * a.y + 2 * u * t * cy + t * t * b.y, 0.015, 0.985),
      })
    }
    const score = clearanceOf(pts, ignore)
    if (score > bestScore) {
      best = pts
      bestScore = score
    }
  }

  return best
}

// 卫星链路只走无线，用一条平滑弧线表示上空路径
function satArc(a: Point, b: Point): Point[] {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const bow = Math.min(0.18, 0.07 + Math.hypot(b.x - a.x, b.y - a.y) * 0.14)
  const cy = Math.max(0.02, my - bow)
  const pts: Point[] = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    const u = 1 - t
    pts.push({
      x: u * u * a.x + 2 * u * t * mx + t * t * b.x,
      y: u * u * a.y + 2 * u * t * cy + t * t * b.y,
    })
  }
  return pts
}

// 按横向距离（图宽大于图高）找最近节点
function nearestOf<T extends Point>(p: Point, list: T[]): T | null {
  let best: T | null = null
  let bd = Infinity
  for (const q of list) {
    const d = Math.hypot((p.x - q.x) * 2.4, p.y - q.y)
    if (d < bd) {
      bd = d
      best = q
    }
  }
  return best
}

// 在带状区域里撒点，避开已有节点；撒不够就按 y 均分兜底
function placeAway(
  count: number,
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number,
  minDist: number,
  existing: Point[],
): Point[] {
  const pts: Point[] = []
  const all = [...existing]
  for (let k = 0; k < 6000 && pts.length < count; k++) {
    const p = { x: lerp(xmin, xmax, rng()), y: lerp(ymin, ymax, rng()) }
    if (all.some((q) => Math.hypot((p.x - q.x) * 2.4, p.y - q.y) < minDist)) continue
    pts.push(p)
    all.push(p)
  }
  for (let k = pts.length; k < count; k++) {
    pts.push({
      x: lerp(xmin, xmax, (k + 0.5) / count),
      y: lerp(ymin + 0.06, ymax - 0.06, count > 1 ? k / (count - 1) : 0.5),
    })
  }
  return pts
}

// ═══════════════════════════════════════════════════════════════════════════
// 网络
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 网络
// 机房 / 基站 / 设备先连成一张图（光缆为主，少量微波）
// 终端只向下接入设备、基站、机房或卫星；卫星只走无线
// ═══════════════════════════════════════════════════════════════════════════

const ROOM_LABEL: Record<RoomKind, string> = {
  core: '核心',
  aggregation: '汇聚',
  access: '接入',
}

const DEVICE_LABEL: Record<DeviceKind, string> = {
  odf: '光交',
  splitter: '分纤箱',
}

function addEdge(
  aNode: TerrainNode,
  bNode: TerrainNode,
  medium: Medium,
  delay: number,
  kind: TerrainEdge['kind'],
): TerrainEdge {
  const from = { x: aNode.x, y: aNode.y }
  const to = { x: bNode.x, y: bNode.y }
  const ignore = new Set([aNode.id, bNode.id])
  const pts =
    kind === 'satellite'
      ? satArc(from, to)
      : medium === 'fiber'
        ? fiberPath(from, to, ignore)
        : radioPath(from, to, ignore)
  const e: TerrainEdge = {
    a: aNode.id,
    b: bNode.id,
    pts,
    medium,
    delay,
    kind,
    dur: kind === 'backbone' ? 560 : 480,
    phase: rng() * 100,
    from,
    to,
  }
  edges.push(e)
  return e
}

// 改介质时重画路径：光缆弯曲，无线/微波必为直线或平滑弧
function restyleEdge(e: TerrainEdge, medium: Medium) {
  e.medium = medium
  const ignore = new Set([e.a, e.b])
  e.pts = medium === 'fiber' ? fiberPath(e.from, e.to, ignore) : radioPath(e.from, e.to, ignore)
}

// 卫星弧线如果压到别的节点上，就改成一条绕开节点的无线弧
function relaxSatellite(e: TerrainEdge) {
  const ignore = new Set([e.a, e.b])
  if (clearanceOf(e.pts, ignore) < 20) {
    e.pts = radioPath(e.from, e.to, ignore)
  }
}

function buildNetwork() {
  nodes = []
  edges = []

  // ── 机房：接入 / 汇聚 / 核心，从左到右排 ──────────────────────────────
  const roomPoints = [...terrain.rooms].sort((a, b) => a.x - b.x)
  const aggCount = roomPoints.length >= 4 && rng() < 0.45 ? 2 : 1
  const accessCount = roomPoints.length - 1 - aggCount
  const roomKinds: RoomKind[] = [
    ...Array<RoomKind>(accessCount).fill('access'),
    ...Array<RoomKind>(aggCount).fill('aggregation'),
    'core',
  ]

  const rooms: TerrainNode[] = roomPoints.map((r, i) => ({
    id: `room${i}`,
    type: 'room',
    kind: roomKinds[i]!,
    label: ROOM_LABEL[roomKinds[i]!],
    x: r.x,
    y: r.y,
    appear: 100 + i * 55,
  }))

  // 同类多间时加 A/B 后缀
  const roomCountByKind: Record<string, number> = {}
  rooms.forEach((n) => {
    const k = n.kind as string
    roomCountByKind[k] = (roomCountByKind[k] ?? 0) + 1
  })
  const roomSeen: Record<string, number> = {}
  rooms.forEach((n) => {
    const k = n.kind as string
    if ((roomCountByKind[k] ?? 0) > 1) {
      roomSeen[k] = (roomSeen[k] ?? 0) + 1
      n.label = `${ROOM_LABEL[n.kind as RoomKind]}${String.fromCharCode(64 + roomSeen[k]!)}`
    }
  })
  nodes.push(...rooms)

  const core = rooms[rooms.length - 1]!
  const aggregations = rooms.filter((n) => n.kind === 'aggregation')
  const accesses = rooms.filter((n) => n.kind === 'access')

  // ── 基站：6G / 5G / 4G 各一座，落在地形的高斯峰顶 ────────────────────
  const baseKinds: BaseKind[] = ['6G', '5G', '4G']
  for (let i = baseKinds.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = baseKinds[i]!
    baseKinds[i] = baseKinds[j]!
    baseKinds[j] = tmp
  }
  const basePts = terrain.bases.map((p) => terrain.snapToPeak(p))
  const bases: TerrainNode[] = basePts.map((p, i) => ({
    id: `base${i}`,
    type: 'base',
    kind: baseKinds[i]!,
    label: baseKinds[i]!,
    x: p.x,
    y: p.y,
    appear: 220,
  }))
  nodes.push(...bases)

  // ── 设备：光交靠近机房，分纤箱靠近终端 ───────────────────────────────
  const odfCount = 1 + (rng() < 0.5 ? 1 : 0)
  const odfPts = placeAway(odfCount, 0.38, 0.5, 0.14, 0.86, 0.17, [...rooms, ...bases])
  const odfs: TerrainNode[] = odfPts.map((p, i) => ({
    id: `odf${i}`,
    type: 'device',
    kind: 'odf',
    label: DEVICE_LABEL.odf,
    x: p.x,
    y: p.y,
    appear: 280,
  }))
  const splitterPts = placeAway(2, 0.25, 0.36, 0.12, 0.88, 0.15, [...rooms, ...bases, ...odfs])
  const splitters: TerrainNode[] = splitterPts.map((p, i) => ({
    id: `sp${i}`,
    type: 'device',
    kind: 'splitter',
    label: DEVICE_LABEL.splitter,
    x: p.x,
    y: p.y,
    appear: 300,
  }))
  nodes.push(...odfs, ...splitters)

  // ── 终端：只在左端，互不相连 ─────────────────────────────────────────
  const terminals: TerrainNode[] = terrain.terminals.map((p, i) => ({
    id: `ter${i}`,
    type: 'terminal',
    x: p.x,
    y: p.y,
    appear: 0,
  }))
  nodes.push(...terminals)

  // ── 卫星：停在图上空，只发无线 ───────────────────────────────────────
  const satPt = placeAway(1, 0.64, 0.8, 0.055, 0.1, 0.2, [...rooms, ...bases])[0] ?? {
    x: 0.72,
    y: 0.08,
  }
  const satellite: TerrainNode = {
    id: 'sat0',
    type: 'satellite',
    label: '卫星',
    x: satPt.x,
    y: satPt.y,
    appear: 360,
  }
  nodes.push(satellite)

  // ── 骨干：先长成一张连通的图 ─────────────────────────────────────────
  let delay = 180
  const step = 62
  const backboneEdges: TerrainEdge[] = []
  const linked = new Set<TerrainNode>([core])
  const link = (a: TerrainNode, b: TerrainNode, medium: Medium) => {
    backboneEdges.push(addEdge(a, b, medium, delay, 'backbone'))
    delay += step
    linked.add(a)
    linked.add(b)
  }

  aggregations.forEach((agg) => {
    link(agg, nearestOf(agg, [...linked]) ?? core, 'fiber')
  })
  accesses.forEach((acc) => {
    link(acc, nearestOf(acc, [...linked]) ?? core, 'fiber')
  })
  bases.forEach((base) => {
    const target = nearestOf(base, rooms) ?? core
    const far = dist(base.x, base.y, target.x, target.y) > 0.22
    link(base, target, far && rng() < 0.18 ? 'microwave' : 'fiber')
  })
  odfs.forEach((odf) => {
    const target = nearestOf(odf, [...accesses, ...aggregations]) ?? core
    link(odf, target, 'fiber')
  })
  splitters.forEach((sp) => {
    const target = nearestOf(sp, odfs) ?? nearestOf(sp, accesses) ?? core
    link(sp, target, 'fiber')
  })

  // 光缆为主，但每张图至少留一条微波；微波不超过骨干的两成
  const mwCap = Math.max(1, Math.round(backboneEdges.length * 0.18))
  const mwEdges = backboneEdges.filter((e) => e.medium === 'microwave')
  if (mwEdges.length > mwCap) {
    mwEdges.slice(mwCap).forEach((e) => restyleEdge(e, 'fiber'))
  }
  if (!backboneEdges.some((e) => e.medium === 'microwave')) {
    const typeById = new Map(nodes.map((n) => [n.id, n.type]))
    const cand = backboneEdges
      .filter((e) => e.medium === 'fiber')
      .filter((e) => typeById.get(e.a) !== 'device' && typeById.get(e.b) !== 'device')
      .sort((a, b) => pathLength(b.pts) - pathLength(a.pts))[0]
    if (cand) restyleEdge(cand, 'microwave')
  }

  // ── 卫星锚点：可以挂到任意一间机房（核心/汇聚/接入），且只走无线 ──
  const satRoom = rooms[Math.floor(rng() * rooms.length)] ?? core
  relaxSatellite(addEdge(satellite, satRoom, 'wireless', delay, 'satellite'))
  delay += 70

  // ── 终端接入：设备 / 基站 / 机房 / 卫星 ──────────────────────────────
  const order = [...terminals].sort((a, b) => a.y - b.y)

  order.forEach((ter, i) => {
    ter.appear = delay

    let target: TerrainNode
    let medium: Medium = 'fiber'
    let kind: TerrainEdge['kind'] = 'access'

    if (i === 0) {
      // 固定一颗终端走卫星，保证卫星有用户
      target = satellite
      medium = 'wireless'
      kind = 'satellite'
    } else if (i === 1) {
      // 固定一条终端—设备光缆
      target = pickClearTarget(ter, [...odfs, ...splitters]) ?? nearestOf(ter, accesses) ?? core
    } else if (i === 2) {
      // 固定一条基站无线接入
      target = pickClearTarget(ter, bases) ?? nearestOf(ter, accesses) ?? core
      medium = 'wireless'
    } else if (i === 3) {
      // 固定一条终端—机房光缆，机房类型不限
      target = pickClearTarget(ter, rooms) ?? core
    } else {
      const roll = rng()
      if (roll < 0.42) {
        target = pickClearTarget(ter, [...odfs, ...splitters]) ?? nearestOf(ter, accesses) ?? core
      } else if (roll < 0.7) {
        target = pickClearTarget(ter, bases) ?? nearestOf(ter, accesses) ?? core
        medium = rng() < 0.55 ? 'fiber' : 'wireless'
      } else if (roll < 0.9) {
        target = pickClearTarget(ter, rooms) ?? core
      } else {
        target = pickClearTarget(ter, [...odfs, ...splitters]) ?? core
      }
    }

    const edge = addEdge(ter, target, medium, delay, kind)
    if (kind === 'satellite') relaxSatellite(edge)
    delay += kind === 'satellite' ? 80 : 56
  })

  stats.value = {
    rooms: rooms.length,
    bases: bases.length,
    devices: odfs.length + splitters.length,
    terminals: terminals.length,
    satellites: 1,
    edges: edges.length,
    fiber: edges.filter((e) => e.medium === 'fiber').length,
    wireless: edges.filter((e) => e.medium === 'wireless').length,
    microwave: edges.filter((e) => e.medium === 'microwave').length,
    roomKinds: {
      core: rooms.filter((n) => n.kind === 'core').length,
      aggregation: rooms.filter((n) => n.kind === 'aggregation').length,
      access: rooms.filter((n) => n.kind === 'access').length,
    },
    baseKinds: {
      '6G': bases.filter((n) => n.kind === '6G').length,
      '5G': bases.filter((n) => n.kind === '5G').length,
      '4G': bases.filter((n) => n.kind === '4G').length,
    },
  }

  if (import.meta.env.DEV) {
    ;(window as unknown as Record<string, unknown>).__heroTopology = {
      nodes,
      edges,
      stats: { ...stats.value },
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 绘制
// ═══════════════════════════════════════════════════════════════════════════

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let staticCanvas: HTMLCanvasElement | null = null
let staticCtx: CanvasRenderingContext2D | null = null
let palette: Palette = FALLBACK_PALETTE

let artClock = 0
let cycleClock = 0
let lastFrame = 0
let raf = 0

function contourSegments(level: number, grid: number) {
  const segs: [Point, Point][] = []
  const vals = new Float32Array((grid + 1) * (grid + 1))
  for (let j = 0; j <= grid; j++) {
    for (let i = 0; i <= grid; i++) {
      vals[j * (grid + 1) + i] = terrain.value(i / grid, j / grid)
    }
  }

  const V = (i: number, j: number) => vals[j * (grid + 1) + i]!
  const interp = (v1: number, v2: number, a: Point, b: Point) => {
    const dd = v2 - v1
    const t = Math.abs(dd) < 1e-6 ? 0.5 : (level - v1) / dd
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  }

  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
      const a = V(i, j)
      const b = V(i + 1, j)
      const c = V(i + 1, j + 1)
      const d = V(i, j + 1)
      const idx =
        (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0)
      if (idx === 0 || idx === 15) continue

      const x0 = i / grid
      const x1 = (i + 1) / grid
      const y0 = j / grid
      const y1 = (j + 1) / grid

      const top = interp(a, b, { x: x0, y: y0 }, { x: x1, y: y0 })
      const right = interp(b, c, { x: x1, y: y0 }, { x: x1, y: y1 })
      const bottom = interp(d, c, { x: x0, y: y1 }, { x: x1, y: y1 })
      const left = interp(a, d, { x: x0, y: y0 }, { x: x0, y: y1 })

      switch (idx) {
        case 1:
        case 14:
          segs.push([left, bottom])
          break
        case 2:
        case 13:
          segs.push([bottom, right])
          break
        case 3:
        case 12:
          segs.push([left, right])
          break
        case 4:
        case 11:
          segs.push([top, right])
          break
        case 6:
        case 9:
          segs.push([top, bottom])
          break
        case 7:
        case 8:
          segs.push([left, top])
          break
        case 5:
          segs.push([left, top], [bottom, right])
          break
        case 10:
          segs.push([left, bottom], [top, right])
          break
      }
    }
  }
  return segs
}

function buildStatic() {
  if (!staticCanvas || !staticCtx || !terrain) return

  const g = staticCtx
  g.setTransform(STATIC_SCALE, 0, 0, STATIC_SCALE, 0, 0)
  g.clearRect(0, 0, W, H)

  const ink = palette.ink

  g.lineWidth = 1
  g.strokeStyle = rgba(ink, 0.035)
  for (let x = 0; x <= W; x += 20) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, H)
    g.stroke()
  }
  for (let y = 0; y <= H; y += 20) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(W, y)
    g.stroke()
  }

  g.strokeStyle = rgba(ink, 0.06)
  for (let x = 0; x <= W; x += 100) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, H)
    g.stroke()
  }
  for (let y = 0; y <= H; y += 100) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(W, y)
    g.stroke()
  }

  let mn = Infinity
  let mx = -Infinity
  const probe = 26
  for (let j = 0; j <= probe; j++) {
    for (let i = 0; i <= probe; i++) {
      const v = terrain.value(i / probe, j / probe)
      if (v < mn) mn = v
      if (v > mx) mx = v
    }
  }

  const levels = 7
  const grid = 64
  for (let l = 1; l <= levels; l++) {
    const level = lerp(mn, mx, l / (levels + 1))
    const segs = contourSegments(level, grid)
    const major = l % 2 === 0
    g.strokeStyle = rgba(ink, major ? 0.25 : 0.14)
    g.lineWidth = major ? 1.2 : 0.9
    g.beginPath()
    for (const s of segs) {
      g.moveTo(s[0].x * W, s[0].y * H)
      g.lineTo(s[1].x * W, s[1].y * H)
    }
    g.stroke()
  }
}

function rebuild(newSeed: number) {
  seed.value = newSeed
  noise3 = makeNoise(newSeed)
  rng = mulberry32(newSeed)
  terrain = new Terrain()
  buildNetwork()
  buildStatic()
  // 暂停时换一张，直接给一张长成的图，别停在零秒的空场
  cycleClock = paused.value ? CYCLE.grow + CYCLE.hold : 0
}

function drawPartial(context: CanvasRenderingContext2D, pts: Point[], u: number) {
  if (u <= 0) return
  const total = pathLength(pts)
  let target = total * u
  context.beginPath()
  context.moveTo(pts[0]!.x * W, pts[0]!.y * H)
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1]!.x, pts[i - 1]!.y, pts[i]!.x, pts[i]!.y)
    if (target >= seg) {
      context.lineTo(pts[i]!.x * W, pts[i]!.y * H)
      target -= seg
    } else {
      const f = seg > 0 ? target / seg : 0
      context.lineTo(lerp(pts[i - 1]!.x, pts[i]!.x, f) * W, lerp(pts[i - 1]!.y, pts[i]!.y, f) * H)
      break
    }
  }
  context.stroke()
}

function drawEdges(context: CanvasRenderingContext2D, fade: number) {
  if (fade <= 0.01) return

  for (const e of edges) {
    const p = clamp((cycleClock - e.delay) / e.dur, 0, 1)
    if (p <= 0) continue

    const c = palette[e.medium]
    const base = e.medium === 'wireless' ? 0.66 : e.kind === 'backbone' ? 0.42 : 0.58

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'

    context.strokeStyle = rgba(c, base * fade)
    context.lineWidth =
      (e.medium === 'fiber' ? 2.2 : e.medium === 'microwave' ? 1.9 : 1.7) *
      (e.kind === 'backbone' ? 0.9 : 1)
    context.setLineDash(
      e.medium === 'microwave' ? [8, 4.5] : e.medium === 'wireless' ? [1.5, 5] : [],
    )
    drawPartial(context, e.pts, p)

    if (p >= 1) {
      // 暂停 / 减弱动效时保留高亮虚线，只是不再流动
      const flow = paused.value ? e.phase * 2.2 : (artClock * 0.001 * 46 + e.phase * 2.2) % 36
      context.setLineDash(e.medium === 'wireless' ? [2, 29] : [5, 31])
      context.lineDashOffset = -flow
      context.strokeStyle = rgba(c, 0.88 * fade)
      context.lineWidth =
        (e.medium === 'fiber' ? 2.9 : e.medium === 'microwave' ? 2.4 : 2.2) *
        (e.kind === 'backbone' ? 0.9 : 1)
      drawPartial(context, e.pts, 1)
    }

    context.setLineDash([])
    context.lineDashOffset = 0

    if (p < 1) {
      const head = pointAt(e.pts, p)
      context.fillStyle = rgba(c, 0.94 * fade)
      context.beginPath()
      context.arc(head.x * W, head.y * H, 2.5, 0, Math.PI * 2)
      context.fill()
    }

    if (e.kind === 'satellite' && p >= 1) {
      const mid = pointAt(e.pts, 0.5)
      context.fillStyle = rgba(c, 0.72 * fade)
      context.font = "9px 'Courier New', Consolas, monospace"
      context.textAlign = 'center'
      context.textBaseline = 'bottom'
      context.fillText('Ku', mid.x * W, mid.y * H - 5)
    }

    context.restore()
  }
}

function drawNodes(context: CanvasRenderingContext2D, fade: number) {
  if (fade <= 0.01) return

  const label = (text: string, dy: number, size = 10) => {
    context.font = `${size}px 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif`
    const tw = context.measureText(text).width
    context.fillStyle = rgba(palette.paper, 0.92 * fade)
    context.fillRect(-tw / 2 - 3, dy - 1, tw + 6, size + 4)
    context.fillStyle = rgba(palette.ink, 0.72 * fade)
    context.textAlign = 'center'
    context.textBaseline = 'top'
    context.fillText(text, 0, dy)
  }

  for (const n of nodes) {
    const a = clamp((cycleClock - n.appear) / 240, 0, 1) * fade
    if (a <= 0) continue

    context.save()
    context.translate(n.x * W, n.y * H)

    context.strokeStyle = rgba(palette.ink, (200 / 255) * a)
    context.lineWidth = 1.1
    context.fillStyle = rgba(palette.paper, a)

    if (n.type === 'room') {
      const half = n.kind === 'core' ? 9 : n.kind === 'aggregation' ? 7.5 : 6.5
      if (n.kind === 'core') {
        context.fillStyle = rgba(palette.accent, a)
      }
      context.beginPath()
      context.rect(-half, -half, half * 2, half * 2)
      context.fill()
      context.stroke()

      if (n.kind !== 'core') {
        context.fillStyle = rgba(palette.accent, a)
        context.fillRect(half - 2, -half - 2, 3.5, 3.5)
      }

      if (n.label) label(n.label, half + 2, 10)
    } else if (n.type === 'base') {
      const r = 7
      context.beginPath()
      context.moveTo(0, -r)
      context.lineTo(r * 0.94, r * 0.72)
      context.lineTo(-r * 0.94, r * 0.72)
      context.closePath()
      context.fill()
      context.stroke()

      // 塔顶信号点
      context.fillStyle = rgba(palette.ink, (150 / 255) * a)
      context.beginPath()
      context.arc(0, -r - 3, 1.5, 0, Math.PI * 2)
      context.fill()

      if (n.label) label(n.label, r * 0.72 + 3, 9)
    } else if (n.type === 'device') {
      const r = n.kind === 'odf' ? 5.4 : 4.2
      context.save()
      context.rotate(Math.PI / 4)
      context.beginPath()
      context.rect(-r, -r, r * 2, r * 2)
      context.fill()
      context.stroke()
      context.restore()

      if (n.label) label(n.label, r + 4, 9)
    } else if (n.type === 'terminal') {
      context.beginPath()
      context.arc(0, 0, 5, 0, Math.PI * 2)
      context.fill()
      context.stroke()

      context.fillStyle = rgba(palette.ink, (110 / 255) * a)
      context.beginPath()
      context.arc(0, 0, 1.4, 0, Math.PI * 2)
      context.fill()
    } else {
      // 卫星：本体 + 两翼太阳板
      context.save()
      context.rotate(-0.28)
      context.fillStyle = rgba(palette.accent, a)
      context.beginPath()
      context.rect(-3, -4.5, 6, 9)
      context.fill()
      context.stroke()

      context.fillStyle = rgba(palette.paper, a)
      context.beginPath()
      context.rect(-11.5, -3.5, 6.5, 7)
      context.fill()
      context.stroke()

      context.beginPath()
      context.rect(5, -3.5, 6.5, 7)
      context.fill()
      context.stroke()

      context.beginPath()
      context.moveTo(-5, 0)
      context.lineTo(-3, 0)
      context.moveTo(3, 0)
      context.lineTo(5, 0)
      context.stroke()
      context.restore()

      if (n.label) label(n.label, 11, 9)
    }

    context.restore()
  }
}

function render() {
  if (!ctx || !canvas) return

  const total = CYCLE.grow + CYCLE.hold + CYCLE.fade + CYCLE.gap
  const t = cycleClock % total
  let fade = 1
  if (t > CYCLE.grow + CYCLE.hold) {
    fade = 1 - clamp((t - CYCLE.grow - CYCLE.hold) / CYCLE.fade, 0, 1)
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = rgba(palette.paper, 1)
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const scale = canvas.width / W
  ctx.setTransform(scale, 0, 0, scale, 0, 0)

  const terrainAlpha = Math.min(clamp(t / 700, 0, 1), fade)
  if (staticCanvas && terrainAlpha > 0.01) {
    ctx.globalAlpha = terrainAlpha
    ctx.drawImage(staticCanvas, 0, 0, W, H)
    ctx.globalAlpha = 1
  }

  drawEdges(ctx, fade)
  drawNodes(ctx, fade)
}

function tick(now: number) {
  const dt = lastFrame ? Math.min(now - lastFrame, 50) : 16
  lastFrame = now

  if (!paused.value) {
    artClock += dt
    cycleClock += dt

    const total = CYCLE.grow + CYCLE.hold + CYCLE.fade + CYCLE.gap
    if (cycleClock >= total) {
      rebuild(seed.value + 1)
    }
  }

  render()
  raf = requestAnimationFrame(tick)
}

// ═══════════════════════════════════════════════════════════════════════════
// 尺寸 / 主题 / 交互
// ═══════════════════════════════════════════════════════════════════════════

function resize() {
  if (!canvas) return
  const cssWidth = canvas.clientWidth || 920
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(cssWidth * dpr)
  canvas.height = Math.round(cssWidth * (H / W) * dpr)
  render()
}

function readTheme() {
  palette = readPalette()
  buildStatic()
  render()
}

function nextSeed() {
  rebuild(seed.value + 1 + Math.floor(Math.random() * 3))
}

function togglePause() {
  paused.value = !paused.value
  lastFrame = 0
}

let observer: MutationObserver | null = null
let resizeObserver: ResizeObserver | null = null
let media: MediaQueryList | null = null
let onMotion: (() => void) | null = null
let onVisibility: (() => void) | null = null

onMounted(() => {
  canvas = canvasRef.value
  if (!canvas) return

  ctx = canvas.getContext('2d')
  staticCanvas = document.createElement('canvas')
  staticCanvas.width = W * STATIC_SCALE
  staticCanvas.height = H * STATIC_SCALE
  staticCtx = staticCanvas.getContext('2d')

  reduced.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  paused.value = reduced.value

  readTheme()
  rebuild(seed.value)
  // 减弱动效时直接停在长成后的那一帧，而不是停在零秒的空场
  if (reduced.value) cycleClock = CYCLE.grow + CYCLE.hold

  resize()
  raf = requestAnimationFrame(tick)

  // 首帧画完再淡入，静态底图不会硬切
  requestAnimationFrame(() => {
    requestAnimationFrame(() => canvas?.classList.add('is-ready'))
  })

  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas)

  observer = new MutationObserver(() => readTheme())
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  media = window.matchMedia('(prefers-reduced-motion: reduce)')
  onMotion = () => {
    reduced.value = media!.matches
    if (reduced.value) {
      paused.value = true
      cycleClock = CYCLE.grow + CYCLE.hold
    }
  }
  media.addEventListener('change', onMotion)

  onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf)
      raf = 0
    } else if (!raf) {
      lastFrame = 0
      raf = requestAnimationFrame(tick)
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  raf = 0
  observer?.disconnect()
  resizeObserver?.disconnect()
  if (media && onMotion) media.removeEventListener('change', onMotion)
  if (onVisibility) document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style scoped>
.hero-topology {
  margin: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.hero-canvas {
  position: relative;
  width: 100%;
  aspect-ratio: 920 / 380;
  border: 1px solid var(--color-base-300);
  background-color: var(--color-base-100);
  background-image:
    linear-gradient(
      to right,
      color-mix(in oklab, var(--color-base-content) 4%, transparent) 1px,
      transparent 1px
    ),
    linear-gradient(
      to bottom,
      color-mix(in oklab, var(--color-base-content) 4%, transparent) 1px,
      transparent 1px
    );
  background-size: 20px 20px;
  overflow: hidden;
}

.hero-canvas canvas {
  display: block;
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 0.45s ease;
}

.hero-canvas canvas.is-ready {
  opacity: 1;
}

.hero-poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.poster-contour {
  fill: none;
  stroke: color-mix(in oklab, var(--color-base-content) 20%, transparent);
  stroke-width: 1;
}

.poster-edge {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
}

.poster-edge.fiber {
  stroke: var(--color-primary);
  opacity: 0.72;
}

.poster-edge.microwave {
  stroke: var(--color-warning);
  stroke-dasharray: 7 4.5;
  opacity: 0.8;
}

.poster-edge.wireless {
  stroke: var(--color-success);
  stroke-dasharray: 2 5.5;
  opacity: 0.8;
}

.poster-node circle,
.poster-base polygon,
.poster-device rect,
.poster-room rect,
.poster-sat rect {
  fill: var(--color-base-100);
  stroke: color-mix(in oklab, var(--color-base-content) 70%, transparent);
  stroke-width: 1.1;
}

.poster-core,
.poster-sat-body {
  fill: var(--color-accent);
  stroke: var(--color-accent);
}

.hero-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  margin-top: 0.5rem;
}

.hero-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.9rem;
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 70%, transparent);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.legend-swatch {
  width: 26px;
  height: 8px;
  flex: none;
}

.legend-swatch line {
  fill: none;
  stroke-width: 1.6;
}

.legend-swatch .fiber {
  stroke: var(--color-primary);
}

.legend-swatch .wireless {
  stroke: var(--color-success);
  stroke-dasharray: 1.5 4;
  stroke-linecap: round;
}

.legend-swatch .microwave {
  stroke: var(--color-warning);
  stroke-dasharray: 5 3.5;
}

.legend-node {
  width: 12px;
  height: 12px;
  flex: none;
}

.legend-node.legend-sat {
  width: 18px;
}

.legend-node rect,
.legend-node circle,
.legend-node polygon {
  fill: none;
  stroke: color-mix(in oklab, var(--color-base-content) 65%, transparent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.legend-node.legend-sat rect:first-child {
  fill: var(--color-accent);
}

.hero-actions {
  display: flex;
  gap: 0.35rem;
  flex: none;
}

.hero-btn {
  font: inherit;
  font-size: 11px;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.hero-btn:hover {
  border-color: var(--line-strong);
  background-color: color-mix(in oklab, var(--color-base-content) 6%, transparent);
}

.hero-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.hero-readout {
  margin-top: 0.4rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0 0.9rem;
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-muted);
}

.hero-readout-detail {
  color: var(--text-faint);
}

@media (prefers-reduced-motion: reduce) {
  .hero-btn,
  .hero-canvas canvas {
    transition: none;
  }
}

@media (max-width: 720px) {
  .hero-foot {
    flex-wrap: wrap;
  }

  .hero-legend {
    flex: 1 1 100%;
  }

  .hero-actions {
    margin-left: auto;
  }
}
</style>
