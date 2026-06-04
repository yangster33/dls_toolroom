<!-- src/components/layout/DlsSidebar.vue -->
<template>
  <FlowingBackground :enabled="flowingBackgroundStore.enabled" />
  <div class="drawer lg:drawer-open">
    <input id="my-drawer-4" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content">
      <DlsHeader />
      <div class="p-4">
        <router-view v-slot="{ Component, route }">
          <transition name="page" mode="out-in">
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </div>
    </div>

    <div class="drawer-side is-drawer-close:overflow-visible">
      <label for="my-drawer-4" aria-label="close sidebar" class="drawer-overlay"></label>
      <div
        class="flex min-h-full flex-col items-start bg-base-200 is-drawer-close:w-14 is-drawer-open:w-48"
      >
        <div class="w-full p-3 is-drawer-close:hidden relative">
          <div class="relative">
            <PhMagnifyingGlass
              class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/60"
            />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索工具..."
              class="w-full pl-9 pr-3 py-2 text-sm border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-base-100 text-base-content"
              @keyup.escape="clearSearch"
            />
            <button
              v-if="searchQuery"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/60 hover:text-base-content"
              @click="clearSearch"
            >
              <PhX class="size-4" />
            </button>
          </div>

          <div
            v-if="searchQuery && filteredTools.length > 0"
            class="absolute top-full left-3 right-3 mt-2 z-50"
          >
            <ul
              class="max-h-64 overflow-y-auto bg-base-100 rounded-lg shadow-lg border border-base-200 w-full"
            >
              <li
                v-for="tool in filteredTools"
                :key="tool.id"
                class="px-3 py-2 hover:bg-base-200 cursor-pointer border-b border-base-200 last:border-b-0"
              >
                <router-link
                  :to="`/tools/${tool.id}`"
                  class="flex items-center gap-2"
                  @click="clearSearch"
                >
                  <component :is="tool.icon" class="size-4 text-primary" />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-base-content truncate">
                      {{ tool.name }}
                    </div>
                    <div class="text-xs text-base-content/60 truncate">{{ tool.description }}</div>
                  </div>
                </router-link>
              </li>
            </ul>
          </div>

          <div
            v-if="searchQuery && filteredTools.length === 0"
            class="absolute top-full left-3 right-3 mt-2 z-50"
          >
            <div
              class="text-sm text-base-content/60 text-center py-4 bg-base-100 rounded-lg border border-base-200 shadow-lg"
            >
              未找到匹配的工具
            </div>
          </div>
        </div>

        <ul class="menu w-full grow">
          <li>
            <router-link
              to="/"
              class="is-drawer-close:tooltip is-drawer-close:tooltip-right"
              data-tip="首页"
            >
              <PhHouse class="my-1.5 inline-block size-4" />
              <span class="is-drawer-close:hidden">&nbsp;&nbsp;首页</span>
            </router-link>
          </li>
          <li>
            <router-link
              to="/tools"
              class="is-drawer-close:tooltip is-drawer-close:tooltip-right"
              data-tip="工具集"
            >
              <PhToolbox class="my-1.5 inline-block size-4" />
              <span class="is-drawer-close:hidden">&nbsp;&nbsp;工具集</span>
            </router-link>
          </li>
          <li>
            <router-link
              to="/about"
              class="is-drawer-close:tooltip is-drawer-close:tooltip-right"
              data-tip="关于"
            >
              <PhInfo class="my-1.5 inline-block size-4" />
              <span class="is-drawer-close:hidden">&nbsp;&nbsp;关于</span>
            </router-link>
          </li>
          <li>
            <router-link
              to="/donate"
              class="is-drawer-close:tooltip is-drawer-close:tooltip-right"
              data-tip="支持我"
            >
              <PhHeart class="my-1.5 inline-block size-4 text-red-500" />
              <span class="is-drawer-close:hidden">&nbsp;&nbsp;支持我</span>
            </router-link>
          </li>
        </ul>
      </div>
    </div>
  </div>
  <DlsFooter />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import DlsHeader from './DlsHeader.vue'
import DlsFooter from './DlsFooter.vue'
import FlowingBackground from './FlowingBackground.vue'
import { useFlowingBackgroundStore } from '@/stores/flowingBackgroundStore'
import { PhHouse, PhToolbox, PhInfo, PhHeart, PhMagnifyingGlass, PhX } from '@phosphor-icons/vue'
import { toolConfigs } from '@/tools/toolData'

const flowingBackgroundStore = useFlowingBackgroundStore()
const searchQuery = ref('')

const filteredTools = computed(() => {
  if (!searchQuery.value.trim()) return []
  const query = searchQuery.value.toLowerCase()
  return toolConfigs.filter((tool) => {
    return (
      tool.name.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query) ||
      tool.tags.some((tag) => tag.toLowerCase().includes(query))
    )
  })
})

const clearSearch = () => {
  searchQuery.value = ''
}
</script>

<style scoped>
.page-enter-active,
.page-leave-active {
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.page-enter-from {
  opacity: 0;
  transform: translateX(30px) scale(0.95);
}

.page-leave-to {
  opacity: 0;
  transform: translateX(-30px) scale(0.95);
}

.page-enter-to,
.page-leave-from {
  opacity: 1;
  transform: translateX(0) scale(1);
}
</style>
