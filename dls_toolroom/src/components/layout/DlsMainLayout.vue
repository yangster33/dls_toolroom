<!-- src/components/layout/DlsMainLayout.vue -->
<template>
  <div class="tabs tabs-lift">
    <template v-for="(item, index) in effectiveNavItems" :key="item.name">
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
</template>

<script setup lang="ts">
import { ref, computed, type Component } from 'vue'

interface NavItem {
  name: string
  icon: string | Component
  component: Component | null
  props: Record<string, unknown>
}

const props = defineProps<{
  navItems: NavItem[]
}>()

const effectiveNavItems = computed(() => props.navItems)
const defaultIndex = computed(() => {
  const idx = 3
  return effectiveNavItems.value.length > idx ? idx : 0
})
const activeIndex = ref(defaultIndex.value)
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