<template>
  <Teleport to="body">
    <div class="modal" :class="{ 'modal-open': isOpen }">
      <div class="modal-box error-modal">
        <div class="error-head">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="error-icon"
            :class="iconClass"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" :d="iconPath" />
          </svg>
          <div class="error-head-text">
            <p class="sheet-label">提示</p>
            <h3 class="error-title" :class="titleClass">{{ title }}</h3>
          </div>
        </div>

        <p class="error-text">{{ message }}</p>

        <div v-if="details && (details.url || details.errorMessage)" class="error-details">
          <div v-if="details.errorMessage" class="error-block error-block-error">
            <span class="error-label">错误信息</span>
            <p class="error-value">{{ details.errorMessage }}</p>
          </div>

          <div v-if="details.url" class="error-block error-block-info">
            <span class="error-label">请求 URL（敏感参数已脱敏）</span>
            <p class="error-value readout">{{ details.url }}</p>
          </div>
        </div>

        <div class="modal-action">
          <button type="button" class="btn" :class="confirmButtonClass" @click="handleClose">
            {{ confirmButtonText }}
          </button>
          <button v-if="showCancel" type="button" class="btn btn-outline" @click="handleCancel">
            {{ cancelButtonText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface ErrorDialogDetails {
  url?: string
  errorMessage?: string
}

export interface ErrorDialogProps {
  isOpen: boolean
  type?: 'error' | 'warning' | 'success' | 'info'
  title?: string
  message?: string
  details?: ErrorDialogDetails
  confirmButtonText?: string
  cancelButtonText?: string
  showCancel?: boolean
}

const props = withDefaults(defineProps<ErrorDialogProps>(), {
  type: 'error',
  title: '操作失败',
  message: '发生了一个错误，请稍后重试',
  confirmButtonText: '确定',
  cancelButtonText: '取消',
  showCancel: false,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'cancel'): void
}>()

const iconClass = computed(() => {
  switch (props.type) {
    case 'error':
      return 'text-error'
    case 'warning':
      return 'text-warning'
    case 'success':
      return 'text-success'
    case 'info':
      return 'text-info'
    default:
      return 'text-error'
  }
})

const titleClass = computed(() => {
  switch (props.type) {
    case 'error':
      return 'text-error'
    case 'warning':
      return 'text-warning'
    case 'success':
      return 'text-success'
    case 'info':
      return 'text-info'
    default:
      return 'text-error'
  }
})

const iconPath = computed(() => {
  switch (props.type) {
    case 'error':
      return 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    case 'warning':
      return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z'
    case 'success':
      return 'M5 13l4 4L19 7'
    case 'info':
      return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    default:
      return 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  }
})

const confirmButtonClass = computed(() => {
  switch (props.type) {
    case 'error':
      return 'btn-error'
    case 'warning':
      return 'btn-warning'
    case 'success':
      return 'btn-success'
    case 'info':
      return 'btn-info'
    default:
      return 'btn-error'
  }
})

const handleClose = () => {
  emit('close')
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.error-modal {
  max-width: 36rem;
  padding: 1.25rem;
}

.error-head {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.error-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.error-head-text {
  min-width: 0;
}

.error-title {
  margin-top: 0.125rem;
  font-family: var(--font-drawing);
  font-size: 1.25rem;
  font-weight: 400;
  letter-spacing: 0.02em;
}

.error-text {
  margin-top: 0.75rem;
  font-size: 13px;
  color: color-mix(in oklab, var(--color-base-content) 70%, transparent);
}

.error-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.error-block {
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-base-300);
}

.error-block-error {
  background-color: color-mix(in oklab, var(--color-error) 8%, transparent);
  border-color: color-mix(in oklab, var(--color-error) 30%, transparent);
}

.error-block-info {
  background-color: color-mix(in oklab, var(--color-primary) 6%, transparent);
  border-color: color-mix(in oklab, var(--color-primary) 28%, transparent);
}

.error-label {
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.error-value {
  margin-top: 0.25rem;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
  color: var(--color-base-content);
}
</style>
