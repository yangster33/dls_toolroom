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
          <button
            type="button"
            :class="{ active: uiMode === 'guided' }"
            @click="setUiMode('guided')"
          >
            新手引导
          </button>
          <button
            type="button"
            :class="{ active: uiMode === 'advanced' }"
            @click="setUiMode('advanced')"
          >
            专业模式
          </button>
        </div>
        <template v-if="uiMode === 'advanced'">
          <button
            type="button"
            class="btn btn-sm btn-ghost"
            :disabled="!history.length"
            @click="undo"
          >
            <PhArrowCounterClockwise aria-hidden="true" />
            撤销
          </button>
          <button
            type="button"
            class="btn btn-sm btn-ghost"
            :disabled="!future.length"
            @click="redo"
          >
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
              <input
                v-model.number="doc.template.frame.lineWidth"
                type="number"
                min="0.1"
                step="0.1"
              />
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
            <input
              v-model="doc.template.styles.fontFamily"
              type="text"
              placeholder="如：'Microsoft YaHei', sans-serif"
            />
          </label>
          <div class="font-rows">
            <div v-for="row in fontRows" :key="row.key" class="font-row">
              <span>{{ row.label }}</span>
              <input
                v-model.number="row.style.fontSize"
                type="number"
                min="1"
                max="30"
                step="0.1"
              />
              <label class="font-bold" :title="`${row.label}是否加粗`">
                <input v-model="row.style.bold" type="checkbox" />
                粗
              </label>
              <button
                type="button"
                class="mini-btn"
                title="吸附到标准字高"
                @click="snapFont(row.key)"
              >
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
            GB
            风格包含更改区、签字区、材料/比例区等标准分区，因此会有跨行/跨列单元格；需要更少合并时可选“简洁”或“极简”。
          </p>
          <div class="field-grid two">
            <label class="field">
              <span>宽</span>
              <input
                v-model.number="doc.template.titleBlock.width"
                type="number"
                min="40"
                step="1"
              />
            </label>
            <label class="field">
              <span>高</span>
              <input
                v-model.number="doc.template.titleBlock.height"
                type="number"
                min="20"
                step="1"
              />
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
              <span class="view-group-state" :class="viewGroupState(group)">{{
                viewGroupStateLabel(group)
              }}</span>
              <button type="button" class="mini-btn" @click="toggleParent(group, true)">
                全显
              </button>
              <button type="button" class="mini-btn" @click="toggleParent(group, false)">
                全隐
              </button>
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
          <p class="hint">
            DXF 为 R2007+ ASCII / UTF-8，建议用 AutoCAD、LibreCAD 或 TrueView 打开。
          </p>
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
          <button
            type="button"
            :class="{ active: centerTab === 'grid' }"
            @click="setCenterTab('grid')"
          >
            表格编辑
          </button>
          <button
            type="button"
            :class="{ active: centerTab === 'preview' }"
            @click="setCenterTab('preview')"
          >
            图纸预览
          </button>
          <span class="editor-tabs-hint">{{
            isGridMode ? '网格模式 · 行列轨道' : '绝对坐标模式'
          }}</span>
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
          <span class="canvas-status"
            >{{ paperLabel }} · {{ titleBlockCells.length }} 个单元格</span
          >
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
          <button type="button" class="mini-btn" title="缩小" @click="setZoom(zoom - 0.1)">
            −
          </button>
          <span class="zoom-label">{{ zoomLabel }}</span>
          <button type="button" class="mini-btn" title="放大" @click="setZoom(zoom + 0.1)">
            +
          </button>
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
          <span v-if="centerTab === 'grid'"
            >在表格中选中单元格；用工具栏增删行列、合并拆分、自动对齐。</span
          >
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
            <p v-if="!customFields.length" class="hint">
              还没有自定义字段。可以添加“建设单位”“校对人”等。
            </p>
            <div v-for="field in customFields" :key="field.key" class="custom-field-row">
              <span>{{ field.label }}</span>
              <code>{{ field.key }}</code>
              <button type="button" class="mini-btn danger" @click="removeCustomField(field.key)">
                删除
              </button>
            </div>
            <div class="custom-field-add">
              <input v-model="newFieldLabel" type="text" placeholder="字段名称，如：建设单位" />
              <input v-model="newFieldKey" type="text" placeholder="字段键，如：clientName" />
              <button type="button" class="mini-btn" @click="addCustomField">添加</button>
            </div>
            <p class="hint">
              字段键使用字母/数字/下划线；添加后可在“绑定字段”下拉里选择，并写入导出 JSON。
            </p>
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
              <span
                v-if="
                  editCell.field && editCell.label && editCell.label !== fieldLabel(editCell.field)
                "
              >
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
                    v-for="(issue, index) in issues
                      .filter((item) => item.severity === 'error')
                      .slice(0, 3)"
                    :key="index"
                  >
                    {{ issue.message }}
                  </li>
                </ul>
              </div>
              <button type="button" class="btn btn-xs btn-ghost" @click="wizardStep = 2">
                返回修改
              </button>
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
        <button
          type="button"
          class="btn btn-sm btn-ghost"
          :disabled="wizardStep === 0"
          @click="prevStep"
        >
          上一步
        </button>
        <span class="guided-progress">第 {{ wizardStep + 1 }} / {{ guidedSteps.length }} 步</span>
        <button
          v-if="wizardStep < guidedSteps.length - 1"
          type="button"
          class="btn btn-sm btn-primary"
          @click="nextStep"
        >
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
import { getToolById } from '@/tools/toolData'
import SheetCanvas from './SheetCanvas.vue'
import TitleBlockGridEditor from './TitleBlockGridEditor.vue'
import { useSheetEditor } from './useSheetEditor'

const toolConfig = getToolById('sheet_template')

const {
  status,
  doc,
  activeTemplateKind,
  selectedCellId,
  zoom,
  snapEnabled,
  snapStep,
  history,
  future,
  canvasScrollRef,
  viewState,
  centerTab,
  uiMode,
  wizardStep,
  showHelp,
  focusMode,
  newFieldLabel,
  newFieldKey,
  draftNotice,
  issues,
  errorCount,
  warningCount,
  titleBlockCells,
  isGridMode,
  selectedGridCell,
  editCell,
  absoluteCell,
  paperLabel,
  zoomLabel,
  textStyleKeys,
  customFields,
  fieldDefinitions,
  fontPreset,
  viewTree,
  fontRows,
  templateThumbs,
  commonFields,
  paperSizes,
  fontPresets,
  templateKinds,
  guidedSteps,
  alignOptions,
  valignOptions,
  paperCardLabel,
  templateName,
  templateDesc,
  setUiMode,
  setFontPreset,
  addCustomField,
  removeCustomField,
  setCellFontSize,
  setCellBold,
  nextStep,
  prevStep,
  fieldLabel,
  updateGuidedText,
  fillSampleData,
  finishGuided,
  setPaper,
  setOrientation,
  setBindingEdge,
  applyBindingMargins,
  applyRecommendedFonts,
  snapFont,
  setTemplateKind,
  onCanvasUpdateCell,
  onBeginEdit,
  onEndEdit,
  undo,
  redo,
  reset,
  restoreDraft,
  dismissDraft,
  isViewVisible,
  toggleView,
  onViewCheck,
  onBorderChange,
  toggleParent,
  setAllView,
  viewGroupState,
  viewGroupStateLabel,
  addCell,
  deleteCell,
  duplicateCell,
  setZoom,
  focusTitleBlock,
  gridInsertRow,
  gridDeleteRow,
  gridInsertColumn,
  gridDeleteColumn,
  gridAddCellAt,
  gridUpdateField,
  gridUpdateCellText,
  gridMerge,
  gridSplit,
  gridResizeColumn,
  gridResizeRow,
  gridEqualizeColumns,
  gridEqualizeRows,
  gridAutoFit,
  gridNormalize,
  gridColumnLabel,
  convertToGrid,
  setCenterTab,
  fileInputRef,
  dxfCalibrate,
  dxfTextScale,
  exportPng,
  exportJson,
  exportSchema,
  exportSvg,
  exportDxf,
  triggerImport,
  onImportFile,
} = useSheetEditor()
</script>

<style scoped src="./SheetTemplatePage.css"></style>
