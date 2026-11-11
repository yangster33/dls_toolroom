import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, reactive } from 'vue'
import { useUiMode } from '../useUiMode'

interface Form {
  value: number
}

let keyCounter = 0

// jsdom 的 localStorage 在本项目测试环境里不可用，这里给一个最小实现
const storage = new Map<string, string>()

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
      clear: () => storage.clear(),
    },
  })
})

beforeEach(() => {
  storage.clear()
})

function mountHost(storageKey = `dls.test.ui-mode.${(keyCounter += 1)}`) {
  const Host = defineComponent({
    setup() {
      const form = reactive<Form>({ value: 1 })
      const api = useUiMode<Form>({
        storageKey,
        createSimple: () => ({ value: 1 }),
        createDefault: () => ({ value: 2 }),
        getForm: () => ({ ...form }),
        setForm: (next) => Object.assign(form, next),
      })
      return { form, ...api }
    },
    template: '<div />',
  })

  return { wrapper: mount(Host), storageKey }
}

describe('useUiMode', () => {
  it('默认简易，切到专业会换成专业默认值并写 storage', async () => {
    const { wrapper, storageKey } = mountHost()
    await nextTick()

    expect(wrapper.vm.isSimple).toBe(true)
    expect(wrapper.vm.form.value).toBe(1)

    wrapper.vm.setUiMode('professional')
    await nextTick()

    expect(wrapper.vm.isSimple).toBe(false)
    expect(wrapper.vm.form.value).toBe(2)
    expect(window.localStorage.getItem(storageKey)).toBe('professional')
  })

  it('切回简易再切专业，专业模式改过的值保留', async () => {
    const { wrapper } = mountHost()
    wrapper.vm.setUiMode('professional')
    await nextTick()

    wrapper.vm.form.value = 5
    wrapper.vm.setUiMode('simple')
    await nextTick()
    expect(wrapper.vm.form.value).toBe(1)

    wrapper.vm.setUiMode('professional')
    await nextTick()
    expect(wrapper.vm.form.value).toBe(5)
  })

  it('重置按当前模式恢复默认值，并同步快照', async () => {
    const { wrapper } = mountHost()
    wrapper.vm.setUiMode('professional')
    await nextTick()
    wrapper.vm.form.value = 9

    wrapper.vm.reset()
    await nextTick()
    expect(wrapper.vm.form.value).toBe(2)

    wrapper.vm.setUiMode('simple')
    wrapper.vm.setUiMode('professional')
    await nextTick()
    expect(wrapper.vm.form.value).toBe(2)
  })

  it('挂载时按 storage 恢复专业模式', async () => {
    const storageKey = 'dls.test.ui-mode.restore'
    window.localStorage.setItem(storageKey, 'professional')

    const { wrapper } = mountHost(storageKey)
    await nextTick()

    expect(wrapper.vm.isSimple).toBe(false)
    expect(wrapper.vm.form.value).toBe(2)
  })
})
