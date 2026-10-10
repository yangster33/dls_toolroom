<template>
  <div class="space-y-6">
    <!-- 1. 输入坐标 -->
    <div>
      <h2 class="text-xl font-semibold mb-4">1. 输入坐标</h2>
      <div class="join join-vertical w-full">
        <div class="join-item p-2">
          <div class="join join-horizontal w-full items-center gap-2">
            <select
              v-model="currentRow.coordinateSystem"
              class="select select-bordered select-sm w-28 flex-shrink-0"
            >
              <option disabled value="">请选择</option>
              <option value="wgs84">WGS84</option>
              <option value="gcj02">GCJ-02</option>
              <option value="bd09">百度 BD-09</option>
              <option value="amap">高德地图</option>
              <option value="cgcs2000_lnglat">CGCS2000（经纬度）</option>
              <option value="cgcs2000_xy">CGCS2000（平面坐标）</option>
            </select>

            <input
              v-model="currentRow.x"
              type="text"
              placeholder="X / 经度"
              class="input input-bordered input-sm flex-grow"
            />
            <input
              v-model="currentRow.y"
              type="text"
              placeholder="Y / 纬度"
              class="input input-bordered input-sm flex-grow"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 2. 设置转换参数 -->
    <div>
      <h2 class="text-xl font-semibold mb-4">2. 设置转换参数</h2>
      <div class="collapse collapse-arrow bg-base-200 border-base-300 border">
        <input type="checkbox" />
        <div class="collapse-title font-semibold">CGCS2000 投影参数（按需求填写，选填）</div>
        <div class="collapse-content">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 pt-2">
            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium">中央子午线经度</span>
              <input
                v-model.number="cgcs2000Params.centralMeridian"
                type="number"
                step="0.1"
                class="input input-bordered input-sm w-full"
              />
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium">分带度数</span>
              <select
                v-model.number="cgcs2000Params.zoneWidth"
                class="select select-bordered select-sm w-full"
              >
                <option :value="3">3 度带</option>
                <option :value="6">6 度带</option>
              </select>
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium">计算后的中央子午线</span>
              <input
                :value="computedCM"
                type="text"
                readonly
                class="input input-bordered input-sm w-full bg-base-300"
              />
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium">假东偏移（米）</span>
              <input
                v-model.number="cgcs2000Params.falseEasting"
                type="number"
                class="input input-bordered input-sm w-full"
              />
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium">假北偏移（米）</span>
              <input
                v-model.number="cgcs2000Params.falseNorthing"
                type="number"
                class="input input-bordered input-sm w-full"
              />
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium">比例因子</span>
              <input
                v-model.number="cgcs2000Params.scaleFactor"
                type="number"
                step="0.0001"
                class="input input-bordered input-sm w-full"
              />
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium">原点纬度</span>
              <input
                v-model.number="cgcs2000Params.originLatitude"
                type="number"
                step="0.1"
                class="input input-bordered input-sm w-full"
              />
            </label>
          </div>
        </div>
        <p v-if="cgcsParamError" class="text-error text-sm mt-2">
          ⚠ {{ cgcsParamError }}（CGCS2000 相关转换已暂停，修正后自动恢复）
        </p>
      </div>
    </div>

    <!-- 3. 查看转换结果 -->
    <div v-if="conversionResults" class="space-y-4">
      <h2 class="text-xl font-semibold">3. 转换结果</h2>
      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th>坐标系</th>
              <th>X / 经度</th>
              <th>Y / 纬度</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>WGS84</td>
              <td>{{ fmt(conversionResults.wgs84.lng) }}</td>
              <td>{{ fmt(conversionResults.wgs84.lat) }}</td>
            </tr>
            <tr>
              <td>GCJ-02</td>
              <td>{{ fmt(conversionResults.gcj02.lng) }}</td>
              <td>{{ fmt(conversionResults.gcj02.lat) }}</td>
            </tr>
            <tr>
              <td>百度 BD-09</td>
              <td>{{ fmt(conversionResults.bd09.lng) }}</td>
              <td>{{ fmt(conversionResults.bd09.lat) }}</td>
            </tr>
            <tr>
              <td>高德地图</td>
              <td>{{ fmt(conversionResults.amap.lng) }}</td>
              <td>{{ fmt(conversionResults.amap.lat) }}</td>
            </tr>
            <tr>
              <td>CGCS2000（经纬度）</td>
              <td>{{ fmt(conversionResults.cgcs2000_lnglat.lng) }}</td>
              <td>{{ fmt(conversionResults.cgcs2000_lnglat.lat) }}</td>
            </tr>
            <tr>
              <td>CGCS2000（平面坐标）</td>
              <td>{{ fmt(conversionResults.cgcs2000_xy.x) }}</td>
              <td>{{ fmt(conversionResults.cgcs2000_xy.y) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else class="text-center text-gray-500 py-8">
      <template v-if="cgcsParamError">{{ cgcsParamError }}</template>
      <template v-else>请输入有效的坐标以查看转换结果</template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import {
  type CoordinateSystemType,
  type AllConversionResults,
  type CGCS2000Params,
  DEFAULT_CGCS2000_PARAMS,
  computeCentralMeridian,
  convertAll,
  validateCGCS2000Params,
} from './coordConversion.ts'

interface CurrentCoordinateRow {
  coordinateSystem: string
  x: string
  y: string
}

const currentRow = ref<CurrentCoordinateRow>({
  coordinateSystem: 'wgs84',
  x: '',
  y: '',
})

const cgcs2000Params = ref<CGCS2000Params>({ ...DEFAULT_CGCS2000_PARAMS })

const computedCM = computed(() => {
  const cm = computeCentralMeridian(
    cgcs2000Params.value.centralMeridian,
    cgcs2000Params.value.zoneWidth,
  )
  return Number.isFinite(cm) ? String(cm) : '—'
})

const conversionResults = ref<AllConversionResults | null>(null)

/**
 * 格式化转换结果。NaN 显示为「转换失败」而不是 NaN 本身 —— NaN 对用户
 * 没有信息量，且以前会以 0 的形式伪装成合法坐标（审计 P0-5）。
 */
const fmt = (value: number): string => (Number.isFinite(value) ? String(value) : '转换失败')

/**
 * CGCS2000 投影参数实时校验。
 *
 * `v-model.number` 在输入框被清空时产出 `''`，沿链路会变成 NaN 并被
 * proj4 一路传播、最终写进导出文件。这里实时提示，让用户知道是参数的
 * 问题而不是坐标算不出来（审计 P0-5）。
 */
const cgcsParamError = computed(() => {
  // v-model.number 清空输入框时运行时给出 ''，但 TS 类型是 number，用 unknown 桥接
  const raw: unknown = cgcs2000Params.value.centralMeridian
  // v-model.number 清空输入框时是 ''，不是 NaN
  if (raw === '' || raw === null || raw === undefined) {
    return '中央子午线经度不能为空'
  }
  return validateCGCS2000Params(cgcs2000Params.value)
})

watchEffect(() => {
  const { coordinateSystem, x, y } = currentRow.value
  if (coordinateSystem && x.trim() !== '' && y.trim() !== '' && !cgcsParamError.value) {
    conversionResults.value = convertAll(
      coordinateSystem as CoordinateSystemType,
      x,
      y,
      cgcs2000Params.value,
    )
  } else {
    conversionResults.value = null
  }
})
</script>
