<template>
  <div class="hvac-page calc-trace selection-tool">
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
        <ModeSwitch :model-value="uiMode" @update:model-value="setUiMode" />
        <button type="button" class="btn btn-sm btn-ghost" @click="loadExample">
          <PhLightbulb aria-hidden="true" />
          示例
        </button>
        <button type="button" class="btn btn-sm btn-ghost" @click="reset">
          <PhArrowCounterClockwise aria-hidden="true" />
          重置
        </button>
        <button type="button" class="btn btn-sm btn-primary" @click="copy(buildReport())">
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
        <div v-if="isSimple" class="notice notice-simple">
          <PhInfo weight="fill" aria-hidden="true" />
          <p>
            简易模式只固定厂家 / 规范参数，并把照明、人员、围护、新风等负荷侧输入按方案假定取值；
            <template v-if="form.calculationMode === 'area'">
              面积指标取「{{ roomPreset.label }}」预设
              <span class="readout">{{ form.areaIndexWPerM2 }} W/m²</span>。
            </template>
            这些经验值不适用于高密度机房；需要按厂家样本核对显热比、修正系数或新风湿负荷时请切「专业」。
          </p>
        </div>

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
              data-symbol="A"
              :class="{ 'is-symbol-active': isActive('A') }"
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
              v-if="!isSimple && form.calculationMode === 'area'"
              v-model="form.areaIndexWPerM2"
              label="面积指标 qA"
              unit="W/m²"
              :min="50"
              :max="3000"
              :step="10"
              :hint="`${roomPreset.areaIndexRange[0]}~${roomPreset.areaIndexRange[1]} W/m²`"
              data-symbol="q_A"
              :class="{ 'is-symbol-active': isActive('q_A') }"
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
              data-symbol="P_IT"
              :class="{ 'is-symbol-active': isActive('P_IT') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.heatFactor"
              label="设备发热系数"
              :min="0.5"
              :max="1.2"
              :step="0.01"
              hint="通信设备可取 1.00"
              data-symbol="K_heat"
              :class="{ 'is-symbol-active': isActive('K_heat') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.powerLossKw"
              label="电力设备损耗"
              unit="kW"
              :min="0"
              :step="0.1"
              hint="UPS / 整流器 / 配电"
              data-symbol="P_loss"
              :class="{ 'is-symbol-active': isActive('P_loss') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.envelopeLoadKw"
              label="围护结构 + 太阳辐射"
              unit="kW"
              :min="0"
              :step="0.1"
              hint="逐时计算或估算"
              data-symbol="Q_env"
              :class="{ 'is-symbol-active': isActive('Q_env') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.lightingWPerM2"
              label="照明功率密度"
              unit="W/m²"
              :min="0"
              :step="1"
              hint="LED 约 8~12"
              data-symbol="L_light"
              :class="{ 'is-symbol-active': isActive('L_light') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.peopleCount"
              label="人员数量"
              unit="人"
              :min="0"
              :step="1"
              hint="维护 / 值班人员"
              data-symbol="N_people"
              :class="{ 'is-symbol-active': isActive('N_people') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.peopleWPerPerson"
              label="每人散热量"
              unit="W/人"
              :min="0"
              :step="10"
              hint="轻作业 100~150"
              data-symbol="q_people"
              :class="{ 'is-symbol-active': isActive('q_people') }"
            />

            <div v-if="!isSimple" class="field field-wide">
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

            <template v-if="!isSimple && form.freshAirMode === 'airflow'">
              <UnitField
                v-model="form.freshAirM3h"
                label="新风量 L"
                unit="m³/h"
                :min="0"
                :step="100"
                hint="按人员 / 工艺要求"
                data-symbol="L_fresh"
                :class="{ 'is-symbol-active': isActive('L_fresh') }"
              />
              <UnitField
                v-model="form.freshAirDeltaHKjKg"
                label="焓差 Δh"
                unit="kJ/kg"
                :min="0"
                :step="1"
                hint="室外 − 室内"
                data-symbol="Δh"
                :class="{ 'is-symbol-active': isActive('Δh') }"
              />
            </template>
            <UnitField
              v-else-if="!isSimple"
              v-model="form.freshAirLoadKw"
              label="新风冷负荷"
              unit="kW"
              :min="0"
              :step="0.1"
              hint="可直接输入"
              data-symbol="Q_fresh"
              :class="{ 'is-symbol-active': isActive('Q_fresh') }"
            />

            <UnitField
              v-if="!isSimple"
              v-model="form.otherLoadKw"
              label="其他负荷"
              unit="kW"
              :min="0"
              :step="0.1"
              hint="加湿 / 水泵 / 工艺"
              data-symbol="Q_other"
              :class="{ 'is-symbol-active': isActive('Q_other') }"
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
              data-symbol="K_margin"
              :class="{ 'is-symbol-active': isActive('K_margin') }"
            />

            <label
              class="field"
              data-symbol="redundancy"
              :class="{ 'is-symbol-active': isActive('redundancy') }"
            >
              <span class="field-label">冗余方式</span>
              <select v-model="form.redundancy" class="select select-bordered select-sm w-full">
                <option value="none">无备份</option>
                <option value="n+1">N+1（1 台备用）</option>
                <option value="2n">2N（双路备用）</option>
              </select>
            </label>

            <label v-if="!isSimple" class="field field-wide">
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
              v-if="!isSimple"
              v-model="form.runningUnitCount"
              label="运行台数 N"
              unit="台"
              :min="0"
              :max="8"
              :step="1"
              hint="0 = 自动"
              data-symbol="N_run"
              :class="{ 'is-symbol-active': isActive('N_run') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.unitCapacityKw"
              label="单台容量"
              unit="kW"
              :min="0"
              :step="1"
              hint="0 = 自动"
              data-symbol="Q_unit"
              :class="{ 'is-symbol-active': isActive('Q_unit') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.loadSensibleRatio"
              label="机房显热比"
              :min="0.5"
              :max="1"
              :step="0.01"
              hint="通信机房 0.85~1.0"
              data-symbol="SHR_load"
              :class="{ 'is-symbol-active': isActive('SHR_load') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.unitSensibleRatio"
              label="空调显热比"
              :min="0.5"
              :max="1"
              :step="0.01"
              hint="精密空调约 0.90"
              data-symbol="SHR_unit"
              :class="{ 'is-symbol-active': isActive('SHR_unit') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.correctionFactor"
              label="综合修正系数 K"
              :min="0.5"
              :max="1.5"
              :step="0.01"
              hint="海拔 / 高温 / 管路"
              data-symbol="K_corr"
              :class="{ 'is-symbol-active': isActive('K_corr') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.pBasisKw"
              label="匹换算基准"
              unit="kW/P"
              :min="2"
              :max="3"
              :step="0.001"
              hint="常用 2.5；老口径 2.324"
              data-symbol="p_basis"
              :class="{ 'is-symbol-active': isActive('p_basis') }"
            />
          </div>

          <p class="field-note">
            “运行台数 N”和“单台容量”填 0 时由工具自动推荐。N+1 表示 N 台运行 + 1 台备用； 2N 表示 N
            台运行 + N 台备用。综合修正系数小于 1 时，所需设备制冷量按 Q / K 放大。
          </p>

          <AssumptionCard
            v-if="isSimple"
            :items="vendorAssumptions"
            title="简易模式假定 · 厂家 / 规范（固定值参与计算）"
          />
          <AssumptionCard
            v-if="isSimple"
            :items="schemeAssumptions"
            title="简易模式假定 · 方案假定（经验值，可切专业修改）"
          />
        </section>
      </div>

      <aside class="output-column">
        <ResultStrip
          v-if="result"
          :value="result.requiredCapacityKw.toFixed(1)"
          unit="kW"
          :badge="isSimple ? '简易' : ''"
          :pass="result.overallPass"
          :drivers="result.drivers"
        />

        <CalcBook
          v-if="result"
          ref="calcBookRef"
          :steps="calcSteps"
          :mode-note="isSimple ? '模式：简易（固定值见“简易模式假定”）' : ''"
          :active-symbol="activeSymbol"
          @activate="activateSymbol"
          @deactivate="deactivate"
        />

        <div
          v-if="result"
          id="verdict"
          class="verdict"
          :class="result.overallPass ? 'is-pass' : 'is-review'"
        >
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
            <template v-if="form.unitType === 'chilled-water'">
              · {{ result.rtValue.toFixed(1) }} RT
            </template>
          </p>
          <p class="verdict-sub">
            计算冷负荷 {{ result.totalLoadKw.toFixed(1) }} kW · 设计冷负荷
            {{ result.designLoadKw.toFixed(1) }} kW · 显冷量
            {{ result.sensibleLoadKw.toFixed(1) }} kW
          </p>
          <p v-if="isSimple" class="verdict-mode">{{ simpleModeNote }}</p>

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
            <div>
              <span>运行 / 备用</span>
              <strong>{{ result.runningCount }} 用 / {{ result.backupCount }} 备</strong>
            </div>
            <div>
              <span>故障后可用</span>
              <strong>{{ result.faultCapacityKw.toFixed(1) }} kW</strong>
            </div>
          </div>
        </div>

        <div v-else class="panel empty-result">
          <PhWarningCircle aria-hidden="true" />
          <p>请输入有效的面积和冷负荷参数后查看估算结果。</p>
        </div>

        <details v-if="result && result.warnings.length" class="warning-box">
          <summary class="warning-title">
            <PhWarningCircle weight="fill" aria-hidden="true" />
            需要注意（{{ result.warnings.length }} 条，点击展开）
          </summary>
          <ul>
            <li v-for="(warning, index) in result.warnings" :key="index">{{ warning }}</li>
          </ul>
        </details>

        <details v-if="result" class="panel breakdown-panel">
          <summary>
            <span class="panel-no">Σ</span>
            <h2>冷负荷分项</h2>
            <span class="breakdown-total readout">{{ result.totalLoadKw.toFixed(2) }} kW</span>
          </summary>

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
        </details>

        <CheckList
          v-if="result"
          :details="checkDetails"
          hint="CHECKS"
          :active-symbol="activeSymbol"
          @activate="activateSymbol"
          @deactivate="deactivate"
          @open-step="openCalcStep"
        />

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

    <ParamDocs :docs="parameterDocs" />
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
import AssumptionCard from '@/tools/shared/components/AssumptionCard.vue'
import CalcBook from '@/tools/shared/components/CalcBook.vue'
import CheckList from '@/tools/shared/components/CheckList.vue'
import ModeSwitch from '@/tools/shared/components/ModeSwitch.vue'
import ParamDocs from '@/tools/shared/components/ParamDocs.vue'
import ResultStrip from '@/tools/shared/components/ResultStrip.vue'
import UnitField from '@/tools/shared/components/UnitField.vue'
import { formatCheckLines, formatStepLines } from '@/tools/shared/report'
import { useCopyText } from '@/tools/shared/useCopyText'
import { useSymbolLink } from '@/tools/shared/useSymbolLink'
import { useUiMode } from '@/tools/shared/useUiMode'
import '@/assets/selection-tool.css'
import {
  AC_UNIT_TYPE_OPTIONS,
  ROOM_TYPE_PRESETS,
  SIMPLE_MODE_FIXED,
  calculateHvacCooling,
  createDefaultInput,
  createSimpleInput,
  freshAirLoadFromAirflow,
  getAcUnitTypeOption,
  getRoomTypePreset,
  type HvacCoolingInput,
} from './hvacCooling'
import { buildHvacSteps, buildParameterDocs } from './calculationSteps'
import { buildHvacCheckDetails } from './checkDetails'
import '@/assets/calc-trace.css'

const toolConfig = getToolById('hvac_cooling')
const toast = useToast()

const form = reactive<HvacCoolingInput>(createSimpleInput())
const { uiMode, isSimple, setUiMode, reset } = useUiMode<HvacCoolingInput>({
  storageKey: 'dls.hvac-cooling.ui-mode.v1',
  createSimple: createSimpleInput,
  createDefault: createDefaultInput,
  getForm: () => ({ ...form }),
  setForm: (next) => Object.assign(form, next),
})
const { activeSymbol, isActive, activateSymbol, deactivate } = useSymbolLink()
const { copied, copy } = useCopyText()

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

interface AssumptionItem {
  label: string
  value: string
  note: string
}

const vendorAssumptions = computed<AssumptionItem[]>(() => [
  {
    label: '机组类型',
    value: '机房专用空调（精密）',
    note: '厂家 / 规范：机房专用机型',
  },
  {
    label: '显热比（负荷 / 机组）',
    value: `${SIMPLE_MODE_FIXED.loadSensibleRatio.toFixed(2)} / ${SIMPLE_MODE_FIXED.unitSensibleRatio.toFixed(2)}`,
    note: '机房常规值',
  },
  {
    label: '综合修正系数',
    value: SIMPLE_MODE_FIXED.correctionFactor.toFixed(2),
    note: '不做海拔 / 工况 / 污垢修正',
  },
  {
    label: '匹数基准',
    value: `${SIMPLE_MODE_FIXED.pBasisKw.toFixed(2)} kW/P`,
    note: '市场常用换算口径',
  },
  {
    label: '机组容量 / 运行台数',
    value: '0 / 0（自动推荐）',
    note: '沿用现有 0 = 自动',
  },
])

const schemeAssumptions = computed<AssumptionItem[]>(() => {
  if (form.calculationMode === 'area') {
    return [
      {
        label: '面积指标',
        value: `${form.areaIndexWPerM2.toFixed(0)} W/m²`,
        note:
          form.roomType === 'custom'
            ? '自定义机房按当前指标'
            : `按「${roomPreset.value.label}」预设取值`,
      },
    ]
  }

  return [
    {
      label: '热转换系数',
      value: SIMPLE_MODE_FIXED.heatFactor.toFixed(2),
      note: '电能全部转热',
    },
    {
      label: '围护结构 / 其他负荷',
      value: `${SIMPLE_MODE_FIXED.envelopeLoadKw.toFixed(0)} / ${SIMPLE_MODE_FIXED.otherLoadKw.toFixed(0)} kW`,
      note: '100 m² 量级经验值',
    },
    {
      label: '照明 / 人员',
      value: `${SIMPLE_MODE_FIXED.lightingWPerM2} W/m² / ${SIMPLE_MODE_FIXED.peopleCount} 人 × ${SIMPLE_MODE_FIXED.peopleWPerPerson} W`,
      note: '机房常规',
    },
    {
      label: '新风',
      value: `按冷负荷 ${SIMPLE_MODE_FIXED.freshAirLoadKw.toFixed(0)} kW`,
      note: '不做焓差换算',
    },
  ]
})

const simpleModeNote = computed(() => {
  const base = `固定值：精密 · SHR ${SIMPLE_MODE_FIXED.loadSensibleRatio.toFixed(2)}/${SIMPLE_MODE_FIXED.unitSensibleRatio.toFixed(2)} · K ${SIMPLE_MODE_FIXED.correctionFactor.toFixed(2)} · ${SIMPLE_MODE_FIXED.pBasisKw} kW/P · 自动选型`
  return form.calculationMode === 'area'
    ? `${base} · 面积指标 ${form.areaIndexWPerM2.toFixed(0)} W/m²`
    : `${base}；方案假定见左侧`
})

const simpleReportNote = computed(() => {
  const base = `精密空调、SHR ${SIMPLE_MODE_FIXED.loadSensibleRatio.toFixed(2)}/${SIMPLE_MODE_FIXED.unitSensibleRatio.toFixed(2)}、K ${SIMPLE_MODE_FIXED.correctionFactor.toFixed(2)}、${SIMPLE_MODE_FIXED.pBasisKw} kW/P、机组容量 / 台数自动`
  return form.calculationMode === 'area'
    ? `${base}；面积指标 ${form.areaIndexWPerM2.toFixed(0)} W/m²`
    : `${base}；热转换 ${SIMPLE_MODE_FIXED.heatFactor.toFixed(2)}、围护 ${SIMPLE_MODE_FIXED.envelopeLoadKw} kW、其他 ${SIMPLE_MODE_FIXED.otherLoadKw} kW、照明 ${SIMPLE_MODE_FIXED.lightingWPerM2} W/m²、${SIMPLE_MODE_FIXED.peopleCount} 人×${SIMPLE_MODE_FIXED.peopleWPerPerson} W、新风 ${SIMPLE_MODE_FIXED.freshAirLoadKw} kW`
})

const parameterDocs = buildParameterDocs()
const calcSteps = computed(() => (result.value ? buildHvacSteps({ ...form }, result.value) : []))
const checkDetails = computed(() => {
  const value = result.value
  if (!value) return []
  return buildHvacCheckDetails({ ...form }, value)
})
const calcBookRef = ref<InstanceType<typeof CalcBook> | null>(null)

function openCalcStep(key?: string) {
  if (key) calcBookRef.value?.openStep(key)
}

// 机房类型切换：面积指标跟随预设；简易模式显热比保持固定 0.90。
watch(
  () => form.roomType,
  (key) => {
    if (key === 'custom') return
    const preset = getRoomTypePreset(key)
    form.areaIndexWPerM2 = preset.areaIndexWPerM2
    form.loadSensibleRatio = isSimple.value
      ? SIMPLE_MODE_FIXED.loadSensibleRatio
      : preset.defaultSensibleRatio
  },
)

// 机组类型切换：专业模式沿用原行为，带出该机型的默认显热比。
watch(
  () => form.unitType,
  (type) => {
    form.unitSensibleRatio = getAcUnitTypeOption(type).defaultSensibleRatio
  },
)

function loadExample() {
  Object.assign(form, isSimple.value ? createSimpleInput() : createDefaultInput())
  toast.info('已载入 100 m² 通信机房示例')
}

function buildReport(): string {
  const value = result.value
  if (!value) return ''

  const lines = [
    '机房空调制冷量估算书（方案初选）',
    ...(isSimple.value ? [`模式：简易（${simpleReportNote.value}）`] : []),
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
    `控制项：${value.drivers.join(' / ') || '—'}`,
    `结论：${value.overallPass ? '各项校核通过' : '存在需要复核的项'}`,
    '',
    '计算书：',
    ...formatStepLines(calcSteps.value),
    '',
    '校核明细：',
    ...formatCheckLines(checkDetails.value, { fail: '复核' }),
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
</script>

<style scoped>
.hvac-page {
  padding: 1rem 1.25rem 1.5rem;
}

/* 简易提示条放进左栏，避免把右栏速览 / 校核摘要推到首屏之外 */
.hvac-page .input-column > .notice {
  margin-top: 0;
}

/* 次要块默认折叠：保留内容与顺序，给首屏的结论卡和校核摘要留空间 */
.hvac-page .warning-box summary,
.hvac-page .breakdown-panel summary {
  cursor: pointer;
  list-style: none;
}

.hvac-page .warning-box summary::-webkit-details-marker,
.hvac-page .breakdown-panel summary::-webkit-details-marker {
  display: none;
}

.hvac-page .warning-box summary::before,
.hvac-page .breakdown-panel summary::before {
  content: '▸';
  flex: 0 0 auto;
  font-size: 10px;
  color: var(--text-faint);
}

.hvac-page .warning-box[open] > summary::before,
.hvac-page .breakdown-panel[open] > summary::before {
  content: '▾';
}

.hvac-page .breakdown-panel summary {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.55rem 0.8rem;
  font-size: 12px;
  background-color: var(--color-base-200);
}

.hvac-page .breakdown-panel summary h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.hvac-page .breakdown-total {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.hvac-page .check-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.hvac-page .check-table th {
  padding: 0.45rem 0.55rem;
  font-size: 10px;
  font-weight: 500;
  text-align: left;
  color: var(--text-faint);
  border-bottom: 1px solid var(--color-base-300);
  white-space: nowrap;
}

.hvac-page .check-table td {
  padding: 0.5rem 0.55rem;
  vertical-align: top;
  border-bottom: 1px solid color-mix(in oklab, var(--color-base-300) 60%, transparent);
}

.hvac-page .check-table tr:last-child td {
  border-bottom: 0;
}

.hvac-page .check-table tfoot td {
  padding: 0.5rem 0.55rem;
  font-weight: 600;
  border-top: 1px solid var(--color-base-300);
}

.hvac-page .check-label {
  display: block;
  font-weight: 600;
}

.hvac-page .check-note {
  display: block;
  margin-top: 0.15rem;
  font-size: 9.5px;
  line-height: 1.4;
  color: var(--text-faint);
}

@media (max-width: 640px) {
  .hvac-page {
    padding: 0.75rem;
  }
}
</style>
