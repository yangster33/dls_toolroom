import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const brandDir = path.join(root, 'public', 'brand')
const pngDir = path.join(brandDir, 'png')
const designDir = path.join(root, 'design', 'logo')

const launch = async () => {
  const channel = process.env.PW_CHANNEL
  if (channel) return chromium.launch({ channel })
  try {
    return await chromium.launch({ channel: 'msedge' })
  } catch {
    return chromium.launch()
  }
}

const browser = await launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })

const readSvg = (name) => readFile(path.join(brandDir, name), 'utf8')

const renderSvg = async (name, width, height) => {
  const svg = await readSvg(name)
  await page.setViewportSize({ width, height })
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block;width:${width}px;height:${height}px}</style>${svg}`,
  )
  await page.evaluate(() => document.fonts.ready)
  return page.locator('svg').screenshot({ omitBackground: true })
}

const writePng = async (name, width, height, outName) => {
  const buffer = await renderSvg(name, width, height)
  await writeFile(path.join(pngDir, outName), buffer)
  console.log(`  ${outName}  ${width}×${height}`)
}

const buildIco = async (sizes, outPath) => {
  const entries = []
  for (const size of sizes) {
    const buffer = await renderSvg('logo-app.svg', size, size)
    entries.push({ size, buffer })
  }

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)

  const directory = Buffer.alloc(entries.length * 16)
  let offset = 6 + directory.length
  entries.forEach(({ size, buffer }, index) => {
    const at = index * 16
    directory.writeUInt8(size >= 256 ? 0 : size, at)
    directory.writeUInt8(size >= 256 ? 0 : size, at + 1)
    directory.writeUInt8(0, at + 2)
    directory.writeUInt8(0, at + 3)
    directory.writeUInt16LE(1, at + 4)
    directory.writeUInt16LE(32, at + 6)
    directory.writeUInt32LE(buffer.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += buffer.length
  })

  await writeFile(
    outPath,
    Buffer.concat([header, directory, ...entries.map((entry) => entry.buffer)]),
  )
  console.log(`  ${path.relative(root, outPath)}  ${sizes.join('/')} px`)
}

const shotHtml = async (targetPage, file, width, height, outPath, { fullPage = false } = {}) => {
  const target = path.join(designDir, file)
  if (!existsSync(target)) throw new Error(`missing ${target}`)
  await targetPage.setViewportSize({ width, height })
  await targetPage.goto(pathToFileURL(target).href)
  await targetPage.waitForLoadState('load')
  await targetPage.evaluate(() => document.fonts.ready)
  await targetPage.waitForTimeout(150)
  await targetPage.screenshot({ path: outPath, fullPage })
  console.log(`  ${path.relative(root, outPath)}  ${width}×${height}`)
}

console.log('Brand assets')
console.log('\nSymbols / lockups')
await writePng('logo-mark.svg', 512, 512, 'logo-mark-512.png')
await writePng('logo-mark-dark.svg', 512, 512, 'logo-mark-dark-512.png')
await writePng('logo-lockup.svg', 1032, 288, 'logo-lockup-1032.png')
await writePng('logo-lockup-dark.svg', 1032, 288, 'logo-lockup-dark-1032.png')

console.log('\nApp icons / favicon')
await writePng('logo-app.svg', 512, 512, 'logo-app-512.png')
await writePng('logo-app.svg', 192, 192, 'logo-app-192.png')
await writePng('logo-app.svg', 180, 180, 'logo-app-180.png')
await writePng('logo-app.svg', 32, 32, 'favicon-32.png')
await buildIco([16, 32, 48, 256], path.join(root, 'public', 'favicon.ico'))

console.log('\nSocial / preview')
await shotHtml(page, 'og-cover.html', 1200, 630, path.join(brandDir, 'og-cover.png'))
const previewPage = await browser.newPage({ deviceScaleFactor: 2 })
await shotHtml(previewPage, 'preview.html', 1120, 900, path.join(designDir, 'preview.png'), {
  fullPage: true,
})
await previewPage.close()

await browser.close()
console.log('\nDone.')
