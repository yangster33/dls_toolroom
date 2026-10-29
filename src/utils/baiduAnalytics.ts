import { SITE_URL } from '@/composables/useSeo'

/**
 * 百度统计（hm.js）接入。
 *
 * 官方那段 `<script>` 直接贴进 index.html 也能跑，但对本项目有三个坑：
 *
 *   1. 这是 SPA。hm.js 默认只在页面加载时上报一次 PV，之后的路由切换它
 *      感知不到，统计后台会把所有访问都算在首页（或首个落地页）头上。
 *      这里关掉自动 PV（`_setAutoPageview`），改由 `router.afterEach`
 *      上报真实的 `to.fullPath`。
 *   2. index.html 是所有环境共用的。贴死会让 dev、`npm run prerender`
 *      的预渲染浏览器、Vercel 预览域名一起上报，把后台数据搅乱。
 *      这里只在 `VITE_SITE_URL` 对应的域名（含子域名）上加载脚本。
 *   3. 站点 ID 写死在 HTML 里，换号/临时关闭都得改代码。这里走
 *      `VITE_BAIDU_HM_ID`，设为空字符串即可彻底关闭。
 */

declare global {
  interface Window {
    /** hm.js 的全局命令队列，脚本加载前先入队，加载后依次执行 */
    _hmt?: unknown[][]
  }
}

/** 已申请的站点 ID（hm.js? 后面那串） */
const DEFAULT_HM_ID = '855d5ff9879a97b2b1d3e30dea692a31'

/** 标记注入的 script，避免重复加载 */
const SCRIPT_MARKER = 'data-baidu-analytics'

interface InitOptions {
  /** 覆盖站点 ID；空字符串表示不启用 */
  hmId?: string
  /** 覆盖当前主机名（测试用） */
  hostname?: string
  /** 覆盖站点 URL（测试用） */
  siteUrl?: string
}

/** 读取站点 ID，未配置时用内置值 */
export function getBaiduHmId(): string {
  const fromEnv = import.meta.env.VITE_BAIDU_HM_ID as string | undefined
  return (fromEnv ?? DEFAULT_HM_ID).trim()
}

/**
 * 当前主机名是否属于站点域名（允许子域名）。
 *
 * 百度统计只应该在正式站点上跑：localhost、127.0.0.1、Vercel 预览域名、
 * 预渲染用的本地静态服务都不该上报。
 */
export function isTrackedHostname(hostname: string, siteUrl: string = SITE_URL): boolean {
  let siteHost: string
  try {
    siteHost = new URL(siteUrl).hostname
  } catch {
    return false
  }
  if (!siteHost || !hostname) return false
  return hostname === siteHost || hostname.endsWith(`.${siteHost}`)
}

/**
 * 按需注入 hm.js，返回是否已启用。
 *
 * 重复调用是安全的（脚本只会注入一次）。
 */
export function initBaiduAnalytics(options: InitOptions = {}): boolean {
  const hmId = (options.hmId ?? getBaiduHmId()).trim()
  if (!hmId) return false

  const hostname = options.hostname ?? window.location.hostname
  if (!isTrackedHostname(hostname, options.siteUrl ?? SITE_URL)) return false

  if (document.querySelector(`script[${SCRIPT_MARKER}]`)) return true

  window._hmt = window._hmt ?? []
  // 关闭 hm.js 的自动 PV：SPA 的路由切换由 trackPageview 统一上报，
  // 否则首屏会被记两次（自动一次 + 路由一次）。
  window._hmt.push(['_setAutoPageview', false])

  const script = document.createElement('script')
  script.src = `https://hm.baidu.com/hm.js?${hmId}`
  script.async = true
  script.setAttribute(SCRIPT_MARKER, '')
  document.head.appendChild(script)

  return true
}

/**
 * 上报一次页面浏览。未启用时（`_hmt` 不存在）静默忽略。
 *
 * @param path 建议传 `to.fullPath`，保留查询参数，便于区分筛选类页面
 */
export function trackPageview(
  path: string = window.location.pathname + window.location.search,
): void {
  window._hmt?.push(['_trackPageview', path])
}
