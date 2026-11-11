import { ref } from 'vue'
import { useToast } from '@/composables/useToast'

/**
 * 复制计算书：写剪贴板、toast 反馈、短暂显示“已复制”。
 */
export function useCopyText(options: { ok?: string; error?: string; empty?: string } = {}) {
  const toast = useToast()
  const copied = ref(false)

  async function copy(text: string) {
    if (!text) {
      toast.error(options.empty ?? '暂无可复制的计算结果')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      toast.success(options.ok ?? '计算书已复制到剪贴板')
      window.setTimeout(() => {
        copied.value = false
      }, 1600)
    } catch {
      toast.error(options.error ?? '复制失败，请检查浏览器剪贴板权限')
    }
  }

  return { copied, copy }
}
