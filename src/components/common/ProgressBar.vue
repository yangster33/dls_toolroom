<template>
  <div v-if="visible" class="progress-bar" :class="{ 'progress-done': done }">
    <div class="progress-bar-inner" />
  </div>
</template>

<script setup lang="ts">
import { useProgressState } from '@/composables/useProgress'

const { visible, done } = useProgressState()
</script>

<style scoped>
.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;
  height: 2px;
  background: transparent;
  overflow: hidden;
}

.progress-bar-inner {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, oklch(0.55 0.2 260), oklch(0.65 0.2 200));
  transform-origin: left;
  animation: progress-indeterminate 1.2s ease-in-out infinite;
}

.progress-done .progress-bar-inner {
  animation: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}
</style>
