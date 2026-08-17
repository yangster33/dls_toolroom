import { test, expect } from '@playwright/test'

test('首页正常渲染：标题与导航存在', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: '大龙山工具间' })).toBeVisible()
  await expect(page.getByText('一站式地理空间数据处理与转换工具集')).toBeVisible()

  await expect(page.getByRole('link', { name: '首页', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '工具集', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '关于', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '支持我', exact: true })).toBeVisible()
})

test('首页按钮跳转到工具列表页', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: '浏览全部工具' }).click()

  await expect(page).toHaveURL(/\/tools$/)
  await expect(page.getByText('工具列表')).toBeVisible()
})
