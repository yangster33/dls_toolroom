// scripts/prerender.mjs
// 用 Puppeteer + @sparticuz/chromium 预渲染 SPA 路由到 dist/ 下
// @sparticuz/chromium 自带系统依赖，兼容 Vercel / AWS Lambda build 环境

import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
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
// 本地开发环境用系统 chrome；Vercel/CI 用 @sparticuz/chromium
const IS_CI = !!process.env.CI || !!process.env.VERCEL
const HEADLESS = IS_CI

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

async function prerenderRoute(page, route) {
  const url = `${BASE_URL}${route}`
  console.log(`  → ${route}`)
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
  // 等待 @unhead/vue 写入 head
  await page
    .waitForFunction(() => document.title && document.title.length > 0, { timeout: 5000 })
    .catch(() => {})
  await new Promise((r) => setTimeout(r, 300))

  const html = await page.content()
  const outPath = routeToFilePath(route)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, html, 'utf-8')
  console.log(`    ✓ ${outPath.replace(DIST, '')} (${(html.length / 1024).toFixed(1)} KB)`)
}

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
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
  if (IS_CI) {
    // Vercel / CI 环境：用 @sparticuz/chromium 自带的二进制
    const executablePath = await chromium.executablePath()
    return puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: HEADLESS,
    })
  }
  // 本地开发：按优先级找一个可用的 chrome
  const localCandidates = [
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    // Edge 也能用（Windows 自带）
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean)
  for (const p of localCandidates) {
    if (existsSync(p)) {
      return puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: p,
        headless: HEADLESS,
      })
    }
  }
  // 最后 fallback：@sparticuz/chromium（本地也能跑，但首次会解压）
  const executablePath = await chromium.executablePath()
  return puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: HEADLESS,
  })
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
  const browser = await launchBrowser()
  const page = await browser.newPage()
  await page.setUserAgent('dls-prerender/1.0 (+https://dlslab.cn)')

  const failed = []
  for (const route of routes) {
    try {
      await prerenderRoute(page, route)
    } catch (err) {
      console.error(`    ✗ ${route}: ${err instanceof Error ? err.message : String(err)}`)
      failed.push({ route, error: String(err) })
    }
  }

  await browser.close()
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
