<!-- src/components/layout/DlsMainLayout.vue -->
<template>
  <div class="tool-main-layout">
    <!-- 器：真正的工具页面常驻上方，不随下方 tab 切换 -->
    <div v-if="toolPage" class="tool-page-area mb-4">
      <component :is="toolPage" v-bind="toolPageProps" />
    </div>

    <!-- 道法术器势：仅切换下方说明文本；与上方工具卡片同宽 -->
    <div class="tabs tabs-lift w-full">
      <template v-for="(item, index) in navItems" :key="item.name">
        <input
          type="radio"
          name="my_tabs_4"
          :checked="activeIndex === index"
          class="tab"
          :aria-label="item.name"
          @change="activeIndex = index"
        />
        <div class="tab-content bg-base-100 border-base-300 p-6">
          <div
            class="tab-pane"
            :key="activeIndex === index ? `active-${item.name}` : `hidden-${item.name}`"
          >
            <component v-if="item.component" :is="item.component" v-bind="item.props" />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, type Component } from 'vue'

interface NavItem {
  name: string
  icon: string | Component
  component: Component | null
  props: Record<string, unknown>
}

defineProps<{
  navItems: NavItem[]
  toolPage?: Component | null
  toolPageProps?: Record<string, unknown>
}>()

const activeIndex = ref(0)
</script>

<style scoped>
.tab-pane {
  animation: tab-in 0.2s ease both;
}

@keyframes tab-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
