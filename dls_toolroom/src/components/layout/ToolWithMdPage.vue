<template>
  <div>
    <!-- 工具页面 -->
    <component :is="toolPage" v-bind="toolPageProps" />

    <!-- 使用注意警告 -->
    <div class="bg-base-100 rounded-lg shadow-lg p-6 mx-6 mb-6">
      <div role="alert" class="alert alert-info">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span class="font-semibold">使用注意</span>
      </div>
      <div class="mt-4">
        <DlsMdPage :fileName="'tool.md'" :basePath="`docs/${toolName}`" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type Component, computed } from 'vue'
import DlsMdPage from './DlsMdPage.vue'

const props = defineProps<{
  toolPage: Component
  toolPageProps?: Record<string, unknown>
  toolName: string
}>()

const toolPageProps = computed(() => props.toolPageProps || {})
</script>
