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
        本页用于方案初选：载流量、电压降、短路热稳定、机械强度、保护配合五类约束同时校核，取最大标准截面。
        内置载流量表为常用值整理，施工图应由注册电气工程师按现行
        <span class="readout">GB/T 16895.6</span>、<span class="readout">GB 50054</span>、<span
          class="readout"
          >GB 50217</span
        >
        及电缆厂家数据复核。
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

            <template v-if="form.system === 'dc'">
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
              hint="设备额定有功功率"
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
              v-if="form.system === 'three-phase'"
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
              v-model="form.efficiency"
              data-symbol="η"
              :class="{ 'is-symbol-active': isActive('η') }"
              label="效率 η"
              :min="0.1"
              :max="1"
              :step="0.01"
              hint="电机 / 电源效率"
            />

            <UnitField
              v-if="form.inputMode === 'power'"
              v-model="form.demandFactor"
              data-symbol="Kd"
              :class="{ 'is-symbol-active': isActive('Kd') }"
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

            <template v-if="form.system === 'dc'">
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

            <template v-if="isBuried">
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

            <label class="field" data-symbol="In" :class="{ 'is-symbol-active': isActive('In') }">
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

            <label class="field">
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

            <template v-if="form.system !== 'dc'">
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
        </section>
      </div>

      <aside class="output-column">
        <div v-if="result" class="result-strip">
          <span class="strip-section">{{ formatSection(result.selectedSection) }} mm² / 相</span>
          <span class="check-status" :class="result.overallPass ? 'is-pass' : 'is-fail'">
            {{ result.overallPass ? 'PASS' : 'REVIEW' }}
          </span>
          <span class="strip-driver">由 {{ result.drivers.join(' / ') }} 控制</span>
          <a class="strip-link" href="#verdict">跳到结论 ↓</a>
        </div>

        <details v-if="result" ref="calcBookRef" class="panel calc-panel">
          <summary>计算书（7 步，点击展开）</summary>

          <div class="calc-book">
            <details
              v-for="step in calcSteps"
              :id="`calc-${step.key}`"
              :key="step.key"
              class="calc-step"
              :class="{ 'is-fail': step.pass === false, 'is-controlling': step.controlling }"
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

        <div v-if="result" class="panel check-panel">
          <div class="panel-head compact">
            <span class="panel-no">✓</span>
            <h2>校核明细</h2>
            <span class="panel-hint">取最大约束</span>
          </div>

          <div class="check-list">
            <details
              v-for="check in checkDetails"
              :key="check.key"
              class="check-item"
              :class="{ 'is-fail': !check.pass, 'is-controlling': check.controlling }"
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
            <li>机械强度：铜芯固定敷设最小 1.5 mm²；铝芯固定敷设最小 10 mm²。</li>
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
import { computed, nextTick, reactive, ref, watch } from 'vue'
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
  BURIED_SPACING_OPTIONS,
  DC_AMPACITY_SOURCE_OPTIONS,
  DC_CIRCUIT_TYPE_OPTIONS,
  DC_WIRING_OPTIONS,
  INSULATION_OPTIONS,
  INSTALLATION_OPTIONS,
  MATERIAL_OPTIONS,
  PROTECTION_DEVICE_OPTIONS,
  STANDARD_SECTIONS,
  SYSTEM_OPTIONS,
  calculateCableSizing,
  createDefaultInput,
  formatSection,
  type CableSizingInput,
} from './cableSizing'
import { AMPACITY } from './ampacityTables'
import {
  buildCalculationSteps,
  buildParameterDocs,
  type CalcSymbol,
  type SymbolSource,
} from './calculationSteps'
import { buildCheckDetails } from './checkDetails'

const toolConfig = getToolById('cable_sizing')
const toast = useToast()

const form = reactive<CableSizingInput>(createDefaultInput())
const copied = ref(false)

const result = computed(() => calculateCableSizing({ ...form }))

const activeSymbol = ref('')
const parameterDocs = buildParameterDocs()
const calcSteps = computed(() => (result.value ? buildCalculationSteps(form, result.value) : []))
const checkDetails = computed(() => (result.value ? buildCheckDetails(form, result.value) : []))
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

function isActive(symbol: string): boolean {
  return activeSymbol.value === symbol
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

.result-strip {
  position: sticky;
  top: 4.5rem;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--color-base-300);
  background-color: var(--color-base-100);
  box-shadow: 0 2px 6px color-mix(in oklab, var(--color-base-content) 8%, transparent);
}

.strip-section {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.strip-driver {
  font-size: 10px;
  color: var(--text-muted);
}

.strip-link {
  margin-left: auto;
  font-size: 10px;
  color: var(--color-primary);
  text-decoration: none;
  white-space: nowrap;
}

.strip-link:hover {
  text-decoration: underline;
}

#verdict {
  scroll-margin-top: 8rem;
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

.verdict-why {
  margin-top: 0.55rem;
  padding-top: 0.55rem;
  border-top: 1px dashed var(--color-base-300);
  font-size: 11px;
  line-height: 1.65;
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

.calc-panel > summary,
.source-panel summary {
  padding: 0.55rem 0.8rem;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 1px solid var(--color-base-300);
  background-color: var(--color-base-200);
}

.check-table td:last-child {
  white-space: nowrap;
}

.check-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 3.5em;
  padding: 0.1rem 0.45rem;
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1.5;
  white-space: nowrap;
  border: 1px solid currentColor;
}

.check-status.is-pass {
  color: var(--color-success);
  background-color: color-mix(in oklab, var(--color-success) 10%, var(--color-base-100));
}

.check-status.is-fail {
  color: var(--color-error);
  background-color: color-mix(in oklab, var(--color-error) 10%, var(--color-base-100));
}

.check-list {
  display: flex;
  flex-direction: column;
}

.check-item {
  padding: 0.55rem 0.8rem;
  border-bottom: 1px dashed color-mix(in oklab, var(--color-base-300) 70%, transparent);
}

.check-item:last-child {
  border-bottom: 0;
}

.check-item.is-fail {
  background-color: color-mix(in oklab, var(--color-error) 4%, transparent);
}

.check-item.is-controlling {
  box-shadow: inset 2px 0 0 var(--color-primary);
}

.check-item-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  list-style: none;
}

.check-item-head::-webkit-details-marker {
  display: none;
}

.check-item-head::before {
  content: '▸';
  flex: 0 0 auto;
  font-size: 10px;
  color: var(--text-faint);
}

.check-item[open] > .check-item-head::before {
  content: '▾';
}

.check-item-label {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
}

.check-item-key {
  flex: 1 1 auto;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 10px;
  text-align: right;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}

.check-item-flag {
  flex: 0 0 auto;
  padding: 0 0.25rem;
  font-size: 9px;
  color: var(--color-primary);
  border: 1px solid color-mix(in oklab, var(--color-primary) 40%, transparent);
}

.check-item-head .check-status {
  flex: 0 0 auto;
}

.check-item-body {
  padding-top: 0.45rem;
}

.check-formula,
.check-substitution {
  margin: 0.3rem 0 0;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
  white-space: pre-wrap;
}

.check-formula {
  color: var(--color-base-content);
}

.check-line {
  display: flex;
  gap: 0.5rem;
  margin: 0.25rem 0 0;
  font-size: 11px;
  line-height: 1.5;
}

.check-line-label {
  flex: 0 0 2.5em;
  color: var(--text-faint);
}

.check-why {
  margin: 0.35rem 0 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
}

.check-link {
  margin-top: 0.35rem;
  padding: 0;
  font-size: 11px;
  color: var(--color-primary);
  cursor: pointer;
  background: none;
  border: 0;
}

.check-link:hover {
  text-decoration: underline;
}

.calc-book {
  display: flex;
  flex-direction: column;
}

.calc-step {
  padding: 0.7rem 0.8rem;
  border-bottom: 1px dashed color-mix(in oklab, var(--color-base-300) 70%, transparent);
}

.calc-step:last-child {
  border-bottom: 0;
}

.calc-step.is-fail {
  background-color: color-mix(in oklab, var(--color-error) 4%, transparent);
}

.calc-step.is-controlling {
  box-shadow: inset 2px 0 0 var(--color-primary);
}

.calc-step-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  list-style: none;
}

.calc-step-head::-webkit-details-marker {
  display: none;
}

.calc-step-head::before {
  content: '▸';
  flex: 0 0 auto;
  font-size: 10px;
  color: var(--text-faint);
}

.calc-step[open] > .calc-step-head::before {
  content: '▾';
}

.calc-step-title {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
}

.calc-step-key {
  flex: 1 1 auto;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 10px;
  text-align: right;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}

.calc-step-flag {
  flex: 0 0 auto;
  padding: 0 0.25rem;
  font-size: 9px;
  color: var(--color-primary);
  border: 1px solid color-mix(in oklab, var(--color-primary) 40%, transparent);
}

.calc-step-head .check-status {
  flex: 0 0 auto;
}

.calc-step-body {
  padding-top: 0.5rem;
}

.calc-step-no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 16px;
  padding: 0 0.25rem;
  font-family: var(--font-mono);
  font-size: 9px;
  line-height: 1;
  color: var(--color-primary);
  border: 1px solid color-mix(in oklab, var(--color-primary) 40%, transparent);
}

.calc-formula,
.calc-substitution,
.calc-result {
  margin: 0.35rem 0 0;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.calc-formula {
  color: var(--text-muted);
}

.calc-substitution {
  color: var(--text-muted);
}

.calc-result {
  color: var(--color-base-content);
  font-weight: 600;
}

.calc-step-note {
  margin: 0.35rem 0 0;
  font-size: 10px;
  line-height: 1.5;
  color: var(--text-faint);
}

.calc-symbols {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.symbol-chip {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem;
  padding: 0.18rem 0.42rem;
  font: inherit;
  font-size: 10px;
  line-height: 1.4;
  text-align: left;
  color: inherit;
  cursor: pointer;
  background-color: var(--color-base-200);
  border: 1px solid var(--color-base-300);
}

.symbol-chip:hover,
.symbol-chip:focus-visible {
  border-color: var(--color-primary);
}

.symbol-chip.is-symbol-active {
  border-color: var(--color-primary);
  background-color: color-mix(in oklab, var(--color-primary) 8%, var(--color-base-100));
}

.symbol-name {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--color-primary);
}

.symbol-value {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--color-base-content);
}

.symbol-label {
  color: var(--text-faint);
}

.symbol-source {
  padding: 0 0.2rem;
  font-size: 9px;
  line-height: 1.4;
  white-space: nowrap;
  border: 1px solid currentColor;
}

.symbol-source.is-input {
  color: var(--color-primary);
}

.symbol-source.is-table {
  color: var(--text-muted);
}

.symbol-source.is-calc {
  color: var(--color-success);
}

.symbol-source.is-constant {
  color: var(--color-warning);
}

.symbol-source.is-default {
  color: var(--text-faint);
  border-style: dashed;
}

.param-panel {
  margin-top: 1rem;
}

.param-panel summary {
  padding: 0.55rem 0.8rem;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 1px solid var(--color-base-300);
  background-color: var(--color-base-200);
}

.param-table {
  width: 100%;
  min-width: 960px;
  border-collapse: collapse;
  font-size: 10.5px;
}

.param-table th,
.param-table td {
  padding: 0.4rem 0.5rem;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid color-mix(in oklab, var(--color-base-300) 60%, transparent);
}

.param-table th {
  font-size: 9.5px;
  font-weight: 500;
  color: var(--text-faint);
  white-space: nowrap;
}

.param-table tr:last-child td {
  border-bottom: 0;
}

.is-symbol-active {
  outline: 2px solid color-mix(in oklab, var(--color-primary) 70%, transparent);
  outline-offset: 2px;
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

.field-note.is-warn {
  color: var(--color-warning);
}

@media (max-width: 640px) {
  .dc-table {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
