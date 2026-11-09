import { test, expect } from '@playwright/test'

/**
 * D5 拆分后的图框图签页冒烟：
 * 加载 → 专业模式 → 切换图幅 → 导出 JSON。
 */
test('图框图签：专业模式切换图幅并导出 JSON', async ({ page }) => {
  await page.goto('/tools/sheet_template')

  await expect(page.getByRole('heading', { level: 1, name: '图框图签生成' })).toBeVisible()

  await page.getByRole('button', { name: '专业模式' }).click()
  await expect(page.getByRole('heading', { name: '图幅' })).toBeVisible()

  await page.getByRole('button', { name: 'A3', exact: true }).click()
  await expect(page.getByText(/420×297|297×420/)).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /导出 JSON/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^sheet-A3-.*\.json$/)
})
