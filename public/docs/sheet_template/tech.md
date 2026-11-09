# 技术实现：纯浏览器图框图签生成

## 一、总体架构

```text
SheetDocument
├─ template: SheetTemplate   # 纸张、边距、图框、图签单元格、字高、主题
└─ values:   SheetFieldValues # 工程名称、图名、图号、比例、日期、人员...
        │
        ├─ buildSheetLayout() → SheetLayout（mm 坐标、线、文字、单元格）
        ├─ sheetToSvg()       → SVG 字符串
        ├─ sheetToDxf()       → DXF R2010 ASCII 字符串
        └─ validateTemplate() → 结构/边距/字高/溢出/超框校验
```

核心不依赖 Vue，页面只负责交互和导出。

## 二、坐标与单位

- 所有几何坐标使用 **mm**；
- SVG `viewBox` 与纸张 1:1，`width` / `height` 使用 `mm`；
- DXF 模型空间 1:1 mm，`$INSUNITS = 4`；
- 打印时按 1:1 或“适合纸张”缩放。

## 三、JSON Schema

- 使用 JSON Schema Draft 2020-12；
- 顶层 `SheetDocument`：`schemaVersion` / `template` / `values` / `customFields` / `exportedAt`；
- `customFields` 是 `{ key, label }[]`，`key` 限制为 `^[A-Za-z_][A-Za-z0-9_]*$`；
- 自定义字段值写入 `values[key]`，与内置字段共用同一个索引签名；
- `$defs` 包含 paper、margins、frame、titleBlock、cell、styles、textStyle、theme、values；
- 结构校验用 Schema，语义校验用 `validateTemplate()`：
  - 图签是否超出图框；
  - 单元格是否超出图签；
  - 字高是否低于图幅最小值；
  - 文字是否可能溢出；
  - 边距是否超过纸张。

## 四、SVG 渲染

- `buildSheetLayout()` 生成：
  - 纸张外边界、图框、对中符号、分区标记；
  - 图签外框、单元格边框；
  - 标签、字段值、分区编号；
  - 每个单元格的命中框。
- `sheetToSvg()` 输出独立 SVG：
  - `sheet-frame`、`sheet-text` 分组；
  - 文字使用 `text-anchor` + `dominant-baseline`；
  - 中文字体优先 Microsoft YaHei / Noto Sans SC；
  - 可导出后直接进 Illustrator / Inkscape。

## 五、DXF 导出

使用 MIT 许可的 `@tarikjabiri/dxf`：

- DXF R2007+ ASCII（AC1021），UTF-8；
- 单位 mm；
- 图层：
  - `SHEET-FRAME`：图框、对中、分区；
  - `SHEET-TITLE`：图签外框、单元格；
  - `SHEET-TEXT`：文字；
- 文字样式：`SHEET-TITLE` / `SHEET-BODY`，字体 `simhei.ttf`；
- 文字实体：`TEXT`，带水平/垂直对齐；
- 线实体：`LINE`；
- 浏览器中生成字符串，Blob 下载。

### Y 轴翻转

SVG 的 Y 轴向下，DXF 的 Y 轴向上。导出时统一做：

```ts
const flipY = (y: number) => paperHeight - y
```

- 所有 `LINE` 的起点/终点、`TEXT` 的插入点和对齐点都使用 `flipY`；
- 文字垂直对齐（Top / Middle / Bottom）与 SVG 的 `dominant-baseline` 一一对应；
- 修复前图签会出现在右上角、分区编号压在框线上；修复后图签在右下角，分区编号在图框外侧。

### 字高校准

CAD 的 `TEXT` 高度是字高（cap height），浏览器 `font-size` 是 em 尺寸，两者不能直接等价。默认导出会按文本内容校准：

```ts
const hasCjk = /[\u3400-\u9fff]/.test(text.text)
const height = text.fontSize * (hasCjk ? 1.12 : 0.8) * textScale
```

- 中文按 1.12 倍，英文/数字按 0.8 倍，使 CAD 里的视觉高度接近浏览器预览；
- `textScale` 是导出面板的“字高倍率”，默认 1；
- 关闭“按预览校准 DXF 字高”后，直接使用 `text.fontSize * textScale`，即名义字高。

### DWG 说明

原生 DWG 是封闭二进制格式，纯浏览器没有成熟可靠的写入方案。建议：

1. 导出 DXF；
2. 在 AutoCAD / 中望 / 浩辰中打开；
3. 另存为 DWG。

如必须原生 DWG，需要后端转换服务或桌面壳。

## 六、交互编辑

- `SheetCanvas.vue` 用 SVG 渲染，不用 Canvas，保证输出即最终矢量；
- 指针坐标通过 `getScreenCTM().inverse()` 转 mm；
- 支持拖动、右下角缩放、1/2/5/10mm 吸附；
- 单元格属性面板修改标签、字段、坐标、宽高、文字样式、对齐、边框；
- 单元格可覆盖 `fontSize` / `bold`，渲染时优先于文字样式；
- 全局字体通过 `styles.fontFamily` 控制，SVG 的 `font-family`、换行测量和导出共用同一值；
- 撤销/重做使用整文档快照，拖动时只在结束时入栈；
- 方向键微调，Shift 加速；
- “专注编辑”通过 CSS 隐藏左右面板，把中间编辑区扩展到整屏；预览区高度用 `clamp()` 跟随视口。

## 七、性能

- 图签通常几十个单元格，布局计算 < 1ms；
- SVG 字符串 < 100KB；
- DXF 字符串通常 < 200KB；
- 全部在浏览器完成，无需后端。

## 八、测试建议

- 纸张尺寸 / 横竖版；
- 边距与图框计算；
- 图签缩放（A5 窄幅）；
- 字高校验；
- 文字溢出校验；
- JSON 往返；
- SVG 包含关键文字；
- DXF 包含 `SECTION`、`ENTITIES`、图层名、文字；
- 固定模板快照测试。

## 九、网格模型与元素语义

### 1. 两种布局模式

```ts
titleBlock.layoutMode: 'absolute' | 'grid'
```

- `absolute`：传统 `x/y/w/h` 单元格，兼容旧模板；
- `grid`：行列轨道模型，当前默认。

```ts
interface TitleBlockGrid {
  columns: GridTrack[]   // 列宽 mm
  rows: GridTrack[]      // 行高 mm
  cells: GridCell[]      // row / col / rowSpan / colSpan
}
```

- 渲染时 `gridToAbsoluteCells()` 把网格换算成绝对坐标；
- 迁移时 `gridFromAbsolute()` 从唯一 x/y 提取轨道，并把同矩形上的“标签格 + 字段值格”合并；
- `syncCellsFromGrid()` 把派生绝对单元格写回 `cells`，供导出兼容。

### 2. 网格操作

- 插入/删除行、列：自动平移单元格，跨过插入点时扩展 `rowSpan/colSpan`；
- 合并：选区必须完整包含已有单元格，部分重叠会拒绝；
- 拆分：把合并单元格拆成 1×1 网格；
- 归一化：按图签宽高缩放轨道；
- 等宽/等高：平均分配轨道；
- 内容自适应：按文字近似宽度/行数计算轨道，再归一化。

### 3. 元素语义

`buildSheetLayout()` 为每个线/文字/形状写入：

```ts
semanticId  // frame.top / symbol.centering.top / titleBlock.cell.xxx.value
name        // 图框线 / 对中符号 / 字段值
standard    // GB/T 14689-2008 / GB/T 10609.1-2008
group       // frame.line / symbol.centering / titleBlock.value
layer       // frame / symbol / title / text
```

- SVG 渲染时输出为 `data-*`，供 tooltip 和自动化测试使用；
- `ViewState` 单独保存元素显示开关，不进入 `SheetDocument`；
- `sheetToSvg(..., { viewState })` 和 `sheetToDxf(..., { viewState })` 按分组过滤。

### 4. 显示状态

```ts
interface ViewState {
  showGrid: boolean
  showTooltips: boolean
  groups: Record<string, boolean>
}
```

- 默认关闭“装订边参考区”；
- 图层/元素开关不改变几何、尺寸和指标；
- 导出当前视图会移除隐藏元素，完整导出保留全部。

## 十、新手引导模式

### 1. 双轨 UI

```ts
uiMode: 'guided' | 'advanced'
wizardStep: 0 | 1 | 2 | 3
```

- 默认 `guided`，首次访问显示帮助条；
- `uiMode` 与 `wizardStep` 分别保存在 `localStorage`：
  - `dls.sheet-template.ui-mode`
  - `dls.sheet-template.wizard-step`
- 两种模式共用同一个 `SheetDocument`、`ViewState`、撤销栈和草稿保存逻辑，切换模式不会丢数据；
- 切回新手模式时回到第 3 步（内容），避免用户重新走一遍图幅和模板。

### 2. 四步向导

| 步骤 | 内容 | 复用能力 |
|---|---|---|
| 图幅 | A0~A5 卡片、横竖版 | `setPaper()` / `setOrientation()` |
| 图签 | 3 张模板卡片 + 缩略图 | `createTemplate()` + `sheetToSvg()` 裁切 |
| 内容 | 放大图签 + 单元格表单 | `SheetCanvas` 的 `cropToTitleBlock` |
| 导出 | 完整预览 + 导出卡片 | `sheetToSvg()` / `sheetToDxf()` / PNG 光栅化 |

模板缩略图直接由 `sheetToSvg()` 生成，再把 `viewBox` 裁到图签范围，因此缩略图与最终导出保持一致。

### 3. 图签放大预览

`SheetCanvas` 增加两个 props：

```ts
cropToTitleBlock?: boolean  // viewBox 裁到图签区域
hideTooltip?: boolean       // 引导模式下关闭悬浮 Tips
```

- 引导模式第 3 步使用 `cropToTitleBlock`，让几十个单元格填满可用宽度；
- `hideTooltip` 避免新手在点单元格时被图元提示层遮挡；
- 点击单元格仍然走 `select-cell`，右侧表单通过 `editCell` 读取当前单元格。

### 4. 字段绑定

- 引导模式的下拉框直接写 `cell.field`，与专业模式完全同一份数据；
- 字段值写 `doc.values[field]`；
- 无字段单元格编辑 `cell.text` 或 `cell.label`；
- 不引入第二套字段模型，导出 JSON 结构不变。

### 5. 导出

- SVG / DXF 复用专业模式导出函数；
- PNG 通过 `sheetToSvg()` → `Blob` → `Image` → `canvas`，按 4 px/mm 光栅化；
- 导出前只把 `error` 级别问题显示为阻断提示，`warning` 折叠为一句提示。
