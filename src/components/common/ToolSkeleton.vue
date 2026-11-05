<template>
  <div class="tool-skeleton">
    <div class="sk-line sk-title"></div>
    <div class="sk-line sk-sub"></div>
    <div class="sk-panel"></div>
  </div>
</template>

<style scoped>
.tool-skeleton {
  padding: 1.5rem;
}

.sk-line,
.sk-panel {
  background-color: var(--color-base-200);
  animation: sk-pulse 1.4s ease-in-out infinite;
}

.sk-title {
  width: 12rem;
  height: 22px;
}

.sk-sub {
  width: 22rem;
  max-width: 100%;
  height: 12px;
  margin-top: 0.75rem;
}

.sk-panel {
  height: 16rem;
  margin-top: 1.5rem;
  border: 1px solid var(--color-base-300);
  background-color: var(--color-base-100);
}

@keyframes sk-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
</style>
