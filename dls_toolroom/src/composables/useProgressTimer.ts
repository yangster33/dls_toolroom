import { ref, readonly } from 'vue'

/** 追踪开始时间，根据当前进度百分比估算剩余时间 */
export function useProgressTimer() {
  const startTime = ref(0)
  const remainingText = ref('--')

  function start() {
    startTime.value = Date.now()
    remainingText.value = '--'
  }

  function update(percent: number) {
    if (percent <= 0 || startTime.value === 0) {
      remainingText.value = '--'
      return
    }

    const elapsed = (Date.now() - startTime.value) / 1000 // 秒
    const totalEstimated = elapsed / (percent / 100)
    const remaining = Math.max(0, totalEstimated - elapsed)

    if (remaining < 1) {
      remainingText.value = '< 1 秒'
    } else if (remaining < 60) {
      remainingText.value = `约 ${Math.ceil(remaining)} 秒`
    } else if (remaining < 3600) {
      const min = Math.floor(remaining / 60)
      const sec = Math.ceil(remaining % 60)
      remainingText.value = `约 ${min} 分 ${sec} 秒`
    } else {
      const hr = Math.floor(remaining / 3600)
      const min = Math.ceil((remaining % 3600) / 60)
      remainingText.value = `约 ${hr} 小时 ${min} 分`
    }
  }

  function reset() {
    startTime.value = 0
    remainingText.value = '--'
  }

  return {
    start,
    update,
    reset,
    remainingText: readonly(remainingText),
  }
}
