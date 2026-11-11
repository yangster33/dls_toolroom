<template>
  <details ref="panelRef" class="panel calc-panel">
    <summary>{{ summaryText }}</summary>

    <div class="calc-book">
      <p v-if="modeNote" class="calc-mode-note">{{ modeNote }}</p>
      <details
        v-for="step in steps"
        :id="`calc-${step.key}`"
        :key="step.key"
        class="calc-step"
        :class="{ 'is-fail': step.pass === false }"
      >
        <summary class="calc-step-head">
          <span class="calc-step-no">{{ step.index }}</span>
          <span class="calc-step-title">{{ step.title }}</span>
          <span class="calc-step-key">{{ step.keyValue }}</span>
          <span v-if="step.controlling" class="calc-step-flag">控制</span>
          <span
            v-if="step.pass !== undefined"
            class="check-status"
            :class="step.pass ? 'is-pass' : 'is-fail'"
          >
            {{ step.pass ? '通过' : '不通过' }}
          </span>
        </summary>

        <div class="calc-step-body">
          <p class="calc-formula">{{ step.formula }}</p>
          <p class="calc-substitution">{{ step.substitution }}</p>
          <p class="calc-result">{{ step.result }}</p>

          <div v-if="step.symbols.length" class="calc-symbols">
            <SymbolChip
              v-for="symbol in step.symbols"
              :key="`${step.key}-${symbol.symbol}`"
              :symbol="symbol"
              :active="chipActive(symbol)"
              @activate="(item) => emit('activate', item)"
              @deactivate="emit('deactivate')"
            />
          </div>

          <p v-if="step.note" class="calc-step-note">{{ step.note }}</p>
        </div>
      </details>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { CalcStep, CalcSymbol } from '../calcTrace'
import SymbolChip from './SymbolChip.vue'

const props = withDefaults(
  defineProps<{
    steps: ReadonlyArray<CalcStep>
    modeNote?: string
    /** 当前高亮的符号名，用于 chip 联动 */
    activeSymbol?: string
  }>(),
  { modeNote: '', activeSymbol: '' },
)

const emit = defineEmits<{
  activate: [symbol: CalcSymbol]
  deactivate: []
}>()

const panelRef = ref<HTMLDetailsElement | null>(null)

const summaryText = computed(() => `计算书（${props.steps.length} 步，点击展开）`)

function chipActive(symbol: CalcSymbol): boolean {
  return (
    props.activeSymbol === symbol.symbol ||
    (symbol.inputSymbol !== undefined && props.activeSymbol === symbol.inputSymbol)
  )
}

/** 展开计算书并定位到指定步骤：供校核卡“查看计算书”调用。 */
function openStep(key: string) {
  if (panelRef.value) panelRef.value.open = true
  nextTick(() => {
    const target = document.getElementById(`calc-${key}`)
    if (target instanceof HTMLDetailsElement) target.open = true
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

defineExpose({ openStep })
</script>
