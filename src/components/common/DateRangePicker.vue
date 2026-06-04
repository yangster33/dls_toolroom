<template>
  <div class="flex flex-col gap-1">
    <label v-if="label" class="label">
      <span class="label-text font-semibold">{{ label }}</span>
    </label>
    <div class="flex flex-col sm:flex-row gap-2 items-start">
      <div class="flex-1 w-full">
        <label class="label py-0">
          <span class="label-text-alt">{{ startLabel }}</span>
        </label>
        <VueDatePicker
          v-model="startDateModel"
          :enable-time-picker="false"
          :min-date="minDate"
          format="YYYY-MM-DD"
          :clearable="false"
          :teleport="true"
          placeholder="选择开始日期"
          menu-class-name="dp-custom-menu"
        />
      </div>
      <div class="flex items-end pb-1">
        <span class="text-base-content/50">至</span>
      </div>
      <div class="flex-1 w-full">
        <label class="label py-0">
          <span class="label-text-alt">{{ endLabel }}</span>
        </label>
        <VueDatePicker
          v-model="endDateModel"
          :enable-time-picker="false"
          :min-date="startDateModel || minDate"
          :max-date="maxDate"
          format="YYYY-MM-DD"
          :clearable="false"
          :teleport="true"
          placeholder="选择结束日期"
          menu-class-name="dp-custom-menu"
        />
      </div>
    </div>
    <div v-if="validationMessage" class="text-error text-sm mt-1">
      {{ validationMessage }}
    </div>
    <div v-else-if="daysDiff !== null" class="text-base-content/60 text-sm mt-1">
      已选择 {{ daysDiff }} 天
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'

interface Props {
  modelValue?: { start: string; end: string }
  label?: string
  startLabel?: string
  endLabel?: string
  maxRange?: number
  minRange?: number
}

interface DateRange {
  start: string
  end: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({ start: '', end: '' }),
  label: '日期范围',
  startLabel: '开始日期',
  endLabel: '结束日期',
  maxRange: 365,
  minRange: 1,
})

const emit = defineEmits<{
  'update:modelValue': [value: DateRange]
}>()

const today = new Date()
const maxDate = today
const minDate = new Date('1940-01-01')

const startDateModel = ref<Date | null>(null)
const endDateModel = ref<Date | null>(null)



const daysDiff = computed(() => {
  if (!startDateModel.value || !endDateModel.value) return null
  const diffTime = endDateModel.value.getTime() - startDateModel.value.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  return diffDays > 0 ? diffDays : null
})

const validationMessage = computed(() => {
  if (!startDateModel.value || !endDateModel.value) return ''

  if (startDateModel.value > endDateModel.value) {
    return '起始日期不能大于结束日期'
  }

  if (daysDiff.value !== null) {
    if (daysDiff.value > props.maxRange) {
      return `日期范围不能超过 ${props.maxRange} 天`
    }
    if (daysDiff.value < props.minRange) {
      return `日期范围不能少于 ${props.minRange} 天`
    }
  }

  return ''
})

const formatDate = (date: Date | null): string => {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
}

watch(startDateModel, (newVal) => {
  if (endDateModel.value && newVal && newVal > endDateModel.value) {
    endDateModel.value = newVal
  }
  emitUpdate()
})

watch(endDateModel, (newVal) => {
  if (newVal) {
    const diffTime = newVal.getTime() - (startDateModel.value?.getTime() || 0)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    if (diffDays > props.maxRange && startDateModel.value) {
      const newStart = new Date(newVal)
      newStart.setDate(newStart.getDate() - props.maxRange + 1)
      startDateModel.value = newStart
    }
  }
  emitUpdate()
})

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    startDateModel.value = parseDate(newVal.start)
    endDateModel.value = parseDate(newVal.end)
  }
}, { immediate: true })

const emitUpdate = () => {
  const value: DateRange = {
    start: formatDate(startDateModel.value),
    end: formatDate(endDateModel.value),
  }
  emit('update:modelValue', value)
}
</script>


