<template>
  <div class="w-72 flex-shrink-0 border-r border-base-300 flex flex-col bg-base-200/50">
    <!-- Tianditu Key -->
    <div class="p-4 border-b border-base-300">
      <label class="block text-sm font-semibold mb-2">🔑 天地图 Key</label>
      <div class="flex gap-1">
        <input
          :value="tiandituKey"
          type="text"
          class="input input-bordered input-sm flex-1"
          placeholder="输入天地图 Key"
          @input="$emit('update:tiandituKey', ($event.target as HTMLInputElement).value)"
          @change="$emit('keyChange')"
        />
      </div>
      <a
        href="https://console.tianditu.gov.cn/api/key"
        target="_blank"
        class="text-xs text-primary hover:underline mt-1 inline-block"
      >
        申请 Key →
      </a>
    </div>

    <!-- Base Map Selector -->
    <div class="p-4 border-b border-base-300">
      <label class="block text-sm font-semibold mb-2">🗺️ 地图底图</label>
      <select
        class="select select-bordered select-sm w-full"
        :value="currentProviderIndex"
        @change="$emit('providerChange', $event)"
      >
        <option v-for="(p, idx) in tileProviders" :key="idx" :value="idx">
          {{ p.name }}
        </option>
      </select>
      <p class="text-xs text-base-content/50 mt-1">
        {{ tileProviders[currentProviderIndex]?.description }}
      </p>
      <p
        v-if="tileProviders[currentProviderIndex]?.needsKey && !tiandituKey"
        class="text-xs text-warning mt-1"
      >
        ⚠️ 需要输入天地图 Key
      </p>
    </div>

    <!-- KML Upload -->
    <div class="p-4 border-b border-base-300">
      <label class="block text-sm font-semibold mb-2">📂 加载 KML</label>
      <div
        class="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors"
        :class="
          dragActive
            ? 'border-primary bg-primary/10'
            : 'border-base-300 hover:border-primary/50 hover:bg-base-200'
        "
        @dragover.prevent="$emit('dragOver', $event)"
        @dragleave.prevent="$emit('dragLeave')"
        @drop.prevent="$emit('drop', $event)"
        @click="openFilePicker"
      >
        <p class="text-xs text-base-content/50">拖拽 .kml 文件到此处 或点击选择</p>
        <input
          ref="fileInputRef"
          type="file"
          accept=".kml"
          multiple
          class="hidden"
          @change="$emit('fileSelect', $event)"
        />
      </div>
    </div>

    <!-- Layer Tree -->
    <div class="flex-1 overflow-y-auto p-2">
      <div class="flex items-center justify-between mb-2 px-2">
        <span class="text-sm font-semibold">📑 图层树</span>
        <button
          v-if="flatPlacemarks.length > 0"
          class="btn btn-ghost btn-xs"
          @click="$emit('toggleAll')"
        >
          {{ allVisible ? '全部隐藏' : '全部显示' }}
        </button>
      </div>
      <div v-if="flatPlacemarks.length === 0" class="text-xs text-base-content/40 text-center py-4">
        加载 KML 后显示图层树
      </div>
      <KmlTreeNode
        v-for="node in treeNodes"
        :key="node.id"
        :node="node"
        :depth="0"
        @toggle="$emit('toggle', $event)"
        @zoom="$emit('zoom', $event)"
        @remove="$emit('remove', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import KmlTreeNode from './KmlTreeNode.vue'
import type { KmlTreeNodeData } from './types'
import type { TileProvider } from './tileProviders'

defineProps<{
  tiandituKey: string
  currentProviderIndex: number
  dragActive: boolean
  treeNodes: KmlTreeNodeData[]
  flatPlacemarks: KmlTreeNodeData[]
  allVisible: boolean
  tileProviders: TileProvider[]
}>()

defineEmits<{
  'update:tiandituKey': [value: string]
  keyChange: []
  providerChange: [event: Event]
  dragOver: [event: DragEvent]
  dragLeave: []
  drop: [event: DragEvent]
  fileSelect: [event: Event]
  toggleAll: []
  toggle: [node: KmlTreeNodeData]
  zoom: [node: KmlTreeNodeData]
  remove: [node: KmlTreeNodeData]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

function openFilePicker() {
  fileInputRef.value?.click()
}
</script>
