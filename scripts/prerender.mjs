// scripts/prerender.mjs
// 用 Playwright 预渲染 SPA 路由到 dist/ 下，让爬虫拿到完整 HTML（含动态 head）
// 依赖 @playwright/test（已在 devDependencies）

import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')
const PORT = Number(process.env.PRERENDER_PORT ?? 5174)
const BASE_URL = `http://localhost:${PORT}`
const SITE_URL = (process.env.VITE_SITE_URL ?? 'https://dlslab.cn').replace(/\/$/, '')

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

// 启动一个简单静态服务器，SPA fallback 到干净的原始 index.html（避免被预渲染产物污染）
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
        // 文件不存在 → 用干净的原始 index.html 作为 SPA fallback
        // （不能用 dist/index.html，因为首页预渲染后它已被污染）
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

// 从 toolData.ts 提取工具 ID（避免引入 TS 解析依赖）
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
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  // 等待 @unhead/vue 写入 head
  await page
    .waitForFunction(() => document.title && document.title.length > 0, { timeout: 5000 })
    .catch(() => {})
  await page.waitForTimeout(300)

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

async function ensureChromium() {
  // 检测 playwright chromium 是否已安装
  const result = spawnSync('npx', ['playwright', 'install', '--dry-run', 'chromium'], {
    cwd: ROOT,
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  })
  // dry-run 输出包含 "is already installed" 则跳过
  const out = (result.stdout || '') + (result.stderr || '')
  if (out.includes('already installed') || out.includes('Skip')) {
    return
  }
  console.log('安装 Playwright chromium…')
  const install = spawnSync('npx', ['playwright', 'install', 'chromium'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (install.status !== 0) {
    console.error('chromium 安装失败')
    process.exit(1)
  }
}

async function main() {
  if (!existsSync(DIST)) {
    console.error('dist/ 不存在，请先运行 npm run build-only')
    process.exit(1)
  }

  // 确保 chromium 已安装（CI 环境如 Vercel 首次 build 时缺失）
  await ensureChromium()

  // 备份干净的原始 index.html，作为 SPA fallback 模板
  cleanIndexHtml = await readFile(join(DIST, 'index.html'), 'utf-8')

  const toolIds = await getToolIds()
  const routes = ['/', '/tools', '/about', '/donate', ...toolIds.map((id) => `/tools/${id}`)]
  console.log(`预渲染 ${routes.length} 个路由…`)
  const server = await startStaticServer()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'dls-prerender/1.0 (+https://dls.yangbagongji.com)',
  })
  const page = await context.newPage()

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

  // 生成 sitemap.xml 和 robots.txt
  await writeSitemap(routes)
  await writeRobots()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
