/**
 * 图框图签页的轻量状态提示（原 SheetTemplatePage.vue 的 status / flash）。
 */
import { ref } from 'vue'

export function useSheetStatus() {
  const status = ref('')
  let flashTimer: number | undefined

  function flash(message: string): void {
    status.value = message
    window.clearTimeout(flashTimer)
    flashTimer = window.setTimeout(() => {
      status.value = ''
    }, 2400)
  }

  function dispose(): void {
    window.clearTimeout(flashTimer)
  }

  return { status, flash, dispose }
}
