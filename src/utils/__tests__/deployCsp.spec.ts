import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * F1 部署侧回归：CSP 必须允许同源 Worker。
 *
 * 这里只校验仓库内的部署配置；线上是否真的下发了该响应头，仍需部署后
 * `curl -I` 确认（见 deploy/README.md）。
 */
describe('部署 CSP（F1 worker-src）', () => {
  it('vercel.json 的全局 CSP 含 worker-src self', () => {
    const raw = fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8')
    const config = JSON.parse(raw) as {
      headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
    }

    const csp = config.headers
      ?.flatMap((entry) => entry.headers)
      .find((header) => header.key === 'Content-Security-Policy')

    expect(csp?.value).toContain("worker-src 'self'")
  })

  it('nginx security-headers snippet 含 worker-src self', () => {
    const raw = fs.readFileSync(
      path.resolve(process.cwd(), 'deploy/nginx/snippets/dls_security_headers.conf'),
      'utf8',
    )
    expect(raw).toContain("worker-src 'self'")
  })
})
