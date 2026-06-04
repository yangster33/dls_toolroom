import { ref } from 'vue'

const visible = ref(false)
const doneRef = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

export function startProgress() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  visible.value = true
  doneRef.value = false
}

export function finishProgress() {
  doneRef.value = true
  hideTimer = setTimeout(() => {
    visible.value = false
    doneRef.value = false
  }, 400)
}

export function useProgressState() {
  return { visible, done: doneRef }
}
