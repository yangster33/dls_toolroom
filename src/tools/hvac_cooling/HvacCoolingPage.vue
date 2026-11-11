<template>
  <div class="hvac-page">
    <header class="page-head">
      <div class="page-title">
        <p class="eyebrow">
          <PhSnowflake weight="fill" aria-hidden="true" />
          COOLING LOAD / kW → P
        </p>
        <h1>{{ toolConfig?.name || '机房空调制冷量计算' }}</h1>
        <p class="page-desc">
          {{
            toolConfig?.description ||
            '按设备功率、围护结构、人员、照明与新风逐项计算通信机房冷负荷，换算 kW 与市场匹数，并给出 N+1 选型建议。'
          }}
        </p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-sm btn-ghost" @click="loadExample">
          <PhLightbulb aria-hidden="true" />
          示例
        </button>
        <button type="button" class="btn btn-sm btn-ghost" @click="resetForm">
          <PhArrowCounterClockwise aria-hidden="true" />
          重置
        </button>
        <button type="button" class="btn btn-sm btn-primary" @click="copyReport">
          <PhCopy aria-hidden="true" />
          {{ copied ? '已复制' : '复制计算书' }}
        </button>
      </div>
    </header>

    <div class="notice">
      <PhInfo weight="fill" aria-hidden="true" />
      <p>
        计算依据 <span class="readout">GB 50174-2017</span> 7.2 / 7.5.3、
        <span class="readout">YD/T 5003</span> 与 <span class="readout">GB 50736</span>。
        标准只规定冷负荷组成和计算方法，不规定“几匹”；“匹”是市场俗称，
        <span class="readout">1P≈2.5kW</span>
        仅用于沟通。结果用于方案初选，施工图应由暖通工程师复核。
      </p>
    </div>

    <div class="workbench">
      <div class="input-column">
        <section class="panel">
          <div class="panel-head">
            <span class="panel-no">01</span>
            <h2>机房与计算方式</h2>
            <span class="panel-hint">ROOM</span>
          </div>

          <div class="field-grid">
            <label class="field field-wide">
              <span class="field-label">
                机房类型
                <span class="field-hint">{{ roomPreset.description }}</span>
              </span>
              <select v-model="form.roomType" class="select select-bordered select-sm w-full">
                <option v-for="preset in ROOM_TYPE_PRESETS" :key="preset.key" :value="preset.key">
                  {{ preset.label }}
                </option>
              </select>
            </label>

            <UnitField
              v-model="form.areaM2"
              label="机房面积 A"
              unit="m²"
              :min="1"
              :step="1"
              hint="建筑面积"
            />

            <div class="field field-wide">
              <span class="field-label">
                计算方式
                <span class="field-hint">详细法 / 面积估算</span>
              </span>
              <div class="segmented" role="group" aria-label="计算方式">
                <button
                  type="button"
                  :class="{ active: form.calculationMode === 'detailed' }"
                  @click="form.calculationMode = 'detailed'"
                >
                  详细分项法
                </button>
                <button
                  type="button"
                  :class="{ active: form.calculationMode === 'area' }"
                  @click="form.calculationMode = 'area'"
                >
                  面积指标法
                </button>
              </div>
            </div>

            <UnitField
              v-if="form.calculationMode === 'area'"
              v-model="form.areaIndexWPerM2"
              label="面积指标 qA"
              unit="W/m²"
              :min="50"
              :max="3000"
              :step="10"
              :hint="`${roomPreset.areaIndexRange[0]}~${roomPreset.areaIndexRange[1]} W/m²`"
            />
          </div>

          <p class="field-note">
            <template v-if="form.calculationMode === 'area'">
              面积法只用于方案估算：<strong class="readout">{{ form.areaIndexWPerM2 }} W/m²</strong>
              是经验指标，不是 GB 强制值。施工图应按 GB 50736 / GB 50019 逐项计算。
            </template>
            <template v-else>
              详细法按“设备 + 电力损耗 + 围护结构 + 照明 + 人体 + 新风 + 其他”逐项累加。
              面积只参与照明、新风和面积指标校核。
            </template>
          </p>
        </section>

        <section v-if="form.calculationMode === 'detailed'" class="panel">
          <div class="panel-head">
            <span class="panel-no">02</span>
            <h2>冷负荷分项</h2>
            <span class="panel-hint">LOAD</span>
          </div>

          <div class="field-grid">
            <UnitField
              v-model="form.itPowerKw"
              label="通信 / IT 设备输入功率"
              unit="kW"
              :min="0"
              :step="0.1"
              hint="铭牌输入功率；UPS 需换算"
            />
            <UnitField
              v-model="form.heatFactor"
              label="设备发热系数"
              :min="0.5"
              :max="1.2"
              :step="0.01"
              hint="通信设备可取 1.00"
            />
            <UnitField
              v-model="form.powerLossKw"
              label="电力设备损耗"
              unit="kW"
              :min="0"
              :step="0.1"
              hint="UPS / 整流器 / 配电"
            />
            <UnitField
              v-model="form.envelopeLoadKw"
              label="围护结构 + 太阳辐射"
              unit="kW"
              :min="0"
              :step="0.1"
              hint="逐时计算或估算"
            />
            <UnitField
              v-model="form.lightingWPerM2"
              label="照明功率密度"
              unit="W/m²"
              :min="0"
              :step="1"
              hint="LED 约 8~12"
            />
            <UnitField
              v-model="form.peopleCount"
              label="人员数量"
              unit="人"
              :min="0"
              :step="1"
              hint="维护 / 值班人员"
            />
            <UnitField
              v-model="form.peopleWPerPerson"
              label="每人散热量"
              unit="W/人"
              :min="0"
              :step="10"
              hint="轻作业 100~150"
            />

            <div class="field field-wide">
              <span class="field-label">
                新风输入方式
                <span class="field-hint">按风量或直接输入</span>
              </span>
              <div class="segmented" role="group" aria-label="新风输入方式">
                <button
                  type="button"
                  :class="{ active: form.freshAirMode === 'airflow' }"
                  @click="form.freshAirMode = 'airflow'"
                >
                  按风量估算
                </button>
                <button
                  type="button"
                  :class="{ active: form.freshAirMode === 'load' }"
                  @click="form.freshAirMode = 'load'"
                >
                  直接输入冷负荷
                </button>
              </div>
            </div>

            <template v-if="form.freshAirMode === 'airflow'">
              <UnitField
                v-model="form.freshAirM3h"
                label="新风量 L"
                unit="m³/h"
                :min="0"
                :step="100"
                hint="按人员 / 工艺要求"
              />
              <UnitField
                v-model="form.freshAirDeltaHKjKg"
                label="焓差 Δh"
                unit="kJ/kg"
                :min="0"
                :step="1"
                hint="室外 − 室内"
              />
            </template>
            <UnitField
              v-else
              v-model="form.freshAirLoadKw"
              label="新风冷负荷"
              unit="kW"
              :min="0"
              :step="0.1"
              hint="可直接输入"
            />

            <UnitField
              v-model="form.otherLoadKw"
              label="其他负荷"
              unit="kW"
              :min="0"
              :step="0.1"
              hint="加湿 / 水泵 / 工艺"
            />
          </div>

          <p class="field-note">
            当前设备散热量：
            <strong class="readout">{{ (form.itPowerKw * form.heatFactor).toFixed(2) }} kW</strong>
            ；新风负荷：
            <strong class="readout">{{ currentFreshAirLoad.toFixed(2) }} kW</strong>
            。YD/T 5003 允许一般通信机房按电能全部变为热能计算，所以发热系数默认 1.00。
          </p>
        </section>

        <section class="panel">
          <div class="panel-head">
            <span class="panel-no">{{ form.calculationMode === 'detailed' ? '03' : '02' }}</span>
            <h2>选型与换算</h2>
            <span class="panel-hint">SELECTION</span>
          </div>

          <div class="field-grid">
            <UnitField
              v-model="form.designMargin"
              label="设计余量"
              :min="0"
              :max="0.5"
              :step="0.01"
              hint="0.15 = 15%"
            />

            <label class="field">
              <span class="field-label">冗余方式</span>
              <select v-model="form.redundancy" class="select select-bordered select-sm w-full">
                <option value="none">无备份</option>
                <option value="n+1">N+1（1 台备用）</option>
                <option value="2n">2N（双路备用）</option>
              </select>
            </label>

            <label class="field field-wide">
              <span class="field-label">
                空调类型
                <span class="field-hint">{{ unitTypeOption.description }}</span>
              </span>
              <select v-model="form.unitType" class="select select-bordered select-sm w-full">
                <option
                  v-for="option in AC_UNIT_TYPE_OPTIONS"
                  :key="option.key"
                  :value="option.key"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <UnitField
              v-model="form.runningUnitCount"
              label="运行台数 N"
              unit="台"
              :min="0"
              :max="8"
              :step="1"
              hint="0 = 自动"
            />
            <UnitField
              v-model="form.unitCapacityKw"
              label="单台容量"
              unit="kW"
              :min="0"
              :step="1"
              hint="0 = 自动"
            />
            <UnitField
              v-model="form.loadSensibleRatio"
              label="机房显热比"
              :min="0.5"
              :max="1"
              :step="0.01"
              hint="通信机房 0.85~1.0"
            />
            <UnitField
              v-model="form.unitSensibleRatio"
              label="空调显热比"
              :min="0.5"
              :max="1"
              :step="0.01"
              hint="精密空调约 0.90"
            />
            <UnitField
              v-model="form.correctionFactor"
              label="综合修正系数 K"
              :min="0.5"
              :max="1.5"
              :step="0.01"
              hint="海拔 / 高温 / 管路"
            />
            <UnitField
              v-model="form.pBasisKw"
              label="匹换算基准"
              unit="kW/P"
              :min="2"
              :max="3"
              :step="0.001"
              hint="常用 2.5；老口径 2.324"
            />
          </div>

          <p class="field-note">
            “运行台数 N”和“单台容量”填 0 时由工具自动推荐。N+1 表示 N 台运行 + 1 台备用； 2N 表示 N
            台运行 + N 台备用。综合修正系数小于 1 时，所需设备制冷量按 Q / K 放大。
          </p>
        </section>
      </div>

      <aside class="output-column">
        <div v-if="result" class="verdict" :class="result.overallPass ? 'is-pass' : 'is-review'">
          <div class="verdict-top">
            <span class="verdict-kicker">COOLING LOAD / 设备所需制冷量</span>
            <span class="verdict-stamp">{{ result.overallPass ? 'PASS' : 'REVIEW' }}</span>
          </div>

          <div class="verdict-main">
            <span class="verdict-section">{{ result.requiredCapacityKw.toFixed(1) }}</span>
            <span class="verdict-unit">kW</span>
          </div>

          <p class="verdict-spec">
            ≈ {{ result.pValue.toFixed(1) }} P（按 {{ result.pBasisKw }} kW/P 估算）
          </p>
          <p class="verdict-sub">
            计算冷负荷 {{ result.totalLoadKw.toFixed(1) }} kW · 设计冷负荷
            {{ result.designLoadKw.toFixed(1) }} kW · 显冷量
            {{ result.sensibleLoadKw.toFixed(1) }} kW
          </p>

          <div class="verdict-metrics">
            <div>
              <span>面积指标</span>
              <strong>{{ result.areaIndexActualWPerM2.toFixed(0) }} W/m²</strong>
            </div>
            <div>
              <span>推荐配置</span>
              <strong>{{ selectionLabel }}</strong>
            </div>
            <div>
              <span>总装机</span>
              <strong>{{ result.installedCapacityKw.toFixed(1) }} kW</strong>
            </div>
            <div>
              <span>单台负载率</span>
              <strong>{{ (result.unitLoadRate * 100).toFixed(1) }}%</strong>
            </div>
          </div>
        </div>

        <div v-else class="panel empty-result">
          <PhWarningCircle aria-hidden="true" />
          <p>请输入有效的面积和冷负荷参数后查看估算结果。</p>
        </div>

        <div v-if="result" class="panel">
          <div class="panel-head compact">
            <span class="panel-no">Σ</span>
            <h2>冷负荷分项</h2>
            <span class="panel-hint">BREAKDOWN</span>
          </div>

          <div class="table-wrap">
            <table class="check-table">
              <thead>
                <tr>
                  <th>分项</th>
                  <th>冷负荷</th>
                  <th>占比</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in result.loadItems" :key="item.key">
                  <td>
                    <span class="check-label">{{ item.label }}</span>
                    <span class="check-note">{{ item.note }}</span>
                  </td>
                  <td class="readout">{{ item.kw.toFixed(2) }} kW</td>
                  <td class="readout">{{ item.percent.toFixed(1) }}%</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>合计</td>
                  <td class="readout">{{ result.totalLoadKw.toFixed(2) }} kW</td>
                  <td class="readout">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div v-if="result" class="panel">
          <div class="panel-head compact">
            <span class="panel-no">◧</span>
            <h2>选型建议</h2>
            <span class="panel-hint">SELECTION</span>
          </div>

          <div class="selection-body">
            <div class="selection-main">
              <span class="selection-count">{{ result.installedCount }} 台</span>
              <span class="selection-spec">{{ selectionLabel }}</span>
            </div>

            <dl class="calc-list">
              <div>
                <dt>运行 / 备用</dt>
                <dd class="readout">{{ result.runningCount }} 用 / {{ result.backupCount }} 备</dd>
              </div>
              <div>
                <dt>单台容量</dt>
                <dd class="readout">
                  {{ result.unitCapacityKw.toFixed(1) }} kW（≈
                  {{ (result.unitCapacityKw / form.pBasisKw).toFixed(1) }} P）
                </dd>
              </div>
              <div>
                <dt>运行冷量</dt>
                <dd class="readout">{{ result.runningCapacityKw.toFixed(1) }} kW</dd>
              </div>
              <div>
                <dt>故障后可用</dt>
                <dd class="readout">{{ result.faultCapacityKw.toFixed(1) }} kW</dd>
              </div>
              <div>
                <dt>显冷量</dt>
                <dd class="readout">
                  {{ result.unitSensibleCapacityKw.toFixed(1) }} kW（SHR
                  {{ result.unitSensibleRatio.toFixed(2) }}）
                </dd>
              </div>
              <div v-if="form.unitType === 'chilled-water'">
                <dt>所需冷吨</dt>
                <dd class="readout">{{ result.rtValue.toFixed(1) }} RT</dd>
              </div>
            </dl>
          </div>
        </div>

        <div v-if="result" class="panel check-panel">
          <div class="panel-head compact">
            <span class="panel-no">✓</span>
            <h2>校核明细</h2>
            <span class="panel-hint">CHECKS</span>
          </div>

          <div class="table-wrap">
            <table class="check-table">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>要求</th>
                  <th>实际</th>
                  <th>结论</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="check in result.checks" :key="check.key">
                  <td>
                    <span class="check-label">{{ check.label }}</span>
                    <span class="check-note">{{ check.note }}</span>
                  </td>
                  <td class="readout">{{ check.required }}</td>
                  <td class="readout">{{ check.actual }}</td>
                  <td>
                    <span
                      class="badge badge-sm"
                      :class="check.pass ? 'badge-success' : 'badge-error'"
                    >
                      {{ check.pass ? '通过' : '复核' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <details v-if="result" class="panel calc-panel" open>
          <summary>计算过程</summary>
          <dl class="calc-list">
            <template v-if="result.calculationMode === 'area'">
              <div>
                <dt>面积法</dt>
                <dd class="readout">
                  Q = {{ form.areaIndexWPerM2 }} W/m² × {{ result.areaM2.toFixed(0) }} m² / 1000 =
                  {{ result.totalLoadKw.toFixed(2) }} kW
                </dd>
              </div>
            </template>
            <template v-else>
              <div v-for="item in result.loadItems" :key="item.key">
                <dt>{{ item.label }}</dt>
                <dd class="readout">{{ item.note }} = {{ item.kw.toFixed(2) }} kW</dd>
              </div>
            </template>
            <div>
              <dt>总冷负荷</dt>
              <dd class="readout">Q总 = {{ result.totalLoadKw.toFixed(2) }} kW</dd>
            </div>
            <div>
              <dt>设计冷负荷</dt>
              <dd class="readout">
                Q设计 = Q总 × (1 + {{ (result.designMargin * 100).toFixed(0) }}%) =
                {{ result.designLoadKw.toFixed(2) }} kW
              </dd>
            </div>
            <div>
              <dt>修正后所需制冷量</dt>
              <dd class="readout">
                Q需 = Q设计 / {{ result.correctionFactor.toFixed(2) }} =
                {{ result.requiredCapacityKw.toFixed(2) }} kW
              </dd>
            </div>
            <div>
              <dt>显冷量</dt>
              <dd class="readout">
                Q显 = Q设计 × {{ result.loadSensibleRatio.toFixed(2) }} =
                {{ result.sensibleLoadKw.toFixed(2) }} kW
              </dd>
            </div>
            <div>
              <dt>潜热负荷</dt>
              <dd class="readout">Q潜 = Q设计 − Q显 = {{ result.latentLoadKw.toFixed(2) }} kW</dd>
            </div>
            <div>
              <dt>市场俗称</dt>
              <dd class="readout">
                P ≈ Q需 / {{ result.pBasisKw }} = {{ result.pValue.toFixed(1) }} P
              </dd>
            </div>
            <div>
              <dt>推荐配置</dt>
              <dd class="readout">{{ selectionLabel }}</dd>
            </div>
          </dl>
        </details>

        <div v-if="result && result.warnings.length" class="warning-box">
          <p class="warning-title">
            <PhWarningCircle weight="fill" aria-hidden="true" />
            需要注意
          </p>
          <ul>
            <li v-for="(warning, index) in result.warnings" :key="index">{{ warning }}</li>
          </ul>
        </div>

        <details class="panel source-panel">
          <summary>数据与依据</summary>
          <p>
            本工具把“冷负荷计算”和“设备选型”分开：先用标准方法算出 kW，再按 kW 选设备；
            “匹”只做市场沟通，不作为设计依据。
          </p>
          <ul>
            <li>
              GB 50174-2017 7.2.1：设备散热量按实际用电量；7.2.2：夏季冷负荷包括设备、围护结构、
              太阳辐射、人体、照明、新风和散湿潜热；7.5.3：无备份时单台制冷能力留 15%~20% 余量。
            </li>
            <li>
              YD/T 5003-2025《信息通信建筑工程设计规范》（代替 YD 5003-2014）：通信建筑空调设计。
              2014 版 9.2.4 人体按轻作业，9.2.5 一般通信机房可按电能全部变为热能，9.2.6 规定新风量。
            </li>
            <li>
              GB 50736-2012 7.2 / GB 50019-2015 8.2：逐时冷负荷计算方法；GB 50174 7.1.1 明确
              数据中心空调设计应符合 GB 50736。
            </li>
            <li>
              GB/T 19413-2024：机房空调产品的名义制冷量、显热比、能效和试验工况； YD/T
              2061-2020：通信机房恒温恒湿空调系统。
            </li>
            <li>
              “匹”不是我国法定计量单位。1P≈2.5kW 是市场习惯；老口径 1P≈2000 kcal/h≈2.324kW。
              设计文件应写 kW。
            </li>
          </ul>
        </details>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  PhArrowCounterClockwise,
  PhCopy,
  PhInfo,
  PhLightbulb,
  PhSnowflake,
  PhWarningCircle,
} from '@phosphor-icons/vue'
import { useToast } from '@/composables/useToast'
import { getToolById } from '../toolData'
import UnitField from '@/tools/shared/components/UnitField.vue'
import {
  AC_UNIT_TYPE_OPTIONS,
  ROOM_TYPE_PRESETS,
  calculateHvacCooling,
  createDefaultInput,
  freshAirLoadFromAirflow,
  getAcUnitTypeOption,
  getRoomTypePreset,
  type HvacCoolingInput,
} from './hvacCooling'

const toolConfig = getToolById('hvac_cooling')
const toast = useToast()

const form = reactive<HvacCoolingInput>(createDefaultInput())
const copied = ref(false)

const result = computed(() => calculateHvacCooling({ ...form }))
const roomPreset = computed(() => getRoomTypePreset(form.roomType))
const unitTypeOption = computed(() => getAcUnitTypeOption(form.unitType))

const currentFreshAirLoad = computed(() =>
  form.freshAirMode === 'airflow'
    ? freshAirLoadFromAirflow(form.freshAirM3h, form.freshAirDeltaHKjKg)
    : Math.max(0, form.freshAirLoadKw),
)

const selectionLabel = computed(() => {
  const value = result.value
  if (!value) return '—'
  const backup = value.backupCount > 0 ? ` + ${value.backupCount} 备` : ''
  return `${value.runningCount} × ${value.unitCapacityKw.toFixed(1)} kW${backup}`
})

watch(
  () => form.roomType,
  (key) => {
    if (key === 'custom') return
    const preset = getRoomTypePreset(key)
    form.areaIndexWPerM2 = preset.areaIndexWPerM2
    form.loadSensibleRatio = preset.defaultSensibleRatio
  },
)

watch(
  () => form.unitType,
  (type) => {
    form.unitSensibleRatio = getAcUnitTypeOption(type).defaultSensibleRatio
  },
)

function resetForm() {
  Object.assign(form, createDefaultInput())
  toast.info('已恢复默认参数')
}

function loadExample() {
  Object.assign(form, createDefaultInput())
  toast.info('已载入 100 m² 通信机房示例')
}

function buildReport(): string {
  const value = result.value
  if (!value) return ''

  const lines = [
    '机房空调制冷量估算书（方案初选）',
    `机房类型：${roomPreset.value.label}`,
    `面积：${value.areaM2.toFixed(0)} m²；计算方式：${
      value.calculationMode === 'area' ? '面积指标法' : '详细分项法'
    }`,
    '',
    '冷负荷分项：',
    ...value.loadItems.map(
      (item) => `- ${item.label}：${item.kw.toFixed(2)} kW（${item.percent.toFixed(1)}%）`,
    ),
    `- 合计：${value.totalLoadKw.toFixed(2)} kW`,
    '',
    `设计余量：${(value.designMargin * 100).toFixed(0)}%`,
    `设计冷负荷：${value.designLoadKw.toFixed(2)} kW`,
    `综合修正系数：${value.correctionFactor.toFixed(2)}`,
    `设备所需制冷量：${value.requiredCapacityKw.toFixed(2)} kW`,
    `显冷量：${value.sensibleLoadKw.toFixed(2)} kW（显热比 ${value.loadSensibleRatio.toFixed(2)}）`,
    `潜热负荷：${value.latentLoadKw.toFixed(2)} kW`,
    `市场俗称：约 ${value.pValue.toFixed(1)} P（按 ${value.pBasisKw} kW/P）`,
  ]

  if (value.unitType === 'chilled-water') {
    lines.push(`冷吨：约 ${value.rtValue.toFixed(1)} RT`)
  }

  lines.push(
    '',
    `推荐配置：${value.installedCount} 台 × ${value.unitCapacityKw.toFixed(1)} kW（${
      value.runningCount
    } 用 / ${value.backupCount} 备）`,
    `运行冷量：${value.runningCapacityKw.toFixed(1)} kW；故障后可用：${value.faultCapacityKw.toFixed(1)} kW`,
    `单台负载率：${(value.unitLoadRate * 100).toFixed(1)}%`,
    `结论：${value.overallPass ? '各项校核通过' : '存在需要复核的项'}`,
    '',
    '校核明细：',
    ...value.checks.map(
      (check) =>
        `- ${check.label}：${check.pass ? '通过' : '复核'}；要求 ${check.required}；实际 ${check.actual}`,
    ),
  )

  if (value.warnings.length) {
    lines.push('', '需要注意：', ...value.warnings.map((warning) => `- ${warning}`))
  }

  lines.push(
    '',
    '注：本计算书为方案初选。正式设计应按 GB 50174 / YD/T 5003 / GB 50736 / GB 50019 逐项计算，并按厂家样本修正。',
  )

  return lines.join('\n')
}

async function copyReport() {
  const report = buildReport()
  if (!report) {
    toast.error('暂无可复制的计算结果')
    return
  }
  try {
    await navigator.clipboard.writeText(report)
    copied.value = true
    toast.success('计算书已复制到剪贴板')
    window.setTimeout(() => {
      copied.value = false
    }, 1600)
  } catch {
    toast.error('复制失败，请检查浏览器剪贴板权限')
  }
}
</script>

<style scoped>
.hvac-page {
  padding: 1rem 1.25rem 1.5rem;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.35rem;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--text-faint);
}

.eyebrow svg {
  width: 13px;
  height: 13px;
  color: var(--color-primary);
}

.page-desc {
  max-width: 62ch;
  margin-top: 0.3rem;
  font-size: 13px;
  color: var(--text-muted);
}

.page-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.page-actions svg {
  width: 15px;
  height: 15px;
}

.notice {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin-top: 1rem;
  padding: 0.65rem 0.8rem;
  border: 1px solid color-mix(in oklab, var(--color-primary) 28%, var(--color-base-300));
  background-color: color-mix(in oklab, var(--color-primary) 6%, var(--color-base-100));
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.notice svg {
  flex: 0 0 auto;
  width: 15px;
  height: 15px;
  margin-top: 0.15rem;
  color: var(--color-primary);
}

.workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.85fr);
  gap: 1rem;
  align-items: start;
  margin-top: 1rem;
}

.input-column,
.output-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.panel {
  border: 1px solid var(--color-base-300);
  background-color: var(--color-base-100);
}

.panel-head {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.65rem 0.8rem;
  border-bottom: 1px solid var(--color-base-300);
  background-color: var(--color-base-200);
}

.panel-head.compact {
  padding: 0.55rem 0.8rem;
}

.panel-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 18px;
  padding: 0 0.3rem;
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1;
  color: var(--color-primary);
  border: 1px solid color-mix(in oklab, var(--color-primary) 40%, transparent);
}

.panel-head h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.panel-hint {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  color: var(--text-faint);
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  padding: 0.85rem;
}

.field {
  display: block;
  min-width: 0;
}

.field-wide {
  grid-column: 1 / -1;
}

.field-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
  font-size: 12px;
  line-height: 1.3;
  color: var(--text-muted);
}

.field-hint {
  flex: 0 0 auto;
  font-size: 10px;
  color: var(--text-faint);
}

.field-note {
  margin: 0;
  padding: 0 0.85rem 0.8rem;
  font-size: 11px;
  line-height: 1.55;
  color: var(--text-faint);
}

.segmented {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--color-base-300);
}

.segmented button {
  padding: 0.34rem 0.5rem;
  font-size: 12px;
  color: var(--text-muted);
  background-color: var(--color-base-100);
}

.segmented button + button {
  border-left: 1px solid var(--color-base-300);
}

.segmented button.active {
  color: var(--color-primary);
  background-color: color-mix(in oklab, var(--color-primary) 8%, var(--color-base-100));
  box-shadow: inset 0 -2px 0 var(--color-primary);
}

.verdict {
  position: relative;
  border: 1px solid var(--color-base-300);
  border-left-width: 3px;
  background-color: var(--color-base-100);
  padding: 0.8rem 0.9rem 0.9rem;
}

.verdict.is-pass {
  border-left-color: var(--color-success);
  background-image: linear-gradient(
    135deg,
    color-mix(in oklab, var(--color-success) 6%, transparent),
    transparent 45%
  );
}

.verdict.is-review {
  border-left-color: var(--color-warning);
  background-image: linear-gradient(
    135deg,
    color-mix(in oklab, var(--color-warning) 8%, transparent),
    transparent 45%
  );
}

.verdict-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.verdict-kicker {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.12em;
  color: var(--text-faint);
}

.verdict-stamp {
  padding: 0.1rem 0.4rem;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  border: 1px solid currentColor;
  transform: rotate(-2deg);
}

.is-pass .verdict-stamp {
  color: var(--color-success);
}

.is-review .verdict-stamp {
  color: var(--color-warning);
}

.verdict-main {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin-top: 0.45rem;
}

.verdict-section {
  font-family: var(--font-mono);
  font-size: 40px;
  line-height: 1;
  font-weight: 500;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.verdict-unit {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.verdict-spec {
  margin-top: 0.35rem;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--color-base-content);
  word-break: break-all;
}

.verdict-sub {
  margin-top: 0.2rem;
  font-size: 11px;
  color: var(--text-muted);
}

.verdict-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem;
  margin-top: 0.7rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--color-base-300);
}

.verdict-metrics div {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.verdict-metrics span {
  font-size: 10px;
  color: var(--text-faint);
}

.verdict-metrics strong {
  font-family: var(--font-mono);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  word-break: break-word;
}

.empty-result {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.9rem;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted);
}

.empty-result svg {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  margin-top: 0.1rem;
  color: var(--color-warning);
}

.table-wrap {
  overflow-x: auto;
}

.check-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.check-table th {
  padding: 0.45rem 0.55rem;
  font-size: 10px;
  font-weight: 500;
  text-align: left;
  color: var(--text-faint);
  border-bottom: 1px solid var(--color-base-300);
  white-space: nowrap;
}

.check-table td {
  padding: 0.5rem 0.55rem;
  vertical-align: top;
  border-bottom: 1px solid color-mix(in oklab, var(--color-base-300) 60%, transparent);
}

.check-table tr:last-child td {
  border-bottom: 0;
}

.check-table tfoot td {
  padding: 0.5rem 0.55rem;
  font-weight: 600;
  border-top: 1px solid var(--color-base-300);
}

.check-label {
  display: block;
  font-weight: 600;
}

.check-note {
  display: block;
  margin-top: 0.15rem;
  font-size: 9.5px;
  line-height: 1.4;
  color: var(--text-faint);
}

.selection-body {
  padding: 0.8rem;
}

.selection-main {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.selection-count {
  font-family: var(--font-mono);
  font-size: 24px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.selection-spec {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-word;
}

.selection-body .calc-list {
  padding-right: 0;
  padding-bottom: 0;
  padding-left: 0;
}

.calc-panel,
.source-panel {
  padding: 0;
}

.calc-panel summary,
.source-panel summary {
  padding: 0.55rem 0.8rem;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 1px solid var(--color-base-300);
  background-color: var(--color-base-200);
}

.calc-list {
  margin: 0;
  padding: 0.3rem 0.8rem 0.7rem;
}

.calc-list div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.38rem 0;
  border-bottom: 1px dashed color-mix(in oklab, var(--color-base-300) 70%, transparent);
}

.calc-list div:last-child {
  border-bottom: 0;
}

.calc-list dt {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--text-muted);
}

.calc-list dd {
  margin: 0;
  font-size: 11px;
  text-align: right;
}

.warning-box {
  border: 1px solid color-mix(in oklab, var(--color-warning) 40%, var(--color-base-300));
  background-color: color-mix(in oklab, var(--color-warning) 7%, var(--color-base-100));
  padding: 0.65rem 0.8rem;
}

.warning-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-warning);
}

.warning-title svg {
  width: 15px;
  height: 15px;
}

.warning-box ul {
  margin: 0.4rem 0 0;
  padding-left: 1.1rem;
  font-size: 11px;
  line-height: 1.65;
  color: var(--text-muted);
}

.source-panel p,
.source-panel ul {
  padding: 0 0.8rem;
  font-size: 11px;
  line-height: 1.7;
  color: var(--text-muted);
}

.source-panel p {
  padding-top: 0.6rem;
}

.source-panel ul {
  padding-bottom: 0.7rem;
  padding-left: 1.6rem;
}

@media (max-width: 1080px) {
  .workbench {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .hvac-page {
    padding: 0.75rem;
  }

  .field-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .page-actions {
    width: 100%;
  }

  .verdict-section {
    font-size: 34px;
  }
}
</style>
