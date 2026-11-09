import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

/**
 * D4 拆分 + F3 的 GeocodeCommon 交互回归：
 * CSV 导入 → 校验；XLSX 导入（Worker 解析）→ 校验。
 */
test('地址解析：CSV / XLSX 导入校验（F3 Worker 解析）', async ({ page }) => {
  const workerStatus: number[] = []
  page.on('response', (response) => {
    if (response.url().includes('filePipeline.worker')) {
      workerStatus.push(response.status())
    }
  })

  await page.goto('/tools/get_add')
  await expect(page.getByRole('heading', { level: 1, name: '地址解析' })).toBeVisible()

  // CSV
  const csv = fileURLToPath(new URL('./fixtures/geocode-add.csv', import.meta.url))
  await page.locator('input[type="file"]').setInputFiles(csv)
  await expect(page.getByText('验证通过，共 2 条数据')).toBeVisible()

  // 清除上传，再走 XLSX 分支
  await page.getByRole('button', { name: '清除上传文件' }).click()
  await expect(page.getByText('验证通过，共 2 条数据')).toBeHidden()

  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([
    ['名称', '经度', '纬度'],
    ['站点A', 116.4, 39.9],
    ['站点B', 116.5, 40.0],
  ])
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  await page.locator('input[type="file"]').setInputFiles({
    name: 'geocode-add.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
  })
  await expect(page.getByText('验证通过，共 2 条数据')).toBeVisible()

  // F3：XLSX 解析应真实走 Worker，而不是静默降级
  expect(workerStatus.length).toBeGreaterThan(0)
  expect(workerStatus.every((status) => status === 200)).toBe(true)
})

test('经纬度查询：CSV 地址模板导入校验', async ({ page }) => {
  await page.goto('/tools/get_lonlat')
  await expect(page.getByRole('heading', { level: 1, name: '经纬度查询' })).toBeVisible()

  const csv = fileURLToPath(new URL('./fixtures/geocode-lonlat.csv', import.meta.url))
  await page.locator('input[type="file"]').setInputFiles(csv)
  await expect(page.getByText('验证通过，共 2 条数据')).toBeVisible()
})
