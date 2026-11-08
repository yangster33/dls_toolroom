<template>
  <div>
    <h2 class="text-xl font-semibold mb-4">2. API Key 配置</h2>

    <div class="space-y-3">
      <div
        v-for="(keyInfo, index) in currentConfig.apiKeys"
        :key="keyInfo.id"
        class="flex items-center gap-3"
      >
        <div class="w-32">
          <div class="select select-bordered w-full cursor-default bg-gray-100">
            <span class="text-gray-700">高德地图</span>
          </div>
        </div>

        <div class="flex-1">
          <div class="relative">
            <input
              :value="keyInfo.key"
              @input="updateApiKeyValue(index, ($event.target as HTMLInputElement).value)"
              type="text"
              placeholder="输入高德地图API Key"
              class="input input-bordered w-full pr-24"
              @blur="$emit('validate', index)"
              :class="{
                'border-success': keyInfo.isValid,
                'border-error': keyInfo.key && !keyInfo.isValid && !keyInfo.validating,
              }"
            />
            <span
              v-if="keyInfo.isValid"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-success"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </span>
            <span
              v-else-if="keyInfo.key && !keyInfo.validating"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-error"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
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
            </span>
            <span v-else-if="keyInfo.validating" class="absolute right-3 top-1/2 -translate-y-1/2">
              <span class="loading loading-spinner loading-sm"></span>
            </span>
          </div>
        </div>

        <button
          v-if="currentConfig.apiKeys.length > 1"
          @click="removeApiKey(index)"
          class="btn btn-error btn-xs"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
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
        </button>
      </div>

      <button @click="addApiKey" class="btn btn-outline btn-sm">
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
            d="M12 4v16m8-8H4"
          />
        </svg>
        添加API Key
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGeocodeStore } from '@/stores/geocodeStore'
import type { GeocodeMode } from './geocodeTypes'

const props = defineProps<{
  mode: GeocodeMode
}>()

defineEmits<{
  validate: [index: number]
}>()

const store = useGeocodeStore()
const currentConfig = computed(() => (props.mode === 'add' ? store.addConfig : store.lonlatConfig))

const addApiKey = () => {
  store.addApiKey(props.mode)
}

const removeApiKey = (index: number) => {
  store.removeApiKey(props.mode, index)
}

const updateApiKeyValue = (index: number, value: string) => {
  store.updateApiKey(props.mode, index, { key: value })
}
</script>
