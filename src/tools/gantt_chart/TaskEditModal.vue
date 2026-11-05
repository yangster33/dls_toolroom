/** * 任务编辑弹窗（D4 第三步：从 `GanttChartPage.vue` 抽出） * * 抽出前，这个 dialog 元素的表单 DOM
与「打开/关闭/保存」逻辑散在页面模板与 * script 里（模板 78 行 + 表单状态与 CRUD 约 90
行）。抽成本组件后： * - 页面对弹窗只剩一行 TaskEditModal 的标签引用； * -
「表单长什么样」与「任务存在哪」解耦：组件只吐一个表单值，由页面落库。 * * 组件内部**不碰
store**：保存动作通过 `@save` 把表单值交给页面 * （页面负责 pushUndo / 写 store /
refreshGantt），便于单测与复用。 */
<template>
  <dialog ref="taskModal" class="modal">
    <div class="modal-box">
      <h3 class="text-lg font-bold mb-4">{{ isEditing ? '编辑任务' : '添加任务' }}</h3>
      <form @submit.prevent="onSubmit" class="space-y-3">
        <div class="form-control">
          <label class="label"><span class="label-text">任务名称</span></label>
          <input
            v-model="taskForm.name"
            class="input input-bordered"
            required
            placeholder="输入任务名称"
          />
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
            <input
              v-model.number="taskForm.progress"
              type="number"
              min="0"
              max="100"
              class="input input-bordered"
            />
            <progress
              class="progress progress-primary w-full mt-1"
              :value="taskForm.progress"
              max="100"
            ></progress>
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
            <input
              v-model="taskForm.color"
              type="color"
              class="w-full h-10 rounded cursor-pointer border-0"
            />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">自定义CSS类</span></label>
            <input
              v-model="taskForm.custom_class"
              class="input input-bordered"
              placeholder="可选"
            />
          </div>
        </div>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" @click="close">取消</button>
          <button type="submit" class="btn btn-primary">
            {{ isEditing ? '保存修改' : '添加' }}
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="close">
      <button>关闭</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { reactive, computed, useTemplateRef } from 'vue'
import { formatLocalDate, type TaskFormValue } from './ganttTaskUtils'
import { defaultTaskColor } from '@/data/taskPalette'

// 契约类型定义在同目录的 ganttTaskUtils.ts（见那里的说明：本 tsconfig 下
// 无法从 .vue 的 <script setup> 里 import 类型，故 SFC 对外契约放 .ts）

const props = defineProps<{
  /** 正在编辑的任务 id；为空表示「添加」模式 */
  editingTaskId?: string | null
  /** 添加模式下默认使用的颜色（由页面按当前任务数给出） */
  defaultColor?: string
}>()

const emit = defineEmits<{
  /** 保存：表单值 + 是否编辑既有任务 */
  (e: 'save', value: TaskFormValue): void
}>()

const dialogRef = useTemplateRef<HTMLDialogElement>('taskModal')
const taskForm = reactive<TaskFormValue>({
  name: '',
  start: '',
  end: '',
  progress: 0,
  dependencies: '',
  color: defaultTaskColor,
  custom_class: '',
})

const isEditing = computed(() => Boolean(props.editingTaskId))

/** 打开「添加任务」：默认今天起一周 */
function openForCreate(): void {
  const today = new Date()
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)

  Object.assign(taskForm, {
    name: '',
    start: formatLocalDate(today.toISOString()),
    end: formatLocalDate(nextWeek.toISOString()),
    progress: 0,
    dependencies: '',
    color: props.defaultColor ?? defaultTaskColor,
    custom_class: '',
  })
  dialogRef.value?.showModal()
}

/** 打开「编辑任务」：用既有任务填充表单 */
function openForEdit(task: {
  id: string
  name: string
  start: string
  end: string
  progress?: number
  dependencies?: string | string[]
  color?: string
  custom_class?: string
}): void {
  Object.assign(taskForm, {
    name: task.name,
    start: task.start,
    end: task.end,
    progress: task.progress || 0,
    dependencies: Array.isArray(task.dependencies)
      ? (task.dependencies as unknown as string[]).join(',')
      : task.dependencies || '',
    color: task.color || props.defaultColor || defaultTaskColor,
    custom_class: task.custom_class || '',
  })
  dialogRef.value?.showModal()
}

function close(): void {
  dialogRef.value?.close()
}

function onSubmit(): void {
  // 交给页面落库（页面负责 pushUndo / 写 store / 刷新甘特图）
  emit('save', { ...taskForm })
  close()
}

defineExpose({ openForCreate, openForEdit, close })
</script>
