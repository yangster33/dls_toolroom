<template>
  <div class="skeleton" :class="[variantClass, customClass]" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'text' | 'card' | 'circle' | 'rect'
    width?: string
    height?: string
    customClass?: string
  }>(),
  {
    variant: 'text',
  },
)

const variantClass = computed(() => {
  const map: Record<string, string> = {
    text: 'h-4 w-full rounded',
    card: 'h-32 w-full rounded-lg',
    circle: 'rounded-full',
    rect: 'rounded',
  }
  return map[props.variant] || map.text
})

const inlineStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.width) style.width = props.width
  if (props.height) style.height = props.height
  return style
})
</script>

<style scoped>
.skeleton {
  background: linear-gradient(
    90deg,
    var(--fallback-b2, oklch(0.95 0 0)) 25%,
    var(--fallback-b3, oklch(0.9 0 0)) 50%,
    var(--fallback-b2, oklch(0.95 0 0)) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
