<template>
  <div class="min-h-screen bg-base-100 flex items-center justify-center">
    <div class="text-center">
      <div class="text-9xl font-bold text-primary mb-4">404</div>
      <h1 class="text-3xl font-semibold text-base-content mb-4">页面未找到</h1>
      <p class="text-base-content/60 mb-8">抱歉，您访问的页面不存在或已被移除</p>
      <div class="flex gap-4 justify-center">
        <button class="btn btn-primary" @click="goHome">
          <PhHouse class="w-5 h-5 mr-2" />
          返回首页
        </button>
        <button class="btn btn-outline" @click="goBack">
          <PhArrowLeft class="w-5 h-5 mr-2" />
          返回上页
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { PhHouse, PhArrowLeft } from '@phosphor-icons/vue'
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: '页面未找到',
  description: '抱歉，您访问的页面不存在或已被移除。返回大龙山工具间首页浏览更多在线工具。',
  keywords: ['404', '页面未找到', '大龙山工具间'],
})

const router = useRouter()

const goHome = () => {
  router.push('/')
}

const goBack = () => {
  router.back()
}
</script>