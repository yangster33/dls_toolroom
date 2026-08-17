import { test, expect } from '@playwright/test'

test('工具列表页点击卡片进入对应工具', async ({ page }) => {
  await page.goto('/tools')

  const toolCard = page.locator('.tool-item', { hasText: '坐标转换' })
  await expect(toolCard).toBeVisible()
  await toolCard.click()

  await expect(page).toHaveURL(/\/tools\/coord_convert$/)
  await expect(page.getByRole('heading', { level: 1, name: '坐标转换' })).toBeVisible()
})

test('工具列表页搜索可直接跳转到工具', async ({ page }) => {
  await page.goto('/tools')

  await page.locator('.search-container input').fill('距离测算')
  await page.locator('.search-result-item', { hasText: '距离测算' }).click()

  await expect(page).toHaveURL(/\/tools\/distance_sensor$/)
  await expect(page.getByRole('heading', { level: 1, name: '距离测算' })).toBeVisible()
})
