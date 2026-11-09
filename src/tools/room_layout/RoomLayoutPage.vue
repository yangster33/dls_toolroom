<template>
  <div class="bg-base-100/70 backdrop-blur-sm rounded-lg shadow-lg p-4">
    <header class="mb-4">
      <p class="text-xs font-mono tracking-widest text-base-content/50">ROOM LAYOUT / TELECOM</p>
      <h1 class="text-3xl font-bold">{{ toolConfig?.name || '机房平面图生成' }}</h1>
      <p class="text-base-content/70">
        按房间尺寸、机柜数量与工程规则生成 Top 3 布置方案；支持 SVG / PNG / JSON 导出。
      </p>
    </header>

    <div class="alert alert-warning text-sm mb-4">
      <PhWarning weight="fill" />
      <span
        >方案示意，需工程师按项目规范复核；默认规则为 GB 50174 / GB 51194 / GB 50311 常用值。</span
      >
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
      <aside class="space-y-4">
        <section class="card bg-base-100 shadow-sm">
          <div class="card-body p-4 space-y-3">
            <h2 class="card-title text-base">房间</h2>
            <div class="grid grid-cols-2 gap-2">
              <label class="form-control">
                <span class="label-text">宽度 mm</span>
                <input
                  v-model.number="params.width"
                  type="number"
                  min="3000"
                  step="100"
                  class="input input-bordered input-sm"
                />
              </label>
              <label class="form-control">
                <span class="label-text">深度 mm</span>
                <input
                  v-model.number="params.depth"
                  type="number"
                  min="3000"
                  step="100"
                  class="input input-bordered input-sm"
                />
              </label>
              <label class="form-control col-span-2">
                <span class="label-text">形状</span>
                <select v-model="params.shape" class="select select-bordered select-sm">
                  <option value="rect">矩形</option>
                  <option value="L">L 形（右上角缺口）</option>
                </select>
              </label>
              <label v-if="params.shape === 'L'" class="form-control">
                <span class="label-text">缺口宽 mm</span>
                <input
                  v-model.number="params.notchW"
                  type="number"
                  min="0"
                  step="100"
                  class="input input-bordered input-sm"
                />
              </label>
              <label v-if="params.shape === 'L'" class="form-control">
                <span class="label-text">缺口深 mm</span>
                <input
                  v-model.number="params.notchD"
                  type="number"
                  min="0"
                  step="100"
                  class="input input-bordered input-sm"
                />
              </label>
            </div>
          </div>
        </section>

        <section class="card bg-base-100 shadow-sm">
          <div class="card-body p-4 space-y-3">
            <h2 class="card-title text-base">设备</h2>
            <div class="grid grid-cols-2 gap-2">
              <label class="form-control">
                <span class="label-text">机柜数</span>
                <input
                  v-model.number="params.cabinetCount"
                  type="number"
                  min="1"
                  max="400"
                  class="input input-bordered input-sm"
                />
              </label>
              <label class="form-control">
                <span class="label-text">电源柜</span>
                <input
                  v-model.number="params.powerCount"
                  type="number"
                  min="0"
                  max="40"
                  class="input input-bordered input-sm"
                />
              </label>
              <label class="form-control">
                <span class="label-text">电池架</span>
                <input
                  v-model.number="params.batteryCount"
                  type="number"
                  min="0"
                  max="40"
                  class="input input-bordered input-sm"
                />
              </label>
              <label class="form-control">
                <span class="label-text">空调</span>
                <input
                  v-model.number="params.acCount"
                  type="number"
                  min="0"
                  max="20"
                  class="input input-bordered input-sm"
                />
              </label>
            </div>
          </div>
        </section>

        <section class="card bg-base-100 shadow-sm">
          <div class="card-body p-4 space-y-3">
            <h2 class="card-title text-base">生成</h2>
            <label class="form-control">
              <span class="label-text">随机种子</span>
              <div class="join w-full">
                <input
                  v-model.number="params.seed"
                  type="number"
                  min="0"
                  class="input input-bordered input-sm join-item flex-1"
                />
                <button class="btn btn-sm join-item" type="button" @click="randomSeed">
                  换一个
                </button>
              </div>
            </label>
            <label class="form-control">
              <span class="label-text"
                >预留扩容：{{ Math.round(params.reservedRatio * 100) }}%</span
              >
              <input
                v-model.number="params.reservedRatio"
                type="range"
                min="0"
                max="0.3"
                step="0.05"
                class="range range-xs"
              />
            </label>
            <button
              class="btn btn-primary w-full"
              type="button"
              :disabled="generating"
              @click="generate"
            >
              <PhMagicWand v-if="!generating" />
              <span v-else class="loading loading-spinner loading-sm"></span>
              生成 Top 3 方案
            </button>
          </div>
        </section>

        <section class="card bg-base-100 shadow-sm">
          <div class="card-body p-4 space-y-2">
            <h2 class="card-title text-base">图层 / 导出</h2>
            <div class="flex flex-wrap gap-3 text-sm">
              <label class="flex items-center gap-1"
                ><input
                  v-model="view.zones"
                  type="checkbox"
                  class="checkbox checkbox-xs"
                />功能区</label
              >
              <label class="flex items-center gap-1"
                ><input
                  v-model="view.equipment"
                  type="checkbox"
                  class="checkbox checkbox-xs"
                />设备</label
              >
              <label class="flex items-center gap-1"
                ><input
                  v-model="view.trays"
                  type="checkbox"
                  class="checkbox checkbox-xs"
                />走线架</label
              >
              <label class="flex items-center gap-1"
                ><input
                  v-model="view.cables"
                  type="checkbox"
                  class="checkbox checkbox-xs"
                />线缆</label
              >
              <label class="flex items-center gap-1"
                ><input
                  v-model="view.labels"
                  type="checkbox"
                  class="checkbox checkbox-xs"
                />标签</label
              >
              <label class="flex items-center gap-1"
                ><input
                  v-model="view.dimensions"
                  type="checkbox"
                  class="checkbox checkbox-xs"
                />尺寸</label
              >
            </div>
            <div class="flex flex-wrap gap-2 pt-1">
              <button class="btn btn-sm" type="button" :disabled="!current" @click="exportSvg">
                SVG
              </button>
              <button class="btn btn-sm" type="button" :disabled="!current" @click="exportPng">
                PNG
              </button>
              <button class="btn btn-sm" type="button" :disabled="!current" @click="exportJson">
                JSON
              </button>
            </div>
          </div>
        </section>
      </aside>

      <main class="space-y-4 min-w-0">
        <div v-if="solutions.length" class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            v-for="(solution, index) in solutions"
            :key="solution.id"
            type="button"
            class="card bg-base-100 shadow-sm text-left border-2 transition-colors"
            :class="
              index === selected ? 'border-primary' : 'border-transparent hover:border-base-300'
            "
            @click="selected = index"
          >
            <div class="card-body p-3">
              <div class="flex items-center justify-between">
                <span class="font-semibold">{{ solution.id }}</span>
                <span
                  class="badge badge-sm"
                  :class="solution.valid ? 'badge-success' : 'badge-error'"
                >
                  {{ solution.valid ? '可行' : '需复核' }}
                </span>
              </div>
              <div class="text-xs text-base-content/60">
                机柜 {{ solution.metrics.cabinetCount }} · 线缆
                {{ solution.metrics.cableLengthM.toFixed(1) }}m
              </div>
              <div class="text-xs text-base-content/60">
                面积利用率 {{ (solution.metrics.areaUtilization * 100).toFixed(1) }}% · 走线架
                {{ solution.metrics.trayLengthM.toFixed(1) }}m
              </div>
            </div>
          </button>
        </div>

        <section v-if="current" class="card bg-base-100 shadow-sm">
          <div class="card-body p-3">
            <div class="flex items-center justify-between mb-2">
              <h2 class="card-title text-base">平面预览</h2>
              <span class="text-xs text-base-content/50">mm · 1:1 几何，SVG 自适应缩放</span>
            </div>
            <div class="room-plan-preview" v-html="svg"></div>
            <div v-if="current.warnings.length" class="mt-3 space-y-1">
              <p class="text-sm font-semibold text-warning">提示 / 约束</p>
              <ul class="text-xs text-base-content/70 list-disc pl-5">
                <li v-for="warning in current.warnings" :key="warning">{{ warning }}</li>
              </ul>
            </div>
          </div>
        </section>

        <section v-else class="card bg-base-100 shadow-sm">
          <div class="card-body items-center text-center py-16 text-base-content/50">
            <PhBlueprint class="size-10" />
            <p>设置参数后点击「生成 Top 3 方案」</p>
          </div>
        </section>

        <section v-if="current" class="card bg-base-100 shadow-sm">
          <div class="card-body p-3">
            <h2 class="card-title text-base">指标</h2>
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <tbody>
                  <tr>
                    <td>机柜数</td>
                    <td>{{ current.metrics.cabinetCount }}</td>
                    <td>面积利用率</td>
                    <td>{{ (current.metrics.areaUtilization * 100).toFixed(1) }}%</td>
                  </tr>
                  <tr>
                    <td>线缆总长</td>
                    <td>{{ current.metrics.cableLengthM.toFixed(1) }} m</td>
                    <td>走线架总长</td>
                    <td>{{ current.metrics.trayLengthM.toFixed(1) }} m</td>
                  </tr>
                  <tr>
                    <td>冷通道</td>
                    <td>{{ current.metrics.coldAisle }} mm</td>
                    <td>热通道</td>
                    <td>{{ current.metrics.hotAisle }} mm</td>
                  </tr>
                  <tr>
                    <td>搬运通道</td>
                    <td>{{ current.metrics.handlingAisle }} mm</td>
                    <td>seed</td>
                    <td>{{ current.seed }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { PhBlueprint, PhMagicWand, PhWarning } from '@phosphor-icons/vue'
import { downloadBlob } from '@/utils/download'
import { getToolById } from '@/tools/toolData'
import { DEFAULT_RULES } from './rules'
import { generateSolutions } from './simulatedAnnealing'
import { planToSvg, type PlanViewOptions } from './planSvg'
import type { LayoutSolution, RoomParams } from './types'

const toolConfig = getToolById('room_layout')

const params = reactive<RoomParams>({
  width: 12000,
  depth: 8000,
  shape: 'rect',
  notchW: 3000,
  notchD: 3000,
  cabinetCount: 24,
  powerCount: 4,
  batteryCount: 4,
  acCount: 4,
  seed: 20261109,
  reservedRatio: 0.1,
})

const view = reactive<Required<PlanViewOptions>>({
  zones: true,
  equipment: true,
  trays: true,
  cables: true,
  labels: true,
  dimensions: true,
  titleBlock: true,
})

const solutions = ref<LayoutSolution[]>([])
const selected = ref(0)
const generating = ref(false)

const current = computed(() => solutions.value[selected.value] ?? null)
const svg = computed(() => (current.value ? planToSvg(current.value, view) : ''))

function randomSeed(): void {
  params.seed = Math.floor(Math.random() * 1_000_000)
}

function generate(): void {
  generating.value = true
  try {
    solutions.value = generateSolutions({ ...params }, DEFAULT_RULES)
    selected.value = 0
  } finally {
    generating.value = false
  }
}

function exportSvg(): void {
  const solution = current.value
  if (!solution) return
  downloadBlob(
    new Blob([planToSvg(solution, view)], { type: 'image/svg+xml;charset=utf-8' }),
    `room-layout-${solution.seed}.svg`,
  )
}

async function exportPng(): Promise<void> {
  const solution = current.value
  if (!solution) return
  const source = planToSvg(solution, view)
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('SVG 渲染失败'))
      image.src = url
    })
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = solution.room.width * scale
    canvas.height = (solution.room.depth + 1400) * scale
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建画布')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    const viewBox = `-900 -900 ${solution.room.width + 1800} ${solution.room.depth + 2300}`
    const sized = source.replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`)
    const sizedUrl = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml;charset=utf-8' }))
    try {
      const sizedImage = new Image()
      await new Promise<void>((resolve, reject) => {
        sizedImage.onload = () => resolve()
        sizedImage.onerror = () => reject(new Error('SVG 渲染失败'))
        sizedImage.src = sizedUrl
      })
      context.drawImage(sizedImage, 0, 0, canvas.width, canvas.height)
    } finally {
      URL.revokeObjectURL(sizedUrl)
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (blob) downloadBlob(blob, `room-layout-${solution.seed}.png`)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function exportJson(): void {
  const solution = current.value
  if (!solution) return
  downloadBlob(
    new Blob([JSON.stringify(solution, null, 2)], {
      type: 'application/json;charset=utf-8',
    }),
    `room-layout-${solution.seed}.json`,
  )
}

onMounted(generate)
</script>

<style scoped>
.room-plan-preview {
  width: 100%;
  overflow: auto;
  border: 1px solid var(--color-base-300);
  border-radius: var(--radius-box, 0.25rem);
  background: #fff;
}
.room-plan-preview :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}
</style>
