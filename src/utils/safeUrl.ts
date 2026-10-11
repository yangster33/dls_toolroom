/**
 * 外部 URL 安全处理
 *
 * Vue 的 `v-bind:href` 不会过滤协议，因此把外部数据（API 响应、用户上传
 * 文件解析出的字段）直接绑到 `:href` 上，一旦数据含 `javascript:` /
 * `data:` / `vbscript:` 且上游被攻陷或链路被篡改，就会在点击时执行脚本。
 *
 * `rel="noopener noreferrer"` 只影响 `target=_blank` 的 window opener，
 * 不能阻断协议执行——两者是不同层面的防护。
 */

/** 允许的协议白名单 */
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'] as const

/** 协议非法时的替代值 */
const FALLBACK_HREF = '#'

/**
 * 校验并规整外部 URL，只放行白名单协议。
 *
 * @param raw     外部来源的 URL 字符串
 * @param fallback 协议非法 / 解析失败时的替代值，默认 '#'
 * @returns        安全的 URL；非法时返回 fallback
 */
export function toSafeExternalUrl(raw: unknown, fallback: string = FALLBACK_HREF): string {
  if (typeof raw !== 'string') return fallback

  const trimmed = raw.trim()
  if (trimmed === '') return fallback

  // 相对路径与锚点直接放行（不含协议，无 execution 风险）
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('.')) {
    return trimmed
  }

  // 协议相对（//host/path）与查询串（?a=1）同样无协议风险
  if (trimmed.startsWith('//') || trimmed.startsWith('?')) {
    return trimmed
  }

  // 浏览器会把 "javascript:..." 前面的空白/控制字符剥掉，这里显式剥离后再判断
  const normalized = trimmed.replace(/[\u0000-\u0020\u007f]+/g, '').toLowerCase()

  // 无明显协议前缀时按相对路径处理
  const schemeMatch = normalized.match(/^([a-z][a-z0-9+.-]*):/)
  if (!schemeMatch) return trimmed

  const scheme = `${schemeMatch[1]}:`
  return (SAFE_PROTOCOLS as readonly string[]).includes(scheme) ? trimmed : fallback
}
