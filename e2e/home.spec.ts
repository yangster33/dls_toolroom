import { test, expect } from '@playwright/test'

test('首页正常渲染：标题与导航存在', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: '大龙山工具间' })).toBeVisible()
  await expect(page.getByText('通信工程科研、规划与设计工具集')).toBeVisible()

  const nav = page.locator('.site-nav')
  await expect(nav.getByRole('link', { name: '首页', exact: true })).toBeVisible()
  await expect(nav.getByRole('link', { name: '工具索引', exact: true })).toBeVisible()
  await expect(nav.getByRole('link', { name: '关于', exact: true })).toBeVisible()
  await expect(nav.getByRole('link', { name: '支持我', exact: true })).toBeVisible()
})

test('首页入口跳转到工具索引页', async ({ page }) => {
  await page.goto('/')

  await page
    .getByRole('link', { name: /全部 \d+ 个工具/ })
    .first()
    .click()

  await expect(page).toHaveURL(/\/tools$/)
  await expect(page.getByRole('heading', { level: 1, name: '工具索引' })).toBeVisible()
})
