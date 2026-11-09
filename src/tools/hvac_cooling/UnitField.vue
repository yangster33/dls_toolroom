<template>
  <label class="unit-field">
    <span class="unit-field-label">
      <span>{{ label }}</span>
      <span v-if="hint" class="unit-field-hint">{{ hint }}</span>
    </span>
    <span class="unit-field-control">
      <input
        v-model.number="model"
        type="number"
        class="input input-bordered input-sm w-full readout"
        :min="min"
        :max="max"
        :step="step ?? 'any'"
        :disabled="disabled"
      />
      <span v-if="unit" class="unit-field-unit">{{ unit }}</span>
    </span>
  </label>
</template>

<script setup lang="ts">
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
