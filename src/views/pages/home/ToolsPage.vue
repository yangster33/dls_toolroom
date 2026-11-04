<template>
  <div class="index-page">
    <header class="index-head">
      <div>
        <h1 class="index-title">工具索引</h1>
        <p class="index-sub readout">
          共 {{ toolConfigs.length }} 个工具 · {{ resultCount }} 个匹配
        </p>
      </div>
      <div class="index-search">
        <PhMagnifyingGlass class="index-search-icon" />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="按名称、用途或标签搜索"
          aria-label="搜索工具"
          class="index-search-input"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="index-search-clear"
          aria-label="清除搜索"
          @click="searchQuery = ''"
        >
          <PhX class="size-3.5" />
        </button>
      </div>
    </header>

    <!-- 双轴筛选：动作 × 专业 -->
    <div class="filters">
      <div class="filter-row">
        <span class="filter-label">动作</span>
        <div class="filter-options">
          <button
            type="button"
            class="filter-chip"
            :class="{ 'filter-chip-active': activeAction === 'all' }"
            :aria-pressed="activeAction === 'all'"
            @click="activeAction = 'all'"
          >
            全部
          </button>
          <button
            v-for="action in actions"
            :key="action.key"
            type="button"
            class="filter-chip"
            :class="{ 'filter-chip-active': activeAction === action.key }"
            :aria-pressed="activeAction === action.key"
            @click="activeAction = action.key"
          >
            {{ action.label }}
          </button>
        </div>
      </div>

      <div class="filter-row">
        <span class="filter-label">专业</span>
        <div class="filter-options">
          <button
            type="button"
            class="filter-chip"
            :class="{ 'filter-chip-active': activeProfession === 'all' }"
            :aria-pressed="activeProfession === 'all'"
            @click="setProfession('all')"
          >
            全部
          </button>
          <button
            v-for="item in professions"
            :key="item.key"
            type="button"
            class="filter-chip"
            :class="{ 'filter-chip-active': activeProfession === item.key }"
            :aria-pressed="activeProfession === item.key"
            @click="setProfession(item.key)"
          >
            {{ item.label }}
            <span class="filter-chip-count readout">{{ professionCount(item.key) }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 目录 -->
    <div v-if="filteredTools.length" class="ledger ledger-table">
      <div class="ledger-row ledger-head" aria-hidden="true">
        <span>序号</span>
        <span>工具</span>
        <span>用途</span>
        <span>专业</span>
        <span>交付物</span>
      </div>

      <router-link
        v-for="item in filteredTools"
        :key="item.id"
        :to="`/tools/${item.id}`"
        class="ledger-row ledger-tool"
      >
        <span class="cell-no readout">{{ item.no }}</span>
        <span class="cell-name">{{ item.name }}</span>
        <span class="cell-desc">{{ item.description }}</span>
        <span class="cell-prof">{{ item.profession }}</span>
        <span class="cell-out readout">{{ item.output }}</span>
      </router-link>
    </div>

    <!-- 空状态：专业规划中 -->
    <div v-else-if="emptyProfession" class="empty">
      <p class="empty-title">{{ emptyProfession.label }}专业 · 规划中</p>
      <p class="empty-text">{{ emptyProfession.description }}，目前还没有可用的工具。</p>
      <p v-if="emptyProfession.planned.length" class="empty-text">
        计划收录：{{ emptyProfession.planned.join('、') }}。
      </p>
      <a class="empty-action" href="mailto:yangster33@outlook.com">需要哪个？说一声</a>
    </div>

    <!-- 空状态：筛选/搜索无结果 -->
    <div v-else class="empty">
      <p class="empty-title">没有匹配的工具</p>
      <p class="empty-text">换一个关键词，或者清空筛选条件。</p>
      <button type="button" class="empty-action" @click="resetFilters">清空筛选</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PhMagnifyingGlass, PhX } from '@phosphor-icons/vue'
import { toolConfigs } from '@/tools/toolData'
import {
  actions,
  professions,
  getProfession,
  getToolMeta,
  type ActionKey,
  type ProfessionKey,
} from '@/tools/toolTaxonomy'

const route = useRoute()
const router = useRouter()

const searchQuery = ref('')
const activeAction = ref<ActionKey | 'all'>('all')
const activeProfession = ref<ProfessionKey | 'all'>('all')

const isProfessionKey = (value: string): value is ProfessionKey =>
  professions.some((item) => item.key === value)

// 侧栏「按专业」通过 ?prof= 进入；同路由切换时靠 watch 生效
watch(
  () => route.query.prof,
  (value) => {
    activeProfession.value = typeof value === 'string' && isProfessionKey(value) ? value : 'all'
  },
  { immediate: true },
)

const setProfession = (key: ProfessionKey | 'all') => {
  activeProfession.value = key
  const query = { ...route.query }
  if (key === 'all') delete query.prof
  else query.prof = key
  router.replace({ query })
}

const professionCount = (key: ProfessionKey) =>
  toolConfigs.filter((tool) => getToolMeta(tool.id).profession === key).length

const rows = toolConfigs.map((tool, index) => {
  const meta = getToolMeta(tool.id)
  return {
    id: tool.id,
    no: String(index + 1).padStart(2, '0'),
    name: tool.name,
    description: tool.description,
    tags: tool.tags,
    profession: getProfession(meta.profession).label,
    professionKey: meta.profession,
    actionKey: meta.action,
    output: meta.output,
  }
})

const filteredTools = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return rows.filter((item) => {
    if (activeAction.value !== 'all' && item.actionKey !== activeAction.value) return false
    if (activeProfession.value !== 'all' && item.professionKey !== activeProfession.value)
      return false
    if (!query) return true
    return (
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.tags.some((tag) => tag.toLowerCase().includes(query))
    )
  })
})

const resultCount = computed(() => filteredTools.value.length)

/** 选中的专业本身一个工具都没有 —— 显示"规划中"，而不是"没找到" */
const emptyProfession = computed(() => {
  if (activeProfession.value === 'all') return null
  if (professionCount(activeProfession.value) > 0) return null
  return getProfession(activeProfession.value)
})

const resetFilters = () => {
  searchQuery.value = ''
  activeAction.value = 'all'
  setProfession('all')
}
</script>

<style scoped>
.index-page {
  display: flex;
  flex-direction: column;
}

.index-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-base-300);
}

.index-title {
  font-family: var(--font-drawing);
  font-size: 1.75rem;
  font-weight: 400;
  letter-spacing: 0.03em;
}

.index-sub {
  margin-top: 0.25rem;
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
}

.index-search {
  position: relative;
  display: flex;
  align-items: center;
  width: min(320px, 40vw);
  border: 1px solid var(--color-base-300);
  background-color: var(--color-base-100);
}

.index-search-icon {
  position: absolute;
  left: 0.5rem;
  width: 14px;
  height: 14px;
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
  pointer-events: none;
}

.index-search-input {
  width: 100%;
  padding: 0.375rem 1.75rem 0.375rem 1.75rem;
  font-size: 12px;
  background: transparent;
  border: 0;
  outline: none;
  color: var(--color-base-content);
}

.index-search-input::placeholder {
  color: color-mix(in oklab, var(--color-base-content) 45%, transparent);
}

.index-search-input::-webkit-search-cancel-button {
  display: none;
}

.index-search-clear {
  position: absolute;
  right: 0.5rem;
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
}

.index-search-clear:hover {
  color: var(--color-base-content);
}

/* 筛选 */
.filters {
  border-bottom: 1px solid var(--color-base-300);
}

.filter-row {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.5rem 1.5rem;
  border-bottom: 1px solid color-mix(in oklab, var(--color-base-300) 60%, transparent);
}

.filter-row:last-child {
  border-bottom: 0;
}

.filter-label {
  flex: 0 0 2.5rem;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
}

.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  font-size: 12px;
  color: color-mix(in oklab, var(--color-base-content) 70%, transparent);
  border: 1px solid transparent;
}

.filter-chip:hover {
  border-color: var(--color-base-300);
  color: var(--color-base-content);
}

.filter-chip-active,
.filter-chip-active:hover {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-primary-content);
}

.filter-chip-count {
  font-size: 10px;
  opacity: 0.6;
}

/* 目录表 */
.ledger-table {
  display: flex;
  flex-direction: column;
}

.ledger-head {
  grid-template-columns: 3.5rem minmax(8rem, 12rem) minmax(0, 1fr) 4rem 6rem;
  gap: 1rem;
  padding: 0.375rem 1.5rem;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
  background-color: var(--color-base-200);
  border-bottom: 1px solid var(--color-base-300);
}

.ledger-tool {
  grid-template-columns: 3.5rem minmax(8rem, 12rem) minmax(0, 1fr) 4rem 6rem;
  gap: 1rem;
  padding: 0.5rem 1.5rem;
  color: var(--color-base-content);
}

.ledger-tool:hover .cell-name {
  color: var(--color-primary);
}

.cell-no {
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 45%, transparent);
}

.cell-name {
  font-size: 13px;
  font-weight: 500;
}

.cell-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: color-mix(in oklab, var(--color-base-content) 60%, transparent);
}

.cell-prof,
.cell-out {
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
}

/* 空状态 */
.empty {
  padding: 3rem 1.5rem;
  text-align: center;
}

.empty-title {
  font-family: var(--font-drawing);
  font-size: 1.25rem;
}

.empty-text {
  margin-top: 0.375rem;
  font-size: 12px;
  color: color-mix(in oklab, var(--color-base-content) 60%, transparent);
}

.empty-action {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.375rem 0.75rem;
  font-size: 12px;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.empty-action:hover {
  background-color: var(--color-primary);
  color: var(--color-primary-content);
}

@media (max-width: 900px) {
  .index-head {
    flex-direction: column;
    align-items: stretch;
  }

  .index-search {
    width: 100%;
  }

  .ledger-head {
    display: none;
  }

  .ledger-tool {
    grid-template-columns: 2.5rem minmax(0, 1fr) 4rem;
    padding: 0.5rem 1rem;
  }

  .cell-desc,
  .cell-out {
    display: none;
  }

  .filter-row {
    padding: 0.5rem 1rem;
  }
}
</style>
