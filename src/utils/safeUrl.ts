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
 * 剔除 C0 控制字符与 DEL（U+0000-U+001F、U+007F）。
 *
 * 浏览器在解析 URL 前会剥掉 javascript: 这类 scheme 前面的制表符/换行/
 * 回车等空白与控制字符，所以校验协议前必须先自己剥一遍，否则
 * java<TAB>script:alert(1) 之类会穿透校验。
 *
 * 用逐字符判断而非正则：no-control-regex 规则不允许在正则里写控制字符
 * 范围，逐字符写法既规避该规则也更直观。
 */
function stripControlChars(input: string): string {
  let out = ''
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0
    if (code <= 0x1f || code === 0x7f) continue
    out += ch
  }
  return out
}

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
  const normalized = stripControlChars(trimmed).toLowerCase()

  // 无明显协议前缀时按相对路径处理
  const schemeMatch = normalized.match(/^([a-z][a-z0-9+.-]*):/)
  if (!schemeMatch) return trimmed

  const scheme = `${schemeMatch[1]}:`
  return (SAFE_PROTOCOLS as readonly string[]).includes(scheme) ? trimmed : fallback
}
