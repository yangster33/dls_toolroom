<!-- src/components/layout/DlsMainLayout.vue -->
<template>
  <div class="tool-main-layout">
    <!-- 工具区：一张图纸。图框 + 工作区 + 底部图签 -->
    <section v-if="toolPage" class="sheet-frame" :class="{ 'sheet-frame-flush': flush }">
      <span class="sheet-corner sheet-corner-tl" aria-hidden="true"></span>
      <span class="sheet-corner sheet-corner-tr" aria-hidden="true"></span>

      <div class="tool-page-area">
        <component :is="toolPage" v-bind="toolPageProps" />
      </div>

      <div class="sheet-title-block">
        <div class="sheet-cell sheet-cell-main">
          <p class="sheet-label">图名</p>
          <p class="sheet-title">{{ sheetTitle }}</p>
        </div>
        <div v-for="cell in titleCells" :key="cell.label" class="sheet-cell">
          <p class="sheet-label">{{ cell.label }}</p>
          <p class="sheet-value">{{ cell.value }}</p>
        </div>
      </div>
    </section>

    <!-- 说明条文：道 / 法 / 术 / 势，默认收起 -->
    <section v-if="navItems.length" class="docs">
      <button
        type="button"
        class="docs-toggle"
        :aria-expanded="docsOpen"
        aria-controls="docs-panel"
        @click="docsOpen = !docsOpen"
      >
        <span class="docs-toggle-mark" aria-hidden="true">{{ docsOpen ? '−' : '+' }}</span>
        <span class="docs-toggle-label">说明条文</span>
        <span class="docs-toggle-items">
          <span v-for="item in navItems" :key="item.name">{{ item.name }}</span>
        </span>
        <span class="docs-toggle-hint">{{ docsOpen ? '收起' : '展开' }}</span>
      </button>

      <div v-show="docsOpen" id="docs-panel" class="docs-panel">
        <div class="docs-tabs" role="tablist" aria-label="说明条文">
          <button
            v-for="(item, index) in navItems"
            :key="item.name"
            type="button"
            role="tab"
            class="docs-tab"
            :class="{ 'docs-tab-active': activeIndex === index }"
            :aria-selected="activeIndex === index"
            :tabindex="activeIndex === index ? 0 : -1"
            @click="activeIndex = index"
            @keydown.left.prevent="moveTab(-1)"
            @keydown.right.prevent="moveTab(1)"
          >
            {{ item.name }}
          </button>
        </div>
        <div role="tabpanel" class="docs-content">
          <component
            :is="activeItem?.component"
            v-if="activeItem?.component"
            :key="activeItem.name"
            v-bind="activeItem.props"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { getToolById, toolConfigs } from '@/tools/toolData'
import { getProfession, getToolMeta } from '@/tools/toolTaxonomy'

interface NavItem {
  name: string
  icon: string | Component
  component: Component | null
  props: Record<string, unknown>
}

const props = withDefaults(
  defineProps<{
    navItems: NavItem[]
    toolPage?: Component | null
    toolPageProps?: Record<string, unknown>
    /** 图名；不传则取工具名 */
    title?: string
    /** 传了工具 id 才会显示专业/图号/交付物 */
    toolId?: string
    /** 地图类工具去掉内边距 */
    flush?: boolean
  }>(),
  {
    toolPage: null,
    toolPageProps: () => ({}),
    title: '',
    toolId: '',
    flush: false,
  },
)

const docsOpen = ref(false)
const activeIndex = ref(0)

const activeItem = computed<NavItem | undefined>(() => props.navItems[activeIndex.value])

const moveTab = (delta: number) => {
  const count = props.navItems.length
  if (!count) return
  activeIndex.value = (activeIndex.value + delta + count) % count
}

const tool = computed(() => (props.toolId ? getToolById(props.toolId) : undefined))

const sheetTitle = computed(() => props.title || tool.value?.name || '')

const titleCells = computed(() => {
  if (!tool.value) return [{ label: '设计', value: 'yangster' }]

  const meta = getToolMeta(tool.value.id)
  const index = toolConfigs.findIndex((item) => item.id === tool.value!.id) + 1
  const sheetNo = index > 0 ? `DLS-${String(index).padStart(2, '0')}` : 'DLS'

  return [
    { label: '专业', value: getProfession(meta.profession).label },
    { label: '图号', value: sheetNo },
    { label: '交付物', value: meta.output },
    { label: '设计', value: 'yangster' },
  ]
})
</script>

<style scoped>
.tool-main-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sheet-frame-flush {
  overflow: hidden;
}

.tool-page-area {
  padding: 0;
}

.sheet-cell-main {
  flex: 1 1 auto;
  min-width: 0;
}

.sheet-title-block {
  display: flex;
  align-items: stretch;
  flex-wrap: wrap;
}

.sheet-cell {
  flex: 0 0 auto;
  min-width: 84px;
}

/* 说明条文 */
.docs {
  border: 1px solid var(--color-base-300);
  background-color: var(--color-base-100);
}

.docs-toggle {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 12px;
  text-align: left;
  color: color-mix(in oklab, var(--color-base-content) 75%, transparent);
}

.docs-toggle:hover {
  background-color: var(--color-base-200);
}

.docs-toggle-mark {
  width: 14px;
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--color-primary);
}

.docs-toggle-label {
  color: var(--color-base-content);
}

.docs-toggle-items {
  display: flex;
  gap: 0.5rem;
  font-family: var(--font-mono);
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
}

.docs-toggle-hint {
  margin-left: auto;
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 45%, transparent);
}

.docs-panel {
  border-top: 1px solid var(--color-base-300);
}

.docs-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--color-base-300);
  background-color: var(--color-base-200);
}

.docs-tab {
  padding: 0.375rem 1rem;
  font-size: 12px;
  color: color-mix(in oklab, var(--color-base-content) 60%, transparent);
  border-bottom: 2px solid transparent;
}

.docs-tab:hover {
  color: var(--color-base-content);
}

.docs-tab-active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  background-color: var(--color-base-100);
}

.docs-content {
  padding: 1.25rem 1.5rem;
}

@media (max-width: 640px) {
  .sheet-title-block {
    font-size: 11px;
  }

  .sheet-cell {
    min-width: 0;
    flex: 1 1 50%;
    border-top: 1px solid var(--color-base-300);
  }
}
</style>
