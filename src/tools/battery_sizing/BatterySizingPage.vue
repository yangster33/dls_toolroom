<template>
  <div class="battery-page">
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
        铅酸按 <span class="readout">GB 51194-2016</span> 安时法初选，再用厂家恒功率表复核；锂电按能量法叠加
        DOD、SOH、温度降额与倍率校核。<span class="readout">GB 50174-2017</span>
        只规定最少备用时间，不规定容量算法。结果用于方案初选，施工图应由注册电气工程师复核。
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
              />
              <UnitField
                v-model="form.loadRate"
                label="负载率"
                :min="0.1"
                :max="1"
                :step="0.05"
                hint="0.8 = 80%"
              />
              <UnitField
                v-model="form.powerFactor"
                label="输出功率因数 PF"
                :min="0.1"
                :max="1"
                :step="0.01"
                hint="UPS 负载功率因数"
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
            />

            <UnitField
              v-model="form.backupMinutes"
              label="保障时长 T"
              unit="min"
              :min="1"
              :step="1"
              hint="UPS 电池后备时间"
            />
            <UnitField
              v-model="form.ambientTempC"
              label="最低环境温度 t"
              unit="℃"
              :min="-20"
              :max="60"
              :step="1"
              hint="按电池室最不利温度"
            />
            <UnitField
              v-model="form.efficiency"
              label="UPS 逆变效率 η"
              :min="0.5"
              :max="1"
              :step="0.01"
              hint="高频机约 0.94~0.96"
            />
            <UnitField
              v-model="form.lineEfficiency"
              label="线路效率 η线"
              :min="0.8"
              :max="1"
              :step="0.01"
              hint="直流线路与变换损耗"
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
            />
            <UnitField
              v-model="form.designMargin"
              label="设计余量 K"
              :min="1"
              :max="2"
              :step="0.01"
              :hint="form.batteryType === 'lead-acid' ? 'GB 51194 取 1.25' : '常取 1.1~1.2'"
            />

            <template v-if="form.batteryType === 'lead-acid'">
              <label class="field">
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
              />
              <UnitField
                v-model="form.dcMinVoltage"
                label="UPS 最低直流输入"
                unit="V"
                :min="0"
                :step="1"
                hint="0 = 暂不校核"
              />
              <UnitField
                v-model="form.capacityCoefficient"
                label="放电容量系数 η"
                :min="0.1"
                :max="1.2"
                :step="0.01"
                hint="0.5h≈0.42，1h≈0.52，10h≈1.0"
              />
              <UnitField
                v-model="form.manufacturerWPerCell"
                label="厂家 W/单体"
                unit="W"
                :min="0"
                :step="1"
                hint="0 = 暂不校核"
              />
              <UnitField
                v-model="form.maxParallelStrings"
                label="最大并联组数"
                unit="组"
                :min="1"
                :max="8"
                :step="1"
                hint="GB 51194 建议 ≤4"
              />
            </template>

            <template v-else>
              <UnitField
                v-model="form.dod"
                label="放电深度 DOD"
                :min="0.1"
                :max="1"
                :step="0.01"
                hint="常取 0.8~0.9"
              />
              <UnitField
                v-model="form.soh"
                label="寿命末期 SOH"
                :min="0.1"
                :max="1"
                :step="0.01"
                hint="常取 0.8"
              />
              <UnitField
                v-model="form.tempDerating"
                label="温度降额 KT"
                :min="0.1"
                :max="2"
                :step="0.01"
                hint="25℃ 取 1.0，低温取大"
              />
              <UnitField
                v-model="form.maxCRate"
                label="最大放电倍率"
                unit="C"
                :min="0.1"
                :max="10"
                :step="0.1"
                hint="按电芯/模组规格"
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
        </section>
      </div>

      <aside class="output-column">
        <div v-if="result" class="verdict" :class="result.overallPass ? 'is-pass' : 'is-review'">
          <div class="verdict-top">
            <span class="verdict-kicker">
              {{ result.batteryType === 'lead-acid' ? 'LEAD-ACID / 安时法初选' : 'LITHIUM / 能量法' }}
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
            <template v-if="result.batteryType === 'lead-acid'">
              <div>
                <dt>计算负荷</dt>
                <dd class="readout">P = {{ result.loadPowerKw.toFixed(2) }} kW</dd>
              </div>
              <div>
                <dt>放电电流</dt>
                <dd class="readout">
                  I = P×1000 / (U×η×η线) = {{ result.dischargeCurrentA.toFixed(2) }} A
                </dd>
              </div>
              <div>
                <dt>温度修正</dt>
                <dd class="readout">
                  α = {{ result.alpha }}，kt = 1+α(t−25) = {{ result.temperatureFactor.toFixed(3) }}
                </dd>
              </div>
              <div>
                <dt>安时法容量</dt>
                <dd class="readout">
                  Q = K·I·T / (η·kt) = {{ result.requiredAh.toFixed(1) }} Ah
                </dd>
              </div>
              <div>
                <dt>恒功率需求</dt>
                <dd class="readout">
                  Pcell = P×1000×K / (N×η×η线) = {{ result.requiredWPerCell.toFixed(1) }} W/单体
                </dd>
              </div>
              <div>
                <dt>终止电压</dt>
                <dd class="readout">
                  Uend = {{ result.seriesCells }} × {{ form.endVoltagePerCell }} =
                  {{ result.endVoltageActual.toFixed(0) }} V
                </dd>
              </div>
              <div>
                <dt>推荐配置</dt>
                <dd class="readout">
                  {{ result.unitAh.toFixed(0) }} Ah × {{ result.parallelStrings }} 组 =
                  {{ result.configuredAh.toFixed(0) }} Ah
                </dd>
              </div>
            </template>
            <template v-else>
              <div>
                <dt>负载能量</dt>
                <dd class="readout">
                  E = P×T / (η×η线) = {{ result.baseEnergyKwh.toFixed(2) }} kWh（降额前）
                </dd>
              </div>
              <div>
                <dt>降额后能量</dt>
                <dd class="readout">
                  Ereq = E×K / (DOD×SOH×KT) = {{ result.requiredEnergyKwh.toFixed(2) }} kWh
                </dd>
              </div>
              <div>
                <dt>所需容量</dt>
                <dd class="readout">
                  Q = Ereq×1000 / U = {{ result.requiredAh.toFixed(1) }} Ah
                </dd>
              </div>
              <div>
                <dt>放电电流</dt>
                <dd class="readout">
                  I = P×1000 / (U×η×η线) = {{ result.dischargeCurrentA.toFixed(2) }} A
                </dd>
              </div>
              <div>
                <dt>倍率校核</dt>
                <dd class="readout">
                  C = I / Q = {{ result.cRate.toFixed(2) }} C；按倍率下限
                  {{ result.minAhByCRate.toFixed(1) }} Ah
                </dd>
              </div>
              <div>
                <dt>推荐配置</dt>
                <dd class="readout">
                  {{ result.unitAh.toFixed(0) }} Ah · {{ result.configuredEnergyKwh.toFixed(1) }} kWh
                </dd>
              </div>
            </template>
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
            铅酸容量公式来自 GB 51194-2016《通信电源设备安装工程设计规范》；备用时间底线来自
            GB 50174-2017《数据中心设计规范》附录 A。
          </p>
          <ul>
            <li>
              GB 50174-2017 附录 A：A 级 UPS 电池最少 15 min、B 级 7 min（柴油发电机作为后备电源时）；
              C 级按实际需要。该标准不给出 Ah 算法。
            </li>
            <li>
              GB 51194-2016：Q = K·I·T / (η·[1+α(t−25)])；K 取 1.25；α 按放电小时率取
              0.006 / 0.008 / 0.01；UPS 电池并联组数不宜超过 4 组。
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
              温度：铅酸容量按最低环境温度修正，寿命按最高环境温度校核；锂电按厂家温度降额曲线和
              BMS 充放电窗口，不能直接套用铅酸 α。
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
  PhBatteryCharging,
  PhCopy,
  PhInfo,
  PhWarningCircle,
} from '@phosphor-icons/vue'
import { useToast } from '@/composables/useToast'
import { getToolById } from '../toolData'
import UnitField from './UnitField.vue'
import {
  calculateBatterySizing,
  createDefaultInput,
  type BatterySizingInput,
} from './batterySizing'

const toolConfig = getToolById('battery_sizing')
const toast = useToast()

const form = reactive<BatterySizingInput>(createDefaultInput())
const copied = ref(false)

const result = computed(() => calculateBatterySizing({ ...form }))

const specLabel = computed(() => {
  const value = result.value
  if (!value) return ''
  if (value.batteryType === 'lead-acid') {
    return `${value.seriesUnits} 只 ${form.cellVoltage}V 单元串联 · ${value.parallelStrings} 组并联 · ${value.unitAh.toFixed(0)} Ah/组`
  }
  return `${value.dcVoltageActual.toFixed(0)} V 直流 · ${value.configuredEnergyKwh.toFixed(1)} kWh · ${value.cRate.toFixed(2)} C`
})

function resetForm() {
  Object.assign(form, createDefaultInput())
  toast.info('已恢复默认参数')
}

function buildReport(): string {
  const value = result.value
  if (!value) return ''

  const lines = [
    '蓄电池容量估算书（方案初选）',
    `电池类型：${value.batteryType === 'lead-acid' ? '铅酸蓄电池' : '锂离子电池'}`,
    `负荷：${value.loadPowerKw.toFixed(2)} kW；备电时长：${value.backupMinutes} min；环境温度：${form.ambientTempC} ℃`,
    `直流电压：${value.dcVoltageActual.toFixed(0)} V；设计余量 K：${form.designMargin}`,
    ...(value.batteryType === 'lead-acid'
      ? [`终止电压：${value.seriesCells} × ${form.endVoltagePerCell} = ${value.endVoltageActual.toFixed(0)} V`]
      : []),
    `放电电流：${value.dischargeCurrentA.toFixed(2)} A`,
    `所需容量：${value.requiredAh.toFixed(1)} Ah`,
    value.batteryType === 'lead-acid'
      ? `推荐配置：${value.unitAh.toFixed(0)} Ah × ${value.parallelStrings} 组 = ${value.configuredAh.toFixed(0)} Ah`
      : `推荐配置：${value.unitAh.toFixed(0)} Ah · ${value.configuredEnergyKwh.toFixed(1)} kWh`,
    `预估备电：${value.estimatedRuntimeMinutes.toFixed(0)} min`,
    `结论：${value.overallPass ? '各项校核通过' : '存在需要复核的项'}`,
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
