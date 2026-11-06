import puppeteer from 'puppeteer-core'

const url = process.argv[2] || 'http://127.0.0.1:5199/'

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
})

const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('502')) errors.push(m.text())
})

await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'networkidle0' })
await page.waitForSelector('.hero-canvas canvas')
await page.waitForFunction(() => !!window.__heroTopology)

const check = () =>
  page.evaluate(() => {
    const { nodes, edges } = window.__heroTopology
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const problems = []
    const backboneTypes = new Set(['room', 'base', 'device'])

    if (byId.size !== nodes.length) problems.push('duplicate node ids')

    const backbone = nodes.filter((n) => backboneTypes.has(n.type))
    const adj = new Map(backbone.map((n) => [n.id, []]))
    edges.forEach((e) => {
      const a = byId.get(e.a)
      const b = byId.get(e.b)
      if (backboneTypes.has(a.type) && backboneTypes.has(b.type)) {
        adj.get(e.a).push(e.b)
        adj.get(e.b).push(e.a)
      }
    })
    const seen = new Set([backbone[0].id])
    const queue = [backbone[0].id]
    while (queue.length) {
      const v = queue.pop()
      for (const w of adj.get(v)) {
        if (!seen.has(w)) {
          seen.add(w)
          queue.push(w)
        }
      }
    }
    if (seen.size !== backbone.length) {
      problems.push(`backbone disconnected ${seen.size}/${backbone.length}`)
    }

    edges.forEach((e) => {
      const a = byId.get(e.a)
      const b = byId.get(e.b)
      const types = [a.type, b.type]
      if (a.type === 'terminal' && b.type === 'terminal') problems.push('terminal-terminal')
      if ((a.type === 'satellite' || b.type === 'satellite') && e.medium !== 'wireless') {
        problems.push('satellite link not wireless')
      }
      if (
        (a.type === 'satellite' && b.type === 'device') ||
        (b.type === 'satellite' && a.type === 'device')
      ) {
        problems.push('satellite-device link')
      }
      if ((a.type === 'device' || b.type === 'device') && e.medium !== 'fiber') {
        problems.push('device link not fiber')
      }
      if (
        backboneTypes.has(a.type) &&
        backboneTypes.has(b.type) &&
        e.medium === 'wireless'
      ) {
        problems.push('wireless in backbone')
      }
      if (e.medium === 'wireless' || e.medium === 'microwave') {
        if (e.kind !== 'satellite') {
          // 直线或单弧都算合格：转向符号变化不超过 1 次
          let changes = 0
          let lastSign = 0
          for (let k = 1; k < e.pts.length - 1; k++) {
            const a = e.pts[k - 1]
            const b = e.pts[k]
            const c = e.pts[k + 1]
            const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
            const sign = Math.sign(cross)
            if (sign !== 0 && lastSign !== 0 && sign !== lastSign) changes += 1
            if (sign !== 0) lastSign = sign
          }
          if (changes > 1) problems.push(`${e.medium} wiggly`)
        }
      }
      if (types.includes('terminal') && types.includes('satellite') && e.kind !== 'satellite') {
        problems.push('terminal-satellite kind mismatch')
      }
    })

    nodes
      .filter((n) => n.type === 'terminal')
      .forEach((t) => {
        const inc = edges.filter((e) => e.a === t.id || e.b === t.id)
        if (inc.length !== 1) problems.push(`terminal ${t.id} degree ${inc.length}`)
        inc.forEach((e) => {
          const other = byId.get(e.a === t.id ? e.b : e.a)
          if (!['device', 'base', 'room', 'satellite'].includes(other.type)) {
            problems.push(`terminal ${t.id} bad neighbor ${other.type}`)
          }
        })
      })

    nodes
      .filter((n) => n.type === 'satellite')
      .forEach((s) => {
        const inc = edges.filter((e) => e.a === s.id || e.b === s.id)
        if (!inc.length) problems.push('satellite isolated')
        if (!inc.every((e) => e.medium === 'wireless')) {
          problems.push('satellite link not wireless')
        }
        const neighbours = inc.map((e) => byId.get(e.a === s.id ? e.b : e.a))
        if (!neighbours.some((n) => n.type === 'room')) {
          problems.push('satellite not anchored to a room')
        }
      })

    const rooms = nodes.filter((n) => n.type === 'room')
    for (const kind of ['core', 'aggregation', 'access']) {
      if (!rooms.some((n) => n.kind === kind)) problems.push(`missing room ${kind}`)
    }
    const bases = nodes.filter((n) => n.type === 'base')
    for (const kind of ['6G', '5G', '4G']) {
      if (!bases.some((n) => n.kind === kind)) problems.push(`missing base ${kind}`)
    }

    edges.forEach((e) => {
      nodes.forEach((n) => {
        if (n.id === e.a || n.id === e.b) return
        let min = Infinity
        for (let i = 1; i < e.pts.length; i++) {
          const p0 = e.pts[i - 1]
          const p1 = e.pts[i]
          const px = n.x * 920
          const py = n.y * 380
          const ax = p0.x * 920
          const ay = p0.y * 380
          const bx = p1.x * 920
          const by = p1.y * 380
          const dx = bx - ax
          const dy = by - ay
          const l2 = dx * dx + dy * dy
          let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0
          t = Math.max(0, Math.min(1, t))
          const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
          if (d < min) min = d
        }
        if (min < 12) problems.push(`edge ${e.a}-${e.b} grazes ${n.id}`)
      })
    })

    const bbFiber = edges.filter((e) => e.kind === 'backbone' && e.medium === 'fiber').length
    const bbMw = edges.filter((e) => e.kind === 'backbone' && e.medium === 'microwave').length
    if (!(bbFiber > bbMw)) problems.push('fiber not dominant in backbone')

    const satNode = nodes.find((n) => n.type === 'satellite')
    let satelliteAnchorKind = null
    if (satNode) {
      const satEdges = edges.filter(
        (e) => (e.a === satNode.id || e.b === satNode.id) && e.kind === 'satellite',
      )
      const anchor = satEdges
        .map((e) => byId.get(e.a === satNode.id ? e.b : e.a))
        .find((n) => n.type === 'room')
      satelliteAnchorKind = anchor?.kind ?? null
    }

    return {
      stats: window.__heroTopology.stats,
      problems,
      backbone: backbone.length,
      bbFiber,
      bbMw,
      satelliteAnchorKind,
    }
  })

const results = []
for (let i = 0; i < 10; i++) {
  if (i > 0) {
    await page.click('.hero-actions .hero-btn:nth-child(1)')
    await new Promise((r) => setTimeout(r, 120))
  }
  results.push(await check())
}

console.log(JSON.stringify({ errors, results }, null, 2))
await browser.close()
