/**
 * 机房平面图生成器（MVP）——类型定义。
 *
 * 所有几何坐标使用 mm 整数；渲染时再缩放到 px。
 * 首版边界：矩形 / L 形房间、横向机柜列、四类设备、单主干+分支走线架、
 * 加权单目标模拟退火、Top 3 方案。
 */

export type RoomShape = 'rect' | 'L'
export type EquipmentKind = 'cabinet' | 'power' | 'battery' | 'ac' | 'column' | 'feeder'
export type CableKind = 'ac' | 'dc' | 'fiber' | 'signal'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export interface RoomParams {
  width: number
  depth: number
  shape: RoomShape
  /** L 形缺口宽/深（右上角） */
  notchW: number
  notchD: number
  cabinetCount: number
  powerCount: number
  batteryCount: number
  acCount: number
  seed: number
  /** 预留扩容比例 0~0.3 */
  reservedRatio: number
}

export interface Equipment extends Rect {
  id: string
  kind: EquipmentKind
  label: string
  rowId?: string
}

export interface CabinetRow {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
  count: number
}

export interface TraySegment {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  width: number
  kind: 'main' | 'branch'
}

export interface CableBundle {
  id: string
  cabinetId: string
  kind: CableKind
  points: Point[]
  length: number
}

export interface Genome {
  /** 每列机柜数 */
  perRow: number
  /** 电源区放在左/右 */
  powerSide: 'left' | 'right'
  /** 电池区放在左/右 */
  batterySide: 'left' | 'right'
  /** 预留比例（0~0.3） */
  reservedRatio: number
}

export interface Metrics {
  cabinetCount: number
  areaUtilization: number
  cableLengthM: number
  trayLengthM: number
  coldAisle: number
  hotAisle: number
  handlingAisle: number
  score: number
}

export interface LayoutSolution {
  id: string
  seed: number
  genome: Genome
  room: RoomParams
  outline: Point[]
  equipment: Equipment[]
  rows: CabinetRow[]
  trays: TraySegment[]
  cables: CableBundle[]
  metrics: Metrics
  warnings: string[]
  valid: boolean
}

export interface LayoutRules {
  cabinetW: number
  cabinetD: number
  cabinetH: number
  powerW: number
  powerD: number
  batteryW: number
  batteryD: number
  acW: number
  acD: number
  coldAisle: number
  hotAisle: number
  handlingAisle: number
  sideMaintenance: number
  perimeter: number
  powerFront: number
  batteryAisle: number
  acFront: number
  trayWidth: number
  branchTrayWidth: number
  trayFillRatio: number
}
