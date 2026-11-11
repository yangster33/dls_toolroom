<template>
  <button
    type="button"
    class="symbol-chip"
    :class="{ 'is-symbol-active': active }"
    :data-symbol="symbol.inputSymbol"
    :title="sourceTitle(symbol)"
    @mouseenter="emit('activate', symbol)"
    @mouseleave="emit('deactivate')"
    @focus="emit('activate', symbol)"
    @blur="emit('deactivate')"
  >
    <span class="symbol-name">{{ symbol.symbol }}</span>
    <span class="symbol-value">{{ symbol.value }}{{ symbol.unit ? ` ${symbol.unit}` : '' }}</span>
    <span class="symbol-label">{{ symbol.name }}</span>
    <span class="symbol-source" :class="`is-${symbol.source}`">
      {{ sourceLabel(symbol.source) }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { sourceLabel, sourceTitle, type CalcSymbol } from '../calcTrace'

withDefaults(
  defineProps<{
    symbol: CalcSymbol
    active?: boolean
  }>(),
  { active: false },
)

const emit = defineEmits<{
  activate: [symbol: CalcSymbol]
  deactivate: []
}>()
</script>
