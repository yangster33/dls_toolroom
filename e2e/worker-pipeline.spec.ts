import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

/**
 * C4 阶段 4：证明 Web Worker 管线在**真实浏览器**里真的被用上，
 * 而不是静默降级回主线程（降级路径只由单测覆盖）。
 *
 * 判据：Worker 构造时会请求 `filePipeline.worker` 模块脚本，
 * 因此监听该请求即可证明「Worker 已加载并接管解析」。
 */
test('文件管线 Worker：导入时真实加载 filePipeline.worker', async ({ page }) => {
  // 必须同时断言「请求了」和「响应 200」：只断言请求的话，worker chunk 404（被静默降级）
  // 也会让测试通过，而那正是 C4 阶段 4 要避免的假绿。
  const workerStatus: number[] = []
  page.on('response', (response) => {
    if (response.url().includes('filePipeline.worker')) {
      workerStatus.push(response.status())
    }
  })

  await page.goto('/tools/table2kml_point')
  await expect(page.getByRole('heading', { level: 1, name: '点位KML生成' })).toBeVisible()

  const fixture = fileURLToPath(new URL('./fixtures/kml-points.csv', import.meta.url))
  await page.locator('input[type="file"]').setInputFiles(fixture)

  // 走 Worker 解析：校验通过的文案证明矩阵解析成功
  await expect(page.getByText('验证通过，共 1 个有效点位')).toBeVisible()

  expect(workerStatus.length).toBeGreaterThan(0)
  expect(workerStatus.every((status) => status === 200)).toBe(true)
})
