<template>
  <div>
    <div
      class="flex items-center gap-1 py-1 px-1 rounded hover:bg-base-200 transition-colors group text-xs"
      :style="{ paddingLeft: `${depth * 12 + 4}px` }"
    >
      <!-- Expand/Collapse Arrow -->
      <button
        v-if="node.children.length > 0"
        class="btn btn-ghost btn-xs btn-square w-4 h-4 min-h-0"
        @click="expanded = !expanded"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="10"
          height="10"
          viewBox="0 0 256 256"
          fill="currentColor"
          :class="{ 'rotate-90': expanded }"
          class="transition-transform"
        >
          <path d="M96,208a8,8,0,0,1-5.66-13.66L160.69,128,90.34,57.66A8,8,0,0,1,101.66,46.34l76,72a8,8,0,0,1,0,11.32l-76,72A8,8,0,0,1,96,208Z"/>
        </svg>
      </button>
      <div v-else class="w-4"></div>

      <!-- Type Icon -->
      <span v-if="node.type === 'placemark'" class="w-4 text-center flex-shrink-0">
        <span v-if="node.geometryType === 'Point'">📍</span>
        <span v-else-if="node.geometryType === 'LineString' || node.geometryType === 'Track'">📏</span>
        <span v-else-if="node.geometryType === 'Polygon'">⬡</span>
        <span v-else>📌</span>
      </span>
      <span v-else-if="node.type === 'folder'" class="w-4 text-center flex-shrink-0">📁</span>
      <span v-else class="w-4 text-center flex-shrink-0">📄</span>

      <!-- Color dot -->
      <span
        v-if="node.color"
        class="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-base-300"
        :style="{ backgroundColor: node.color }"
      ></span>

      <!-- Name -->
      <span
        class="flex-1 truncate"
        :class="node.type === 'placemark' && !node.visible ? 'text-base-content/30' : ''"
        :title="node.name"
      >{{ node.name }}</span>

      <!-- Visibility Toggle -->
      <button
        class="btn btn-ghost btn-xs btn-square w-5 h-5 min-h-0 flex-shrink-0"
        :class="node.visible ? 'text-primary' : 'text-base-content/25'"
        @click="$emit('toggle', node)"
        :title="node.visible ? '隐藏' : '显示'"
      >
        <svg v-if="node.visible" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
          <path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61,163.24,48,128,48S61.43,61,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,195,92.76,208,128,208s66.57-13,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,138.46,192.14,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z"/>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
          <path d="M228,175.09l-44.64-42.19a48.11,48.11,0,0,0-60.26-60.26L100.87,52.21a8,8,0,0,0-9.78,12.66l120,104A8,8,0,0,0,224,164a8.39,8.39,0,0,0,3.91-.88A8,8,0,0,0,228,175.09ZM68.77,60.13a8,8,0,0,0-12.09.74C47.85,69.89,37.69,79.8,30.07,88.83a133.47,133.47,0,0,0-5.1,6.67C11.59,116.68,8.05,125.23,8.69,125.64a8.41,8.41,0,0,0,0,6.72c.35.79,8.82,19.57,27.65,38.4C61.43,195,92.76,208,128,208a125.49,125.49,0,0,0,50.64-11.28A8,8,0,0,0,168,182.83a110.16,110.16,0,0,1-40,9.17c-30.78,0-57.67-11.19-79.93-33.25A133.42,133.42,0,0,1,25,128c4.56-6.21,15.71-18.13,30.71-28.25A8,8,0,0,0,68.77,60.13Z"/>
        </svg>
      </button>

      <!-- Zoom -->
      <button
        v-if="node.type === 'placemark'"
        class="btn btn-ghost btn-xs btn-square w-5 h-5 min-h-0 text-base-content/30 hover:text-primary flex-shrink-0"
        @click="$emit('zoom', node)"
        title="缩放到此要素"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
          <path d="M152,112a8,8,0,0,1,8-8h32a8,8,0,0,1,0,16H168v24a8,8,0,0,1-16,0Zm-48,40H72V128a8,8,0,0,0-16,0v32a8,8,0,0,0,8,8h40a8,8,0,0,0,0-16Z"/>
        </svg>
      </button>

      <!-- Delete -->
      <button
        class="btn btn-ghost btn-xs btn-square w-5 h-5 min-h-0 text-base-content/30 hover:text-error opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
        @click="$emit('remove', node)"
        title="删除"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 256 256" fill="currentColor">
          <path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Z"/>
        </svg>
      </button>
    </div>

    <!-- Children -->
    <template v-if="expanded && node.children.length > 0">
      <KmlTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        @toggle="$emit('toggle', child)"
        @zoom="$emit('zoom', child)"
        @remove="$emit('remove', child)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { KmlTreeNodeData } from './types'

const props = defineProps<{
  node: KmlTreeNodeData
  depth: number
}>()

defineEmits<{
  toggle: [node: KmlTreeNodeData]
  zoom: [node: KmlTreeNodeData]
  remove: [node: KmlTreeNodeData]
}>()

const expanded = ref(true)
</script>
