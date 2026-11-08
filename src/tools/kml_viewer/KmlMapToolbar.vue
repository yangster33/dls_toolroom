<template>
  <!-- Toolbar -->
  <div class="absolute top-2 right-2 z-[1000] flex flex-col gap-1">
    <!-- Web Fullscreen -->
    <button
      class="btn btn-sm btn-circle btn-ghost bg-base-100 shadow"
      :title="isWebFullscreen ? '退出网页全屏' : '网页全屏'"
      @click="$emit('toggleWebFullscreen')"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 256 256"
        fill="currentColor"
      >
        <path
          v-if="isWebFullscreen"
          d="M96,160H56a8,8,0,0,1-8-8V112a8,8,0,0,1,16,0v24h32a8,8,0,0,1,0,16Zm64-64h40V56a8,8,0,0,1,16,0v40a8,8,0,0,1-8,8H160a8,8,0,0,1,0-16Zm-64-32H56a8,8,0,0,1,0-16H96a8,8,0,0,1,0,16Zm104,56a8,8,0,0,1-8,8H56a8,8,0,0,1,0-16H192A8,8,0,0,1,200,120Z"
        />
        <path
          v-else
          d="M40,80V56A16,16,0,0,1,56,40H80a8,8,0,0,1,0,16H56V80a8,8,0,0,1-16,0Zm136-24h24V80a8,8,0,0,0,16,0V56a16,16,0,0,0-16-16H176a8,8,0,0,0,0,16ZM80,200H56V176a8,8,0,0,0-16,0v24a16,16,0,0,0,16,16H80a8,8,0,0,0,0-16Zm120-24v24H176a8,8,0,0,0,0,16h24a16,16,0,0,0,16-16V176a8,8,0,0,0-16,0Z"
        />
      </svg>
    </button>
    <!-- Map Fullscreen -->
    <button
      class="btn btn-sm btn-circle btn-ghost bg-base-100 shadow"
      :title="isMapFullscreen ? '退出全屏地图' : '全屏地图'"
      @click="$emit('toggleMapFullscreen')"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 256 256"
        fill="currentColor"
      >
        <path
          v-if="isMapFullscreen"
          d="M160,48v40a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h28.69L112,51.31A8,8,0,0,1,123.31,40L152,68.69V48a8,8,0,0,1,16,0ZM88,200H59.31L88,171.31A8,8,0,0,0,76.69,160L48,188.69V168a8,8,0,0,0-16,0v40a8,8,0,0,0,8,8H88a8,8,0,0,0,0-16Z"
        />
        <path
          v-else
          d="M88,48H48V88a8,8,0,0,0,16,0V59.31L92.69,88A8,8,0,0,0,104,76.69L75.31,48H88a8,8,0,0,0,0-16Zm80,160H208V168a8,8,0,0,0-16,0v28.69L163.31,168A8,8,0,0,0,152,179.31L180.69,208H168a8,8,0,0,0,0,16h40a8,8,0,0,0,8-8V168a8,8,0,0,0-16,0Z"
        />
      </svg>
    </button>
    <!-- Fit all layers -->
    <button
      v-if="hasPlacemarks"
      class="btn btn-sm btn-circle btn-ghost bg-base-100 shadow"
      title="缩放到全部图层"
      @click="$emit('fitAll')"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 256 256"
        fill="currentColor"
      >
        <path
          d="M152,112a8,8,0,0,1,8-8h32a8,8,0,0,1,0,16H168v24a8,8,0,0,1-16,0Zm-48,40H72V128a8,8,0,0,0-16,0v32a8,8,0,0,0,8,8h40a8,8,0,0,0,0-16Zm80-88H152a8,8,0,0,0,0,16h24v24a8,8,0,0,0,16,0V72A8,8,0,0,0,184,64ZM72,152a8,8,0,0,0-8,8v24a8,8,0,0,0,8,8h32a8,8,0,0,0,0-16H80V160A8,8,0,0,0,72,152Z"
        />
      </svg>
    </button>
  </div>

  <!-- Measure / Picker Toolbar -->
  <div class="absolute bottom-2 left-2 z-[1000] flex gap-1 flex-wrap">
    <button
      class="btn btn-xs shadow"
      :class="measureMode === 'length' ? 'btn-primary' : 'btn-ghost bg-base-100'"
      title="测量长度（单击加点，双击结束）"
      @click="$emit('toggleMeasure', 'length')"
    >
      📏 测距
    </button>
    <button
      class="btn btn-xs shadow"
      :class="measureMode === 'area' ? 'btn-primary' : 'btn-ghost bg-base-100'"
      title="测量面积（单击加点，双击闭合）"
      @click="$emit('toggleMeasure', 'area')"
    >
      📐 测面积
    </button>
    <button
      class="btn btn-xs shadow"
      :class="measureMode === 'angle' ? 'btn-primary' : 'btn-ghost bg-base-100'"
      title="测量角度（依次点三个点）"
      @click="$emit('toggleMeasure', 'angle')"
    >
      📏↗ 测角
    </button>
    <button
      class="btn btn-xs shadow"
      :class="pickerActive ? 'btn-secondary' : 'btn-ghost bg-base-100'"
      title="经纬度采集（点击地图采集 WGS84 坐标）"
      @click="$emit('togglePicker')"
    >
      📍 采点
    </button>
  </div>

  <!-- Measure Result -->
  <div
    v-if="measureResult"
    class="absolute top-2 left-2 z-[1000] bg-base-100 shadow-lg rounded-lg px-3 py-2 text-sm font-mono"
  >
    {{ measureResult }}
    <button class="btn btn-ghost btn-xs ml-1 text-error" @click="$emit('clearMeasure')">✕</button>
  </div>

  <!-- Coordinate List -->
  <div
    v-if="pickedCoords.length > 0"
    class="absolute bottom-10 left-2 z-[1000] bg-base-100 shadow-lg rounded-lg p-3 max-h-48 overflow-y-auto text-xs"
    style="min-width: 280px"
  >
    <div class="flex items-center justify-between mb-1">
      <span class="font-semibold">采集坐标 (WGS84)</span>
      <button class="btn btn-ghost btn-xs text-error" @click="$emit('clearPicked')">清空</button>
    </div>
    <div
      v-for="(coord, idx) in pickedCoords"
      :key="idx"
      class="flex items-center gap-1 py-0.5 hover:bg-base-200 rounded px-1"
    >
      <span class="text-base-content/50 w-5">{{ idx + 1 }}</span>
      <span class="flex-1 font-mono">{{ coord.lat.toFixed(6) }}, {{ coord.lng.toFixed(6) }}</span>
      <button class="btn btn-ghost btn-xs text-primary" @click="$emit('copyCoord', coord)">
        复制
      </button>
    </div>
    <button class="btn btn-xs btn-ghost mt-1 w-full" @click="$emit('copyAll')">复制全部</button>
  </div>

  <!-- Angle measurement hint -->
  <div
    v-if="measureMode === 'angle' && anglePoints.length > 0"
    class="absolute top-12 left-2 z-[1000] bg-base-100 shadow rounded px-2 py-1 text-xs"
  >
    已选 {{ anglePoints.length }}/3 个点
  </div>
</template>

<script setup lang="ts">
import type { MeasureMode, PickedCoord } from './types'

defineProps<{
  isWebFullscreen: boolean
  isMapFullscreen: boolean
  hasPlacemarks: boolean
  measureMode: MeasureMode
  pickerActive: boolean
  measureResult: string
  pickedCoords: PickedCoord[]
  anglePoints: Array<{ lat: number; lng: number }>
}>()

defineEmits<{
  toggleWebFullscreen: []
  toggleMapFullscreen: []
  fitAll: []
  toggleMeasure: [mode: 'length' | 'area' | 'angle']
  togglePicker: []
  clearMeasure: []
  clearPicked: []
  copyCoord: [coord: PickedCoord]
  copyAll: []
}>()
</script>
