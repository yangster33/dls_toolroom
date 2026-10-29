// scripts/prerender.mjs
// 预渲染 SPA 路由到 dist/ 下：
//   - 本地：Playwright（@playwright/test，devDependency）启动浏览器；
//   - CI / Vercel：Puppeteer + @sparticuz/chromium（自带 Linux 二进制与系统依赖）。

import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')
const PORT = Number(process.env.PRERENDER_PORT ?? 5174)
const BASE_URL = `http://localhost:${PORT}`
const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://dlslab.cn').replace(/\/$/, '')
// 本地默认无头；PRERENDER_HEADFUL=1 可切回有头模式排查问题
const IS_CI = !!process.env.CI || !!process.env.VERCEL
const HEADFUL = !IS_CI && !!process.env.PRERENDER_HEADFUL
const ROUTE_TIMEOUT = 30000
const LAUNCH_TIMEOUT = 30000
const USER_AGENT = 'dls-prerender/1.0 (+https://dlslab.cn)'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
}

async function statOrNull(p) {
  try {
    return await stat(p)
  } catch {
    return null
  }
}

// 干净的原始 index.html 模板，作为 SPA fallback（避免被预渲染产物污染）
let cleanIndexHtml = ''

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', BASE_URL)
        const pathname = decodeURIComponent(url.pathname)
        if (pathname.includes('..')) {
          res.statusCode = 400
          res.end('Bad Request')
          return
        }
        let filePath = join(DIST, pathname)
        if (!filePath.startsWith(DIST)) {
          res.statusCode = 400
          res.end('Bad Request')
          return
        }
        const s = await statOrNull(filePath)
        if (s?.isDirectory()) {
          filePath = join(filePath, 'index.html')
        }
        if (!existsSync(filePath)) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(cleanIndexHtml)
          return
        }
        const data = await readFile(filePath)
        res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream')
        res.end(data)
      } catch (err) {
        res.statusCode = 500
        res.end(String(err))
      }
    })
    server.listen(PORT, () => {
      resolve({
        close: () =>
          new Promise((r) => {
            server.close(() => r())
          }),
      })
    })
  })
}

async function getToolIds() {
  const content = await readFile(join(ROOT, 'src/tools/toolData.ts'), 'utf-8')
  const ids = []
  const re = /^\s*id:\s*['"]([^'"]+)['"]/gm
  let m
  while ((m = re.exec(content))) {
    if (m[1]) ids.push(m[1])
  }
  return ids
}

function routeToFilePath(route) {
  const clean = route.replace(/\/+$/, '')
  if (clean === '') return join(DIST, 'index.html')
  return join(DIST, clean, 'index.html')
}

async function prerenderRoute(session, route) {
  const url = `${BASE_URL}${route}`
  console.log(`  → ${route}`)
  await session.goto(url)
  // 等待 @unhead/vue 写入 head
  await session.waitForTitle()
  await new Promise((r) => setTimeout(r, 300))

  const html = await session.content()
  const outPath = routeToFilePath(route)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, html, 'utf-8')
  console.log(`    ✓ ${outPath.replace(DIST, '')} (${(html.length / 1024).toFixed(1)} KB)`)
}

async function writeSitemap(routes) {
  const today = new Date().toISOString().slice(0, 10)
  const toolsRoutes = routes.filter((r) => r.startsWith('/tools/'))
  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/tools', priority: '0.9', changefreq: 'weekly' },
    ...toolsRoutes.map((r) => ({ loc: r, priority: '0.8', changefreq: 'monthly' })),
    { loc: '/about', priority: '0.4', changefreq: 'monthly' },
    { loc: '/donate', priority: '0.3', changefreq: 'yearly' },
  ]
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${SITE_URL}${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
    )
    .join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
  await writeFile(join(DIST, 'sitemap.xml'), xml, 'utf-8')
  console.log(`✓ sitemap.xml (${urls.length} urls)`)
}

async function writeRobots() {
  const content = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
  await writeFile(join(DIST, 'robots.txt'), content, 'utf-8')
  console.log('✓ robots.txt')
}

async function launchBrowser() {
  return IS_CI ? launchCiBrowser() : launchLocalBrowser()
}

// Vercel / CI：@sparticuz/chromium 自带 Linux 二进制与系统依赖。
// 它没有 Windows/macOS 构建，所以这条路只在 CI 里走，本地请用下面的 Playwright。
async function launchCiBrowser() {
  const [{ default: puppeteer }, { default: chromium }] = await Promise.all([
    import('puppeteer-core'),
    import('@sparticuz/chromium'),
  ])
  const executablePath = await chromium.executablePath()
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
    timeout: LAUNCH_TIMEOUT,
  })
  const page = await browser.newPage()
  await page.setUserAgent(USER_AGENT)
  return {
    goto: (url) => page.goto(url, { waitUntil: 'networkidle0', timeout: ROUTE_TIMEOUT }),
    waitForTitle: () =>
      page
        .waitForFunction(() => document.title && document.title.length > 0, { timeout: 5000 })
        .catch(() => {}),
    content: () => page.content(),
    close: () => browser.close(),
  }
}

// 本地：用 Playwright 启动，与 playwright.config.ts 保持一致（优先系统 Edge，
// 退回自带 chromium）。不再硬编码浏览器安装路径——那套候选列表在本机
// （只有 Edge、没装 Chrome）会漏掉，且原先的兜底 @sparticuz/chromium 在
// Windows 上根本无法运行，等于没有兜底。
async function launchLocalBrowser() {
  const { chromium: pwChromium } = await import('@playwright/test')
  const attempts = [
    { channel: 'msedge', label: '系统 Edge (msedge)' },
    { channel: undefined, label: 'Playwright 自带 chromium' },
  ]

  const failures = []
  for (const attempt of attempts) {
    let browser
    try {
      browser = await pwChromium.launch({
        channel: attempt.channel,
        headless: !HEADFUL,
        timeout: LAUNCH_TIMEOUT,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    } catch (err) {
      failures.push(`${attempt.label}: ${err instanceof Error ? err.message : String(err)}`)
      continue
    }

    console.log(`  (本地浏览器: ${attempt.label}${HEADFUL ? '，有头模式' : ''})`)
    const context = await browser.newContext({ userAgent: USER_AGENT })
    const page = await context.newPage()
    return {
      goto: (url) => page.goto(url, { waitUntil: 'networkidle', timeout: ROUTE_TIMEOUT }),
      waitForTitle: () =>
        page
          .waitForFunction(() => document.title && document.title.length > 0, undefined, {
            timeout: 5000,
          })
          .catch(() => {}),
      content: () => page.content(),
      close: async () => {
        await context.close()
        await browser.close()
      },
    }
  }

  throw new Error(
    `本地浏览器启动失败（已尝试 ${attempts.length} 种）：\n` +
      failures.map((f) => `  - ${f}`).join('\n') +
      '\n提示：npx playwright install chromium 可补齐自带 chromium；' +
      'PRERENDER_HEADFUL=1 可切有头模式排查。',
  )
}

async function main() {
  if (!existsSync(DIST)) {
    console.error('dist/ 不存在，请先运行 npm run build-only')
    process.exit(1)
  }

  cleanIndexHtml = await readFile(join(DIST, 'index.html'), 'utf-8')

  const toolIds = await getToolIds()
  const routes = ['/', '/tools', '/about', '/donate', ...toolIds.map((id) => `/tools/${id}`)]
  console.log(`预渲染 ${routes.length} 个路由… (环境: ${IS_CI ? 'CI/Vercel' : 'local'})`)

  const server = await startStaticServer()
  const session = await launchBrowser()

  const failed = []
  for (const route of routes) {
    try {
      await prerenderRoute(session, route)
    } catch (err) {
      console.error(`    ✗ ${route}: ${err instanceof Error ? err.message : String(err)}`)
      failed.push({ route, error: String(err) })
    }
  }

  await session.close()
  await server.close()

  if (failed.length) {
    console.error(`\n${failed.length} 个路由预渲染失败：`)
    for (const f of failed) console.error(`  - ${f.route}: ${f.error}`)
    process.exit(1)
  }
  console.log(`\n预渲染完成：${routes.length} 个路由`)

  await writeSitemap(routes)
  await writeRobots()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
