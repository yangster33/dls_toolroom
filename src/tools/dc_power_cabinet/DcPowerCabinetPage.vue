<template>
  <div class="cabinet-page">
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
        容量按 <span class="readout">GB 51194-2016</span> 第 5.3
        节：整流器按近期负荷配置，满架容量考虑远期； 柜体外形尺寸国标不强制，工具给出的是按
        <span class="readout">GB/T 3047.1</span> /
        <span class="readout">GB/T 19520.1</span> 的工程建议。
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
            <div class="field field-wide">
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
            />
            <UnitField
              v-else
              v-model="form.loadPowerKw"
              label="近期负荷功率 P"
              unit="kW"
              :min="0"
              :step="0.1"
              hint="按设备铭牌统计"
            />
            <UnitField
              v-model="form.futureGrowth"
              label="远期/近期负荷比"
              :min="1"
              :max="3"
              :step="0.05"
              hint="1.3 = 预留 30%"
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
            />
            <UnitField
              v-model="form.chargeRate"
              label="均充倍率"
              :min="0"
              :max="0.3"
              :step="0.01"
              hint="0.1 = 0.1C10"
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
            />
            <UnitField
              v-model="form.moduleDerating"
              label="模块降额系数"
              :min="0.1"
              :max="1.2"
              :step="0.01"
              hint="高温/高海拔取小"
            />

            <div class="field field-wide">
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
              v-model="form.moduleU"
              label="单模块占用 U"
              unit="U"
              :min="0.5"
              :step="0.5"
              hint="1U/2U 按厂家"
            />
            <UnitField
              v-model="form.reserveU"
              label="监控/配电/备用 U"
              unit="U"
              :min="0"
              :step="1"
              hint="常取 6~10U"
            />
          </div>

          <p class="field-note">
            主用模块数 N = ⌈(近期负荷 + 均充) / (模块额定 × 降额)⌉；N+1 即再加 1 个备用模块。
          </p>
        </section>

        <section class="panel">
          <div class="panel-head">
            <span class="panel-no">04</span>
            <h2>柜体与交流进线</h2>
            <span class="panel-hint">CABINET</span>
          </div>

          <div class="field-grid">
            <label class="field">
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
            />
            <UnitField
              v-model="form.cabinetWidthMm"
              label="拟用柜宽"
              unit="mm"
              :min="400"
              :step="50"
              hint="常用 600/800"
            />
            <UnitField
              v-model="form.cabinetDepthMm"
              label="拟用柜深"
              unit="mm"
              :min="400"
              :step="50"
              hint="常用 600/800"
            />

            <div class="field field-wide">
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
            />
            <UnitField
              v-model="form.acPowerFactor"
              label="交流功率因数 PF"
              :min="0.1"
              :max="1"
              :step="0.01"
              hint="约 0.99"
            />
            <UnitField
              v-model="form.breakerMargin"
              label="断路器余量"
              :min="1"
              :max="2"
              :step="0.05"
              hint="常取 1.25"
            />
          </div>

          <p class="field-note">
            柜宽/深只作布置校核；最终尺寸按 GB/T 3047.1 的 20mm 进制系列和厂家型谱确定。
          </p>
        </section>
      </div>

      <aside class="output-column">
        <div v-if="result" class="verdict" :class="result.overallPass ? 'is-pass' : 'is-review'">
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
          <div class="panel-head compact">
            <span class="panel-no">▣</span>
            <h2>柜体与配电建议</h2>
            <span class="panel-hint">CABINET</span>
          </div>

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
            <div>
              <dt>近期负荷电流</dt>
              <dd class="readout">I_L = {{ result.loadCurrentA.toFixed(2) }} A</dd>
            </div>
            <div>
              <dt>均充电流</dt>
              <dd class="readout">
                I_c = Q × k = {{ form.batteryAh }} × {{ form.chargeRate }} =
                {{ result.chargeCurrentA.toFixed(2) }} A
              </dd>
            </div>
            <div>
              <dt>近期设计电流</dt>
              <dd class="readout">I_d = I_L + I_c = {{ result.designCurrentA.toFixed(2) }} A</dd>
            </div>
            <div>
              <dt>远期电流</dt>
              <dd class="readout">
                I_f = I_d × {{ form.futureGrowth }} = {{ result.frameCurrentA.toFixed(2) }} A
              </dd>
            </div>
            <div>
              <dt>模块有效电流</dt>
              <dd class="readout">
                I_m = {{ form.moduleCurrentA }} × {{ form.moduleDerating }} =
                {{ result.moduleEffectiveA.toFixed(1) }} A
              </dd>
            </div>
            <div>
              <dt>主用模块数</dt>
              <dd class="readout">
                N = ⌈{{ result.designCurrentA.toFixed(1) }} /
                {{ result.moduleEffectiveA.toFixed(1) }} ⌉ = {{ result.mainModules }}
              </dd>
            </div>
            <div>
              <dt>满架模块数</dt>
              <dd class="readout">
                ⌈{{ result.frameCurrentA.toFixed(1) }} / {{ result.moduleEffectiveA.toFixed(1) }}⌉ +
                {{ result.redundantModules }} = {{ result.frameModules }}
              </dd>
            </div>
            <div>
              <dt>柜体 U 位</dt>
              <dd class="readout">
                {{ result.frameModules }} × {{ form.moduleU }} + {{ form.reserveU }} =
                {{ result.requiredU }}U
              </dd>
            </div>
            <div>
              <dt>直流主断路器</dt>
              <dd class="readout">
                {{ result.designCurrentA.toFixed(1) }} × {{ form.breakerMargin }} →
                {{ result.mainBreakerA }} A
              </dd>
            </div>
            <div>
              <dt>交流输入</dt>
              <dd class="readout">
                P_ac = {{ result.dcOutputPowerKw.toFixed(2) }} / {{ form.rectifierEfficiency }} =
                {{ result.acInputPowerKw.toFixed(2) }} kW；I_ac =
                {{ result.acInputCurrentA.toFixed(2) }} A
              </dd>
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
import { useToast } from '@/composables/useToast'
import { getToolById } from '../toolData'
import UnitField from '@/tools/shared/components/UnitField.vue'
import {
  CABINET_HEIGHTS,
  calculateDcCabinet,
  createDefaultInput,
  voltageLabelFor,
  type AcPhase,
  type DcCabinetInput,
} from './dcPowerCabinet'

const toolConfig = getToolById('dc_power_cabinet')
const toast = useToast()

const form = reactive<DcCabinetInput>(createDefaultInput())
const copied = ref(false)

const result = computed(() => calculateDcCabinet({ ...form }))

const specLabel = computed(() => {
  const value = result.value
  if (!value) return ''
  return `${value.voltageLabel} · ${form.moduleCurrentA}A × ${value.totalModules}（${value.mainModules}+${value.redundantModules}）· ${value.recommendedWidthMm}×${value.recommendedDepthMm}×${value.recommendedHeightMm} mm`
})

function setAcPhase(phase: AcPhase) {
  form.acPhase = phase
  form.acVoltage = phase === 3 ? 380 : 220
}

function resetForm() {
  Object.assign(form, createDefaultInput())
  toast.info('已恢复默认参数')
}

function buildReport(): string {
  const value = result.value
  if (!value) return ''

  const lines = [
    '通信直流电源柜选型计算书（方案初选）',
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
    `结论：${value.overallPass ? '各项校核通过' : '存在需要复核的项'}`,
    '',
    '校核明细：',
    ...value.checks.map(
      (check) =>
        `- ${check.label}：${check.pass ? '通过' : '复核'}；要求 ${check.required}；实际 ${check.actual}`,
    ),
    '',
    '注：柜体宽×深×高为工程建议，GB 51194 不规定柜体外形尺寸；正式设计应按现行标准、厂家型谱和注册电气工程师意见复核。',
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
.cabinet-page {
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

.segmented {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--color-base-300);
}

.segmented.three {
  grid-template-columns: repeat(3, 1fr);
}

.segmented.four {
  grid-template-columns: repeat(4, 1fr);
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
  .cabinet-page {
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
