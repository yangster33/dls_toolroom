<template>
  <div
    class="bg-base-100/70 backdrop-blur-sm rounded-lg shadow-lg p-4"
    :class="{ '!p-0': isMapFullscreen }"
  >
    <ErrorDialog
      :is-open="errorDialogOpen"
      type="error"
      title="加载失败"
      :message="loadError"
      @close="closeErrorDialog"
    />
    <template v-if="!isMapFullscreen">
      <h1 class="text-3xl font-bold mb-1">{{ toolConfig?.name || 'KML查看器' }}</h1>
      <p class="text-base-content/70">{{ toolConfig?.description || '' }}</p>
    </template>

    <div
      class="bg-base-100 rounded-lg overflow-hidden"
      :class="isMapFullscreen ? '!rounded-none fixed inset-0 z-50 m-0' : ''"
      :style="
        isMapFullscreen
          ? {}
          : { height: `calc(100vh - ${isWebFullscreen ? '40px' : '220px'})`, minHeight: '500px' }
      "
    >
      <div class="flex h-full">
        <KmlSidebar
          v-if="!isMapFullscreen"
          v-model:tianditu-key="tiandituKey"
          :current-provider-index="currentProviderIndex"
          :drag-active="dragActive"
          :tree-nodes="treeNodes"
          :flat-placemarks="flatPlacemarks"
          :all-visible="allVisible"
          :tile-providers="tileProviders"
          @key-change="onTiandituKeyChange"
          @provider-change="onProviderChange"
          @drag-over="onDragOver"
          @drag-leave="onDragLeave"
          @drop="onDrop"
          @file-select="onFileSelect"
          @toggle-all="toggleAllPlacemarks"
          @toggle="onNodeToggle"
          @zoom="onNodeZoom"
          @remove="onNodeRemove"
        />

        <div class="flex-1 relative">
          <div ref="mapContainerRef" class="w-full h-full"></div>

          <KmlMapToolbar
            :is-web-fullscreen="isWebFullscreen"
            :is-map-fullscreen="isMapFullscreen"
            :has-placemarks="flatPlacemarks.length > 0"
            :measure-mode="measureMode"
            :picker-active="pickerActive"
            :measure-result="measureResult"
            :picked-coords="pickedCoords"
            :angle-points="anglePoints"
            @toggle-web-fullscreen="toggleWebFullscreen"
            @toggle-map-fullscreen="toggleMapFullscreen"
            @fit-all="fitAllLayers"
            @toggle-measure="toggleMeasureMode"
            @toggle-picker="togglePicker"
            @clear-measure="clearMeasure"
            @clear-picked="clearPickedCoords"
            @copy-coord="copyCoord"
            @copy-all="copyAllCoords"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getToolById } from '../toolData'
import { tileProviders, type TileProvider } from './tileProviders'
import KmlSidebar from './KmlSidebar.vue'
import KmlMapToolbar from './KmlMapToolbar.vue'
import type { KmlTreeNodeData } from './types'
import ErrorDialog from '@/components/common/ErrorDialog.vue'
import { getMarkerIcon } from './kmlMarkerIcon'
import { asLeafletBounds, asLeafletLayer, buildKmlTree } from './kmlLayerBuilder'
import { useKmlMeasure } from './useKmlMeasure'

// ===================== Tool Config =====================
const toolConfig = getToolById('kml_viewer')

// ===================== Refs =====================
const mapContainerRef = ref<HTMLDivElement | null>(null)
const dragActive = ref(false)
const loadError = ref('')
const errorDialogOpen = ref(false)
const currentProviderIndex = ref(1)
const tiandituKey = ref('')
const isMapFullscreen = ref(false)
const isWebFullscreen = ref(false)

// ===================== Map State =====================
let map: L.Map | null = null
let tileLayer: L.TileLayer | null = null

// ===================== KML Tree State =====================
const treeNodes = ref<KmlTreeNodeData[]>([])

// Flattened list for iterating
const flatPlacemarks = computed(() => {
  const result: KmlTreeNodeData[] = []
  function walk(nodes: KmlTreeNodeData[]) {
    for (const n of nodes) {
      if (n.type === 'placemark') result.push(n)
      walk(n.children)
    }
  }
  walk(treeNodes.value as KmlTreeNodeData[])
  return result
})

const allVisible = computed(
  () => flatPlacemarks.value.length > 0 && flatPlacemarks.value.every((n) => n.visible),
)

// ===================== Measure / Picker =====================
const {
  measureMode,
  pickerActive,
  measureResult,
  anglePoints,
  pickedCoords,
  toggleMeasureMode,
  togglePicker,
  clearMeasure,
  clearPickedCoords,
  copyCoord,
  copyAllCoords,
  cleanupDrawListeners,
} = useKmlMeasure({
  getMap: () => map,
  getContainer: () => mapContainerRef.value,
  getMarkerIcon,
})

// ===================== Lifecycle =====================
/**
 * 全屏状态变化处理（审计 B3 / P2-14）。
 *
 * 必须是具名函数且注册/移除配对：旧实现在 setup 顶层用匿名函数注册，
 * onBeforeUnmount 从未移除，每次访问 KML 查看器都会泄漏一个闭包，
 * 该闭包持有整个组件作用域（map / layers / tree）。
 */
function onFullscreenChange() {
  isWebFullscreen.value = !!document.fullscreenElement
  nextTick(() => map?.invalidateSize())
}

onMounted(async () => {
  await nextTick()
  if (!mapContainerRef.value) return
  initMap()
  document.addEventListener('fullscreenchange', onFullscreenChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  cleanupDrawListeners()
  if (map) {
    map.remove()
    map = null
  }
})

// ===================== Map Init =====================
function initMap() {
  if (!mapContainerRef.value) return
  map = L.map(mapContainerRef.value, {
    center: [35.86, 104.19],
    zoom: 5,
    zoomControl: true,
  })
  setTileLayer()
}

function buildTileUrl(provider: TileProvider): string {
  let url = provider.url
  if (provider.needsKey && tiandituKey.value) {
    url = url.replace('{key}', tiandituKey.value)
  } else if (provider.needsKey) {
    url = url.replace('{key}', '')
  }
  return url
}

function setTileLayer() {
  if (!map) return
  const provider = tileProviders[currentProviderIndex.value]!

  if (tileLayer) {
    map.removeLayer(tileLayer)
    tileLayer = null
  }

  const url = buildTileUrl(provider)

  if (provider.yFlip) {
    /** Leaflet 的 TileLayer 有 _getSubdomain（下划线命名即内部 API），
     *  @types/leaflet 未声明它。用最小接口声明，替代原来的 `as any`。 */
    interface SubdomainTileLayer extends L.TileLayer {
      _getSubdomain(coords: L.Coords): string
    }

    /**
     * 腾讯/高德的瓦片 Y 轴需要翻转。
     *
     * 不用 L.TileLayer.extend()：它的返回类型在 @types/leaflet 里推断不出
     * 构造签名（"Expected 0 arguments, but got 2"）。改为创建一个普通实例后
     * 覆写其 getTileUrl 方法——原型方法替换，行为等价且类型正确。
     */
    const layer = L.tileLayer(url, {
      subdomains: provider.subdomains,
      attribution: provider.attribution,
      maxZoom: provider.maxZoom,
    })
    layer.getTileUrl = function (this: SubdomainTileLayer, coords: L.Coords): string {
      const flippedY = Math.pow(2, coords.z) - 1 - coords.y
      const data = { ...coords, y: flippedY, s: this._getSubdomain(coords) }
      return L.Util.template(url, data as Record<string, unknown>)
    }
    tileLayer = layer.addTo(map)
  } else {
    tileLayer = L.tileLayer(url, {
      subdomains: provider.subdomains.length > 0 ? provider.subdomains : undefined,
      attribution: provider.attribution,
      maxZoom: provider.maxZoom,
    }).addTo(map)
  }
}

// ===================== Fullscreen =====================
function toggleWebFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      isWebFullscreen.value = true
    })
  } else {
    document.exitFullscreen().then(() => {
      isWebFullscreen.value = false
    })
  }
}

function toggleMapFullscreen() {
  isMapFullscreen.value = !isMapFullscreen.value
  if (mapContainerRef.value) {
    nextTick(() => {
      map?.invalidateSize()
    })
  }
}

// ===================== Tianditu Key =====================
function onTiandituKeyChange() {
  setTileLayer()
}

// ===================== Tile Provider Switch =====================
function onProviderChange(event: Event) {
  const select = event.target as HTMLSelectElement
  currentProviderIndex.value = parseInt(select.value, 10)
  setTileLayer()
}

// ===================== KML File Handling =====================
function onDragOver(event: DragEvent) {
  event.dataTransfer!.dropEffect = 'copy'
  dragActive.value = true
}

function onDragLeave() {
  dragActive.value = false
}

function onDrop(event: DragEvent) {
  dragActive.value = false
  const files = event.dataTransfer?.files
  if (files?.length) processFiles(files)
}

function onFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) processFiles(input.files)
  input.value = ''
}

async function processFiles(fileList: FileList) {
  loadError.value = ''
  errorDialogOpen.value = false
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]!
    if (!file.name.toLowerCase().endsWith('.kml')) {
      loadError.value = `文件 "${file.name}" 不是 KML 文件`
      errorDialogOpen.value = true
      continue
    }
    await loadKmlFile(file)
  }
}

async function loadKmlFile(file: File) {
  const text = await file.text()
  const parser = new DOMParser()
  const kmlDoc = parser.parseFromString(text, 'application/xml')
  if (kmlDoc.querySelector('parsererror')) {
    loadError.value = `文件 "${file.name}" 不是有效的 XML`
    errorDialogOpen.value = true
    return
  }
  if (!map) return

  const fileNode = buildKmlTree(kmlDoc, file, map)
  treeNodes.value = [...treeNodes.value, fileNode]

  // Fit to bounds of first file
  nextTick(() => {
    if (fileNode.bounds?.isValid()) {
      map?.fitBounds(asLeafletBounds(fileNode.bounds), { padding: [50, 50] })
    }
  })
}

// ===================== Tree Node Actions =====================
function onNodeToggle(node: KmlTreeNodeData) {
  if (node.type === 'placemark') {
    node.visible = !node.visible
    if (node.leafletLayer) {
      if (node.visible) map?.addLayer(asLeafletLayer(node.leafletLayer))
      else map?.removeLayer(asLeafletLayer(node.leafletLayer))
    }
  } else {
    // Toggle folder/file → toggle all children recursively
    node.visible = !node.visible
    toggleChildrenRecursive(node, node.visible)
  }
}

function toggleChildrenRecursive(node: KmlTreeNodeData, visible: boolean) {
  for (const child of node.children) {
    child.visible = visible
    if (child.type === 'placemark' && child.leafletLayer) {
      if (visible) map?.addLayer(asLeafletLayer(child.leafletLayer))
      else map?.removeLayer(asLeafletLayer(child.leafletLayer))
    }
    toggleChildrenRecursive(child, visible)
  }
}

function onNodeZoom(node: KmlTreeNodeData) {
  if (node.bounds?.isValid()) map?.fitBounds(asLeafletBounds(node.bounds), { padding: [50, 50] })
  else if (node.type === 'placemark' && 'getLatLng' in (node.leafletLayer || {})) {
    map?.setView((node.leafletLayer as L.Marker).getLatLng(), 15)
  }
}

function onNodeRemove(node: KmlTreeNodeData) {
  // Remove from parent
  if (node.parent) {
    node.parent.children = node.parent.children.filter((c) => c.id !== node.id)
  }
  // Remove from tree root
  treeNodes.value = treeNodes.value.filter((n) => n.id !== node.id)

  // Remove layers recursively
  removeNodeLayersRecursive(node)
}

function removeNodeLayersRecursive(node: KmlTreeNodeData) {
  if (node.type === 'placemark' && node.leafletLayer) {
    map?.removeLayer(asLeafletLayer(node.leafletLayer))
  }
  for (const child of node.children) {
    removeNodeLayersRecursive(child)
  }
}

function toggleAllPlacemarks() {
  const target = !allVisible.value
  for (const n of flatPlacemarks.value) {
    n.visible = target
    if (n.leafletLayer) {
      if (target) map?.addLayer(asLeafletLayer(n.leafletLayer))
      else map?.removeLayer(asLeafletLayer(n.leafletLayer))
    }
  }
  // Also update folder nodes
  for (const root of treeNodes.value) {
    syncFolderVisibility(root as KmlTreeNodeData, target)
  }
}

function syncFolderVisibility(node: KmlTreeNodeData, visible: boolean) {
  if (node.type !== 'placemark') {
    node.visible = visible
  }
  for (const child of node.children) {
    syncFolderVisibility(child, visible)
  }
}

function fitAllLayers() {
  if (!map) return
  const bounds = L.latLngBounds([])
  let hasBounds = false
  for (const n of flatPlacemarks.value) {
    if (!n.visible || !n.bounds?.isValid()) continue
    bounds.extend(asLeafletBounds(n.bounds))
    hasBounds = true
  }
  if (hasBounds) map.fitBounds(bounds, { padding: [50, 50] })
}

// ===================== Error Dialog =====================
function closeErrorDialog() {
  errorDialogOpen.value = false
  loadError.value = ''
}
</script>

<style>
.leaflet-container {
  width: 100%;
  height: 100%;
  z-index: 1;
}

.kml-marker-icon {
  background: transparent !important;
  border: none !important;
}

/* Leaflet 自带控件和弹窗是固定浅色/蓝色，跟随站点主题收敛。
   leaflet.css 在组件里 import，注入顺序可能晚于本文件，用 :root[data-theme] 提高优先级。 */
:root[data-theme] .leaflet-container {
  background: var(--color-base-200);
  color: var(--color-base-content);
  font-family: var(--font-sans);
}

:root[data-theme] .leaflet-container a {
  color: var(--color-primary);
}

:root[data-theme] .leaflet-bar {
  border: 1px solid var(--color-base-300);
  box-shadow: 0 2px 6px color-mix(in oklab, var(--color-base-content) 18%, transparent);
}

:root[data-theme] .leaflet-bar a,
:root[data-theme] .leaflet-bar a.leaflet-disabled {
  background-color: var(--color-base-100);
  border-bottom-color: var(--color-base-300);
  color: var(--color-base-content);
}

:root[data-theme] .leaflet-bar a:hover,
:root[data-theme] .leaflet-bar a:focus {
  background-color: var(--color-base-200);
  color: var(--color-primary);
}

:root[data-theme] .leaflet-bar a.leaflet-disabled {
  color: var(--text-faint);
}

:root[data-theme] .leaflet-control-attribution {
  background: color-mix(in oklab, var(--color-base-100) 82%, transparent);
  color: var(--text-muted);
}

:root[data-theme] .leaflet-control-attribution a {
  color: var(--color-primary);
}

:root[data-theme] .leaflet-control-scale-line {
  background: color-mix(in oklab, var(--color-base-100) 65%, transparent);
  border-color: var(--line-strong);
  color: var(--color-base-content);
}

:root[data-theme] .leaflet-popup-content-wrapper,
:root[data-theme] .leaflet-popup-tip {
  background: var(--color-base-100);
  color: var(--color-base-content);
  border-radius: var(--radius-box, 0.25rem);
}

:root[data-theme] .leaflet-popup-content-wrapper {
  border: 1px solid var(--color-base-300);
  box-shadow: 0 6px 18px color-mix(in oklab, var(--color-base-content) 22%, transparent);
}

:root[data-theme] .leaflet-container a.leaflet-popup-close-button {
  color: var(--text-muted);
}

:root[data-theme] .leaflet-container a.leaflet-popup-close-button:hover,
:root[data-theme] .leaflet-container a.leaflet-popup-close-button:focus {
  color: var(--color-error);
}

:root[data-theme] .leaflet-tooltip {
  background: var(--color-base-100);
  border-color: var(--color-base-300);
  color: var(--color-base-content);
  box-shadow: 0 2px 8px color-mix(in oklab, var(--color-base-content) 18%, transparent);
}

:root[data-theme] .leaflet-tooltip-top::before {
  border-top-color: var(--color-base-100);
}

:root[data-theme] .leaflet-tooltip-bottom::before {
  border-bottom-color: var(--color-base-100);
}

:root[data-theme] .leaflet-tooltip-left::before {
  border-left-color: var(--color-base-100);
}

:root[data-theme] .leaflet-tooltip-right::before {
  border-right-color: var(--color-base-100);
}
</style>
