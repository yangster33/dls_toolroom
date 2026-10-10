import { describe, it, expect, vi, afterEach } from 'vitest'
import { useProgressTimer } from '../useProgressTimer'

describe('useProgressTimer', () => {
  const BASE = 1_000_000

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('未 start 时 update 显示占位符', () => {
    const timer = useProgressTimer()
    timer.update(50)
    expect(timer.remainingText.value).toBe('--')
  })

  it('start 重置显示占位符', () => {
    const timer = useProgressTimer()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(BASE)
    timer.start()
    expect(nowSpy).toHaveBeenCalled()
    expect(timer.remainingText.value).toBe('--')
  })

  it('percent <= 0 时显示占位符', () => {
    const timer = useProgressTimer()
    vi.spyOn(Date, 'now').mockReturnValue(BASE)
    timer.start()
    timer.update(0)
    expect(timer.remainingText.value).toBe('--')
  })

  it('剩余时间不足 1 秒显示 "< 1 秒"', () => {
    const timer = useProgressTimer()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(BASE)
    timer.start()
    nowSpy.mockReturnValue(BASE + 1000)
    timer.update(99)
    expect(timer.remainingText.value).toBe('< 1 秒')
  })

  it('剩余时间不足 1 分钟显示秒数', () => {
    const timer = useProgressTimer()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(BASE)
    timer.start()
    nowSpy.mockReturnValue(BASE + 10000)
    timer.update(50)
    expect(timer.remainingText.value).toBe('约 10 秒')
  })

  it('剩余时间在 1 分钟~1 小时内显示分秒', () => {
    const timer = useProgressTimer()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(BASE)
    timer.start()
    nowSpy.mockReturnValue(BASE + 70000)
    timer.update(50)
    expect(timer.remainingText.value).toBe('约 1 分 10 秒')
  })

  it('剩余时间超过 1 小时显示时分', () => {
    const timer = useProgressTimer()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(BASE)
    timer.start()
    nowSpy.mockReturnValue(BASE + 2000000)
    timer.update(25)
    expect(timer.remainingText.value).toBe('约 1 小时 40 分')
  })

  it('reset 清空时间并显示占位符', () => {
    const timer = useProgressTimer()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(BASE)
    timer.start()
    nowSpy.mockReturnValue(BASE + 10000)
    timer.update(50)
    timer.reset()
    expect(timer.remainingText.value).toBe('--')
    timer.update(50)
    expect(timer.remainingText.value).toBe('--')
  })
})
