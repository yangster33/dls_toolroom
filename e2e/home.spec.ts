import { test, expect } from '@playwright/test'

test('首页正常渲染：标题与导航存在', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: '大龙山工具间' })).toBeVisible()
  await expect(page.getByText('通信工程科研、规划与设计工具集')).toBeVisible()

  // 当前头部只在非首页显示面包屑；首页只保留品牌入口
  await expect(page.getByRole('link', { name: /大龙山工具间/ })).toBeVisible()
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
