<!-- src/tools/coord_convert/CoordConvertPage.vue -->
<template>
  <div class="bg-base-100/70 backdrop-blur-sm rounded-lg shadow-lg p-4">
    <h1 class="text-3xl font-bold mb-1">{{ toolConfig?.name || '坐标转换' }}</h1>
    <p class="text-base-content/70">
      {{ toolConfig?.description || '在此添加和管理需要转换的坐标点。' }}
    </p>

    <div class="mt-4">
      <h2 class="text-xl font-semibold mb-4">坐标列表</h2>
      <!-- 引入坐标输入组件 -->
      <CoordinateInput />
    </div>
  </div>
</template>

<script setup lang="ts">
import CoordinateInput from './CoordinateInput.vue'
import { getToolById } from '../toolData'

const toolConfig = getToolById('coord_convert')
</script>
