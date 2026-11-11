<template>
  <label class="unit-field">
    <span class="unit-field-label">
      <span>{{ label }}</span>
      <span v-if="hint" class="unit-field-hint">{{ hint }}</span>
    </span>
    <span class="unit-field-control">
      <input
        :value="text"
        type="number"
        class="input input-bordered input-sm w-full readout"
        :min="min"
        :max="max"
        :step="step ?? 'any'"
        :disabled="disabled"
        @input="handleInput"
        @blur="handleBlur"
      />
      <span v-if="unit" class="unit-field-unit">{{ unit }}</span>
    </span>
  </label>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const model = defineModel<number>({ required: true })

withDefaults(
  defineProps<{
    label: string
    unit?: string
    hint?: string
    min?: number
    max?: number
    step?: number
    disabled?: boolean
  }>(),
  {
    unit: '',
    hint: '',
    min: undefined,
    max: undefined,
    step: undefined,
    disabled: false,
  },
)

/**
 * 输入框显示值与模型解耦：清空输入框时不把空字符串写进模型。
 * 否则计算层 `Number('')` 会得到 0，短路电流被清空会变成 0 kA、热稳定直接判“通过”。
 * 失焦时若仍为空，回填模型里的上一次有效值（刚打开页面时就是默认值）。
 */
const text = ref(formatValue(model.value))

watch(
  () => model.value,
  (value) => {
    const next = formatValue(value)
    if (text.value === '' || Number(next) !== Number(text.value)) text.value = next
  },
)

function formatValue(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

function handleInput(event: Event) {
  const input = event.target as HTMLInputElement
  text.value = input.value
  if (input.value === '') return
  const value = Number(input.value)
  if (!Number.isFinite(value)) return
  model.value = value
}

function handleBlur(event: Event) {
  if (text.value !== '') return
  const input = event.target as HTMLInputElement
  text.value = formatValue(model.value)
  input.value = text.value
}
</script>

<style scoped>
.unit-field {
  display: block;
  min-width: 0;
}

.unit-field-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
  font-size: 12px;
  line-height: 1.3;
  color: var(--text-muted);
}

.unit-field-hint {
  flex: 0 0 auto;
  font-size: 10px;
  color: var(--text-faint);
}

.unit-field-control {
  position: relative;
  display: block;
}

.unit-field-control input {
  padding-right: 2.75rem;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.unit-field-unit {
  position: absolute;
  top: 50%;
  right: 0.6rem;
  transform: translateY(-50%);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
  pointer-events: none;
}
</style>
