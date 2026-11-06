<!-- src/components/layout/DlsSidebar.vue -->
<template>
  <div class="site-top">
    <FiberColorStrip />
    <DlsHeader />
  </div>

  <div class="drawer lg:drawer-open">
    <input id="my-drawer-4" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content">
      <div class="page-body">
        <router-view v-slot="{ Component, route }">
          <component :is="Component" :key="route.path" />
        </router-view>
      </div>
    </div>

    <div class="drawer-side">
      <label for="my-drawer-4" aria-label="关闭目录" class="drawer-overlay"></label>
      <div class="sidebar">
        <div class="sidebar-search-wrap">
          <div class="sidebar-search">
            <PhMagnifyingGlass class="sidebar-search-icon" />
            <input
              v-model="searchQuery"
              type="search"
              placeholder="搜索工具"
              aria-label="搜索工具"
              class="sidebar-search-input"
              @keyup.escape="clearSearch"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="sidebar-search-clear"
              aria-label="清除搜索"
              @click="clearSearch"
            >
              <PhX class="size-3.5" />
            </button>
          </div>

          <div v-if="searchQuery" class="sidebar-results">
            <ul v-if="filteredTools.length" class="sidebar-results-list">
              <li v-for="tool in filteredTools" :key="tool.id">
                <router-link :to="`/tools/${tool.id}`" class="sidebar-result" @click="clearSearch">
                  <component :is="tool.icon" class="size-4 shrink-0 text-primary" />
                  <span class="sidebar-result-name">{{ tool.name }}</span>
                </router-link>
              </li>
            </ul>
            <div v-else class="sidebar-empty">未找到匹配的工具</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          <p class="sidebar-heading">目录</p>
          <router-link
            v-for="item in mainNav"
            :key="item.path"
            :to="item.path"
            class="nav-item"
            :class="{ 'nav-item-active': isMainActive(item.path) }"
            :title="item.label"
          >
            <component :is="item.icon" class="nav-icon" />
            <span>{{ item.label }}</span>
          </router-link>
        </nav>

        <nav class="sidebar-nav">
          <p class="sidebar-heading">按专业</p>
          <router-link
            v-for="item in professions"
            :key="item.key"
            :to="{ path: '/tools', query: { prof: item.key } }"
            class="nav-item"
            :class="{ 'nav-item-active': isProfessionActive(item.key) }"
            :title="item.label"
          >
            <span class="nav-badge">{{ item.short }}</span>
            <span>{{ item.label }}</span>
          </router-link>
        </nav>

        <div class="sidebar-foot">
          <p>{{ toolCount }} 个工具 · {{ professions.length }} 个专业</p>
          <p class="sidebar-foot-sub">通信工程科研 / 规划 / 设计</p>
        </div>
      </div>
    </div>
  </div>
  <DlsFooter />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import DlsHeader from './DlsHeader.vue'
import DlsFooter from './DlsFooter.vue'
import FiberColorStrip from './FiberColorStrip.vue'
import { PhHouse, PhToolbox, PhInfo, PhHeart, PhMagnifyingGlass, PhX } from '@phosphor-icons/vue'
import { toolConfigs } from '@/tools/toolData'
import { professions } from '@/tools/toolTaxonomy'

const route = useRoute()
const searchQuery = ref('')
const toolCount = toolConfigs.length

const isMainActive = (path: string) =>
  path === '/' ? route.path === '/' : route.path === path || route.path.startsWith(`${path}/`)

const isProfessionActive = (key: string) => route.path === '/tools' && route.query.prof === key

const mainNav = [
  { path: '/', label: '首页', icon: PhHouse },
  { path: '/tools', label: '工具索引', icon: PhToolbox },
  { path: '/about', label: '关于', icon: PhInfo },
  { path: '/donate', label: '支持我', icon: PhHeart },
]

const filteredTools = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return []
  return toolConfigs.filter(
    (tool) =>
      tool.name.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query) ||
      tool.tags.some((tag) => tag.toLowerCase().includes(query)),
  )
})

const clearSearch = () => {
  searchQuery.value = ''
}
</script>

<style scoped>
.site-top {
  position: sticky;
  top: 0;
  z-index: 50;
  background-color: var(--color-base-100);
}

.drawer {
  min-height: calc(100dvh - 62px);
}

@media (min-width: 1024px) {
  .drawer-side {
    top: 62px;
    height: calc(100dvh - 62px);
  }
}

@media (max-width: 1023px) {
  .drawer-side {
    z-index: 60;
  }
}

.page-body {
  padding: 1rem;
}

@media (min-width: 1024px) {
  .page-body {
    padding: 1.5rem;
  }
}

/* 页脚紧贴抽屉底部，留白放在内容列内：侧栏背景可一直延伸到页脚，不会出现断口 */
.drawer-content {
  padding-bottom: 3rem;
}

.sidebar {
  display: flex;
  width: 13rem;
  min-height: 100%;
  flex-direction: column;
  align-items: stretch;
  background-color: var(--color-base-200);
  border-right: 1px solid var(--color-base-300);
}

.sidebar-search-wrap {
  position: relative;
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-base-300);
}

.sidebar-search {
  position: relative;
  display: flex;
  align-items: center;
  border: 1px solid var(--color-base-300);
  background-color: var(--color-base-100);
}

.sidebar-search-icon {
  position: absolute;
  left: 0.5rem;
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  pointer-events: none;
}

.sidebar-search-input {
  width: 100%;
  padding: 0.375rem 1.75rem 0.375rem 1.75rem;
  font-size: 12px;
  background: transparent;
  border: 0;
  outline: none;
  color: var(--color-base-content);
}

.sidebar-search-input::placeholder {
  color: var(--text-faint);
}

.sidebar-search-input::-webkit-search-cancel-button {
  display: none;
}

.sidebar-search-clear {
  position: absolute;
  right: 0.375rem;
  color: var(--text-muted);
}

.sidebar-search-clear:hover {
  color: var(--color-base-content);
}

.sidebar-results {
  position: absolute;
  top: calc(100% - 0.25rem);
  left: 0.75rem;
  right: 0.75rem;
  z-index: 60;
  background-color: var(--color-base-100);
  border: 1px solid var(--color-base-300);
}

.sidebar-results-list {
  max-height: 16rem;
  overflow-y: auto;
}

.sidebar-result {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 12px;
  border-bottom: 1px solid var(--color-base-200);
}

.sidebar-result:hover {
  background-color: var(--color-base-200);
}

.sidebar-result-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-empty {
  padding: 0.75rem;
  font-size: 12px;
  text-align: center;
  color: var(--text-muted);
}

.sidebar-nav {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-base-300);
}

.sidebar-heading {
  padding: 0.25rem 0.75rem 0.375rem;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  font-size: 13px;
  color: color-mix(in oklab, var(--color-base-content) 80%, transparent);
  border-left: 2px solid transparent;
}

.nav-item:hover {
  background-color: var(--color-base-100);
  color: var(--color-base-content);
}

.nav-item.nav-item-active {
  border-left-color: var(--color-primary);
  background-color: var(--color-base-100);
  color: var(--color-primary);
}

.nav-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.nav-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  font-size: 10px;
  line-height: 1;
  color: color-mix(in oklab, var(--color-base-content) 70%, transparent);
  border: 1px solid var(--color-base-300);
}

.sidebar-foot {
  margin-top: auto;
  padding: 0.75rem;
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-muted);
}

.sidebar-foot-sub {
  margin-top: 0.125rem;
}
</style>
