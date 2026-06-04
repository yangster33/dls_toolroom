<template>
  <div>
    <div v-if="content" class="prose" v-html="content"></div>
    <div v-else class="text-center py-8">
      <span class="loading loading-spinner loading-md"></span>
    </div>
    <!-- 施工中提示 -->
    <div v-if="isUnderConstruction" class="alert alert-info mt-6">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        class="stroke-current shrink-0 w-6 h-6"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        ></path>
      </svg>
      <span>文档施工中，敬请期待！</span>
    </div>
    <div ref="tracker" style="display: none"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { logger } from '@/utils/logger'

// 定义 props：fileName 必须，basePath 可选（用于指定 public 下的基础路径）
const props = defineProps<{
  fileName: string
  basePath?: string
}>()

const content = ref('')
const isUnderConstruction = ref(false)
const md = new MarkdownIt()

// 访问信息收集（空函数）
const collectAccessInfo = (): void => {
  // 预留实现
}

// 动态构建完整的文件路径
const filePath = computed(() => {
  // 清理路径，移除开头的斜杠
  const cleanBasePath = props.basePath ? `/${props.basePath.replace(/^\/|\/$/g, '')}` : ''
  const cleanFileName = props.fileName.replace(/^\//, '')
  // 组合成完整的 public 目录下路径
  return `${cleanBasePath}/${cleanFileName}`
})

// 检查响应内容是否为 HTML 文档（Vue 默认页面）
const isHtmlDocument = (text: string): boolean => {
  // 检查是否包含 HTML 文档的典型特征
  return (
    text.includes('<!DOCTYPE html>') ||
    text.includes('<html') ||
    text.includes('<head>') ||
    text.includes('<body>')
  )
}

const loadMarkdown = async (): Promise<void> => {
  try {
    const response = await fetch(filePath.value)
    const responseText = await response.text()
    // console.log(filePath.value)

    // 即使状态码是 200，也要检查内容是否是 HTML 文档
    if (!response.ok || response.status !== 200 || isHtmlDocument(responseText)) {
      // 文件不存在时，标记为施工中
      isUnderConstruction.value = true
      throw new Error(`文件加载失败: ${response.status} ${response.statusText}`)
    }

    // 额外检查：如果响应内容是空或非常短的，可能是错误的响应
    if (!responseText || responseText.trim().length < 10) {
      isUnderConstruction.value = true
      throw new Error('文件内容为空或过短')
    }

    const renderedContent = md.render(responseText)
    content.value = DOMPurify.sanitize(renderedContent)
    collectAccessInfo()
  } catch (error) {
    logger.error('加载Markdown文件失败:', error)
    // 发生错误时，如果还未标记为施工中，则设置施工中状态
    if (!isUnderConstruction.value) {
      isUnderConstruction.value = true
    }
  }
}

onMounted(() => {
  loadMarkdown()
})
</script>
