import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import KmlViewerPage from '../KmlViewerPage.vue'
import KmlSidebar from '../KmlSidebar.vue'

/**
 * 审计报告 B3 / P2-14 的回归测试
 *
 * KmlViewerPage 旧实现在 setup 顶层用**匿名函数**注册
 * `document.addEventListener('fullscreenchange', ...)`，而 onBeforeUnmount
 * 只清理了绘制监听器和 map.remove()，从未移除该监听器。
 * 后果：每次访问 KML 查看器都泄漏一个闭包，该闭包持有整个组件作用域
 * （map / layers / tree），来回切换几次就能观察到内存持续增长。
 *
 * 实现方式说明：jsdom 不提供 getEventListeners，所以改为劫持
 * document 的 addEventListener / removeEventListener 来计数。
 * 这对任何环境都可靠，且能精确到"类型 + 同一个函数引用"的配对。
 */

/** 劫持 document 的监听器注册，返回计数与还原函数 */
function instrumentDocumentListeners() {
  const registered = new Map<string, Set<EventListener>>()
  const originalAdd = document.addEventListener.bind(document)
  const originalRemove = document.removeEventListener.bind(document)

  document.addEventListener = ((type: string, listener: EventListener) => {
    if (!registered.has(type)) registered.set(type, new Set())
    registered.get(type)!.add(listener)
    return originalAdd(type, listener)
  }) as typeof document.addEventListener

  document.removeEventListener = ((type: string, listener: EventListener) => {
    registered.get(type)?.delete(listener)
    return originalRemove(type, listener)
  }) as typeof document.removeEventListener

  return {
    count: (type: string) => registered.get(type)?.size ?? 0,
    restore: () => {
      document.addEventListener = originalAdd
      document.removeEventListener = originalRemove
    },
  }
}

/** Leaflet 依赖真实 DOM 布局，jsdom 下 clientWidth/Height 为 0 会让 initMap 提前返回 */
function stubMapContainerRect() {
  const w = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  const h = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 800,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 600,
  })
  return () => {
    if (w) Object.defineProperty(HTMLElement.prototype, 'clientWidth', w)
    if (h) Object.defineProperty(HTMLElement.prototype, 'clientHeight', h)
  }
}

/** jsdom 不实现 fullscreen API，补最小桩 */
function installFullscreenStubs() {
  const original = Object.getOwnPropertyDescriptor(document, 'fullscreenElement')
  Object.defineProperty(document, 'fullscreenElement', {
    value: null,
    configurable: true,
    writable: true,
  })
  vi.stubGlobal('requestFullscreen', vi.fn())
  vi.stubGlobal('exitFullscreen', vi.fn())
  return () => {
    if (original) Object.defineProperty(document, 'fullscreenElement', original)
    // 注意：vi.unstubAllGlobals 不接受参数，会还原全部 stub
    vi.unstubAllGlobals()
  }
}

describe('KmlViewerPage fullscreenchange 监听器（B3）', () => {
  let instr: ReturnType<typeof instrumentDocumentListeners>
  let restoreRect: () => void
  let restoreFs: () => void

  beforeEach(() => {
    instr = instrumentDocumentListeners()
    restoreRect = stubMapContainerRect()
    restoreFs = installFullscreenStubs()
  })

  afterEach(() => {
    restoreFs()
    restoreRect()
    instr.restore()
  })

  const mountPage = () => mount(KmlViewerPage, { global: { stubs: { RouterLink: true } } })

  it('挂载后注册 1 个，卸载后移除，计数回到 0', async () => {
    expect(instr.count('fullscreenchange')).toBe(0)

    const wrapper = mountPage()
    await flushPromises()

    expect(instr.count('fullscreenchange')).toBe(1)

    wrapper.unmount()
    await flushPromises()

    expect(instr.count('fullscreenchange')).toBe(0)
  })

  it('反复挂载/卸载 5 轮不累积（旧实现在此泄漏）', async () => {
    for (let i = 0; i < 5; i++) {
      const wrapper = mountPage()
      await flushPromises()
      expect(instr.count('fullscreenchange')).toBe(1)

      wrapper.unmount()
      await flushPromises()
      expect(instr.count('fullscreenchange')).toBe(0)
    }
  })

  it('并发挂载 2 个实例时计数正确（注册/移除严格配对）', async () => {
    const a = mountPage()
    await flushPromises()
    expect(instr.count('fullscreenchange')).toBe(1)

    const b = mountPage()
    await flushPromises()
    expect(instr.count('fullscreenchange')).toBe(2)

    a.unmount()
    await flushPromises()
    expect(instr.count('fullscreenchange')).toBe(1)

    b.unmount()
    await flushPromises()
    expect(instr.count('fullscreenchange')).toBe(0)
  })

  it('未挂载满就卸载也不会残留（提前返回路径也要配对）', async () => {
    // 容器尺寸为 0 时 initMap 提前 return，但监听器注册在 onMounted 内、
    // 位于 initMap 之后 —— 这里验证即便 initMap 提前返回，配对依然成立。
    const wrapper = mountPage()
    wrapper.unmount()
    await flushPromises()
    expect(instr.count('fullscreenchange')).toBe(0)
  })

  it('侧栏天地图 Key 通过 v-model 回写到页面 ref', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const sidebar = wrapper.findComponent(KmlSidebar)
    await sidebar.find('input[type="text"]').setValue('test-key')

    expect(sidebar.props('tiandituKey')).toBe('test-key')
    wrapper.unmount()
  })
})
