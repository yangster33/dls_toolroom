<!-- src/tools/gantt_chart/GanttChartPage.vue -->
<template>
  <div class="p-6">
    <ErrorDialog
      :is-open="errorDialogOpen"
      :type="errorDialogType"
      :title="errorDialogTitle"
      :message="errorDialogMessage"
      @close="closeErrorDialog"
    />
    <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || '甘特图' }}</h1>
    <p class="text-base-content/70 mb-6">
      {{ toolConfig?.description || '基于 Frappe Gantt 的交互式甘特图工具，支持任务管理、依赖关系、进度追踪与多视图切换。' }}
    </p>

    <!-- 工具栏 -->
    <div class="bg-base-100 rounded-lg shadow-lg p-4 mb-4">
      <div class="flex flex-wrap items-center gap-3">
        <!-- 视图模式选择 -->
        <div class="join">
          <button
            v-for="mode in allViewModes"
            :key="mode.name"
            class="btn btn-sm join-item"
            :class="store.currentViewMode === mode.name ? 'btn-primary' : 'btn-ghost'"
            @click="switchViewMode(mode.name)"
          >
            {{ mode.label || mode.name }}
          </button>
        </div>

        <div class="divider divider-horizontal mx-1"></div>

        <!-- 缩放控制 -->
        <div class="join" title="时间视图缩放">
          <button class="btn btn-sm join-item btn-ghost" @click="zoomViewIn">
            <PhMagnifyingGlassPlus :size="16" />
          </button>
          <span class="btn btn-sm join-item no-animation pointer-events-none text-xs px-1">
            {{ store.currentViewMode === 'Hour' ? '时' : store.currentViewMode === 'Quarter Day' || store.currentViewMode === 'Half Day' ? '半' : store.currentViewMode === 'Day' ? '日' : store.currentViewMode === 'Week' ? '周' : store.currentViewMode === 'Month' ? '月' : '年' }}
          </span>
          <button class="btn btn-sm join-item btn-ghost" @click="zoomViewOut">
            <PhMagnifyingGlassMinus :size="16" />
          </button>
        </div>

        <div class="join" title="条形高度">
          <button class="btn btn-sm join-item btn-ghost" @click="zoomBarIn">
            <PhPlus :size="14" />
          </button>
          <span class="btn btn-sm join-item no-animation pointer-events-none text-xs px-1">条</span>
          <button class="btn btn-sm join-item btn-ghost" @click="zoomBarOut">
            <PhMinus :size="14" />
          </button>
        </div>

        <div class="join" title="视图大小">
          <button class="btn btn-sm join-item btn-ghost" @click="increaseHeight">
            <PhPlus :size="14" />
          </button>
          <span class="btn btn-sm join-item no-animation pointer-events-none text-xs px-1">视</span>
          <button class="btn btn-sm join-item btn-ghost" @click="decreaseHeight">
            <PhMinus :size="14" />
          </button>
        </div>

        <div class="divider divider-horizontal mx-1"></div>

        <!-- 功能按钮 -->
        <button class="btn btn-sm btn-ghost" @click="ganttInstance?.scroll_current()" title="回到今天">
          <PhCalendarCheck :size="16" />
          <span class="hidden sm:inline ml-1">今天</span>
        </button>
        <button class="btn btn-sm btn-ghost" @click="undo" :disabled="undoStack.length === 0" title="撤销">
          <PhArrowCounterClockwise :size="16" />
        </button>
        <button class="btn btn-sm btn-ghost" @click="redo" :disabled="redoStack.length === 0" title="重做">
          <PhArrowClockwise :size="16" />
        </button>
      </div>

      <!-- 任务操作行 -->
      <div class="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-base-300">
        <button class="btn btn-sm btn-primary" @click="openAddTaskModal">
          <PhPlus :size="16" />
          <span class="hidden sm:inline ml-1">添加任务</span>
        </button>
        <button class="btn btn-sm btn-ghost" @click="exportTasks">
          <PhDownload :size="16" />
          <span class="hidden sm:inline ml-1">导出JSON</span>
        </button>
        <button class="btn btn-sm btn-ghost" @click="exportSVG">
          <PhFileImage :size="16" />
          <span class="hidden sm:inline ml-1">导出SVG</span>
        </button>
        <button class="btn btn-sm btn-ghost" @click="() => exportPNG()">
          <PhImage :size="16" />
          <span class="hidden sm:inline ml-1">导出PNG</span>
        </button>
        <button class="btn btn-sm btn-ghost" @click="() => exportJPG()">
          <PhImage :size="16" />
          <span class="hidden sm:inline ml-1">导出JPG</span>
        </button>
        <label class="btn btn-sm btn-ghost cursor-pointer">
          <PhUpload :size="16" />
          <span class="hidden sm:inline ml-1">导入</span>
          <input type="file" accept=".json" class="hidden" @change="importTasks" />
        </label>
        <button class="btn btn-sm btn-ghost" @click="loadDemoData">
          <PhLightbulb :size="16" />
          <span class="hidden sm:inline ml-1">示例</span>
        </button>
        <button class="btn btn-sm btn-ghost text-error" @click="clearAllTasks">
          <PhTrash :size="16" />
          <span class="hidden sm:inline ml-1">清空</span>
        </button>
      </div>

      <!-- 高级设置行 -->
      <div class="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-base-300">
        <div class="flex items-center gap-2">
          <label class="text-xs text-base-content/60">视图选项:</label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" v-model="store.options.weekendHighlight" class="checkbox checkbox-xs" @change="applyWeekendOption" />
            <span class="text-xs">周末高亮</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" v-model="store.options.showTodayBtn" class="checkbox checkbox-xs" @change="updateGanttOptions" />
            <span class="text-xs">今天按钮</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" v-model="store.options.showViewModeSelect" class="checkbox checkbox-xs" @change="updateGanttOptions" />
            <span class="text-xs">内置视图选择</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" v-model="store.options.showExpectedProgress" class="checkbox checkbox-xs" @change="updateGanttOptions" />
            <span class="text-xs">预期进度</span>
          </label>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-base-content/60">吸附:</label>
          <select v-model="store.options.snapAt" class="select select-xs select-bordered" @change="updateGanttOptions">
            <option value="">无</option>
            <option value="1h">1小时</option>
            <option value="3h">3小时</option>
            <option value="6h">6小时</option>
            <option value="1d">1天</option>
            <option value="1w">1周</option>
            <option value="unit">按视图单位</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-base-content/60">线条:</label>
          <select v-model="store.options.lines" class="select select-xs select-bordered" @change="updateGanttOptions">
            <option value="both">横纵都有</option>
            <option value="horizontal">横向</option>
            <option value="vertical">纵向</option>
            <option value="none">无</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-base-content/60">弹窗:</label>
          <select v-model="store.options.popupOn" class="select select-xs select-bordered" @change="updateGanttOptions">
            <option value="click">点击</option>
            <option value="hover">悬停</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 甘特图容器 -->
    <div class="bg-base-100 rounded-lg shadow-lg mb-6 relative">
      <div
        ref="ganttContainer"
        class="gantt-container-wrapper"
      ></div>
      <div v-if="isLoading" class="gantt-skeleton absolute inset-0 bg-base-100/90 flex items-center justify-center z-10">
        <div class="text-center">
          <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p class="text-base-content/60">加载中...</p>
        </div>
      </div>
    </div>

    <!-- 任务列表表格 -->
    <div class="bg-base-100 rounded-lg shadow-lg p-4 mb-6">
      <h2 class="text-xl font-semibold mb-4">任务列表 ({{ store.tasks.length }})</h2>
      <div class="overflow-x-auto">
        <table class="table table-sm table-zebra">
          <thead>
            <tr>
              <th>ID</th>
              <th>名称</th>
              <th>开始日期</th>
              <th>结束日期</th>
              <th>进度</th>
              <th>依赖</th>
              <th>颜色</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(task, index) in store.tasks" :key="task.id">
              <td class="text-xs font-mono">{{ task.id }}</td>
              <td>
                <input
                  v-model="task.name"
                  class="input input-xs input-ghost w-full max-w-[150px]"
                  @blur="onTaskUpdate(task.id)"
                />
              </td>
              <td>
                <input
                  type="date"
                  :value="formatDate(task.start)"
                  class="input input-xs input-ghost"
                  data-field="start"
                  :data-task-id="task.id"
                  @change="onDateInput"
                />
              </td>
              <td>
                <input
                  type="date"
                  :value="formatDate(task.end)"
                  class="input input-xs input-ghost"
                  data-field="end"
                  :data-task-id="task.id"
                  @change="onDateInput"
                />
              </td>
              <td>
                <div class="flex items-center gap-1">
                  <input
                    type="range"
                    :value="task.progress || 0"
                    min="0"
                    max="100"
                    class="range range-xs range-primary w-16"
                    :data-task-id="task.id"
                    @input="onProgressInput"
                  />
                  <span class="text-xs w-8">{{ task.progress || 0 }}%</span>
                </div>
              </td>
              <td>
                <input
                  :value="formatDependencies(task.dependencies)"
                  class="input input-xs input-ghost w-full max-w-[100px]"
                  placeholder="逗号分隔"
                  :data-task-id="task.id"
                  @blur="onDepsBlur"
                />
              </td>
              <td>
                <input
                  type="color"
                  :value="task.color || getDefaultColor(index)"
                  class="w-6 h-6 rounded cursor-pointer border-0 p-0"
                  :data-task-id="task.id"
                  @change="onColorChange"
                />
              </td>
              <td>
                <button class="btn btn-xs btn-ghost text-error" @click="deleteTask(task.id)" title="删除">
                  <PhTrash :size="14" />
                </button>
              </td>
            </tr>
            <tr v-if="store.tasks.length === 0">
              <td colspan="8" class="text-center text-base-content/50 py-8">
                暂无任务，点击"添加任务"或"示例"开始
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 图例 -->
    <div class="bg-base-100 rounded-lg shadow-lg p-4 mb-6">
      <h2 class="text-lg font-semibold mb-3">快捷操作提示</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <div class="flex items-start gap-2">
          <kbd class="kbd kbd-xs">拖拽条形</kbd>
          <span class="text-base-content/70">改变任务开始/结束日期</span>
        </div>
        <div class="flex items-start gap-2">
          <kbd class="kbd kbd-xs">拖拽进度条</kbd>
          <span class="text-base-content/70">调整任务完成进度</span>
        </div>
        <div class="flex items-start gap-2">
          <kbd class="kbd kbd-xs">点击任务条</kbd>
          <span class="text-base-content/70">查看任务详情弹窗</span>
        </div>
        <div class="flex items-start gap-2">
          <kbd class="kbd kbd-xs">Ctrl+Z / Ctrl+Y</kbd>
          <span class="text-base-content/70">撤销 / 重做操作</span>
        </div>
      </div>
    </div>

    <!-- 添加/编辑任务弹窗 -->
    <dialog ref="taskModal" class="modal">
      <div class="modal-box">
        <h3 class="text-lg font-bold mb-4">{{ editingTaskId ? '编辑任务' : '添加任务' }}</h3>
        <form @submit.prevent="saveTask" class="space-y-3">
          <div class="form-control">
            <label class="label"><span class="label-text">任务名称</span></label>
            <input v-model="taskForm.name" class="input input-bordered" required placeholder="输入任务名称" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="form-control">
              <label class="label"><span class="label-text">开始日期</span></label>
              <input v-model="taskForm.start" type="date" class="input input-bordered" required />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">结束日期</span></label>
              <input v-model="taskForm.end" type="date" class="input input-bordered" required />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="form-control">
              <label class="label"><span class="label-text">进度 (%)</span></label>
              <input v-model.number="taskForm.progress" type="number" min="0" max="100" class="input input-bordered" />
              <progress class="progress progress-primary w-full mt-1" :value="taskForm.progress" max="100"></progress>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">依赖任务ID</span></label>
              <input
                v-model="taskForm.dependencies"
                class="input input-bordered"
                placeholder="用逗号分隔, 如: 1,2"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="form-control">
              <label class="label"><span class="label-text">颜色</span></label>
              <input v-model="taskForm.color" type="color" class="w-full h-10 rounded cursor-pointer border-0" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">自定义CSS类</span></label>
              <input v-model="taskForm.custom_class" class="input input-bordered" placeholder="可选" />
            </div>
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" @click="closeTaskModal">取消</button>
            <button type="submit" class="btn btn-primary">
              {{ editingTaskId ? '保存修改' : '添加' }}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop" @click="closeTaskModal">
        <button>关闭</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import {
  PhCalendarCheck,
  PhArrowCounterClockwise,
  PhArrowClockwise,
  PhPlus,
  PhMinus,
  PhDownload,
  PhUpload,
  PhLightbulb,
  PhTrash,
  PhMagnifyingGlassPlus,
  PhMagnifyingGlassMinus,
  PhFileImage,
  PhImage,
} from '@phosphor-icons/vue'
// @ts-ignore
import GanttModule from 'frappe-gantt'
import './frappe-gantt.css'

const Gantt = GanttModule.default || GanttModule
logger.log('Gantt module loaded:', typeof Gantt, Gantt)
import { getToolById } from '../toolData'
import { useGanttStore, type GanttTask } from '@/stores/ganttStore'
import { logger } from '@/utils/logger'
import ErrorDialog from '@/components/common/ErrorDialog.vue'

const toolConfig = getToolById('gantt_chart')
const store = useGanttStore()

// ── 引用 ──
const ganttContainer = ref<HTMLElement | null>(null)
const taskModal = ref<HTMLDialogElement | null>(null)
const isLoading = ref(true)

// ── 错误对话框状态 ──
const errorDialogOpen = ref(false)
const errorDialogType = ref<'error' | 'warning' | 'success' | 'info'>('error')
const errorDialogTitle = ref('操作失败')
const errorDialogMessage = ref('')

const closeErrorDialog = () => {
  errorDialogOpen.value = false
  errorDialogMessage.value = ''
}

const showErrorDialog = (type: 'error' | 'warning' | 'success' | 'info', title: string, message: string) => {
  errorDialogType.value = type
  errorDialogTitle.value = title
  errorDialogMessage.value = message
  errorDialogOpen.value = true
}

// ── Frappe Gantt 实例 ──
let ganttInstance: typeof Gantt | null = null

// ── 所有视图模式 ──
const allViewModes = [
  { name: 'Hour', label: '小时' },
  { name: 'Quarter Day', label: '半天' },
  { name: 'Half Day', label: '半天' },
  { name: 'Day', label: '日' },
  { name: 'Week', label: '周' },
  { name: 'Month', label: '月' },
  { name: 'Year', label: '年' },
]

// ── 撤销/重做（不持久化）──
const undoStack = ref<GanttTask[][]>([])
const redoStack = ref<GanttTask[][]>([])
let dragUndoRecorded = false

// ── 弹窗表单 ──
const editingTaskId = ref<string | null>(null)
const taskForm = ref({
  name: '',
  start: '',
  end: '',
  progress: 0,
  dependencies: '',
  color: '#3b82f6',
  custom_class: '',
})

// ── 工具函数 ──
const colorPalette = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
]

function getDefaultColor(index: number): string {
  return colorPalette[index % colorPalette.length]!
}

function formatDate(date: string): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toISOString().split('T')[0]!
}

function formatDependencies(deps: string | string[] | undefined): string {
  if (!deps) return ''
  if (Array.isArray(deps)) return deps.join(',')
  return deps
}

function pushUndo() {
  undoStack.value.push(JSON.parse(JSON.stringify(store.tasks)))
  redoStack.value = []
  dragUndoRecorded = false
  if (undoStack.value.length > 50) undoStack.value.shift()
}

function undo() {
  if (undoStack.value.length === 0) return
  redoStack.value.push(JSON.parse(JSON.stringify(store.tasks)))
  store.tasks = undoStack.value.pop()!
  refreshGantt()
}

function redo() {
  if (redoStack.value.length === 0) return
  undoStack.value.push(JSON.parse(JSON.stringify(store.tasks)))
  store.tasks = redoStack.value.pop()!
  refreshGantt()
}

// ── 缩放控制 ──

const MODE_LIST = allViewModes.map((m) => m.name)

function zoomViewIn() {
  const idx = MODE_LIST.indexOf(store.currentViewMode)
  if (idx > 0) switchViewMode(MODE_LIST[idx - 1]!)
}

function zoomViewOut() {
  const idx = MODE_LIST.indexOf(store.currentViewMode)
  if (idx < MODE_LIST.length - 1) switchViewMode(MODE_LIST[idx + 1]!)
}

function zoomBarIn() {
  store.barHeight = Math.min(60, store.barHeight + 5)
  reinitGantt()
}

function zoomBarOut() {
  store.barHeight = Math.max(12, store.barHeight - 5)
  reinitGantt()
}

function increaseHeight() {
  store.containerHeight = Math.min(1000, store.containerHeight + 60)
  reinitGantt()
}

function decreaseHeight() {
  store.containerHeight = Math.max(160, store.containerHeight - 60)
  reinitGantt()
}

// ── 模板事件处理 ──
function onDateInput(e: Event) {
  const el = e.target as HTMLInputElement
  updateTaskDate(el.dataset.taskId!, el.dataset.field! as 'start' | 'end', el.value)
}

function onProgressInput(e: Event) {
  const el = e.target as HTMLInputElement
  updateTaskProgress(el.dataset.taskId!, Number(el.value))
}

function onDepsBlur(e: FocusEvent) {
  const el = e.target as HTMLInputElement
  updateTaskDeps(el.dataset.taskId!, el.value)
}

function onColorChange(e: Event) {
  const el = e.target as HTMLInputElement
  updateTaskColor(el.dataset.taskId!, el.value)
}

// ── 甘特图操作 ──
function initGantt() {
  if (!ganttContainer.value) {
    logger.error('甘特图容器不存在')
    isLoading.value = false
    return
  }

  const savedMode = store.currentViewMode

  const ganttTasks = store.tasks.map((t) => ({
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

  ganttInstance = new Gantt(ganttContainer.value, ganttTasks, {
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
    popup: (ctx: any) => {
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
        ? (Array.isArray(t.dependencies) ? t.dependencies.join(', ') : t.dependencies)
        : '无'

      ctx.set_title(t.name)
      const progressBarHtml = `<div class="mt-1" style="background:#e5e7eb;border-radius:4px;height:6px;width:100%;overflow:hidden"><div style="background:${t.color || '#3b82f6'};height:100%;width:${t.progress || 0}%;border-radius:4px;transition:width 0.3s"></div></div>`

      ctx.set_subtitle(
        `<div style="font-size:12px;color:#6b7280;margin-top:4px">进度: ${t.progress || 0}%</div>${progressBarHtml}`,
      )
      ctx.set_details(
        `<div style="font-size:12px;line-height:1.8">
          <div><b>开始:</b> ${startStr}</div>
          <div><b>结束:</b> ${endStr}</div>
          <div><b>持续:</b> ${days} 天</div>
          <div><b>依赖:</b> ${deps}</div>
        </div>`,
      )

      ctx.add_action('编辑', (task: GanttTask) => {
        openEditTaskModal(task.id)
      })
      ctx.add_action('删除', (task: GanttTask) => {
        deleteTask(task.id)
      })
    },
    on_click: () => {},
    on_date_change: (task: any, start: Date, end: Date) => {
      if (!dragUndoRecorded) {
        pushUndo()
        dragUndoRecorded = true
      }
      const idx = store.tasks.findIndex((t) => t.id === task.id)
      if (idx !== -1) {
        store.tasks[idx]!.start = formatDate(start as any)
        store.tasks[idx]!.end = formatDate(end as any)
      }
    },
    on_progress_change: (task: any, progress: number) => {
      pushUndo()
      const idx = store.tasks.findIndex((t) => t.id === task.id)
      if (idx !== -1) {
        store.tasks[idx]!.progress = Math.round(progress)
      }
    },
    on_view_change: (mode: any) => {
      store.currentViewMode = typeof mode === 'string' ? mode : mode.name
    },
  })

  if (savedMode !== store.currentViewMode) {
    ganttInstance.change_view_mode(savedMode)
    store.currentViewMode = savedMode
  }
  
  isLoading.value = false
}

function destroyGantt() {
  if (ganttInstance) {
    if (ganttContainer.value) {
      ganttContainer.value.innerHTML = ''
    }
    ganttInstance = null
  }
}

function reinitGantt() {
  destroyGantt()
  nextTick(() => initGantt())
}

function refreshGantt() {
  if (!ganttInstance) {
    initGantt()
    return
  }

  const gi = ganttInstance as any
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

  const ganttTasks = store.tasks.map((t) => ({
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

  ganttInstance.refresh(ganttTasks)
}

function switchViewMode(modeName: string) {
  store.currentViewMode = modeName
  ganttInstance?.change_view_mode(modeName)
}

function updateGanttOptions() {
  if (!ganttInstance) return
  const savedMode = store.currentViewMode
  ganttInstance.update_options({
    view_mode_select: store.options.showViewModeSelect,
    today_button: store.options.showTodayBtn,
    snap_at: store.options.snapAt || undefined,
    lines: store.options.lines,
    show_expected_progress: store.options.showExpectedProgress,
    popup_on: store.options.popupOn,
  })
  if (store.currentViewMode !== savedMode) {
    ganttInstance.change_view_mode(savedMode)
    store.currentViewMode = savedMode
  }
}

function applyWeekendOption() {
  if (!ganttInstance) return
  const savedMode = store.currentViewMode
  if (store.options.weekendHighlight) {
    ganttInstance.update_options({
      holidays: { 'var(--g-weekend-highlight-color)': 'weekend' },
    })
  } else {
    ganttInstance.update_options({ holidays: {} })
  }
  if (store.currentViewMode !== savedMode) {
    ganttInstance.change_view_mode(savedMode)
    store.currentViewMode = savedMode
  }
}

// ── 任务 CRUD ──

function getNextId(): string {
  while (store.tasks.some((t) => t.id === String(store.nextTaskId))) {
    store.nextTaskId++
  }
  return String(store.nextTaskId++)
}

function openAddTaskModal() {
  editingTaskId.value = null
  const today = new Date()
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)
  taskForm.value = {
    name: '',
    start: formatDate(today.toISOString()),
    end: formatDate(nextWeek.toISOString()),
    progress: 0,
    dependencies: '',
    color: getDefaultColor(store.tasks.length),
    custom_class: '',
  }
  ;(taskModal.value as any)?.showModal()
}

function openEditTaskModal(taskId: string) {
  const task = store.tasks.find((t) => t.id === taskId)
  if (!task) return
  editingTaskId.value = taskId
  taskForm.value = {
    name: task.name,
    start: formatDate(task.start),
    end: formatDate(task.end),
    progress: task.progress || 0,
    dependencies: formatDependencies(task.dependencies),
    color: task.color || getDefaultColor(0),
    custom_class: task.custom_class || '',
  }
  ;(taskModal.value as any)?.showModal()
}

function closeTaskModal() {
  ;(taskModal.value as any)?.close()
  editingTaskId.value = null
}

function saveTask() {
  pushUndo()

  // 确保开始日期不晚于结束日期
  let start = taskForm.value.start
  let end = taskForm.value.end
  if (new Date(end) < new Date(start)) {
    end = start
  }

  const deps = taskForm.value.dependencies
    ? taskForm.value.dependencies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .join(',')
    : ''

  if (editingTaskId.value) {
    const idx = store.tasks.findIndex((t) => t.id === editingTaskId.value)
    if (idx !== -1) {
      store.tasks[idx] = {
        ...store.tasks[idx],
        name: taskForm.value.name,
        start,
        end,
        progress: taskForm.value.progress,
        dependencies: deps,
        color: taskForm.value.color,
        custom_class: taskForm.value.custom_class,
      } as any
    }
  } else {
    const newTask: GanttTask = {
      id: getNextId(),
      name: taskForm.value.name,
      start,
      end,
      progress: taskForm.value.progress,
      dependencies: deps,
      color: taskForm.value.color,
      custom_class: taskForm.value.custom_class,
    }
    store.tasks.push(newTask)
  }

  refreshGantt()
  closeTaskModal()
}

function onTaskUpdate(taskId: string) {
  pushUndo()
  const task = store.tasks.find((t) => t.id === taskId)
  if (task && ganttInstance) {
    ganttInstance.update_task(taskId, { name: task.name })
  }
}

function updateTaskDate(taskId: string, field: 'start' | 'end', value: string) {
  pushUndo()
  const task = store.tasks.find((t) => t.id === taskId)
  if (!task || !ganttInstance) return

  const updates: Record<string, string> = { [field]: value }
  ;(task as any)[field] = value

  // 如果结束早于开始，把另一端也调成同一天
  if (new Date(task.end) < new Date(task.start)) {
    const other = field === 'start' ? 'end' : 'start'
    ;(task as any)[other] = value
    updates[other] = value
  }

  const internalTask = (ganttInstance as any).tasks.find((t: any) => t.id === taskId)
  if (internalTask) {
    delete internalTask._start
    delete internalTask._end
  }
  ganttInstance.update_task(taskId, updates)
}

function updateTaskProgress(taskId: string, progress: number) {
  pushUndo()
  const task = store.tasks.find((t) => t.id === taskId)
  if (task) {
    task.progress = progress
    if (ganttInstance) {
      ganttInstance.update_task(taskId, { progress })
    }
  }
}

function updateTaskDeps(taskId: string, depsStr: string) {
  pushUndo()
  const task = store.tasks.find((t) => t.id === taskId)
  if (!task || !ganttInstance) return

  const depsArray = depsStr
    ? depsStr.split(',').map((s) => s.trim()).filter(Boolean)
    : []
  task.dependencies = depsStr

  const gi = ganttInstance as any
  gi.update_task(taskId, { dependencies: depsArray })
  gi.layers.arrow.innerHTML = ''
  gi.arrows = []
  gi.make_arrows()
  gi.map_arrows_on_bars()
}

function updateTaskColor(taskId: string, color: string) {
  pushUndo()
  const task = store.tasks.find((t) => t.id === taskId)
  if (!task || !ganttInstance) return
  task.color = color
  ganttInstance.update_task(taskId, { color })
}

function deleteTask(taskId: string) {
  pushUndo()
  store.tasks = store.tasks.filter((t) => t.id !== taskId)
  refreshGantt()
}

function clearAllTasks() {
  pushUndo()
  store.tasks = []
  store.nextTaskId = 1
  refreshGantt()
}

// ── 导入/导出 ──
function exportTasks() {
  const data = JSON.stringify(store.tasks, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const now = new Date()
  a.href = url
  a.download = `gantt-tasks-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function collectGanttCSS(): string {
  const parts: string[] = []

  // 收集内联 <style> 标签中的甘特图 CSS
  for (const styleEl of document.querySelectorAll('style')) {
    const text = styleEl.textContent || ''
    if (text.includes('gantt') || text.includes('--g-arrow-color')) {
      parts.push(text)
    }
  }

  // 收集外部样式表中的甘特图 CSS
  for (const sheet of document.styleSheets) {
    try {
      if (!sheet.cssRules) continue
      let css = ''
      for (const rule of sheet.cssRules) {
        css += rule.cssText + '\n'
      }
      if (css.includes('gantt') || css.includes('--g-arrow-color')) {
        parts.push(css)
      }
    } catch {
      // 跨域样式表无法访问，跳过
    }
  }

  // 注入当前主题的 CSS 变量计算值，确保导出的 SVG 与当前视图一致
  const ganttEl = ganttContainer.value?.querySelector('.gantt') as HTMLElement | null
  if (ganttEl) {
    const cs = window.getComputedStyle(ganttEl)
    const varNames = [
      '--g-arrow-color', '--g-bar-color', '--g-bar-border',
      '--g-tick-color-thick', '--g-tick-color', '--g-actions-background',
      '--g-border-color', '--g-text-muted', '--g-text-light', '--g-text-dark',
      '--g-progress-color', '--g-handle-color', '--g-weekend-label-color',
      '--g-expected-progress', '--g-header-background', '--g-row-color',
      '--g-row-border-color', '--g-today-highlight', '--g-popup-actions',
      '--g-weekend-highlight-color',
    ]
    let rootVars = ':root {\n'
    for (const name of varNames) {
      const value = cs.getPropertyValue(name).trim()
      if (value) {
        rootVars += `  ${name}: ${value};\n`
      }
    }
    rootVars += '}\n'
    parts.push(rootVars)

    // 同时注入 gv- 变量（frappe-gantt 运行时设置的）
    const gvNames = ['--gv-grid-height', '--gv-column-width', '--gv-upper-header-height', '--gv-lower-header-height']
    let gvVars = '.gantt-container {\n'
    for (const name of gvNames) {
      const value = cs.getPropertyValue(name).trim()
      if (value) {
        gvVars += `  ${name}: ${value};\n`
      }
    }
    gvVars += '}\n'
    parts.push(gvVars)
  }

  return parts.join('\n')
}

/**
 * 将 HTML 渲染的甘特图时间轴头部转换为 SVG 元素并插入到 SVG 顶部。
 * Frappe Gantt 的 .grid-header 是 HTML（非 SVG），直接导出 SVG 会丢失头部时间轴。
 */
function injectHeaderToSvg(svg: SVGSVGElement) {
  const gridHeader = ganttContainer.value?.querySelector('.grid-header') as HTMLElement | null
  if (!gridHeader) return 0

  const headerHeight = gridHeader.offsetHeight
  if (headerHeight === 0) return 0

  const headerCS = window.getComputedStyle(gridHeader)
  const headerBg = headerCS.backgroundColor || 'transparent'

  const svgWidth =
    parseFloat(svg.getAttribute('width') || '0') || svg.viewBox.baseVal.width || 800
  const svgHeight =
    parseFloat(svg.getAttribute('height') || '0') || svg.viewBox.baseVal.height || 400

  const upperTexts = gridHeader.querySelectorAll('.upper-text')
  const lowerTexts = gridHeader.querySelectorAll('.lower-text')

  const ns = 'http://www.w3.org/2000/svg'
  const g = document.createElementNS(ns, 'g')
  g.setAttribute('class', 'timeline-header')

  // 背景
  const bg = document.createElementNS(ns, 'rect')
  bg.setAttribute('x', '0')
  bg.setAttribute('y', '0')
  bg.setAttribute('width', String(svgWidth))
  bg.setAttribute('height', String(headerHeight))
  bg.setAttribute('fill', headerBg)
  g.appendChild(bg)

  // 底部分隔线
  const line = document.createElementNS(ns, 'line')
  line.setAttribute('x1', '0')
  line.setAttribute('y1', String(headerHeight - 1))
  line.setAttribute('x2', String(svgWidth))
  line.setAttribute('y2', String(headerHeight - 1))
  line.setAttribute('stroke', '#d4d4d4')
  line.setAttribute('stroke-width', '1')
  g.appendChild(line)

  // 转换 upper/lower text -> SVG text，同时处理今日高亮背景
  const appendSvgTexts = (texts: NodeListOf<Element>, _cls: string) => {
    texts.forEach((el) => {
      const htmlEl = el as HTMLElement
      const t = htmlEl.textContent?.trim()
      if (!t) return
      const s = window.getComputedStyle(htmlEl)
      const left = parseFloat(s.left) || parseFloat(htmlEl.style.left) || 0
      const top = parseFloat(s.top) || parseFloat(htmlEl.style.top) || 0
      const w = htmlEl.offsetWidth
      const h = htmlEl.offsetHeight

      // 今日高亮：为 .current-date-highlight 元素添加背景圆角矩形
      if (htmlEl.classList.contains('current-date-highlight')) {
        const hlBg = s.backgroundColor
        if (hlBg && hlBg !== 'rgba(0, 0, 0, 0)' && hlBg !== 'transparent') {
          const hl = document.createElementNS(ns, 'rect')
          hl.setAttribute('x', String(left + 2))
          hl.setAttribute('y', String(top + 2))
          hl.setAttribute('width', String(w - 4))
          hl.setAttribute('height', String(h - 4))
          hl.setAttribute('fill', hlBg)
          hl.setAttribute('rx', '4')
          g.appendChild(hl)
        }
      }

      const txt = document.createElementNS(ns, 'text')
      txt.setAttribute('x', String(left + w / 2))
      txt.setAttribute('y', String(top + h / 2))
      txt.setAttribute('text-anchor', 'middle')
      txt.setAttribute('dominant-baseline', 'central')
      txt.setAttribute('font-size', s.fontSize || '12px')
      txt.setAttribute('font-weight', s.fontWeight || '400')
      txt.setAttribute('fill', s.color || '#333')
      txt.textContent = t
      g.appendChild(txt)
    })
  }
  appendSvgTexts(upperTexts, 'upper-text')
  appendSvgTexts(lowerTexts, 'lower-text')

  // 找到第一个任务条的 y 坐标，确保头部和内容紧密贴合
  const bars = svg.querySelectorAll('.bar-wrapper .bar')
  let minBarY = 0
  bars.forEach((bar) => {
    const y = parseFloat(bar.getAttribute('y') || '0')
    if (!isNaN(y) && (minBarY === 0 || y < minBarY)) minBarY = y
  })

  // 让第一个 bar 紧贴头部下方（只留 2px 间距）
  const gap = 2
  const shiftY = headerHeight + gap - minBarY

  Array.from(svg.children).forEach((child) => {
    if (child === g) return
    const el = child as HTMLElement & { _shifted?: boolean }
    if ((el as any)._shifted) return
    ;(el as any)._shifted = true
    const cur = el.getAttribute('transform') || ''
    el.setAttribute('transform', (cur ? cur + ' ' : '') + `translate(0, ${shiftY})`)
  })

  svg.insertBefore(g, svg.firstChild)

  // 扩展 SVG 高度
  const newH = svgHeight + shiftY
  svg.setAttribute('height', String(newH))
  if (svg.hasAttribute('viewBox')) {
    const vb = svg.viewBox.baseVal
    svg.setAttribute('viewBox', `0 0 ${vb.width || svgWidth} ${newH}`)
  } else {
    svg.setAttribute('viewBox', `0 0 ${svgWidth} ${newH}`)
  }

  return shiftY
}

function cropEmptyDates(svg: SVGSVGElement) {
  const bars = svg.querySelectorAll('.bar-wrapper .bar')
  if (bars.length === 0) return

  let minX = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  bars.forEach((bar) => {
    const x = parseFloat(bar.getAttribute('x') || '0')
    const w = parseFloat(bar.getAttribute('width') || '0')
    const y = parseFloat(bar.getAttribute('y') || '0')
    const h = parseFloat(bar.getAttribute('height') || '0')
    if (!isNaN(x) && !isNaN(w)) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x + w)
    }
    if (!isNaN(y) && !isNaN(h)) {
      maxY = Math.max(maxY, y + h)
    }
  })
  if (!isFinite(minX) || !isFinite(maxX)) return

  const padX = 60
  const padY = 30
  const svgHeight = parseFloat(svg.getAttribute('height') || '0') || svg.viewBox.baseVal.height
  const origWidth = parseFloat(svg.getAttribute('width') || '0') || svg.viewBox.baseVal.width

  // 左右裁剪
  const cropX = Math.max(0, minX - padX)
  const cropW = Math.min(origWidth - cropX, maxX - cropX + padX)

  // 下方裁剪：去除最后一个任务条下方的空白
  const cropH = isFinite(maxY) ? Math.min(svgHeight, maxY + padY) : svgHeight

  if (cropW > 0 && cropW < origWidth) {
    svg.setAttribute('viewBox', `${cropX} 0 ${cropW} ${cropH}`)
    svg.setAttribute('width', String(Math.round(cropW)))
    svg.setAttribute('height', String(Math.round(cropH)))
  }
}



function exportSVG() {
  if (!ganttContainer.value) {
    showErrorDialog('error', '导出失败', '无法找到甘特图容器')
    return
  }

  const originalSvg = ganttContainer.value.querySelector('svg')
  if (!originalSvg) {
    showErrorDialog('error', '导出失败', '无法找到SVG元素，请确保甘特图已正确加载')
    return
  }

  // 深克隆 SVG，避免修改原始 DOM
  const svgClone = originalSvg.cloneNode(true) as SVGSVGElement
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  // 嵌入甘特图 CSS，使导出的 SVG 自带样式
  const cssText = collectGanttCSS()
  if (cssText) {
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    styleEl.textContent = `\n${cssText}\n`
    svgClone.insertBefore(styleEl, svgClone.firstChild)
  }

  // 注入 HTML 渲染的甘特图时间轴头部到 SVG
  injectHeaderToSvg(svgClone)

  // 裁剪无任务的空白日期区域（右侧）
  cropEmptyDates(svgClone)

  const serializer = new XMLSerializer()
  let svgString = serializer.serializeToString(svgClone)

  svgString = `<?xml version="1.0" encoding="UTF-8"?>\n${svgString}`

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const now = new Date()
  a.href = url
  a.download = `gantt-chart-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.svg`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function exportPNG(scale = 2) {
  if (!ganttContainer.value) {
    showErrorDialog('error', '导出失败', '无法找到甘特图容器')
    return
  }

  const originalSvg = ganttContainer.value.querySelector('svg')
  if (!originalSvg) {
    showErrorDialog('error', '导出失败', '无法找到SVG元素，请确保甘特图已正确加载')
    return
  }

  const svgClone = originalSvg.cloneNode(true) as SVGSVGElement
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const cssText = collectGanttCSS()
  if (cssText) {
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    styleEl.textContent = `\n${cssText}\n`
    svgClone.insertBefore(styleEl, svgClone.firstChild)
  }

  injectHeaderToSvg(svgClone)
  cropEmptyDates(svgClone)

  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(svgClone)

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const img = new Image()
  
  img.onload = () => {
    URL.revokeObjectURL(url)
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      showErrorDialog('error', '导出失败', '无法创建Canvas上下文')
      return
    }

    const canvasWidth = img.width * scale
    const canvasHeight = img.height * scale
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    ctx.scale(scale, scale)

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, img.width, img.height)
    ctx.drawImage(img, 0, 0)

    const dataUrl = canvas.toDataURL('image/png')
    const imageBlob = dataURLToBlob(dataUrl)
    
    if (!imageBlob) {
      showErrorDialog('error', '导出失败', '图片转换失败')
      return
    }

    const downloadUrl = URL.createObjectURL(imageBlob)
    const a = document.createElement('a')
    const now = new Date()
    a.href = downloadUrl
    a.download = `gantt-chart-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(downloadUrl)
  }
  
  img.onerror = (e) => {
    URL.revokeObjectURL(url)
    logger.error('SVG加载失败:', e)
    showErrorDialog('error', '导出失败', '图片转换失败，请检查控制台')
  }
  
  img.src = url
}

function dataURLToBlob(dataUrl: string): Blob | null {
  const parts = dataUrl.split(',')
  if (parts.length !== 2) return null
  
  const mime = parts[0]!.match(/:(.*?);/)
  if (!mime) return null
  
  const byteString = atob(parts[1]!)
  const arrayBuffer = new ArrayBuffer(byteString.length)
  const uint8Array = new Uint8Array(arrayBuffer)
  
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i)
  }
  
  return new Blob([uint8Array], { type: mime[1] })
}

function exportJPG(scale = 2, quality = 0.92) {
  if (!ganttContainer.value) {
    showErrorDialog('error', '导出失败', '无法找到甘特图容器')
    return
  }

  const originalSvg = ganttContainer.value.querySelector('svg')
  if (!originalSvg) {
    showErrorDialog('error', '导出失败', '无法找到SVG元素，请确保甘特图已正确加载')
    return
  }

  const svgClone = originalSvg.cloneNode(true) as SVGSVGElement
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const cssText = collectGanttCSS()
  if (cssText) {
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    styleEl.textContent = `\n${cssText}\n`
    svgClone.insertBefore(styleEl, svgClone.firstChild)
  }

  injectHeaderToSvg(svgClone)
  cropEmptyDates(svgClone)

  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(svgClone)

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const img = new Image()
  
  img.onload = () => {
    URL.revokeObjectURL(url)
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      showErrorDialog('error', '导出失败', '无法创建Canvas上下文')
      return
    }

    const canvasWidth = img.width * scale
    const canvasHeight = img.height * scale
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    ctx.scale(scale, scale)

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, img.width, img.height)
    ctx.drawImage(img, 0, 0)

    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    const imageBlob = dataURLToBlob(dataUrl)
    
    if (!imageBlob) {
      showErrorDialog('error', '导出失败', '图片转换失败')
      return
    }

    const downloadUrl = URL.createObjectURL(imageBlob)
    const a = document.createElement('a')
    const now = new Date()
    a.href = downloadUrl
    a.download = `gantt-chart-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(downloadUrl)
  }
  
  img.onerror = (e) => {
    URL.revokeObjectURL(url)
    logger.error('SVG加载失败:', e)
    showErrorDialog('error', '导出失败', '图片转换失败，请检查控制台')
  }
  
  img.src = url
}

function importTasks(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string)
      if (Array.isArray(data)) {
        pushUndo()
        store.tasks = data
        store.nextTaskId = Math.max(...data.map((t: GanttTask) => Number(t.id)), 0) + 1
        refreshGantt()
      }
    } catch {
      showErrorDialog('error', '导入失败', '文件格式错误，请导入有效的 JSON 文件')
    }
  }
  reader.readAsText(file)
  input.value = ''
}

function loadDemoData() {
  const today = new Date()
  const d = (offset: number) => {
    const dt = new Date(today)
    dt.setDate(dt.getDate() + offset)
    return formatDate(dt.toISOString())
  }

  pushUndo()
  store.nextTaskId = 7
  store.tasks = [
    { id: '1', name: '需求分析', start: d(-8), end: d(-2), progress: 100, dependencies: '', color: '#10b981', custom_class: '' },
    { id: '2', name: '架构设计', start: d(-5), end: d(3), progress: 80, dependencies: '1', color: '#3b82f6', custom_class: '' },
    { id: '3', name: '前端开发', start: d(1), end: d(14), progress: 30, dependencies: '2', color: '#f59e0b', custom_class: '' },
    { id: '4', name: '后端开发', start: d(2), end: d(12), progress: 45, dependencies: '2', color: '#8b5cf6', custom_class: '' },
    { id: '5', name: '集成测试', start: d(14), end: d(20), progress: 0, dependencies: '3,4', color: '#ef4444', custom_class: '' },
    { id: '6', name: '上线部署', start: d(21), end: d(23), progress: 0, dependencies: '5', color: '#ec4899', custom_class: '' },
  ]
  refreshGantt()
}

// ── 键盘快捷键 ──
function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    redo()
  }
}

// ── 主题监听 ──
function applyTheme() {
  const html = document.documentElement
  const isDark = html.getAttribute('data-theme')?.includes('dark') || false
  if (ganttContainer.value) {
    const wrapper = ganttContainer.value.querySelector('.gantt') as HTMLElement
    if (wrapper) {
      if (isDark) {
        wrapper.style.setProperty('--gv-bar-background', '#4f46e5')
        wrapper.style.setProperty('--gv-bar-border', '#6366f1')
        wrapper.style.setProperty('--gv-weekend-highlight-color', 'rgba(255,255,255,0.05)')
      } else {
        wrapper.style.removeProperty('--gv-bar-background')
        wrapper.style.removeProperty('--gv-bar-border')
        wrapper.style.removeProperty('--gv-weekend-highlight-color')
      }
    }
  }
}

const themeObserver = new MutationObserver(() => {
  applyTheme()
})

function performInit() {
  logger.log('开始执行甘特图初始化...')
  logger.log('store.tasks.length:', store.tasks.length)
  logger.log('ganttContainer.value:', ganttContainer.value)
  
  try {
    if (store.tasks.length === 0) {
      logger.log('任务列表为空，加载示例数据...')
      loadDemoData()
    } else {
      logger.log('任务列表有数据，直接初始化甘特图...')
      initGantt()
    }
  } catch (error) {
    logger.error('甘特图初始化失败:', error)
    isLoading.value = false
  }
}

// ── 生命周期 ──
onMounted(() => {
  logger.log('GanttChartPage mounted')
  
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })

  window.addEventListener('keydown', handleKeydown)
  
  setTimeout(() => {
    performInit()
  }, 100)
})

onUnmounted(() => {
  themeObserver.disconnect()
  window.removeEventListener('keydown', handleKeydown)
  destroyGantt()
})
</script>

<style>
/* Frappe Gantt 容器样式 */
.gantt-container-wrapper {
  width: 100%;
  contain: layout style;
}

/* 防止滚动链接导致横向滚动条乱跳 */
.gantt-container-wrapper .gantt-container {
  overscroll-behavior: contain;
}

/* 弹窗样式美化 */
.gantt-container-wrapper .popup-wrapper {
  z-index: 1000;
}

.gantt-container-wrapper .popup-wrapper .details-container {
  border-radius: 8px;
}

/* daisyUI 暗色模式适配 */
[data-theme*='dark'] .gantt-container-wrapper .gantt .grid-header {
  fill: oklch(var(--b2));
  color: oklch(var(--bc));
}

[data-theme*='dark'] .gantt-container-wrapper .gantt .grid-row {
  fill: oklch(var(--b1));
  color: oklch(var(--bc));
}

[data-theme*='dark'] .gantt-container-wrapper .gantt .row-line {
  stroke: oklch(var(--b3));
}

[data-theme*='dark'] .gantt-container-wrapper .gantt .tick {
  stroke: oklch(var(--b3));
}

[data-theme*='dark'] .gantt-container-wrapper .gantt .today-highlight {
  fill: oklch(var(--p) / 0.1);
}

/* 进度条拖拽手柄 */
.gantt-container-wrapper .gantt .handle {
  fill: #fff;
  stroke: #999;
}

/* popup 按钮样式 */
.gantt-container-wrapper .popup-wrapper .action-buttons a {
  color: oklch(var(--p)) !important;
  text-decoration: none;
  margin-right: 8px;
  cursor: pointer;
}

.gantt-container-wrapper .popup-wrapper .action-buttons a:hover {
  text-decoration: underline;
}
</style>
