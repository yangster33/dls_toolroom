<template>
  <div>
    <h2 class="text-xl font-semibold mb-4">4. 输出字段选择</h2>
    <div class="flex flex-wrap gap-3">
      <label
        v-for="field in availableFields"
        :key="field.value"
        class="flex items-center gap-2 cursor-pointer"
      >
        <input
          type="checkbox"
          :checked="currentConfig.selectedFields.includes(field.value)"
          @change="toggleSelectedField(field.value)"
          class="checkbox checkbox-primary"
        />
        <span class="text-sm">{{ field.label }}</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGeocodeStore } from '@/stores/geocodeStore'
import { getAvailableFields as getAddFields } from '@/tools/get_add/ApiService'
import { getAvailableFields as getLonLatFields } from '@/tools/get_lonlat/ApiService'
import type { GeocodeMode } from './geocodeTypes'

const props = defineProps<{
  mode: GeocodeMode
}>()

const store = useGeocodeStore()
const currentConfig = computed(() => (props.mode === 'add' ? store.addConfig : store.lonlatConfig))

const availableFields = props.mode === 'add' ? getAddFields() : getLonLatFields()

const toggleSelectedField = (field: string) => {
  const fields = [...currentConfig.value.selectedFields]
  const index = fields.indexOf(field)
  if (index > -1) {
    fields.splice(index, 1)
  } else {
    fields.push(field)
  }
  store.updateSelectedFields(props.mode, fields)
}
</script>
