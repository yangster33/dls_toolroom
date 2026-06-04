<template>
  <div class="windows-browser w-full">
    <!-- Windows 风格窗口 -->
    <div class="windows-frame rounded-sm overflow-hidden shadow-2xl border border-base-300">
      <!-- 窗口标题栏 -->
      <div
        class="windows-title-bar flex items-center justify-between px-4 py-2 bg-base-200 border-b border-base-300 select-none"
      >
        <!-- 左侧图标和标题 -->
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded bg-blue-500 flex items-center justify-center">
            <svg
              class="w-4 h-4 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="3"></circle>
              <path
                d="M12 2v6m0 6v6m9-9h-6M5 12H3m0 0l2.5-2.5M19 12l-2.5-2.5M5 12l2.5 2.5M19 12l2.5 2.5"
              ></path>
            </svg>
          </div>
          <span class="text-sm font-medium text-base-content">DLS Toolroom - Browser</span>
        </div>

        <!-- 右侧控制按钮 -->
        <div class="flex items-center gap-1">
          <!-- 最小化按钮 -->
          <button
            class="windows-btn w-8 h-8 flex items-center justify-center hover:bg-base-300 transition-colors"
          >
            <PhMinus />
          </button>
          <!-- 最大化按钮 -->
          <button
            class="windows-btn w-8 h-8 flex items-center justify-center hover:bg-base-300 transition-colors"
          >
            <PhResize />
          </button>
          <!-- 关闭按钮 -->
          <button
            class="windows-btn w-8 h-8 flex items-center justify-center hover:bg-error/20 transition-colors"
          >
            <PhX />
          </button>
        </div>
      </div>

      <!-- 浏览器工具栏 -->
      <div class="toolbar px-4 py-3 bg-base-100 border-b border-base-200">
        <div class="flex items-center gap-2 mb-3">
          <!-- 后退按钮 -->
          <button
            :disabled="!canGoBack"
            class="toolbar-btn w-8 h-8 flex items-center justify-center hover:bg-base-200 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            @click="goBack"
          >
            <PhArrowLeft />
          </button>
          <!-- 前进按钮 -->
          <button
            :disabled="!canGoForward"
            class="toolbar-btn w-8 h-8 flex items-center justify-center hover:bg-base-200 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            @click="goForward"
          >
            <PhArrowRight />
          </button>
          <!-- 刷新按钮 -->
          <button
            class="toolbar-btn w-8 h-8 flex items-center justify-center hover:bg-base-200 rounded transition-colors"
            @click="refresh"
          >
            <PhArrowClockwise />
          </button>
          <!-- 主页按钮 -->
          <button
            class="toolbar-btn w-8 h-8 flex items-center justify-center hover:bg-base-200 rounded transition-colors"
            @click="goHome"
          >
            <PhHouse />
          </button>
          <!-- URL 栏 -->
          <div class="flex-1 relative">
            <svg
              class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              <path d="M15 11l-3 3m0 0l-3-3m3 3V4"></path>
            </svg>
            <input
              type="text"
              class="w-full pl-10 pr-4 py-2 border border-base-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-base-100 text-base-content"
              :value="displayUrl"
              @keyup.enter="navigateTo"
              ref="urlInputRef"
            />
          </div>
        </div>

        <!-- 书签栏 -->
        <!-- <div class="flex items-center gap-1">
          <div
            class="flex items-center gap-1 px-2 py-1 bg-blue-500/10 rounded cursor-pointer"
            @click="navigateToBookmark('/')"
          >
            <div class="w-2 h-2 rounded-full bg-blue-500"></div>
            <span class="text-xs text-gray-600">大龙山工具间</span>
          </div>
          <div
            class="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"
            @click="navigateToBookmark('/tools/coord-convert')"
          >
            <div class="w-2 h-2 rounded-full bg-green-500"></div>
            <span class="text-xs text-gray-600">坐标转换</span>
          </div>
          <div
            class="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"
            @click="navigateToBookmark('/tools/coords-convert')"
          >
            <div class="w-2 h-2 rounded-full bg-yellow-500"></div>
            <span class="text-xs text-gray-600">批量处理</span>
          </div>
          <div
            class="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"
            @click="navigateToBookmark('/tools/distance-sensor')"
          >
            <div class="w-2 h-2 rounded-full bg-red-500"></div>
            <span class="text-xs text-gray-600">距离计算</span>
          </div>
        </div> -->
      </div>

      <!-- 浏览器内容区 -->
      <div class="content-area" :style="{ height: contentHeight }">
        <iframe
          ref="iframeRef"
          :key="iframeKey"
          :src="currentUrl"
          class="w-full h-full border-none"
          sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
          @load="onIframeLoad"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  PhMinus,
  PhResize,
  PhX,
  PhArrowClockwise,
  PhHouse,
  PhArrowLeft,
  PhArrowRight,
} from '@phosphor-icons/vue'

const iframeRef = ref<HTMLIFrameElement | null>(null)
const urlInputRef = ref<HTMLInputElement | null>(null)
const currentUrl = ref('')
const displayUrl = ref('')
const windowHeight = ref(600)
const isLoading = ref(false)
const iframeKey = ref(0)

// 历史记录
const historyStack = ref<string[]>([])
const historyIndex = ref(-1)

const canGoBack = computed(() => historyIndex.value > 0)
const canGoForward = computed(() => historyIndex.value < historyStack.value.length - 1)

const contentHeight = computed(() => {
  return `${windowHeight.value - 140}px`
})

// 添加到历史记录
const addToHistory = (url: string) => {
  // 如果不是在历史记录的末尾，移除后面的记录
  if (historyIndex.value < historyStack.value.length - 1) {
    historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)
  }
  historyStack.value.push(url)
  historyIndex.value = historyStack.value.length - 1
}

// 更新 URL 显示
const updateDisplayUrl = (url: string) => {
  displayUrl.value = url
  currentUrl.value = url
}

// 前进
const goForward = () => {
  if (!canGoForward.value) return
  historyIndex.value++
  const url = historyStack.value[historyIndex.value]!
  updateDisplayUrl(url)
  iframeKey.value++
}

// 后退
const goBack = () => {
  if (!canGoBack.value) return
  historyIndex.value--
  const url2 = historyStack.value[historyIndex.value]!
  updateDisplayUrl(url2)
  iframeKey.value++
}

// 刷新
const refresh = () => {
  isLoading.value = true
  iframeKey.value++
  setTimeout(() => {
    isLoading.value = false
  }, 500)
}

// 导航到 URL
const navigateTo = () => {
  if (!urlInputRef.value) return
  let url = urlInputRef.value.value.trim()

  if (!url) return

  // 处理相对 URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // 如果是路径，添加当前 origin
    if (url.startsWith('/')) {
      url = window.location.origin + url
    } else {
      // 否则认为是相对路径，添加 http:// 前缀
      url = 'https://' + url
    }
  }

  addToHistory(url)
  updateDisplayUrl(url)
  iframeKey.value++
}

// 导航到书签
// const navigateToBookmark = (path: string) => {
//   const url = window.location.origin + path
//   addToHistory(url)
//   updateDisplayUrl(url)
//   iframeKey.value++
// }

// 回到主页
const goHome = () => {
  const url = window.location.origin
  addToHistory(url)
  updateDisplayUrl(url)
  iframeKey.value++
}

// iframe 加载完成
const onIframeLoad = () => {
  isLoading.value = false
  // 尝试更新 URL 显示为 iframe 的实际 URL
  if (iframeRef.value?.contentWindow?.location.href) {
    try {
      const iframeUrl = iframeRef.value.contentWindow.location.href
      displayUrl.value = iframeUrl
      // 如果 URL 变化了，添加到历史记录
      if (iframeUrl !== historyStack.value[historyIndex.value]) {
        addToHistory(iframeUrl)
      }
    } catch (e) {
      // 跨域访问会报错，忽略
    }
  }
}

const updateSize = () => {
  const availableHeight = window.innerHeight - 100
  windowHeight.value = Math.max(500, Math.min(availableHeight, 800))
}

onMounted(() => {
  const initialUrl = typeof window !== 'undefined' ? window.location.href : ''
  addToHistory(initialUrl)
  updateDisplayUrl(initialUrl)
  updateSize()
  window.addEventListener('resize', updateSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateSize)
})
</script>

<style scoped>
.windows-browser {
  min-height: 500px;
}

.windows-frame {
  box-shadow:
    0 1px 1px rgba(0, 0, 0, 0.15),
    0 10px 0 -5px #fff,
    0 10px 1px -4px rgba(0, 0, 0, 0.15),
    0 20px 0 -10px #fff,
    0 20px 1px -9px rgba(0, 0, 0, 0.15);
}

.windows-title-bar {
  user-select: none;
  cursor: default;
}

.windows-btn {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.toolbar-btn {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.content-area {
  background: oklch(var(--b1));
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
