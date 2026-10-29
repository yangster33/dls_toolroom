/**
 * 外部 API 同源代理（reverse proxy）路由
 *
 * 背景：站点是纯静态前端，部分数据源在境外。不同运营商 / 不同时段到境外的
 * 链路质量差异很大，直连会出现「同一功能有人能用、有人一直转圈」。
 * 生产环境把这类请求改走同源 `/proxy/*`，由 nginx 统一出网并做缓存：
 *
 *   /proxy/openmeteo/          → https://api.open-meteo.com
 *   /proxy/openmeteo-archive/  → https://archive-api.open-meteo.com
 *   /proxy/usgs/               → https://earthquake.usgs.gov
 *   /proxy/gdacs/              → https://www.gdacs.org
 *
 * 注意：
 * - **只在 dlslab.cn 生产域名下启用**。Vercel / 预览域名没有这层 nginx，
 *   走 `/proxy` 会 404，所以按 hostname 判断而不是只看 PROD。
 * - 国内源（高德、天地图、腾讯）本来就能直连，且批量调用量大，
 *   不经过代理，避免把服务器带宽当 CDN 用。
 * - 开发与单元测试默认直连；需要联调代理时显式设置 VITE_API_PROXY=true。
 */

/** 上游 host → 本地代理前缀（必须与 nginx 配置一一对应） */
export const PROXY_HOSTS: Readonly<Record<string, string>> = {
  'api.open-meteo.com': '/proxy/openmeteo',
  'archive-api.open-meteo.com': '/proxy/openmeteo-archive',
  'earthquake.usgs.gov': '/proxy/usgs',
  'www.gdacs.org': '/proxy/gdacs',
}

/** 支持代理的站点域名（含子域） */
const SITE_HOST_SUFFIX = 'dlslab.cn'

function isSiteHost(hostname: string): boolean {
  return hostname === SITE_HOST_SUFFIX || hostname.endsWith(`.${SITE_HOST_SUFFIX}`)
}

/**
 * 当前环境是否应走同源代理。
 *
 * 优先级：VITE_API_PROXY 显式开关 > 生产域名自动判断。
 */
export function shouldUseApiProxy(
  env: { PROD?: boolean; VITE_API_PROXY?: string } = import.meta.env,
  hostname: string = typeof window === 'undefined' ? '' : window.location.hostname,
): boolean {
  const flag = env.VITE_API_PROXY
  if (flag === 'false') return false
  if (flag === 'true') return true
  return Boolean(env.PROD) && isSiteHost(hostname)
}

/**
 * 把已知上游 URL 改写为同源代理 URL；未知 host 或未启用代理时原样返回。
 *
 * 保留 path 与 query，丢弃 hash（API 请求不会用到）。
 */
export function toProxyUrl(rawUrl: string, useProxy: boolean = shouldUseApiProxy()): string {
  if (!useProxy) return rawUrl

  try {
    const url = new URL(rawUrl)
    const prefix = PROXY_HOSTS[url.hostname]
    if (!prefix) return rawUrl
    return `${prefix}${url.pathname}${url.search}`
  } catch {
    // 非绝对 URL（相对路径、非法字符串）一律不改写
    return rawUrl
  }
}
