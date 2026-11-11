<template>
  <div class="cabinet-page calc-trace selection-tool">
    <header class="page-head">
      <div class="page-title">
        <p class="eyebrow">
          <PhPlugs weight="fill" aria-hidden="true" />
          DC POWER CABINET / SIZING
        </p>
        <h1>{{ toolConfig?.name || '通信直流电源柜选型' }}</h1>
        <p class="page-desc">
          {{
            toolConfig?.description ||
            '按近期负荷、蓄电池均充电流与 N+1 冗余计算整流模块，并给出直流屏柜容量与柜体尺寸建议。'
          }}
        </p>
      </div>
      <div class="page-actions">
        <ModeSwitch :model-value="uiMode" @update:model-value="setUiMode" />
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
        容量按 <span class="readout">GB 51194-2016</span> 第 5.3
        节：整流器按近期负荷配置，满架容量考虑远期； 柜体外形尺寸国标不强制，工具给出的是按
        <span class="readout">GB/T 3047.1</span> /
        <span class="readout">GB/T 19520.1</span> 的工程建议。
      </p>
    </div>

    <div v-if="isSimple" class="notice notice-simple">
      <PhInfo weight="fill" aria-hidden="true" />
      <p>
        简易模式按 0.9 模块降额、2000×600×600 柜体、三相 380 V
        进线计算；模块降额、柜体尺寸与交流进线需按厂家型谱和机房条件复核时请切「专业」。
      </p>
    </div>

    <div class="workbench">
      <div class="input-column">
        <section class="panel">
          <div class="panel-head">
            <span class="panel-no">01</span>
            <h2>直流系统与负荷</h2>
            <span class="panel-hint">LOAD</span>
          </div>

          <div class="field-grid">
            <div
              class="field field-wide"
              data-symbol="U_dc"
              :class="{ 'is-symbol-active': isActive('U_dc') }"
            >
              <span class="field-label">
                直流电压等级
                <span class="field-hint">-48V 最常用</span>
              </span>
              <div class="segmented four" role="group" aria-label="直流电压等级">
                <button
                  v-for="voltage in [48, 24, 240, 336]"
                  :key="voltage"
                  type="button"
                  :class="{ active: form.dcVoltage === voltage }"
                  @click="form.dcVoltage = voltage"
                >
                  {{ voltageLabelFor(voltage) }}
                </button>
              </div>
            </div>

            <div class="field field-wide">
              <span class="field-label">
                负荷输入方式
                <span class="field-hint">电流或功率</span>
              </span>
              <div class="segmented" role="group" aria-label="负荷输入方式">
                <button
                  type="button"
                  :class="{ active: form.loadMode === 'current' }"
                  @click="form.loadMode = 'current'"
                >
                  按负荷电流
                </button>
                <button
                  type="button"
                  :class="{ active: form.loadMode === 'power' }"
                  @click="form.loadMode = 'power'"
                >
                  按负荷功率
                </button>
              </div>
            </div>

            <UnitField
              v-if="form.loadMode === 'current'"
              v-model="form.loadCurrentA"
              label="近期负荷电流 I"
              unit="A"
              :min="0"
              :step="1"
              hint="通信设备额定电流"
              data-symbol="I_load"
              :class="{ 'is-symbol-active': isActive('I_load') }"
            />
            <UnitField
              v-else
              v-model="form.loadPowerKw"
              label="近期负荷功率 P"
              unit="kW"
              :min="0"
              :step="0.1"
              hint="按设备铭牌统计"
              data-symbol="P_load"
              :class="{ 'is-symbol-active': isActive('P_load') }"
            />
            <UnitField
              v-model="form.futureGrowth"
              label="远期/近期负荷比"
              :min="1"
              :max="3"
              :step="0.05"
              hint="1.3 = 预留 30%"
              data-symbol="futureGrowth"
              :class="{ 'is-symbol-active': isActive('futureGrowth') }"
            />
          </div>

          <p class="field-note">
            近期负荷用于选模块数量；远期负荷只用于校核满架容量和柜体 U 位预留。
          </p>
        </section>

        <section class="panel">
          <div class="panel-head">
            <span class="panel-no">02</span>
            <h2>蓄电池与均充</h2>
            <span class="panel-hint">CHARGE</span>
          </div>

          <div class="field-grid">
            <UnitField
              v-model="form.batteryAh"
              label="蓄电池容量 Q"
              unit="Ah"
              :min="0"
              :step="10"
              hint="来自蓄电池计算工具"
              data-symbol="C10"
              :class="{ 'is-symbol-active': isActive('C10') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.chargeRate"
              label="均充倍率"
              :min="0"
              :max="0.3"
              :step="0.01"
              hint="0.1 = 0.1C10"
              data-symbol="k_charge"
              :class="{ 'is-symbol-active': isActive('k_charge') }"
            />
          </div>

          <p class="field-note">
            均充电流 = Q × 均充倍率 =
            <strong class="readout">{{ result?.chargeCurrentA.toFixed(1) ?? '—' }} A</strong>； 常用
            10h 率约 0.1C10，实际按电池厂家均充电流。
          </p>
        </section>

        <section class="panel">
          <div class="panel-head">
            <span class="panel-no">03</span>
            <h2>整流模块与冗余</h2>
            <span class="panel-hint">RECTIFIER</span>
          </div>

          <div class="field-grid">
            <UnitField
              v-model="form.moduleCurrentA"
              label="单模块额定电流"
              unit="A"
              :min="1"
              :step="1"
              hint="常见 50/75/100/150/200"
              data-symbol="I_module"
              :class="{ 'is-symbol-active': isActive('I_module') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.moduleDerating"
              label="模块降额系数"
              :min="0.1"
              :max="1.2"
              :step="0.01"
              hint="高温/高海拔取小"
              data-symbol="derating"
              :class="{ 'is-symbol-active': isActive('derating') }"
            />

            <div
              class="field field-wide"
              data-symbol="redundancy"
              :class="{ 'is-symbol-active': isActive('redundancy') }"
            >
              <span class="field-label">
                冗余方式
                <span class="field-hint">常用 N+1</span>
              </span>
              <div class="segmented three" role="group" aria-label="冗余方式">
                <button
                  type="button"
                  :class="{ active: form.redundancy === 'N' }"
                  @click="form.redundancy = 'N'"
                >
                  N
                </button>
                <button
                  type="button"
                  :class="{ active: form.redundancy === 'N+1' }"
                  @click="form.redundancy = 'N+1'"
                >
                  N+1
                </button>
                <button
                  type="button"
                  :class="{ active: form.redundancy === 'N+2' }"
                  @click="form.redundancy = 'N+2'"
                >
                  N+2
                </button>
              </div>
            </div>

            <UnitField
              v-if="!isSimple"
              v-model="form.moduleU"
              label="单模块占用 U"
              unit="U"
              :min="0.5"
              :step="0.5"
              hint="1U/2U 按厂家"
              data-symbol="moduleU"
              :class="{ 'is-symbol-active': isActive('moduleU') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.reserveU"
              label="监控/配电/备用 U"
              unit="U"
              :min="0"
              :step="1"
              hint="常取 6~10U"
              data-symbol="reserveU"
              :class="{ 'is-symbol-active': isActive('reserveU') }"
            />
          </div>

          <p class="field-note">
            主用模块数 N = ⌈(近期负荷 + 均充) / (模块额定 × 降额)⌉；N+1 即再加 1 个备用模块。
          </p>

          <AssumptionCard v-if="isSimple" :items="simpleAssumptions" />
        </section>

        <section v-if="!isSimple" class="panel">
          <div class="panel-head">
            <span class="panel-no">04</span>
            <h2>柜体与交流进线</h2>
            <span class="panel-hint">CABINET</span>
          </div>

          <div class="field-grid">
            <label
              class="field"
              data-symbol="cabinetHeightMm"
              :class="{ 'is-symbol-active': isActive('cabinetHeightMm') }"
            >
              <span class="field-label">
                拟用柜高
                <span class="field-hint">按机房净高</span>
              </span>
              <select
                v-model.number="form.cabinetHeightMm"
                class="select select-bordered select-sm w-full"
              >
                <option
                  v-for="option in CABINET_HEIGHTS"
                  :key="option.heightMm"
                  :value="option.heightMm"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <UnitField
              v-model="form.maxModulesPerCabinet"
              label="单柜最大模块数"
              unit="个"
              :min="1"
              :step="1"
              hint="按厂家型谱"
              data-symbol="maxModulesPerCabinet"
              :class="{ 'is-symbol-active': isActive('maxModulesPerCabinet') }"
            />
            <UnitField
              v-model="form.cabinetWidthMm"
              label="拟用柜宽"
              unit="mm"
              :min="400"
              :step="50"
              hint="常用 600/800"
              data-symbol="cabinetWidthMm"
              :class="{ 'is-symbol-active': isActive('cabinetWidthMm') }"
            />
            <UnitField
              v-model="form.cabinetDepthMm"
              label="拟用柜深"
              unit="mm"
              :min="400"
              :step="50"
              hint="常用 600/800"
              data-symbol="cabinetDepthMm"
              :class="{ 'is-symbol-active': isActive('cabinetDepthMm') }"
            />

            <div
              class="field field-wide"
              data-symbol="U_ac"
              :class="{ 'is-symbol-active': isActive('U_ac') }"
            >
              <span class="field-label">
                交流进线
                <span class="field-hint">三相 380V / 单相 220V</span>
              </span>
              <div class="segmented" role="group" aria-label="交流进线">
                <button
                  type="button"
                  :class="{ active: form.acPhase === 3 }"
                  @click="setAcPhase(3)"
                >
                  三相 380V
                </button>
                <button
                  type="button"
                  :class="{ active: form.acPhase === 1 }"
                  @click="setAcPhase(1)"
                >
                  单相 220V
                </button>
              </div>
            </div>

            <UnitField
              v-model="form.rectifierEfficiency"
              label="整流效率 η"
              :min="0.5"
              :max="1"
              :step="0.01"
              hint="高频机约 0.92~0.96"
              data-symbol="η_rect"
              :class="{ 'is-symbol-active': isActive('η_rect') }"
            />
            <UnitField
              v-model="form.acPowerFactor"
              label="交流功率因数 PF"
              :min="0.1"
              :max="1"
              :step="0.01"
              hint="约 0.99"
              data-symbol="PF"
              :class="{ 'is-symbol-active': isActive('PF') }"
            />
            <UnitField
              v-model="form.breakerMargin"
              label="断路器余量"
              :min="1"
              :max="2"
              :step="0.05"
              hint="常取 1.25"
              data-symbol="breakerMargin"
              :class="{ 'is-symbol-active': isActive('breakerMargin') }"
            />
          </div>

          <p class="field-note">
            柜宽/深只作布置校核；最终尺寸按 GB/T 3047.1 的 20mm 进制系列和厂家型谱确定。
          </p>
        </section>
      </div>

      <aside class="output-column">
        <ResultStrip
          v-if="result"
          :value="result.installedNameplateA.toFixed(0)"
          unit="A 标称"
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
            <span class="verdict-kicker">RECTIFIER + DC DISTRIBUTION</span>
            <span class="verdict-stamp">{{ result.overallPass ? 'PASS' : 'REVIEW' }}</span>
          </div>

          <div class="verdict-main">
            <span class="verdict-section">{{ result.installedNameplateA.toFixed(0) }}</span>
            <span class="verdict-unit">A 标称</span>
          </div>

          <p class="verdict-spec">{{ specLabel }}</p>
          <p class="verdict-sub">
            {{ result.overallPass ? '各项校核通过' : '存在需要复核的项' }} · 降额后可用
            {{ result.installedEffectiveA.toFixed(0) }} A
          </p>
          <p v-if="isSimple" class="verdict-mode">{{ simpleModeNote }}</p>

          <div class="verdict-metrics">
            <div>
              <span>近期设计电流</span>
              <strong>{{ result.designCurrentA.toFixed(1) }} A</strong>
            </div>
            <div>
              <span>均充电流</span>
              <strong>{{ result.chargeCurrentA.toFixed(1) }} A</strong>
            </div>
            <div>
              <span>远期电流</span>
              <strong>{{ result.frameCurrentA.toFixed(1) }} A</strong>
            </div>
            <div>
              <span>模块配置</span>
              <strong>{{ result.mainModules }} + {{ result.redundantModules }}</strong>
            </div>
          </div>
        </div>

        <div v-else class="panel empty-result">
          <PhWarningCircle aria-hidden="true" />
          <p>请输入有效的负荷电流/功率、模块电流和柜体参数后查看选型结果。</p>
        </div>

        <div v-if="result" class="panel cabinet-panel">
          <details>
            <summary>
              <span class="panel-no">▣</span>
              <h2>柜体与配电建议</h2>
              <span class="panel-hint">CABINET</span>
            </summary>

            <dl class="spec-list">
              <div>
                <dt>推荐柜体</dt>
                <dd class="readout">
                  {{ result.recommendedWidthMm }}×{{ result.recommendedDepthMm }}×{{
                    result.recommendedHeightMm
                  }}
                  mm × {{ result.recommendedCount }}
                </dd>
              </div>
              <div>
                <dt>拟用柜体</dt>
                <dd class="readout">
                  {{ result.selectedWidthMm }}×{{ result.selectedDepthMm }}×{{
                    result.selectedHeightMm
                  }}
                  mm × {{ result.cabinetCount }}
                </dd>
              </div>
              <div>
                <dt>U 位占用</dt>
                <dd class="readout">
                  {{ result.requiredU }}U / {{ result.usableU * result.cabinetCount }}U（余
                  {{ result.usableU * result.cabinetCount - result.requiredU }}U）
                </dd>
              </div>
              <div>
                <dt>模块槽位</dt>
                <dd class="readout">
                  {{ result.moduleSlots }} / {{ form.maxModulesPerCabinet * result.cabinetCount }}
                </dd>
              </div>
              <div>
                <dt>直流主断路器</dt>
                <dd class="readout">{{ result.mainBreakerA }} A</dd>
              </div>
              <div>
                <dt>交流输入</dt>
                <dd class="readout">
                  {{ result.acInputPowerKw.toFixed(1) }} kW /
                  {{ result.acInputCurrentA.toFixed(1) }} A / {{ result.acBreakerA }} A
                </dd>
              </div>
            </dl>
          </details>
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
            容量侧以 GB
            51194-2016《通信电源设备安装工程设计规范》为主；柜体尺寸为工程建议，不是国标强制值。
          </p>
          <ul>
            <li>GB 51194-2016 第 5.3.1 条：整流器、变换器的容量应按近期负荷配置。</li>
            <li>
              GB 51194-2016 第 5.3.2
              条：组合电源整流模块数可按近期负荷配置，但满架容量应考虑远期负荷发展。
            </li>
            <li>
              GB 51194-2016 第 5.2 节：铅酸蓄电池组配置与均充要求；工程上均充电流常按 10h 率 0.1C10
              估算。
            </li>
            <li>GB 51194-2016 第 10.2 节：只规定机房设备布置与维护间距，不规定柜体宽×深×高。</li>
            <li>
              柜体尺寸系列：GB/T 3047.1-1995《高度进制为 20mm 的面板、架和柜的基本尺寸系列》； GB/T
              19520.1-2007《电子设备机械结构 482.6mm(19in) 系列机械结构尺寸 第 1 部分》。
            </li>
            <li>
              YD/T 585-2010《通信用配电设备》第 4.4 节“结构尺寸”引用 GB/T
              3047.1，属于通信行业标准，不是国标。
            </li>
            <li>
              工程常见 600×600×2000/2200、600×450×1600、800×600×2200
              等规格来自厂家型谱和机房条件，不是国标强制值。
            </li>
          </ul>
        </details>
      </aside>
    </div>

    <ParamDocs :docs="parameterDocs" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  PhArrowCounterClockwise,
  PhCopy,
  PhInfo,
  PhPlugs,
  PhWarningCircle,
} from '@phosphor-icons/vue'
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
  CABINET_HEIGHTS,
  SIMPLE_MODE_FIXED,
  calculateDcCabinet,
  createDefaultInput,
  createSimpleInput,
  voltageLabelFor,
  type AcPhase,
  type DcCabinetInput,
} from './dcPowerCabinet'
import { buildDcCabinetSteps, buildParameterDocs } from './calculationSteps'
import { buildDcCabinetCheckDetails } from './checkDetails'
import '@/assets/calc-trace.css'

const toolConfig = getToolById('dc_power_cabinet')

const form = reactive<DcCabinetInput>(createSimpleInput())
const { uiMode, isSimple, setUiMode, reset } = useUiMode<DcCabinetInput>({
  storageKey: 'dls.dc-power-cabinet.ui-mode.v1',
  createSimple: createSimpleInput,
  createDefault: createDefaultInput,
  getForm: () => ({ ...form }),
  setForm: (next) => Object.assign(form, next),
})
const { activeSymbol, isActive, activateSymbol, deactivate } = useSymbolLink()
const { copied, copy } = useCopyText()

const result = computed(() => calculateDcCabinet({ ...form }))

interface AssumptionItem {
  label: string
  value: string
  note: string
}

const simpleAssumptions = computed<AssumptionItem[]>(() => [
  {
    label: '均充倍率',
    value: `${SIMPLE_MODE_FIXED.chargeRate}C10`,
    note: 'GB 51194 常用值',
  },
  {
    label: '模块降额系数',
    value: SIMPLE_MODE_FIXED.moduleDerating.toFixed(2),
    note: '高温 / 高海拔按厂家曲线取',
  },
  {
    label: '模块占用 U / 备用 U',
    value: `${SIMPLE_MODE_FIXED.moduleU} U / ${SIMPLE_MODE_FIXED.reserveU} U`,
    note: '常见模块与监控配电占位',
  },
  {
    label: '柜体 高×宽×深',
    value: `${SIMPLE_MODE_FIXED.cabinetHeightMm}×${SIMPLE_MODE_FIXED.cabinetWidthMm}×${SIMPLE_MODE_FIXED.cabinetDepthMm} mm`,
    note: 'GB/T 3047.1 建议系列',
  },
  {
    label: '单柜最大模块数',
    value: `${SIMPLE_MODE_FIXED.maxModulesPerCabinet} 个`,
    note: '常见 2 m 柜',
  },
  {
    label: '交流相数 / 电压',
    value: `${SIMPLE_MODE_FIXED.acPhase === 3 ? '三相' : '单相'} / ${SIMPLE_MODE_FIXED.acVoltage} V`,
    note: '机房常规进线',
  },
  {
    label: '交流功率因数',
    value: SIMPLE_MODE_FIXED.acPowerFactor.toFixed(2),
    note: '整流模块典型值',
  },
  {
    label: '整流效率',
    value: SIMPLE_MODE_FIXED.rectifierEfficiency.toFixed(2),
    note: '高频模块典型效率',
  },
  {
    label: '断路器余量',
    value: SIMPLE_MODE_FIXED.breakerMargin.toFixed(2),
    note: '常用整定余量',
  },
])

const simpleModeNote = computed(
  () =>
    `固定值：${SIMPLE_MODE_FIXED.chargeRate}C10 · 降额 ${SIMPLE_MODE_FIXED.moduleDerating.toFixed(2)} · 柜体 ${SIMPLE_MODE_FIXED.cabinetHeightMm}×${SIMPLE_MODE_FIXED.cabinetWidthMm}×${SIMPLE_MODE_FIXED.cabinetDepthMm} · 三相 ${SIMPLE_MODE_FIXED.acVoltage} V · PF ${SIMPLE_MODE_FIXED.acPowerFactor} · η ${SIMPLE_MODE_FIXED.rectifierEfficiency} · 余量 ${SIMPLE_MODE_FIXED.breakerMargin}`,
)

const simpleReportNote = computed(
  () =>
    `${SIMPLE_MODE_FIXED.chargeRate}C10 均充、降额 ${SIMPLE_MODE_FIXED.moduleDerating.toFixed(2)}、柜体 ${SIMPLE_MODE_FIXED.cabinetHeightMm}×${SIMPLE_MODE_FIXED.cabinetWidthMm}×${SIMPLE_MODE_FIXED.cabinetDepthMm}、三相 ${SIMPLE_MODE_FIXED.acVoltage} V、PF ${SIMPLE_MODE_FIXED.acPowerFactor}、η ${SIMPLE_MODE_FIXED.rectifierEfficiency}、断路器余量 ${SIMPLE_MODE_FIXED.breakerMargin}`,
)

const specLabel = computed(() => {
  const value = result.value
  if (!value) return ''
  return `${value.voltageLabel} · ${form.moduleCurrentA}A × ${value.totalModules}（${value.mainModules}+${value.redundantModules}）· ${value.recommendedWidthMm}×${value.recommendedDepthMm}×${value.recommendedHeightMm} mm`
})

const parameterDocs = buildParameterDocs()
const calcSteps = computed(() =>
  result.value ? buildDcCabinetSteps({ ...form }, result.value) : [],
)
const checkDetails = computed(() => {
  const value = result.value
  if (!value) return []
  return buildDcCabinetCheckDetails({ ...form }, value)
})
const calcBookRef = ref<InstanceType<typeof CalcBook> | null>(null)

function openCalcStep(key?: string) {
  if (key) calcBookRef.value?.openStep(key)
}

function setAcPhase(phase: AcPhase) {
  form.acPhase = phase
  form.acVoltage = phase === 3 ? 380 : 220
}

function buildReport(): string {
  const value = result.value
  if (!value) return ''

  const lines = [
    '通信直流电源柜选型计算书（方案初选）',
    ...(isSimple.value ? [`模式：简易（${simpleReportNote.value}）`] : []),
    `系统电压：${value.voltageLabel}；负荷输入：${form.loadMode === 'current' ? `${value.loadCurrentA.toFixed(2)} A` : `${form.loadPowerKw} kW`}`,
    `蓄电池：${form.batteryAh} Ah；均充倍率：${form.chargeRate}；均充电流：${value.chargeCurrentA.toFixed(2)} A`,
    `近期设计电流：${value.designCurrentA.toFixed(2)} A；远期电流：${value.frameCurrentA.toFixed(2)} A`,
    `模块：${form.moduleCurrentA} A × ${value.totalModules}（${value.mainModules} 主用 + ${value.redundantModules} 备用）；降额系数 ${form.moduleDerating}`,
    `模块标称容量：${value.installedNameplateA.toFixed(0)} A；降额后：${value.installedEffectiveA.toFixed(0)} A`,
    `满架模块：${value.frameModules} 个；满架容量：${value.frameCapacityA.toFixed(1)} A`,
    `推荐柜体：${value.recommendedWidthMm}×${value.recommendedDepthMm}×${value.recommendedHeightMm} mm × ${value.recommendedCount}`,
    `拟用柜体：${value.selectedWidthMm}×${value.selectedDepthMm}×${value.selectedHeightMm} mm × ${value.cabinetCount}`,
    `U 位：${value.requiredU}U / ${value.usableU * value.cabinetCount}U；模块槽位：${value.moduleSlots} / ${form.maxModulesPerCabinet * value.cabinetCount}`,
    `直流主断路器：${value.mainBreakerA} A；交流输入：${value.acInputPowerKw.toFixed(2)} kW / ${value.acInputCurrentA.toFixed(2)} A / ${value.acBreakerA} A`,
    `控制项：${value.drivers.join(' / ') || '—'}`,
    `结论：${value.overallPass ? '各项校核通过' : '存在需要复核的项'}`,
    '',
    '计算书：',
    ...formatStepLines(calcSteps.value),
    '',
    '校核明细：',
    ...formatCheckLines(value.checks, { fail: '复核' }),
    '',
    '注：柜体宽×深×高为工程建议，GB 51194 不规定柜体外形尺寸；正式设计应按现行标准、厂家型谱和注册电气工程师意见复核。',
  ]
  return lines.join('\n')
}
</script>

<style scoped>
.cabinet-page {
  padding: 1rem 1.25rem 1.5rem;
}

/* 结论卡：四项指标并排放，给首屏的校核摘要留出空间 */
.cabinet-page .verdict-metrics {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.cabinet-page .cabinet-panel summary {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.55rem 0.8rem;
  font-size: 12px;
  cursor: pointer;
  list-style: none;
  background-color: var(--color-base-200);
}

.cabinet-page .cabinet-panel summary::-webkit-details-marker {
  display: none;
}

.cabinet-page .cabinet-panel summary h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.cabinet-page .cabinet-panel summary::before,
.cabinet-page .warning-box summary::before {
  content: '▸';
  flex: 0 0 auto;
  font-size: 10px;
  color: var(--text-faint);
}

.cabinet-page .cabinet-panel details[open] > summary::before,
.cabinet-page .warning-box[open] > summary::before {
  content: '▾';
}

.cabinet-page .warning-box summary {
  cursor: pointer;
  list-style: none;
}

.cabinet-page .warning-box summary::-webkit-details-marker {
  display: none;
}

.segmented.three {
  grid-template-columns: repeat(3, 1fr);
}

.segmented.four {
  grid-template-columns: repeat(4, 1fr);
}

.spec-list {
  margin: 0;
  padding: 0.3rem 0.8rem 0.7rem;
}

.spec-list div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.42rem 0;
  border-bottom: 1px dashed color-mix(in oklab, var(--color-base-300) 70%, transparent);
}

.spec-list div:last-child {
  border-bottom: 0;
}

.spec-list dt {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--text-muted);
}

.spec-list dd {
  margin: 0;
  font-size: 11px;
  text-align: right;
}

@media (max-width: 640px) {
  .cabinet-page {
    padding: 0.75rem;
  }

  .cabinet-page .verdict-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
