/**
 * 甘特图实例生命周期（D4 第二步：从 `GanttChartPage.vue` 抽出 ~250 行）
 *
 * 抽出前，这些逻辑与 Vue 状态、任务 CRUD、撤销栈、错误弹窗缠在一起：
 * `initGantt` / `destroyGantt` / `reinitGantt` / `refreshGantt` /
 * `switchViewMode` / `updateGanttOptions` / `applyWeekendOption`，
 * 外加 frappe-gantt 的 popup 构造（那段同时是 XSS 防御的关键路径）。
 *
 * 抽出后本 composable 只依赖：
 *   - `store`（ganttStore：任务、视图模式、尺寸、选项）
 *   - 几个**页面侧回调**（编辑/删除任务、变更前入栈）——由调用方注入，
 *     避免这里反向 import 页面。
 *
 * ⚠ 含审计 B3 / P2-14 的**缓解**逻辑（reinit 节流）：frappe-gantt 构造时用
 * 匿名箭头函数注册 document mouseup 且不提供解绑 API，每 new Gantt() 一次
 * 就永久多一个 document 监听器。根治需要上游支持解绑或换库，已记入台账 D4 关联项。
 */
import { ref, type Ref } from 'vue'
import Gantt from 'frappe-gantt'
import type { FrappeGanttPopupContext, FrappeGanttInternalTask } from 'frappe-gantt'
import type { GanttTask } from '@/stores/ganttStore'
import type { useGanttStore } from '@/stores/ganttStore'
import { logger } from '@/utils/logger'
import { escapeHtml, formatLocalDate } from './ganttTaskUtils'
import { defaultTaskColor } from '@/data/taskPalette'

/** 页面侧需要注入的回调 */
export interface GanttInstanceHooks {
  /** 打开编辑任务弹窗 */
  onEditTask: (taskId: string) => void
  /** 删除任务 */
  onDeleteTask: (taskId: string) => void
  /** 任何会改动任务的用户操作**之前**调用一次（撤销栈入栈） */
  onBeforeMutation: () => void
}

/** store 里与本模块相关的字段（最小结构，便于测试） */
type GanttStoreLike = ReturnType<typeof useGanttStore>

/**
 * 甘特图实例生命周期。
 *
 * @param store ganttStore（任务 / 视图 / 尺寸 / 选项的唯一来源）
 * @param allViewModes 可选视图模式（名字进 frappe-gantt 的 view_modes）
 * @param hooks 页面侧回调
 */
export function useGanttInstance(
  store: GanttStoreLike,
  allViewModes: ReadonlyArray<{ name: string }>,
  hooks: GanttInstanceHooks,
) {
  const containerRef: Ref<HTMLElement | null> = ref(null)
  const ganttInstance: Ref<Gantt | null> = ref(null)
  const isLoading = ref(true)

  /** 拖动一次只入栈一次：frappe-gantt 的 on_date_change 会连续触发 */
  let dragUndoRecorded = false

  /**
   * 页面侧入栈后调用（对应旧 `pushUndo()` 里的 `dragUndoRecorded = false`）。
   *
   * 没有这一步会回归：一次拖动把标志置 true 后，之后任何工具栏操作
   * （保存/删除/清空）都不再重置它，导致**后续拖动不再记 undo**。
   */
  function resetDragUndoFlag(): void {
    dragUndoRecorded = false
  }

  /** store.tasks → frappe-gantt 的任务结构 */
  function toGanttTasks() {
    return store.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      start: t.start,
      end: t.end,
      progress: t.progress || 0,
      dependencies: t.dependencies || [],
      custom_class: t.custom_class || '',
      color: t.color,
      color_progress: t.color_progress,
    }))
  }

  function initGantt(): void {
    if (!containerRef.value) {
      logger.error('甘特图容器不存在')
      isLoading.value = false
      return
    }

    const savedMode = store.currentViewMode

    ganttInstance.value = new Gantt(containerRef.value, toGanttTasks(), {
      view_mode: store.currentViewMode,
      view_modes: allViewModes.map((m) => m.name),
      view_mode_select: store.options.showViewModeSelect,
      today_button: store.options.showTodayBtn,
      scroll_to: 'today',
      language: 'zh-CN',
      popup_on: store.options.popupOn,
      snap_at: store.options.snapAt || undefined,
      lines: store.options.lines,
      show_expected_progress: store.options.showExpectedProgress,
      readonly: false,
      readonly_dates: false,
      readonly_progress: false,
      move_dependencies: true,
      infinite_padding: true,
      arrow_curve: 5,
      bar_height: store.barHeight,
      bar_corner_radius: 3,
      container_height: store.containerHeight,
      padding: 18,
      popup: (ctx: FrappeGanttPopupContext) => {
        const t = ctx.task
        let dateFormat = 'yyyy-MM-dd'
        if (['Hour', 'Quarter Day', 'Half Day'].includes(store.currentViewMode)) {
          dateFormat = 'yyyy-MM-dd HH:mm'
        }

        const fmtDate = (d: string) => {
          const dt = new Date(d)
          const pad = (n: number) => String(n).padStart(2, '0')
          if (dateFormat === 'yyyy-MM-dd HH:mm') {
            return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
          }
          return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
        }

        const startStr = fmtDate(t.start)
        const endStr = fmtDate(t.end)
        const startMs = new Date(t.start).getTime()
        const endMs = new Date(t.end).getTime()
        const days = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24))
        const deps = t.dependencies
          ? Array.isArray(t.dependencies)
            ? t.dependencies.join(', ')
            : t.dependencies
          : '无'

        // frappe-gantt 的 set_title / set_subtitle / set_details 均走 innerHTML
        // （已核对 frappe-gantt.es.js:685,687,689），因此所有插入的动态值必须转义，
        // 否则导入的 JSON 中的任务名/依赖字段即可执行脚本（审计 P0-3）
        ctx.set_title(escapeHtml(t.name))

        // color 已在 validateImportedTasks 中做 #hex 白名单，此处再做一次防御
        const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(String(t.color || ''))
          ? t.color
          : defaultTaskColor
        const safeProgress = Math.min(Math.max(Number(t.progress) || 0, 0), 100)

        const progressBarHtml = `<div class="mt-1" style="background:color-mix(in oklab, var(--color-base-content) 12%, transparent);border-radius:2px;height:6px;width:100%;overflow:hidden"><div style="background:${safeColor};height:100%;width:${safeProgress}%;border-radius:2px;transition:width 0.3s"></div></div>`

        ctx.set_subtitle(
          `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">进度: ${safeProgress}%</div>${progressBarHtml}`,
        )
        ctx.set_details(
          `<div style="font-size:12px;line-height:1.8">
            <div><b>开始:</b> ${escapeHtml(startStr)}</div>
            <div><b>结束:</b> ${escapeHtml(endStr)}</div>
            <div><b>持续:</b> ${days} 天</div>
            <div><b>依赖:</b> ${escapeHtml(deps)}</div>
          </div>`,
        )

        ctx.add_action('编辑', (task: GanttTask) => {
          hooks.onEditTask(task.id)
        })
        ctx.add_action('删除', (task: GanttTask) => {
          hooks.onDeleteTask(task.id)
        })
      },
      on_click: () => {},
      on_date_change: (task: FrappeGanttInternalTask, start: Date, end: Date) => {
        if (!dragUndoRecorded) {
          hooks.onBeforeMutation()
          dragUndoRecorded = true
        }
        const idx = store.tasks.findIndex((t) => t.id === task.id)
        if (idx !== -1) {
          store.tasks[idx]!.start = formatLocalDate(start)
          store.tasks[idx]!.end = formatLocalDate(end)
        }
      },
      on_progress_change: (task: FrappeGanttInternalTask, progress: number) => {
        hooks.onBeforeMutation()
        const idx = store.tasks.findIndex((t) => t.id === task.id)
        if (idx !== -1) {
          store.tasks[idx]!.progress = Math.round(progress)
        }
      },
      on_view_change: (mode: string | { name: string }) => {
        store.currentViewMode = typeof mode === 'string' ? mode : mode.name
      },
    })

    if (savedMode !== store.currentViewMode) {
      ganttInstance.value.change_view_mode(savedMode)
      store.currentViewMode = savedMode
    }

    isLoading.value = false
  }

  function destroyGantt(): void {
    if (ganttInstance.value) {
      if (containerRef.value) {
        containerRef.value.innerHTML = ''
      }
      ganttInstance.value = null
    }
  }

  /**
   * 重建甘特图（带节流）。
   *
   * 背景（审计 B3 / P2-14）：frappe-gantt 构造函数内部用**匿名箭头函数**
   * 注册 document.addEventListener("mouseup", ...)，且库不提供任何解绑
   * API（clear() 只清 DOM，不动 document 上的监听器）。
   * 因此每 new Gantt() 一次就永久多一个 document 监听器，点 N 次缩放
   * = 累积 N 个监听器，各持有一份完整的 Gantt 对象图。
   *
   * 缩放按钮（barHeight ±5 / containerHeight ±60）会以 5px 粒度连续点击，
   * 逐次全量重建既慢又持续泄漏。这里用 trailing 节流把连续 pending 的
   * 重建请求合并为一次：500ms 内的多次调用只执行最后一次。
   *
   * 注意这是**缓解而非根治**——根治需要上游支持解绑或改用其它甘特库。
   */
  const REINIT_THROTTLE_MS = 500
  let reinitTimer: ReturnType<typeof setTimeout> | null = null
  let reinitPending = false

  function reinitGantt(): void {
    if (reinitTimer !== null) {
      // 已在节流窗口内，只记录"还有待处理的重建"
      reinitPending = true
      return
    }

    destroyGantt()
    initGantt()

    reinitTimer = setTimeout(() => {
      reinitTimer = null
      if (reinitPending) {
        reinitPending = false
        reinitGantt()
      }
    }, REINIT_THROTTLE_MS)
  }

  /** 组件卸载时清理节流定时器（避免卸载后仍触发重建） */
  function disposeGantt(): void {
    if (reinitTimer !== null) {
      clearTimeout(reinitTimer)
      reinitTimer = null
      reinitPending = false
    }
    destroyGantt()
  }

  function refreshGantt(): void {
    if (!ganttInstance.value) {
      initGantt()
      return
    }

    const gi = ganttInstance.value
    if (!gi) return
    if (gi.gantt_start && gi.gantt_end && store.tasks.length > 0) {
      const rs = new Date(gi.gantt_start).getTime()
      const re = new Date(gi.gantt_end).getTime()
      const outOfRange = store.tasks.some((t) => {
        return new Date(t.start).getTime() < rs || new Date(t.end).getTime() > re
      })
      if (outOfRange) {
        reinitGantt()
        return
      }
    }

    gi.refresh(toGanttTasks())
  }

  function switchViewMode(modeName: string): void {
    store.currentViewMode = modeName
    ganttInstance.value?.change_view_mode(modeName)
  }

  function updateGanttOptions(): void {
    if (!ganttInstance.value) return
    const savedMode = store.currentViewMode
    ganttInstance.value.update_options({
      view_mode_select: store.options.showViewModeSelect,
      today_button: store.options.showTodayBtn,
      snap_at: store.options.snapAt || undefined,
      lines: store.options.lines,
      show_expected_progress: store.options.showExpectedProgress,
      popup_on: store.options.popupOn,
    })
    if (store.currentViewMode !== savedMode) {
      ganttInstance.value.change_view_mode(savedMode)
      store.currentViewMode = savedMode
    }
  }

  function applyWeekendOption(): void {
    if (!ganttInstance.value) return
    const savedMode = store.currentViewMode
    if (store.options.weekendHighlight) {
      ganttInstance.value.update_options({
        holidays: { 'var(--g-weekend-highlight-color)': 'weekend' },
      })
    } else {
      ganttInstance.value.update_options({ holidays: {} })
    }
    if (store.currentViewMode !== savedMode) {
      ganttInstance.value.change_view_mode(savedMode)
      store.currentViewMode = savedMode
    }
  }

  return {
    containerRef,
    ganttInstance,
    isLoading,
    initGantt,
    destroyGantt,
    reinitGantt,
    refreshGantt,
    switchViewMode,
    updateGanttOptions,
    applyWeekendOption,
    resetDragUndoFlag,
    disposeGantt,
  }
}
