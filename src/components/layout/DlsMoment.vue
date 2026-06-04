<template>
  <div class="flex h-full gap-4">
    <div class="flex-1">
      <DlsChart :tool-id="currentPageKey" />
    </div>
    <div class="flex-1 overflow-y-auto max-h-[600px]">
      <DlsComment :page-key="currentPageKey" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DlsChart from './DlsChart.vue'
import DlsComment from './DlsComment.vue'

const route = useRoute()

const currentPageKey = computed(() => {
  const toolId = route.params.toolId as string
  return toolId || 'moment'
})
</script>

<style scoped>
.divider-horizontal {
  width: 1px;
  min-height: 100%;
}
</style>
