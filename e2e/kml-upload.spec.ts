import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

test('点位KML：上传 CSV 校验通过并下载 KML', async ({ page }) => {
  await page.goto('/tools/table2kml_point')

  await expect(page.getByRole('heading', { level: 1, name: '点位KML生成' })).toBeVisible()

  const fixture = fileURLToPath(new URL('./fixtures/kml-points.csv', import.meta.url))
  await page.locator('input[type="file"]').setInputFiles(fixture)

  await expect(page.getByText('验证通过，共 1 个有效点位')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载 KML 文件' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/点位数据_.*\.kml$/)
})
