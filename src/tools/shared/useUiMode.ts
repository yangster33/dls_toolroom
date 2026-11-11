import { computed, onMounted, ref } from 'vue'
import { useToast } from '@/composables/useToast'

export type UiMode = 'simple' | 'professional'

export interface UiModeOptions<T extends object> {
  /** localStorage 键，如 `dls.cable-sizing.ui-mode.v1` */
  storageKey: string
  createSimple: () => T
  createDefault: () => T
  /** 读取当前表单（页面持有的 reactive 对象） */
  getForm: () => T
  /** 用新值覆盖当前表单 */
  setForm: (next: T) => void
  /** 深拷贝（含数组字段时必传），默认浅拷贝 */
  clone?: (input: T) => T
  messages?: {
    toSimple?: string
    toProfessional?: string
    resetSimple?: string
    resetDefault?: string
  }
}

const DEFAULT_MESSAGES = {
  toSimple: '已切到简易模式：高级参数按固定值参与计算',
  toProfessional: '已切到专业模式：可继续调整高级参数',
  resetSimple: '已恢复简易模式默认参数',
  resetDefault: '已恢复默认参数',
} as const

/**
 * 简易 / 专业双模式的共用状态：快照、持久化、切换与重置。
 *
 * 页面仍持有自己的 `form`；这里只负责把切换前后的值存进快照并写回。
 * 派生字段（如蓄电池的 η_ah、U_min）留在页面自己的 watch 里。
 */
export function useUiMode<T extends object>(options: UiModeOptions<T>) {
  const toast = useToast()
  const clone = options.clone ?? ((input: T) => ({ ...input }) as T)
  const messages = { ...DEFAULT_MESSAGES, ...options.messages }

  const uiMode = ref<UiMode>('simple')
  const isSimple = computed(() => uiMode.value === 'simple')
  const snapshots: Record<UiMode, T> = {
    simple: options.createSimple(),
    professional: options.createDefault(),
  }

  function persist(mode: UiMode) {
    try {
      window.localStorage.setItem(options.storageKey, mode)
    } catch {
      /* localStorage 不可用时忽略 */
    }
  }

  function setUiMode(mode: UiMode, silent = false) {
    if (mode === uiMode.value) return
    snapshots[uiMode.value] = clone(options.getForm())
    uiMode.value = mode
    options.setForm(clone(snapshots[mode]))
    persist(mode)
    if (silent) return
    toast.info(mode === 'simple' ? messages.toSimple : messages.toProfessional)
  }

  function reset() {
    const next = isSimple.value ? options.createSimple() : options.createDefault()
    options.setForm(clone(next))
    snapshots[uiMode.value] = clone(next)
    toast.info(isSimple.value ? messages.resetSimple : messages.resetDefault)
  }

  onMounted(() => {
    try {
      if (window.localStorage.getItem(options.storageKey) === 'professional') {
        setUiMode('professional', true)
      }
    } catch {
      /* localStorage 不可用时忽略 */
    }
  })

  return { uiMode, isSimple, setUiMode, reset }
}
