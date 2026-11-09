import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

/**
 * D4 拆分后的 KML 查看器交互回归：
 * 上传 KML → 图层树 → 全隐藏/全显示 → 测距 → 采点。
 */
test('KML 查看器：上传 KML、图层树、显隐、测距与采点', async ({ page }) => {
  await page.goto('/tools/kml_viewer')

  await expect(page.getByRole('heading', { level: 1, name: /KML/ })).toBeVisible()
  await expect(page.locator('.leaflet-container')).toBeVisible()

  const fixture = fileURLToPath(new URL('./fixtures/kml-viewer-sample.kml', import.meta.url))
  await page.locator('input[type="file"]').setInputFiles(fixture)

  // 图层树（文件夹 + 两个点位）
  await expect(page.getByText('机房')).toBeVisible()
  await expect(page.getByText('站点 A')).toBeVisible()
  await expect(page.getByText('站点 B')).toBeVisible()

  // 全隐藏 / 全显示
  await page.getByRole('button', { name: '全部隐藏' }).click()
  await expect(page.getByRole('button', { name: '全部显示' })).toBeVisible()
  await page.getByRole('button', { name: '全部显示' }).click()

  const map = page.locator('.leaflet-container')
  const box = await map.boundingBox()
  expect(box).not.toBeNull()

  // 测距：点两个点后出现「长度:」
  await page.getByRole('button', { name: /测距/ }).click()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.click(box!.x + box!.width / 2 + 80, box!.y + box!.height / 2)
  await expect(page.getByText(/长度:/)).toBeVisible()

  // 采点：点一个点后出现采集坐标列表
  await page.getByRole('button', { name: /采点/ }).click()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await expect(page.getByText('采集坐标 (WGS84)')).toBeVisible()
})
