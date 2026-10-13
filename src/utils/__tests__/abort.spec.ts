import { describe, it, expect } from 'vitest'
import { createAbortError, isAbortError, throwIfAborted } from '../abort'

describe('createAbortError', () => {
  it('name 为 AbortError（与平台 abort() 的默认 reason 同型）', () => {
    const error = createAbortError()
    expect(error.name).toBe('AbortError')
    expect(error.message).toBe('已取消')
  })

  it('可带自定义文案', () => {
    expect(createAbortError('已终止导入').message).toBe('已终止导入')
  })
})

describe('isAbortError', () => {
  it('识别 DOMException AbortError', () => {
    expect(isAbortError(createAbortError())).toBe(true)
  })

  it('识别普通 Error 但 name 被改成 AbortError 的情形（跨 realm 兜底）', () => {
    const error = new Error('x')
    error.name = 'AbortError'
    expect(isAbortError(error)).toBe(true)
  })

  it('普通 Error / 字符串 / null 都不是取消', () => {
    expect(isAbortError(new Error('boom'))).toBe(false)
    expect(isAbortError('AbortError')).toBe(false)
    expect(isAbortError(null)).toBe(false)
    expect(isAbortError(undefined)).toBe(false)
  })
})

describe('throwIfAborted', () => {
  it('未取消时什么都不做', () => {
    const controller = new AbortController()
    expect(() => throwIfAborted(controller.signal)).not.toThrow()
  })

  it('不传 signal 时什么都不做（可选参数路径行为不变）', () => {
    expect(() => throwIfAborted()).not.toThrow()
  })

  it('已取消时抛 AbortError', () => {
    const controller = new AbortController()
    controller.abort()
    expect(() => throwIfAborted(controller.signal)).toThrow(
      expect.objectContaining({ name: 'AbortError' }),
    )
  })
})
