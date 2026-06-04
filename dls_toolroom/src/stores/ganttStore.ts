import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface GanttTask {
  id: string
  name: string
  start: string
  end: string
  progress: number
  dependencies?: string
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
