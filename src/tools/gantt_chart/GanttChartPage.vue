<!-- src/tools/gantt_chart/GanttChartPage.vue -->
<template>
  <div class="bg-base-100/70 backdrop-blur-sm rounded-lg shadow-lg p-4">
    <ErrorDialog
      :is-open="errorDialogOpen"
      :type="errorDialogType"
      :title="errorDialogTitle"
      :message="errorDialogMessage"
      @close="closeErrorDialog"
    />
    <h1 class="text-3xl font-bold mb-1">{{ toolConfig?.name || '甘特图' }}</h1>
    <p class="text-base-content/70">
      {{
        toolConfig?.description ||
        '基于 Frappe Gantt 的交互式甘特图工具，支持任务管理、依赖关系、进度追踪与多视图切换。'
      }}
    </p>

    <!-- 工具栏 -->
    <div class="bg-base-200/40 rounded-lg p-4 mb-4">
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
            {{
              store.currentViewMode === 'Hour'
                ? '时'
                : store.currentViewMode === 'Quarter Day' || store.currentViewMode === 'Half Day'
                  ? '半'
                  : store.currentViewMode === 'Day'
                    ? '日'
                    : store.currentViewMode === 'Week'
                      ? '周'
                      : store.currentViewMode === 'Month'
                        ? '月'
                        : '年'
            }}
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
        <button class="btn btn-sm btn-ghost" @click="scrollToToday" title="回到今天">
          <PhCalendarCheck :size="16" />
          <span class="hidden sm:inline ml-1">今天</span>
        </button>
        <button
          class="btn btn-sm btn-ghost"
          @click="undo"
          :disabled="undoStack.length === 0"
          title="撤销"
        >
          <PhArrowCounterClockwise :size="16" />
        </button>
        <button
          class="btn btn-sm btn-ghost"
          @click="redo"
          :disabled="redoStack.length === 0"
          title="重做"
        >
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
            <input
              type="checkbox"
              v-model="store.options.weekendHighlight"
              class="checkbox checkbox-xs"
              @change="applyWeekendOption"
            />
            <span class="text-xs">周末高亮</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              v-model="store.options.showTodayBtn"
              class="checkbox checkbox-xs"
              @change="updateGanttOptions"
            />
            <span class="text-xs">今天按钮</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              v-model="store.options.showViewModeSelect"
              class="checkbox checkbox-xs"
              @change="updateGanttOptions"
            />
            <span class="text-xs">内置视图选择</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              v-model="store.options.showExpectedProgress"
              class="checkbox checkbox-xs"
              @change="updateGanttOptions"
            />
            <span class="text-xs">预期进度</span>
          </label>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-base-content/60">吸附:</label>
          <select
            v-model="store.options.snapAt"
            class="select select-xs select-bordered"
            @change="updateGanttOptions"
          >
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
          <select
            v-model="store.options.lines"
            class="select select-xs select-bordered"
            @change="updateGanttOptions"
          >
            <option value="both">横纵都有</option>
            <option value="horizontal">横向</option>
            <option value="vertical">纵向</option>
            <option value="none">无</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-base-content/60">弹窗:</label>
          <select
            v-model="store.options.popupOn"
            class="select select-xs select-bordered"
            @change="updateGanttOptions"
          >
            <option value="click">点击</option>
            <option value="hover">悬停</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 甘特图容器 -->
    <div class="bg-base-100 rounded-lg mb-6 relative">
      <div ref="ganttContainer" class="gantt-container-wrapper"></div>
      <div
        v-if="isLoading"
        class="gantt-skeleton absolute inset-0 bg-base-100/90 flex items-center justify-center z-10"
      >
        <div class="text-center">
          <div
            class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"
          ></div>
          <p class="text-base-content/60">加载中...</p>
        </div>
      </div>
    </div>

    <!-- 任务列表表格 -->
    <div class="bg-base-200/40 rounded-lg p-4 mb-6">
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
                <button
                  class="btn btn-xs btn-ghost text-error"
                  @click="deleteTask(task.id)"
                  title="删除"
                >
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
    <div class="bg-base-200/40 rounded-lg p-4">
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
    <TaskEditModal
      ref="taskModal"
      :editing-task-id="editingTaskId"
      :default-color="defaultColorForNewTask"
      @save="onSaveTask"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, useTemplateRef } from 'vue'
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
import Gantt from 'frappe-gantt'
import './frappe-gantt.css'
logger.log('Gantt module loaded:', typeof Gantt, Gantt)
import { getToolById } from '../toolData'
import { useGanttStore, type GanttTask } from '@/stores/ganttStore'
import { logger } from '@/utils/logger'
import { formatLocalDate, computeNextTaskId, validateImportedTasks } from './ganttTaskUtils'
import { exportGanttSvg, exportGanttRaster, exportTasksAsJson } from './ganttSvgExport'
import { useGanttInstance } from './useGanttInstance'
import type { TaskFormValue } from './ganttTaskUtils'
import TaskEditModal from './TaskEditModal.vue'
import ErrorDialog from '@/components/common/ErrorDialog.vue'

const toolConfig = getToolById('gantt_chart')
const store = useGanttStore()

// ── 引用 ──
/** 任务编辑弹窗（D4 抽成 TaskEditModal.vue，页面只保留句柄） */
const taskModalRef = useTemplateRef<{
  openForCreate: () => void
  openForEdit: (task: GanttTask) => void
  close: () => void
}>('taskModal')

// ── 错误对话框状态 ──
const errorDialogOpen = ref(false)
const errorDialogType = ref<'error' | 'warning' | 'success' | 'info'>('error')
const errorDialogTitle = ref('操作失败')
const errorDialogMessage = ref('')

const closeErrorDialog = () => {
  errorDialogOpen.value = false
  errorDialogMessage.value = ''
}

const showErrorDialog = (
  type: 'error' | 'warning' | 'success' | 'info',
  title: string,
  message: string,
) => {
  errorDialogType.value = type
  errorDialogTitle.value = title
  errorDialogMessage.value = message
  errorDialogOpen.value = true
}

// ── Frappe Gantt 实例（生命周期抽到 useGanttInstance）──

/** 回到今天。包装成方法而非在模板里直接访问 ganttInstance：
 *  ganttInstance 是非响应式的实例句柄，模板直接读它拿不到稳定类型。 */
function scrollToToday() {
  ganttInstance.value?.scroll_current()
}

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

const {
  containerRef: ganttContainer,
  ganttInstance,
  isLoading,
  initGantt,
  reinitGantt,
  refreshGantt,
  switchViewMode,
  updateGanttOptions,
  applyWeekendOption,
  resetDragUndoFlag,
  disposeGantt,
} = useGanttInstance(store, allViewModes, {
  onEditTask: (taskId: string) => openEditTaskModal(taskId),
  onDeleteTask: (taskId: string) => deleteTask(taskId),
  onBeforeMutation: () => pushUndo(),
})

// ── 撤销/重做（不持久化）──
const undoStack = ref<GanttTask[][]>([])
const redoStack = ref<GanttTask[][]>([])

// ── 弹窗表单 ──
/** 正在编辑的任务 id（空 = 添加模式）。表单本体在 TaskEditModal 里 */
const editingTaskId = ref<string | null>(null)

// ── 工具函数 ──
const colorPalette = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#84cc16',
  '#6366f1',
]

function getDefaultColor(index: number): string {
  return colorPalette[index % colorPalette.length]!
}

// 使用本地时区格式化：旧的 toISOString() 是 UTC，在 UTC+8 的 00:00–08:00
// 之间会把日期算成「昨天」，导致排期整体少一天（审计 P1-12）
function formatDate(date: string | Date | number): string {
  return formatLocalDate(date)
}

function formatDependencies(deps: string | string[] | undefined): string {
  if (!deps) return ''
  if (Array.isArray(deps)) return deps.join(',')
  return deps
}

function pushUndo() {
  undoStack.value.push(JSON.parse(JSON.stringify(store.tasks)))
  redoStack.value = []
  // 与旧行为一致：入栈后允许下一次拖动重新记一次 undo
  resetDragUndoFlag()
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

// ── 任务 CRUD ──

// 旧实现 `while (some(...)) nextTaskId++` 在 nextTaskId 为 NaN 时会死循环
// （NaN++ 仍是 NaN，条件恒真 → 主线程永久阻塞）。computeNextTaskId 保证永不返回 NaN。
function getNextId(): string {
  const next = computeNextTaskId(store.tasks, store.nextTaskId)
  store.nextTaskId = next + 1
  return String(next)
}

/** 添加模式下的默认色（页面按当前任务数给，保持旧行为） */
const defaultColorForNewTask = computed(() => getDefaultColor(store.tasks.length))

function openAddTaskModal() {
  editingTaskId.value = null
  taskModalRef.value?.openForCreate()
}

function openEditTaskModal(taskId: string) {
  const task = store.tasks.find((t) => t.id === taskId)
  if (!task) return
  editingTaskId.value = taskId
  taskModalRef.value?.openForEdit(task)
}

/** 弹窗 @save：表单值 → 落库（撤销入栈 / 写 store / 刷新） */
function onSaveTask(form: TaskFormValue) {
  pushUndo()

  // 确保开始日期不晚于结束日期
  const start = form.start
  let end = form.end
  if (new Date(end) < new Date(start)) {
    end = start
  }

  const deps = form.dependencies
    ? form.dependencies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .join(',')
    : ''

  if (editingTaskId.value) {
    const idx = store.tasks.findIndex((t) => t.id === editingTaskId.value)
    // 先取局部变量再做展开：直接 {...store.tasks[idx]} 在 noUncheckedIndexedAccess
    // 下类型是「可能 undefined」，展开后会丢掉必填的 id（此前被 as any 掩盖）
    const existing = idx !== -1 ? store.tasks[idx] : undefined
    if (existing) {
      store.tasks[idx] = {
        ...existing,
        name: form.name,
        start,
        end,
        progress: form.progress,
        dependencies: deps,
        color: form.color,
        custom_class: form.custom_class,
      }
    }
  } else {
    const newTask: GanttTask = {
      id: getNextId(),
      name: form.name,
      start,
      end,
      progress: form.progress,
      dependencies: deps,
      color: form.color,
      custom_class: form.custom_class,
    }
    store.tasks.push(newTask)
  }

  refreshGantt()
}

function onTaskUpdate(taskId: string) {
  pushUndo()
  const task = store.tasks.find((t) => t.id === taskId)
  if (task && ganttInstance.value) {
    ganttInstance.value.update_task(taskId, { name: task.name })
  }
}

function updateTaskDate(taskId: string, field: 'start' | 'end', value: string) {
  pushUndo()
  const task = store.tasks.find((t) => t.id === taskId)
  if (!task || !ganttInstance.value) return

  const updates: Record<string, string> = { [field]: value }
  task[field] = value

  // 如果结束早于开始，把另一端也调成同一天
  if (new Date(task.end) < new Date(task.start)) {
    const other = field === 'start' ? 'end' : 'start'
    task[other] = value
    updates[other] = value
  }

  const internalTask = ganttInstance.value?.tasks.find((t: { id: string }) => t.id === taskId)
  if (internalTask) {
    delete internalTask._start
    delete internalTask._end
  }
  ganttInstance.value.update_task(taskId, updates)
}

function updateTaskProgress(taskId: string, progress: number) {
  pushUndo()
  const task = store.tasks.find((t) => t.id === taskId)
  if (task) {
    task.progress = progress
    if (ganttInstance.value) {
      ganttInstance.value.update_task(taskId, { progress })
    }
  }
}

function updateTaskDeps(taskId: string, depsStr: string) {
  pushUndo()
  const task = store.tasks.find((t) => t.id === taskId)
  if (!task || !ganttInstance.value) return

  const depsArray = depsStr
    ? depsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  task.dependencies = depsStr

  const gi = ganttInstance.value
  if (!gi) return
  gi.update_task(taskId, { dependencies: depsArray })
  gi.layers.arrow.innerHTML = ''
  gi.arrows = []
  gi.make_arrows()
  gi.map_arrows_on_bars()
}

function updateTaskColor(taskId: string, color: string) {
  pushUndo()
  const task = store.tasks.find((t) => t.id === taskId)
  if (!task || !ganttInstance.value) return
  task.color = color
  ganttInstance.value.update_task(taskId, { color })
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
/** 导出任务的上下文对象：容器 + 错误提示（页面已有的 showErrorDialog） */
function ganttExportContext() {
  return {
    container: ganttContainer.value,
    onError: (msg: string) => showErrorDialog('error', '导出失败', msg),
  }
}

function exportTasks() {
  exportTasksAsJson(store.tasks)
}

function exportSVG() {
  exportGanttSvg(ganttExportContext())
}

function exportPNG(scale = 2) {
  exportGanttRaster(ganttExportContext(), { format: 'png', scale })
}

function exportJPG(scale = 2, quality = 0.92) {
  exportGanttRaster(ganttExportContext(), { format: 'jpg', scale, quality })
}

function importTasks(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(e.target?.result as string)
    } catch {
      showErrorDialog('error', '导入失败', '文件不是合法的 JSON，请检查文件内容')
      return
    }

    // 必须做 schema 校验：旧实现直接 store.tasks = data，
    // 导致非数字 id → NaN → getNextId 死循环（标签页永久卡死），
    // 且任意字段会流入 frappe-gantt 的 innerHTML 造成 XSS（审计 P0-3）
    try {
      const tasks = validateImportedTasks(parsed)
      pushUndo()
      store.tasks = tasks
      store.nextTaskId = computeNextTaskId(tasks) + 1
      refreshGantt()
    } catch (err) {
      const message = err instanceof Error ? err.message : '文件内容不符合任务格式'
      showErrorDialog('error', '导入失败', message)
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
    {
      id: '1',
      name: '需求分析',
      start: d(-8),
      end: d(-2),
      progress: 100,
      dependencies: '',
      color: '#10b981',
      custom_class: '',
    },
    {
      id: '2',
      name: '架构设计',
      start: d(-5),
      end: d(3),
      progress: 80,
      dependencies: '1',
      color: '#3b82f6',
      custom_class: '',
    },
    {
      id: '3',
      name: '前端开发',
      start: d(1),
      end: d(14),
      progress: 30,
      dependencies: '2',
      color: '#f59e0b',
      custom_class: '',
    },
    {
      id: '4',
      name: '后端开发',
      start: d(2),
      end: d(12),
      progress: 45,
      dependencies: '2',
      color: '#8b5cf6',
      custom_class: '',
    },
    {
      id: '5',
      name: '集成测试',
      start: d(14),
      end: d(20),
      progress: 0,
      dependencies: '3,4',
      color: '#ef4444',
      custom_class: '',
    },
    {
      id: '6',
      name: '上线部署',
      start: d(21),
      end: d(23),
      progress: 0,
      dependencies: '5',
      color: '#ec4899',
      custom_class: '',
    },
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
  // 清掉节流定时器 + 销毁实例（都收在 composable 的 disposeGantt 里）
  disposeGantt()
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
