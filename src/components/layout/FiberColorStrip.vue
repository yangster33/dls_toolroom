<!--
  光缆 12 色纤序速查条。
  颜色是编码，不是装饰——顺序固定、边缘锐利、不做动画。
  悬停或键盘聚焦时展开色序图例。
-->
<template>
  <div
    class="fiber-strip"
    tabindex="0"
    role="img"
    aria-label="光缆 12 色纤序：蓝、橙、绿、棕、灰、白、红、黑、黄、紫、粉、青"
  >
    <span
      v-for="fiber in fiberColors"
      :key="fiber.index"
      class="fiber-segment"
      :class="{ 'fiber-segment-light': fiber.light }"
      :style="{ backgroundColor: fiber.hex }"
      :title="`第 ${fiber.index} 芯 · ${fiber.name}`"
    ></span>

    <div class="fiber-legend" aria-hidden="true">
      <div v-for="fiber in fiberColors" :key="fiber.index" class="fiber-legend-item">
        <span
          class="fiber-legend-swatch"
          :class="{ 'fiber-segment-light': fiber.light }"
          :style="{ backgroundColor: fiber.hex }"
        ></span>
        <span class="fiber-legend-index readout">{{ String(fiber.index).padStart(2, '0') }}</span>
        <span class="fiber-legend-name">{{ fiber.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fiberColors } from '@/data/fiberColors'
</script>

<style scoped>
.fiber-strip {
  position: relative;
  display: flex;
  width: 100%;
  height: 6px;
  outline-offset: 0;
}

.fiber-segment {
  flex: 1;
  height: 100%;
}

.fiber-segment-light {
  box-shadow: inset 0 0 0 1px color-mix(in oklab, #6b7280 60%, transparent);
}

.fiber-legend {
  position: absolute;
  top: calc(100% + 1px);
  right: 0;
  z-index: 60;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px 12px;
  width: 280px;
  padding: 10px 12px;
  background-color: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    visibility 0.15s;
  pointer-events: none;
}

.fiber-strip:hover .fiber-legend,
.fiber-strip:focus-within .fiber-legend {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.fiber-legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
}

.fiber-legend-swatch {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
}

.fiber-legend-index {
  font-size: 10px;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
}

.fiber-legend-name {
  color: var(--color-base-content);
}
</style>
