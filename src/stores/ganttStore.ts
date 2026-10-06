import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface GanttTask {
  id: string
  name: string
  start: string
  end: string
  progress: number
  /**
   * 依赖任务 id。
   * 运行时同时支持数组与逗号分隔字符串——`GanttChartPage.vue` 的
   * `formatDependencies` 与 tooltip 渲染都已对两种形态做分支处理，
   * 从导入 JSON 归一化出来的值是数组。此前的类型声明窄化为 `string`，
   * 与实际行为不符（审计报告 4.4 节「重复类型定义」问题）。
   */
  dependencies?: string | string[]
  color?: string
  color_progress?: string
  custom_class?: string
}

export const useGanttStore = defineStore(
  'gantt',
  () => {
    const tasks = ref<GanttTask[]>([])
    const currentViewMode = ref('Day')
    const barHeight = ref(30)
    const containerHeight = ref(400)
    const nextTaskId = ref(1)

    const options = ref({
      weekendHighlight: true,
      showTodayBtn: true,
      showViewModeSelect: false,
      showExpectedProgress: false,
      snapAt: '',
      lines: 'both' as string,
      popupOn: 'click' as string,
    })

    return { tasks, currentViewMode, barHeight, containerHeight, nextTaskId, options }
  },
  {
    persist: {
      key: 'gantt-store',
    },
  },
)
