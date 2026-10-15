import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  formatLocalDate,
  toGanttDate,
  computeNextTaskId,
  validateImportedTasks,
  GanttImportError,
  type GanttTask,
} from '../ganttTaskUtils'

describe('formatLocalDate', () => {
  it('本地午夜不偏移到前一天（审计 P1-12 核心回归）', () => {
    // 旧实现 toISOString() 在 UTC+8 会返回 '2026-09-26'
    const d = new Date(2026, 8, 27, 0, 0, 0)
    expect(formatLocalDate(d)).toBe('2026-09-27')
  })

  it('本地 00:00–08:00 全时段均返回当天', () => {
    for (const hour of [0, 1, 4, 7, 8]) {
      expect(formatLocalDate(new Date(2026, 8, 27, hour, 30))).toBe('2026-09-27')
    }
  })

  it('月/日补零', () => {
    expect(formatLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(formatLocalDate(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('接受 YYYY-MM-DD 字符串并原样返回（往返一致）', () => {
    expect(formatLocalDate('2026-09-27')).toBe('2026-09-27')
  })

  it('接受时间戳数字', () => {
    const d = new Date(2026, 8, 27, 12)
    expect(formatLocalDate(d.getTime())).toBe('2026-09-27')
  })

  it('无效输入返回空字符串而非 Invalid Date', () => {
    expect(formatLocalDate('not-a-date')).toBe('')
    expect(formatLocalDate(NaN)).toBe('')
    expect(formatLocalDate(new Date('xxx'))).toBe('')
  })
})

describe('toGanttDate', () => {
  it('清除时分秒，对齐本地零点', () => {
    const d = toGanttDate('2026-09-27T18:30:00')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8)
    expect(d.getDate()).toBe(27)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })

  it('无效输入回退到当前时间', () => {
    expect(Number.isNaN(toGanttDate('garbage').getTime())).toBe(false)
  })
})

describe('computeNextTaskId', () => {
  const task = (id: string) => ({ id })

  it('空列表从 1 开始', () => {
    expect(computeNextTaskId([])).toBe(1)
  })

  it('返回 max(id) + 1', () => {
    expect(computeNextTaskId([task('1'), task('2'), task('3')])).toBe(4)
  })

  it('非数字 id 被忽略，绝不返回 NaN（审计 P0-3 回归）', () => {
    // 旧实现 Math.max(...[NaN], 0) => NaN，且后续 while 死循环
    const result = computeNextTaskId([task('1'), task('abc'), task('3')])
    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBe(4)
  })

  it('全部为非数字 id 时返回 1，不返回 NaN', () => {
    const result = computeNextTaskId([task('a'), task('b')])
    expect(result).toBe(1)
  })

  it('startFrom 为 NaN 时不产生 NaN', () => {
    const result = computeNextTaskId([task('1')], NaN)
    expect(Number.isFinite(result)).toBe(true)
    expect(result).toBe(2)
  })

  it('startFrom 小于 max 时以 max+1 为准', () => {
    expect(computeNextTaskId([task('10')], 1)).toBe(11)
  })

  it('id 存在空洞时不会与已有 id 冲突', () => {
    const result = computeNextTaskId([task('1'), task('3')])
    expect(['1', '3']).not.toContain(String(result))
  })

  it('大数组不触发调用栈溢出（Math.max(...arr) 回归）', () => {
    const many = Array.from({ length: 200_000 }, (_, i) => task(String(i + 1)))
    expect(computeNextTaskId(many)).toBe(200_001)
  })

  it('不修改入参', () => {
    const tasks = [task('1'), task('2')]
    const snapshot = JSON.stringify(tasks)
    computeNextTaskId(tasks)
    expect(JSON.stringify(tasks)).toBe(snapshot)
  })
})

describe('validateImportedTasks', () => {
  const valid = {
    id: '1',
    name: '设计',
    start: '2026-09-01',
    end: '2026-09-05',
  }

  it('接受合法数组并返回规范化结果', () => {
    const result = validateImportedTasks([valid])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: '1',
      name: '设计',
      start: '2026-09-01',
      end: '2026-09-05',
    })
  })

  it('顶层非数组被拒绝（防 store.tasks 被整体污染）', () => {
    expect(() => validateImportedTasks({ tasks: [] })).toThrow(GanttImportError)
    expect(() => validateImportedTasks(null)).toThrow(/顶层必须是任务数组/)
  })

  it('空数组被拒绝', () => {
    expect(() => validateImportedTasks([])).toThrow(/没有可导入的任务/)
  })

  it('非数字 id 被拒绝（这是 NaN 死循环的根因）', () => {
    expect(() => validateImportedTasks([{ ...valid, id: 'abc' }])).toThrow(/id 必须是数字/)
    expect(() => validateImportedTasks([{ ...valid, id: null }])).toThrow(/合法的 id/)
    expect(() => validateImportedTasks([{ ...valid, id: undefined }])).toThrow(/合法的 id/)
  })

  it('数字型 id 被接受并规范化为字符串', () => {
    const result = validateImportedTasks([{ ...valid, id: 7 }])
    expect(result[0]!.id).toBe('7')
  })

  it('id 为 0 合法', () => {
    expect(validateImportedTasks([{ ...valid, id: '0' }])[0]!.id).toBe('0')
  })

  it('缺少 name 被拒绝', () => {
    expect(() => validateImportedTasks([{ ...valid, name: '' }])).toThrow(/缺少任务名称/)
    expect(() => validateImportedTasks([{ ...valid, name: '   ' }])).toThrow(/缺少任务名称/)
    expect(() => validateImportedTasks([{ ...valid, name: 123 }])).toThrow(/缺少任务名称/)
  })

  it('name 中的 HTML 被原样保留但不执行 —— 由渲染层负责转义', () => {
    // 解析层不修改用户数据；真正的防线在渲染层必须用 textContent / DOMPurify
    const result = validateImportedTasks([{ ...valid, name: '<img src=x onerror=alert(1)>' }])
    expect(result[0]!.name).toBe('<img src=x onerror=alert(1)>')
  })

  it('无效日期被拒绝', () => {
    expect(() => validateImportedTasks([{ ...valid, start: 'xxx' }])).toThrow(/开始日期无效/)
    expect(() => validateImportedTasks([{ ...valid, end: '' }])).toThrow(/结束日期无效/)
  })

  it('结束早于开始被拒绝', () => {
    expect(() =>
      validateImportedTasks([{ ...valid, start: '2026-09-10', end: '2026-09-01' }]),
    ).toThrow(/结束日期早于开始日期/)
  })

  it('progress 归一化到 0–100', () => {
    expect(validateImportedTasks([{ ...valid, progress: 150 }])[0]!.progress).toBe(100)
    expect(validateImportedTasks([{ ...valid, progress: -20 }])[0]!.progress).toBe(0)
    expect(validateImportedTasks([{ ...valid, progress: 'abc' }])[0]!.progress).toBe(0)
  })

  it('dependencies 支持数组与逗号字符串，统一为数组', () => {
    expect(
      validateImportedTasks([{ ...valid, dependencies: ['1', '2'] }])[0]!.dependencies,
    ).toEqual(['1', '2'])
    expect(validateImportedTasks([{ ...valid, dependencies: '1, 2 ,3' }])[0]!.dependencies).toEqual(
      ['1', '2', '3'],
    )
    expect(validateImportedTasks([valid])[0]!.dependencies).toEqual([])
  })

  it('color 白名单：拒绝 style 注入载荷（审计 P0-3 附带项）', () => {
    const evil = 'red;background:url(javascript:alert(1))'
    expect(validateImportedTasks([{ ...valid, color: evil }])[0]!.color).toBeUndefined()
    expect(validateImportedTasks([{ ...valid, color: '#3b82f6' }])[0]!.color).toBe('#3b82f6')
    expect(validateImportedTasks([{ ...valid, color: '#fff' }])[0]!.color).toBe('#fff')
  })

  it('额外字段被丢弃，不会灌进 frappe-gantt', () => {
    const result = validateImportedTasks([{ ...valid, evil: '<script>', _start: 1 }])
    expect(result[0]).not.toHaveProperty('evil')
    expect(result[0]).not.toHaveProperty('_start')
  })

  it('错误信息含行号，便于用户定位', () => {
    expect(() => validateImportedTasks([valid, { ...valid, id: 'x' }])).toThrow(/第 2 项/)
  })

  it('重复 id 被接受（computeNextTaskId 负责避让）', () => {
    const result = validateImportedTasks([valid, valid])
    expect(result).toHaveLength(2)
    expect(computeNextTaskId(result)).toBe(2)
  })

  it('典型导出文件可顺利导入', () => {
    const file = [
      { id: '1', name: '需求', start: '2026-09-01', end: '2026-09-03', progress: 100 },
      {
        id: '2',
        name: '开发',
        start: '2026-09-04',
        end: '2026-09-10',
        progress: 50,
        dependencies: '1',
      },
      {
        id: '3',
        name: '测试',
        start: '2026-09-11',
        end: '2026-09-12',
        progress: 0,
        dependencies: ['2'],
        color: '#22c55e',
      },
    ] satisfies GanttTask[]
    const result = validateImportedTasks(file)
    expect(result).toHaveLength(3)
    expect(computeNextTaskId(result)).toBe(4)
  })
})
describe('escapeHtml（D4 从 GanttChartPage 移入）', () => {
  // frappe-gantt 的 set_title/set_subtitle/set_details 直接赋 innerHTML，
  // 因此任务名/依赖字段里的 HTML 必须被转义（审计 P0-3）。
  it('转义 HTML 元字符', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;')
    expect(escapeHtml('"双引号" & \'单引号\'')).toBe('&quot;双引号&quot; &amp; &#39;单引号&#39;')
  })

  it('null / undefined → 空串（不出现 "null"/"undefined" 字样）', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('数字原样转字符串', () => {
    expect(escapeHtml(0)).toBe('0')
  })
})
