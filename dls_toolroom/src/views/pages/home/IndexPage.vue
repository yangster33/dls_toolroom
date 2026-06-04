<template>
  <div class="min-h-screen">
    <div class="container mx-auto px-4 py-12 relative z-10">
      <div class="text-center mb-12">
        <div
          class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6 animate-fade-in"
        >
          <PhToolbox class="w-10 h-10 text-primary" />
        </div>
        <h1 class="text-4xl font-bold text-base-content mb-4">大龙山工具间</h1>
        <p class="text-lg text-base-content/70 max-w-md mx-auto">
          一站式地理空间数据处理与转换工具集，助力您的工作效率提升
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
        <div
          v-for="(tool, i) in featuredTools"
          :key="tool.id"
          class="card-group group cursor-pointer"
          :style="staggerStyle(i)"
          @click="navigateToTool(tool.id)"
        >
          <div
            class="card card-hover bg-base-100/80 backdrop-blur-sm border border-base-200/50 h-full"
          >
            <div class="card-body text-center flex flex-col justify-center h-full">
              <div class="icon-wrapper mb-4">
                <component
                  :is="tool.icon"
                  class="w-12 h-12 mx-auto text-primary transition-transform duration-300 group-hover:scale-110"
                />
              </div>
              <h3 class="card-title font-semibold">{{ tool.name }}</h3>
              <p class="text-sm text-base-content/60 mt-2 flex-grow">{{ tool.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="text-center mt-12">
        <button class="btn btn-primary btn-lg group" @click="navigateToTools">
          <PhArrowRight class="w-5 h-5 mr-2 transition-transform duration-300 group-hover:translate-x-1" />
          浏览全部工具
        </button>
      </div>

      <div class="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
        <div class="text-center">
          <div class="text-3xl font-bold text-primary mb-2">{{ countTool }}</div>
          <div class="text-base-content/60">工具数量</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-primary mb-2">{{ countTag }}</div>
          <div class="text-base-content/60">标签数量</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-primary mb-2">{{ countCategory }}</div>
          <div class="text-base-content/60">工具分类</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PhToolbox, PhArrowRight } from '@phosphor-icons/vue'
import { toolConfigs } from '@/tools/toolData'
import { useRouter } from 'vue-router'
import { useCountUp } from '@/composables/useCountUp'

const router = useRouter()

const toolCount = toolConfigs.length

const allTags = new Set(toolConfigs.flatMap((tool) => tool.tags))
const tagCount = allTags.size

const toolCategories = [
  { name: '坐标转换', tags: ['坐标', '转换'] },
  { name: 'GIS处理', tags: ['GIS', 'SHP', 'KML'] },
  { name: '文档处理', tags: ['模板', '导出', 'Excel', 'Word'] },
  { name: '空间分析', tags: ['空间分析', '距离', '测算'] },
  { name: '可视化', tags: ['地图', '查看', '甘特图'] },
]

const categoryCount = toolCategories.length

const countTool = useCountUp(toolCount, 1000)
const countTag = useCountUp(tagCount, 1200)
const countCategory = useCountUp(categoryCount, 800)

const staggerStyle = (i: number) => ({
  animation: 'slide-up 0.4s ease-out both',
  animationDelay: `${i * 80}ms`,
})

const featuredTools = [...toolConfigs].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 4)

const navigateToTool = (toolId: string) => {
  router.push(`/tools/${toolId}`)
}

const navigateToTools = () => {
  router.push('/tools')
}
</script>

<style scoped>
.card-group {
  perspective: 1000px;
}

.card-hover {
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}

.card-group:hover .card-hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.icon-wrapper {
  overflow: visible;
}
</style>
