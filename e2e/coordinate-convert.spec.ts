import { test, expect } from '@playwright/test'

test('坐标转换：WGS84 单点输入产出 6 系结果', async ({ page }) => {
  await page.goto('/tools/coord_convert')

  await expect(page.getByRole('heading', { level: 1, name: '坐标转换' })).toBeVisible()

  await page.getByPlaceholder('X / 经度').fill('116.4')
  await page.getByPlaceholder('Y / 纬度').fill('39.9')

  await expect(page.getByRole('heading', { level: 2, name: '3. 转换结果' })).toBeVisible()

  const rows = page.locator('table tbody tr')
  await expect(rows).toHaveCount(6)

  const wgs84Row = rows.filter({ hasText: 'WGS84' }).first()
  await expect(wgs84Row.locator('td').nth(1)).toHaveText('116.4')
  await expect(wgs84Row.locator('td').nth(2)).toHaveText('39.9')

  const gcj02Row = rows.filter({ hasText: 'GCJ-02' }).first()
  await expect(gcj02Row.locator('td').nth(1)).not.toHaveText('116.4')
  await expect(gcj02Row.locator('td').nth(1)).toHaveText(/\d+\.\d+/)
  await expect(gcj02Row.locator('td').nth(2)).toHaveText(/\d+\.\d+/)
})

test('坐标转换：无效输入不产出结果表', async ({ page }) => {
  await page.goto('/tools/coord_convert')

  await page.getByPlaceholder('X / 经度').fill('abc')
  await page.getByPlaceholder('Y / 纬度').fill('39.9')

  await expect(page.getByRole('heading', { level: 2, name: '3. 转换结果' })).toHaveCount(0)
  await expect(page.getByText('请输入有效的坐标以查看转换结果')).toBeVisible()
})
