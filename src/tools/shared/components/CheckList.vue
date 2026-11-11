<template>
  <div class="panel check-panel">
    <div class="panel-head compact">
      <span class="panel-no">✓</span>
      <h2>{{ title }}</h2>
      <span class="panel-hint">{{ hint }}</span>
    </div>

    <div class="check-list">
      <details
        v-for="check in details"
        :key="check.key"
        class="check-item"
        :class="{ 'is-fail': !check.pass }"
      >
        <summary class="check-item-head">
          <span class="check-item-label">{{ check.label }}</span>
          <span class="check-item-key">{{ check.keyValue }}</span>
          <span v-if="check.controlling" class="check-item-flag">控制</span>
          <span class="check-status" :class="check.pass ? 'is-pass' : 'is-fail'">
            {{ check.pass ? '通过' : '不通过' }}
          </span>
        </summary>

        <div class="check-item-body">
          <p class="check-formula">{{ check.formula }}</p>
          <p class="check-substitution">{{ check.substitution }}</p>
          <p class="check-line">
            <span class="check-line-label">要求</span>{{ check.required }}
          </p>
          <p class="check-line">
            <span class="check-line-label">实际</span>{{ check.actual }}
          </p>
          <p class="check-line">
            <span class="check-line-label">裕度</span>{{ check.margin }}
          </p>

          <div v-if="check.symbols.length" class="calc-symbols">
            <SymbolChip
              v-for="symbol in check.symbols"
              :key="`${check.key}-${symbol.symbol}`"
              :symbol="symbol"
              :active="chipActive(symbol)"
              @activate="(item) => emit('activate', item)"
              @deactivate="emit('deactivate')"
            />
          </div>

          <p class="check-why">{{ check.why }}</p>
          <button
            v-if="check.stepKey"
            type="button"
            class="check-link"
            @click="emit('open-step', check.stepKey)"
          >
            查看计算书 {{ check.stepLabel }}
          </button>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CalcSymbol, CheckDetail } from '../calcTrace'
import SymbolChip from './SymbolChip.vue'

const props = withDefaults(
  defineProps<{
    details: ReadonlyArray<CheckDetail>
    activeSymbol?: string
    title?: string
    hint?: string
  }>(),
  { activeSymbol: '', title: '校核明细', hint: '取最大约束' },
)

const emit = defineEmits<{
  activate: [symbol: CalcSymbol]
  deactivate: []
  'open-step': [key: string]
}>()

function chipActive(symbol: CalcSymbol): boolean {
  return (
    props.activeSymbol === symbol.symbol ||
    (symbol.inputSymbol !== undefined && props.activeSymbol === symbol.inputSymbol)
  )
}
</script>
