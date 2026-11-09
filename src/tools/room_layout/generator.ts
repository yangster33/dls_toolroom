/**
 * 机房平面图生成器（MVP）
 *
 * 结构：分区 → 横向机柜列 → 电源/电池/空调靠墙 → 主干+分支走线架 →
 * 每台机柜的曼哈顿束路由。约束修复采用「放不下就跳过并记 warning」，
 * 由 evaluate + SA 在多组 genome 中挑 Top 3。
 */
import {
  manhattan,
  overlapsAny,
  polygonArea,
  rectCenter,
  rectInsideRoom,
  roomOutline,
  snap10,
} from './geometry'
import type {
  CableBundle,
  CableKind,
  CabinetRow,
  Equipment,
  Genome,
  LayoutRules,
  LayoutSolution,
  Point,
  RoomParams,
  TraySegment,
} from './types'

const CABLE_KINDS: CableKind[] = ['ac', 'dc', 'fiber', 'signal']
const COLUMN_GRID = 6000

export interface BuildOptions {
  params: RoomParams
  rules: LayoutRules
  genome: Genome
}

export function buildLayout({ params, rules, genome }: BuildOptions): LayoutSolution {
  const outline = roomOutline(params)
  const roomArea = polygonArea(outline)
  const warnings: string[] = []
  const equipment: Equipment[] = []
  const rows: CabinetRow[] = []
  const trays: TraySegment[] = []
  const cables: CableBundle[] = []
  const columns: Equipment[] = []
  const reservedRatio = Math.min(Math.max(genome.reservedRatio, 0), 0.3)

  const leftZone = sideZone('left', genome, rules)
  const rightZone = sideZone('right', genome, rules)
  const acZone = params.acCount > 0 ? rules.acD + rules.acFront : 0
  const centralLeft = rules.perimeter + leftZone
  const centralRight = params.width - rules.perimeter - rightZone
  const centralTop = rules.perimeter
  const centralBottom = params.depth - rules.perimeter - acZone
  const centralW = centralRight - centralLeft
  const centralH = centralBottom - centralTop

  // 预留扩容：按比例缩可用机柜位
  const targetCabinets = Math.max(1, Math.round(params.cabinetCount * (1 - reservedRatio)))
  if (targetCabinets < params.cabinetCount) {
    warnings.push(
      `预留 ${Math.round(reservedRatio * 100)}% 扩容空间，本方案布置 ${targetCabinets} 台`,
    )
  }

  const maxPerRow = Math.max(1, Math.floor(centralW / rules.cabinetW))
  let perRow = Math.min(Math.max(genome.perRow, 1), maxPerRow)
  let rowCount = Math.ceil(targetCabinets / perRow)
  let totalHeight = rowCount * rules.cabinetD + aisleGapTotal(rowCount, rules)
  while (totalHeight > centralH && perRow < maxPerRow) {
    perRow += 1
    rowCount = Math.ceil(targetCabinets / perRow)
    totalHeight = rowCount * rules.cabinetD + aisleGapTotal(rowCount, rules)
  }

  if (centralW <= 0 || centralH <= 0 || totalHeight > centralH) {
    warnings.push('房间可用空间不足，无法按当前参数布置机柜列')
    return finalize({
      params,
      genome,
      outline,
      equipment,
      rows,
      trays,
      cables,
      warnings,
      roomArea,
      rules,
    })
  }

  const rowStartY = centralTop + Math.max(0, (centralH - totalHeight) / 2)
  const rowStartX = centralLeft + Math.max(0, (centralW - perRow * rules.cabinetW) / 2)

  let placed = 0
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const rowY = snap10(rowStartY + rowIndex * rules.cabinetD + aisleGapBefore(rowIndex, rules))
    const count = Math.min(perRow, targetCabinets - placed)
    if (count <= 0) break
    const rowId = `row-${String.fromCharCode(65 + rowIndex)}`
    const row: CabinetRow = {
      id: rowId,
      label: String.fromCharCode(65 + rowIndex),
      x: snap10(rowStartX),
      y: rowY,
      w: count * rules.cabinetW,
      h: rules.cabinetD,
      count: 0,
    }
    for (let i = 0; i < count; i += 1) {
      const rect = {
        x: snap10(row.x + i * rules.cabinetW),
        y: rowY,
        w: rules.cabinetW,
        h: rules.cabinetD,
      }
      if (!rectInsideRoom(rect, params, outline)) continue
      if (overlapsAny(rect, equipment)) continue
      const cab: Equipment = {
        ...rect,
        id: `cab-${row.label}-${String(i + 1).padStart(2, '0')}`,
        kind: 'cabinet',
        label: `${row.label}-${String(i + 1).padStart(2, '0')}`,
        rowId,
      }
      equipment.push(cab)
      row.count += 1
      placed += 1
    }
    if (row.count > 0) rows.push(row)
  }

  if (placed < targetCabinets) {
    warnings.push(`仅布置 ${placed}/${targetCabinets} 台机柜，剩余空间不足`)
  }
  for (const row of rows) {
    if (row.w > 6000) {
      warnings.push(`${row.label} 列长度 ${Math.round(row.w)}mm > 6m，建议两端设出口`)
    }
  }

  placePower(params, rules, genome, equipment, warnings)
  placeBattery(params, rules, genome, equipment, warnings)
  placeAc(params, rules, equipment, warnings)
  placeColumns(params, rules, outline, equipment, columns, warnings)
  const feeder = placeFeeder(params, rules, genome, rows, equipment)
  buildTrays(params, rules, rows, trays)
  buildCables(rows, trays, feeder, equipment, cables)

  return finalize({
    params,
    genome,
    outline,
    equipment,
    rows,
    trays,
    cables,
    warnings,
    roomArea,
    rules,
  })
}

function sideZone(side: 'left' | 'right', genome: Genome, rules: LayoutRules): number {
  let zone = 0
  if (genome.powerSide === side) zone += rules.powerD + rules.powerFront
  if (genome.batterySide === side) zone += rules.batteryD + rules.batteryAisle
  return zone
}

function aisleGapBefore(index: number, rules: LayoutRules): number {
  if (index === 0) return 0
  return index % 2 === 1 ? rules.coldAisle : rules.hotAisle
}

function aisleGapTotal(rows: number, rules: LayoutRules): number {
  let total = 0
  for (let i = 1; i < rows; i += 1) total += aisleGapBefore(i, rules)
  return total
}

function placePower(
  params: RoomParams,
  rules: LayoutRules,
  genome: Genome,
  equipment: Equipment[],
  warnings: string[],
): void {
  for (let i = 0; i < params.powerCount; i += 1) {
    const rect = {
      x:
        genome.powerSide === 'left'
          ? rules.perimeter
          : params.width - rules.perimeter - rules.powerD,
      y: snap10(rules.perimeter + i * (rules.powerW + 200)),
      w: rules.powerD,
      h: rules.powerW,
    }
    if (!rectInsideRoom(rect, params) || overlapsAny(rect, equipment)) {
      warnings.push(`电源柜 ${i + 1} 无法放入${genome.powerSide === 'left' ? '左' : '右'}侧墙`)
      continue
    }
    equipment.push({
      ...rect,
      id: `power-${i + 1}`,
      kind: 'power',
      label: `P${i + 1}`,
    })
  }
}

function placeBattery(
  params: RoomParams,
  rules: LayoutRules,
  genome: Genome,
  equipment: Equipment[],
  warnings: string[],
): void {
  for (let i = 0; i < params.batteryCount; i += 1) {
    const h = rules.batteryW
    const rect = {
      x:
        genome.batterySide === 'left'
          ? rules.perimeter
          : params.width - rules.perimeter - rules.batteryD,
      y: snap10(params.depth - rules.perimeter - h - i * (h + 200)),
      w: rules.batteryD,
      h,
    }
    if (!rectInsideRoom(rect, params) || overlapsAny(rect, equipment)) {
      warnings.push(`电池架 ${i + 1} 无法放入${genome.batterySide === 'left' ? '左' : '右'}侧墙`)
      continue
    }
    equipment.push({
      ...rect,
      id: `battery-${i + 1}`,
      kind: 'battery',
      label: `B${i + 1}`,
    })
  }
}

function placeAc(
  params: RoomParams,
  rules: LayoutRules,
  equipment: Equipment[],
  warnings: string[],
): void {
  for (let i = 0; i < params.acCount; i += 1) {
    const rect = {
      x: snap10(rules.perimeter + i * (rules.acW + 300)),
      y: params.depth - rules.perimeter - rules.acD,
      w: rules.acW,
      h: rules.acD,
    }
    if (!rectInsideRoom(rect, params) || overlapsAny(rect, equipment)) {
      warnings.push(`空调 ${i + 1} 无法放入南侧墙`)
      continue
    }
    equipment.push({
      ...rect,
      id: `ac-${i + 1}`,
      kind: 'ac',
      label: `AC${i + 1}`,
    })
  }
}

function placeColumns(
  params: RoomParams,
  rules: LayoutRules,
  outline: Point[],
  equipment: Equipment[],
  columns: Equipment[],
  warnings: string[],
): void {
  let index = 0
  for (let x = COLUMN_GRID; x < params.width; x += COLUMN_GRID) {
    for (let y = COLUMN_GRID; y < params.depth; y += COLUMN_GRID) {
      const rect = { x: x - 200, y: y - 200, w: 400, h: 400 }
      if (!rectInsideRoom(rect, params, outline)) continue
      if (overlapsAny(rect, equipment, rules.sideMaintenance)) {
        warnings.push(`柱网 (${x},${y}) 与设备冲突，已略去`)
        continue
      }
      const column: Equipment = {
        ...rect,
        id: `column-${(index += 1)}`,
        kind: 'column',
        label: 'C',
      }
      columns.push(column)
      equipment.push(column)
    }
  }
}

function placeFeeder(
  params: RoomParams,
  rules: LayoutRules,
  genome: Genome,
  rows: CabinetRow[],
  equipment: Equipment[],
): Equipment {
  const mainY = mainTrayY(rows, rules)
  const x =
    genome.powerSide === 'right'
      ? params.width - rules.perimeter - rules.powerD - 400
      : params.width - rules.perimeter - 400
  const rect = {
    x: Math.max(rules.perimeter, x),
    y: Math.max(rules.perimeter, snap10(mainY - 150)),
    w: 300,
    h: 300,
  }
  const feeder: Equipment = {
    ...rect,
    id: 'feeder-1',
    kind: 'feeder',
    label: '馈线窗',
  }
  if (rectInsideRoom(rect, params) && !overlapsAny(rect, equipment)) {
    equipment.push(feeder)
  }
  return feeder
}

function mainTrayY(rows: CabinetRow[], rules: LayoutRules): number {
  const first = rows[0]
  if (!first) return rules.perimeter + 300
  return Math.max(rules.perimeter + 200, snap10(first.y - 300))
}

function buildTrays(
  _params: RoomParams,
  rules: LayoutRules,
  rows: CabinetRow[],
  trays: TraySegment[],
): void {
  if (rows.length === 0) return
  const mainY = mainTrayY(rows, rules)
  const left = Math.min(...rows.map((row) => row.x))
  const right = Math.max(...rows.map((row) => row.x + row.w))
  trays.push({
    id: 'tray-main',
    x1: left,
    y1: mainY,
    x2: right,
    y2: mainY,
    width: rules.trayWidth,
    kind: 'main',
  })
  for (const row of rows) {
    const y = snap10(row.y - 150)
    trays.push({
      id: `tray-${row.id}`,
      x1: row.x,
      y1: y,
      x2: row.x + row.w,
      y2: y,
      width: rules.branchTrayWidth,
      kind: 'branch',
    })
    trays.push({
      id: `tray-${row.id}-link`,
      x1: row.x + row.w,
      y1: y,
      x2: row.x + row.w,
      y2: mainY,
      width: rules.branchTrayWidth,
      kind: 'branch',
    })
  }
}

function buildCables(
  rows: CabinetRow[],
  trays: TraySegment[],
  feeder: Equipment,
  equipment: Equipment[],
  cables: CableBundle[],
): void {
  const main = trays.find((tray) => tray.kind === 'main')
  if (!main) return
  const feederCenter = rectCenter(feeder)
  let index = 0
  for (const row of rows) {
    const branch = trays.find((tray) => tray.id === `tray-${row.id}`)
    const cabinets = equipment.filter((item) => item.kind === 'cabinet' && item.rowId === row.id)
    for (const cabinet of cabinets) {
      const center = rectCenter(cabinet)
      const branchY = branch ? branch.y1 : main.y1
      const points: Point[] = [
        center,
        { x: center.x, y: branchY },
        { x: feederCenter.x, y: branchY },
        { x: feederCenter.x, y: main.y1 },
        feederCenter,
      ]
      let length = 0
      for (let i = 1; i < points.length; i += 1) {
        length += manhattan(points[i - 1]!, points[i]!)
      }
      cables.push({
        id: `cable-${index}`,
        cabinetId: cabinet.id,
        kind: CABLE_KINDS[index % CABLE_KINDS.length]!,
        points,
        length,
      })
      index += 1
    }
  }
}

interface FinalizeInput {
  params: RoomParams
  genome: Genome
  outline: Point[]
  equipment: Equipment[]
  rows: CabinetRow[]
  trays: TraySegment[]
  cables: CableBundle[]
  warnings: string[]
  roomArea: number
  rules: LayoutRules
}

function finalize(input: FinalizeInput): LayoutSolution {
  const { params, genome, outline, equipment, rows, trays, cables, warnings, roomArea, rules } =
    input
  const equipmentArea = equipment
    .filter((item) => item.kind !== 'feeder' && item.kind !== 'column')
    .reduce((sum, item) => sum + item.w * item.h, 0)
  const cableLength = cables.reduce((sum, cable) => sum + cable.length, 0)
  const trayLength = trays.reduce(
    (sum, tray) => sum + manhattan({ x: tray.x1, y: tray.y1 }, { x: tray.x2, y: tray.y2 }),
    0,
  )
  const rowsWithCabinets = rows.filter((row) => row.count > 0).length
  const coldAisle = rowsWithCabinets > 1 ? rules.coldAisle : 0
  const hotAisle = rowsWithCabinets > 2 ? rules.hotAisle : 0
  const handling = rules.handlingAisle
  const placedCabinets = equipment.filter((item) => item.kind === 'cabinet').length
  const areaUtilization = roomArea > 0 ? equipmentArea / roomArea : 0
  const valid =
    placedCabinets >= Math.max(1, Math.round(params.cabinetCount * (1 - genome.reservedRatio))) &&
    equipment.every((item) => rectInsideRoom(item, params, outline)) &&
    !hasOverlap(equipment)
  const score =
    cableLength / 1000 + (trayLength / 1000) * 0.5 - areaUtilization * 20 + (valid ? 0 : 1000)
  return {
    id: `seed-${params.seed}-${genome.perRow}-${genome.powerSide}-${genome.batterySide}`,
    seed: params.seed,
    genome,
    room: params,
    outline,
    equipment,
    rows,
    trays,
    cables,
    metrics: {
      cabinetCount: placedCabinets,
      areaUtilization,
      cableLengthM: cableLength / 1000,
      trayLengthM: trayLength / 1000,
      coldAisle,
      hotAisle,
      handlingAisle: handling,
      score,
    },
    warnings,
    valid,
  }
}

function hasOverlap(equipment: Equipment[]): boolean {
  for (let i = 0; i < equipment.length; i += 1) {
    for (let j = i + 1; j < equipment.length; j += 1) {
      const a = equipment[i]!
      const b = equipment[j]!
      if (a.kind === 'column' && b.kind === 'feeder') continue
      if (overlapsAny(a, [b])) return true
    }
  }
  return false
}
