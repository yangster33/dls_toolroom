import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { toolConfigs, type ToolConfig } from '@/tools/toolData'

export const useHomeToolsStore = defineStore('homeTools', () => {
  const toolOrder = ref<string[]>([])

  const savedOrder = localStorage.getItem('home-tool-order')
  if (savedOrder) {
    try {
      toolOrder.value = JSON.parse(savedOrder)
      const allIds = toolConfigs.map((t) => t.id)
      const savedIds = toolOrder.value
      const missingIds = allIds.filter((id) => !savedIds.includes(id))
      const extraIds = savedIds.filter((id) => !allIds.includes(id))
      if (missingIds.length > 0 || extraIds.length > 0) {
        toolOrder.value = allIds
      }
    } catch {
      toolOrder.value = toolConfigs.map((t) => t.id)
    }
  } else {
    toolOrder.value = toolConfigs.map((t) => t.id)
  }

  watch(
    toolOrder,
    (newOrder) => {
      localStorage.setItem('home-tool-order', JSON.stringify(newOrder))
    },
    { deep: true }
  )

  const getOrderedTools = (): ToolConfig[] => {
    return toolOrder.value
      .map((id) => toolConfigs.find((t) => t.id === id))
      .filter((t): t is ToolConfig => t !== undefined)
  }

  const updateOrder = (newOrder: string[]) => {
    toolOrder.value = newOrder
  }

  return {
    toolOrder,
    getOrderedTools,
    updateOrder,
  }
})
