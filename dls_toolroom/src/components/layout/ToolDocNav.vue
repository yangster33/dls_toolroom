<template>
  <div class="tool-doc-nav bg-base-100 rounded-lg shadow-lg p-6">
    <div class="tabs tabs-boxed mb-4">
      <a
        v-for="doc in docs"
        :key="doc.key"
        :class="['tab', { 'tab-active': currentDoc === doc.key }]"
        @click="currentDoc = doc.key"
      >
        {{ doc.label }}
      </a>
    </div>
    <div class="doc-content mt-4">
      <DlsMdPage
        v-if="currentDocPath"
        :fileName="currentDocInfo?.fileName || ''"
        :basePath="basePath"
      />
      <div v-else class="text-center text-gray-500 py-8">
        暂无文档
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import DlsMdPage from './DlsMdPage.vue'
import { docTypes, getToolDocTypes, getDocType } from '@/tools/toolData'

const props = defineProps<{
  toolId: string
  basePath: string
}>()

const currentDoc = ref<string>('')

const docs = computed(() => {
  const toolDocTypes = getToolDocTypes(props.toolId)
  return toolDocTypes.length > 0 ? toolDocTypes : docTypes
})

const currentDocInfo = computed(() => {
  return getDocType(currentDoc.value)
})

const currentDocPath = computed(() => {
  return currentDocInfo.value ? `${props.basePath}/${currentDocInfo.value.fileName}` : ''
})

watch(
  () => props.toolId,
  () => {
    const firstDoc = docs.value[0]
    if (firstDoc && !currentDoc.value) {
      currentDoc.value = firstDoc.key
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.tool-doc-nav {
  margin: 1.5rem;
}

.doc-content {
  min-height: 200px;
}
</style>
