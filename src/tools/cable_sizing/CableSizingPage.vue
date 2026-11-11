<template>
  <div class="cable-page calc-trace selection-tool">
    <header class="page-head">
      <div class="page-title">
        <p class="eyebrow">
          <PhLightning weight="fill" aria-hidden="true" />
          LOW VOLTAGE CABLE SIZING / 0.6–1 kV
        </p>
        <h1>{{ toolConfig?.name || '电缆选型计算' }}</h1>
        <p class="page-desc">
          {{
            toolConfig?.description || '按载流量、电压降、短路热稳定与保护配合校核低压电缆截面。'
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
        本页用于方案初选：载流量、电压降、短路热稳定、机械强度、保护配合五类约束同时校核，取最大标准截面。
        内置载流量表为常用值整理，施工图应由注册电气工程师按现行
        <span class="readout">GB/T 16895.6</span>、<span class="readout">GB 50054</span>、<span
          class="readout"
          >GB 50217</span
        >
        及电缆厂家数据复核。
      </p>
    </div>

    <div v-if="isSimple" class="notice notice-simple">
      <PhInfo weight="fill" aria-hidden="true" />
      <p>
        简易模式按阻性负荷 cosφ=1、η=1、Kd=1
        计算；电机、变压器等感性负荷请切「专业」模式，或改用「按电流」输入。
      </p>
    </div>

    <div class="workbench">
      <div
        class="input-column"
        @mouseover="handleSymbolOver"
        @mouseleave="activeSymbol = ''"
        @focusin="handleSymbolOver"
        @focusout="handleSymbolOut"
      >
        <section class="panel">
          <div class="panel-head">
            <span class="panel-no">01</span>
            <h2>系统与负荷</h2>
            <span class="panel-hint">LOAD</span>
          </div>

          <div class="field-grid">
            <label class="field">
              <span class="field-label">系统类型</span>
              <select v-model="form.system" class="select select-bordered select-sm w-full">
                <option v-for="option in SYSTEM_OPTIONS" :key="option.key" :value="option.key">
                  {{ option.label }}
                </option>
              </select>
            </label>

            <UnitField
              v-model="form.voltage"
              data-symbol="U"
              :class="{ 'is-symbol-active': isActive('U') }"
              label="标称电压 U"
              unit="V"
              :min="1"
              :step="1"
              hint="线电压 / 直流电压"
            />

            <template v-if="form.system === 'dc' && !isSimple">
              <label class="field">
                <span class="field-label">
                  直流回路类型
                  <span class="field-hint">{{ dcCircuitInfo.hint }}</span>
                </span>
                <select
                  v-model="form.dcCircuitType"
                  class="select select-bordered select-sm w-full"
                >
                  <option
                    v-for="option in DC_CIRCUIT_TYPE_OPTIONS"
                    :key="option.key"
                    :value="option.key"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <label class="field">
                <span class="field-label">
                  导线制式
                  <span class="field-hint">{{ dcWiringInfo.hint }}</span>
                </span>
                <select v-model="form.dcWiring" class="select select-bordered select-sm w-full">
                  <option v-for="option in DC_WIRING_OPTIONS" :key="option.key" :value="option.key">
                    {{ option.label }}
                  </option>
                </select>
              </label>
            </template>

            <div class="field field-wide">
              <span class="field-label">
                负荷输入方式
                <span class="field-hint">按功率或按已知电流</span>
              </span>
              <div class="segmented" role="group" aria-label="负荷输入方式">
                <button
                  type="button"
                  :class="{ active: form.inputMode === 'power' }"
                  @click="form.inputMode = 'power'"
                >
                  按功率
                </button>
                <button
                  type="button"
                  :class="{ active: form.inputMode === 'current' }"
                  @click="form.inputMode = 'current'"
                >
                  按电流
                </button>
              </div>
            </div>

            <UnitField
              v-if="form.inputMode === 'power'"
              v-model="form.powerKw"
              data-symbol="P"
              :class="{ 'is-symbol-active': isActive('P') }"
              label="负载功率 P"
              unit="kW"
              :min="0"
              :step="0.1"
              hint="电机为轴功率"
            />
            <UnitField
              v-else
              v-model="form.currentA"
              data-symbol="Ib"
              :class="{ 'is-symbol-active': isActive('Ib') }"
              label="负载电流 Ib"
              unit="A"
              :min="0"
              :step="0.1"
              hint="直接按计算电流选型"
            />

            <UnitField
              v-if="!isSimple"
              v-model="form.powerFactor"
              data-symbol="cosφ"
              :class="{ 'is-symbol-active': isActive('cosφ') }"
              label="功率因数 cosφ"
              :min="0.1"
              :max="1"
              :step="0.01"
              :disabled="form.system === 'dc'"
              :hint="form.system === 'dc' ? '直流忽略' : '无功补偿后取值'"
            />

            <UnitField
              v-if="form.system === 'three-phase' && !isSimple"
              v-model="form.harmonicThdPercent"
              data-symbol="h3"
              :class="{ 'is-symbol-active': isActive('h3') }"
              label="3 次谐波含量"
              unit="%"
              :min="0"
              :max="100"
              :step="1"
              hint="无谐波填 0"
            />

            <UnitField
              v-if="!isSimple"
              v-model="form.efficiency"
              data-symbol="η"
              :class="{ 'is-symbol-active': isActive('η') }"
              label="效率 η"
              :min="0.1"
              :max="1"
              :step="0.01"
              hint="P 为轴功率时填，否则 1.00"
            />

            <UnitField
              v-if="form.inputMode === 'power' && !isSimple"
              v-model="form.demandFactor"
              data-symbol="Kd"
              :class="{ 'is-symbol-active': isActive('Kd') }"
              label="需要系数 Kd"
              :min="0.1"
              :max="1"
              :step="0.05"
              hint="单台 / 单回路取 1.00"
            />
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <span class="panel-no">02</span>
            <h2>电缆与敷设</h2>
            <span class="panel-hint">INSTALLATION</span>
          </div>

          <div class="field-grid">
            <label class="field">
              <span class="field-label">导体材料</span>
              <select v-model="form.material" class="select select-bordered select-sm w-full">
                <option v-for="option in MATERIAL_OPTIONS" :key="option.key" :value="option.key">
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="field">
              <span class="field-label">绝缘材料</span>
              <select v-model="form.insulation" class="select select-bordered select-sm w-full">
                <option v-for="option in INSULATION_OPTIONS" :key="option.key" :value="option.key">
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="field field-wide">
              <span class="field-label">
                敷设方式
                <span class="field-hint">按 GB/T 16895.6 附录 B</span>
              </span>
              <select v-model="form.method" class="select select-bordered select-sm w-full">
                <option
                  v-for="option in INSTALLATION_OPTIONS"
                  :key="option.key"
                  :value="option.key"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <p class="field-note field-wide">
              {{ methodInfo.description }}
            </p>

            <template v-if="form.system === 'dc' && !isSimple">
              <label class="field field-wide">
                <span class="field-label">
                  载流量数据源
                  <span class="field-hint">{{ dcAmpacitySourceInfo.hint }}</span>
                </span>
                <select
                  v-model="form.dcAmpacitySource"
                  class="select select-bordered select-sm w-full"
                >
                  <option
                    v-for="option in DC_AMPACITY_SOURCE_OPTIONS"
                    :key="option.key"
                    :value="option.key"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <template v-if="form.dcAmpacitySource === 'manufacturer'">
                <label class="field field-wide">
                  <span class="field-label">
                    厂家 / 表名
                    <span class="field-hint">仅用于展示和计算书</span>
                  </span>
                  <input
                    v-model="form.dcManufacturerName"
                    type="text"
                    class="input input-bordered input-sm w-full"
                    placeholder="例如：XX 厂家 DC 载流量表"
                  />
                </label>

                <div class="field field-wide">
                  <div class="dc-table-head">
                    <span class="field-label">
                      厂家 DC 表（{{ manufacturerComboLabel }}）
                      <span class="field-hint">16 个标准截面</span>
                    </span>
                    <div class="dc-table-actions">
                      <button
                        type="button"
                        class="btn btn-xs"
                        @click="fillManufacturerFromStandard"
                      >
                        按标准表填充
                      </button>
                      <button
                        type="button"
                        class="btn btn-xs"
                        @click="form.dcAmpacitySource = 'standard'"
                      >
                        恢复国家标准表
                      </button>
                    </div>
                  </div>
                  <div class="dc-table">
                    <label
                      v-for="(section, index) in STANDARD_SECTIONS"
                      :key="section"
                      class="dc-cell"
                    >
                      <span class="dc-cell-label">{{ section }} mm²</span>
                      <input
                        v-model.number="form.dcManufacturerAmpacity[index]"
                        type="number"
                        min="0"
                        step="0.1"
                        class="input input-bordered input-xs w-full readout"
                      />
                    </label>
                  </div>
                  <p v-if="manufacturerTableInvalid" class="field-note is-warn">
                    未填满 16 个有效值，引擎会回退国家标准表。
                  </p>
                </div>
              </template>
            </template>

            <template v-if="isBuried && !isSimple">
              <label class="field" data-symbol="s" :class="{ 'is-symbol-active': isActive('s') }">
                <span class="field-label">
                  电缆间距
                  <span class="field-hint">按 B.52.18</span>
                </span>
                <select
                  v-model="form.buriedSpacing"
                  class="select select-bordered select-sm w-full"
                >
                  <option
                    v-for="option in BURIED_SPACING_OPTIONS"
                    :key="option.key"
                    :value="option.key"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <UnitField
                v-model="form.soilThermalResistivity"
                data-symbol="ρ"
                :class="{ 'is-symbol-active': isActive('ρ') }"
                label="土壤热阻率"
                unit="K·m/W"
                :min="0.5"
                :max="3"
                :step="0.1"
                hint="基准 2.5"
              />
            </template>

            <UnitField
              v-if="!isSimple"
              v-model="form.ambientTempC"
              data-symbol="θ"
              :class="{ 'is-symbol-active': isActive('θ') }"
              :label="ambientLabel"
              unit="℃"
              :min="-20"
              :max="100"
              :step="1"
              :hint="isBuried ? '按土壤温度修正' : '按空气温度修正'"
            />

            <UnitField
              v-model="form.lengthM"
              data-symbol="L"
              :class="{ 'is-symbol-active': isActive('L') }"
              label="线路长度 L"
              unit="m"
              :min="0"
              :step="1"
              hint="单程敷设长度"
            />

            <UnitField
              v-if="!isSimple"
              v-model="form.groupedCircuits"
              data-symbol="G"
              :class="{ 'is-symbol-active': isActive('G') }"
              label="并列回路数"
              unit="回"
              :min="1"
              :max="12"
              :step="1"
              hint="相互贴邻的负载回路"
            />

            <UnitField
              v-if="!isSimple"
              v-model="form.parallelCables"
              data-symbol="n"
              :class="{ 'is-symbol-active': isActive('n') }"
              label="每相并联电缆"
              unit="根"
              :min="1"
              :max="4"
              :step="1"
              hint="大电流时使用"
            />

            <UnitField
              v-if="!isSimple"
              v-model="form.reactanceOhmPerKm"
              data-symbol="X"
              :class="{ 'is-symbol-active': isActive('X') }"
              label="线路电抗 X"
              unit="Ω/km"
              :min="0"
              :max="1"
              :step="0.01"
              hint="多芯电缆约 0.08"
            />
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <span class="panel-no">03</span>
            <h2>校核条件</h2>
            <span class="panel-hint">CHECKS</span>
          </div>

          <div class="field-grid">
            <UnitField
              v-model="form.allowedDropPercent"
              data-symbol="U%"
              :class="{ 'is-symbol-active': isActive('U%') }"
              label="允许电压降"
              unit="%"
              :min="0.1"
              :max="20"
              :step="0.1"
              hint="照明 / 动力按规范取值"
            />

            <div v-if="form.system === 'dc'" class="field field-wide">
              <span class="field-label">
                直流压降预设
                <span class="field-hint">-48V 常见 3%–5%</span>
              </span>
              <div class="segmented" role="group" aria-label="直流压降预设">
                <button
                  type="button"
                  :class="{ active: form.allowedDropPercent === 3 }"
                  @click="form.allowedDropPercent = 3"
                >
                  3%
                </button>
                <button
                  type="button"
                  :class="{ active: form.allowedDropPercent === 5 }"
                  @click="form.allowedDropPercent = 5"
                >
                  5%
                </button>
              </div>
            </div>

            <UnitField
              v-if="!isSimple"
              v-model="form.shortCircuitKa"
              data-symbol="Isc"
              :class="{ 'is-symbol-active': isActive('Isc') }"
              label="短路电流 Isc"
              unit="kA"
              :min="0"
              :max="100"
              :step="0.1"
              hint="安装处预期短路电流"
            />

            <UnitField
              v-if="!isSimple"
              v-model="form.clearingTimeS"
              data-symbol="t"
              :class="{ 'is-symbol-active': isActive('t') }"
              label="保护动作时间 t"
              unit="s"
              :min="0.01"
              :max="5"
              :step="0.01"
              hint="用于热稳定校核"
            />

            <label
              v-if="!isSimple"
              class="field"
              data-symbol="In"
              :class="{ 'is-symbol-active': isActive('In') }"
            >
              <span class="field-label">
                断路器额定电流 In
                <span class="field-hint">0 = 自动</span>
              </span>
              <input
                v-model.number="form.breakerRatingA"
                type="number"
                min="0"
                step="1"
                placeholder="0 = 自动匹配"
                class="input input-bordered input-sm w-full readout"
              />
            </label>

            <label v-if="!isSimple" class="field">
              <span class="field-label">
                保护电器类型
                <span class="field-hint">{{
                  form.system === 'dc' ? 'DC 按样本复核' : '熔断器按 k3'
                }}</span>
              </span>
              <select
                v-model="form.protectionDevice"
                class="select select-bordered select-sm w-full"
              >
                <option
                  v-for="option in PROTECTION_DEVICE_OPTIONS"
                  :key="option.key"
                  :value="option.key"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <template v-if="form.system !== 'dc' && !isSimple">
              <div class="field field-wide">
                <span class="field-label">
                  电机启动校核
                  <span class="field-hint">动力负荷可选</span>
                </span>
                <div class="segmented" role="group" aria-label="电机启动校核">
                  <button
                    type="button"
                    :class="{ active: !form.motorStarting }"
                    @click="form.motorStarting = false"
                  >
                    不校核
                  </button>
                  <button
                    type="button"
                    :class="{ active: form.motorStarting }"
                    @click="form.motorStarting = true"
                  >
                    校核
                  </button>
                </div>
              </div>

              <template v-if="form.motorStarting">
                <UnitField
                  v-model="form.startingCurrentMultiple"
                  data-symbol="k_start"
                  :class="{ 'is-symbol-active': isActive('k_start') }"
                  label="启动电流倍数"
                  unit="×Ib"
                  :min="1"
                  :max="12"
                  :step="0.5"
                  hint="直接启动约 6"
                />

                <UnitField
                  v-model="form.allowedStartingDropPercent"
                  data-symbol="ΔU_start"
                  :class="{ 'is-symbol-active': isActive('ΔU_start') }"
                  label="启动允许压降"
                  unit="%"
                  :min="1"
                  :max="50"
                  :step="1"
                  hint="常用 15"
                />
              </template>
            </template>
          </div>

          <p class="field-note">
            当前绝缘最高工作温度
            <strong class="readout">{{ insulationInfo.maxTemp }} ℃</strong>
            · 热稳定系数
            <strong class="readout">k = {{ result?.thermalK ?? '—' }}</strong>
            · 保护电器
            <strong class="readout">{{ protectionInfo.label }}</strong>
            · 自动匹配时取不小于 Ib 的最小标准壳架。
          </p>

          <p v-if="form.system === 'dc'" class="field-note">
            直流模式只做电缆校核；DC 断路器/熔断器需按 DC 电压下的 Icu/Ics、极性和 L/R
            时间常数复核。
          </p>

          <AssumptionCard v-if="isSimple" :items="simpleAssumptions" />
        </section>
      </div>

      <aside class="output-column">
        <ResultStrip
          v-if="result"
          :value="`${formatSection(result.selectedSection)} mm² / 相`"
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
            <span class="verdict-kicker">推荐方案 / PRELIMINARY</span>
            <span class="verdict-stamp">{{ result.overallPass ? 'PASS' : 'REVIEW' }}</span>
          </div>

          <div class="verdict-main">
            <span class="verdict-section">{{ formatSection(result.selectedSection) }}</span>
            <span class="verdict-unit">mm² / 相</span>
          </div>

          <p class="verdict-spec">{{ result.cableLabel }}</p>
          <p v-if="form.system === 'dc'" class="verdict-sub">
            {{ result.dcCircuitLabel }} · {{ result.dcWiringLabel }} ·
            {{ result.ampacitySourceLabel }}
          </p>
          <p class="verdict-sub">
            {{ result.parallelCables > 1 ? `${result.parallelCables} 根/相并联` : '单根敷设' }} · 由
            {{ result.drivers.join(' / ') }} 控制
          </p>

          <p class="verdict-why">{{ verdictWhy }}</p>

          <p v-if="isSimple" class="verdict-mode">{{ simpleModeNote }}</p>

          <div class="verdict-metrics">
            <div>
              <span>计算电流</span>
              <strong>{{ result.designCurrentA.toFixed(1) }} A</strong>
            </div>
            <div>
              <span>校正载流量</span>
              <strong>{{ result.totalAmpacityA.toFixed(1) }} A</strong>
            </div>
            <div>
              <span>电压降</span>
              <strong>{{ result.voltageDropPercent.toFixed(2) }} %</strong>
            </div>
            <div>
              <span>热稳定最小截面</span>
              <strong>{{ formatSection(result.shortCircuitMinSection) }} mm²</strong>
            </div>
          </div>
        </div>

        <div v-else class="panel empty-result">
          <PhWarningCircle aria-hidden="true" />
          <p>请输入有效的系统电压、负荷功率或电流、线路长度后查看选型结果。</p>
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

        <CheckList
          v-if="result"
          :details="checkDetails"
          :active-symbol="activeSymbol"
          @activate="activateSymbol"
          @deactivate="deactivate"
          @open-step="openCalcStep"
        />

        <details class="panel source-panel">
          <summary>数据与依据</summary>
          <p>{{ AMPACITY_DATA_NOTE }}</p>
          <ul>
            <li>
              成束修正：GB/T 16895.6-2014 附录 B 表 B.52.17（空气按敷设方式）、表
              B.52.18（埋地按间距）。
            </li>
            <li>温度修正：表 B.52.14 / B.52.15；土壤热阻率：表 B.52.16；三次谐波：表 E.52.1。</li>
            <li v-if="form.system === 'dc'">
              直流：载流量按 3 根导体表保守取值，或使用厂家 DC 表；压降按 2×I×L×R；保护电器按 DC
              样本复核。
            </li>
            <li>
              低压设计：GB 50054-2011、GB 51348-2019；电力电缆：GB 50217-2018；通用规范：GB
              55024-2022。
            </li>
            <li>三相电压降：ΔU = √3·I·L·(R·cosφ + X·sinφ)；单相 / 直流按往返 2 倍计算。</li>
            <li>
              短路热稳定：S ≥ Isc·√t / k；k 按铜/PVC 115、铜/XLPE 143、铝/PVC 76、铝/XLPE 94 取值。
            </li>
            <li>保护配合：MCB/MCCB 按 In ≤ Iz；熔断器 gG 按 In ≤ Iz / k3（k3 = 1.31 / 1.10）。</li>
            <li>
              负荷换算：Pjs = P × Kd；Kd 为用电设备组经验系数，单台设备 / 单回路线取 1.00。效率 η
              仅用于把电机轴功率换算成输入电流，电缆选型标准（GB/T 16895.5/.6、GB 50054、GB
              50217）不要求该参数。
            </li>
            <li>机械强度：铜芯固定敷设最小 1.5 mm²；铝芯固定敷设最小 10 mm²。</li>
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
  PhLightning,
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
import { formatCheckLines } from '@/tools/shared/report'
import { useCopyText } from '@/tools/shared/useCopyText'
import { useSymbolLink } from '@/tools/shared/useSymbolLink'
import { useUiMode } from '@/tools/shared/useUiMode'
import '@/assets/selection-tool.css'
import {
  AMPACITY_DATA_NOTE,
  BURIED_SPACING_OPTIONS,
  DC_AMPACITY_SOURCE_OPTIONS,
  DC_CIRCUIT_TYPE_OPTIONS,
  DC_WIRING_OPTIONS,
  INSULATION_OPTIONS,
  INSTALLATION_OPTIONS,
  MATERIAL_OPTIONS,
  PROTECTION_DEVICE_OPTIONS,
  STANDARD_SECTIONS,
  SIMPLE_MODE_FIXED,
  SYSTEM_OPTIONS,
  calculateCableSizing,
  createDefaultInput,
  createSimpleInput,
  formatSection,
  type CableSizingInput,
} from './cableSizing'
import { AMPACITY } from './ampacityTables'
import { buildCalculationSteps, buildParameterDocs } from './calculationSteps'
import { buildCheckDetails } from './checkDetails'
import '@/assets/calc-trace.css'

const toolConfig = getToolById('cable_sizing')

function cloneInput(input: CableSizingInput): CableSizingInput {
  return { ...input, dcManufacturerAmpacity: [...input.dcManufacturerAmpacity] }
}

const form = reactive<CableSizingInput>(createSimpleInput())
const { uiMode, isSimple, setUiMode, reset } = useUiMode<CableSizingInput>({
  storageKey: 'dls.cable-sizing.ui-mode.v1',
  createSimple: createSimpleInput,
  createDefault: createDefaultInput,
  getForm: () => cloneInput(form),
  setForm: (next) => Object.assign(form, cloneInput(next)),
  clone: cloneInput,
})
const { activeSymbol, isActive, activateSymbol, deactivate } = useSymbolLink()
const { copied, copy } = useCopyText()

const result = computed(() => calculateCableSizing({ ...form }))

interface AssumptionItem {
  label: string
  value: string
  note: string
}

const simpleAssumptions = computed<AssumptionItem[]>(() => {
  const items: AssumptionItem[] = [
    { label: 'cosφ 功率因数', value: '1.00', note: '按阻性负荷；感性负荷请切专业模式' },
    { label: 'η 效率', value: '1.00', note: '不计效率损失' },
    { label: 'Kd 需要系数', value: '1.00', note: '按满载' },
    { label: 'h3 三次谐波', value: '0 %', note: '不计谐波与中性线电流' },
    { label: '并列回路 / 并联', value: '1 回 / 1 根', note: '单回路、单根敷设' },
    {
      label: 'X 线路电抗',
      value: `${SIMPLE_MODE_FIXED.reactanceOhmPerKm} Ω/km`,
      note: '常量，计算书标“默认”',
    },
    {
      label: 'Isc / t',
      value: `${SIMPLE_MODE_FIXED.shortCircuitKa} kA / ${SIMPLE_MODE_FIXED.clearingTimeS} s`,
      note: '短路热稳定按假定值校核',
    },
    { label: 'In 断路器', value: '自动匹配', note: '取不小于 Ib 的最小标准壳架' },
    { label: '保护电器', value: '微型断路器 MCB', note: '按 In ≤ Iz 校核' },
    { label: '电机启动校核', value: '不校核', note: '动力负荷请切专业模式' },
    {
      label: '环境 / 土壤温度',
      value: `${SIMPLE_MODE_FIXED.ambientTempC} ℃`,
      note: form.method === 'D' ? '直埋按 40 ℃ 土壤，偏保守' : '按空气温度修正',
    },
  ]
  if (form.method === 'D') {
    items.push({ label: '埋地间距 / 土壤热阻率', value: '相触 / 2.5 K·m/W', note: '仅 D 直埋' })
  }
  if (form.system === 'dc') {
    items.push({
      label: '直流回路 / 制式 / 载流量源',
      value: '负荷回路 / 2 线 / 国家标准表',
      note: '厂家 DC 表在简易模式隐藏',
    })
  }
  return items
})

const simpleModeNote = computed(
  () =>
    `简易模式：cosφ=1、η=1、Kd=1、Isc 按假定 ${SIMPLE_MODE_FIXED.shortCircuitKa} kA、t=${SIMPLE_MODE_FIXED.clearingTimeS} s、环境 ${SIMPLE_MODE_FIXED.ambientTempC} ℃、In 自动、MCB。`,
)

const parameterDocs = buildParameterDocs()
const calcSteps = computed(() => (result.value ? buildCalculationSteps(form, result.value) : []))
const checkDetails = computed(() => {
  const value = result.value
  if (!value) return []
  const details = buildCheckDetails(form, value)
  if (!isSimple.value) return details
  return details.map((detail) =>
    detail.key === 'thermal'
      ? {
          ...detail,
          why: `${detail.why}（短路电流按假定 ${SIMPLE_MODE_FIXED.shortCircuitKa} kA）`,
        }
      : detail,
  )
})
const calcBookRef = ref<InstanceType<typeof CalcBook> | null>(null)

function openCalcStep(key?: string) {
  if (key) calcBookRef.value?.openStep(key)
}

const methodInfo = computed(
  () =>
    INSTALLATION_OPTIONS.find((option) => option.key === form.method) ?? INSTALLATION_OPTIONS[0]!,
)

const insulationInfo = computed(
  () =>
    INSULATION_OPTIONS.find((option) => option.key === form.insulation) ?? INSULATION_OPTIONS[0]!,
)

const protectionInfo = computed(
  () =>
    PROTECTION_DEVICE_OPTIONS.find((option) => option.key === form.protectionDevice) ??
    PROTECTION_DEVICE_OPTIONS[0]!,
)

const materialInfo = computed(
  () => MATERIAL_OPTIONS.find((option) => option.key === form.material) ?? MATERIAL_OPTIONS[0]!,
)

const dcCircuitInfo = computed(
  () =>
    DC_CIRCUIT_TYPE_OPTIONS.find((option) => option.key === form.dcCircuitType) ??
    DC_CIRCUIT_TYPE_OPTIONS[0]!,
)

const dcWiringInfo = computed(
  () => DC_WIRING_OPTIONS.find((option) => option.key === form.dcWiring) ?? DC_WIRING_OPTIONS[0]!,
)

const dcAmpacitySourceInfo = computed(
  () =>
    DC_AMPACITY_SOURCE_OPTIONS.find((option) => option.key === form.dcAmpacitySource) ??
    DC_AMPACITY_SOURCE_OPTIONS[0]!,
)

const manufacturerComboLabel = computed(
  () => `${materialInfo.value.shortLabel} / ${insulationInfo.value.shortLabel} / ${form.method}`,
)

const manufacturerTableInvalid = computed(
  () =>
    form.dcAmpacitySource === 'manufacturer' &&
    (form.dcManufacturerAmpacity.length !== STANDARD_SECTIONS.length ||
      form.dcManufacturerAmpacity.some((value) => !Number.isFinite(value) || value <= 0)),
)

function fillManufacturerFromStandard() {
  form.dcManufacturerAmpacity = [...AMPACITY[form.material][form.insulation][form.method]]
}

function ensureManufacturerTable() {
  if (form.dcManufacturerAmpacity.length !== STANDARD_SECTIONS.length) {
    fillManufacturerFromStandard()
  }
}

watch(
  () => form.dcAmpacitySource,
  (source) => {
    if (source === 'manufacturer') ensureManufacturerTable()
  },
)

watch(
  () => form.system,
  (system, previous) => {
    if (system === 'dc' && previous !== 'dc') {
      if (form.inputMode === 'power' && form.powerKw === 30) form.powerKw = 1
      if (form.lengthM === 80) form.lengthM = 30
    }
  },
)

watch(
  () => [form.material, form.insulation, form.method],
  () => {
    if (form.dcAmpacitySource === 'manufacturer') fillManufacturerFromStandard()
  },
)

const verdictWhy = computed(() => {
  const value = result.value
  if (!value) return ''
  const limit = value.fuseK3 ? value.totalAmpacityA / value.fuseK3 : value.totalAmpacityA
  const limitLabel = value.fuseK3 ? 'Iz/k3' : 'Iz'
  const protectionText = value.protectionPass
    ? `保护电器 ${value.breakerRatingA.toFixed(0)} A 不超过 ${limitLabel} ${limit.toFixed(1)} A`
    : `保护电器 ${value.breakerRatingA.toFixed(0)} A 超出 ${limitLabel} ${limit.toFixed(1)} A`
  const parts = [
    `计算电流 ${value.designCurrentA.toFixed(1)} A`,
    `按 ${methodInfo.value.label}、${form.ambientTempC} ℃、${value.groupingCount} 根成束修正后，${formatSection(value.selectedSection)} mm² 的允许载流量 ${value.totalAmpacityA.toFixed(1)} A`,
    `压降 ${value.voltageDropPercent.toFixed(2)}%`,
    `热稳定要求至少 ${value.shortCircuitMinSection.toFixed(1)} mm²`,
    protectionText,
  ]
  const conclusion = value.overallPass
    ? `各项校核通过，最终取 ${formatSection(value.selectedSection)} mm²。`
    : `存在未通过项，当前方案为 ${formatSection(value.selectedSection)} mm²，需调整参数。`
  return `${parts.join('；')}。${conclusion}`
})

const isBuried = computed(() => methodInfo.value.buried)
const ambientLabel = computed(() => (isBuried.value ? '土壤温度' : '环境温度'))

watch(
  () => form.system,
  (system) => {
    const option = SYSTEM_OPTIONS.find((item) => item.key === system)
    if (option) form.voltage = option.defaultVoltage
  },
)

watch(
  () => form.method,
  (method) => {
    const buried = INSTALLATION_OPTIONS.find((option) => option.key === method)?.buried ?? false
    if (buried && form.ambientTempC === 35) {
      form.ambientTempC = 20
    } else if (!buried && form.ambientTempC === 20) {
      form.ambientTempC = 35
    }
  },
)

function handleSymbolOver(event: Event) {
  const target = event.target as HTMLElement | null
  activeSymbol.value = target?.closest<HTMLElement>('[data-symbol]')?.dataset.symbol ?? ''
}

function handleSymbolOut(event: FocusEvent) {
  const next = event.relatedTarget as HTMLElement | null
  if (!next?.closest('[data-symbol]')) activeSymbol.value = ''
}

function buildReport(): string {
  if (!result.value) return ''
  const value = result.value
  const lines = [
    '电缆选型计算书（方案初选）',
    `系统：${SYSTEM_OPTIONS.find((item) => item.key === form.system)?.label ?? form.system}`,
    ...(isSimple.value
      ? [
          `模式：简易（cosφ=1、η=1、Kd=1、Isc=${SIMPLE_MODE_FIXED.shortCircuitKa} kA 假定、t=${SIMPLE_MODE_FIXED.clearingTimeS} s、${SIMPLE_MODE_FIXED.ambientTempC} ℃、In 自动、MCB）`,
        ]
      : []),
    `标称电压：${form.voltage} V；线路长度：${form.lengthM} m`,
    ...(form.system === 'dc'
      ? [
          `直流回路：${value.dcCircuitLabel}；导线制式：${value.dcWiringLabel}；载流量数据源：${value.ampacitySourceLabel}`,
        ]
      : []),
    `导体 / 绝缘：${form.material === 'cu' ? '铜芯' : '铝芯'} / ${insulationInfo.value.shortLabel}`,
    `敷设方式：${methodInfo.value.label}；${isBuried.value ? '土壤' : '环境'}温度：${form.ambientTempC} ℃；并列回路：${form.groupedCircuits} 回`,
    `${form.system === 'dc' ? value.dcCircuitLabel : '计算电流 Ib'}：${value.designCurrentA.toFixed(2)} A${value.neutralCurrentA > 0 ? `；中性线电流 IN：${value.neutralCurrentA.toFixed(2)} A` : ''}`,
    `推荐截面：${formatSection(value.selectedSection)} mm²/相 × ${value.parallelCables} 根/相`,
    `推荐规格：${value.cableLabel}`,
    `校正载流量 Iz：${value.totalAmpacityA.toFixed(1)} A（${value.ampacityPerCableA.toFixed(1)} A/根）`,
    form.system === 'dc'
      ? `修正系数：kt=${value.temperatureFactor.toFixed(2)}，kg=${value.groupFactor.toFixed(2)}（${value.groupingCount} 根），ks=${value.soilFactor.toFixed(2)}；${value.ampacitySourceLabel}`
      : `修正系数：kt=${value.temperatureFactor.toFixed(2)}，kg=${value.groupFactor.toFixed(2)}（${value.groupingCount} 根），ks=${value.soilFactor.toFixed(2)}，kh=${value.harmonicFactor.toFixed(2)}`,
    `电压降：${value.voltageDropV.toFixed(1)} V（${value.voltageDropPercent.toFixed(2)} %）`,
    `短路热稳定最小截面：${value.shortCircuitMinSection.toFixed(1)} mm²（k=${value.thermalK}）`,
    `保护电器：${protectionInfo.value.label}；In=${value.breakerRatingA.toFixed(0)} A（${value.breakerAuto ? '自动' : '手动'}）` +
      (value.fuseK3 ? `，k3=${value.fuseK3.toFixed(2)}` : ''),
    ...(form.system === 'dc'
      ? []
      : [
          `电机启动压降：${value.startingVoltageDropPercent === null ? '未校核' : value.startingVoltageDropPercent.toFixed(2) + ' %'}`,
        ]),
    `结论：${value.overallPass ? '各项校核通过' : '存在未通过项，需调整参数'}`,
    '',
    '校核明细：',
    ...formatCheckLines(value.checks),
    '',
    '注：本计算书为方案初选，施工图应由注册电气工程师按现行标准及厂家数据复核。',
  ]
  return lines.join('\n')
}
</script>

<style scoped>
.cable-page {
  padding: 1rem 1.25rem 1.5rem;
}

/* 厂家直流电缆表 */
.dc-table-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.dc-table-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.dc-table {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.35rem;
}

.dc-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.dc-cell-label {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .cable-page {
    padding: 0.75rem;
  }

  .dc-table {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
