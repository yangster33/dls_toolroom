<!--
  光缆 12 色纤序入口。
  颜色是编码，不是装饰——顺序固定、边缘锐利、不做动画。
  点击进入「关于」页，那里有完整的色序说明。
-->
<template>
  <router-link
    to="/about#fiber-colors"
    class="fiber-strip"
    aria-label="光缆 12 色纤序，点击查看说明"
  >
    <span
      v-for="fiber in fiberColors"
      :key="fiber.index"
      class="fiber-segment"
      :class="{ 'fiber-segment-light': fiber.light }"
      :style="{ backgroundColor: fiber.hex }"
    ></span>
  </router-link>
</template>

<script setup lang="ts">
import { fiberColors } from '@/data/fiberColors'
</script>

<style scoped>
.fiber-strip {
  display: flex;
  width: 100%;
  height: 6px;
}

.fiber-strip:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.fiber-segment {
  flex: 1;
  height: 100%;
}

.fiber-segment-light {
  box-shadow: inset 0 0 0 1px color-mix(in oklab, #6b7280 60%, transparent);
}
</style>
