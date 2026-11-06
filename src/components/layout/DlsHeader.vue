<template>
  <div class="header-wrapper">
    <nav class="site-nav">
      <label for="my-drawer-4" class="nav-toggle" aria-label="打开目录">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="square"
          class="size-4"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </label>

      <router-link to="/" class="brand">
        <span class="brand-mark-wrap" aria-hidden="true">
          <img
            class="brand-mark brand-mark-light"
            src="/brand/logo-mark.svg"
            alt=""
            width="28"
            height="28"
          />
          <img
            class="brand-mark brand-mark-dark"
            src="/brand/logo-mark-dark.svg"
            alt=""
            width="28"
            height="28"
          />
        </span>
        <span class="brand-copy">
          <span class="brand-title">大龙山工具间</span>
          <span class="brand-sub">通信工程 · 科研 / 规划 / 设计工具集</span>
        </span>
      </router-link>

      <nav v-if="breadcrumbItems.length > 1" class="crumbs" aria-label="面包屑">
        <template v-for="(item, index) in breadcrumbItems" :key="item.path">
          <span v-if="index > 0" class="crumb-sep" aria-hidden="true">/</span>
          <router-link v-if="index < breadcrumbItems.length - 1" :to="item.path" class="crumb-link">
            {{ item.name }}
          </router-link>
          <span v-else class="crumb-current" aria-current="page">{{ item.name }}</span>
        </template>
      </nav>

      <div class="nav-end">
        <ThemeToggle />
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ThemeToggle from '@/components/theme/ThemeToggle.vue'
import { getToolById } from '@/tools/toolData'

const route = useRoute()

// 路由名称映射
const routeNameMap: Record<string, { name: string; path: string }> = {
  '/': { name: '首页', path: '/' },
  '/tools': { name: '工具索引', path: '/tools' },
  '/about': { name: '关于', path: '/about' },
  '/donate': { name: '支持我', path: '/donate' },
}

// 从路由路径生成面包屑项
const breadcrumbItems = computed(() => {
  const currentPath = route.path

  if (currentPath === '/') {
    return [routeNameMap['/']!]
  }

  // 工具详情页 /tools/:toolId
  const toolMatch = currentPath.match(/^\/tools\/(.+)$/)
  if (toolMatch && toolMatch[1]) {
    const tool = getToolById(toolMatch[1])
    if (tool) {
      return [routeNameMap['/']!, routeNameMap['/tools']!, { name: tool.name, path: currentPath }]
    }
  }

  if (routeNameMap[currentPath]) {
    return [routeNameMap['/']!, routeNameMap[currentPath]!]
  }

  return [routeNameMap['/']!]
})
</script>

<style scoped>
.header-wrapper {
  position: relative;
  z-index: 50;
}

.site-nav {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  height: 56px;
  padding: 0 0.75rem;
  background-color: var(--color-base-100);
  border-bottom: 1px solid var(--color-base-300);
}

.nav-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--color-base-content);
  border: 1px solid transparent;
  border-radius: 0;
}

@media (max-width: 1023px) {
  .nav-toggle {
    display: inline-flex;
  }
}

.nav-toggle:hover {
  border-color: var(--color-base-300);
  background-color: var(--color-base-200);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  font-family: var(--font-drawing);
  font-size: 1.125rem;
  letter-spacing: 0.02em;
  color: var(--color-base-content);
  white-space: nowrap;
}

.brand-mark-wrap {
  position: relative;
  display: block;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
}

.brand-mark {
  position: absolute;
  inset: 0;
  display: block;
  width: 28px;
  height: 28px;
}

.brand-mark-dark {
  display: none;
}

:global(html[data-theme='lantu']) .brand-mark-light {
  display: none;
}

:global(html[data-theme='lantu']) .brand-mark-dark {
  display: block;
}

.brand-copy {
  display: flex;
  align-items: baseline;
  gap: 0.625rem;
  min-width: 0;
}

.brand-sub {
  font-family: var(--font-sans);
  font-size: 11px;
  letter-spacing: 0.02em;
  color: var(--text-muted);
}

.crumbs {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
  margin-left: 0.75rem;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
}

.crumb-link,
.crumb-current {
  color: var(--text-muted);
}

.crumb-link:hover {
  color: var(--color-primary);
}

.crumb-current {
  color: var(--color-base-content);
}

.crumb-sep {
  color: var(--text-faint);
}

.nav-end {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .brand-sub {
    display: none;
  }
}

@media (max-width: 640px) {
  .crumbs {
    display: none;
  }
}
</style>
