<template>
  <div class="bg-base-100/70 backdrop-blur-sm rounded-lg shadow-lg p-6 mx-6 mb-6">
    <!-- 搜索 + 分类 chips -->
    <div class="search-container mb-4">
      <div class="relative mb-3">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索工具..."
          class="input input-bordered w-full max-w-md bg-base-200"
        />
        <button
          v-if="searchQuery.trim()"
          class="btn btn-primary absolute right-0 top-0 rounded-l-none"
          @click="clearSearch"
        >
          清除
        </button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="cat in categories"
          :key="cat.key"
          class="btn btn-xs"
          :class="activeCategory === cat.key ? 'btn-primary' : 'btn-ghost'"
          @click="activeCategory = cat.key"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>

    <div class="divider my-4">工具列表</div>

    <div class="home-container h-full w-full overflow-auto p-4">
      <!-- 搜索结果列表模式 -->
      <div v-if="searchQuery.trim()" class="search-results-list">
        <div
          v-for="(tool, i) in filteredTools"
          :key="tool.id"
          class="search-result-item"
          :style="staggerStyle(i, 50)"
          @click="navigateToTool(tool.id)"
        >
          <div class="search-result-icon">
            <component :is="tool.icon" :size="48" weight="fill" class="text-primary" />
          </div>
          <div class="search-result-content">
            <div class="search-result-name">
              <template v-for="(part, index) in getHighlightedParts(tool.name)" :key="index">
                <span v-if="isMatch(part)" class="highlight-match">{{ part }}</span>
                <span v-else>{{ part }}</span>
              </template>
            </div>
            <div class="search-result-description">
              <template v-for="(part, index) in getHighlightedParts(tool.description)" :key="index">
                <span v-if="isMatch(part)" class="highlight-match">{{ part }}</span>
                <span v-else>{{ part }}</span>
              </template>
            </div>
            <div class="search-result-tags">
              <span v-for="tag in tool.tags" :key="tag" class="badge badge-ghost">
                <template v-for="(part, index) in getHighlightedParts(tag)" :key="index">
                  <span v-if="isMatch(part)" class="highlight-match">{{ part }}</span>
                  <span v-else>{{ part }}</span>
                </template>
              </span>
            </div>
          </div>
        </div>
        <div v-if="filteredTools.length === 0" class="no-results">
          <PhSmileySad class="size-12 mx-auto mb-3 text-base-content/30" />
          <p>没有找到匹配的工具</p>
        </div>
      </div>

      <!-- 正常网格模式 -->
      <Draggable
        v-else
        :key="activeCategory"
        v-model="dragTools"
        item-key="id"
        class="desktop-area"
        :animation="300"
        ghost-class="ghost"
        drag-class="dragging"
      >
        <template #item="{ element, index }">
          <div
            class="tool-item-wrapper relative group"
            :style="staggerStyle(index, 40)"
            @click="navigateToTool(element.id)"
            @dblclick="navigateToTool(element.id)"
          >
            <div
              class="tool-item flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer bg-base-100/70 backdrop-blur-sm border border-base-200/50"
            >
              <div class="icon-wrapper mb-2">
                <component
                  :is="element.icon"
                  :size="40"
                  weight="fill"
                  class="text-primary transition-transform duration-300 group-hover:scale-110"
                />
              </div>
              <span class="text-xs text-center break-all leading-tight text-base-content/70">{{
                element.name
              }}</span>
            </div>
          </div>
        </template>
      </Draggable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Draggable from 'vuedraggable'
import { PhSmileySad } from '@phosphor-icons/vue'
import { useHomeToolsStore } from '@/stores/homeToolsStore'
import type { ToolConfig } from '@/tools/toolData'

const router = useRouter()
const store = useHomeToolsStore()
const searchQuery = ref('')
const staggerStyle = (i: number, delayPerItem = 40) => ({
  animation: 'slide-up 0.35s ease-out both',
  animationDelay: `${i * delayPerItem}ms`,
})

const activeCategory = ref('all')

const categories = [
  { key: 'all', label: '全部' },
  { key: 'coord', label: '坐标工具' },
  { key: 'gis', label: 'GIS处理' },
  { key: 'doc', label: '文档模板' },
  { key: 'spatial', label: '空间分析' },
  { key: 'data', label: '数据查询' },
  { key: 'project', label: '项目管理' },
]

const categoryTagMap: Record<string, string[]> = {
  coord: ['坐标', '经纬度', '转换'],
  gis: ['GIS', 'SHP', 'KML', 'Shapefile'],
  doc: ['Word', 'Excel', '模板', '导出'],
  spatial: ['空间分析', '距离', '测算'],
  data: ['高程', '海拔', '天气', '地震', '灾害', 'GDACS', 'USGS', '气象'],
  project: ['甘特图', '项目管理', 'Gantt'],
}

const getHighlightedParts = (text: string) => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return [text]

  const regex = new RegExp(`(${query})`, 'gi')
  return text.split(regex).filter((part) => part !== '')
}

const isMatch = (part: string) => {
  const query = searchQuery.value.trim().toLowerCase()
  return query && part.toLowerCase() === query
}

const tools = computed<ToolConfig[]>({
  get: () => store.getOrderedTools(),
  set: (value) => {
    store.updateOrder(value.map((t) => t.id))
  },
})

const filteredTools = computed<ToolConfig[]>(() => {
  let list = store.getOrderedTools()

  if (activeCategory.value !== 'all') {
    const matchTags = categoryTagMap[activeCategory.value] || []
    list = list.filter((tool) => tool.tags.some((t) => matchTags.includes(t)))
  }

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    list = list.filter(
      (tool) =>
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query) ||
        tool.tags.some((tag) => tag.toLowerCase().includes(query)),
    )
  }

  return list
})

const dragTools = computed<ToolConfig[]>({
  get: () => filteredTools.value,
  set: (value) => {
    if (!searchQuery.value.trim() && activeCategory.value === 'all') {
      store.updateOrder(value.map((t) => t.id))
    }
  },
})

const navigateToTool = (toolId: string) => {
  router.push(`/tools/${toolId}`)
}

const clearSearch = () => {
  searchQuery.value = ''
}
</script>

<style scoped>
.home-container {
  min-height: 100vh;
}

.search-results-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-result-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  background: var(--fallback-b2, oklch(var(--b2) / 0.7));
  backdrop-filter: blur(8px);
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.search-result-item:hover {
  background: var(--fallback-b3, oklch(var(--b3) / 0.8));
  transform: translateX(0.25rem);
}

.search-result-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
}

.search-result-content {
  flex: 1;
  min-width: 0;
}

.search-result-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--fallback-bc, oklch(var(--bc) / 1));
  margin-bottom: 0.5rem;
}

.search-result-description {
  font-size: 0.875rem;
  color: var(--fallback-bc, oklch(var(--bc) / 0.7));
  margin-bottom: 0.5rem;
}

.search-result-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.search-result-tags .badge {
  cursor: default;
}

.no-results {
  text-align: center;
  padding: 3rem;
  color: var(--fallback-bc, oklch(var(--bc) / 0.5));
}

.highlight-match {
  background: var(--fallback-p, oklch(var(--p) / 0.3));
  padding: 0;
  margin: 0;
  border-radius: 0.125rem;
  font-weight: 600;
}

.desktop-area {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-content: flex-start;
  min-height: calc(100vh - 2rem);
  gap: 1.25rem;
}

.tool-item-wrapper {
  width: 80px;
}

.tool-item {
  user-select: none;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease,
    border-color 0.3s ease;
}

.tool-item-wrapper:hover .tool-item {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
  border-color: var(--fallback-p, oklch(var(--p) / 0.4));
}

.tool-item:active {
  transform: scale(0.98);
}

.dragging {
  opacity: 0.8;
  transform: scale(1.05);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 1000;
}

.ghost {
  opacity: 0.5;
  background: rgba(0, 0, 0, 0.05);
  border-radius: theme('borderRadius.xl');
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
}
</style>
