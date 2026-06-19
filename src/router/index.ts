// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { logger } from '@/utils/logger'
import DlsSidebar from '@/components/layout/DlsSidebar.vue'

// 定义路由配置
const routes = [
  {
    path: '/',
    component: DlsSidebar,
    children: [
      {
        path: '',
        name: 'Index',
        component: () => import('@/views/pages/home/IndexPage.vue'),
      },
      {
        path: 'tools',
        name: 'Tools',
        component: () => import('@/views/pages/home/ToolsView.vue'),
      },
      {
        name: 'About',
        path: 'about',
        component: () => import('@/views/pages/about/AboutView.vue'),
      },
      {
        path: 'home',
        redirect: { name: 'Index' },
      },
      {
        path: 'tools/:toolId',
        name: 'ToolDetail',
        component: () => import('@/views/layouts/ToolDetailView.vue'),
      },
      {
        path: 'donate',
        name: 'Donate',
        component: () => import('@/views/pages/donate/DonatePage.vue'),
      },
      {
        path: ':pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('@/views/pages/404/NotFoundPage.vue'),
      },
    ],
  },
]

// 创建路由实例
const router = createRouter({
  // 使用 HTML5 历史模式
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,

  // 滚动行为配置
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  },
})

// 统一页面访问追踪
router.afterEach((to) => {
  const pageName = to.name as string
  const pagePath = to.path
  const toolId = to.params.toolId as string | undefined
  const timestamp = Date.now()
  const userAgent = navigator.userAgent
  const referrer = document.referrer

  logger.log(`${pageName} 被访问`, {
    pageName,
    path: pagePath,
    toolId,
    timestamp,
    userAgent,
    referrer,
  })

  // 发送页面访问统计到后端
  fetch(`/api/page-stats/${toolId || (pageName as string) || 'index'}/view`, {
    method: 'POST',
  }).catch(() => {
    /* 静默失败，不影响页面功能 */
  })
})

export default router
