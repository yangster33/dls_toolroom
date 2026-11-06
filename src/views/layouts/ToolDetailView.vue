<template>
  <div class="tool-detail-view h-full">
    <div v-if="tool" class="tool-content">
      <DlsMainLayout
        v-if="toolComponent"
        :nav-items="toolNav.navItems"
        :tool-page="toolNav.toolPage"
        :tool-page-props="toolNav.toolPageProps"
        :title="tool.name"
        :tool-id="toolId"
        :flush="toolId === 'kml_viewer'"
      />
      <div v-else class="empty-state">
        <h2 class="empty-state-title">工具组件加载失败</h2>
        <p class="empty-state-text">工具 {{ tool.name }} 的组件未找到</p>
        <button class="btn btn-primary" @click="goBack">返回工具索引</button>
      </div>
    </div>
    <div v-else class="empty-state">
      <h2 class="empty-state-title">工具未找到</h2>
      <p class="empty-state-text">找不到 ID 为 {{ toolId }} 的工具</p>
      <button class="btn btn-primary" @click="goBack">返回工具索引</button>
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
import ToolSkeleton from '@/components/common/ToolSkeleton.vue'
import { logger } from '@/utils/logger'
import { SITE_NAME, SITE_URL } from '@/composables/useSeo'
import { useHead } from '@unhead/vue'

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
    componentMap[match[1]] = defineAsyncComponent({
      loader: loader as () => Promise<{ default: Component }>,
      loadingComponent: ToolSkeleton,
      delay: 10,
    })
  }
}

const tool = computed(() => {
  return getToolById(toolId.value)
})

useHead({
  title: computed(() =>
    tool.value ? `${tool.value.name} | ${SITE_NAME}` : `工具未找到 | ${SITE_NAME}`,
  ),
  meta: [
    {
      name: 'description',
      content: computed(() =>
        tool.value
          ? `${tool.value.description} — ${tool.value.tags.join('、')}相关在线工具，免安装、浏览器直接使用。`
          : '工具未找到',
      ),
    },
    {
      name: 'keywords',
      content: computed(() =>
        tool.value ? [...tool.value.tags, tool.value.name, '在线工具', '地理空间'].join(',') : '',
      ),
    },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:title', content: computed(() => (tool.value ? tool.value.name : SITE_NAME)) },
    {
      property: 'og:description',
      content: computed(() => (tool.value ? tool.value.description : '')),
    },
    { property: 'og:url', content: computed(() => `${SITE_URL}/tools/${toolId.value}`) },
    { property: 'og:image', content: `${SITE_URL}/brand/og-cover.png` },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: computed(() => (tool.value ? tool.value.name : SITE_NAME)) },
    {
      name: 'twitter:description',
      content: computed(() => (tool.value ? tool.value.description : '')),
    },
    { name: 'twitter:url', content: computed(() => `${SITE_URL}/tools/${toolId.value}`) },
    { name: 'twitter:image', content: `${SITE_URL}/brand/og-cover.png` },
  ],
  link: [{ rel: 'canonical', href: computed(() => `${SITE_URL}/tools/${toolId.value}`) }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: tool.value?.name,
          description: tool.value?.description,
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          keywords: tool.value?.tags.join(', '),
          url: `${SITE_URL}/tools/${toolId.value}`,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
          publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
        }),
      ),
    },
  ],
})

const toolComponent = computed(() => {
  const component = componentMap[toolId.value]
  if (!component && tool.value) {
    logger.error(`工具组件未找到: ${toolId.value}`)
    showErrorToast(`工具 ${tool.value.name} 的组件加载失败`)
  }
  return component || null
})

const toolNav = computed(() => {
  if (!toolComponent.value || !toolId.value) {
    return { navItems: [], toolPage: null, toolPageProps: {} }
  }
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 40vh;
  text-align: center;
}

.empty-state-title {
  font-family: var(--font-drawing);
  font-size: 1.5rem;
}

.empty-state-text {
  font-size: 13px;
  color: var(--text-muted);
}
</style>
