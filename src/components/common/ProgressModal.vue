<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal modal-open">
      <div class="modal-box progress-modal">
        <p class="sheet-label">处理进度</p>
        <h3 class="progress-title">{{ title }}</h3>

        <div class="progress-meta">
          <span class="progress-message">{{ message }}</span>
          <span class="progress-percent readout">{{ percent }}%</span>
        </div>

        <progress
          class="progress progress-primary progress-bar"
          :value="percent"
          max="100"
        ></progress>
        <p class="progress-hint readout">预计剩余 {{ remainingTime }}</p>

        <div v-if="showCancel" class="modal-action">
          <button type="button" class="btn btn-error btn-sm" @click="$emit('cancel')">
            终止计算
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    isOpen: boolean
    title?: string
    percent?: number
    message?: string
    remainingTime?: string
    showCancel?: boolean
  }>(),
  {
    title: '处理中…',
    percent: 0,
    message: '',
    remainingTime: '--',
    showCancel: true,
  },
)

defineEmits<{
  cancel: []
}>()
</script>

<style scoped>
.progress-modal {
  width: 24rem;
  max-width: calc(100vw - 2rem);
  padding: 1.25rem;
}

.progress-title {
  margin-top: 0.125rem;
  font-family: var(--font-drawing);
  font-size: 1.25rem;
  font-weight: 400;
  letter-spacing: 0.02em;
}

.progress-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin: 1rem 0 0.5rem;
  font-size: 12px;
}

.progress-message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: color-mix(in oklab, var(--color-base-content) 65%, transparent);
}

.progress-percent {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--color-primary);
}

.progress-bar {
  height: 4px;
  border-radius: 0;
}

.progress-hint {
  margin-top: 0.5rem;
  font-size: 11px;
  text-align: right;
  color: var(--text-faint);
}

.modal-action {
  margin-top: 1rem;
}
</style>
