import { describe, it, expect } from 'vitest'
import { toSafeExternalUrl } from '../safeUrl'

/**
 * 审计报告 P2-14 的回归测试
 *
 * Vue 的 v-bind:href 不过滤协议，把外部数据（API 响应、用户上传文件解析出的
 * 字段）直接绑到 :href 上，一旦数据含 javascript: / data: 且上游被攻陷或
 * 链路被篡改，点击即执行脚本。rel="noopener noreferrer" 只管 window opener，
 * 不阻断协议执行——两者是不同层面的防护。
 *
 * 消费方：GdacsPage（GDACS API 的 url）、EarthquakeQueryPage（USGS 的 url）。
 */

describe('toSafeExternalUrl（P2-14）', () => {
  it('放行 http / https', () => {
    expect(toSafeExternalUrl('https://www.gdacs.org/report.aspx?eventid=1')).toBe(
      'https://www.gdacs.org/report.aspx?eventid=1',
    )
    expect(toSafeExternalUrl('http://example.com/a')).toBe('http://example.com/a')
  })

  it('拦截 javascript: 协议（大小写混合）', () => {
    expect(toSafeExternalUrl('javascript:alert(1)')).toBe('#')
    expect(toSafeExternalUrl('JavaScript:alert(1)')).toBe('#')
    expect(toSafeExternalUrl('JAVASCRIPT:alert(1)')).toBe('#')
  })

  it('拦截 data: / vbscript: 等其它可执行协议', () => {
    expect(toSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe('#')
    expect(toSafeExternalUrl('vbscript:msgbox(1)')).toBe('#')
    expect(toSafeExternalUrl('file:///etc/passwd')).toBe('#')
  })

  it('拦截浏览器会剥掉前缀空白的变形（\\t\\n\\r 前缀）', () => {
    expect(toSafeExternalUrl('  javascript:alert(1)')).toBe('#')
    expect(toSafeExternalUrl('\tjavascript:alert(1)')).toBe('#')
    expect(toSafeExternalUrl('\njavascript:alert(1)')).toBe('#')
    expect(toSafeExternalUrl('\rjavascript:alert(1)')).toBe('#')
  })

  it('拦截内嵌控制字符的变形', () => {
    expect(toSafeExternalUrl('java\x00script:alert(1)')).toBe('#')
    expect(toSafeExternalUrl('java\x01script:alert(1)')).toBe('#')
  })

  it('放行相对路径、锚点、协议相对与查询串', () => {
    expect(toSafeExternalUrl('/tools/gdacs')).toBe('/tools/gdacs')
    expect(toSafeExternalUrl('#section')).toBe('#section')
    expect(toSafeExternalUrl('./relative')).toBe('./relative')
    expect(toSafeExternalUrl('//cdn.example.com/x')).toBe('//cdn.example.com/x')
    expect(toSafeExternalUrl('?page=2')).toBe('?page=2')
  })

  it('放行 mailto（白名单内）', () => {
    expect(toSafeExternalUrl('mailto:a@b.com')).toBe('mailto:a@b.com')
  })

  it('非字符串 / 空串返回 fallback', () => {
    expect(toSafeExternalUrl(undefined)).toBe('#')
    expect(toSafeExternalUrl(null)).toBe('#')
    expect(toSafeExternalUrl(123)).toBe('#')
    expect(toSafeExternalUrl('')).toBe('#')
    expect(toSafeExternalUrl('   ')).toBe('#')
  })

  it('支持自定义 fallback', () => {
    expect(toSafeExternalUrl('javascript:alert(1)', '/blocked')).toBe('/blocked')
  })

  it('原样保留合法 URL 的首尾空格语义（trim 后仍匹配）', () => {
    expect(toSafeExternalUrl('  https://a.com  ')).toBe('https://a.com')
  })
})
