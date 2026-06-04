<template>
  <div class="header-wrapper">
    <div class="rainbow-strip">
      <div class="color-segment color-blue"></div>
      <div class="color-segment color-orange"></div>
      <div class="color-segment color-green"></div>
      <div class="color-segment color-brown"></div>
      <div class="color-segment color-gray"></div>
      <div class="color-segment color-white"></div>
      <div class="color-segment color-red"></div>
      <div class="color-segment color-black"></div>
      <div class="color-segment color-yellow"></div>
      <div class="color-segment color-purple"></div>
      <div class="color-segment color-pink"></div>
      <div class="color-segment color-cyan"></div>
    </div>
    <nav class="navbar w-full bg-base-300">
      <label for="my-drawer-4" aria-label="open sidebar" class="btn btn-square btn-ghost">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          stroke-linejoin="round"
          stroke-linecap="round"
          stroke-width="2"
          fill="none"
          stroke="currentColor"
          class="my-1.5 inline-block size-4"
        >
          <path
            d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"
          ></path>
          <path d="M9 4v16"></path>
          <path d="M14 10l2 2l-2 2"></path>
        </svg>
      </label>

      <!-- Breadcrumbs 区域 -->
      <div class="navbar-start">
        <router-link to="/" class="btn btn-ghost text-xl text-base-content">
          大龙山工具间
        </router-link>
        <div class="breadcrumbs text-sm ml-4">
          <ul>
            <template v-for="(item, index) in breadcrumbItems" :key="index">
              <li v-if="item">
                <router-link
                  v-if="index < breadcrumbItems.length - 1"
                  :to="item.path"
                  class="text-base-content hover:text-primary transition-colors"
                >
                  {{ item.name }}
                </router-link>
                <span v-else class="opacity-70 text-base-content">{{ item.name }}</span>
              </li>
            </template>
          </ul>
        </div>
      </div>

      <!-- 时钟区域 -->
      <div class="navbar-center">
        <div class="text-base text-center font-mono text-base-content">
          {{ currentTime }}
        </div>
      </div>

      <!-- 主题切换器 -->
      <div class="navbar-end">
        <div class="flex items-center gap-2 mr-4">
          <span class="text-sm text-base-content/70">背景</span>
          <label class="cursor-pointer">
            <input
              type="checkbox"
              class="toggle toggle-primary"
              :checked="flowingBackgroundStore.enabled"
              @change="flowingBackgroundStore.toggle()"
            />
          </label>
        </div>
        <ThemeToggle />
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import ThemeToggle from '@/components/theme/ThemeToggle.vue'
import { getToolById } from '@/tools/toolData'
import { useFlowingBackgroundStore } from '@/stores/flowingBackgroundStore'

const flowingBackgroundStore = useFlowingBackgroundStore()

// 当前时间响应式数据
const currentTime = ref<string>('')

// 使用路由获取当前路径
const route = useRoute()

// 从路由路径生成面包屑项
const breadcrumbItems = computed(() => {
  const currentPath = route.path

  // 根路径只显示首页
  if (currentPath === '/') {
    return [routeNameMap['/']!]
  }

  // 处理工具详情页 /tools/:toolId
  const toolMatch = currentPath.match(/^\/tools\/(.+)$/)
  if (toolMatch && toolMatch[1]) {
    const toolBreadcrumb = getToolBreadcrumb(toolMatch[1])
    if (toolBreadcrumb) {
      return [routeNameMap['/']!, routeNameMap['/tools']!, toolBreadcrumb]
    }
  }

  // 其他已知路由：首页 + 当前页
  if (routeNameMap[currentPath]) {
    return [routeNameMap['/']!, routeNameMap[currentPath]!]
  }

  return [routeNameMap['/']!]
})

// 定义定时器变量类型
let timerId: number | null = null

// 更新时间函数
const updateTime = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')

  currentTime.value = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
}

// 路由名称映射
const routeNameMap: Record<string, { name: string; path: string }> = {
  '/': { name: '首页', path: '/' },
  '/tools': { name: '工具集', path: '/tools' },
  '/about': { name: '关于', path: '/about' },
  '/donate': { name: '支持我', path: '/donate' },
}

// 获取工具详情页面包屑
const getToolBreadcrumb = (toolId: string) => {
  const tool = getToolById(toolId)
  if (tool) {
    return {
      name: tool.name,
      path: `/tools/${toolId}`,
    }
  }
  return null
}

// 组件挂载时启动时钟
onMounted(() => {
  updateTime()
  timerId = window.setInterval(updateTime, 1000)
})

// 组件卸载时清除定时器
onUnmounted(() => {
  if (timerId !== null) {
    clearInterval(timerId)
    timerId = null
  }
})
</script>

<style scoped>
.header-wrapper {
  display: flex;
  flex-direction: column;
}

.rainbow-strip {
  display: flex;
  width: 100%;
  height: 3px;
  position: relative;
  overflow: hidden;
}

.color-segment {
  flex: 1;
  position: relative;
  transition: transform 0.3s ease;
}

.color-segment::before {
  content: '';
  position: absolute;
  inset: 0;
  filter: blur(0);
  animation: colorBlend 4s ease-in-out infinite;
}

.color-blue {
  background-color: #3b82f6;
}
.color-blue::before {
  background: linear-gradient(90deg, transparent, #3b82f6, transparent);
  animation-delay: 0s;
}

.color-orange {
  background-color: #f97316;
}
.color-orange::before {
  background: linear-gradient(90deg, transparent, #f97316, transparent);
  animation-delay: 0.33s;
}

.color-green {
  background-color: #22c55e;
}
.color-green::before {
  background: linear-gradient(90deg, transparent, #22c55e, transparent);
  animation-delay: 0.66s;
}

.color-brown {
  background-color: #a16207;
}
.color-brown::before {
  background: linear-gradient(90deg, transparent, #a16207, transparent);
  animation-delay: 0.99s;
}

.color-gray {
  background-color: #6b7280;
}
.color-gray::before {
  background: linear-gradient(90deg, transparent, #6b7280, transparent);
  animation-delay: 1.32s;
}

.color-white {
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
}
.color-white::before {
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
  animation-delay: 1.65s;
}

.color-red {
  background-color: #ff1e1e;
}
.color-red::before {
  background: linear-gradient(90deg, transparent, #ef4444, transparent);
  animation-delay: 1.98s;
}

.color-black {
  background-color: #1f2937;
}
.color-black::before {
  background: linear-gradient(90deg, transparent, #1f2937, transparent);
  animation-delay: 2.31s;
}

.color-yellow {
  background-color: #eab308;
}
.color-yellow::before {
  background: linear-gradient(90deg, transparent, #eab308, transparent);
  animation-delay: 2.64s;
}

.color-purple {
  background-color: #8b5cf6;
}
.color-purple::before {
  background: linear-gradient(90deg, transparent, #8b5cf6, transparent);
  animation-delay: 2.97s;
}

.color-pink {
  background-color: #db7183;
}
.color-pink::before {
  background: linear-gradient(90deg, transparent, #f43f5e, transparent);
  animation-delay: 3.3s;
}

.color-cyan {
  background-color: #06b6d4;
}
.color-cyan::before {
  background: linear-gradient(90deg, transparent, #06b6d4, transparent);
  animation-delay: 3.63s;
}

@keyframes colorBlend {
  0%,
  100% {
    filter: blur(0);
    opacity: 0;
    transform: scaleX(0.5);
  }
  25% {
    filter: blur(4px);
    opacity: 1;
    transform: scaleX(1.2);
  }
  50% {
    filter: blur(8px);
    opacity: 0.8;
    transform: scaleX(1.5);
  }
  75% {
    filter: blur(4px);
    opacity: 1;
    transform: scaleX(1.2);
  }
}

@keyframes segmentShift {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(2px);
  }
}

.color-segment:nth-child(odd) {
  animation: segmentShift 3s ease-in-out infinite;
}

.color-segment:nth-child(even) {
  animation: segmentShift 3s ease-in-out infinite reverse;
}
</style>
