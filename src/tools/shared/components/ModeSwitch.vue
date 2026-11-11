<template>
  <div class="segmented mode-switch" role="group" aria-label="模式">
    <button type="button" :class="{ active: modelValue === 'simple' }" @click="select('simple')">
      简易
    </button>
    <button
      type="button"
      :class="{ active: modelValue === 'professional' }"
      @click="select('professional')"
    >
      专业
    </button>
  </div>
</template>

<script setup lang="ts">
import type { UiMode } from '../useUiMode'

defineProps<{ modelValue: UiMode }>()

const emit = defineEmits<{ 'update:modelValue': [mode: UiMode] }>()

function select(mode: UiMode) {
  emit('update:modelValue', mode)
}
</script>
