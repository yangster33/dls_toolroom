<template>
  <div v-if="validationResult" class="space-y-4">
    <div v-if="validationResult.isValid" class="flex items-center gap-2 text-success font-semibold">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      验证通过，共 {{ validationResult.data.length }} 条数据
    </div>
  </div>

  <div v-if="total > 0" class="space-y-4">
    <h2 class="text-xl font-semibold">查询结果预览</h2>
    <div class="overflow-x-auto">
      <table class="table table-zebra table-sm">
        <thead>
          <tr>
            <template v-if="mode === 'add'">
              <th>序号</th>
              <th>名称</th>
              <th>经度</th>
              <th>纬度</th>
            </template>
            <template v-else>
              <th>序号</th>
              <th>省</th>
              <th>市</th>
              <th>区/县</th>
              <th>乡/镇</th>
              <th>社区/村</th>
              <th>地址</th>
              <th>经度(WGS84)</th>
              <th>纬度(WGS84)</th>
            </template>
            <th v-for="field in selectedFields" :key="field">
              {{ fieldLabel(field) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- add 模式 -->
          <template v-if="mode === 'add'">
            <tr v-for="(result, index) in addResults.slice(0, 20)" :key="'add-' + index">
              <td>{{ index + 1 }}</td>
              <td>{{ result.name }}</td>
              <td>{{ result.longitude.toFixed(6) }}</td>
              <td>{{ result.latitude.toFixed(6) }}</td>
              <td v-for="field in selectedFields" :key="field">
                {{ addFieldValue(result, field) }}
              </td>
            </tr>
          </template>
          <!-- lonlat 模式 -->
          <template v-else>
            <tr v-for="(result, index) in lonlatResults.slice(0, 20)" :key="'ll-' + index">
              <td>{{ index + 1 }}</td>
              <td>{{ result.province }}</td>
              <td>{{ result.city }}</td>
              <td>{{ result.district }}</td>
              <td>{{ result.township }}</td>
              <td>{{ result.community }}</td>
              <td>{{ result.address }}</td>
              <td :class="!result.inBounds && enableBounds ? 'text-error' : ''">
                {{ result.longitude.toFixed(6) }}
              </td>
              <td :class="!result.inBounds && enableBounds ? 'text-error' : ''">
                {{ result.latitude.toFixed(6) }}
              </td>
              <td v-for="field in selectedFields" :key="field">
                {{ lonlatFieldValue(result, field) }}
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <div v-if="total > 20" class="text-center text-gray-500 py-2">
        ... 还有 {{ total - 20 }} 行未显示
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getAvailableFields as getAddFields } from '@/tools/get_add/ApiService'
import { getAvailableFields as getLonLatFields } from '@/tools/get_lonlat/ApiService'
import type { QueryResult as AddQueryResult } from '@/tools/get_add/ApiService'
import type { QueryResult as LonLatQueryResult } from '@/tools/get_lonlat/ApiService'
import { findFieldLabel, getAddFieldValue, getLonLatFieldValue } from './geocodeFields'
import type { GeocodeMode, GeocodeValidation } from './geocodeTypes'

const props = defineProps<{
  mode: GeocodeMode
  validationResult: GeocodeValidation | null
  addResults: AddQueryResult[]
  lonlatResults: LonLatQueryResult[]
  selectedFields: string[]
  enableBounds: boolean
}>()

const availableFields = props.mode === 'add' ? getAddFields() : getLonLatFields()

const fieldLabel = (field: string) => findFieldLabel(availableFields, field)
const addFieldValue = (result: AddQueryResult, field: string) => getAddFieldValue(result, field)
const lonlatFieldValue = (result: LonLatQueryResult, field: string) =>
  getLonLatFieldValue(result, field)

const total = computed(() =>
  props.mode === 'add' ? props.addResults.length : props.lonlatResults.length,
)
</script>
