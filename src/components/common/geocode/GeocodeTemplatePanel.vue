<template>
  <div>
    <h2 class="text-xl font-semibold mb-4">1. 下载模板</h2>
    <p class="text-base-content/70 mb-3 text-sm">
      {{
        mode === 'add'
          ? '模板包含三列：名称、经度、纬度'
          : '模板包含：省、市、区/县、乡/镇、社区/村、地址（地址必填，其他可选）'
      }}
    </p>
    <div class="dropdown">
      <label tabindex="0" class="btn btn-outline btn-primary">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        下载模板
      </label>
      <ul
        tabindex="0"
        class="dropdown-content menu bg-base-100 rounded-box shadow-lg p-2 w-48 z-10"
      >
        <li>
          <a @click="$emit('download', 'csv')" class="text-sm">CSV 格式</a>
        </li>
        <li>
          <a @click="$emit('download', 'xlsx')" class="text-sm">Excel 格式</a>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GeocodeMode } from './geocodeTypes'

defineProps<{
  mode: GeocodeMode
}>()

defineEmits<{
  download: [format: 'csv' | 'xlsx']
}>()
</script>
