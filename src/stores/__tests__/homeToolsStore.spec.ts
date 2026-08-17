import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { useHomeToolsStore } from '../homeToolsStore'
import { toolConfigs } from '@/tools/toolData'

const allIds = toolConfigs.map((t) => t.id)

function createStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, String(v))
    },
    removeItem: (k) => {
      store.delete(k)
    },
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

describe('homeToolsStore - 初始化', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('无保存数据时按配置顺序初始化', () => {
    const store = useHomeToolsStore()
    expect(store.toolOrder).toEqual(allIds)
    expect(store.getOrderedTools()).toEqual(toolConfigs)
  })

  it('保存的无效 JSON 回退为配置顺序', () => {
    localStorage.setItem('home-tool-order', 'not-json{')
    const store = useHomeToolsStore()
    expect(store.toolOrder).toEqual(allIds)
  })

  it('保存的顺序有效则保留', () => {
    const reversed = [...allIds].reverse()
    localStorage.setItem('home-tool-order', JSON.stringify(reversed))
    const store = useHomeToolsStore()
    expect(store.toolOrder).toEqual(reversed)
    expect(store.getOrderedTools().map((t) => t.id)).toEqual(reversed)
  })

  it('保存顺序缺少或包含多余 id 时回退为配置顺序', () => {
    localStorage.setItem('home-tool-order', JSON.stringify([allIds[0]]))
    expect(useHomeToolsStore().toolOrder).toEqual(allIds)

    localStorage.setItem('home-tool-order', JSON.stringify([...allIds, 'bogus-id']))
    setActivePinia(createPinia())
    expect(useHomeToolsStore().toolOrder).toEqual(allIds)
  })
})

describe('homeToolsStore - 操作', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('updateOrder 更新顺序并持久化', async () => {
    const store = useHomeToolsStore()
    const reversed = [...allIds].reverse()
    store.updateOrder(reversed)
    expect(store.toolOrder).toEqual(reversed)
    await nextTick()
    expect(JSON.parse(localStorage.getItem('home-tool-order')!)).toEqual(reversed)
  })

  it('getOrderedTools 过滤不存在的 id', async () => {
    const store = useHomeToolsStore()
    store.updateOrder([allIds[0]!, 'ghost', allIds[1]!])
    await nextTick()
    expect(store.getOrderedTools().map((t) => t.id)).toEqual([allIds[0], allIds[1]])
  })
})