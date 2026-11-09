import { test, expect } from '@playwright/test'

test('机房平面图：生成方案、渲染 SVG 并导出 JSON', async ({ page }) => {
  await page.goto('/tools/room_layout')

  await expect(page.getByRole('heading', { level: 1, name: '机房平面图生成' })).toBeVisible()

  await page.getByRole('button', { name: '生成 Top 3 方案' }).click()
  await expect(page.locator('.room-plan-preview svg')).toBeVisible()
  await expect(page.getByText('平面预览')).toBeVisible()
  await expect(page.getByRole('button', { name: /方案 1/ }).first()).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSON', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^room-layout-\d+\.json$/)
})
