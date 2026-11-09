import { test, expect } from '@playwright/test'

test('工具索引页点击条目进入对应工具', async ({ page }) => {
  await page.goto('/tools')

  const toolCard = page.locator('.ledger-tool[href="/tools/coord_convert"]')
  await expect(toolCard).toBeVisible()
  await toolCard.click()

  await expect(page).toHaveURL(/\/tools\/coord_convert$/)
  await expect(page.getByRole('heading', { level: 1, name: '坐标转换' })).toBeVisible()
})

test('工具索引页搜索可直接跳转到工具', async ({ page }) => {
  await page.goto('/tools')

  await page.locator('.index-search-input').fill('距离测算')
  await page.locator('.ledger-tool[href="/tools/distance_sensor"]').click()

  await expect(page).toHaveURL(/\/tools\/distance_sensor$/)
  await expect(page.getByRole('heading', { level: 1, name: '距离测算' })).toBeVisible()
})
