<template>
  <div class="battery-page calc-trace">
    <header class="page-head">
      <div class="page-title">
        <p class="eyebrow">
          <PhBatteryCharging weight="fill" aria-hidden="true" />
          UPS BATTERY SIZING / Ah
        </p>
        <h1>{{ toolConfig?.name || '蓄电池容量计算' }}</h1>
        <p class="page-desc">
          {{
            toolConfig?.description ||
            '按负载功率、备电时长、环境温度与电池类型估算机房铅酸 / 锂电蓄电池容量。'
          }}
        </p>
      </div>
      <div class="page-actions">
        <div class="segmented mode-switch" role="group" aria-label="模式">
          <button
            type="button"
            :class="{ active: uiMode === 'simple' }"
            @click="setUiMode('simple')"
          >
            简易
          </button>
          <button
            type="button"
            :class="{ active: uiMode === 'professional' }"
            @click="setUiMode('professional')"
          >
            专业
          </button>
        </div>
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
        铅酸按
        <span class="readout">GB 51194-2016</span>
        安时法初选，再用厂家恒功率表复核；锂电按能量法叠加 DOD、SOH、温度降额与倍率校核。<span
          class="readout"
          >GB 50174-2017</span
        >
        只规定最少备用时间，不规定容量算法。结果用于方案初选，施工图应由注册电气工程师复核。
      </p>
    </div>

    <div v-if="isSimple" class="notice notice-simple">
      <PhInfo weight="fill" aria-hidden="true" />
      <p>
        简易模式按 cosφ=0.9、η=0.95、η线=0.99、{{
          SIMPLE_MODE_FIXED.ambientTempC
        }}
        ℃、K=1.25（铅酸）计算，η_ah 按备电时长查表；低温电池室、需要厂家
        W/单体复核或调整终止电压校核时请切「专业」模式。
      </p>
    </div>

    <div class="workbench">
      <div class="input-column">
        <section class="panel">
          <div class="panel-head">
            <span class="panel-no">01</span>
            <h2>电池类型与负荷</h2>
            <span class="panel-hint">LOAD</span>
          </div>

          <div class="field-grid">
            <div class="field field-wide">
              <span class="field-label">
                电池类型
                <span class="field-hint">算法随类型切换</span>
              </span>
              <div class="segmented" role="group" aria-label="电池类型">
                <button
                  type="button"
                  :class="{ active: form.batteryType === 'lead-acid' }"
                  @click="form.batteryType = 'lead-acid'"
                >
                  铅酸蓄电池
                </button>
                <button
                  type="button"
                  :class="{ active: form.batteryType === 'lithium' }"
                  @click="form.batteryType = 'lithium'"
                >
                  锂离子电池
                </button>
              </div>
            </div>

            <div class="field field-wide">
              <span class="field-label">
                负荷输入方式
                <span class="field-hint">UPS 容量或直接功率</span>
              </span>
              <div class="segmented" role="group" aria-label="负荷输入方式">
                <button
                  type="button"
                  :class="{ active: form.loadMode === 'ups' }"
                  @click="form.loadMode = 'ups'"
                >
                  按 UPS 容量
                </button>
                <button
                  type="button"
                  :class="{ active: form.loadMode === 'power' }"
                  @click="form.loadMode = 'power'"
                >
                  按负载功率
                </button>
              </div>
            </div>

            <template v-if="form.loadMode === 'ups'">
              <UnitField
                v-model="form.upsKva"
                label="UPS 额定容量 S"
                unit="kVA"
                :min="0"
                :step="1"
                hint="铭牌视在功率"
                data-symbol="S"
                :class="{ 'is-symbol-active': isActive('S') }"
              />
              <UnitField
                v-model="form.loadRate"
                label="负载率"
                :min="0.1"
                :max="1"
                :step="0.05"
                hint="0.8 = 80%"
                data-symbol="K_load"
                :class="{ 'is-symbol-active': isActive('K_load') }"
              />
              <UnitField
                v-if="!isSimple"
                v-model="form.powerFactor"
                label="输出功率因数 PF"
                :min="0.1"
                :max="1"
                :step="0.01"
                hint="UPS 负载功率因数"
                data-symbol="cosφ"
                :class="{ 'is-symbol-active': isActive('cosφ') }"
              />
            </template>
            <UnitField
              v-else
              v-model="form.loadPowerKw"
              label="负载有功功率 P"
              unit="kW"
              :min="0"
              :step="0.1"
              hint="实际负载功率"
              data-symbol="P"
              :class="{ 'is-symbol-active': isActive('P') }"
            />

            <UnitField
              v-model="form.backupMinutes"
              label="保障时长 T"
              unit="min"
              :min="1"
              :step="1"
              hint="UPS 电池后备时间"
              data-symbol="T"
              :class="{ 'is-symbol-active': isActive('T') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.ambientTempC"
              label="最低环境温度 t"
              unit="℃"
              :min="-20"
              :max="60"
              :step="1"
              hint="按电池室最不利温度"
              data-symbol="t"
              :class="{ 'is-symbol-active': isActive('t') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.efficiency"
              label="UPS 逆变效率 η"
              :min="0.5"
              :max="1"
              :step="0.01"
              hint="高频机约 0.94~0.96"
              data-symbol="η"
              :class="{ 'is-symbol-active': isActive('η') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.lineEfficiency"
              label="线路效率 η线"
              :min="0.8"
              :max="1"
              :step="0.01"
              hint="直流线路与变换损耗"
              data-symbol="η_line"
              :class="{ 'is-symbol-active': isActive('η_line') }"
            />
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <span class="panel-no">02</span>
            <h2>电池组参数</h2>
            <span class="panel-hint">STRING</span>
          </div>

          <div class="field-grid">
            <UnitField
              v-model="form.dcVoltage"
              label="电池组标称电压 U"
              unit="V"
              :min="12"
              :step="1"
              hint="UPS 直流母线电压"
              data-symbol="U"
              :class="{ 'is-symbol-active': isActive('U') }"
            />
            <UnitField
              v-if="!isSimple"
              v-model="form.designMargin"
              label="设计余量 K"
              :min="1"
              :max="2"
              :step="0.01"
              :hint="form.batteryType === 'lead-acid' ? 'GB 51194 取 1.25' : '常取 1.1~1.2'"
              data-symbol="K"
              :class="{ 'is-symbol-active': isActive('K') }"
            />

            <template v-if="form.batteryType === 'lead-acid' && !isSimple">
              <label
                class="field"
                data-symbol="cellVoltage"
                :class="{ 'is-symbol-active': isActive('cellVoltage') }"
              >
                <span class="field-label">
                  单体规格
                  <span class="field-hint">串联单元</span>
                </span>
                <select v-model="form.cellVoltage" class="select select-bordered select-sm w-full">
                  <option :value="2">2 V 单体</option>
                  <option :value="12">12 V 电池块（6 单体）</option>
                </select>
              </label>

              <UnitField
                v-model="form.endVoltagePerCell"
                label="终止电压"
                unit="V/单体"
                :min="1.5"
                :max="1.9"
                :step="0.01"
                hint="常取 1.75~1.80"
                data-symbol="U_end,cell"
                :class="{ 'is-symbol-active': isActive('U_end,cell') }"
              />
              <UnitField
                v-model="form.dcMinVoltage"
                label="UPS 最低直流输入"
                unit="V"
                :min="0"
                :step="1"
                hint="0 = 暂不校核"
                data-symbol="U_min"
                :class="{ 'is-symbol-active': isActive('U_min') }"
              />
              <UnitField
                v-model="form.capacityCoefficient"
                label="放电容量系数 η"
                :min="0.1"
                :max="1.2"
                :step="0.01"
                hint="0.5h≈0.42，1h≈0.52，10h≈1.0"
                data-symbol="η_ah"
                :class="{ 'is-symbol-active': isActive('η_ah') }"
              />
              <UnitField
                v-model="form.manufacturerWPerCell"
                label="厂家 W/单体"
                unit="W"
                :min="0"
                :step="1"
                hint="0 = 暂不校核"
                data-symbol="W_man"
                :class="{ 'is-symbol-active': isActive('W_man') }"
              />
              <UnitField
                v-model="form.maxParallelStrings"
                label="最大并联组数"
                unit="组"
                :min="1"
                :max="8"
                :step="1"
                hint="GB 51194 建议 ≤4"
                data-symbol="N_par"
                :class="{ 'is-symbol-active': isActive('N_par') }"
              />
            </template>

            <template v-else-if="form.batteryType === 'lithium' && !isSimple">
              <UnitField
                v-model="form.dod"
                label="放电深度 DOD"
                :min="0.1"
                :max="1"
                :step="0.01"
                hint="常取 0.8~0.9"
                data-symbol="DOD"
                :class="{ 'is-symbol-active': isActive('DOD') }"
              />
              <UnitField
                v-model="form.soh"
                label="寿命末期 SOH"
                :min="0.1"
                :max="1"
                :step="0.01"
                hint="常取 0.8"
                data-symbol="SOH"
                :class="{ 'is-symbol-active': isActive('SOH') }"
              />
              <UnitField
                v-model="form.tempDerating"
                label="温度降额 KT"
                :min="0.1"
                :max="2"
                :step="0.01"
                hint="25℃ 取 1.0，低温取大"
                data-symbol="KT"
                :class="{ 'is-symbol-active': isActive('KT') }"
              />
              <UnitField
                v-model="form.maxCRate"
                label="最大放电倍率"
                unit="C"
                :min="0.1"
                :max="10"
                :step="0.1"
                hint="按电芯/模组规格"
                data-symbol="C_max"
                :class="{ 'is-symbol-active': isActive('C_max') }"
              />
            </template>
          </div>

          <p class="field-note">
            <template v-if="form.batteryType === 'lead-acid'">
              当前按 {{ form.cellVoltage }} V 单元串联：
              <strong class="readout">{{ result?.seriesUnits ?? '—' }}</strong> 只 /
              <strong class="readout">{{ result?.seriesCells ?? '—' }}</strong> 个 2V 单体；
              实际直流电压 <strong class="readout">{{ result?.dcVoltageActual ?? '—' }} V</strong>。
              放电容量系数为典型值，正式设计请查标准表或厂家表。
            </template>
            <template v-else>
              锂电按能量法计算，不做铅酸 α 温度修正；DOD、SOH、KT 与倍率共同决定可用容量。
              大容量锂电房间设计可参考 T/CABEE 056-2023（团体标准）。
            </template>
          </p>

          <details v-if="isSimple" class="assumption-card" open>
            <summary>简易模式假定（固定值参与计算）</summary>
            <table class="assumption-table">
              <tbody>
                <tr v-for="item in simpleAssumptions" :key="item.label">
                  <th scope="row">{{ item.label }}</th>
                  <td class="readout">{{ item.value }}</td>
                  <td class="assumption-note">{{ item.note }}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </section>
      </div>

      <aside class="output-column">
        <div v-if="result" class="result-strip">
          <span class="strip-section">{{ result.configuredAh.toFixed(0) }} Ah</span>
          <span v-if="isSimple" class="strip-mode">简易</span>
          <span class="check-status" :class="result.overallPass ? 'is-pass' : 'is-fail'">
            {{ result.overallPass ? 'PASS' : 'REVIEW' }}
          </span>
          <span class="strip-driver">由 {{ result.drivers.join(' / ') }} 控制</span>
          <a class="strip-link" href="#verdict">跳到结论 ↓</a>
        </div>

        <details v-if="result" ref="calcBookRef" class="panel calc-panel">
          <summary>计算书（{{ calcSteps.length }} 步，点击展开）</summary>

          <div class="calc-book">
            <p v-if="isSimple" class="calc-mode-note">模式：简易（固定值见“简易模式假定”）</p>
            <details
              v-for="step in calcSteps"
              :id="`calc-${step.key}`"
              :key="step.key"
              class="calc-step"
              :class="{ 'is-fail': step.pass === false }"
            >
              <summary class="calc-step-head">
                <span class="calc-step-no">{{ step.index }}</span>
                <span class="calc-step-title">{{ step.title }}</span>
                <span class="calc-step-key">{{ step.keyValue }}</span>
                <span v-if="step.controlling" class="calc-step-flag">控制</span>
                <span
                  v-if="step.pass !== undefined"
                  class="check-status"
                  :class="step.pass ? 'is-pass' : 'is-fail'"
                >
                  {{ step.pass ? '通过' : '不通过' }}
                </span>
              </summary>

              <div class="calc-step-body">
                <p class="calc-formula">{{ step.formula }}</p>
                <p class="calc-substitution">{{ step.substitution }}</p>
                <p class="calc-result">{{ step.result }}</p>

                <div v-if="step.symbols.length" class="calc-symbols">
                  <button
                    v-for="symbol in step.symbols"
                    :key="`${step.key}-${symbol.symbol}`"
                    type="button"
                    class="symbol-chip"
                    :class="{ 'is-symbol-active': chipActive(symbol) }"
                    :data-symbol="symbol.inputSymbol"
                    :title="sourceTitle(symbol)"
                    @mouseenter="activateSymbol(symbol)"
                    @mouseleave="activeSymbol = ''"
                    @focus="activateSymbol(symbol)"
                    @blur="activeSymbol = ''"
                  >
                    <span class="symbol-name">{{ symbol.symbol }}</span>
                    <span class="symbol-value"
                      >{{ symbol.value }}{{ symbol.unit ? ` ${symbol.unit}` : '' }}</span
                    >
                    <span class="symbol-label">{{ symbol.name }}</span>
                    <span class="symbol-source" :class="`is-${symbol.source}`">
                      {{ sourceLabel(symbol.source) }}
                    </span>
                  </button>
                </div>

                <p v-if="step.note" class="calc-step-note">{{ step.note }}</p>
              </div>
            </details>
          </div>
        </details>

        <div
          v-if="result"
          id="verdict"
          class="verdict"
          :class="result.overallPass ? 'is-pass' : 'is-review'"
        >
          <div class="verdict-top">
            <span class="verdict-kicker">
              {{
                result.batteryType === 'lead-acid' ? 'LEAD-ACID / 安时法初选' : 'LITHIUM / 能量法'
              }}
            </span>
            <span class="verdict-stamp">{{ result.overallPass ? 'PASS' : 'REVIEW' }}</span>
          </div>

          <div class="verdict-main">
            <span class="verdict-section">{{ result.configuredAh.toFixed(0) }}</span>
            <span class="verdict-unit">Ah</span>
          </div>

          <p class="verdict-spec">{{ specLabel }}</p>
          <p class="verdict-sub">
            {{ result.overallPass ? '各项校核通过' : '存在需要复核的项' }} · 预估备电
            {{ result.estimatedRuntimeMinutes.toFixed(0) }} min
          </p>
          <p v-if="isSimple" class="verdict-mode">{{ simpleModeNote }}</p>

          <div class="verdict-metrics">
            <div>
              <span>负载功率</span>
              <strong>{{ result.loadPowerKw.toFixed(1) }} kW</strong>
            </div>
            <div>
              <span>放电电流</span>
              <strong>{{ result.dischargeCurrentA.toFixed(1) }} A</strong>
            </div>
            <div>
              <span>所需容量</span>
              <strong>{{ result.requiredAh.toFixed(0) }} Ah</strong>
            </div>
            <div>
              <span>{{ result.batteryType === 'lead-acid' ? '恒功率需求' : '放电倍率' }}</span>
              <strong>
                {{
                  result.batteryType === 'lead-acid'
                    ? `${result.requiredWPerCell.toFixed(0)} W/单体`
                    : `${result.cRate.toFixed(2)} C`
                }}
              </strong>
            </div>
          </div>
        </div>

        <div v-else class="panel empty-result">
          <PhWarningCircle aria-hidden="true" />
          <p>请输入有效的 UPS 容量或负载功率、备电时长、直流电压后查看估算结果。</p>
        </div>

        <div v-if="result" class="panel check-panel">
          <div class="panel-head compact">
            <span class="panel-no">✓</span>
            <h2>校核明细</h2>
            <span class="panel-hint">CHECKS</span>
          </div>

          <div class="check-list">
            <details
              v-for="check in checkDetails"
              :key="check.key"
              class="check-item"
              :class="{ 'is-fail': !check.pass }"
            >
              <summary class="check-item-head">
                <span class="check-item-label">{{ check.label }}</span>
                <span class="check-item-key">{{ check.keyValue }}</span>
                <span v-if="check.controlling" class="check-item-flag">控制</span>
                <span class="check-status" :class="check.pass ? 'is-pass' : 'is-fail'">
                  {{ check.pass ? '通过' : '不通过' }}
                </span>
              </summary>

              <div class="check-item-body">
                <p class="check-formula">{{ check.formula }}</p>
                <p class="check-substitution">{{ check.substitution }}</p>
                <p class="check-line">
                  <span class="check-line-label">要求</span>{{ check.required }}
                </p>
                <p class="check-line">
                  <span class="check-line-label">实际</span>{{ check.actual }}
                </p>
                <p class="check-line">
                  <span class="check-line-label">裕度</span>{{ check.margin }}
                </p>

                <div v-if="check.symbols.length" class="calc-symbols">
                  <button
                    v-for="symbol in check.symbols"
                    :key="`${check.key}-${symbol.symbol}`"
                    type="button"
                    class="symbol-chip"
                    :class="{ 'is-symbol-active': chipActive(symbol) }"
                    :data-symbol="symbol.inputSymbol"
                    :title="sourceTitle(symbol)"
                    @mouseenter="activateSymbol(symbol)"
                    @mouseleave="activeSymbol = ''"
                    @focus="activateSymbol(symbol)"
                    @blur="activeSymbol = ''"
                  >
                    <span class="symbol-name">{{ symbol.symbol }}</span>
                    <span class="symbol-value"
                      >{{ symbol.value }}{{ symbol.unit ? ` ${symbol.unit}` : '' }}</span
                    >
                    <span class="symbol-label">{{ symbol.name }}</span>
                    <span class="symbol-source" :class="`is-${symbol.source}`">
                      {{ sourceLabel(symbol.source) }}
                    </span>
                  </button>
                </div>

                <p class="check-why">{{ check.why }}</p>
                <button
                  v-if="check.stepKey"
                  type="button"
                  class="check-link"
                  @click="openCalcStep(check.stepKey)"
                >
                  查看计算书 {{ check.stepLabel }}
                </button>
              </div>
            </details>
          </div>
        </div>

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
            铅酸容量公式来自 GB 51194-2016《通信电源设备安装工程设计规范》；备用时间底线来自 GB
            50174-2017《数据中心设计规范》附录 A。
          </p>
          <ul>
            <li>
              GB 50174-2017 附录 A：A 级 UPS 电池最少 15 min、B 级 7
              min（柴油发电机作为后备电源时）； C 级按实际需要。该标准不给出 Ah 算法。
            </li>
            <li>
              GB 51194-2016：Q = K·I·T / (η·[1+α(t−25)])；K 取 1.25；α 按放电小时率取 0.006 / 0.008
              / 0.01；UPS 电池并联组数不宜超过 4 组。
            </li>
            <li>
              铅酸产品参数按 GB/T 19638.1-2014、GB/T 19638.2-2014 核对；额定容量通常按 25 ℃、10h
              率、1.80 V/单体标定。
            </li>
            <li>
              电力直流系统可参考 DL/T 5044-2014 的阶梯法；UPS 交流负载更推荐厂家恒功率放电表。
            </li>
            <li>
              锂电安全与产品：GB 40165-2021、GB/T 36276-2023；储能电站布置与安全：GB 51048-2014、
              GB/T 42288-2022；数据中心锂电房间：T/CABEE 056-2023（团体标准）。
            </li>
            <li>
              温度：铅酸容量按最低环境温度修正，寿命按最高环境温度校核；锂电按厂家温度降额曲线和 BMS
              充放电窗口，不能直接套用铅酸 α。
            </li>
          </ul>
        </details>
      </aside>
    </div>

    <details class="panel param-panel">
      <summary>参数说明</summary>
      <div class="table-wrap">
        <table class="param-table">
          <thead>
            <tr>
              <th>符号</th>
              <th>名称</th>
              <th>含义</th>
              <th>在计算中的位置</th>
              <th>影响方向</th>
              <th>来源</th>
              <th>可修改</th>
              <th>依据</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="doc in parameterDocs" :key="doc.symbol">
              <td class="readout">{{ doc.symbol }}</td>
              <td>{{ doc.name }}</td>
              <td>{{ doc.meaning }}</td>
              <td>{{ doc.position }}</td>
              <td>{{ doc.impact }}</td>
              <td>{{ doc.source }}</td>
              <td>{{ doc.editable }}</td>
              <td>{{ doc.basis }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import {
  PhArrowCounterClockwise,
  PhBatteryCharging,
  PhCopy,
  PhInfo,
  PhWarningCircle,
} from '@phosphor-icons/vue'
import { useToast } from '@/composables/useToast'
import { getToolById } from '../toolData'
import UnitField from './UnitField.vue'
import {
  SIMPLE_MODE_FIXED,
  calculateBatterySizing,
  createDefaultInput,
  createSimpleInput,
  simpleCapacityCoefficient,
  simpleDcMinVoltage,
  type BatterySizingInput,
} from './batterySizing'
import {
  buildBatterySteps,
  buildParameterDocs,
  type CalcSymbol,
  type SymbolSource,
} from './calculationSteps'
import { buildBatteryCheckDetails } from './checkDetails'
import '@/assets/calc-trace.css'

const toolConfig = getToolById('battery_sizing')
const toast = useToast()

type UiMode = 'simple' | 'professional'
const UI_MODE_KEY = 'dls.battery-sizing.ui-mode.v1'

const uiMode = ref<UiMode>('simple')
const isSimple = computed(() => uiMode.value === 'simple')
/** 简易 / 专业各存一份快照，切换模式不丢用户已填值 */
const modeSnapshots: Record<UiMode, BatterySizingInput> = {
  simple: createSimpleInput(),
  professional: createDefaultInput(),
}

const form = reactive<BatterySizingInput>({ ...modeSnapshots.simple })
const copied = ref(false)

const result = computed(() => calculateBatterySizing({ ...form }))

interface AssumptionItem {
  label: string
  value: string
  note: string
}

const simpleAssumptions = computed<AssumptionItem[]>(() => {
  const items: AssumptionItem[] = [
    {
      label: 'cosφ 输出功率因数',
      value: SIMPLE_MODE_FIXED.powerFactor.toFixed(2),
      note: 'UPS 负载功率因数典型值',
    },
    {
      label: 'η 逆变效率',
      value: SIMPLE_MODE_FIXED.efficiency.toFixed(2),
      note: '高频机典型效率',
    },
    {
      label: 'η线 线路效率',
      value: SIMPLE_MODE_FIXED.lineEfficiency.toFixed(2),
      note: '直流线路与变换损耗',
    },
    {
      label: 't 最低环境温度',
      value: `${SIMPLE_MODE_FIXED.ambientTempC} ℃`,
      note: '电池室偏低时所需容量更大，请切专业模式',
    },
    {
      label: 'K 设计余量',
      value: form.batteryType === 'lead-acid' ? '1.25' : '1.20',
      note: form.batteryType === 'lead-acid' ? 'GB 51194 常用值' : '锂电常用值',
    },
  ]

  if (form.batteryType === 'lead-acid') {
    items.push(
      {
        label: '单体规格',
        value: `${SIMPLE_MODE_FIXED.cellVoltage} V`,
        note: '12 V 电池块（6 只 2 V 单体）',
      },
      {
        label: '终止电压',
        value: `${SIMPLE_MODE_FIXED.endVoltagePerCell.toFixed(2)} V/单体`,
        note: '常见终止电压',
      },
      {
        label: 'UPS 最低直流输入',
        value: `${simpleDcMinVoltage(form.dcVoltage)} V`,
        note: '按 0.85 × 标称电压粗校核',
      },
      {
        label: 'η_ah 放电容量系数',
        value: form.capacityCoefficient.toFixed(2),
        note: `按备电 ${form.backupMinutes} min 查表自动取值`,
      },
      {
        label: '厂家 W/单体',
        value: '不校核',
        note: '需要恒功率复核时请切专业模式',
      },
      {
        label: '最大并联组数',
        value: `${SIMPLE_MODE_FIXED.maxParallelStrings} 组`,
        note: 'GB 51194 建议值',
      },
    )
  } else {
    items.push(
      { label: 'DOD 放电深度', value: SIMPLE_MODE_FIXED.dod.toFixed(2), note: '常规放电深度' },
      { label: 'SOH 寿命末期', value: SIMPLE_MODE_FIXED.soh.toFixed(2), note: '常取 0.8' },
      { label: 'KT 温度降额', value: SIMPLE_MODE_FIXED.tempDerating.toFixed(2), note: '25 ℃ 基准' },
      {
        label: 'C_max 最大倍率',
        value: `${SIMPLE_MODE_FIXED.maxCRate.toFixed(2)} C`,
        note: '常规持续倍率',
      },
    )
  }

  return items
})

const simpleModeNote = computed(() => {
  const base = `简易模式：cosφ=${SIMPLE_MODE_FIXED.powerFactor}、η=${SIMPLE_MODE_FIXED.efficiency}、η线=${SIMPLE_MODE_FIXED.lineEfficiency}、${SIMPLE_MODE_FIXED.ambientTempC} ℃、K=${form.batteryType === 'lead-acid' ? SIMPLE_MODE_FIXED.designMarginLeadAcid : SIMPLE_MODE_FIXED.designMarginLithium}`
  return form.batteryType === 'lead-acid'
    ? `${base}、η_ah 按备电时长查表、U_min=0.85×标称、厂家 W/单体未输入。`
    : `${base}、DOD ${SIMPLE_MODE_FIXED.dod}、SOH ${SIMPLE_MODE_FIXED.soh}、KT ${SIMPLE_MODE_FIXED.tempDerating}、C_max ${SIMPLE_MODE_FIXED.maxCRate} C。`
})

function persistUiMode(mode: UiMode) {
  try {
    window.localStorage.setItem(UI_MODE_KEY, mode)
  } catch {
    /* localStorage 不可用时忽略 */
  }
}

function setUiMode(mode: UiMode, silent = false) {
  if (mode === uiMode.value) return
  Object.assign(modeSnapshots[uiMode.value], { ...form })
  uiMode.value = mode
  Object.assign(form, { ...modeSnapshots[mode] })
  persistUiMode(mode)
  if (silent) return
  toast.info(
    mode === 'simple'
      ? '已切到简易模式：高级参数按固定值参与计算'
      : '已切到专业模式：可继续调整高级参数',
  )
}

onMounted(() => {
  try {
    const saved = window.localStorage.getItem(UI_MODE_KEY)
    if (saved === 'professional') setUiMode('professional', true)
  } catch {
    /* localStorage 不可用时忽略 */
  }
})

// 简易模式：备电时长决定容量系数，标称电压决定 UPS 最低直流输入的粗校核值
watch(
  () => form.backupMinutes,
  (minutes) => {
    if (!isSimple.value) return
    form.capacityCoefficient = simpleCapacityCoefficient(Number(minutes))
  },
)

watch(
  () => form.dcVoltage,
  (voltage) => {
    if (!isSimple.value) return
    form.dcMinVoltage = simpleDcMinVoltage(Number(voltage))
  },
)

const specLabel = computed(() => {
  const value = result.value
  if (!value) return ''
  if (value.batteryType === 'lead-acid') {
    return `${value.seriesUnits} 只 ${form.cellVoltage}V 单元串联 · ${value.parallelStrings} 组并联 · ${value.unitAh.toFixed(0)} Ah/组`
  }
  return `${value.dcVoltageActual.toFixed(0)} V 直流 · ${value.configuredEnergyKwh.toFixed(1)} kWh · ${value.cRate.toFixed(2)} C`
})

const activeSymbol = ref('')
const parameterDocs = buildParameterDocs()
const calcSteps = computed(() =>
  result.value ? buildBatterySteps({ ...form }, result.value, { simple: isSimple.value }) : [],
)
const checkDetails = computed(() => {
  const value = result.value
  if (!value) return []
  return buildBatteryCheckDetails({ ...form }, value)
})
const calcBookRef = ref<HTMLDetailsElement | null>(null)

function openCalcStep(key?: string) {
  if (!key) return
  if (calcBookRef.value) calcBookRef.value.open = true
  nextTick(() => {
    const target = document.getElementById(`calc-${key}`)
    if (target instanceof HTMLDetailsElement) target.open = true
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

function isActive(symbolName: string): boolean {
  return activeSymbol.value === symbolName
}

function activateSymbol(symbol: CalcSymbol) {
  activeSymbol.value = symbol.inputSymbol ?? symbol.symbol
}

function chipActive(symbol: CalcSymbol): boolean {
  return (
    activeSymbol.value === symbol.symbol ||
    (symbol.inputSymbol !== undefined && activeSymbol.value === symbol.inputSymbol)
  )
}

const SOURCE_LABELS: Record<SymbolSource, string> = {
  input: '输入',
  table: '查表',
  calc: '计算',
  constant: '常数',
  default: '默认',
}

function sourceLabel(source: SymbolSource): string {
  return SOURCE_LABELS[source]
}

function sourceTitle(symbol: CalcSymbol): string {
  const detail = symbol.sourceDetail ? ` · ${symbol.sourceDetail}` : ''
  return `${symbol.name}：${sourceLabel(symbol.source)}${detail}`
}

function resetForm() {
  const next = isSimple.value ? createSimpleInput() : createDefaultInput()
  Object.assign(form, next)
  Object.assign(modeSnapshots[uiMode.value], { ...next })
  toast.info(isSimple.value ? '已恢复简易模式默认参数' : '已恢复默认参数')
}

function buildReport(): string {
  const value = result.value
  if (!value) return ''

  const lines = [
    '蓄电池容量估算书（方案初选）',
    `电池类型：${value.batteryType === 'lead-acid' ? '铅酸蓄电池' : '锂离子电池'}`,
    ...(isSimple.value ? [`模式：简易（${simpleModeNote.value.replace(/^简易模式：/, '')}）`] : []),
    `负荷：${value.loadPowerKw.toFixed(2)} kW；备电时长：${value.backupMinutes} min；环境温度：${form.ambientTempC} ℃`,
    `直流电压：${value.dcVoltageActual.toFixed(0)} V；设计余量 K：${form.designMargin}`,
    ...(value.batteryType === 'lead-acid'
      ? [
          `终止电压：${value.seriesCells} × ${value.endVoltagePerCellActual.toFixed(2)} = ${value.endVoltageActual.toFixed(0)} V`,
        ]
      : []),
    `放电电流：${value.dischargeCurrentA.toFixed(2)} A`,
    `所需容量：${value.requiredAh.toFixed(1)} Ah`,
    value.batteryType === 'lead-acid'
      ? `推荐配置：${value.unitAh.toFixed(0)} Ah × ${value.parallelStrings} 组 = ${value.configuredAh.toFixed(0)} Ah`
      : `推荐配置：${value.unitAh.toFixed(0)} Ah · ${value.configuredEnergyKwh.toFixed(1)} kWh`,
    `预估备电：${value.estimatedRuntimeMinutes.toFixed(0)} min`,
    `控制项：${value.drivers.join(' / ') || '—'}`,
    `结论：${value.overallPass ? '各项校核通过' : '存在需要复核的项'}`,
    '',
    '计算书：',
    ...calcSteps.value.flatMap((step) => [
      `${step.index}. ${step.title}：${step.formula.replace(/\n/g, '；')}`,
      `   代入：${step.substitution}`,
      `   结果：${step.result}`,
    ]),
    '',
    '校核明细：',
    ...value.checks.map(
      (check) =>
        `- ${check.label}：${check.pass ? '通过' : '复核'}；要求 ${check.required}；实际 ${check.actual}`,
    ),
    '',
    '注：本计算书为方案初选，正式设计应按现行标准、厂家放电表及注册电气工程师意见复核。',
  ]
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
.battery-page {
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

/* 简易 / 专业模式 */

.mode-switch {
  flex: 0 0 auto;
  min-width: 7.5rem;
}

.notice-simple {
  border-color: color-mix(in oklab, var(--color-warning) 38%, var(--color-base-300));
  background-color: color-mix(in oklab, var(--color-warning) 6%, var(--color-base-100));
}

.notice-simple svg {
  color: var(--color-warning);
}

.assumption-card {
  margin: 0 0.85rem 0.85rem;
  border: 1px solid color-mix(in oklab, var(--color-warning) 30%, var(--color-base-300));
  background-color: color-mix(in oklab, var(--color-warning) 4%, var(--color-base-100));
}

.assumption-card > summary {
  padding: 0.45rem 0.6rem;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.assumption-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10.5px;
}

.assumption-table th,
.assumption-table td {
  padding: 0.3rem 0.6rem;
  text-align: left;
  vertical-align: top;
  border-top: 1px dashed color-mix(in oklab, var(--color-base-300) 70%, transparent);
}

.assumption-table th {
  width: 34%;
  font-weight: 500;
  color: var(--text-muted);
}

.assumption-note {
  color: var(--text-faint);
}

.verdict-mode {
  margin-top: 0.45rem;
  padding: 0.35rem 0.5rem;
  font-size: 10.5px;
  line-height: 1.55;
  color: var(--text-muted);
  border: 1px dashed var(--color-base-300);
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
  .battery-page {
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
