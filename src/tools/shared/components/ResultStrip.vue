<template>
  <div class="result-strip">
    <span class="strip-section">{{ value }}{{ unit ? ` ${unit}` : '' }}</span>
    <span v-if="badge" class="strip-mode">{{ badge }}</span>
    <span class="check-status" :class="pass ? 'is-pass' : 'is-fail'">
      {{ pass ? 'PASS' : 'REVIEW' }}
    </span>
    <span class="strip-driver">由 {{ drivers.join(' / ') }} 控制</span>
    <a class="strip-link" :href="href">跳到结论 ↓</a>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 主结果，如 "16" 或 "250" */
    value: string | number
    unit?: string
    /** 模式徽标，如 "简易" */
    badge?: string
    pass: boolean
    drivers: ReadonlyArray<string>
    href?: string
  }>(),
  { unit: '', badge: '', href: '#verdict' },
)
</script>
