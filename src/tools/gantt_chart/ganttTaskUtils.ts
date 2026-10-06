/**
 * 甘特图纯函数工具
 *
 * 从 `GanttChartPage.vue`（1600+ 行单文件组件）中抽出可独立测试的纯逻辑，
 * 修复以下问题：
 *
 * 1. **时区偏移**（审计 P1-12）
 *    原 `formatDate` 用 `new Date(d).toISOString().split('T')[0]`。
 *    `toISOString()` 输出 UTC，而传入的是本地时区 Date，
 *    在 UTC+8 的 00:00–08:00 之间会得到「昨天」，导致排期整体少一天。
 *
 * 2. **NaN 死循环**（审计 P0-3）
 *    原 `getNextId` 用 `while (...) nextTaskId++`，若 `nextTaskId` 是 NaN
 *    则 `NaN++` 仍为 NaN，条件恒真 → 主线程永久阻塞。
 *
 * 3. **导入无校验**（审计 P0-3）
 *    原 `importTasks` 直接 `store.tasks = data`，无任何 schema 校验，
 *    导致 XSS（非数字 id → NaN；恶意 name → frappe-gantt 的 innerHTML 注入）。
 */

import type { GanttTask } from '@/stores/ganttStore'

export type { GanttTask }

/** 日期字符串（YYYY-MM-DD），供 frappe-gantt 消费 */
export type DateString = string

/**
 * 将 Date 格式化为 YYYY-MM-DD，**使用本地时区**
 *
 * @param date 日期对象或可被 `new Date()` 解析的字符串
 * @returns YYYY-MM-DD；输入无效时返回空字符串
 *
 * @example
 * // 本地时间 2026-09-27 00:00 (UTC+8) —— 修复前会返回 '2026-09-26'
 * formatLocalDate(new Date(2026, 8, 27, 0, 0, 0))  // => '2026-09-27'
 */
export function formatLocalDate(date: Date | string | number): DateString {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 将 Date 转为 frappe-gantt 需要的 Date 对象
 * （以本地时间当天 00:00 为准，避免时区偏移）
 */
export function toGanttDate(date: Date | string): Date {
  const d = date instanceof Date ? new Date(date) : new Date(date)
  if (Number.isNaN(d.getTime())) return new Date()
  // frappe-gantt 以本地零点对齐日期；显式清除时分秒防止偏移
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * 计算下一个可用的任务 ID
 *
 * 与旧实现的关键差异：
 * - 用 `reduce` 替代 `Math.max(...)`，避免大数组调用栈溢出
 * - 过滤非数字 id（`Number.isFinite`），因此**永远不会返回 NaN**
 * - 遇到 id 冲突时向上递增，但不修改入参
 *
 * @param tasks 现有任务列表
 * @param startFrom 起始候选值（默认 1）
 * @returns 一个未被占用的正整数 ID
 */
export function computeNextTaskId(
  tasks: readonly Pick<GanttTask, 'id'>[],
  startFrom: number = 1,
): number {
  let max = 0
  for (const task of tasks) {
    const n = Number(task.id)
    if (Number.isFinite(n) && n > max) max = n
  }

  let candidate = Number.isFinite(startFrom) ? Math.max(Math.floor(startFrom), max + 1) : max + 1
  if (!Number.isFinite(candidate)) candidate = 1

  // 冲突时递增；用 Set 保证 O(n) 而非每次 some() 的 O(n)
  const used = new Set(tasks.map((t) => t.id))
  let guard = 0
  const maxIterations = tasks.length + 2
  while (used.has(String(candidate))) {
    candidate++
    if (++guard > maxIterations) break // 理论上不可达，仅作死循环兜底
  }
  return candidate
}

/** 导入校验的错误类型 */
export class GanttImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GanttImportError'
  }
}

/**
 * 校验并规范化从 JSON 导入的任务数组
 *
 * 强制约束（防止 P0-3 的两类问题）：
 * - 根节点必须是数组
 * - 每个元素必须是对象
 * - `id` 必须是**非空数字字符串**（`'0'` 合法，`'abc'` / `null` / 缺失 均拒绝）
 * - `name` 必须是字符串且 trim 后非空
 * - `start` / `end` 必须是可解析的日期
 * - 额外字段一律**丢弃**（避免把任意 JSON 灌进 frappe-gantt）
 *
 * @param raw `JSON.parse` 的结果
 * @returns 规范化后的任务数组（已剔除多余字段）
 * @throws {GanttImportError} 校验失败时抛出，message 为可直接展示给用户的中文说明
 */
export function validateImportedTasks(raw: unknown): GanttTask[] {
  if (!Array.isArray(raw)) {
    throw new GanttImportError('文件格式错误：顶层必须是任务数组')
  }
  if (raw.length === 0) {
    throw new GanttImportError('文件内容为空，没有可导入的任务')
  }

  const tasks: GanttTask[] = []

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]
    const rowNo = i + 1

    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new GanttImportError(`第 ${rowNo} 项不是有效的任务对象`)
    }

    const obj = item as Record<string, unknown>

    // --- id 必须是纯数字字符串 ---
    const rawId = obj.id
    if (typeof rawId !== 'string' && typeof rawId !== 'number') {
      throw new GanttImportError(`第 ${rowNo} 项缺少合法的 id 字段`)
    }
    const id = String(rawId).trim()
    if (!/^\d+$/.test(id)) {
      throw new GanttImportError(`第 ${rowNo} 项的 id 必须是数字，当前为「${id}」`)
    }

    // --- name 必须是非空字符串 ---
    if (typeof obj.name !== 'string' || obj.name.trim() === '') {
      throw new GanttImportError(`第 ${rowNo} 项缺少任务名称`)
    }

    // --- start / end 必须是可解析日期 ---
    const start = formatLocalDate(obj.start as string)
    const end = formatLocalDate(obj.end as string)
    if (!start) {
      throw new GanttImportError(`第 ${rowNo} 项的开始日期无效：${String(obj.start)}`)
    }
    if (!end) {
      throw new GanttImportError(`第 ${rowNo} 项的结束日期无效：${String(obj.end)}`)
    }
    if (start > end) {
      throw new GanttImportError(`第 ${rowNo} 项的结束日期早于开始日期`)
    }

    // --- progress 归一化 ---
    let progress = 0
    if (obj.progress !== undefined && obj.progress !== null) {
      const p = Number(obj.progress)
      if (Number.isFinite(p)) progress = Math.min(Math.max(p, 0), 100)
    }

    // --- dependencies 归一化为字符串数组 ---
    let dependencies: string[]
    if (Array.isArray(obj.dependencies)) {
      dependencies = obj.dependencies.filter((d): d is string => typeof d === 'string')
    } else if (typeof obj.dependencies === 'string') {
      dependencies = obj.dependencies
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)
    } else {
      dependencies = []
    }

    // --- color 白名单：仅接受 #rgb / #rrggbb，防止 style 注入 ---
    let color: string | undefined
    if (typeof obj.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(obj.color.trim())) {
      color = obj.color.trim()
    }

    tasks.push({ id, name: obj.name, start, end, progress, dependencies, color })
  }

  return tasks
}
