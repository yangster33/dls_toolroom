import { describe, it, expect, beforeEach } from 'vitest'
import {
  getBaiduHmId,
  initBaiduAnalytics,
  isTrackedHostname,
  trackPageview,
} from '../baiduAnalytics'

const SITE = 'https://dlslab.cn'

beforeEach(() => {
  window._hmt = undefined
  document.querySelectorAll('script[data-baidu-analytics]').forEach((el) => el.remove())
})

describe('百度统计接入', () => {
  it('未配置环境变量时使用内置站点 ID', () => {
    expect(getBaiduHmId()).toMatch(/^[0-9a-f]{32}$/)
  })

  it('只认站点域名及其子域名', () => {
    expect(isTrackedHostname('dlslab.cn', SITE)).toBe(true)
    expect(isTrackedHostname('www.dlslab.cn', SITE)).toBe(true)
    // 后缀伪装不算子域名
    expect(isTrackedHostname('dlslab.cn.evil.com', SITE)).toBe(false)
    expect(isTrackedHostname('localhost', SITE)).toBe(false)
    expect(isTrackedHostname('127.0.0.1', SITE)).toBe(false)
  })

  it('站点 URL 非法时一律不上报', () => {
    expect(isTrackedHostname('dlslab.cn', 'not-a-url')).toBe(false)
  })

  it('正式域名下注入 hm.js 并关闭自动 PV', () => {
    expect(initBaiduAnalytics({ hostname: 'dlslab.cn' })).toBe(true)

    const script = document.querySelector<HTMLScriptElement>('script[data-baidu-analytics]')
    expect(script?.src).toBe(`https://hm.baidu.com/hm.js?${getBaiduHmId()}`)
    expect(script?.async).toBe(true)
    // 自动 PV 必须关掉，否则首屏会被记两次
    expect(window._hmt?.[0]).toEqual(['_setAutoPageview', false])
  })

  it('重复初始化不会重复注入脚本', () => {
    initBaiduAnalytics({ hostname: 'dlslab.cn' })
    initBaiduAnalytics({ hostname: 'dlslab.cn' })

    expect(document.querySelectorAll('script[data-baidu-analytics]')).toHaveLength(1)
  })

  it('非正式域名（dev / 预览 / 预渲染）不加载脚本', () => {
    expect(initBaiduAnalytics({ hostname: 'localhost' })).toBe(false)
    expect(document.querySelector('script[data-baidu-analytics]')).toBeNull()
    expect(window._hmt).toBeUndefined()
  })

  it('站点 ID 为空时彻底关闭', () => {
    expect(initBaiduAnalytics({ hmId: '', hostname: 'dlslab.cn' })).toBe(false)
    expect(document.querySelector('script[data-baidu-analytics]')).toBeNull()
  })

  it('上报 PV 保留完整路径与查询参数', () => {
    initBaiduAnalytics({ hostname: 'dlslab.cn' })
    trackPageview('/tools/coord?from=wx')

    expect(window._hmt).toContainEqual(['_trackPageview', '/tools/coord?from=wx'])
  })

  it('未启用时上报是静默空操作', () => {
    expect(() => trackPageview('/tools/coord')).not.toThrow()
    expect(window._hmt).toBeUndefined()
  })
})
