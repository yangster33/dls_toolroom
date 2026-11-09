import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DlsComment from '../DlsComment.vue'

/**
 * 审计报告 B2 的组件级回归测试。
 *
 * DlsComment 在 onMounted 里发起评论/统计两个同源请求，响应回来后直接写 ref。
 * 若用户在请求进行中离开页面，回调仍会往已卸载的组件写状态。
 * 修复方式：onUnmounted 置 disposed = true，所有响应处理前先检查。
 *
 * 可观测性说明：`disposed` 是闭包变量，无法从外部直接读取；
 * 这里通过内部实例的 setupState 观察 `comments` ref 是否被写入——
 * 这正是「卸载后是否仍改状态」的直接证据。
 */

/** 可手动控制 resolve 时机的 fetch 桩 */
function makeDeferredFetch() {
  let resolveComments: ((v: unknown) => void) | null = null
  const commentsJson = new Promise((resolve) => {
    resolveComments = resolve
  })

  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input)
    if (url.startsWith('/api/comments')) {
      return Promise.resolve({ json: () => commentsJson })
    }
    // 统计 / 浏览量接口：立即返回空数据
    return Promise.resolve({ json: async () => ({ code: 0, data: {} }) })
  })

  return {
    fetchMock,
    resolveComments: (payload: unknown) => resolveComments?.(payload),
  }
}

function setupStateOf(wrapper: ReturnType<typeof mount>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (wrapper.vm as any).$.setupState as {
    comments: Array<{ id: string; content: string }>
    stats: { view_count: number }
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DlsComment 卸载后不再改状态（审计 B2）', () => {
  it('对照组：未卸载时响应正常写入（证明断言不是空的）', async () => {
    const { fetchMock, resolveComments } = makeDeferredFetch()
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(DlsComment, { props: { pageKey: 'demo' } })
    await flushPromises()
    const state = setupStateOf(wrapper)

    resolveComments({ code: 0, data: { list: [{ id: 'c1', content: '你好' }] } })
    await flushPromises()

    // 未卸载 → 正常写入。若这条失败，说明下面的断言会「假绿」。
    expect(state.comments).toHaveLength(1)

    wrapper.unmount()
  })

  it('请求进行中卸载 → 响应回来后不再写 comments', async () => {
    const { fetchMock, resolveComments } = makeDeferredFetch()
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(DlsComment, { props: { pageKey: 'demo' } })
    await flushPromises()
    const state = setupStateOf(wrapper)

    // 请求仍未返回时卸载
    wrapper.unmount()

    // 卸载后才返回
    resolveComments({ code: 0, data: { list: [{ id: 'c1', content: '你好' }] } })
    await flushPromises()

    expect(state.comments).toHaveLength(0)
  })

  it('挂载时只读统计，不再 POST /view（E3 浏览量双计）', async () => {
    const { fetchMock } = makeDeferredFetch()
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(DlsComment, { props: { pageKey: 'demo' } })
    await flushPromises()

    const viewPosts = fetchMock.mock.calls.filter(([input, init]) => {
      const url = typeof input === 'string' ? input : String(input)
      return url.endsWith('/view') && init?.method === 'POST'
    })
    expect(viewPosts).toHaveLength(0)

    wrapper.unmount()
  })

  it('反复挂载/卸载不会把迟到的响应写进任何一次实例', async () => {
    for (let i = 0; i < 3; i++) {
      const { fetchMock, resolveComments } = makeDeferredFetch()
      vi.stubGlobal('fetch', fetchMock)

      const wrapper = mount(DlsComment, { props: { pageKey: 'demo' } })
      await flushPromises()
      const state = setupStateOf(wrapper)

      wrapper.unmount()
      resolveComments({ code: 0, data: { list: [{ id: `c${i}`, content: 'x' }] } })
      await flushPromises()

      expect(state.comments).toHaveLength(0)
    }
  })
})
