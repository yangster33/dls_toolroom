<template>
  <div>
    <h2 class="text-xl font-semibold mb-4">3. 查询参数设置</h2>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <label class="label">
          <span class="label-text font-semibold">请求延迟（毫秒）</span>
        </label>
        <input
          :value="currentConfig.queryOptions.delay"
          @input="updateQueryOption('delay', Number(($event.target as HTMLInputElement).value))"
          type="number"
          min="0"
          placeholder="请求间隔"
          class="input input-bordered w-full"
        />
      </div>

      <div>
        <label class="label">
          <span class="label-text font-semibold">混合查询模式</span>
        </label>
        <button
          @click="toggleQueryOption('mixedMode')"
          class="btn w-full"
          :class="currentConfig.queryOptions.mixedMode ? 'btn-success' : 'btn-outline'"
        >
          {{ currentConfig.queryOptions.mixedMode ? '开启' : '关闭' }}
        </button>
        <label class="label">
          <span class="label-text-alt text-gray-500">多Key轮询</span>
        </label>
      </div>

      <div>
        <label class="label">
          <span class="label-text font-semibold">随机延迟</span>
        </label>
        <button
          @click="toggleQueryOption('randomDelay')"
          class="btn w-full"
          :class="currentConfig.queryOptions.randomDelay ? 'btn-success' : 'btn-outline'"
        >
          {{ currentConfig.queryOptions.randomDelay ? '开启' : '关闭' }}
        </button>
      </div>

      <div v-if="currentConfig.queryOptions.randomDelay">
        <label class="label">
          <span class="label-text font-semibold">随机延迟范围（毫秒）</span>
        </label>
        <div class="flex gap-2">
          <input
            :value="currentConfig.queryOptions.minRandomDelay"
            @input="
              updateQueryOption('minRandomDelay', Number(($event.target as HTMLInputElement).value))
            "
            type="number"
            min="0"
            placeholder="最小"
            class="input input-bordered flex-1"
          />
          <span class="self-center">~</span>
          <input
            :value="currentConfig.queryOptions.maxRandomDelay"
            @input="
              updateQueryOption('maxRandomDelay', Number(($event.target as HTMLInputElement).value))
            "
            type="number"
            min="0"
            placeholder="最大"
            class="input input-bordered flex-1"
          />
        </div>
      </div>
    </div>

    <div v-if="mode === 'lonlat'" class="mt-4">
      <label class="label flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          :checked="currentConfig.enableBounds"
          @change="toggleEnableBounds"
          class="checkbox checkbox-primary"
        />
        <span class="label-text font-semibold">启用区域约束（WGS84）</span>
      </label>

      <div v-if="currentConfig.enableBounds" class="mt-2 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="label">
              <span class="label-text">西南角（左下角）</span>
            </label>
            <div class="flex gap-2">
              <input
                :value="currentConfig.bounds.southwest.lng"
                @input="updateBoundsSwLng(Number(($event.target as HTMLInputElement).value))"
                type="number"
                step="0.000001"
                placeholder="经度"
                class="input input-bordered flex-1"
              />
              <input
                :value="currentConfig.bounds.southwest.lat"
                @input="updateBoundsSwLat(Number(($event.target as HTMLInputElement).value))"
                type="number"
                step="0.000001"
                placeholder="纬度"
                class="input input-bordered flex-1"
              />
            </div>
          </div>
          <div>
            <label class="label">
              <span class="label-text">东北角（右上角）</span>
            </label>
            <div class="flex gap-2">
              <input
                :value="currentConfig.bounds.northeast.lng"
                @input="updateBoundsNeLng(Number(($event.target as HTMLInputElement).value))"
                type="number"
                step="0.000001"
                placeholder="经度"
                class="input input-bordered flex-1"
              />
              <input
                :value="currentConfig.bounds.northeast.lat"
                @input="updateBoundsNeLat(Number(($event.target as HTMLInputElement).value))"
                type="number"
                step="0.000001"
                placeholder="纬度"
                class="input input-bordered flex-1"
              />
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <button @click="clearBounds" class="btn btn-outline btn-sm">清除区域</button>
          <button @click="resetBounds" class="btn btn-outline btn-sm">重置为北京区域</button>
        </div>

        <p class="text-xs text-gray-500">
          提示：输入WGS84坐标范围，查询结果将标注是否在此区域内。经度范围：-180~180，纬度范围：-90~90
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGeocodeStore, type QueryOptions } from '@/stores/geocodeStore'
import type { GeocodeMode } from './geocodeTypes'

const props = defineProps<{
  mode: GeocodeMode
}>()

const store = useGeocodeStore()
const currentConfig = computed(() => (props.mode === 'add' ? store.addConfig : store.lonlatConfig))

const updateQueryOption = (key: keyof QueryOptions, value: number) => {
  store.updateQueryOptions(props.mode, { [key]: value } as Partial<QueryOptions>)
}

const toggleQueryOption = (key: keyof QueryOptions) => {
  const currentValue = currentConfig.value.queryOptions[key] as boolean
  store.updateQueryOptions(props.mode, { [key]: !currentValue } as Partial<QueryOptions>)
}

const toggleEnableBounds = () => {
  store.updateEnableBounds(props.mode, !currentConfig.value.enableBounds)
}

const updateBoundsSwLng = (value: number) => {
  store.updateBounds(props.mode, {
    ...currentConfig.value.bounds,
    southwest: { ...currentConfig.value.bounds.southwest, lng: value },
  })
}

const updateBoundsSwLat = (value: number) => {
  store.updateBounds(props.mode, {
    ...currentConfig.value.bounds,
    southwest: { ...currentConfig.value.bounds.southwest, lat: value },
  })
}

const updateBoundsNeLng = (value: number) => {
  store.updateBounds(props.mode, {
    ...currentConfig.value.bounds,
    northeast: { ...currentConfig.value.bounds.northeast, lng: value },
  })
}

const updateBoundsNeLat = (value: number) => {
  store.updateBounds(props.mode, {
    ...currentConfig.value.bounds,
    northeast: { ...currentConfig.value.bounds.northeast, lat: value },
  })
}

const clearBounds = () => {
  store.updateBounds(props.mode, {
    southwest: { lng: 0, lat: 0 },
    northeast: { lng: 0, lat: 0 },
  })
}

const resetBounds = () => {
  store.updateBounds(props.mode, {
    southwest: { lng: 116.0, lat: 39.6 },
    northeast: { lng: 116.8, lat: 40.2 },
  })
}
</script>
