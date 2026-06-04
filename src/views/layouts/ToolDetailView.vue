<template>
  <div class="tool-detail-view h-full">
    <div v-if="tool" class="tool-content">
      <DlsMainLayout :nav-items="navItems" v-if="toolComponent" />
      <div v-else class="flex items-center justify-center h-full">
        <div class="text-center">
          <h2 class="text-2xl font-bold mb-4">工具组件加载失败</h2>
          <p class="text-gray-500 mb-4">工具 {{ tool.name }} 的组件未找到</p>
          <button @click="goBack" class="btn btn-primary">返回工具列表</button>
        </div>
      </div>
    </div>
    <div v-else class="flex items-center justify-center h-full">
      <div class="text-center">
        <h2 class="text-2xl font-bold mb-4">工具未找到</h2>
        <p class="text-gray-500 mb-4">找不到 ID 为 {{ toolId }} 的工具</p>
        <button @click="goBack" class="btn btn-primary">返回工具列表</button>
      </div>
    </div>
    <ErrorDialog
      :is-open="showToast"
      type="error"
      title="加载失败"
      :message="toastMessage"
      @close="showToast = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, defineAsyncComponent, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getToolById } from '@/tools/toolData'
import DlsMainLayout from '@/components/layout/DlsMainLayout.vue'
import { createToolNavItems } from '@/tools/createToolNavItems'
import ErrorDialog from '@/components/common/ErrorDialog.vue'
import { logger } from '@/utils/logger'

const route = useRoute()
const router = useRouter()
const toolId = computed(() => route.params.toolId as string)

const showToast = ref(false)
const toastMessage = ref('')

const showErrorToast = (message: string) => {
  toastMessage.value = message
  showToast.value = true
  setTimeout(() => {
    showToast.value = false
  }, 3000)
}

const goBack = () => {
  router.push('/tools')
}

const pagesGlob = import.meta.glob('@/tools/*/*Page.vue')

const componentMap: Record<string, ReturnType<typeof defineAsyncComponent>> = {}
for (const [path, loader] of Object.entries(pagesGlob)) {
  const match = path.match(/\/tools\/([^/]+)\/([^/]+)Page\.vue$/)
  if (match && match[1]) {
    componentMap[match[1]] = defineAsyncComponent(loader as () => Promise<{ default: Component }>)
  }
}

const tool = computed(() => {
  return getToolById(toolId.value)
})

const toolComponent = computed(() => {
  const component = componentMap[toolId.value]
  if (!component && tool.value) {
    logger.error(`工具组件未找到: ${toolId.value}`)
    showErrorToast(`工具 ${tool.value.name} 的组件加载失败`)
  }
  return component || null
})

const navItems = computed(() => {
  if (!toolComponent.value || !toolId.value) return []
  return createToolNavItems(toolComponent.value, toolId.value)
})
</script>

<style scoped>
.tool-detail-view {
  overflow-y: auto;
}

.tool-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}
</style>
