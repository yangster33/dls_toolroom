<template>
  <div class="p-6" :class="{ '!p-0': isMapFullscreen }">
    <ErrorDialog
      :is-open="errorDialogOpen"
      type="error"
      title="加载失败"
      :message="loadError"
      @close="closeErrorDialog"
    />
    <template v-if="!isMapFullscreen">
      <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || 'KML查看器' }}</h1>
      <p class="text-base-content/70 mb-6">{{ toolConfig?.description || '' }}</p>
    </template>

    <div
      class="bg-base-100 rounded-lg shadow-lg overflow-hidden"
      :class="isMapFullscreen ? '!rounded-none fixed inset-0 z-50 m-0' : ''"
      :style="isMapFullscreen ? {} : { height: `calc(100vh - ${isWebFullscreen ? '40px' : '220px'})`, minHeight: '500px' }"
    >
      <div class="flex h-full">
        <!-- Left Panel -->
        <template v-if="!isMapFullscreen">
          <div class="w-72 flex-shrink-0 border-r border-base-300 flex flex-col bg-base-200/50">
            <!-- Tianditu Key -->
            <div class="p-4 border-b border-base-300">
              <label class="block text-sm font-semibold mb-2">🔑 天地图 Key</label>
              <div class="flex gap-1">
                <input
                  v-model="tiandituKey"
                  type="text"
                  class="input input-bordered input-sm flex-1"
                  placeholder="输入天地图 Key"
                  @change="onTiandituKeyChange"
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
                @change="onProviderChange"
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
                :class="dragActive ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary/50 hover:bg-base-200'"
                @dragover.prevent="onDragOver"
                @dragleave.prevent="onDragLeave"
                @drop.prevent="onDrop"
                @click="openFilePicker"
              >
                <p class="text-xs text-base-content/50">拖拽 .kml 文件到此处 或点击选择</p>
                <input ref="fileInputRef" type="file" accept=".kml" multiple class="hidden" @change="onFileSelect" />
              </div>
              
            </div>

            <!-- Layer Tree -->
            <div class="flex-1 overflow-y-auto p-2">
              <div class="flex items-center justify-between mb-2 px-2">
                <span class="text-sm font-semibold">📑 图层树</span>
                <button
                  v-if="flatPlacemarks.length > 0"
                  class="btn btn-ghost btn-xs"
                  @click="toggleAllPlacemarks"
                >{{ allVisible ? '全部隐藏' : '全部显示' }}</button>
              </div>
              <div v-if="flatPlacemarks.length === 0" class="text-xs text-base-content/40 text-center py-4">
                加载 KML 后显示图层树
              </div>
              <!-- Tree: iterate tree roots -->
              <KmlTreeNode
                v-for="node in treeNodes"
                :key="node.id"
                :node="node"
                :depth="0"
                @toggle="onNodeToggle"
                @zoom="onNodeZoom"
                @remove="onNodeRemove"
              />
            </div>
          </div>
        </template>

        <!-- Right Panel: Map -->
        <div class="flex-1 relative">
          <div ref="mapContainerRef" class="w-full h-full"></div>

          <!-- Toolbar -->
          <div class="absolute top-2 right-2 z-[1000] flex flex-col gap-1">
            <!-- Web Fullscreen -->
            <button
              class="btn btn-sm btn-circle btn-ghost bg-base-100 shadow"
              :title="isWebFullscreen ? '退出网页全屏' : '网页全屏'"
              @click="toggleWebFullscreen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
                <path v-if="isWebFullscreen" d="M96,160H56a8,8,0,0,1-8-8V112a8,8,0,0,1,16,0v24h32a8,8,0,0,1,0,16Zm64-64h40V56a8,8,0,0,1,16,0v40a8,8,0,0,1-8,8H160a8,8,0,0,1,0-16Zm-64-32H56a8,8,0,0,1,0-16H96a8,8,0,0,1,0,16Zm104,56a8,8,0,0,1-8,8H56a8,8,0,0,1,0-16H192A8,8,0,0,1,200,120Z"/>
                <path v-else d="M40,80V56A16,16,0,0,1,56,40H80a8,8,0,0,1,0,16H56V80a8,8,0,0,1-16,0Zm136-24h24V80a8,8,0,0,0,16,0V56a16,16,0,0,0-16-16H176a8,8,0,0,0,0,16ZM80,200H56V176a8,8,0,0,0-16,0v24a16,16,0,0,0,16,16H80a8,8,0,0,0,0-16Zm120-24v24H176a8,8,0,0,0,0,16h24a16,16,0,0,0,16-16V176a8,8,0,0,0-16,0Z"/>
              </svg>
            </button>
            <!-- Map Fullscreen -->
            <button
              class="btn btn-sm btn-circle btn-ghost bg-base-100 shadow"
              :title="isMapFullscreen ? '退出全屏地图' : '全屏地图'"
              @click="toggleMapFullscreen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
                <path v-if="isMapFullscreen" d="M160,48v40a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h28.69L112,51.31A8,8,0,0,1,123.31,40L152,68.69V48a8,8,0,0,1,16,0ZM88,200H59.31L88,171.31A8,8,0,0,0,76.69,160L48,188.69V168a8,8,0,0,0-16,0v40a8,8,0,0,0,8,8H88a8,8,0,0,0,0-16Z"/>
                <path v-else d="M88,48H48V88a8,8,0,0,0,16,0V59.31L92.69,88A8,8,0,0,0,104,76.69L75.31,48H88a8,8,0,0,0,0-16Zm80,160H208V168a8,8,0,0,0-16,0v28.69L163.31,168A8,8,0,0,0,152,179.31L180.69,208H168a8,8,0,0,0,0,16h40a8,8,0,0,0,8-8V168a8,8,0,0,0-16,0Z"/>
              </svg>
            </button>
            <!-- Fit all layers -->
            <button
              v-if="flatPlacemarks.length > 0"
              class="btn btn-sm btn-circle btn-ghost bg-base-100 shadow"
              title="缩放到全部图层"
              @click="fitAllLayers"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
                <path d="M152,112a8,8,0,0,1,8-8h32a8,8,0,0,1,0,16H168v24a8,8,0,0,1-16,0Zm-48,40H72V128a8,8,0,0,0-16,0v32a8,8,0,0,0,8,8h40a8,8,0,0,0,0-16Zm80-88H152a8,8,0,0,0,0,16h24v24a8,8,0,0,0,16,0V72A8,8,0,0,0,184,64ZM72,152a8,8,0,0,0-8,8v24a8,8,0,0,0,8,8h32a8,8,0,0,0,0-16H80V160A8,8,0,0,0,72,152Z"/>
              </svg>
            </button>
          </div>

          <!-- Measure / Picker Toolbar -->
          <div class="absolute bottom-2 left-2 z-[1000] flex gap-1 flex-wrap">
            <!-- Measure Length -->
            <button
              class="btn btn-xs shadow"
              :class="measureMode === 'length' ? 'btn-primary' : 'btn-ghost bg-base-100'"
              title="测量长度（单击加点，双击结束）"
              @click="toggleMeasureMode('length')"
            >📏 测距</button>
            <!-- Measure Area -->
            <button
              class="btn btn-xs shadow"
              :class="measureMode === 'area' ? 'btn-primary' : 'btn-ghost bg-base-100'"
              title="测量面积（单击加点，双击闭合）"
              @click="toggleMeasureMode('area')"
            >📐 测面积</button>
            <!-- Measure Angle -->
            <button
              class="btn btn-xs shadow"
              :class="measureMode === 'angle' ? 'btn-primary' : 'btn-ghost bg-base-100'"
              title="测量角度（依次点三个点）"
              @click="toggleMeasureMode('angle')"
            >📏↗ 测角</button>
            <!-- Coordinate Picker -->
            <button
              class="btn btn-xs shadow"
              :class="pickerActive ? 'btn-secondary' : 'btn-ghost bg-base-100'"
              title="经纬度采集（点击地图采集 WGS84 坐标）"
              @click="togglePicker"
            >📍 采点</button>
          </div>

          <!-- Measure Result -->
          <div v-if="measureResult" class="absolute top-2 left-2 z-[1000] bg-base-100 shadow-lg rounded-lg px-3 py-2 text-sm font-mono">
            {{ measureResult }}
            <button class="btn btn-ghost btn-xs ml-1 text-error" @click="clearMeasure">✕</button>
          </div>

          <!-- Coordinate List -->
          <div
            v-if="pickedCoords.length > 0"
            class="absolute bottom-10 left-2 z-[1000] bg-base-100 shadow-lg rounded-lg p-3 max-h-48 overflow-y-auto text-xs"
            style="min-width: 280px;"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="font-semibold">采集坐标 (WGS84)</span>
              <button class="btn btn-ghost btn-xs text-error" @click="clearPickedCoords">清空</button>
            </div>
            <div v-for="(coord, idx) in pickedCoords" :key="idx" class="flex items-center gap-1 py-0.5 hover:bg-base-200 rounded px-1">
              <span class="text-base-content/50 w-5">{{ idx + 1 }}</span>
              <span class="flex-1 font-mono">{{ coord.lat.toFixed(6) }}, {{ coord.lng.toFixed(6) }}</span>
              <button class="btn btn-ghost btn-xs text-primary" @click="copyCoord(coord)">复制</button>
            </div>
            <button class="btn btn-xs btn-ghost mt-1 w-full" @click="copyAllCoords">复制全部</button>
          </div>

          <!-- Angle measurement hint -->
          <div
            v-if="measureMode === 'angle' && anglePoints.length > 0"
            class="absolute top-12 left-2 z-[1000] bg-base-100 shadow rounded px-2 py-1 text-xs"
          >
            已选 {{ anglePoints.length }}/3 个点
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, computed, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import DOMPurify from 'dompurify'
import { getToolById } from '../toolData'
import { tileProviders, type TileProvider } from './tileProviders'
import KmlTreeNode from './KmlTreeNode.vue'
import type { KmlTreeNodeData } from './types'
import ErrorDialog from '@/components/common/ErrorDialog.vue'

// ===================== Tool Config =====================
const toolConfig = getToolById('kml_viewer')

// ===================== Refs =====================
const mapContainerRef = ref<HTMLDivElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
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
// KmlTreeNodeData interface is defined in ./types.ts

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

const allVisible = computed(() => flatPlacemarks.value.length > 0 && flatPlacemarks.value.every((n) => n.visible))

// ===================== Measure State =====================
type MeasureMode = 'length' | 'area' | 'angle' | null
const measureMode = ref<MeasureMode>(null)
const pickerActive = ref(false)

const isMeasuring = computed(() => measureMode.value !== null || pickerActive.value)

// Watch measuring state to toggle crosshair cursor on Leaflet container
watch(isMeasuring, (val) => {
  if (map) {
    map.getContainer().style.cursor = val ? 'crosshair' : ''
  } else if (mapContainerRef.value) {
    mapContainerRef.value.style.cursor = val ? 'crosshair' : ''
  }
})
const measureResult = ref('')
let measurePoints: L.LatLng[] = []
let measureLayer: L.Polyline | L.Polygon | null = null
let measureMarkers: L.Marker[] = []
let angleLines: L.Polyline[] = []
let angleLineMarkers: L.Marker[] = []
let drawHandler: (() => void) | null = null
const anglePoints = ref<L.LatLng[]>([])

// ===================== Picker State =====================
interface PickedCoord {
  lat: number
  lng: number
}
const pickedCoords = ref<PickedCoord[]>([])
let pickerMarkers: L.Marker[] = []

// ===================== KML Style Parsing =====================
/** Parse <Style> elements from KML document. Returns Map of styleId → color */
function parseKmlStyles(xmlDoc: Document): Map<string, string> {
  const styles = new Map<string, string>()
  const styleEls = xmlDoc.getElementsByTagName('Style')
  for (let i = 0; i < styleEls.length; i++) {
    const el = styleEls[i]!
    const id = el.getAttribute('id')
    if (!id) continue
    // Try IconStyle first
    const iconStyle = el.getElementsByTagName('IconStyle')[0]
    if (iconStyle) {
      const color = parseKmlColorEl(iconStyle)
      // Even if no <color> element, IconStyle exists → store with default marker color
      styles.set('#' + id, color || '#EA4335')
    }
    // Also parse LineStyle for polylines, PolyStyle for polygons
    // (only if IconStyle didn't already register this style)
    if (!styles.has('#' + id)) {
      const lineStyle = el.getElementsByTagName('LineStyle')[0]
      if (lineStyle) {
        const color = parseKmlColorEl(lineStyle)
        if (color) styles.set('#' + id, color)
      }
    }
    if (!styles.has('#' + id)) {
      const polyStyle = el.getElementsByTagName('PolyStyle')[0]
      if (polyStyle) {
        const color = parseKmlColorEl(polyStyle)
        if (color) styles.set('#' + id, color)
      }
    }
  }
  // Parse StyleMap
  const styleMaps = xmlDoc.getElementsByTagName('StyleMap')
  for (let i = 0; i < styleMaps.length; i++) {
    const sm = styleMaps[i]!
    const mapId = sm.getAttribute('id')
    if (!mapId) continue
    const pairs = sm.getElementsByTagName('Pair')
    for (let j = 0; j < pairs.length; j++) {
      const pair = pairs[j]!
      const keyEl = pair.getElementsByTagName('key')[0]
      const styleUrlEl = pair.getElementsByTagName('styleUrl')[0]
      if (keyEl && styleUrlEl && keyEl.textContent === 'normal') {
        const refColor = styles.get(styleUrlEl.textContent?.trim() || '')
        if (refColor) styles.set('#' + mapId, refColor)
      }
    }
  }
  return styles
}

function parseKmlColorEl(el: Element): string | null {
  const colorEl = el.getElementsByTagName('color')[0]
  if (!colorEl?.textContent) return null
  return kmlColorToHex(colorEl.textContent.trim())
}

/** Convert KML AABBGGRR or BBGGRR color to #RRGGBB CSS hex */
function kmlColorToHex(kmlColor: string): string {
  const cleaned = kmlColor.trim()
  // Support 6-digit KML color without alpha prefix (BBGGRR), prepend 'ff'
  if (cleaned.length === 6) {
    const rr = cleaned.substring(4, 6)
    const gg = cleaned.substring(2, 4)
    const bb = cleaned.substring(0, 2)
    return '#' + rr + gg + bb
  }
  // Standard KML color: AABBGGRR → CSS: #RRGGBB
  if (cleaned.length >= 8) {
    const rr = cleaned.substring(6, 8)
    const gg = cleaned.substring(4, 6)
    const bb = cleaned.substring(2, 4)
    return '#' + rr + gg + bb
  }
  return '#3388ff'
}

// ===================== Google-Style Colored Marker Generator =====================
// Google Maps standard pin: teardrop shape with white center hole, shadow below
function createColoredMarkerIcon(fillColor: string): L.DivIcon {
  return L.divIcon({
    className: 'kml-marker-icon',
    html: `<div style="position:relative;width:27px;height:43px;">
  <svg xmlns="http://www.w3.org/2000/svg" width="27" height="43" viewBox="0 0 27 43" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));">
    <path d="M13.5 0C6.044 0 0 6.044 0 13.5C0 22.387 13.5 43 13.5 43S27 22.387 27 13.5C27 6.044 20.956 0 13.5 0z" fill="${fillColor}" stroke="#992d00" stroke-width="1.2" stroke-opacity="0.5"/>
    <circle cx="13.5" cy="13" r="5.5" fill="#fff" fill-opacity="0.92"/>
  </svg>
</div>`,
    iconSize: [27, 43],
    iconAnchor: [13.5, 43],
    popupAnchor: [0, -43],
  })
}

// Default marker icon cache by color
const markerIconCache = new Map<string, L.DivIcon>()
function getMarkerIcon(color?: string): L.DivIcon {
  const key = color || '__default__'
  if (!markerIconCache.has(key)) {
    markerIconCache.set(key, createColoredMarkerIcon(color || '#EA4335'))
  }
  return markerIconCache.get(key)!
}

// ===================== Lifecycle =====================
onMounted(async () => {
  await nextTick()
  if (!mapContainerRef.value) return
  initMap()
})

onBeforeUnmount(() => {
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
    const TencentTileLayer = L.TileLayer.extend({
      getTileUrl(this: L.TileLayer, coords: L.Coords): string {
        const flippedY = Math.pow(2, coords.z) - 1 - coords.y
        const data = { ...coords, y: flippedY, s: (this as any)._getSubdomain(coords) }
        return L.Util.template(url, data as any)
      },
    })
    tileLayer = new (TencentTileLayer as any)(url, {
      subdomains: provider.subdomains,
      attribution: provider.attribution,
      maxZoom: provider.maxZoom,
    }).addTo(map)
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
    // Save the map container parent for restoration
    nextTick(() => {
      map?.invalidateSize()
    })
  }
}

// Listen for fullscreen change
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    isWebFullscreen.value = !!document.fullscreenElement
    nextTick(() => map?.invalidateSize())
  })
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
function openFilePicker() {
  fileInputRef.value?.click()
}

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

  // Parse styles
  const styles = parseKmlStyles(kmlDoc)

  // Build the tree
  const fileNode: KmlTreeNodeData = {
    id: 'file_' + Date.now(),
    name: file.name,
    type: 'file',
    visible: true,
    children: [],
  }

  const docEl = kmlDoc.documentElement
  parseKmlNode(docEl, fileNode, styles)

  // Add to tree
  treeNodes.value = [...treeNodes.value, fileNode]

  // Fit to bounds of first file
  nextTick(() => {
    if (fileNode.bounds?.isValid()) {
      map?.fitBounds(fileNode.bounds, { padding: [50, 50] })
    }
  })
}

function parseKmlNode(xmlEl: Element, parent: KmlTreeNodeData, styles: Map<string, string>) {
  // Process Folders
  const folders = xmlEl.children
  for (let i = 0; i < folders.length; i++) {
    const el = folders[i]!
    if (el.tagName === 'Folder') {
      const name = el.getElementsByTagName('name')[0]?.textContent || '未命名文件夹'
      const folderNode: KmlTreeNodeData = {
        id: 'folder_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 6),
        name,
        type: 'folder',
        visible: true,
        children: [],
        parent,
      }
      parent.children.push(folderNode)
      parseKmlNode(el, folderNode, styles)
    } else if (el.tagName === 'Placemark') {
      const pmNode = createPlacemarkNode(el, styles)
      if (pmNode) {
        pmNode.parent = parent
        parent.children.push(pmNode)
        // Extend bounds
        if (pmNode.bounds?.isValid()) {
          if (!parent.bounds) parent.bounds = L.latLngBounds(pmNode.bounds! as any, pmNode.bounds! as any)
          else parent.bounds.extend(pmNode.bounds!)
        }
        // Propagate bounds up
        let p = parent
        while (p) {
          if (pmNode.bounds?.isValid()) {
            if (!p.bounds) p.bounds = L.latLngBounds(pmNode.bounds! as any, pmNode.bounds! as any)
            else p.bounds.extend(pmNode.bounds!)
          }
          p = p.parent!
        }
      }
    } else if (el.tagName === 'Document') {
      parseKmlNode(el, parent, styles)
    }
  }
}

function createPlacemarkNode(el: Element, styles: Map<string, string>): KmlTreeNodeData | null {
  const name = el.getElementsByTagName('name')[0]?.textContent || '未命名要素'
  const descr = el.getElementsByTagName('description')[0]?.textContent || ''

  // Get style color — check in order: inline Style > styleUrl > default
  let color: string | undefined
  // 1. Try inline <Style> inside Placemark
  const inlineStyle = el.getElementsByTagName('Style')[0]
  if (inlineStyle) {
    const iconColor = parseKmlColorEl(inlineStyle.getElementsByTagName('IconStyle')[0] || inlineStyle)
    if (iconColor) color = iconColor
  }
  // 2. Try styleUrl reference
  if (!color) {
    const styleUrlEl = el.getElementsByTagName('styleUrl')[0]
    if (styleUrlEl?.textContent) {
      const styleId = styleUrlEl.textContent.trim()
      color = styles.get(styleId)
    }
  }

  // Determine geometry type
  const geometryTypes = ['Point', 'LineString', 'Polygon', 'MultiGeometry', 'Track', 'GroundOverlay']
  let geometryType = ''
  for (const gt of geometryTypes) {
    if (el.getElementsByTagName(gt).length > 0) {
      geometryType = gt
      break
    }
  }

  // Create Leaflet layer for this placemark
  const leafletLayer = createLayerForPlacemark(el, color, name, descr)
  if (!leafletLayer) return null

  leafletLayer.addTo(map!)

  let bounds: L.LatLngBounds | undefined
  if ('getLatLng' in leafletLayer) {
    bounds = L.latLngBounds([(leafletLayer as L.Marker).getLatLng(), (leafletLayer as L.Marker).getLatLng()])
  } else if ('getBounds' in leafletLayer) {
    bounds = (leafletLayer as L.Polyline).getBounds()
  }

  return {
    id: 'pm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name,
    type: 'placemark',
    geometryType,
    color,
    leafletLayer,
    visible: true,
    children: [],
    bounds,
  }
}

function createLayerForPlacemark(
  el: Element,
  color?: string,
  name?: string,
  descr?: string,
): L.Layer | null {
  const sanitizedName = DOMPurify.sanitize(name || '要素', { ALLOWED_TAGS: [] })
  const sanitizedDescr = descr ? DOMPurify.sanitize(descr, { ALLOWED_TAGS: ['br'] }) : ''
  const popupContent = `<strong>${sanitizedName}</strong>${sanitizedDescr ? `<br/>${sanitizedDescr}` : ''}`

  // Point
  const pointEls = el.getElementsByTagName('Point')
  if (pointEls.length > 0) {
    const coords = pointEls[0]!.getElementsByTagName('coordinates')[0]?.textContent?.trim()
    if (coords) {
      const parts = coords.split(',')
      const latlng = L.latLng(parseFloat(parts[1]!), parseFloat(parts[0]!))
      return L.marker(latlng, { icon: getMarkerIcon(color) }).bindPopup(popupContent)
    }
  }

  // LineString
  const lineEls = el.getElementsByTagName('LineString')
  if (lineEls.length > 0) {
    const latlngs = parseCoords(lineEls[0]!)
    if (latlngs.length > 1) {
      const opts: L.PolylineOptions = { color: color || '#3388ff' }
      return L.polyline(latlngs, opts).bindPopup(popupContent)
    }
  }

  // Polygon
  const polyEls = el.getElementsByTagName('Polygon')
  if (polyEls.length > 0) {
    const outerEl = polyEls[0]!.getElementsByTagName('outerBoundaryIs')[0]
    if (outerEl) {
      const outerCoords = parseCoords(outerEl)
      if (outerCoords.length > 2) {
        const opts: L.PolylineOptions = { color: color || '#3388ff', fillColor: color || '#3388ff', fillOpacity: 0.2 }
        return L.polygon(outerCoords, opts).bindPopup(popupContent)
      }
    }
  }

  // Track / gx:Track
  const trackEls = el.getElementsByTagName('Track')
  const gxTrackEls = el.getElementsByTagName('gx:Track')
  const allTracks = [...Array.from(trackEls), ...Array.from(gxTrackEls)]
  if (allTracks.length > 0) {
    const coordEls = allTracks[0]!.getElementsByTagName('coord')
    const gxCoordEls = allTracks[0]!.getElementsByTagName('gx:coord')
    const coords = [...Array.from(coordEls), ...Array.from(gxCoordEls)]
    const latlngs = coords
      .map((c) => {
        const parts = (c.textContent || '').trim().split(/\s+/)
        if (parts.length >= 2) return L.latLng(parseFloat(parts[1]!), parseFloat(parts[0]!))
        return null
      })
      .filter(Boolean) as L.LatLng[]
    if (latlngs.length > 1) {
      return L.polyline(latlngs, { color: color || '#3388ff' }).bindPopup(popupContent)
    }
  }

  // MultiGeometry — just return first known child
  const multiEls = el.getElementsByTagName('MultiGeometry')
  if (multiEls.length > 0) {
    for (const child of Array.from(multiEls[0]!.children)) {
      const wrapper = document.createElement('div')
      wrapper.appendChild(child.cloneNode(true))
      // Fake a Placemark wrapper
      const fakeEl = document.createElement('Placemark')
      fakeEl.appendChild(child.cloneNode(true))
      const result = createLayerForPlacemark(fakeEl, color, name, descr)
      if (result) return result
    }
  }

  return null
}

function parseCoords(el: Element): L.LatLng[] {
  const coordEl = el.getElementsByTagName('coordinates')[0]
  if (!coordEl?.textContent) return []
  const text = coordEl.textContent.trim()
  const pairs = text.split(/[\s\n]+/).filter(Boolean)
  return pairs
    .map((p) => {
      const parts = p.split(',')
      if (parts.length < 2) return null
      return L.latLng(parseFloat(parts[1]!), parseFloat(parts[0]!))
    })
    .filter(Boolean) as L.LatLng[]
}

// ===================== Tree Node Actions =====================
function onNodeToggle(node: KmlTreeNodeData) {
  if (node.type === 'placemark') {
    node.visible = !node.visible
    if (node.leafletLayer) {
      if (node.visible) map?.addLayer(node.leafletLayer)
      else map?.removeLayer(node.leafletLayer)
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
      if (visible) map?.addLayer(child.leafletLayer)
      else map?.removeLayer(child.leafletLayer)
    }
    toggleChildrenRecursive(child, visible)
  }
}

function onNodeZoom(node: KmlTreeNodeData) {
  if (node.bounds?.isValid()) map?.fitBounds(node.bounds, { padding: [50, 50] })
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
    map?.removeLayer(node.leafletLayer)
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
      if (target) map?.addLayer(n.leafletLayer)
      else map?.removeLayer(n.leafletLayer)
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
    bounds.extend(n.bounds)
    hasBounds = true
  }
  if (hasBounds) map.fitBounds(bounds, { padding: [50, 50] })
}

// ===================== Measure Tool =====================
function toggleMeasureMode(mode: MeasureMode) {
  if (measureMode.value === mode) {
    clearMeasure()
    return
  }
  clearPicker()
  clearMeasure()
  measureMode.value = mode
  measurePoints = []
  anglePoints.value = []
  cleanupDrawListeners()

  if (mode === 'angle') {
    drawHandler = setupAngleMeasure()
  } else {
    drawHandler = setupDrawMeasure()
  }
}

function setupDrawMeasure(): () => void {
  const clickHandler = (e: L.LeafletMouseEvent) => {
    L.DomEvent.stop(e)
    measurePoints.push(e.latlng)
    addMeasureMarker(e.latlng)
    updateMeasureDrawing()
  }

  const dblClickHandler = (e: L.LeafletMouseEvent) => {
    L.DomEvent.stop(e)
    if (measurePoints.length > 0) {
      measurePoints.push(e.latlng)
      addMeasureMarker(e.latlng)
      updateMeasureDrawing()
      finishMeasure()
    }
  }

  map!.on('click', clickHandler)
  map!.on('dblclick', dblClickHandler)

  return () => {
    map!.off('click', clickHandler)
    map!.off('dblclick', dblClickHandler)
  }
}

function setupAngleMeasure(): () => void {
  const clickHandler = (e: L.LeafletMouseEvent) => {
    L.DomEvent.stop(e)
    anglePoints.value = [...anglePoints.value, e.latlng]
    const marker = addMeasureMarker(e.latlng, 'A' + anglePoints.value.length)
    angleLineMarkers.push(marker)

    if (anglePoints.value.length === 3) {
      // Draw lines and store them for cleanup
      const line1 = L.polyline([anglePoints.value[0]!, anglePoints.value[1]!], {
        color: '#ff4444',
        weight: 2,
        dashArray: '5,5',
      }).addTo(map!)
      angleLines.push(line1)

      const line2 = L.polyline([anglePoints.value[1]!, anglePoints.value[2]!], {
        color: '#4444ff',
        weight: 2,
        dashArray: '5,5',
      }).addTo(map!)
      angleLines.push(line2)

      const angle = calculateAngle(
        anglePoints.value[0]!,
        anglePoints.value[1]!,
        anglePoints.value[2]!,
      )
      measureResult.value = `角度: ${angle.toFixed(2)}°`
      finishMeasure()
    }
  }

  map!.on('click', clickHandler)
  return () => map!.off('click', clickHandler)
}

function calculateAngle(a: L.LatLng, b: L.LatLng, c: L.LatLng): number {
  const ba = { x: a.lng - b.lng, y: a.lat - b.lat }
  const bc = { x: c.lng - b.lng, y: c.lat - b.lat }
  const dot = ba.x * bc.x + ba.y * bc.y
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y)
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y)
  const cosA = dot / (magBA * magBC)
  return (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI
}

function addMeasureMarker(latlng: L.LatLng, label?: string): L.Marker {
  const m = L.marker(latlng, {
    icon: L.divIcon({
      className: 'measure-marker',
      html: `<div style="width:10px;height:10px;background:#ff6600;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.4);"></div>${label ? `<span style="position:absolute;top:-18px;left:6px;font-size:10px;font-weight:bold;color:#ff6600;text-shadow:0 0 2px #fff;">${label}</span>` : ''}`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    }),
  }).addTo(map!)
  measureMarkers.push(m)
  return m
}

function updateMeasureDrawing() {
  if (measureLayer) {
    map?.removeLayer(measureLayer)
    measureLayer = null
  }

  if (measurePoints.length < 2) return

  if (measureMode.value === 'area') {
    measureLayer = L.polygon(measurePoints, {
      color: '#ff6600',
      fillColor: '#ff6600',
      fillOpacity: 0.15,
      weight: 2,
    }).addTo(map!)
    const area = turfArea(measurePoints)
    measureResult.value = `面积: ${formatArea(area)}`
  } else if (measureMode.value === 'length') {
    measureLayer = L.polyline(measurePoints, {
      color: '#ff6600',
      weight: 3,
    }).addTo(map!)
    const length = turfLength(measurePoints)
    measureResult.value = `长度: ${formatLength(length)}`
  }
}

function finishMeasure() {
  cleanupDrawListeners()
  // Keep result visible, clear mode
  measureMode.value = null
}

function clearMeasure() {
  if (measureLayer) {
    map?.removeLayer(measureLayer)
    measureLayer = null
  }
  measureMarkers.forEach((m) => map?.removeLayer(m))
  measureMarkers = []
  angleLines.forEach((l) => map?.removeLayer(l))
  angleLines = []
  angleLineMarkers.forEach((m) => map?.removeLayer(m))
  angleLineMarkers = []
  measurePoints = []
  anglePoints.value = []
  measureResult.value = ''
  measureMode.value = null
  cleanupDrawListeners()
}

function cleanupDrawListeners() {
  if (drawHandler) {
    drawHandler()
    drawHandler = null
  }
}

// ===================== Coordinate Picker =====================
function togglePicker() {
  clearMeasure()
  cleanupDrawListeners()

  pickerActive.value = !pickerActive.value

  if (pickerActive.value) {
    const handler = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stop(e)
      const { lat, lng } = e.latlng
      pickedCoords.value = [...pickedCoords.value, { lat, lng }]
      const m = L.marker([lat, lng], {
        icon: getMarkerIcon('#e74c3c'),
      })
        .bindPopup(`<span class="font-mono text-xs">${lat.toFixed(6)}, ${lng.toFixed(6)}</span>`)
        .addTo(map!)
        .openPopup()
      pickerMarkers.push(m)
    }
    map!.on('click', handler)
    drawHandler = () => {
      map!.off('click', handler)
      map!.off('dblclick', null as any)
    }
  }
}

function clearPicker() {
  pickerActive.value = false
  pickedCoords.value = []
  pickerMarkers.forEach((m) => map?.removeLayer(m))
  pickerMarkers = []
  cleanupDrawListeners()
}

function clearPickedCoords() {
  pickedCoords.value = []
  pickerMarkers.forEach((m) => map?.removeLayer(m))
  pickerMarkers = []
}

async function copyCoord(coord: PickedCoord) {
  await navigator.clipboard.writeText(`${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}`)
}

async function copyAllCoords() {
  const text = pickedCoords.value.map((c) => `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`).join('\n')
  await navigator.clipboard.writeText(text)
}

// ===================== Utilities =====================
function turfLength(points: L.LatLng[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += points[i - 1]!.distanceTo(points[i]!)
  }
  return total
}

function turfArea(points: L.LatLng[]): number {
  if (points.length < 3) return 0
  const coords = points.map((p) => [p.lng, p.lat])
  // Shoelace formula
  let area = 0
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length
    area += coords[i]![0]! * coords[j]![1]!
    area -= coords[j]![0]! * coords[i]![1]!
  }
  area = Math.abs(area) / 2
  // Convert degrees² to m² (approximate at center latitude)
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length
  const latRad = (lat * Math.PI) / 180
  const mPerDegLat = 111320
  const mPerDegLng = 111320 * Math.cos(latRad)
  return area * mPerDegLat * mPerDegLng
}

function formatLength(meters: number): string {
  if (meters >= 1000) return (meters / 1000).toFixed(2) + ' km'
  return meters.toFixed(1) + ' m'
}

function formatArea(m2: number): string {
  if (m2 >= 1_000_000) return (m2 / 1_000_000).toFixed(2) + ' km²'
  return m2.toFixed(1) + ' m²'
}

function closeErrorDialog() {
  errorDialogOpen.value = false
  loadError.value = ''
}
</script>

<style scoped>
::deep(.leaflet-container) {
  width: 100%;
  height: 100%;
  z-index: 1;
}

/* Google-style pin — remove leaflet default div icon styles */
:deep(.kml-marker-icon) {
  background: transparent !important;
  border: none !important;
}
</style>
