<template>
  <Teleport to="body">
    <div class="modal" :class="{ 'modal-open': isOpen }">
      <div class="modal-box max-w-2xl">
        <div class="flex items-center gap-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-12 w-12"
            :class="iconClass"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              :d="iconPath"
            />
          </svg>
          <div>
            <h3 class="text-xl font-bold" :class="titleClass">{{ title }}</h3>
            <p class="text-gray-500 mt-1">{{ message }}</p>
          </div>
        </div>

        <div v-if="details && (details.url || details.errorMessage)" class="mt-4 space-y-3">
          <div v-if="details.errorMessage" class="p-3 bg-red-50 rounded-lg">
            <span class="text-sm font-medium text-error">错误信息:</span>
            <p class="text-sm text-gray-600 mt-1">{{ details.errorMessage }}</p>
          </div>

          <div v-if="details.url" class="p-3 bg-blue-50 rounded-lg">
            <span class="text-sm font-medium text-blue-600">请求URL:</span>
            <p class="text-xs text-gray-600 mt-1 break-all font-mono">{{ details.url }}</p>
          </div>

          <p v-if="details.url" class="text-xs text-gray-400">
            提示：您可以复制上面的URL到浏览器中直接访问，查看详细的错误信息。
          </p>
        </div>

        <div class="modal-action mt-4">
          <button @click="handleClose" class="btn" :class="confirmButtonClass">
            {{ confirmButtonText }}
          </button>
          <button
            v-if="showCancel"
            @click="handleCancel"
            class="btn btn-outline"
          >
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
