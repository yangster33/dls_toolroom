<template>
  <div class="relative inline-block" ref="triggerRef">
    <!-- 颜色色块触发按钮 -->
    <button
      type="button"
      class="w-10 h-10 rounded-lg border-2 border-base-content/20 cursor-pointer transition-all duration-150 hover:border-base-content/40 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/50"
      :style="{ backgroundColor: modelValue }"
      @click="togglePicker"
      :aria-label="'当前颜色: ' + modelValue"
    />

    <!-- 弹出 Sketch 颜色选择器 (Teleport 到 body 避免裁剪) -->
    <Teleport to="body">
      <div
        v-if="open"
        class="fixed inset-0 z-[100]"
        @click.self="closePicker"
      >
        <div
          ref="dropdownRef"
          class="absolute color-picker-dd rounded-xl overflow-hidden"
          :style="dropdownStyle"
        >
          <Sketch
            :modelValue="modelValue"
            @update:modelValue="onColorChange"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Sketch } from '@ckpack/vue-color'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref({ top: '0px', left: '0px' })

// ============================================================
// 定位逻辑
// ============================================================

function updatePosition() {
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const pickerWidth = 220
  const pickerHeight = 320

  let left = rect.left
  let top = rect.bottom + 6

  if (left + pickerWidth > window.innerWidth - 10) {
    left = window.innerWidth - pickerWidth - 10
  }
  if (left < 10) left = 10

  if (top + pickerHeight > window.innerHeight - 10) {
    top = rect.top - pickerHeight - 6
  }
  if (top < 10) top = 10

  dropdownStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  }
}

// ============================================================
// 开关逻辑
// ============================================================

function openPicker() {
  open.value = true
  nextTick(updatePosition)
}

function closePicker() {
  open.value = false
}

function togglePicker() {
  if (open.value) {
    closePicker()
  } else {
    openPicker()
  }
}

// ============================================================
// 颜色变更
// ============================================================

function onColorChange(value: any) {
  let hex = ''
  if (typeof value === 'string') {
    hex = value
  } else if (value && typeof value === 'object') {
    hex = value.hex || value.hex8 || ''
  }
  if (hex && hex !== props.modelValue) {
    emit('update:modelValue', hex)
  }
}

// ============================================================
// 滚动时关闭：页面内容滚动后色块位置变了，关闭拾色器
// ============================================================

function onScroll() {
  if (open.value) closePicker()
}

// 也用 resize 辅助重新定位
function onResize() {
  if (open.value) updatePosition()
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onResize)
})
</script>

<!--
  全局（非 scoped）样式块：
  第三方组件 @ckpack/vue-color Sketch 的内部 class 无法被 scoped :deep() 穿透，
  必须放在无 scoped 的 style 块中，确保背景不透明、文字可读。
-->
<style>
/* ============================================================
   daisyUI 主题适配（全局样式）
   使用 daisyUI v5 CSS 自定义属性，同时提供硬色 fallback
   ============================================================ */

/* --- 下拉容器：双层防御确保不透明 --- */
.color-picker-dd {
  /* daisyUI 变量优先，无则退到 Tailwind Proxy 变量，再无则退到 #fff */
  background: oklch(var(--b1, 1 0 0));
  background: var(--color-base-100, oklch(var(--b1, 1 0 0)));
  /* 硬兜底——绝不会透明 */
  background-color: #ffffff;
  color: #1f2937;
  border: 1px solid oklch(var(--b3, 0.9 0 0));
  box-shadow:
    0 4px 16px rgb(0 0 0 / 0.15),
    0 0 0 1px rgb(0 0 0 / 0.05);
}
@media (prefers-color-scheme: dark) {
  .color-picker-dd {
    background-color: #2a303c;   /* daisyUI dark base-100 等价色 */
    color: #e5e7eb;
  }
}

/* --- Sketch 主容器 --- */
.color-picker-dd .vc-sketch {
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  color: inherit !important;
}

/* --- 饱和度色板 --- */
.color-picker-dd .vc-sketch-saturation-wrap {
  border: none !important;
  border-radius: 0 !important;
  overflow: hidden;
}

/* --- 底部控件区 --- */
.color-picker-dd .vc-sketch-controls {
  background: transparent !important;
  border-top: 1px solid rgb(128 128 128 / 0.2) !important;
}

/* --- 激活色预览 --- */
.color-picker-dd .vc-sketch-active-color {
  border-radius: 4px !important;
  border: 1px solid rgb(128 128 128 / 0.3) !important;
}

/* --- 输入框 --- */
.color-picker-dd .vc-sketch-field input {
  background: rgb(128 128 128 / 0.08) !important;
  color: inherit !important;
  border: 1px solid rgb(128 128 128 / 0.25) !important;
  border-radius: 0.375rem !important;
  padding: 2px 6px !important;
  outline: none !important;
  box-shadow: none !important;
  font-size: 12px !important;
}

.color-picker-dd .vc-sketch-field input:focus {
  border-color: oklch(var(--p, 0.55 0.2 270)) !important;
  box-shadow: 0 0 0 2px oklch(var(--p, 0.55 0.2 270) / 0.25) !important;
}

/* --- 标签文字 --- */
.color-picker-dd .vc-sketch-field label {
  color: rgb(128 128 128 / 0.65) !important;
  font-size: 11px !important;
}

/* --- 预设色块区 --- */
.color-picker-dd .vc-sketch-presets {
  border-top: 1px solid rgb(128 128 128 / 0.2) !important;
}

/* --- 指针光标 --- */
.color-picker-dd .vc-sketch-saturation-pointer {
  border: 2px solid #fff !important;
}
.color-picker-dd .vc-hue-pointer,
.color-picker-dd .vc-alpha-pointer {
  border: 2px solid #fff !important;
}
</style>
