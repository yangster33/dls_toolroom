import { ref, onUnmounted } from 'vue'

export function useCountUp(end: number, duration = 1000, start = 0) {
  const current = ref(start)
  let rafId = 0

  const animate = () => {
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress)
      current.value = Math.round(start + (end - start) * eased)

      if (progress < 1) {
        rafId = requestAnimationFrame(tick)
      }
    }

    rafId = requestAnimationFrame(tick)
  }

  animate()

  onUnmounted(() => {
    cancelAnimationFrame(rafId)
  })

  return current
}
