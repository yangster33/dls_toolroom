<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-2">{{ toolConfig?.name || 'SHP转KML' }}</h1>
    <p class="text-base-content/70 mb-6">
      {{ toolConfig?.description || '将SHP文件转换为KML格式，支持点、线、面要素' }}
    </p>

    <div class="bg-base-100 rounded-lg shadow-lg p-6 mb-6 space-y-6">
      <!-- 步骤1: 上传 SHP 文件 -->
      <div>
        <h2 class="text-xl font-semibold mb-4">1. 上传 SHP 文件</h2>
        <div class="flex items-center gap-3 flex-wrap">
          <input
            ref="fileInputRef"
            type="file"
            @change="onFilesSelected"
            class="file-input file-input-bordered w-full max-w-md"
            accept=".shp,.dbf,.shx,.prj,.zip"
            multiple
          />
          <button
            v-if="fileEntries.length > 0"
            @click="triggerAddMore"
            class="btn btn-outline btn-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            添加更多 SHP
          </button>
        </div>
        <p class="text-sm text-base-content/60 mt-2">
          请同时选中 .shp 和 .dbf 文件（需同名），或使用 .zip 压缩包。字段信息来自 .dbf 文件。
        </p>
      </div>

      <!-- 文件列表 -->
      <div v-if="fileEntries.length > 0" class="space-y-4">
        <div
          v-for="entry in fileEntries"
          :key="entry.id"
          class="border-2 rounded-xl p-5 transition-all duration-200"
          :class="
            entry.isValid
              ? 'border-success/40 bg-success/5 hover:border-success/60'
              : 'border-error/40 bg-error/5'
          "
        >
          <!-- 卡片头部 -->
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3 min-w-0">
              <!-- 状态图标 -->
              <span
                v-if="entry.isValid"
                class="flex-shrink-0 w-7 h-7 rounded-full bg-success/20 text-success flex items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </span>
              <span v-else class="flex-shrink-0 w-7 h-7 rounded-full bg-error/20 text-error flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </span>

              <!-- 文件名 -->
              <span class="font-medium truncate">{{ entry.fileName }}</span>

              <!-- 类型徽章 -->
              <span
                v-if="entry.isValid"
                class="badge badge-sm flex-shrink-0"
                :class="getTypeBadgeClass(entry.type)"
              >
                {{ getTypeLabel(entry.type) }}
              </span>

              <!-- 要素数量 -->
              <span
                v-if="entry.isValid"
                class="text-sm text-base-content/60 flex-shrink-0"
              >
                {{ entry.featureCount }} 个要素
              </span>
            </div>

            <!-- 移除按钮 -->
            <button
              @click="removeEntry(entry.id)"
              class="btn btn-xs btn-ghost text-error hover:bg-error/10 flex-shrink-0"
              title="移除此文件"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- 无效文件错误信息 -->
          <div
            v-if="!entry.isValid"
            class="text-sm text-error bg-error/10 rounded-lg p-3"
          >
            <p
              v-for="(err, i) in entry.errors"
              :key="i"
              class="mb-0.5 last:mb-0"
            >
              {{ err }}
            </p>
          </div>

          <!-- 有效文件：样式配置区 -->
          <div v-if="entry.isValid" class="grid gap-4 mt-1">
            <!-- 点样式 -->
            <div v-if="entry.type === 'Point'" class="flex items-center gap-4 flex-wrap">
              <div class="flex items-center gap-2">
                <label class="text-sm font-medium whitespace-nowrap">点颜色</label>
                <ColorPicker
                  :modelValue="(entry.style as PointStyle).color"
                  @update:modelValue="(v: string) => updatePointColor(entry.id, v)"
                />
                <code class="text-xs bg-base-200 px-2 py-1 rounded">{{
                  (entry.style as PointStyle).color
                }}</code>
              </div>
            </div>

            <!-- 线样式 -->
            <div v-if="entry.type === 'LineString'" class="flex items-center gap-4 flex-wrap">
              <div class="flex items-center gap-2">
                <label class="text-sm font-medium whitespace-nowrap">线条颜色</label>
                <ColorPicker
                  :modelValue="(entry.style as LineStyle).color"
                  @update:modelValue="(v: string) => updateLineColor(entry.id, v)"
                />
                <code class="text-xs bg-base-200 px-2 py-1 rounded">{{
                  (entry.style as LineStyle).color
                }}</code>
              </div>
              <div class="flex items-center gap-2">
                <label class="text-sm font-medium whitespace-nowrap">
                  线宽: <span class="font-bold">{{ (entry.style as LineStyle).width }}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  :value="(entry.style as LineStyle).width"
                  @input="(e) => updateLineWidth(entry.id, +(e.target as HTMLInputElement).value)"
                  class="range range-xs w-24"
                />
              </div>
            </div>

            <!-- 面样式 -->
            <div v-if="entry.type === 'Polygon'" class="flex items-center gap-4 flex-wrap">
              <div class="flex items-center gap-2">
                <label class="text-sm font-medium whitespace-nowrap">边框颜色</label>
                <ColorPicker
                  :modelValue="(entry.style as PolygonStyle).strokeColor"
                  @update:modelValue="(v: string) => updatePolygonStrokeColor(entry.id, v)"
                />
                <code class="text-xs bg-base-200 px-2 py-1 rounded">{{
                  (entry.style as PolygonStyle).strokeColor
                }}</code>
              </div>
              <div class="flex items-center gap-2">
                <label class="text-sm font-medium whitespace-nowrap">填充颜色</label>
                <ColorPicker
                  :modelValue="(entry.style as PolygonStyle).fillColor"
                  @update:modelValue="(v: string) => updatePolygonFillColor(entry.id, v)"
                />
                <code class="text-xs bg-base-200 px-2 py-1 rounded">{{
                  (entry.style as PolygonStyle).fillColor
                }}</code>
              </div>
              <div class="flex items-center gap-2">
                <label class="text-sm font-medium whitespace-nowrap">
                  边框线宽: <span class="font-bold">{{ (entry.style as PolygonStyle).strokeWidth }}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="8"
                  :value="(entry.style as PolygonStyle).strokeWidth"
                  @input="(e) => updatePolygonStrokeWidth(entry.id, +(e.target as HTMLInputElement).value)"
                  class="range range-xs w-24"
                />
              </div>
            </div>

            <!-- 文件夹名称 -->
            <div>
              <label class="text-sm font-medium mb-1 block">KML 文件夹名称</label>
              <input
                type="text"
                :value="entry.folderName"
                @input="(e) => updateFolderName(entry.id, (e.target as HTMLInputElement).value)"
                class="input input-bordered input-sm w-full max-w-sm"
                placeholder="请输入文件夹名称"
              />
            </div>

            <!-- 元素名称模板 -->
            <div>
              <label class="text-sm font-medium mb-1 block">KML 元素名称（支持 {field} 模板语法）</label>
              <input
                type="text"
                :value="entry.nameTemplate"
                @input="(e) => updateNameTemplate(entry.id, (e.target as HTMLInputElement).value)"
                class="input input-bordered input-sm w-full max-w-md"
                placeholder="例如: 自定义{name}"
              />
              <!-- 字段列表 - 放在输入框下方 -->
              <div v-if="entry.fields.length > 0" class="mt-2">
                <label class="text-xs font-medium mb-1 block text-base-content/70">点击插入字段：</label>
                <div class="flex flex-wrap gap-1">
                  <button
                    v-for="field in entry.fields"
                    :key="field"
                    @click="insertField(entry.id, field)"
                    class="btn btn-xs btn-outline hover:btn-primary transition-colors"
                  >
                    {{ '{' + field + '}' }}
                  </button>
                </div>
              </div>
              <div v-else class="mt-2 text-xs text-warning bg-warning/10 rounded-lg p-2">
                未检测到属性字段。请确保选择了完整的 Shapefile 文件组（.shp + .dbf 一起选中）。
              </div>
              <div v-if="validateNameTemplate(entry.nameTemplate, entry.fields).error" class="text-error text-xs mt-1">
                {{ validateNameTemplate(entry.nameTemplate, entry.fields).error }}
              </div>
              <!-- 预览 -->
              <div v-if="entry.features.length > 0" class="mt-2 text-sm text-base-content/70">
                <span class="font-medium">预览: </span>
                {{ generateNameFromTemplate(entry.features[0]!.properties, entry.features[0]!.name, entry.nameTemplate) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div v-if="fileEntries.length > 0" class="flex flex-wrap gap-3 pt-2">
        <button
          :disabled="!canExport"
          @click="handleExport"
          class="btn btn-success"
        >
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
          导出 KML 文件
        </button>
        <button @click="handleClear" class="btn btn-outline btn-warning">
          清空全部
        </button>
      </div>

      <ErrorDialog
        :is-open="showErrorDialog"
        type="warning"
        title="导出提示"
        :message="errorMessage"
        :show-cancel="true"
        confirm-button-text="继续导出"
        @close="confirmExport"
        @cancel="showErrorDialog = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { getToolById } from '../toolData'
import { parseShpFile, type GisFeature } from '../gis2excel/GisFileReader'
import { logger } from '@/utils/logger'
import {
  downloadKmlFile,
  type PointStyle,
  type LineStyle,
  type PolygonStyle,
} from './ShpToKmlGenerator'
import ColorPicker from '@/components/common/ColorPicker.vue'
import ErrorDialog from '@/components/common/ErrorDialog.vue'

const toolConfig = getToolById('shp2kml')

// ============================================================
// 类型定义
// ============================================================

interface ShpFileEntry {
  id: string
  file: File
  fileName: string
  folderName: string
  nameTemplate: string
  fields: string[]
  type: 'Point' | 'LineString' | 'Polygon'
  features: GisFeature[]
  featureCount: number
  style: PointStyle | LineStyle | PolygonStyle
  isValid: boolean
  errors: string[]
}

// ============================================================
// 响应式状态
// ============================================================

const fileInputRef = ref<HTMLInputElement | null>(null)
const fileEntries = ref<ShpFileEntry[]>([])
const showErrorDialog = ref(false)
const errorMessage = ref('')

// ============================================================
// 计算属性
// ============================================================

const validEntries = computed(() => fileEntries.value.filter((e) => e.isValid))

const invalidCount = computed(() => fileEntries.value.filter((e) => !e.isValid).length)

const canExport = computed(() => validEntries.value.length > 0)

// ============================================================
// 工具函数
// ============================================================

let idSeq = 0
function genId(): string {
  return `shp_${Date.now()}_${++idSeq}`
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'Point':
      return '点'
    case 'LineString':
      return '线'
    case 'Polygon':
      return '面'
    default:
      return type
  }
}

function getTypeBadgeClass(type: string): string {
  switch (type) {
    case 'Point':
      return 'badge-primary'
    case 'LineString':
      return 'badge-accent'
    case 'Polygon':
      return 'badge-success'
    default:
      return 'badge-ghost'
  }
}

function getDefaultFolderName(fileName: string): string {
  return fileName.replace(/\.shp$/i, '')
}

function getDefaultStyleForType(type: 'Point' | 'LineString' | 'Polygon'): PointStyle | LineStyle | PolygonStyle {
  switch (type) {
    case 'Point':
      return { color: '#E74C3C' }
    case 'LineString':
      return { color: '#3498DB', width: 3 }
    case 'Polygon':
      return { strokeColor: '#E74C3C', fillColor: '#F1C40F', strokeWidth: 2 }
  }
}

function detectDominantType(features: GisFeature[]): 'Point' | 'LineString' | 'Polygon' {
  const counts: Record<string, number> = { Point: 0, LineString: 0, Polygon: 0 }
  for (const f of features) {
    counts[f.type]!++
  }
  const entries = Object.entries(counts).filter(([, c]) => c > 0)
  if (entries.length === 0) return 'Point'
  entries.sort((a, b) => b[1] - a[1])
  return entries[0]![0] as 'Point' | 'LineString' | 'Polygon'
}

// ============================================================
// 文件处理
// ============================================================

async function onFilesSelected(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return

  const files = Array.from(target.files)
  logger.log('选择的文件:', files.map(f => f.name))

  // 检查是否有 zip 文件
  const zipFiles = files.filter(f => f.name.toLowerCase().endsWith('.zip'))
  
  if (zipFiles.length > 0) {
    // 处理 zip 文件
    for (const zipFile of zipFiles) {
      const entry = await createEntry(zipFile)
      fileEntries.value.push(entry)
    }
  } else {
    // 检查是否有多个相关的 Shapefile 文件
    const shpFiles = files.filter(f => f.name.toLowerCase().endsWith('.shp'))
    const otherFiles = files.filter(f => !f.name.toLowerCase().endsWith('.shp'))
    
    if (shpFiles.length === 1) {
      // 只有一个 shp 文件，尝试将相关文件一起处理
      const baseName = shpFiles[0]!.name.replace(/\.shp$/i, '')
      const relatedFiles = [shpFiles[0]]
      
      for (const file of otherFiles) {
        const fileBaseName = file.name.replace(/\.[^/.]+$/, '')
        if (fileBaseName.toLowerCase() === baseName.toLowerCase()) {
          relatedFiles.push(file)
        }
      }
      
      logger.log('相关文件:', relatedFiles.map(f => f!.name))
      const entry = await createEntryFromMultipleFiles(relatedFiles as File[])
      fileEntries.value.push(entry)
    } else {
      // 多个 shp 文件，分别处理
      for (const file of shpFiles) {
        const entry = await createEntry(file)
        fileEntries.value.push(entry)
      }
    }
  }

  // 重置 file input
  target.value = ''
}

async function createEntryFromMultipleFiles(files: File[]): Promise<ShpFileEntry> {
  const id = genId()
  const shpFile = files.find(f => f.name.toLowerCase().endsWith('.shp'))
  const fileName = shpFile ? shpFile.name : files[0]!.name
  const folderName = getDefaultFolderName(fileName)
  const errors: string[] = []

  let features: GisFeature[] = []
  try {
    features = await parseShpFile(files)
  } catch (err) {
    errors.push(
      `解析失败: ${err instanceof Error ? err.message : String(err)}`
    )
    return {
      id,
      file: files[0]!,
      fileName,
      folderName,
      nameTemplate: '',
      fields: [],
      type: 'Point',
      features: [],
      featureCount: 0,
      style: { color: '#E74C3C' },
      isValid: false,
      errors,
    }
  }

  if (features.length === 0) {
    errors.push(`"${fileName}" 中未找到任何地理要素`)
    return {
      id,
      file: files[0]!,
      fileName,
      folderName,
      nameTemplate: '',
      fields: [],
      type: 'Point',
      features: [],
      featureCount: 0,
      style: { color: '#E74C3C' },
      isValid: false,
      errors,
    }
  }

  const type = detectDominantType(features)
  const fields = extractFieldsFromFeatures(features)
  const nameTemplate = getDefaultNameTemplate(fields)

  return {
    id,
    file: files[0]!,
    fileName,
    folderName,
    nameTemplate,
    fields,
    type,
    features,
    featureCount: features.length,
    style: getDefaultStyleForType(type),
    isValid: true,
    errors: [],
  }
}

function triggerAddMore() {
  fileInputRef.value?.click()
}

function extractFieldsFromFeatures(features: GisFeature[]): string[] {
  const fieldsSet = new Set<string>()
  for (const feat of features) {
    for (const key in feat.properties) {
      // 过滤内部兜底字段，不展示给用户
      if (key !== '_fid' && key !== '_type') {
        fieldsSet.add(key)
      }
    }
  }
  return Array.from(fieldsSet).sort()
}

function getDefaultNameTemplate(fields: string[]): string {
  if (fields.length > 0) {
    return `{${fields[0]}}`
  }
  return '{name}'
}

async function createEntry(file: File): Promise<ShpFileEntry> {
  const id = genId()
  const fileName = file.name
  const folderName = getDefaultFolderName(fileName)
  const errors: string[] = []

  const isValidFile = fileName.toLowerCase().endsWith('.shp') || fileName.toLowerCase().endsWith('.zip')
  
  if (!isValidFile) {
    return {
      id,
      file,
      fileName,
      folderName,
      nameTemplate: '',
      fields: [],
      type: 'Point',
      features: [],
      featureCount: 0,
      style: { color: '#E74C3C' },
      isValid: false,
      errors: [`"${fileName}" 不是支持的文件格式，请上传 .shp 或 .zip 格式的文件`],
    }
  }

  let features: GisFeature[] = []
  try {
    features = await parseShpFile(file)
  } catch (err) {
    errors.push(
      `解析失败: ${err instanceof Error ? err.message : String(err)}`
    )
    return {
      id,
      file,
      fileName,
      folderName,
      nameTemplate: '',
      fields: [],
      type: 'Point',
      features: [],
      featureCount: 0,
      style: { color: '#E74C3C' },
      isValid: false,
      errors,
    }
  }

  if (features.length === 0) {
    errors.push(`"${fileName}" 中未找到任何地理要素`)
    return {
      id,
      file,
      fileName,
      folderName,
      nameTemplate: '',
      fields: [],
      type: 'Point',
      features: [],
      featureCount: 0,
      style: { color: '#E74C3C' },
      isValid: false,
      errors,
    }
  }

  const type = detectDominantType(features)
  const fields = extractFieldsFromFeatures(features)
  const nameTemplate = getDefaultNameTemplate(fields)

  return {
    id,
    file,
    fileName,
    folderName,
    nameTemplate,
    fields,
    type,
    features,
    featureCount: features.length,
    style: getDefaultStyleForType(type),
    isValid: true,
    errors: [],
  }
}

// ============================================================
// 样式 & 名称更新
// ============================================================

function findEntry(id: string): ShpFileEntry | undefined {
  return fileEntries.value.find((e) => e.id === id)
}

function updatePointColor(id: string, color: string) {
  const entry = findEntry(id)
  if (entry && entry.type === 'Point') {
    (entry.style as PointStyle).color = color
  }
}

function updateLineColor(id: string, color: string) {
  const entry = findEntry(id)
  if (entry && entry.type === 'LineString') {
    (entry.style as LineStyle).color = color
  }
}

function updateLineWidth(id: string, width: number) {
  const entry = findEntry(id)
  if (entry && entry.type === 'LineString') {
    (entry.style as LineStyle).width = width
  }
}

function updatePolygonStrokeColor(id: string, color: string) {
  const entry = findEntry(id)
  if (entry && entry.type === 'Polygon') {
    (entry.style as PolygonStyle).strokeColor = color
  }
}

function updatePolygonFillColor(id: string, color: string) {
  const entry = findEntry(id)
  if (entry && entry.type === 'Polygon') {
    (entry.style as PolygonStyle).fillColor = color
  }
}

function updatePolygonStrokeWidth(id: string, width: number) {
  const entry = findEntry(id)
  if (entry && entry.type === 'Polygon') {
    (entry.style as PolygonStyle).strokeWidth = width
  }
}

function validateNameTemplate(template: string, fields: string[]): { valid: boolean; error?: string } {
  let depth = 0
  for (const ch of template) {
    if (ch === '{') depth++
    if (ch === '}') depth--
    if (depth < 0) return { valid: false, error: '多余的 } 右花括号' }
  }
  if (depth > 0) return { valid: false, error: '花括号未闭合，缺少 }' }
  if (depth < 0) return { valid: false, error: '花括号不匹配' }

  const re = /\{([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(template)) !== null) {
    if (m[1] === '') return { valid: false, error: '存在空的 {} 占位符' }
    if (!/^[\w]+$/.test(m[1]!)) {
      return { valid: false, error: `字段名 "{${m[1]!}}" 包含非法字符，只允许字母、数字和下划线` }
    }
  }

  return { valid: true }
}

function generateNameFromTemplate(
  properties: Record<string, unknown>,
  name: string,
  template: string
): string {
  if (!template) return name

  const context = {
    name,
    ...properties,
  }

  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const val = (context as Record<string, unknown>)[key]
    return val != null ? String(val) : ''
  })
}

function updateFolderName(id: string, name: string) {
  const entry = findEntry(id)
  if (entry) {
    entry.folderName = name
  }
}

function updateNameTemplate(id: string, template: string) {
  const entry = findEntry(id)
  if (entry) {
    entry.nameTemplate = template
  }
}

function insertField(id: string, field: string) {
  const entry = findEntry(id)
  if (entry) {
    entry.nameTemplate = entry.nameTemplate + `{${field}}`
  }
}

// ============================================================
// 操作
// ============================================================

function removeEntry(id: string) {
  const idx = fileEntries.value.findIndex((e) => e.id === id)
  if (idx >= 0) {
    fileEntries.value.splice(idx, 1)
  }
}

function handleClear() {
  fileEntries.value = []
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function handleExport() {
  if (invalidCount.value > 0) {
    errorMessage.value = `存在 ${invalidCount.value} 个无法处理的文件，将仅导出有效的 ${validEntries.value.length} 个文件。是否继续？`
    showErrorDialog.value = true
  } else {
    doExport()
  }
}

function confirmExport() {
  showErrorDialog.value = false
  doExport()
}

function doExport() {
  const entries = validEntries.value.map((e) => ({
    folderName: e.folderName || e.fileName,
    nameTemplate: e.nameTemplate,
    type: e.type,
    features: e.features,
    style: e.style,
  }))

  downloadKmlFile(entries)
}
</script>
