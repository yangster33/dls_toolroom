# 图框 / 图签生成与导出工具（Sheet Template Tool）可行性调研

> 调研日期：2026-11-08
> 目标：做一个**独立、可复用**的「图框 + 图签」生成/设计/导出工具。
> 支持 A0/A1/A2/A3/A4/A5 图幅、对应字高规则、交互式图签设计、JSON Schema 校验，最终导出 JSON 或 DXF。
> 结论先行：**非常靠谱，边界清晰，适合作为独立基础工具；真正的难点是标准/企业模板差异和字体排版，不是算法。**

---

## 一、为什么值得单独做

图框/图签是所有工程图的“最后一公里”，但它和机房平面图、管线图、电气图没有强耦合：

- 机房平面图生成器需要它，其他工具也需要它；
- 它只关心纸张、边距、线宽、字高、字段、布局；
- 输入输出可以完全数据化：`SheetTemplate` JSON → SVG/DXF；
- 一旦做好，所有出图工具都能复用同一套图框和图签。

所以建议：

```text
sheet_template（独立工具）
    ├─ 负责：纸张、图框、图签、字高、字段、DXF/JSON 导出
    └─ 被 room_layout / 其他出图工具引用
```

不要把图框逻辑塞进机房平面图工具里，否则以后每个工具都要复制一遍。

---

## 二、范围定义

### 2.1 做什么

- A0/A1/A2/A3/A4/A5 纸张，横/竖版，自定义尺寸；
- 图框：装订边、其他边距、内外框、对中符号、分区标记；
- 图签：标题栏、会签栏、公司 Logo、字段布局；
- 字高：按图幅推荐标题/正文/注释字高，可覆盖；
- 交互式设计：拖拽、缩放、对齐、吸附、属性面板、撤销重做；
- JSON Schema 校验；
- 导出 JSON、SVG、DXF（至少 DXF）；
- 可选：PNG、PDF、打印预览。

### 2.2 不做什么（首版）

- 不做完整 CAD 编辑器；
- 不做复杂表格公式；
- 不做 DWG 原生导出（见 DXF/DWG 结论）；
- 不做多图纸批量排版（二期）；
- 不做云端协作。

---

## 三、纸张与字高规则

### 3.1 纸张尺寸（ISO 216 / GB/T 14689）

| 图幅 | 竖向（mm） | 横向（mm） |
|---|---|---|
| A0 | 841 × 1189 | 1189 × 841 |
| A1 | 594 × 841 | 841 × 594 |
| A2 | 420 × 594 | 594 × 420 |
| A3 | 297 × 420 | 420 × 297 |
| A4 | 210 × 297 | 297 × 210 |
| A5 | 148 × 210 | 210 × 148 |

边距建议做成规则包：

- 装订边：常用 25 mm；
- 其他边：A0~A3 常用 10 mm，A4/A5 可能取 5 mm；
- 内框偏移、图框线宽、分区标记可配置；
- 最终以 GB/T 14689 和企业标准为准。

### 3.2 字高建议（默认值，可覆盖）

GB/T 14691 常用字高系列：1.8、2.5、3.5、5、7、10、14、20 mm。

建议默认映射：

| 图幅 | 标题字高 | 正文字高 | 注释字高 | 最小字高 |
|---|---|---|---|---|
| A0 | 10 | 7 | 5 | 3.5 |
| A1 | 7 | 5 | 3.5 | 2.5 |
| A2 | 7 | 5 | 3.5 | 2.5 |
| A3 | 5 | 3.5 | 2.5 | 1.8 |
| A4 | 5 | 3.5 | 2.5 | 1.8 |
| A5 | 3.5 | 2.5 | 1.8 | 1.8 |

> 注意：这是“工程建议默认值”，不是唯一标准答案。工具应支持规则包覆盖，并在字高低于最小值时给警告。

### 3.3 字高与图幅的关系

工具可以提供三种模式：

1. **按图幅自动推荐**：选 A2 自动带出 7/5/3.5；
2. **按比例缩放**：以 A2 为基准，按图幅面积/边长比例缩放；
3. **手动覆盖**：用户直接输入 mm，实时校验最小值。

---

## 四、JSON Schema 设计

### 4.1 顶层结构

```json
{
  "schemaVersion": 1,
  "id": "gb-standard-a2",
  "name": "国标 A2 横版图签",
  "paper": {
    "size": "A2",
    "orientation": "landscape",
    "widthMm": 594,
    "heightMm": 420
  },
  "margins": {
    "binding": 25,
    "top": 10,
    "right": 10,
    "bottom": 10,
    "left": 10
  },
  "frame": {
    "lineWidthMm": 0.7,
    "innerOffsetMm": 0,
    "zoneMarking": true,
    "centeringMarks": true
  },
  "titleBlock": {
    "widthMm": 180,
    "heightMm": 56,
    "position": "bottom-right",
    "cells": []
  },
  "styles": {
    "fontFamily": "Microsoft YaHei",
    "textStyles": {},
    "lineStyles": {}
  },
  "theme": {}
}
```

### 4.2 图签单元格

图签不是一张图片，而是**可编辑的单元格网格**：

```ts
interface TitleBlockCell {
  id: string
  label?: string
  field?: string          // projectName / drawingNo / scale / date / designer...
  x: number               // mm，相对图签左上角
  y: number
  w: number
  h: number
  textStyle?: string      // 引用 styles.textStyles
  align?: 'left' | 'center' | 'right'
  valign?: 'top' | 'middle' | 'bottom'
  border?: boolean
  rowSpan?: number
  colSpan?: number
}
```

好处：

- 可以拖拽/缩放/合并单元格；
- 可以绑定字段，生成时自动填值；
- 可以导出为 DXF 的 `LWPOLYLINE + TEXT`；
- 可以做“国标 / 企业 / 项目”三套模板。

### 4.3 JSON Schema

建议用 **JSON Schema Draft 2020-12**，单独发布：

```text
schema/sheet-template.schema.json
```

校验分两层：

1. **结构校验**：JSON Schema（`ajv`，MIT，浏览器可用）；
2. **语义校验**：
   - 图签是否超出图框；
   - 单元格是否重叠；
   - 文字是否溢出单元格；
   - 字高是否低于最小值；
   - 装订边是否足够；
   - 字段是否重复/缺失。

Schema 里只放结构约束，语义校验放在 `validate.ts`，这样规则可以独立演进。

---

## 五、交互式图签设计

### 5.1 画布

- 用 SVG 而不是 Canvas：输出即最终矢量，避免 Canvas → SVG 转换误差；
- 坐标统一 mm，`viewBox="0 0 widthMm heightMm"`；
- 支持适应窗口、1:1、缩放、平移；
- 纸张背景、图框、图签、网格分层显示；
- 可切换“设计模式 / 预览模式 / 打印模式”。

### 5.2 编辑操作

- 选择、多选、框选；
- 拖动、缩放、合并/拆分单元格；
- 吸附：1mm / 5mm / 10mm / 网格 / 其他单元格边；
- 对齐辅助线、等距分布；
- 属性面板：字段、文字、字高、对齐、边框、行列合并；
- 撤销/重做（命令模式）；
- 键盘：Delete、方向键微调、Ctrl+Z/Y、Ctrl+D 复制。

### 5.3 字段绑定

常用字段：

```text
projectName      工程名称
drawingName      图名
drawingNo        图号
scale            比例
date             日期
designer         设计
checker          审核
approver         批准
revision         版本
sheetNo          第几张 / 共几张
company          单位名称
logo              Logo 图片
```

设计时显示占位符，预览/导出时用真实值替换。

### 5.4 模板库

- 国标模板（GB/T 10609.1 风格）；
- 企业模板（自定义）；
- 项目模板（某项目专用）；
- 用户可复制/另存/导入/导出 JSON；
- 模板带 `schemaVersion`，升级时迁移。

---

## 六、DXF 导出

### 6.1 导出策略

- **paper space** 按 1:1 mm 画图框和图签；
- 图框/单元格用 `LWPOLYLINE`；
- 文字用 `TEXT` / `MTEXT`；
- Logo 可用 `IMAGE` 或省略；
- 图层：`SHEET-FRAME`、`SHEET-TITLE`、`SHEET-TEXT`、`SHEET-LOGO`；
- 文字样式：`SHEET-TITLE`、`SHEET-BODY`、`SHEET-NOTE`；
- 单位：`$INSUNITS = 4`（mm）、`$MEASUREMENT = 1`。

### 6.2 版本与编码

| 版本 | 中文 | 建议 |
|---|---|---|
| R12 | 需 GBK / `\U+XXXX` | 兼容老 CAD |
| R2000 | 代码页 | 支持 LWPOLYLINE |
| R2010+ | UTF-8 | **推荐** |

首版建议 R2010+ ASCII UTF-8；如果必须兼容 R12，再加 GBK 分支。

### 6.3 库选择

| 库 | 许可 | 体积 | 能力 |
|---|---|---|---|
| `@tarikjabiri/dxf` | MIT | ~442 KB | 块、HATCH、尺寸、MTEXT、paper space |
| `dxf-writer` | MIT | ~61 KB | 基础实体，轻量 |
| 自研 writer | — | 小 | 完全可控 |

图框/图签不需要复杂 3D，`@tarikjabiri/dxf` 足够；动态 import，放 Worker。

### 6.4 DWG

同机房平面图结论：**纯浏览器不成立**。

- 推荐：导出 DXF，CAD 里另存 DWG；
- 需要原生 DWG 时，加后端/桌面转换服务；
- 不建议为图框工具单独引入 DWG 依赖。

---

## 七、建议架构

```text
src/tools/sheet_template/
├─ SheetTemplatePage.vue
├─ SheetCanvas.vue
├─ PropertyPanel.vue
├─ TemplateLibrary.vue
├─ schema/
│  └─ sheet-template.schema.json
├─ core/                 # 与 Vue 无关，可复用
│  ├─ schema.ts
│  ├─ paper.ts           # A0~A5、边距、横竖版
│  ├─ typography.ts      # 字高规则
│  ├─ template.ts        # 默认模板/迁移
│  └─ validate.ts        # 结构 + 语义校验
├─ render/
│  ├─ svgRenderer.ts     # render(template, values) → SVG
│  └─ dxfExporter.ts     # template + values → DXF
├─ editor/
│  ├─ useSheetEditor.ts
│  ├─ commands.ts        # 撤销/重做
│  └─ snapping.ts
├─ io/
│  ├─ json.ts
│  ├─ svg.ts
│  ├─ dxf.ts
│  └─ zip.ts             # JSON + SVG + DXF 打包
└─ __tests__/
```

复用方式：

```ts
import { renderSheetSvg } from '@/tools/sheet_template/render/svgRenderer'
import { exportSheetDxf } from '@/tools/sheet_template/render/dxfExporter'

const svg = renderSheetSvg(template, values, theme)
const dxf = exportSheetDxf(template, values)
```

机房平面图工具只需要引用一个 `SheetTemplate`，不关心图签内部怎么画。

---

## 八、MVP 与工作量

### 8.1 MVP（3~5 天）

- A0~A5 纸张库 + 横竖版；
- 边距/图框/内外框；
- 字高推荐表；
- 2~3 套图签模板（国标/企业/简洁）；
- SVG 预览；
- JSON 导出 + JSON Schema 校验；
- 语义校验（溢出/重叠/超框/字高）。

### 8.2 二期（5~8 天）

- 交互式拖拽/缩放/合并单元格；
- 属性面板；
- 撤销/重做；
- 模板库导入/导出；
- DXF 导出（paper space + 图层 + 文字样式）；
- SVG/PNG/PDF 导出。

### 8.3 三期（3~5 天）

- 主题切换（浅色/蓝图/黑白）；
- 批量套用（多图号、多项目）；
- 与机房平面图工具联动；
- DXF 往返测试（AutoCAD/LibreCAD/TrueView）；
- 可选：后端 DWG 转换。

总预估：**2~3 周**可做到“可设计、可校验、可导出 JSON/DXF”的稳定版本。

---

## 九、风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 国标/企业模板差异大 | 一套模板不够用 | 模板库 + 规则包 + 自定义 |
| 字体度量不准 | 文字溢出/压线 | Canvas `measureText` + 安全边距 + 溢出警告 |
| 中文 DXF 乱码 | CAD 打开异常 | R2010+ UTF-8；R12 用 GBK 分支 |
| CAD 字体缺失 | 显示不一致 | 文字样式指定常用字体，提供替换说明 |
| paper space 兼容性 | 不同 CAD 表现不同 | 以 AutoCAD/LibreCAD 双端测试 |
| 交互编辑器复杂 | 工期膨胀 | 首版限制为“单元格网格 + 吸附”，不做自由绘图 |
| Schema 演进 | 旧模板打不开 | `schemaVersion` + 迁移函数 |

---

## 十一、实施记录（2026-11-08）

已落地为独立工具 `sheet_template`：

### 代码

```text
src/tools/sheet_template/
├─ SheetTemplatePage.vue          # 页面：图幅、边距、字高、图签、导出
├─ SheetCanvas.vue                # SVG 画布：选择、拖动、缩放、吸附
├─ sheetTemplate.ts               # 纸张/字高/模板/布局/校验
├─ sheetTemplateSchema.ts         # JSON Schema Draft 2020-12
├─ sheetTemplate.schema.json      # 可下载的 Schema 文件
├─ sheetSvg.ts                    # SVG 渲染
├─ sheetDxf.ts                    # DXF 导出（@tarikjabiri/dxf）
└─ __tests__/sheetTemplate.spec.ts
```

### 已实现能力

- A0~A5、横版/竖版；
- 装订边、上下左右边距、图框线宽；
- 对中符号、分区标记；
- GB 风格 / 简洁 / 极简三套图签；
- 图签单元格拖动、缩放、复制、删除、属性编辑；
- 字段绑定：工程名称、图名、图号、比例、日期、设计、审核、批准、单位等；
- 按图幅推荐字高 + 手动覆盖 + 标准字高吸附；
- 语义校验：超框、重叠风险、字高过低、文字溢出、边距异常；
- JSON 导出 + JSON Schema 导出 + JSON 导入（Ajv 2020-12 校验）；
- SVG 导出；
- DXF 导出（AC1021 / R2007+，UTF-8，模型空间 1:1 mm，`SHEET-FRAME` / `SHEET-TITLE` / `SHEET-TEXT` 图层）；
- 撤销/重做、键盘微调、聚焦图签。

### 验证

- `npm run type-check` 通过；
- `npm run lint:check` 通过；
- `npm run test:unit`：66 个测试文件、871 个测试通过；
- `npm run build:fast` 通过；
- 浏览器实测：页面加载、JSON/Schema/SVG/DXF 导出、JSON 导入校验、字段联动均正常。

### 已知边界

- 内置 GB 风格图签是“常用格式”的工程化实现，不是对国标图样的逐字复制；
- 首版 DXF 在模型空间按 1:1 mm 输出；paper space 视口作为二期；
- 文字宽度使用近似度量，最终以 SVG/CAD 字体为准；
- DXF 使用 `simhei.ttf` 文字样式，目标 CAD 需有对应字体；
- 原生 DWG 不支持，建议 DXF 后在 CAD 中另存；
- 目前没有“多图纸批量排版”和“企业标准文件自动导入”。

---

## 十一（续）、全量增强记录（2026-11-08 第二轮）

在第一版基础上，按“Tips + 元素开关 + Excel 式图签编辑”做了全量增强：

### 1. 元素提示与显示开关

- 每个线/文字/形状带 `semanticId / name / standard / group / layer`；
- 预览图 hover 显示名称、标准来源、当前值，并可勾选“显示此类”；
- 细线增加透明命中层，0.3mm 线也能 hover；
- 左侧“显示”面板按“图框 / 图签 / 辅助”分组，支持全显/全隐；
- `ViewState` 独立于 `SheetDocument`，不进入撤销历史和导出 JSON；
- SVG/DXF 导出按当前显示状态过滤。

### 2. Excel 式图签编辑

- 新增 `TitleBlockGridEditor.vue`：
  - 行号/列标、单元格网格；
  - 上方/下方插入行、删除行；
  - 左侧/右侧插入列、删除列；
  - 合并、拆分；
  - 等宽列、等高行、内容自适应、归一化；
  - 拖动列标/行号手柄调整宽高；
  - Shift + 点击扩展选区。
- 图签数据从绝对 `x/y/w/h` 升级为行列轨道模型：
  - `columns / rows / cells(row,col,rowSpan,colSpan)`；
  - 插入/删除行列自动平移和扩展单元格；
  - 旧绝对模板可自动迁移为网格。
- 默认打开“表格编辑”，预览页只读，避免在缩略图上误拖。

### 3. Schema 与测试

- JSON Schema 增加 `layoutMode`、`grid`、`gridTrack`、`gridCell`、`labelAlign`、`valueAlign`；
- 新增 8 个网格/语义测试，共 24 个测试通过；
- 浏览器实测：
  - 插入/删除行：10→11→10；
  - 合并：39→38 单元格；
  - 拆分：38→40；
  - 等宽/等高/自适应/归一化均可用；
  - hover 图框线显示 tooltip；
  - 关闭“对中符号”后，SVG 中 `symbol.centering` 数量 8→0；
  - 属性面板修改标签后，预览文字同步更新；
  - JSON/Schema/SVG/DXF 导出与 JSON 导入 Schema 校验正常。

### 4. 当前边界

- 双击单元格内联编辑已实现：有绑定字段时改字段值，否则改标签/静态文本；Enter 提交，Esc 取消；选中单元格后直接输入字符也会进入编辑；
- 右侧属性面板的普通输入（标签/字段/对齐）暂未逐次入撤销栈；双击内联编辑、结构性操作（增删行列、合并拆分、拖拽）可撤销；
- 内容自适应使用近似文字度量，最终以 CAD/SVG 字体为准；
- 剪切符号、投影符号仍未实现。

### 5. 交互修复（2026-11-08 第三轮）

- 多选：
  - Shift / Ctrl / Cmd + 点击扩展选区；
  - 按住鼠标拖动选择多个单元格；
  - 底部实时显示“已选 X 行 × Y 列”。
- 合并：
  - 只有多选时“合并”按钮可用；
  - 选中单个合并单元格时“拆分”可用；
  - 合并失败会提示“选区与已有合并单元格部分重叠，请先拆分”。
- 行列操作：
  - 只剩一行/一列时“删除行/删除列”禁用；
  - 插入/删除行列后自动归一化，保持图签总尺寸，避免无意义警告；
  - 插入行/列时自动在新行/列创建“新单元格”，确保新行列立刻可操作；
  - 如果插入点跨过合并单元格，先拆分该合并单元格并提示；
  - 空白网格双击可直接添加单元格。
- 键盘：
  - 点击单元格后表格获得焦点，方向键可在单元格之间移动。
- 草稿保护：
  - 本地草稿有 error 时不自动载入，提示“恢复草稿 / 忽略”；
  - 默认模板始终 0 错误 / 0 警告。

## 十二、新手引导模式（2026-11-08 第四轮）

### 1. 背景

原页面是三栏专业工作台：左侧图幅/边距/字高/图签/显示/导出，中间表格/预览，右侧单元格属性/字段值/校验。对第一次使用的用户来说信息量过大，容易不知道从哪里开始。

### 2. 方案

采用“新手引导 / 专业模式”双轨，而不是删减专业能力：

- 默认进入新手引导；
- 顶部保留“新手引导 / 专业模式”切换；
- 两种模式共用同一份文档、草稿、显示状态和撤销栈；
- 切换模式不重建文档。

新手引导固定 4 步：

1. 图幅：A0~A5 卡片 + 横竖版，边距/字高自动推荐；
2. 图签：3 张带缩略图的模板卡片；
3. 内容：放大图签预览，点单元格后在右侧表单绑定字段 / 填字段值 / 改文字；
4. 导出：完整预览 + SVG / PNG / DXF / JSON 导出卡片，Schema 和导入放在“更多”。

### 3. 实现要点

- `uiMode`、`wizardStep` 持久化到 localStorage；
- 模板缩略图由 `sheetToSvg()` 生成后裁切 `viewBox` 到图签区域；
- `SheetCanvas` 新增：
  - `cropToTitleBlock`：图签放大预览；
  - `hideTooltip`：引导模式关闭图元 Tips，避免遮挡；
- 字段绑定直接写 `cell.field`，字段值写 `doc.values[field]`，没有第二套数据模型；
- 第 4 步 PNG 通过 SVG → Image → canvas（4 px/mm）导出；
- 第 4 步只把 `error` 级别问题作为阻断提示，`warning` 收为一句提示；
- 首次访问且没有保存过模式时显示帮助条；
- 切回新手模式时固定回到第 3 步“内容”。

### 4. 验证

- 浏览器实测：
  - 首次进入显示 4 步向导，默认 A2 横版；
  - 切换 A3 竖版、极简图签后文档同步更新；
  - 点击图签单元格后右侧显示中文字段名（如“图名”），字段下拉和字段值可编辑；
  - 引导模式预览不出现悬浮 Tips；
  - SVG / JSON 导出成功；
  - 切换到专业模式后表格编辑器可用，切回新手模式回到第 3 步；
  - 刷新后模式和步骤保持。
- `type-check`、`lint:check`、图签 24 个测试、全仓 879 个测试、`build:fast` 均通过。

## 十三、专业模式补强（2026-11-08 第五轮）

### 1. 自定义字段

- `SheetDocument` 新增 `customFields?: { key, label }[]`；
- JSON Schema 同步增加 `customFields` 和 `customField` 定义；
- 专业模式“字段值”面板底部提供添加 / 删除；
- 添加时校验：
  - 字段名称不能为空；
  - 字段键只能使用字母、数字、下划线，且不能以数字开头；
  - 不能与内置字段或已有自定义字段重名；
- 删除时：
  - 删除 `values[key]`；
  - 解绑所有使用该字段的单元格（网格 + 绝对坐标两套数据）；
- 自定义字段会出现在“绑定字段”下拉和导出 JSON 中。

### 2. 字体与字高

- 左侧“字高”改为“字体 / 字高”：
  - 字体预设：微软雅黑 / 苹方、宋体、黑体、Noto Sans SC、思源黑体；
  - 选“自定义…”后可输入任意 CSS `font-family`；
  - 标题 / 正文 / 注释 / 标签分别设置字号和加粗。
- `TitleBlockCell` / `GridCell` 新增：
  - `fontSize?: number`
  - `bold?: boolean`
- 渲染时：
  - `fontSize = (cell.fontSize ?? style.fontSize) * textScale`
  - `bold = cell.bold ?? style.bold`
- 右侧“单元格属性”增加“字号覆盖”和“粗细”，留空表示跟随文字样式；
- 网格与绝对坐标转换时保留这两个字段。

### 3. 专注编辑

- 表格编辑 / 图纸预览右上角新增“专注编辑”；
- 开启后隐藏左右面板，中间区域扩展到整屏；
- 编辑区高度使用 `clamp(560px, calc(100vh - 330px), 980px)`；
- 专注模式下表格编辑器填满可用高度，预览区不再受固定 520px 限制；
- 退出专注后恢复三栏布局。

### 4. DXF 坐标修复

问题：导出的 DXF 图签跑到右上角，分区编号压在框线上。

原因：SVG 使用 Y 轴向下，DXF 使用 Y 轴向上，导出时没有翻转。

修复：

```ts
const flipY = (y: number) => layout.paper.h - y
```

- 所有 LINE 端点使用 `flipY`；
- 所有 TEXT 插入点和第二对齐点使用 `flipY`；
- 文字 Top / Middle / Bottom 对齐与 SVG baseline 一一对应；
- 新增测试：解析 DXF 中图号文字的 Y 坐标，确认位于图纸下半部分；
- 重新生成 `docs/assets/sheet-template-sample.dxf`。

### 5. 默认图签文字重叠修复

问题：默认 GB 图签里“版本”和下方“DLS Toolroom”等文字有轻微重叠，部分窄单元格标签（如“年、月、日”）超出单元格。

原因：

- 同时有标签和字段值的单元格，标签固定画在顶部，值画在垂直中心，短单元格里两者会重叠；
- 标签没有按单元格宽度自动收缩。

修复：

- 宽而矮的单元格改为**标签在左、值在右**单行显示（材料、比例、共张、第张、版本）；
- 高单元格仍保持标签在上、值在下，但值改为在标签下方居中；
- 标签宽度超过单元格时自动缩小字号，最小 1.8mm；
- 浏览器实测：默认图签文字重叠 0 处，文字超出单元格 0 处。

### 6. DXF 字高校准

问题：DXF 里字体大小和预览不一致。

原因：CAD 的 `TEXT` 高度按大写字母高度（cap height）解释，浏览器 `font-size` 是 em 尺寸，两者不是同一套度量。

修复：

- 默认按文本内容校准：
  - 中文：`fontSize * 1.12`
  - 英文/数字：`fontSize * 0.8`
- 导出面板增加：
  - “按预览校准 DXF 字高”（默认开启）；
  - “字高倍率”（默认 1.00，可整体微调）；
- 关闭校准后使用名义字高；
- 新增测试：校准后中文图名高度 5.6、英文图号高度 4.0；关闭校准后均为 5.0。

### 7. 验证

- 浏览器实测：
  - 专注编辑后中间宽度从约 626px 扩展到约 1294px；
  - 字体预设切换后 SVG `font-family` 同步；
  - 正文字号 / 加粗修改后预览同步；
  - 单元格字号覆盖 10mm、加粗后预览同步；
  - 自定义字段“建设单位 / clientName”可添加、绑定、写值、删除；
  - 删除字段后绑定下拉同步移除；
  - DXF 图号文字 Y 坐标位于图纸下半部分；
  - 默认图签文字重叠 0 处，文字超出单元格 0 处；
  - DXF 默认按中英文校准字高，关闭后恢复名义字高。
- 图签测试 28 个通过；`type-check`、`lint:check`、`build:fast` 通过。

## 十四、结论

**靠谱，而且适合单独做成一个基础工具。**

理由：

1. 问题边界清晰：纸张、边距、图框、图签、字高、字段；
2. 纯前端完全可行：SVG + JSON Schema + DXF 文本；
3. 复用价值高：机房平面图、管线图、电气图都能用；
4. 不依赖复杂算法，主要是工程规则和排版；
5. 和 `room_layout` 解耦后，两边都更干净。

建议先做 **MVP：A0~A5 + 字高表 + 3 套模板 + SVG 预览 + JSON/JSON Schema + 语义校验**，确认图签样式和字高规则后，再加交互编辑和 DXF。
