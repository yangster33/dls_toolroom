<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal modal-open">
      <div class="modal-box w-96">
        <h3 class="font-bold text-lg mb-4">{{ title }}</h3>
        <div class="space-y-4">
          <div class="flex justify-between text-sm">
            <span>{{ message }}</span>
            <span class="font-mono font-bold">{{ percent }}%</span>
          </div>
          <div>
            <progress
              class="progress progress-primary w-full"
              :value="percent"
              max="100"
            ></progress>
            <div class="text-xs text-base-content/50 mt-1 text-right">
              预计剩余: {{ remainingTime }}
            </div>
          </div>
          <div class="modal-action">
            <button
              v-if="showCancel"
              @click="$emit('cancel')"
              class="btn btn-error btn-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              终止计算
            </button>
          </div>
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
    title: '处理中...',
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
