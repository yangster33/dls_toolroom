<template>
  <div class="sheet-page">
    <header class="page-head">
      <div class="page-title">
        <p class="eyebrow">
          <PhFrameCorners weight="fill" aria-hidden="true" />
          SHEET TEMPLATE / GB
        </p>
        <h1>{{ toolConfig?.name || '图框图签生成' }}</h1>
        <p class="page-desc">
          A0~A5 图幅、国标风格图框、交互式图签设计；支持 JSON Schema、SVG、DXF 导出。
        </p>
      </div>
      <div class="page-actions">
        <div class="mode-switch">
          <button type="button" :class="{ active: uiMode === 'guided' }" @click="setUiMode('guided')">
            新手引导
          </button>
          <button type="button" :class="{ active: uiMode === 'advanced' }" @click="setUiMode('advanced')">
            专业模式
          </button>
        </div>
        <template v-if="uiMode === 'advanced'">
          <button type="button" class="btn btn-sm btn-ghost" :disabled="!history.length" @click="undo">
            <PhArrowCounterClockwise aria-hidden="true" />
            撤销
          </button>
          <button type="button" class="btn btn-sm btn-ghost" :disabled="!future.length" @click="redo">
            <PhArrowClockwise aria-hidden="true" />
            重做
          </button>
          <button type="button" class="btn btn-sm btn-ghost" @click="reset">
            <PhArrowUpRight aria-hidden="true" />
            重置
          </button>
          <button type="button" class="btn btn-sm btn-primary" @click="exportJson">
            <PhFileCode aria-hidden="true" />
            导出 JSON
          </button>
        </template>
        <button v-else type="button" class="btn btn-sm btn-ghost" @click="showHelp = !showHelp">
          <PhQuestion aria-hidden="true" />
          帮助
        </button>
      </div>
    </header>

    <div class="notice">
      <PhInfo weight="fill" aria-hidden="true" />
      <p>
        图幅参考 <span class="readout">GB/T 14689-2008</span>，标题栏参考
        <span class="readout">GB/T 10609.1-2008</span>，字高参考
        <span class="readout">GB/T 14691-1993</span>。内置模板为常用 GB 风格，单元格可自由调整。
      </p>
    </div>

    <div v-if="draftNotice" class="draft-notice">
      <PhWarning weight="fill" aria-hidden="true" />
      <p>
        检测到上次本地草稿有 {{ draftNotice.errors }} 个错误 / {{ draftNotice.warnings }} 个警告，
        已载入默认模板。可以恢复草稿后继续修复。
      </p>
      <button type="button" class="btn btn-xs" @click="restoreDraft">恢复草稿</button>
      <button type="button" class="btn btn-xs btn-ghost" @click="dismissDraft">忽略</button>
    </div>

    <div v-if="uiMode === 'advanced'" class="workbench" :class="{ 'focus-mode': focusMode }">
      <aside class="panel left-panel">
        <section class="panel-section">
          <div class="panel-head">
            <h2>图幅</h2>
            <span class="panel-hint">{{ paperLabel }}</span>
          </div>
          <div class="segmented six" role="group" aria-label="图幅">
            <button
              v-for="size in paperSizes"
              :key="size"
              type="button"
              :class="{ active: doc.template.paper.size === size }"
              @click="setPaper(size)"
            >
              {{ size }}
            </button>
          </div>
          <div class="segmented" role="group" aria-label="方向">
            <button
              type="button"
              :class="{ active: doc.template.paper.orientation === 'landscape' }"
              @click="setOrientation('landscape')"
            >
              横版
            </button>
            <button
              type="button"
              :class="{ active: doc.template.paper.orientation === 'portrait' }"
              @click="setOrientation('portrait')"
            >
              竖版
            </button>
          </div>
        </section>

        <section class="panel-section">
          <div class="panel-head">
            <h2>边距 / 图框</h2>
            <span class="panel-hint">mm</span>
          </div>
          <div class="field-grid two">
            <label class="field">
              <span>装订边</span>
              <input v-model.number="doc.template.margins.binding" type="number" min="0" step="1" />
            </label>
            <label class="field">
              <span>上</span>
              <input v-model.number="doc.template.margins.top" type="number" min="0" step="1" />
            </label>
            <label class="field">
              <span>下</span>
              <input v-model.number="doc.template.margins.bottom" type="number" min="0" step="1" />
            </label>
            <label class="field">
              <span>左</span>
              <input v-model.number="doc.template.margins.left" type="number" min="0" step="1" />
            </label>
            <label class="field">
              <span>右</span>
              <input v-model.number="doc.template.margins.right" type="number" min="0" step="1" />
            </label>
            <label class="field">
              <span>图框线宽</span>
              <input v-model.number="doc.template.frame.lineWidth" type="number" min="0.1" step="0.1" />
            </label>
          </div>
          <div class="segmented" role="group" aria-label="装订边">
            <button
              type="button"
              :class="{ active: doc.template.bindingEdge === 'left' }"
              @click="setBindingEdge('left')"
            >
              左侧装订
            </button>
            <button
              type="button"
              :class="{ active: doc.template.bindingEdge === 'right' }"
              @click="setBindingEdge('right')"
            >
              右侧装订
            </button>
          </div>
          <div class="check-row">
            <label class="check">
              <input v-model="doc.template.frame.centeringMarks" type="checkbox" />
              对中符号
            </label>
            <label class="check">
              <input v-model="doc.template.frame.zoneMarking" type="checkbox" />
              分区标记
            </label>
          </div>
          <button type="button" class="btn btn-sm btn-ghost wide" @click="applyBindingMargins">
            按装订边重算边距
          </button>
        </section>

        <section class="panel-section">
          <div class="panel-head">
            <h2>字体 / 字高</h2>
            <span class="panel-hint">GB/T 14691</span>
          </div>
          <label class="field">
            <span>字体</span>
            <select :value="fontPreset" @change="setFontPreset">
              <option v-for="preset in fontPresets" :key="preset.value" :value="preset.value">
                {{ preset.label }}
              </option>
              <option value="custom">自定义…</option>
            </select>
          </label>
          <label v-if="fontPreset === 'custom'" class="field">
            <span>font-family</span>
            <input v-model="doc.template.styles.fontFamily" type="text" placeholder="如：'Microsoft YaHei', sans-serif" />
          </label>
          <div class="font-rows">
            <div v-for="row in fontRows" :key="row.key" class="font-row">
              <span>{{ row.label }}</span>
              <input v-model.number="row.style.fontSize" type="number" min="1" max="30" step="0.1" />
              <label class="font-bold" :title="`${row.label}是否加粗`">
                <input v-model="row.style.bold" type="checkbox" />
                粗
              </label>
              <button type="button" class="mini-btn" title="吸附到标准字高" @click="snapFont(row.key)">
                吸附
              </button>
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-ghost wide" @click="applyRecommendedFonts">
            按图幅推荐
          </button>
          <p class="hint">标准系列：1.8 / 2.5 / 3.5 / 5 / 7 / 10 / 14 / 20 mm</p>
        </section>

        <section class="panel-section">
          <div class="panel-head">
            <h2>图签</h2>
            <span class="panel-hint">{{ titleBlockCells.length }} 单元格</span>
          </div>
          <div class="segmented three" role="group" aria-label="图签模板">
            <button
              type="button"
              :class="{ active: activeTemplateKind === 'gb' }"
              @click="setTemplateKind('gb')"
            >
              GB 风格
            </button>
            <button
              type="button"
              :class="{ active: activeTemplateKind === 'simple' }"
              @click="setTemplateKind('simple')"
            >
              简洁
            </button>
            <button
              type="button"
              :class="{ active: activeTemplateKind === 'minimal' }"
              @click="setTemplateKind('minimal')"
            >
              极简
            </button>
          </div>
          <p class="hint">
            GB 风格包含更改区、签字区、材料/比例区等标准分区，因此会有跨行/跨列单元格；需要更少合并时可选“简洁”或“极简”。
          </p>
          <div class="field-grid two">
            <label class="field">
              <span>宽</span>
              <input v-model.number="doc.template.titleBlock.width" type="number" min="40" step="1" />
            </label>
            <label class="field">
              <span>高</span>
              <input v-model.number="doc.template.titleBlock.height" type="number" min="20" step="1" />
            </label>
          </div>
          <label class="field">
            <span>位置</span>
            <select v-model="doc.template.titleBlock.position">
              <option value="bottom-right">右下</option>
              <option value="bottom-left">左下</option>
              <option value="top-right">右上</option>
              <option value="top-left">左上</option>
            </select>
          </label>
        </section>

        <section class="panel-section">
          <div class="panel-head">
            <h2>显示</h2>
            <span class="panel-hint">元素级开关</span>
          </div>
          <div class="view-actions">
            <button type="button" class="mini-btn" @click="setAllView(true)">全部显示</button>
            <button type="button" class="mini-btn" @click="setAllView(false)">全部隐藏</button>
          </div>
          <div v-for="group in viewTree" :key="group.id" class="view-group">
            <div class="view-group-head">
              <span>{{ group.label }}</span>
              <span class="view-group-state" :class="viewGroupState(group)">{{ viewGroupStateLabel(group) }}</span>
              <button type="button" class="mini-btn" @click="toggleParent(group, true)">全显</button>
              <button type="button" class="mini-btn" @click="toggleParent(group, false)">全隐</button>
            </div>
            <label v-for="child in group.children" :key="child.id" class="view-item">
              <input
                type="checkbox"
                :checked="isViewVisible(child.id)"
                @change="onViewCheck(child.id, $event)"
              />
              <span>{{ child.label }}</span>
              <span v-if="child.description" class="view-desc">{{ child.description }}</span>
            </label>
          </div>
        </section>

        <section class="panel-section">
          <div class="panel-head">
            <h2>导出</h2>
            <span class="panel-hint">纯浏览器</span>
          </div>
          <div class="export-grid">
            <button type="button" class="btn btn-sm span-two" @click="triggerImport">
              <PhUploadSimple aria-hidden="true" />
              导入 JSON
            </button>
            <button type="button" class="btn btn-sm" @click="exportJson">
              <PhFileCode aria-hidden="true" />
              JSON
            </button>
            <button type="button" class="btn btn-sm" @click="exportSchema">
              <PhFileText aria-hidden="true" />
              Schema
            </button>
            <button type="button" class="btn btn-sm" @click="exportSvg">
              <PhFileSvg aria-hidden="true" />
              SVG
            </button>
            <button type="button" class="btn btn-sm btn-primary" @click="exportDxf">
              <PhBlueprint aria-hidden="true" />
              DXF
            </button>
          </div>
          <p class="hint">DXF 为 R2007+ ASCII / UTF-8，建议用 AutoCAD、LibreCAD 或 TrueView 打开。</p>
          <div class="dxf-settings">
            <label class="check compact">
              <input v-model="dxfCalibrate" type="checkbox" />
              按预览校准 DXF 字高
            </label>
            <label class="field compact-field">
              <span>字高倍率</span>
              <input v-model.number="dxfTextScale" type="number" min="0.5" max="2" step="0.05" />
            </label>
            <p class="hint">
              CAD 的 TEXT 字高按大写字母高度解释；默认按中英文分别校准。仍不一致时可微调倍率。
            </p>
          </div>
        </section>
      </aside>

      <main class="canvas-panel">
        <div class="editor-tabs">
          <button type="button" :class="{ active: centerTab === 'grid' }" @click="setCenterTab('grid')">
            表格编辑
          </button>
          <button type="button" :class="{ active: centerTab === 'preview' }" @click="setCenterTab('preview')">
            图纸预览
          </button>
          <span class="editor-tabs-hint">{{ isGridMode ? '网格模式 · 行列轨道' : '绝对坐标模式' }}</span>
          <button
            type="button"
            class="mini-btn focus-toggle"
            :title="focusMode ? '退出专注编辑' : '隐藏左右面板，放大编辑区'"
            @click="focusMode = !focusMode"
          >
            {{ focusMode ? '退出专注' : '专注编辑' }}
          </button>
        </div>

        <div v-if="centerTab === 'preview'" class="canvas-toolbar">
          <span class="canvas-status">{{ paperLabel }} · {{ titleBlockCells.length }} 个单元格</span>
          <span class="toolbar-spacer"></span>
          <label class="check compact">
            <input v-model="viewState.showGrid" type="checkbox" />
            网格
          </label>
          <label class="check compact">
            <input v-model="snapEnabled" type="checkbox" />
            吸附
          </label>
          <select v-model.number="snapStep" class="snap-select" :disabled="!snapEnabled">
            <option :value="1">1 mm</option>
            <option :value="2">2 mm</option>
            <option :value="5">5 mm</option>
            <option :value="10">10 mm</option>
          </select>
          <button type="button" class="mini-btn" title="缩小" @click="setZoom(zoom - 0.1)">−</button>
          <span class="zoom-label">{{ zoomLabel }}</span>
          <button type="button" class="mini-btn" title="放大" @click="setZoom(zoom + 0.1)">+</button>
          <button type="button" class="mini-btn" @click="setZoom(1)">适应</button>
          <button type="button" class="mini-btn" @click="focusTitleBlock">聚焦图签</button>
        </div>

        <div v-if="centerTab === 'grid'" class="grid-tab">
          <TitleBlockGridEditor
            v-if="isGridMode"
            :template="doc.template"
            :values="doc.values"
            :selected-cell-id="selectedCellId"
            @select-cell="selectedCellId = $event"
            @begin-edit="onBeginEdit"
            @end-edit="onEndEdit"
            @insert-row="gridInsertRow"
            @delete-row="gridDeleteRow"
            @insert-column="gridInsertColumn"
            @delete-column="gridDeleteColumn"
            @merge="gridMerge"
            @split="gridSplit"
            @resize-column="gridResizeColumn"
            @resize-row="gridResizeRow"
            @equalize-columns="gridEqualizeColumns"
            @equalize-rows="gridEqualizeRows"
            @auto-fit="gridAutoFit"
            @normalize="gridNormalize"
            @add-cell-at="gridAddCellAt"
            @update-field="gridUpdateField"
            @update-cell-text="gridUpdateCellText"
          />
          <div v-else class="grid-empty">
            <p>当前模板还是绝对坐标模式。转换为网格后，可以用 Excel 式行列编辑。</p>
            <button type="button" class="btn btn-sm btn-primary" @click="convertToGrid">
              转换为网格模式
            </button>
          </div>
        </div>

        <div v-else ref="canvasScrollRef" class="canvas-scroll">
          <SheetCanvas
            :template="doc.template"
            :values="doc.values"
            :selected-cell-id="selectedCellId"
            :zoom="zoom"
            :show-grid="viewState.showGrid"
            :snap-step="snapEnabled ? snapStep : 0.1"
            :view-state="viewState"
            :readonly="isGridMode"
            @select-cell="selectedCellId = $event"
            @begin-edit="onBeginEdit"
            @update-cell="onCanvasUpdateCell"
            @end-edit="onEndEdit"
            @toggle-group="toggleView"
          />
        </div>

        <div class="canvas-footer">
          <span v-if="centerTab === 'grid'">在表格中选中单元格；用工具栏增删行列、合并拆分、自动对齐。</span>
          <span v-else>点击单元格选中；拖动移动；右下角手柄缩放；方向键微调。</span>
          <span :class="['issue-badge', errorCount ? 'error' : warningCount ? 'warning' : 'ok']">
            {{ errorCount }} 错误 / {{ warningCount }} 警告
          </span>
        </div>
      </main>

      <aside class="panel right-panel">
        <section class="panel-section">
          <div class="panel-head">
            <h2>单元格属性</h2>
            <span v-if="editCell" class="panel-hint">{{ editCell.id }}</span>
          </div>
          <label class="field">
            <span>选择单元格</span>
            <select v-model="selectedCellId">
              <option :value="null">（未选择）</option>
              <option v-for="cell in titleBlockCells" :key="cell.id" :value="cell.id">
                {{ cell.label || cell.field || cell.id }}
              </option>
            </select>
          </label>
          <template v-if="editCell">
            <label class="field">
              <span>标签</span>
              <input v-model="editCell.label" type="text" placeholder="如：设计 / 审核" />
            </label>
            <label class="field">
              <span>绑定字段</span>
              <select v-model="editCell.field">
                <option value="">（无）</option>
                <option v-for="field in fieldDefinitions" :key="field.key" :value="field.key">
                  {{ field.label }}（{{ field.key }}）
                </option>
              </select>
            </label>
            <div v-if="isGridMode" class="field-grid two">
              <label class="field">
                <span>行</span>
                <input :value="(selectedGridCell?.row ?? 0) + 1" type="text" readonly />
              </label>
              <label class="field">
                <span>列</span>
                <input :value="gridColumnLabel(selectedGridCell?.col ?? 0)" type="text" readonly />
              </label>
              <label class="field">
                <span>行跨度</span>
                <input :value="selectedGridCell?.rowSpan ?? 1" type="text" readonly />
              </label>
              <label class="field">
                <span>列跨度</span>
                <input :value="selectedGridCell?.colSpan ?? 1" type="text" readonly />
              </label>
            </div>
            <p v-if="isGridMode" class="hint">
              网格模式下，位置由行列轨道决定；请在“表格编辑”工具栏插入/删除行列、合并/拆分，或拖动列标/行号手柄调整宽高。
            </p>
            <div v-else class="field-grid two">
              <label class="field">
                <span>X</span>
                <input v-model.number="absoluteCell.x" type="number" step="1" />
              </label>
              <label class="field">
                <span>Y</span>
                <input v-model.number="absoluteCell.y" type="number" step="1" />
              </label>
              <label class="field">
                <span>宽</span>
                <input v-model.number="absoluteCell.w" type="number" min="2" step="1" />
              </label>
              <label class="field">
                <span>高</span>
                <input v-model.number="absoluteCell.h" type="number" min="2" step="1" />
              </label>
            </div>
            <label class="field">
              <span>文字样式</span>
              <select v-model="editCell.textStyle">
                <option v-for="key in textStyleKeys" :key="key" :value="key">{{ key }}</option>
              </select>
            </label>
            <div class="field-grid two">
              <label class="field">
                <span>字号覆盖</span>
                <input
                  :value="editCell.fontSize ?? ''"
                  type="number"
                  min="1"
                  max="40"
                  step="0.1"
                  placeholder="跟随样式"
                  @change="setCellFontSize"
                />
              </label>
              <label class="field">
                <span>粗细</span>
                <select
                  :value="editCell.bold === undefined ? '' : editCell.bold ? '1' : '0'"
                  @change="setCellBold"
                >
                  <option value="">跟随样式</option>
                  <option value="1">加粗</option>
                  <option value="0">常规</option>
                </select>
              </label>
            </div>
            <div class="segmented three" role="group" aria-label="水平对齐">
              <button
                v-for="align in alignOptions"
                :key="align.value"
                type="button"
                :class="{ active: (editCell.align || 'center') === align.value }"
                @click="editCell.align = align.value"
              >
                {{ align.label }}
              </button>
            </div>
            <div class="segmented three" role="group" aria-label="垂直对齐">
              <button
                v-for="align in valignOptions"
                :key="align.value"
                type="button"
                :class="{ active: (editCell.valign || 'middle') === align.value }"
                @click="editCell.valign = align.value"
              >
                {{ align.label }}
              </button>
            </div>
            <label class="check">
              <input
                type="checkbox"
                :checked="editCell.border !== false"
                @change="onBorderChange"
              />
              显示边框
            </label>
            <div class="cell-actions">
              <button type="button" class="btn btn-sm btn-ghost" @click="duplicateCell">
                <PhCopy aria-hidden="true" />
                复制
              </button>
              <button type="button" class="btn btn-sm btn-ghost" @click="deleteCell">
                <PhTrash aria-hidden="true" />
                删除
              </button>
            </div>
          </template>
          <template v-else>
            <p class="hint">在表格或预览中点击一个单元格，或添加新单元格。</p>
            <button type="button" class="btn btn-sm btn-primary wide" @click="addCell">
              <PhPlus aria-hidden="true" />
              {{ isGridMode ? '在空位添加单元格' : '添加单元格' }}
            </button>
          </template>
        </section>

        <section class="panel-section">
          <div class="panel-head">
            <h2>字段值</h2>
            <span class="panel-hint">导出时写入</span>
          </div>
          <div class="value-list">
            <label v-for="field in fieldDefinitions" :key="field.key" class="field compact-field">
              <span>{{ field.label }}</span>
              <input v-model="doc.values[field.key]" type="text" />
            </label>
          </div>
          <div class="custom-fields">
            <div class="custom-fields-head">
              <h3>自定义字段</h3>
              <span>{{ customFields.length }} 个</span>
            </div>
            <p v-if="!customFields.length" class="hint">还没有自定义字段。可以添加“建设单位”“校对人”等。</p>
            <div v-for="field in customFields" :key="field.key" class="custom-field-row">
              <span>{{ field.label }}</span>
              <code>{{ field.key }}</code>
              <button type="button" class="mini-btn danger" @click="removeCustomField(field.key)">删除</button>
            </div>
            <div class="custom-field-add">
              <input v-model="newFieldLabel" type="text" placeholder="字段名称，如：建设单位" />
              <input v-model="newFieldKey" type="text" placeholder="字段键，如：clientName" />
              <button type="button" class="mini-btn" @click="addCustomField">添加</button>
            </div>
            <p class="hint">字段键使用字母/数字/下划线；添加后可在“绑定字段”下拉里选择，并写入导出 JSON。</p>
          </div>
        </section>

        <section class="panel-section">
          <div class="panel-head">
            <h2>校验</h2>
            <span class="panel-hint">{{ issues.length }} 项</span>
          </div>
          <div v-if="!issues.length" class="ok-box">
            <PhCheckCircle weight="fill" aria-hidden="true" />
            结构、边距、字高、文字溢出检查通过
          </div>
          <ul v-else class="issue-list">
            <li
              v-for="(issue, index) in issues"
              :key="index"
              :class="issue.severity"
              @click="issue.cellId && (selectedCellId = issue.cellId)"
            >
              <PhWarning v-if="issue.severity !== 'info'" weight="fill" aria-hidden="true" />
              <PhInfo v-else weight="fill" aria-hidden="true" />
              <span>{{ issue.message }}</span>
            </li>
          </ul>
        </section>
      </aside>
    </div>

    <div v-else class="guided">
      <ol class="guided-steps">
        <li
          v-for="(step, index) in guidedSteps"
          :key="step.title"
          :class="{ active: wizardStep === index, done: wizardStep > index }"
        >
          <button type="button" @click="wizardStep = index">
            <span class="step-index">{{ index + 1 }}</span>
            <span class="step-title">{{ step.title }}</span>
          </button>
        </li>
      </ol>

      <div v-if="showHelp" class="guided-help">
        <PhInfo weight="fill" aria-hidden="true" />
        <div>
          <strong>3 分钟做一张图签</strong>
          <p>
            ① 选图幅 → ② 选图签样式 → ③ 点单元格填内容 → ④ 导出。
            结构编辑、边距、字高、图层开关都在“专业模式”里，新手模式不需要设置。
          </p>
        </div>
        <button type="button" class="btn btn-xs btn-ghost" @click="showHelp = false">知道了</button>
      </div>

      <section v-if="wizardStep === 0" class="guided-card">
        <header class="guided-card-head">
          <span class="guided-kicker">第 1 步</span>
          <h2>选择图幅</h2>
          <p>图幅决定图纸尺寸和默认边距；字高会自动按图幅推荐，不需要手动设置。</p>
        </header>
        <div class="paper-cards">
          <button
            v-for="size in paperSizes"
            :key="size"
            type="button"
            class="paper-card"
            :class="{ active: doc.template.paper.size === size }"
            @click="setPaper(size)"
          >
            <strong>{{ size }}</strong>
            <span>{{ paperCardLabel(size) }}</span>
            <small>{{ doc.template.paper.size === size ? '当前图幅' : '点击选择' }}</small>
          </button>
        </div>
        <div class="guided-row">
          <span class="guided-row-label">方向</span>
          <div class="segmented" role="group" aria-label="方向">
            <button
              type="button"
              :class="{ active: doc.template.paper.orientation === 'landscape' }"
              @click="setOrientation('landscape')"
            >
              横版
            </button>
            <button
              type="button"
              :class="{ active: doc.template.paper.orientation === 'portrait' }"
              @click="setOrientation('portrait')"
            >
              竖版
            </button>
          </div>
          <span class="guided-row-note">{{ paperLabel }}</span>
        </div>
      </section>

      <section v-else-if="wizardStep === 1" class="guided-card">
        <header class="guided-card-head">
          <span class="guided-kicker">第 2 步</span>
          <h2>选择图签样式</h2>
          <p>先选一个接近的样式，内容可以在下一步直接点单元格修改。</p>
        </header>
        <div class="template-cards">
          <button
            v-for="kind in templateKinds"
            :key="kind"
            type="button"
            class="template-card"
            :class="{ active: activeTemplateKind === kind }"
            @click="setTemplateKind(kind)"
          >
            <span class="template-thumb" v-html="templateThumbs[kind]"></span>
            <strong>{{ templateName(kind) }}</strong>
            <small>{{ templateDesc(kind) }}</small>
            <em>{{ activeTemplateKind === kind ? '已选择' : '点击选择' }}</em>
          </button>
        </div>
      </section>

      <section v-else-if="wizardStep === 2" class="guided-content">
        <div class="guided-preview-panel">
          <div class="guided-panel-head">
            <h2>点图签里的单元格</h2>
            <span>{{ titleBlockCells.length }} 个单元格</span>
          </div>
          <div class="guided-preview-scroll">
            <SheetCanvas
              :template="doc.template"
              :values="doc.values"
              :selected-cell-id="selectedCellId"
              :zoom="1"
              :show-grid="false"
              :snap-step="0.1"
              :view-state="viewState"
              :readonly="true"
              :crop-to-title-block="true"
              :hide-tooltip="true"
              @select-cell="selectedCellId = $event"
            />
          </div>
          <p class="guided-preview-hint">
            点击左侧图签中的文字格，右侧会出现编辑表单。蓝色高亮是当前选中的单元格。
          </p>
        </div>

        <aside class="guided-form">
          <template v-if="editCell">
            <div class="guided-form-head">
              <h3>{{ fieldLabel(editCell.field) || editCell.label || '未命名单元格' }}</h3>
              <span v-if="editCell.field && editCell.label && editCell.label !== fieldLabel(editCell.field)">
                标签：{{ editCell.label }}
              </span>
            </div>
            <label class="field">
              <span>绑定字段</span>
              <select v-model="editCell.field">
                <option value="">（不绑定，作为静态文字）</option>
                <option v-for="field in fieldDefinitions" :key="field.key" :value="field.key">
                  {{ field.label }}
                </option>
              </select>
            </label>
            <label v-if="editCell.field" class="field">
              <span>字段值</span>
              <input v-model="doc.values[editCell.field]" type="text" placeholder="输入内容" />
            </label>
            <label v-else class="field">
              <span>文字内容</span>
              <input
                :value="editCell.text ?? editCell.label ?? ''"
                type="text"
                placeholder="输入文字"
                @input="updateGuidedText"
              />
            </label>
            <p class="hint">
              绑定的字段会在导出时写入；多个单元格绑定同一字段时会同步显示同一个值。
            </p>
          </template>
          <template v-else>
            <div class="guided-empty">
              <PhFrameCorners aria-hidden="true" />
              <p>点击左侧图签中的单元格开始填写。</p>
            </div>
          </template>

          <div class="guided-common">
            <div class="guided-common-head">
              <h4>常用字段</h4>
              <button type="button" class="mini-btn" @click="fillSampleData">填入示例数据</button>
            </div>
            <label v-for="field in commonFields" :key="field.key" class="field compact-field">
              <span>{{ field.label }}</span>
              <input v-model="doc.values[field.key]" type="text" />
            </label>
          </div>
        </aside>
      </section>

      <section v-else class="guided-card">
        <header class="guided-card-head">
          <span class="guided-kicker">第 4 步</span>
          <h2>预览并导出</h2>
          <p>选择需要的格式。SVG / DXF 是矢量格式，适合打印和 CAD；PNG 适合文档和聊天。</p>
        </header>

        <div class="guided-export-layout">
          <div class="guided-preview-panel full">
            <div class="guided-preview-scroll">
              <SheetCanvas
                :template="doc.template"
                :values="doc.values"
                :selected-cell-id="selectedCellId"
                :zoom="1"
                :show-grid="false"
                :snap-step="0.1"
                :view-state="viewState"
                :readonly="true"
                :hide-tooltip="true"
              />
            </div>
          </div>

          <aside class="guided-export-side">
            <div class="export-cards">
              <button type="button" class="export-card" @click="exportSvg">
                <PhFileSvg aria-hidden="true" />
                <strong>SVG</strong>
                <span>矢量，适合排版和打印</span>
              </button>
              <button type="button" class="export-card" @click="exportPng">
                <PhImage aria-hidden="true" />
                <strong>PNG</strong>
                <span>图片，适合文档和聊天</span>
              </button>
              <button type="button" class="export-card" @click="exportDxf">
                <PhBlueprint aria-hidden="true" />
                <strong>DXF</strong>
                <span>CAD 可继续编辑</span>
              </button>
              <button type="button" class="export-card" @click="exportJson">
                <PhFileCode aria-hidden="true" />
                <strong>JSON</strong>
                <span>源数据，可再次导入</span>
              </button>
            </div>

            <div class="guided-export-more">
              <span>更多：</span>
              <button type="button" class="btn btn-sm btn-ghost" @click="exportSchema">
                <PhFileText aria-hidden="true" />
                JSON Schema
              </button>
              <button type="button" class="btn btn-sm btn-ghost" @click="triggerImport">
                <PhUploadSimple aria-hidden="true" />
                导入 JSON
              </button>
            </div>

            <div v-if="errorCount" class="guided-check error">
              <PhWarning weight="fill" aria-hidden="true" />
              <div>
                <strong>{{ errorCount }} 个错误需要先处理</strong>
                <ul>
                  <li
                    v-for="(issue, index) in issues.filter((item) => item.severity === 'error').slice(0, 3)"
                    :key="index"
                  >
                    {{ issue.message }}
                  </li>
                </ul>
              </div>
              <button type="button" class="btn btn-xs btn-ghost" @click="wizardStep = 2">返回修改</button>
            </div>
            <div v-else-if="warningCount" class="guided-check warning">
              <PhInfo weight="fill" aria-hidden="true" />
              <span>有 {{ warningCount }} 个提示，不影响导出；可在专业模式里查看详情。</span>
            </div>
            <div v-else class="guided-check ok">
              <PhCheckCircle weight="fill" aria-hidden="true" />
              <span>检查通过，可以导出。</span>
            </div>
          </aside>
        </div>
      </section>

      <footer class="guided-footer">
        <button type="button" class="btn btn-sm btn-ghost" :disabled="wizardStep === 0" @click="prevStep">
          上一步
        </button>
        <span class="guided-progress">第 {{ wizardStep + 1 }} / {{ guidedSteps.length }} 步</span>
        <button v-if="wizardStep < guidedSteps.length - 1" type="button" class="btn btn-sm btn-primary" @click="nextStep">
          下一步
        </button>
        <button v-else type="button" class="btn btn-sm btn-primary" @click="finishGuided">
          完成，进入专业模式
        </button>
      </footer>
    </div>

    <div v-if="status" class="status-toast">{{ status }}</div>
    <input
      ref="fileInputRef"
      type="file"
      accept=".json,application/json"
      class="hidden-file"
      @change="onImportFile"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  PhArrowClockwise,
  PhArrowCounterClockwise,
  PhArrowUpRight,
  PhBlueprint,
  PhCheckCircle,
  PhCopy,
  PhFileCode,
  PhFileSvg,
  PhFileText,
  PhFrameCorners,
  PhImage,
  PhInfo,
  PhPlus,
  PhQuestion,
  PhTrash,
  PhUploadSimple,
  PhWarning,
} from '@phosphor-icons/vue'
import type { ValidateFunction } from 'ajv'
import { downloadBlob } from '@/utils/download'
import { getToolById } from '@/tools/toolData'
import SheetCanvas from './SheetCanvas.vue'
import TitleBlockGridEditor from './TitleBlockGridEditor.vue'
import {
  autoFitGridColumns,
  autoFitGridRows,
  buildSheetLayout,
  createDefaultDocument,
  createDefaultValues,
  createTemplate,
  defaultMargins,
  deleteGridColumn,
  deleteGridRow,
  equalizeGridColumns,
  equalizeGridRows,
  FIELD_DEFINITIONS,
  formatPaper,
  insertGridColumn,
  insertGridRow,
  mergeGridCells,
  migrateToGrid,
  normalizeGrid,
  paperDimensions,
  recommendedFontSizes,
  resolveTitleBlockCells,
  snapToSeries,
  splitGridCell,
  syncCellsFromGrid,
  validateTemplate,
  type GridCell,
  type GridRange,
  type Orientation,
  type PaperSize,
  type SheetDocument,
  type SheetTemplate,
  type TitleBlockCell,
  type TitleBlockGrid,
} from './sheetTemplate'
import { createDefaultViewState, groupState, isGroupVisible, setGroupState, VIEW_TREE, type ViewGroup, type ViewState } from './sheetView'
import { sheetToSvg } from './sheetSvg'
import { SHEET_TEMPLATE_SCHEMA, sheetTemplateSchemaJson } from './sheetTemplateSchema'

const toolConfig = getToolById('sheet_template')
const STORAGE_KEY = 'dls.sheet-template.v1'
const VIEW_STATE_KEY = 'dls.sheet-template.view.v1'
const UI_MODE_KEY = 'dls.sheet-template.ui-mode'
const WIZARD_STEP_KEY = 'dls.sheet-template.wizard-step'
const DXF_SETTINGS_KEY = 'dls.sheet-template.dxf-settings'
let validateDocumentSchema: ValidateFunction | null = null

async function getDocumentValidator(): Promise<ValidateFunction> {
  if (validateDocumentSchema) return validateDocumentSchema
  const { default: Ajv2020 } = await import('ajv/dist/2020')
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  validateDocumentSchema = ajv.compile(SHEET_TEMPLATE_SCHEMA as object)
  return validateDocumentSchema
}
const paperSizes = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'] as const
const fontPresets = [
  { label: '微软雅黑 / 苹方', value: "'Microsoft YaHei', 'Noto Sans SC', 'PingFang SC', sans-serif" },
  { label: '宋体', value: "SimSun, 'Songti SC', serif" },
  { label: '黑体', value: "SimHei, 'Heiti SC', sans-serif" },
  { label: 'Noto Sans SC', value: "'Noto Sans SC', sans-serif" },
  { label: '思源黑体', value: "'Source Han Sans SC', sans-serif" },
] as const
const templateKinds = ['gb', 'simple', 'minimal'] as const
const guidedSteps = [
  { title: '图幅' },
  { title: '图签' },
  { title: '内容' },
  { title: '导出' },
] as const
const alignOptions = [
  { value: 'left', label: '左' },
  { value: 'center', label: '中' },
  { value: 'right', label: '右' },
] as const
const valignOptions = [
  { value: 'top', label: '上' },
  { value: 'middle', label: '中' },
  { value: 'bottom', label: '下' },
] as const

const doc = ref<SheetDocument>(createDefaultDocument('gb'))
const activeTemplateKind = ref<'gb' | 'simple' | 'minimal'>('gb')
const selectedCellId = ref<string | null>(null)
const zoom = ref(1)
const snapEnabled = ref(true)
const snapStep = ref(1)
const status = ref('')
const history = ref<SheetDocument[]>([])
const future = ref<SheetDocument[]>([])
const dragSnapshot = ref<SheetDocument | null>(null)
const canvasScrollRef = ref<HTMLDivElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const viewState = ref<ViewState>(createDefaultViewState())
const centerTab = ref<'grid' | 'preview'>('grid')
const uiMode = ref<'guided' | 'advanced'>('guided')
const wizardStep = ref(0)
const showHelp = ref(false)
const focusMode = ref(false)
const fontCustom = ref(false)
const dxfCalibrate = ref(true)
const dxfTextScale = ref(1)
const newFieldLabel = ref('')
const newFieldKey = ref('')
const draftNotice = ref<{ errors: number; warnings: number } | null>(null)
const brokenDraft = ref<SheetDocument | null>(null)
let flashTimer: number | undefined
let saveTimer: number | undefined
let viewSaveTimer: number | undefined

const issues = computed(() => validateTemplate(doc.value.template, doc.value.values))
const errorCount = computed(() => issues.value.filter((issue) => issue.severity === 'error').length)
const warningCount = computed(() => issues.value.filter((issue) => issue.severity === 'warning').length)
const titleBlockCells = computed(() => resolveTitleBlockCells(doc.value.template))
const isGridMode = computed(
  () => doc.value.template.titleBlock.layoutMode === 'grid' && Boolean(doc.value.template.titleBlock.grid),
)
const selectedCell = computed<TitleBlockCell | null>(
  () => titleBlockCells.value.find((cell) => cell.id === selectedCellId.value) ?? null,
)
const selectedGridCell = computed<GridCell | null>(
  () => doc.value.template.titleBlock.grid?.cells.find((cell) => cell.id === selectedCellId.value) ?? null,
)
const editCell = computed<GridCell | TitleBlockCell | null>(() => selectedGridCell.value ?? selectedCell.value)
const absoluteCell = computed<TitleBlockCell>(
  () => selectedCell.value ?? { id: '', x: 0, y: 0, w: 0, h: 0 },
)
const paperLabel = computed(() =>
  formatPaper(
    doc.value.template.paper.size,
    doc.value.template.paper.orientation,
    doc.value.template.paper.width,
    doc.value.template.paper.height,
  ),
)
const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`)
const textStyleKeys = computed(() => Object.keys(doc.value.template.styles.textStyles))
const customFields = computed(() => doc.value.customFields ?? [])
const fieldDefinitions = computed(() => [...FIELD_DEFINITIONS, ...customFields.value])
const fontPreset = computed(() => {
  if (fontCustom.value) return 'custom'
  return fontPresets.find((preset) => preset.value === doc.value.template.styles.fontFamily)?.value ?? 'custom'
})
const viewTree = VIEW_TREE
const fontRows = computed(() => [
  { key: 'title', label: '标题', style: doc.value.template.styles.textStyles.title! },
  { key: 'body', label: '正文', style: doc.value.template.styles.textStyles.body! },
  { key: 'note', label: '注释', style: doc.value.template.styles.textStyles.note! },
  { key: 'label', label: '标签', style: doc.value.template.styles.textStyles.label! },
])
const commonFields = FIELD_DEFINITIONS.filter((field) =>
  ['projectName', 'drawingName', 'drawingNo', 'scale', 'date', 'designer', 'checker', 'company'].includes(field.key),
)
const templateThumbs = computed<Record<'gb' | 'simple' | 'minimal', string>>(() => ({
  gb: templateThumbnail('gb'),
  simple: templateThumbnail('simple'),
  minimal: templateThumbnail('minimal'),
}))

function snapshot(): SheetDocument {
  return JSON.parse(JSON.stringify(doc.value)) as SheetDocument
}

function mutate(fn: () => void): void {
  history.value.push(snapshot())
  if (history.value.length > 60) history.value.shift()
  future.value = []
  fn()
}

function flash(message: string): void {
  status.value = message
  window.clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => {
    status.value = ''
  }, 2400)
}

function templateThumbnail(kind: 'gb' | 'simple' | 'minimal'): string {
  const template = createTemplate(kind, 'A2', 'landscape')
  const values = createDefaultValues()
  const layout = buildSheetLayout(template, values)
  const tb = layout.titleBlock
  const pad = 4
  return sheetToSvg(template, values)
    .replace(
      /viewBox="[^"]*"/,
      `viewBox="${tb.x - pad} ${tb.y - pad} ${tb.w + pad * 2} ${tb.h + pad * 2}"`,
    )
    .replace(/ id="[^"]*"/g, '')
}

function templateName(kind: 'gb' | 'simple' | 'minimal'): string {
  if (kind === 'gb') return '国标风格'
  if (kind === 'simple') return '简洁图签'
  return '极简图签'
}

function templateDesc(kind: 'gb' | 'simple' | 'minimal'): string {
  if (kind === 'gb') return '更改区 / 签字区 / 名称及代号区，适合正式出图'
  if (kind === 'simple') return '工程名称、图名、图号、比例、设计、审核，适合项目图'
  return '只保留图名、图号、比例、日期，适合快速出图'
}

function setUiMode(mode: 'guided' | 'advanced'): void {
  uiMode.value = mode
  if (mode === 'guided') {
    wizardStep.value = 2
    focusMode.value = false
  }
}

function setFontPreset(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'custom') {
    fontCustom.value = true
  } else {
    fontCustom.value = false
    doc.value.template.styles.fontFamily = value
  }
}

function addCustomField(): void {
  const label = newFieldLabel.value.trim()
  const key = newFieldKey.value.trim() || `custom${customFields.value.length + 1}`
  if (!label) {
    flash('请填写字段名称')
    return
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    flash('字段键只能使用字母、数字、下划线，且不能以数字开头')
    return
  }
  if (fieldDefinitions.value.some((field) => field.key === key)) {
    flash('字段键已存在，请换一个')
    return
  }
  mutate(() => {
    doc.value.customFields = [...customFields.value, { key, label }]
    if (doc.value.values[key] === undefined) doc.value.values[key] = ''
  })
  newFieldLabel.value = ''
  newFieldKey.value = ''
  flash(`已添加自定义字段：${label}`)
}

function removeCustomField(key: string): void {
  const label = fieldLabel(key)
  mutate(() => {
    doc.value.customFields = customFields.value.filter((field) => field.key !== key)
    delete doc.value.values[key]
    const grid = doc.value.template.titleBlock.grid
    if (grid) {
      for (const cell of grid.cells) {
        if (cell.field === key) cell.field = undefined
      }
    }
    for (const cell of doc.value.template.titleBlock.cells) {
      if (cell.field === key) cell.field = undefined
    }
    syncCellsFromGrid(doc.value.template)
  })
  flash(`已删除自定义字段：${label}`)
}

function setCellFontSize(event: Event): void {
  const cell = editCell.value
  if (!cell) return
  const raw = (event.target as HTMLInputElement).value.trim()
  const value = Number(raw)
  mutate(() => {
    if (!raw || !Number.isFinite(value) || value <= 0) delete cell.fontSize
    else cell.fontSize = value
    syncCellsFromGrid(doc.value.template)
  })
}

function setCellBold(event: Event): void {
  const cell = editCell.value
  if (!cell) return
  const value = (event.target as HTMLSelectElement).value
  mutate(() => {
    if (value === '') delete cell.bold
    else cell.bold = value === '1'
    syncCellsFromGrid(doc.value.template)
  })
}

function nextStep(): void {
  wizardStep.value = Math.min(3, wizardStep.value + 1)
}

function prevStep(): void {
  wizardStep.value = Math.max(0, wizardStep.value - 1)
}

function paperCardLabel(size: PaperSize): string {
  const dims = paperDimensions(size, doc.value.template.paper.orientation)
  return `${dims.width}×${dims.height} mm`
}

function fieldLabel(key?: string): string {
  if (!key) return ''
  return fieldDefinitions.value.find((field) => field.key === key)?.label ?? key
}

function updateGuidedText(event: Event): void {
  const cell = editCell.value
  if (!cell) return
  const value = (event.target as HTMLInputElement).value
  if (cell.text !== undefined) cell.text = value
  else cell.label = value
}

function fillSampleData(): void {
  mutate(() => {
    doc.value.values = createDefaultValues()
  })
  flash('已填入示例数据')
}

function finishGuided(): void {
  uiMode.value = 'advanced'
  flash('已完成，已切换到专业模式，可继续调整结构')
}

async function exportPng(): Promise<void> {
  try {
    const svg = sheetToSvg(doc.value.template, doc.value.values, { viewState: viewState.value })
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('SVG 渲染失败'))
      image.src = url
    })
    const scale = 4
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(doc.value.template.paper.width * scale)
    canvas.height = Math.round(doc.value.template.paper.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建画布')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('PNG 生成失败')
    downloadBlob(blob, `sheet-${doc.value.template.paper.size}-${doc.value.template.paper.orientation}.png`)
    flash('PNG 已导出')
  } catch (error) {
    flash(`PNG 导出失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

function setPaper(size: PaperSize): void {
  mutate(() => {
    const orientation = doc.value.template.paper.orientation
    const dims = paperDimensions(size, orientation)
    doc.value.template.paper = { size, orientation, width: dims.width, height: dims.height }
    doc.value.template.margins = defaultMargins(size, doc.value.template.bindingEdge, doc.value.template.margins.binding)
    applyRecommendedFontsInternal()
  })
}

function setOrientation(orientation: Orientation): void {
  mutate(() => {
    const t = doc.value.template
    const dims = paperDimensions(t.paper.size, orientation)
    t.paper.orientation = orientation
    t.paper.width = dims.width
    t.paper.height = dims.height
    t.margins = defaultMargins(t.paper.size, t.bindingEdge, t.margins.binding)
  })
}

function setBindingEdge(edge: 'left' | 'right'): void {
  mutate(() => {
    const t = doc.value.template
    t.bindingEdge = edge
    t.margins = defaultMargins(t.paper.size, edge, t.margins.binding)
  })
}

function applyBindingMargins(): void {
  mutate(() => {
    const t = doc.value.template
    t.margins = defaultMargins(t.paper.size, t.bindingEdge, t.margins.binding)
  })
}

function applyRecommendedFontsInternal(): void {
  const f = recommendedFontSizes(doc.value.template.paper.size)
  const styles = doc.value.template.styles.textStyles
  styles.title = { ...styles.title!, fontSize: f.title }
  styles.body = { ...styles.body!, fontSize: f.body }
  styles.note = { ...styles.note!, fontSize: f.note }
  styles.label = { ...styles.label!, fontSize: f.note }
}

function ensureTextStyles(template: SheetTemplate): void {
  const f = recommendedFontSizes(template.paper.size)
  const defaults: Record<string, number> = {
    title: f.title,
    body: f.body,
    note: f.note,
    label: f.note,
  }
  for (const [key, fontSize] of Object.entries(defaults)) {
    if (!template.styles.textStyles[key]) {
      template.styles.textStyles[key] = {
        fontSize,
        lineHeight: 1.2,
        bold: key === 'title',
        widthFactor: 1,
      }
    }
  }
}

function applyRecommendedFonts(): void {
  mutate(() => {
    applyRecommendedFontsInternal()
    flash('已按图幅应用推荐字高')
  })
}

function snapFont(key: string): void {
  mutate(() => {
    const style = doc.value.template.styles.textStyles[key]
    if (style) style.fontSize = snapToSeries(style.fontSize)
  })
}

function setTemplateKind(kind: 'gb' | 'simple' | 'minimal'): void {
  mutate(() => {
    const current = doc.value.template
    const next = createTemplate(kind, current.paper.size, current.paper.orientation)
    next.paper = { ...current.paper }
    next.margins = { ...current.margins }
    next.bindingEdge = current.bindingEdge
    next.frame = { ...current.frame }
    next.styles = { ...current.styles }
    next.theme = { ...current.theme }
    doc.value.template = next
    activeTemplateKind.value = kind
    selectedCellId.value = null
  })
}

function onCanvasUpdateCell(id: string, patch: { x?: number; y?: number; w?: number; h?: number }): void {
  if (isGridMode.value) return
  const cell = doc.value.template.titleBlock.cells.find((item) => item.id === id)
  if (!cell) return
  Object.assign(cell, patch)
}

function onBeginEdit(): void {
  dragSnapshot.value = snapshot()
}

function onEndEdit(): void {
  const before = dragSnapshot.value
  dragSnapshot.value = null
  if (!before) return
  if (JSON.stringify(before) === JSON.stringify(doc.value)) return
  history.value.push(before)
  if (history.value.length > 60) history.value.shift()
  future.value = []
}

function undo(): void {
  const previous = history.value.pop()
  if (!previous) return
  future.value.push(snapshot())
  doc.value = previous
  selectedCellId.value = null
  flash('已撤销')
}

function redo(): void {
  const next = future.value.pop()
  if (!next) return
  history.value.push(snapshot())
  doc.value = next
  selectedCellId.value = null
  flash('已重做')
}

function reset(): void {
  mutate(() => {
    doc.value = createDefaultDocument(activeTemplateKind.value)
    selectedCellId.value = resolveTitleBlockCells(doc.value.template)[0]?.id ?? null
    draftNotice.value = null
    brokenDraft.value = null
    zoom.value = 1
    flash('已恢复默认模板')
  })
}

function restoreDraft(): void {
  const draft = brokenDraft.value
  if (!draft) return
  ensureTextStyles(draft.template)
  migrateToGrid(draft.template)
  syncCellsFromGrid(draft.template)
  doc.value = draft
  selectedCellId.value = resolveTitleBlockCells(draft.template)[0]?.id ?? null
  draftNotice.value = null
  brokenDraft.value = null
  centerTab.value = 'grid'
  flash('已恢复上次草稿，请处理校验问题')
}

function dismissDraft(): void {
  draftNotice.value = null
  brokenDraft.value = null
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 忽略 */
  }
  flash('已忽略上次草稿')
}

function nudge(dx: number, dy: number): void {
  if (isGridMode.value) {
    flash('网格模式下请用行列工具调整')
    return
  }
  const cell = selectedCell.value
  if (!cell) return
  mutate(() => {
    const tb = doc.value.template.titleBlock
    cell.x = Math.min(Math.max(0, cell.x + dx), Math.max(0, tb.width - cell.w))
    cell.y = Math.min(Math.max(0, cell.y + dy), Math.max(0, tb.height - cell.h))
  })
}

function isViewVisible(id: string): boolean {
  if (id === 'grid') return viewState.value.showGrid
  if (id === 'tooltip') return viewState.value.showTooltips
  return isGroupVisible(viewState.value, id)
}

function toggleView(id: string, visible: boolean): void {
  if (id === 'grid') {
    viewState.value.showGrid = visible
    viewState.value.groups.grid = visible
    return
  }
  if (id === 'tooltip') {
    viewState.value.showTooltips = visible
    viewState.value.groups.tooltip = visible
    return
  }
  viewState.value.groups[id] = visible
}

function onViewCheck(id: string, event: Event): void {
  toggleView(id, (event.target as HTMLInputElement).checked)
}

function gridColumnLabel(index: number): string {
  let value = index + 1
  let label = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    label = String.fromCharCode(65 + remainder) + label
    value = Math.floor((value - 1) / 26)
  }
  return label
}

function onBorderChange(event: Event): void {
  if (!editCell.value) return
  editCell.value.border = (event.target as HTMLInputElement).checked
}

function toggleParent(group: ViewGroup, visible: boolean): void {
  setGroupState(viewState.value, group, visible)
  viewState.value.showGrid = viewState.value.groups.grid !== false
  viewState.value.showTooltips = viewState.value.groups.tooltip !== false
}

function setAllView(visible: boolean): void {
  for (const group of viewTree) setGroupState(viewState.value, group, visible)
  viewState.value.showGrid = visible
  viewState.value.showTooltips = visible
}

function viewGroupState(group: ViewGroup): 'all' | 'some' | 'none' {
  return groupState(viewState.value, group)
}

function viewGroupStateLabel(group: ViewGroup): string {
  const state = viewGroupState(group)
  return state === 'all' ? '全显' : state === 'none' ? '全隐' : '部分'
}

function convertToGrid(): void {
  if (isGridMode.value) return
  mutate(() => {
    migrateToGrid(doc.value.template)
    syncCellsFromGrid(doc.value.template)
    selectedCellId.value = null
    centerTab.value = 'grid'
    flash('已转换为网格模式')
  })
}

function setCenterTab(tab: 'grid' | 'preview'): void {
  if (tab === 'grid' && !isGridMode.value) {
    convertToGrid()
    return
  }
  centerTab.value = tab
}

function gridOf(): TitleBlockGrid | null {
  return doc.value.template.titleBlock.grid ?? null
}

function withGrid(fn: (grid: TitleBlockGrid) => void, message?: string): void {
  const grid = gridOf()
  if (!grid) {
    flash('当前不是网格模式')
    return
  }
  mutate(() => {
    fn(grid)
    syncCellsFromGrid(doc.value.template)
    if (message) flash(message)
  })
}

function splitCellsAcrossRow(grid: TitleBlockGrid, index: number): number {
  const additions: GridCell[] = []
  let count = 0
  for (const cell of grid.cells) {
    if (cell.row < index && cell.row + cell.rowSpan > index) {
      const bottomSpan = cell.row + cell.rowSpan - index
      cell.rowSpan = index - cell.row
      additions.push({
        ...cell,
        id: `${cell.id}-split-${index}`,
        row: index,
        rowSpan: bottomSpan,
        label: undefined,
        field: undefined,
        text: undefined,
      })
      count += 1
    }
  }
  grid.cells.push(...additions)
  return count
}

function splitCellsAcrossColumn(grid: TitleBlockGrid, index: number): number {
  const additions: GridCell[] = []
  let count = 0
  for (const cell of grid.cells) {
    if (cell.col < index && cell.col + cell.colSpan > index) {
      const rightSpan = cell.col + cell.colSpan - index
      cell.colSpan = index - cell.col
      additions.push({
        ...cell,
        id: `${cell.id}-split-${index}`,
        col: index,
        colSpan: rightSpan,
        label: undefined,
        field: undefined,
        text: undefined,
      })
      count += 1
    }
  }
  grid.cells.push(...additions)
  return count
}

function gridInsertRow(index: number): void {
  const grid = gridOf()
  if (!grid) return
  const selected = selectedGridCell.value
  mutate(() => {
    const split = splitCellsAcrossRow(grid, index)
    insertGridRow(grid, index)
    normalizeGrid(grid, doc.value.template.titleBlock.width, doc.value.template.titleBlock.height)
    const cell = createGridCellAt(index, selected?.col ?? 0, 1, selected?.colSpan ?? 1)
    grid.cells.push(cell)
    selectedCellId.value = cell.id
    syncCellsFromGrid(doc.value.template)
    flash(split > 0 ? '已插入行并创建新单元格（跨行合并单元格已拆分）' : '已插入行并创建新单元格')
  })
}

function gridDeleteRow(index: number): void {
  withGrid((grid) => {
    deleteGridRow(grid, index)
    normalizeGrid(grid, doc.value.template.titleBlock.width, doc.value.template.titleBlock.height)
  }, '已删除行')
}

function gridInsertColumn(index: number): void {
  const grid = gridOf()
  if (!grid) return
  const selected = selectedGridCell.value
  mutate(() => {
    const split = splitCellsAcrossColumn(grid, index)
    insertGridColumn(grid, index)
    normalizeGrid(grid, doc.value.template.titleBlock.width, doc.value.template.titleBlock.height)
    const cell = createGridCellAt(selected?.row ?? 0, index, selected?.rowSpan ?? 1, 1)
    grid.cells.push(cell)
    selectedCellId.value = cell.id
    syncCellsFromGrid(doc.value.template)
    flash(split > 0 ? '已插入列并创建新单元格（跨列合并单元格已拆分）' : '已插入列并创建新单元格')
  })
}

function gridDeleteColumn(index: number): void {
  withGrid((grid) => {
    deleteGridColumn(grid, index)
    normalizeGrid(grid, doc.value.template.titleBlock.width, doc.value.template.titleBlock.height)
  }, '已删除列')
}

function createGridCellAt(row: number, col: number, rowSpan = 1, colSpan = 1): GridCell {
  return {
    id: `cell-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    row,
    col,
    rowSpan,
    colSpan,
    label: '新单元格',
    textStyle: 'body',
    align: 'center',
    valign: 'middle',
    border: true,
  }
}

function gridAddCellAt(row: number, col: number): void {
  const grid = gridOf()
  if (!grid) return
  const occupied = grid.cells.some(
    (cell) =>
      row >= cell.row &&
      row < cell.row + cell.rowSpan &&
      col >= cell.col &&
      col < cell.col + cell.colSpan,
  )
  if (occupied) {
    flash('该位置已有单元格')
    return
  }
  mutate(() => {
    const cell = createGridCellAt(row, col)
    grid.cells.push(cell)
    selectedCellId.value = cell.id
    syncCellsFromGrid(doc.value.template)
  })
  flash('已添加单元格')
}

function gridUpdateField(field: string, value: string): void {
  mutate(() => {
    doc.value.values[field] = value
  })
}

function gridUpdateCellText(cellId: string, value: string, target: 'label' | 'text'): void {
  const grid = gridOf()
  if (!grid) return
  mutate(() => {
    const cell = grid.cells.find((item) => item.id === cellId)
    if (!cell) return
    if (target === 'text') cell.text = value
    else cell.label = value
    syncCellsFromGrid(doc.value.template)
  })
}

function gridMerge(range: GridRange): void {
  const grid = gridOf()
  if (!grid) return
  mutate(() => {
    const result = mergeGridCells(grid, range)
    if (!result.ok) {
      flash(result.reason ?? '无法合并')
      return
    }
    if (result.cell) selectedCellId.value = result.cell.id
    syncCellsFromGrid(doc.value.template)
  })
}

function gridSplit(cellId: string | null): void {
  if (!cellId) return
  const grid = gridOf()
  const cell = grid?.cells.find((item) => item.id === cellId)
  if (!cell) return
  if (cell.rowSpan === 1 && cell.colSpan === 1) {
    flash('该单元格不是合并单元格')
    return
  }
  withGrid((gridValue) => {
    splitGridCell(gridValue, cellId)
    selectedCellId.value = null
  }, '已拆分单元格')
}

function gridResizeColumn(index: number, size: number): void {
  const grid = gridOf()
  const track = grid?.columns[index]
  if (track) track.size = Math.max(2, Math.round(size * 10) / 10)
}

function gridResizeRow(index: number, size: number): void {
  const grid = gridOf()
  const track = grid?.rows[index]
  if (track) track.size = Math.max(2, Math.round(size * 10) / 10)
}

function gridEqualizeColumns(): void {
  withGrid((grid) => equalizeGridColumns(grid, doc.value.template.titleBlock.width), '已等宽列')
}

function gridEqualizeRows(): void {
  withGrid((grid) => equalizeGridRows(grid, doc.value.template.titleBlock.height), '已等高行')
}

function gridAutoFit(): void {
  const grid = gridOf()
  if (!grid) return
  const bodySize = doc.value.template.styles.textStyles.body?.fontSize ?? 5
  withGrid((gridValue) => {
    autoFitGridColumns(gridValue, doc.value.template.titleBlock.width, doc.value.values, doc.value.template.styles.fontFamily, bodySize)
    autoFitGridRows(gridValue, doc.value.template.titleBlock.height, doc.value.values, bodySize)
  }, '已按内容自适应')
}

function gridNormalize(): void {
  withGrid(
    (grid) => normalizeGrid(grid, doc.value.template.titleBlock.width, doc.value.template.titleBlock.height),
    '已归一化到图签尺寸',
  )
}

function findFreeSlot(grid: TitleBlockGrid): { row: number; col: number } | null {
  for (let row = 0; row < grid.rows.length; row += 1) {
    for (let col = 0; col < grid.columns.length; col += 1) {
      const occupied = grid.cells.some(
        (cell) =>
          row >= cell.row &&
          row < cell.row + cell.rowSpan &&
          col >= cell.col &&
          col < cell.col + cell.colSpan,
      )
      if (!occupied) return { row, col }
    }
  }
  return null
}

function addGridCell(): void {
  const grid = gridOf()
  if (!grid) return
  const slot = findFreeSlot(grid)
  if (!slot) {
    flash('没有空位，请先插入行列')
    return
  }
  mutate(() => {
    const cell: GridCell = {
      id: `cell-${Date.now().toString(36)}`,
      row: slot.row,
      col: slot.col,
      rowSpan: 1,
      colSpan: 1,
      label: '新单元格',
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
      border: true,
    }
    grid.cells.push(cell)
    selectedCellId.value = cell.id
    syncCellsFromGrid(doc.value.template)
  })
}

function addCell(): void {
  if (isGridMode.value) {
    addGridCell()
    return
  }
  mutate(() => {
    const cells = doc.value.template.titleBlock.cells
    const id = `cell-${Date.now().toString(36)}`
    const cell: TitleBlockCell = {
      id,
      label: '新单元格',
      x: 0,
      y: 0,
      w: 40,
      h: 10,
      textStyle: 'body',
      align: 'center',
      valign: 'middle',
      border: true,
    }
    cells.push(cell)
    selectedCellId.value = id
  })
}

function deleteCell(): void {
  const id = selectedCellId.value
  if (!id) return
  if (isGridMode.value) {
    withGrid((grid) => {
      grid.cells = grid.cells.filter((cell) => cell.id !== id)
      selectedCellId.value = null
    }, '已删除单元格')
    return
  }
  mutate(() => {
    const cells = doc.value.template.titleBlock.cells
    const index = cells.findIndex((cell) => cell.id === id)
    if (index >= 0) cells.splice(index, 1)
    selectedCellId.value = null
  })
}

function duplicateCell(): void {
  const current = selectedCell.value
  if (!current) return
  if (isGridMode.value) {
    const grid = gridOf()
    if (!grid) return
    const slot = findFreeSlot(grid)
    if (!slot) {
      flash('没有空位，请先插入行列')
      return
    }
    mutate(() => {
      const source = grid.cells.find((cell) => cell.id === current.id)
      const clone: GridCell = {
        ...(source ?? {
          id: current.id,
          row: slot.row,
          col: slot.col,
          rowSpan: 1,
          colSpan: 1,
          label: current.label,
          field: current.field,
          text: current.text,
          textStyle: current.textStyle,
          align: current.align,
          valign: current.valign,
          border: current.border,
        }),
        id: `${current.id}-copy-${Date.now().toString(36)}`,
        row: slot.row,
        col: slot.col,
        rowSpan: 1,
        colSpan: 1,
      }
      grid.cells.push(clone)
      selectedCellId.value = clone.id
      syncCellsFromGrid(doc.value.template)
    })
    return
  }
  mutate(() => {
    const cells = doc.value.template.titleBlock.cells
    const clone: TitleBlockCell = {
      ...current,
      id: `${current.id}-copy-${Date.now().toString(36)}`,
      x: current.x + 2,
      y: current.y + 2,
    }
    cells.push(clone)
    selectedCellId.value = clone.id
  })
}

function setZoom(next: number): void {
  zoom.value = Math.min(2.5, Math.max(0.5, Math.round(next * 100) / 100))
}

function focusTitleBlock(): void {
  zoom.value = 2.2
  nextTick(() => {
    window.setTimeout(() => {
      const element = canvasScrollRef.value
      if (!element) return
      element.scrollTo({ left: element.scrollWidth, top: element.scrollHeight, behavior: 'smooth' })
    }, 240)
  })
}

function exportJson(): void {
  const data = snapshot()
  syncCellsFromGrid(data.template)
  data.exportedAt = new Date().toISOString()
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }),
    `sheet-${doc.value.template.paper.size}-${doc.value.template.paper.orientation}.json`,
  )
  flash('JSON 已导出')
}

function exportSchema(): void {
  downloadBlob(
    new Blob([sheetTemplateSchemaJson()], { type: 'application/schema+json;charset=utf-8' }),
    'sheet-template.schema.json',
  )
  flash('JSON Schema 已导出')
}

function exportSvg(): void {
  const svg = sheetToSvg(doc.value.template, doc.value.values, { viewState: viewState.value })
  downloadBlob(
    new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
    `sheet-${doc.value.template.paper.size}-${doc.value.template.paper.orientation}.svg`,
  )
  flash('SVG 已导出')
}

async function exportDxf(): Promise<void> {
  try {
    const { sheetToDxf } = await import('./sheetDxf')
    const dxf = sheetToDxf(doc.value.template, doc.value.values, {
      viewState: viewState.value,
      textScale: dxfTextScale.value,
      calibrateTextHeight: dxfCalibrate.value,
    })
    downloadBlob(
      new Blob([dxf], { type: 'application/dxf;charset=utf-8' }),
      `sheet-${doc.value.template.paper.size}-${doc.value.template.paper.orientation}.dxf`,
    )
    flash('DXF 已导出')
  } catch (error) {
    flash(`DXF 导出失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

function triggerImport(): void {
  fileInputRef.value?.click()
}

async function onImportFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown
    const validator = await getDocumentValidator()
    if (!validator(parsed)) {
      const messages = (validator.errors ?? [])
        .map((error) => `${error.instancePath || '/'} ${error.message ?? ''}`.trim())
        .slice(0, 4)
        .join('；')
      flash(`JSON Schema 校验失败：${messages}`)
      return
    }
    const imported = parsed as SheetDocument
    ensureTextStyles(imported.template)
    migrateToGrid(imported.template)
    syncCellsFromGrid(imported.template)
    mutate(() => {
      doc.value = imported
      selectedCellId.value = null
      centerTab.value = 'grid'
      activeTemplateKind.value = imported.template.id.startsWith('simple')
        ? 'simple'
        : imported.template.id.startsWith('minimal')
          ? 'minimal'
          : 'gb'
    })
    flash('JSON 已导入并通过 Schema 校验')
  } catch (error) {
    flash(`导入失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    input.value = ''
  }
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
    event.preventDefault()
    redo()
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (selectedCell.value) {
      event.preventDefault()
      deleteCell()
    }
    return
  }
  const step = event.shiftKey ? 5 : 1
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    nudge(-step, 0)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    nudge(step, 0)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    nudge(0, -step)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    nudge(0, step)
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SheetDocument
      if (parsed?.schemaVersion === 1 && parsed.template && parsed.values) {
        ensureTextStyles(parsed.template)
        migrateToGrid(parsed.template)
        syncCellsFromGrid(parsed.template)
        const savedIssues = validateTemplate(parsed.template, parsed.values)
        const savedErrors = savedIssues.filter((issue) => issue.severity === 'error').length
        const savedWarnings = savedIssues.filter((issue) => issue.severity === 'warning').length
        if (savedErrors > 0) {
          brokenDraft.value = parsed
          draftNotice.value = { errors: savedErrors, warnings: savedWarnings }
        } else {
          doc.value = parsed
        }
      }
    }
    const rawView = window.localStorage.getItem(VIEW_STATE_KEY)
    if (rawView) {
      const parsedView = JSON.parse(rawView) as ViewState
      if (parsedView?.groups) {
        const defaults = createDefaultViewState()
        viewState.value = {
          ...defaults,
          ...parsedView,
          groups: { ...defaults.groups, ...parsedView.groups },
        }
      }
    }
    const savedMode = window.localStorage.getItem(UI_MODE_KEY)
    if (savedMode === 'guided' || savedMode === 'advanced') {
      uiMode.value = savedMode
    } else {
      showHelp.value = true
    }
    const savedStep = Number(window.localStorage.getItem(WIZARD_STEP_KEY))
    if (Number.isFinite(savedStep)) {
      wizardStep.value = Math.max(0, Math.min(3, Math.round(savedStep)))
      if (wizardStep.value > 0) showHelp.value = false
    }
    const rawDxfSettings = window.localStorage.getItem(DXF_SETTINGS_KEY)
    if (rawDxfSettings) {
      const parsed = JSON.parse(rawDxfSettings) as { calibrate?: boolean; textScale?: number }
      if (typeof parsed.calibrate === 'boolean') dxfCalibrate.value = parsed.calibrate
      if (typeof parsed.textScale === 'number' && parsed.textScale > 0) {
        dxfTextScale.value = parsed.textScale
      }
    }
  } catch {
    /* localStorage 不可用时忽略 */
  }
  if (!selectedCellId.value) {
    const first = resolveTitleBlockCells(doc.value.template)[0]
    if (first) selectedCellId.value = first.id
  }
})

watch(
  doc,
  () => {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      try {
        const data = snapshot()
        syncCellsFromGrid(data.template)
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch {
        /* 隐私模式/配额不足时忽略 */
      }
    }, 250)
  },
  { deep: true },
)

watch(
  viewState,
  () => {
    window.clearTimeout(viewSaveTimer)
    viewSaveTimer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(viewState.value))
      } catch {
        /* 忽略 */
      }
    }, 250)
  },
  { deep: true },
)

watch([uiMode, wizardStep], ([, step]) => {
  if (step > 0) showHelp.value = false
  try {
    window.localStorage.setItem(UI_MODE_KEY, uiMode.value)
    window.localStorage.setItem(WIZARD_STEP_KEY, String(wizardStep.value))
  } catch {
    /* 忽略 */
  }
})

watch([dxfCalibrate, dxfTextScale], () => {
  try {
    window.localStorage.setItem(
      DXF_SETTINGS_KEY,
      JSON.stringify({ calibrate: dxfCalibrate.value, textScale: dxfTextScale.value }),
    )
  } catch {
    /* 忽略 */
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.clearTimeout(flashTimer)
  window.clearTimeout(saveTimer)
  window.clearTimeout(viewSaveTimer)
})
</script>

<style scoped>
.sheet-page {
  min-height: 100%;
  padding: 24px;
  background: var(--color-base-200);
  color: var(--color-base-content);
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.page-title h1 {
  margin: 2px 0 4px;
  font-size: 24px;
  font-weight: 750;
  letter-spacing: -0.02em;
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-primary);
  font-weight: 700;
}
.eyebrow svg {
  width: 14px;
  height: 14px;
}
.page-desc {
  margin: 0;
  max-width: 680px;
  font-size: 12px;
  color: color-mix(in oklab, var(--color-base-content) 62%, transparent);
}
.page-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
  border: 1px solid color-mix(in oklab, var(--color-primary) 22%, var(--color-base-300));
  background: color-mix(in oklab, var(--color-primary) 6%, var(--color-base-100));
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.6;
}
.notice svg {
  width: 15px;
  height: 15px;
  margin-top: 2px;
  color: var(--color-primary);
  flex: 0 0 auto;
}
.notice p {
  margin: 0;
}
.draft-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 9px 12px;
  margin-bottom: 14px;
  border: 1px solid color-mix(in oklab, var(--color-warning) 45%, var(--color-base-300));
  background: color-mix(in oklab, var(--color-warning) 12%, var(--color-base-100));
  color: var(--color-warning);
  border-radius: 10px;
  font-size: 11px;
  line-height: 1.5;
}
.draft-notice svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}
.draft-notice p {
  flex: 1;
  min-width: 260px;
  margin: 0;
}
.draft-notice .btn {
  color: var(--color-warning);
  border-color: color-mix(in oklab, var(--color-warning) 45%, var(--color-base-300));
}
.readout {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
  color: var(--color-primary);
}
.workbench {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 340px;
  gap: 14px;
  align-items: start;
}
.workbench.focus-mode {
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
}
.workbench.focus-mode .left-panel,
.workbench.focus-mode .right-panel {
  display: none;
}
.workbench.focus-mode .canvas-panel {
  height: calc(100vh - 260px);
  min-height: 620px;
}
.workbench.focus-mode .grid-tab {
  flex: 1;
  min-height: 0;
}
.workbench.focus-mode .grid-tab :deep(.grid-editor) {
  flex: 1;
  min-height: 0;
}
.workbench.focus-mode .canvas-scroll {
  flex: 1;
  min-height: 0;
  max-height: none;
}
.panel {
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  border-radius: 14px;
  overflow: hidden;
}
.panel-section {
  padding: 13px 14px;
  border-bottom: 1px solid color-mix(in oklab, var(--color-base-300) 65%, transparent);
}
.panel-section:last-child {
  border-bottom: 0;
}
.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 9px;
}
.panel-head h2 {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in oklab, var(--color-base-content) 58%, transparent);
  font-weight: 750;
}
.panel-hint {
  font-size: 10px;
  color: color-mix(in oklab, var(--color-base-content) 48%, transparent);
  white-space: nowrap;
}
.segmented {
  display: flex;
  gap: 4px;
  padding: 3px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: var(--color-base-200);
}
.segmented.six {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
}
.segmented.three {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
.segmented button {
  appearance: none;
  border: 0;
  border-radius: 6px;
  padding: 5px 4px;
  font-size: 11px;
  font-family: inherit;
  color: color-mix(in oklab, var(--color-base-content) 65%, transparent);
  background: transparent;
  cursor: pointer;
}
.segmented button:hover {
  color: var(--color-base-content);
}
.segmented button.active {
  background: var(--color-base-100);
  color: var(--color-primary);
  font-weight: 700;
  box-shadow: 0 1px 3px rgb(15 23 42 / 0.10);
}
.field-grid {
  display: grid;
  gap: 7px;
  margin-bottom: 8px;
}
.field-grid.two {
  grid-template-columns: 1fr 1fr;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 7px;
  font-size: 10px;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
}
.field span {
  padding-left: 1px;
}
.field input,
.field select {
  width: 100%;
  height: 29px;
  padding: 0 7px;
  border: 1px solid var(--color-base-300);
  border-radius: 6px;
  background: var(--color-base-100);
  color: var(--color-base-content);
  font-family: inherit;
  font-size: 11px;
  outline: none;
}
.field input:focus,
.field select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-primary) 16%, transparent);
}
.field.compact-field {
  display: grid;
  grid-template-columns: 78px 1fr;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.field.compact-field span {
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.field.compact-field input {
  height: 25px;
}
.check-row {
  display: flex;
  gap: 14px;
  margin: 8px 0;
}
.check {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 68%, transparent);
  cursor: pointer;
}
.check.compact {
  font-size: 10px;
  white-space: nowrap;
}
.check input {
  accent-color: var(--color-primary);
}
.btn.wide {
  width: 100%;
}
.font-rows {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 8px;
}
.font-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto auto;
  gap: 6px;
  align-items: center;
  font-size: 10px;
  color: color-mix(in oklab, var(--color-base-content) 58%, transparent);
}
.font-row input {
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--color-base-300);
  border-radius: 6px;
  background: var(--color-base-100);
  color: var(--color-base-content);
  font-family: inherit;
  font-size: 11px;
}
.font-bold {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  white-space: nowrap;
  cursor: pointer;
}
.font-bold input {
  width: 13px;
  height: 13px;
  accent-color: var(--color-primary);
}
.mini-btn {
  appearance: none;
  border: 1px solid var(--color-base-300);
  background: var(--color-base-100);
  color: color-mix(in oklab, var(--color-base-content) 70%, transparent);
  border-radius: 5px;
  padding: 3px 6px;
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
}
.mini-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.mini-btn.danger:hover {
  border-color: #c0392b;
  color: #c0392b;
}
.focus-toggle {
  flex: 0 0 auto;
}
.custom-fields {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in oklab, var(--color-base-300) 65%, transparent);
}
.custom-fields-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.custom-fields-head h3 {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  color: color-mix(in oklab, var(--color-base-content) 62%, transparent);
}
.custom-fields-head span {
  font-size: 10px;
  color: color-mix(in oklab, var(--color-base-content) 42%, transparent);
}
.custom-field-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 6px;
  align-items: center;
  padding: 4px 0;
  font-size: 10px;
}
.custom-field-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.custom-field-row code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 9px;
  color: var(--color-primary);
}
.custom-field-add {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 5px;
  margin-top: 6px;
}
.custom-field-add input {
  min-width: 0;
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--color-base-300);
  border-radius: 6px;
  background: var(--color-base-100);
  color: var(--color-base-content);
  font-family: inherit;
  font-size: 10px;
}
.hint {
  margin: 6px 0 0;
  font-size: 10px;
  line-height: 1.5;
  color: color-mix(in oklab, var(--color-base-content) 46%, transparent);
}
.export-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.export-grid .btn {
  justify-content: center;
}
.export-grid .span-two {
  grid-column: 1 / -1;
}
.dxf-settings {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 9px;
  padding-top: 8px;
  border-top: 1px solid color-mix(in oklab, var(--color-base-300) 65%, transparent);
}
.dxf-settings .compact-field {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 6px;
  align-items: center;
}
.hidden-file {
  display: none;
}
.canvas-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.editor-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  border-radius: 12px 12px 0 0;
  border-bottom: 0;
}
.editor-tabs button {
  appearance: none;
  border: 0;
  background: transparent;
  color: color-mix(in oklab, var(--color-base-content) 58%, transparent);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
}
.editor-tabs button:hover {
  color: var(--color-base-content);
}
.editor-tabs button.active {
  background: var(--color-primary);
  color: #fff;
  font-weight: 700;
}
.editor-tabs-hint {
  margin-left: auto;
  font-size: 10px;
  color: color-mix(in oklab, var(--color-base-content) 46%, transparent);
}
.grid-tab {
  padding: 12px;
  display: flex;
  flex-direction: column;
  min-height: clamp(560px, calc(100vh - 330px), 980px);
  background: color-mix(in oklab, var(--color-base-200) 72%, var(--color-base-100));
  border-left: 1px solid var(--color-base-300);
  border-right: 1px solid var(--color-base-300);
}
.grid-tab :deep(.grid-editor) {
  flex: 1;
}
.grid-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 480px;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
  font-size: 12px;
  text-align: center;
}
.grid-empty p {
  margin: 0;
  max-width: 360px;
  line-height: 1.6;
}
.view-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.view-group {
  margin-bottom: 8px;
}
.view-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
  font-size: 10px;
  font-weight: 700;
  color: color-mix(in oklab, var(--color-base-content) 62%, transparent);
}
.view-group-state {
  font-size: 9px;
  font-weight: 400;
  color: color-mix(in oklab, var(--color-base-content) 38%, transparent);
}
.view-group-state.all {
  color: var(--color-success);
}
.view-group-state.some {
  color: var(--color-warning);
}
.view-group-state.none {
  color: color-mix(in oklab, var(--color-base-content) 38%, transparent);
}
.view-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 0 2px 8px;
  font-size: 10px;
  color: color-mix(in oklab, var(--color-base-content) 62%, transparent);
  cursor: pointer;
}
.view-item input {
  accent-color: var(--color-primary);
}
.view-desc {
  font-size: 9px;
  color: color-mix(in oklab, var(--color-base-content) 38%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.canvas-toolbar {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  padding: 8px 11px;
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  border-radius: 12px 12px 0 0;
  border-bottom: 0;
}
.canvas-status {
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 58%, transparent);
  white-space: nowrap;
}
.toolbar-spacer {
  flex: 1;
}
.snap-select {
  height: 24px;
  padding: 0 5px;
  border: 1px solid var(--color-base-300);
  border-radius: 5px;
  background: var(--color-base-100);
  color: var(--color-base-content);
  font-family: inherit;
  font-size: 10px;
}
.zoom-label {
  min-width: 38px;
  text-align: center;
  font-size: 10px;
  color: color-mix(in oklab, var(--color-base-content) 58%, transparent);
  font-variant-numeric: tabular-nums;
}
.canvas-scroll {
  overflow: auto;
  padding: 22px;
  min-height: clamp(560px, calc(100vh - 330px), 980px);
  max-height: calc(100vh - 180px);
  background: color-mix(in oklab, var(--color-base-200) 72%, var(--color-base-100));
  border-left: 1px solid var(--color-base-300);
  border-right: 1px solid var(--color-base-300);
}
.canvas-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 11px;
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  border-top: 0;
  border-radius: 0 0 12px 12px;
  font-size: 10px;
  color: color-mix(in oklab, var(--color-base-content) 48%, transparent);
}
.issue-badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 700;
  white-space: nowrap;
}
.issue-badge.ok {
  color: var(--color-success);
  background: color-mix(in oklab, var(--color-success) 14%, var(--color-base-100));
}
.issue-badge.warning {
  color: var(--color-warning);
  background: color-mix(in oklab, var(--color-warning) 18%, var(--color-base-100));
}
.issue-badge.error {
  color: var(--color-error);
  background: color-mix(in oklab, var(--color-error) 14%, var(--color-base-100));
}
.cell-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.cell-actions .btn {
  flex: 1;
  justify-content: center;
}
.value-list {
  max-height: 260px;
  overflow: auto;
  padding-right: 2px;
}
.ok-box {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: color-mix(in oklab, var(--color-success) 14%, var(--color-base-100));
  color: var(--color-success);
  font-size: 11px;
  line-height: 1.5;
}
.ok-box svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}
.issue-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 220px;
  overflow: auto;
}
.issue-list li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 7px 8px;
  border-radius: 7px;
  font-size: 10px;
  line-height: 1.5;
  cursor: pointer;
}
.issue-list li svg {
  width: 13px;
  height: 13px;
  margin-top: 1px;
  flex: 0 0 auto;
}
.issue-list li.error {
  background: color-mix(in oklab, var(--color-error) 14%, var(--color-base-100));
  color: var(--color-error);
}
.issue-list li.warning {
  background: color-mix(in oklab, var(--color-warning) 18%, var(--color-base-100));
  color: var(--color-warning);
}
.issue-list li.info {
  background: color-mix(in oklab, var(--color-primary) 8%, var(--color-base-100));
  color: var(--color-primary);
}
.mode-switch {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--color-base-300);
  border-radius: 8px;
  background: var(--color-base-100);
}
.mode-switch button {
  padding: 4px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: color-mix(in oklab, var(--color-base-content) 62%, transparent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.mode-switch button.active {
  background: var(--color-primary);
  color: var(--color-primary-content);
}
.guided {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 1180px;
  margin: 0 auto;
}
.guided-steps {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.guided-steps li {
  flex: 1;
}
.guided-steps li button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--color-base-300);
  border-radius: 10px;
  background: var(--color-base-100);
  color: color-mix(in oklab, var(--color-base-content) 60%, transparent);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}
.guided-steps li button:hover {
  border-color: color-mix(in oklab, var(--color-primary) 45%, var(--color-base-300));
}
.guided-steps li.active button {
  border-color: var(--color-primary);
  background: color-mix(in oklab, var(--color-primary) 8%, var(--color-base-100));
  color: var(--color-primary);
  box-shadow: 0 0 0 1px color-mix(in oklab, var(--color-primary) 40%, transparent);
}
.guided-steps li.done button {
  color: var(--color-primary);
  border-color: color-mix(in oklab, var(--color-primary) 30%, var(--color-base-300));
}
.step-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: color-mix(in oklab, var(--color-base-content) 10%, transparent);
  font-size: 11px;
  font-weight: 700;
  flex: 0 0 auto;
}
.guided-steps li.active .step-index,
.guided-steps li.done .step-index {
  background: var(--color-primary);
  color: var(--color-primary-content);
}
.guided-help {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid color-mix(in oklab, var(--color-primary) 22%, var(--color-base-300));
  border-radius: 12px;
  background: color-mix(in oklab, var(--color-primary) 6%, var(--color-base-100));
  font-size: 12px;
  line-height: 1.6;
}
.guided-help > svg {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  color: var(--color-primary);
  flex: 0 0 auto;
}
.guided-help strong {
  display: block;
  margin-bottom: 2px;
}
.guided-help p {
  margin: 0;
  color: color-mix(in oklab, var(--color-base-content) 68%, transparent);
}
.guided-help .btn {
  margin-left: auto;
  flex: 0 0 auto;
}
.guided-card {
  padding: 22px 24px;
  border: 1px solid var(--color-base-300);
  border-radius: 16px;
  background: var(--color-base-100);
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
}
.guided-card-head {
  margin-bottom: 18px;
}
.guided-kicker {
  display: inline-block;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-primary);
}
.guided-card-head h2 {
  margin: 0 0 5px;
  font-size: 18px;
  font-weight: 720;
}
.guided-card-head p {
  margin: 0;
  max-width: 720px;
  font-size: 12px;
  line-height: 1.6;
  color: color-mix(in oklab, var(--color-base-content) 62%, transparent);
}
.paper-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}
.paper-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 16px 14px;
  border: 1px solid var(--color-base-300);
  border-radius: 12px;
  background: var(--color-base-100);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}
.paper-card:hover {
  border-color: color-mix(in oklab, var(--color-primary) 45%, var(--color-base-300));
  transform: translateY(-1px);
}
.paper-card strong {
  font-size: 20px;
  font-weight: 750;
  letter-spacing: -0.01em;
}
.paper-card span {
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 64%, transparent);
}
.paper-card small {
  font-size: 10px;
  color: color-mix(in oklab, var(--color-base-content) 45%, transparent);
}
.paper-card.active {
  border-color: var(--color-primary);
  background: color-mix(in oklab, var(--color-primary) 7%, var(--color-base-100));
  box-shadow: 0 0 0 1px var(--color-primary);
}
.paper-card.active strong {
  color: var(--color-primary);
}
.guided-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid color-mix(in oklab, var(--color-base-300) 65%, transparent);
}
.guided-row-label {
  font-size: 12px;
  font-weight: 600;
}
.guided-row-note {
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
}
.template-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.template-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--color-base-300);
  border-radius: 12px;
  background: var(--color-base-100);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}
.template-card:hover {
  border-color: color-mix(in oklab, var(--color-primary) 45%, var(--color-base-300));
  transform: translateY(-1px);
}
.template-card.active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}
.template-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 150px;
  margin-bottom: 6px;
  padding: 8px;
  border-radius: 8px;
  background: #f7f9fb;
  overflow: hidden;
}
.template-thumb :deep(svg) {
  width: 100%;
  height: 100%;
  max-height: 134px;
}
.template-card strong {
  font-size: 13px;
  font-weight: 700;
}
.template-card small {
  font-size: 11px;
  line-height: 1.5;
  color: color-mix(in oklab, var(--color-base-content) 58%, transparent);
}
.template-card em {
  margin-top: 4px;
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
  color: var(--color-primary);
}
.guided-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 14px;
  align-items: start;
}
.guided-preview-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--color-base-300);
  border-radius: 16px;
  background: var(--color-base-100);
  overflow: hidden;
}
.guided-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid color-mix(in oklab, var(--color-base-300) 65%, transparent);
}
.guided-panel-head h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}
.guided-panel-head span {
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 52%, transparent);
}
.guided-preview-scroll {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  max-height: 560px;
  padding: 18px;
  overflow: auto;
  background: repeating-conic-gradient(#eef2f6 0% 25%, #f8fafc 0% 50%) 50% / 16px 16px;
}
.guided-preview-panel.full .guided-preview-scroll {
  height: clamp(260px, 44vh, 460px);
  min-height: 0;
  max-height: none;
  padding: 14px;
}
.guided-preview-panel.full .guided-preview-scroll :deep(.sheet-canvas) {
  display: flex;
  align-items: center;
  height: 100%;
  background: transparent;
  border-color: transparent;
  border-radius: 0;
  box-shadow: none;
}
.guided-preview-panel.full .guided-preview-scroll :deep(.sheet-svg) {
  width: 100%;
  height: 100%;
}
.guided-preview-hint {
  margin: 0;
  padding: 10px 16px;
  border-top: 1px solid color-mix(in oklab, var(--color-base-300) 65%, transparent);
  font-size: 11px;
  line-height: 1.5;
  color: color-mix(in oklab, var(--color-base-content) 58%, transparent);
}
.guided-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--color-base-300);
  border-radius: 16px;
  background: var(--color-base-100);
}
.guided-form-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid color-mix(in oklab, var(--color-base-300) 65%, transparent);
}
.guided-form-head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}
.guided-form-head span {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  color: var(--color-primary);
}
.guided-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 10px;
  border: 1px dashed var(--color-base-300);
  border-radius: 10px;
  color: color-mix(in oklab, var(--color-base-content) 48%, transparent);
  font-size: 11px;
  text-align: center;
}
.guided-empty svg {
  width: 20px;
  height: 20px;
}
.guided-empty p {
  margin: 0;
}
.guided-common {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in oklab, var(--color-base-300) 65%, transparent);
}
.guided-common-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.guided-common-head h4 {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: color-mix(in oklab, var(--color-base-content) 58%, transparent);
}
.guided-export-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 14px;
  align-items: start;
}
.guided-export-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.guided-export-side .export-cards {
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 0;
}
.guided-export-side .export-card {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 9px;
  row-gap: 1px;
  align-items: center;
  padding: 9px 12px;
}
.guided-export-side .export-card svg {
  grid-row: 1 / span 2;
  width: 18px;
  height: 18px;
}
.guided-export-side .export-card strong {
  font-size: 12px;
}
.guided-export-side .export-card span {
  font-size: 10px;
  line-height: 1.35;
}
.guided-export-side .guided-export-more,
.guided-export-side .guided-check {
  margin-top: 0;
}
.export-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 16px;
}
.export-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border: 1px solid var(--color-base-300);
  border-radius: 12px;
  background: var(--color-base-100);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.export-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
}
.export-card svg {
  width: 20px;
  height: 20px;
  color: var(--color-primary);
}
.export-card strong {
  font-size: 14px;
  font-weight: 700;
}
.export-card span {
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 58%, transparent);
}
.guided-export-more {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
}
.guided-check {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 1.55;
}
.guided-check svg {
  width: 15px;
  height: 15px;
  margin-top: 1px;
  flex: 0 0 auto;
}
.guided-check strong {
  display: block;
  margin-bottom: 2px;
}
.guided-check ul {
  margin: 4px 0 0;
  padding-left: 16px;
}
.guided-check .btn {
  margin-left: auto;
  flex: 0 0 auto;
}
.guided-check.ok {
  background: color-mix(in oklab, var(--color-success) 14%, var(--color-base-100));
  color: var(--color-success);
}
.guided-check.warning {
  background: color-mix(in oklab, var(--color-warning) 18%, var(--color-base-100));
  color: var(--color-warning);
}
.guided-check.error {
  background: color-mix(in oklab, var(--color-error) 14%, var(--color-base-100));
  color: var(--color-error);
}
.guided-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 2px;
}
.guided-progress {
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 52%, transparent);
}
.status-toast {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 50;
  padding: 9px 14px;
  border-radius: 8px;
  background: var(--color-base-content);
  color: var(--color-base-100);
  font-size: 11px;
  box-shadow: 0 8px 24px rgb(15 23 42 / 0.22);
}
@media (max-width: 1320px) {
  .workbench {
    grid-template-columns: 280px minmax(0, 1fr);
  }
  .right-panel {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .right-panel .panel-section {
    border-bottom: 0;
    border-right: 1px solid color-mix(in oklab, var(--color-base-300) 65%, transparent);
  }
  .right-panel .panel-section:last-child {
    border-right: 0;
  }
}
@media (max-width: 900px) {
  .sheet-page {
    padding: 14px;
  }
  .workbench {
    grid-template-columns: 1fr;
  }
  .guided-content {
    grid-template-columns: 1fr;
  }
  .guided-export-layout {
    grid-template-columns: 1fr;
  }
  .guided-export-side .export-cards {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }
  .guided-steps {
    flex-wrap: wrap;
  }
  .guided-steps li {
    flex: 1 1 45%;
  }
  .guided-card {
    padding: 16px;
  }
  .right-panel {
    display: block;
  }
  .right-panel .panel-section {
    border-right: 0;
    border-bottom: 1px solid color-mix(in oklab, var(--color-base-300) 65%, transparent);
  }
  .canvas-scroll {
    max-height: none;
  }
}
</style>
