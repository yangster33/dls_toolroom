<template>
  <div class="cable-page">
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
        本页用于方案初选：载流量、电压降、短路热稳定、机械强度四类约束同时校核，取最大标准截面。
        内置载流量表为常用值整理，施工图应由注册电气工程师按现行
        <span class="readout">GB/T 16895.6</span>、<span class="readout">GB 50054</span>、<span
          class="readout"
          >GB 50217</span
        >
        及电缆厂家数据复核。
      </p>
    </div>

    <div class="workbench">
      <div class="input-column">
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
              label="标称电压 U"
              unit="V"
              :min="1"
              :step="1"
              hint="线电压 / 直流电压"
            />

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
              label="负载功率 P"
              unit="kW"
              :min="0"
              :step="0.1"
              hint="设备额定有功功率"
            />
            <UnitField
              v-else
              v-model="form.currentA"
              label="负载电流 Ib"
              unit="A"
              :min="0"
              :step="0.1"
              hint="直接按计算电流选型"
            />

            <UnitField
              v-model="form.powerFactor"
              label="功率因数 cosφ"
              :min="0.1"
              :max="1"
              :step="0.01"
              :disabled="form.system === 'dc'"
              :hint="form.system === 'dc' ? '直流忽略' : '无功补偿后取值'"
            />

            <UnitField
              v-model="form.efficiency"
              label="效率 η"
              :min="0.1"
              :max="1"
              :step="0.01"
              hint="电机 / 电源效率"
            />

            <UnitField
              v-if="form.inputMode === 'power'"
              v-model="form.demandFactor"
              label="需要系数 Kd"
              :min="0.1"
              :max="1"
              :step="0.05"
              hint="满载取 1.00"
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

            <UnitField
              v-model="form.ambientTempC"
              :label="ambientLabel"
              unit="℃"
              :min="-20"
              :max="100"
              :step="1"
              :hint="isBuried ? '按土壤温度修正' : '按空气温度修正'"
            />

            <UnitField
              v-model="form.lengthM"
              label="线路长度 L"
              unit="m"
              :min="0"
              :step="1"
              hint="单程敷设长度"
            />

            <UnitField
              v-model="form.groupedCircuits"
              label="并列回路数"
              unit="回"
              :min="1"
              :max="12"
              :step="1"
              hint="相互贴邻的负载回路"
            />

            <UnitField
              v-model="form.parallelCables"
              label="每相并联电缆"
              unit="根"
              :min="1"
              :max="4"
              :step="1"
              hint="大电流时使用"
            />

            <UnitField
              v-model="form.reactanceOhmPerKm"
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
              label="允许电压降"
              unit="%"
              :min="0.1"
              :max="20"
              :step="0.1"
              hint="照明 / 动力按规范取值"
            />

            <UnitField
              v-model="form.shortCircuitKa"
              label="短路电流 Isc"
              unit="kA"
              :min="0"
              :max="100"
              :step="0.1"
              hint="安装处预期短路电流"
            />

            <UnitField
              v-model="form.clearingTimeS"
              label="保护动作时间 t"
              unit="s"
              :min="0.01"
              :max="5"
              :step="0.01"
              hint="用于热稳定校核"
            />

            <label class="field">
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
          </div>

          <p class="field-note">
            当前绝缘最高工作温度
            <strong class="readout">{{ insulationInfo.maxTemp }} ℃</strong>
            · 热稳定系数
            <strong class="readout">k = {{ result?.thermalK ?? '—' }}</strong>
            · 自动匹配时取不小于 Ib 的最小标准壳架。
          </p>
        </section>
      </div>

      <aside class="output-column">
        <div v-if="result" class="verdict" :class="result.overallPass ? 'is-pass' : 'is-review'">
          <div class="verdict-top">
            <span class="verdict-kicker">推荐方案 / PRELIMINARY</span>
            <span class="verdict-stamp">{{ result.overallPass ? 'PASS' : 'REVIEW' }}</span>
          </div>

          <div class="verdict-main">
            <span class="verdict-section">{{ formatSection(result.selectedSection) }}</span>
            <span class="verdict-unit">mm² / 相</span>
          </div>

          <p class="verdict-spec">{{ result.cableLabel }}</p>
          <p class="verdict-sub">
            {{ result.parallelCables }} 根/相并联 · 由 {{ result.drivers.join(' / ') }} 控制
          </p>

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

        <div v-if="result" class="panel check-panel">
          <div class="panel-head compact">
            <span class="panel-no">✓</span>
            <h2>校核明细</h2>
            <span class="panel-hint">取最大约束</span>
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
                      {{ check.pass ? '通过' : '不通过' }}
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
            <div>
              <dt>计算负荷</dt>
              <dd class="readout">
                <template v-if="form.inputMode === 'power'">
                  Pjs = {{ form.powerKw || 0 }} × {{ form.demandFactor || 0 }} =
                  {{ result.designPowerKw.toFixed(2) }} kW
                </template>
                <template v-else>
                  由负载电流反算：{{ result.designPowerKw.toFixed(2) }} kW
                </template>
              </dd>
            </div>
            <div>
              <dt>计算电流</dt>
              <dd class="readout">Ib = {{ result.designCurrentA.toFixed(2) }} A</dd>
            </div>
            <div>
              <dt>载流量修正</dt>
              <dd class="readout">
                kt = {{ result.temperatureFactor.toFixed(2) }}，kg =
                {{ result.groupFactor.toFixed(2) }}，Iz,req =
                {{ result.requiredBaseAmpacityA.toFixed(1) }} A
              </dd>
            </div>
            <div>
              <dt>线路阻抗</dt>
              <dd class="readout">
                R = {{ result.resistanceMilliohm.toFixed(2) }} mΩ，X =
                {{ result.reactanceMilliohm.toFixed(2) }} mΩ
              </dd>
            </div>
            <div>
              <dt>电压降</dt>
              <dd class="readout">
                ΔU = {{ result.voltageDropV.toFixed(1) }} V（{{
                  result.voltageDropPercent.toFixed(2)
                }}
                %）
              </dd>
            </div>
            <div>
              <dt>短路热稳定</dt>
              <dd class="readout">
                Smin = Isc·√t / k = {{ result.shortCircuitMinSection.toFixed(1) }} mm²
              </dd>
            </div>
            <div>
              <dt>保护配合</dt>
              <dd class="readout">
                In = {{ result.breakerRatingA.toFixed(0) }} A（{{
                  result.breakerAuto ? '自动' : '手动'
                }}）
              </dd>
            </div>
            <div>
              <dt>线路损耗</dt>
              <dd class="readout">{{ result.lineLossW.toFixed(0) }} W（满载时估算）</dd>
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
          <p>{{ AMPACITY_DATA_NOTE }}</p>
          <ul>
            <li>载流量修正：GB/T 16895.6-2014 附录 B；低压设计：GB 50054-2011、GB 51348-2019。</li>
            <li>电力电缆：GB 50217-2018；通用规范：GB 55024-2022。</li>
            <li>三相电压降：ΔU = √3·I·L·(R·cosφ + X·sinφ)；单相 / 直流按往返 2 倍计算。</li>
            <li>
              短路热稳定：S ≥ Isc·√t / k；k 按铜/PVC 115、铜/XLPE 143、铝/PVC 76、铝/XLPE 94 取值。
            </li>
            <li>机械强度：铜芯固定敷设最小 1.5 mm²；铝芯固定敷设最小 10 mm²。</li>
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
  PhLightning,
  PhWarningCircle,
} from '@phosphor-icons/vue'
import { useToast } from '@/composables/useToast'
import { getToolById } from '../toolData'
import UnitField from './UnitField.vue'
import {
  AMPACITY_DATA_NOTE,
  INSULATION_OPTIONS,
  INSTALLATION_OPTIONS,
  MATERIAL_OPTIONS,
  SYSTEM_OPTIONS,
  calculateCableSizing,
  createDefaultInput,
  formatSection,
  type CableSizingInput,
} from './cableSizing'

const toolConfig = getToolById('cable_sizing')
const toast = useToast()

const form = reactive<CableSizingInput>(createDefaultInput())
const copied = ref(false)

const result = computed(() => calculateCableSizing({ ...form }))

const methodInfo = computed(
  () =>
    INSTALLATION_OPTIONS.find((option) => option.key === form.method) ?? INSTALLATION_OPTIONS[0]!,
)

const insulationInfo = computed(
  () =>
    INSULATION_OPTIONS.find((option) => option.key === form.insulation) ?? INSULATION_OPTIONS[0]!,
)

const isBuried = computed(() => methodInfo.value.buried)
const ambientLabel = computed(() => (isBuried.value ? '土壤温度' : '环境温度'))

watch(
  () => form.system,
  (system) => {
    const option = SYSTEM_OPTIONS.find((item) => item.key === system)
    if (option) form.voltage = option.defaultVoltage
  },
)

function resetForm() {
  Object.assign(form, createDefaultInput())
  toast.info('已恢复默认参数')
}

function buildReport(): string {
  if (!result.value) return ''
  const value = result.value
  const lines = [
    '电缆选型计算书（方案初选）',
    `系统：${SYSTEM_OPTIONS.find((item) => item.key === form.system)?.label ?? form.system}`,
    `标称电压：${form.voltage} V；线路长度：${form.lengthM} m`,
    `导体 / 绝缘：${form.material === 'cu' ? '铜芯' : '铝芯'} / ${insulationInfo.value.shortLabel}`,
    `敷设方式：${methodInfo.value.label}；环境温度：${form.ambientTempC} ℃；并列回路：${form.groupedCircuits} 回`,
    `计算电流 Ib：${value.designCurrentA.toFixed(2)} A`,
    `推荐截面：${formatSection(value.selectedSection)} mm²/相 × ${value.parallelCables} 根/相`,
    `推荐规格：${value.cableLabel}`,
    `校正载流量 Iz：${value.totalAmpacityA.toFixed(1)} A（${value.ampacityPerCableA.toFixed(1)} A/根）`,
    `电压降：${value.voltageDropV.toFixed(1)} V（${value.voltageDropPercent.toFixed(2)} %）`,
    `短路热稳定最小截面：${value.shortCircuitMinSection.toFixed(1)} mm²（k=${value.thermalK}）`,
    `断路器 In：${value.breakerRatingA.toFixed(0)} A（${value.breakerAuto ? '自动' : '手动'}）`,
    `结论：${value.overallPass ? '各项校核通过' : '存在未通过项，需调整参数'}`,
    '',
    '校核明细：',
    ...value.checks.map(
      (check) =>
        `- ${check.label}：${check.pass ? '通过' : '不通过'}；要求 ${check.required}；实际 ${check.actual}`,
    ),
    '',
    '注：本计算书为方案初选，施工图应由注册电气工程师按现行标准及厂家数据复核。',
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
.cable-page {
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

.field-grid .field-note {
  padding: 0;
  margin-top: -0.2rem;
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
  .cable-page {
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
