import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { useGeocodeStore } from '../geocodeStore'

/**
 * 审计报告 P2-12 的回归测试
 *
 * 原来是 `persist: true`，整个 state（含 apiKeys[].key 明文高德 API Key）
 * 都会以 JSON 写进 localStorage（key 为 `geocode`）。任何 XSS、恶意浏览器
 * 扩展或本地脚本都能读取，且跨会话长期留存。
 *
 * 现在改用白名单 `pick`，只持久化 queryOptions / enableBounds / bounds /
 * selectedFields，apiKeys 留在内存，用户每次会话自行输入。
 *
 * ── 踩坑记录（重要，都是真实调试结论） ────────────────────────────
 * 1. jsdom 的 localStorage 在此环境不完整（缺 getItem/setItem），
 *    必须 vi.stubGlobal 注入 mock。
 * 2. **Pinia 3.0.4 的插件安装语义**：`pinia.use(plugin)` 在没有 active app 时
 *    只是把 plugin 推进 `toBeInstalled` 队列；只有 `app.use(pinia)`（即
 *    `pinia.install()`）才会把它们移入 `_p`，而 store 创建时才读 `_p`。
 *    所以测试里只写 `createPinia() + pinia.use(plugin) + setActivePinia()`
 *    **插件根本不会执行**——`$persist` 恒为 undefined，写入库恒为空，
 *    「不含 Key」的断言会退化成空集合上的假绿。
 *    修正：用 createApp({...}).use(pinia) 触发 install，与 main.ts 一致。
 * 3. $subscribe 的 flush 是同步的，但 store 首次 hydrate 完成前的写入可能
 *    丢失，所以第 3 个用例显式断言「确有内容」以防前两条假绿。
 */

const KEY = 'sk-secret-amap-key-12345'

function installStorageMock() {
  const backing = new Map<string, string>()
  const storage = {
    getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
    setItem: (k: string, v: string) => void backing.set(k, String(v)),
    removeItem: (k: string) => void backing.delete(k),
    clear: () => backing.clear(),
    key: (i: number) => [...backing.keys()][i] ?? null,
    get length() {
      return backing.size
    },
  }
  vi.stubGlobal('localStorage', storage)
  return storage
}

function readPersisted(): Record<string, unknown> {
  const raw = localStorage.getItem('geocode')
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

/** 建立一个「插件已真正安装」的 pinia，与 main.ts 的 app.use(pinia) 等价 */
function setupPiniaWithPlugin() {
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)
  // 必须走 install() 才会把 toBeInstalled 里的插件搬进 _p（见踩坑记录 2）
  createApp({ render: () => null }).use(pinia)
  setActivePinia(pinia)
  return pinia
}

describe('geocodeStore 持久化范围（P2-12）', () => {
  beforeEach(() => {
    installStorageMock()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('填入 API Key 后，localStorage 里不出现该 Key', async () => {
    setupPiniaWithPlugin()
    const store = useGeocodeStore()
    store.updateApiKey('add', 0, { key: KEY, isValid: true })
    await nextTick()

    const persisted = readPersisted()
    expect(JSON.stringify(persisted)).not.toContain(KEY)
    expect(persisted).not.toHaveProperty('addConfig.apiKeys')
    expect(persisted).not.toHaveProperty('lonlatConfig.apiKeys')
  })

  it('内存里仍能读到 Key（功能不受影响）', () => {
    setupPiniaWithPlugin()
    const store = useGeocodeStore()
    store.updateApiKey('add', 0, { key: KEY, isValid: true })
    expect(store.addConfig.apiKeys[0]!.key).toBe(KEY)
  })

  it('持久化确有内容且只含白名单字段（防止上面两条假绿）', async () => {
    setupPiniaWithPlugin()
    const store = useGeocodeStore()
    store.updateQueryOptions('add', { delay: 4321 })
    store.updateSelectedFields('lonlat', ['province'])
    await nextTick()

    // 先确认真的写入了，否则「不含 Key」会是空集合上的假绿
    expect(localStorage.getItem('geocode')).toBeTruthy()

    const persisted = readPersisted()
    const add = persisted.addConfig as Record<string, unknown> | undefined
    const ll = persisted.lonlatConfig as Record<string, unknown> | undefined

    expect(add).toBeDefined()
    expect(add).toHaveProperty('queryOptions')
    expect(add).not.toHaveProperty('apiKeys')
    expect(ll).toHaveProperty('selectedFields')
    expect(ll).not.toHaveProperty('apiKeys')
  })
})
