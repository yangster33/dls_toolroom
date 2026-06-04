import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useFlowingBackgroundStore = defineStore('flowingBackground', () => {
  const enabled = ref<boolean>(true)

  const savedEnabled = localStorage.getItem('flowing-background-enabled')
  if (savedEnabled !== null) {
    enabled.value = savedEnabled === 'true'
  }

  watch(
    enabled,
    (newValue) => {
      localStorage.setItem('flowing-background-enabled', String(newValue))
    },
    { immediate: true }
  )

  const toggle = () => {
    enabled.value = !enabled.value
  }

  const setEnabled = (value: boolean) => {
    enabled.value = value
  }

  return {
    enabled,
    toggle,
    setEnabled,
  }
})