import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useCountUp } from '../useCountUp'

let frames: FrameRequestCallback[] = []
let rafIds = 0
let cancelled: number[] = []
let clock = 0

beforeEach(() => {
  frames = []
  rafIds = 0
  cancelled = []
  clock = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb)
    return ++rafIds
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelled.push(id)
  })
  vi.stubGlobal('performance', { now: () => clock })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function runFrame(t: number) {
  const cb = frames.shift()
  if (!cb) throw new Error('没有待执行的帧')
  clock = t
  cb(t)
}

function mountWith(end: number, duration = 1000, start = 0) {
  const Comp = defineComponent({
    setup() {
      return { counter: useCountUp(end, duration, start) }
    },
    template: '<div/>',
  })
  const wrapper = mount(Comp)
  return {
    wrapper,
    value: () => wrapper.vm.counter as unknown as number,
  }
}

describe('useCountUp', () => {
  it('起始值为 start', () => {
    const { value } = mountWith(100, 1000, 50)
    expect(value()).toBe(50)
    runFrame(0)
    expect(value()).toBe(50)
  })

  it('缓动递增：中途为 ease-out 插值，结束时到达终值', () => {
    const { value } = mountWith(100)
    runFrame(0)
    expect(value()).toBe(0)
    runFrame(500)
    expect(value()).toBe(75)
    runFrame(1000)
    expect(value()).toBe(100)
  })

  it('到达终值后不再排新帧', () => {
    mountWith(100)
    runFrame(0)
    runFrame(500)
    runFrame(1000)
    expect(frames).toHaveLength(0)
  })

  it('从非零起始值计算', () => {
    const { value } = mountWith(100, 1000, 50)
    runFrame(500)
    expect(value()).toBe(88)
    runFrame(1000)
    expect(value()).toBe(100)
  })

  it('卸载时取消未完成的动画帧', () => {
    const { wrapper } = mountWith(100)
    runFrame(0)
    runFrame(500)
    wrapper.unmount()
    expect(cancelled).toEqual([rafIds])
  })

  it('小于终值的结果四舍五入', () => {
    const { value } = mountWith(10)
    runFrame(500)
    expect(value()).toBe(8)
  })
})
