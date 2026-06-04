# Tools 组件范式审核报告与改进计划

## 审核概述

对 `src/tools/` 下 10 个工具组件进行了统一范式审核，对照 `src/tools/tools-architecture.md` 架构文档逐项检查。

> **架构变更说明**（2026-05-27）：View 层已从架构中移除，所有工具现采用纯 Page 架构。ToolDetailView 直接 import 并渲染 Page 组件，不再经过 View 包装层。

**审核结论**：核心范式一致，10 个工具全部遵循 Page 组件架构。存在 **5 个偏离项**，涉及命名规范、代码重复、风格不一致和文档过期。

> **状态更新**（2026-05-28）：所有偏离项均未开始修复，需按优先级推进。

---

## 一、范式符合项（已正确实现）

| 检查项 | 结果 |
|-------|------|
| 所有工具都有 Page 组件 | ✅ 10/10 |
| Page 组件不含布局逻辑，纯业务 | ✅ 10/10 |
| Page 标题和描述从 `toolData.ts` 配置驱动获取 | ✅ 10/10 |
| 使用通用路由 `/tools/:toolId` | ✅ 10/10 |
| `ToolDetailView.vue` 的 componentMap 已注册全部工具 | ✅ 10/10 |
| `createToolNavItems` 统一生成"道法术器势"五标签页导航 | ✅ 10/10 |

---

## 二、偏离项与改进任务

### 2.1 Page 组件命名不一致

- **状态**: ❌ 未开始
- **文件**: `src/tools/table2kml_basestation/BasestationPage.vue`
- **问题**: View 叫 `Table2KmlBasestationView.vue`，Page 却叫 `BasestationPage.vue`，命名不配对
- **规范**: 架构文档第 8 节要求 Page 组件使用 `{ToolName}Page.vue`
- **修复**: 重命名为 `Table2KmlBasestationPage.vue`，同步更新 import 引用

### 2.2 模块文件命名大小写不一致

- **状态**: ❌ 未开始
- **文件**: `src/tools/coords_convert/templateReader.ts`、`src/tools/coords_convert/templateExporter.ts`
- **问题**: 使用了 camelCase，而架构文档第 8 节规范是 PascalCase（`TemplateReader.ts`、`TemplateExporter.ts`），其他所有工具也均为 PascalCase
- **修复**: 重命名为 `TemplateReader.ts`、`TemplateExporter.ts`，同步更新 import 引用

### 2.3 Page 组件 UI 样式不统一

- **状态**: ❌ 未开始
- **涉及文件**:
  - `src/tools/coord_convert/CoordConvertPage.vue` — h1 用 `mb-6`，描述用 `text-gray-600`
  - `src/tools/geo_data/GeoDataPage.vue` — h1 用 `mb-6`，描述用 `text-gray-600`
- **问题**: 其余 8 个 Page 组件统一使用 `mb-2` + `text-base-content/70`
- **修复**: 将这两个 Page 组件改为 `mb-2` + `text-base-content/70`

### 2.4 CSV/XLSX 解析代码重复

- **状态**: ❌ 未开始
- **涉及文件**:
  - `src/tools/get_add/GetAddPage.vue` (约 line 698-743)
  - `src/tools/get_lonlat/GetLonLatPage.vue` (约 line 723-767)
- **问题**: `parseCSV` 和 `parseCSVLine` 函数在 2 个 Page 组件中重复（`distance_sensor` 已改用 `@/utils/CsvParser` 公共模块）
- **规范**: 架构文档第 4.2 节设计了 `src/utils/TemplateReader.ts` 作为通用文件读取模块
- **修复**: 将 CSV 解析逻辑提取到 `src/utils/` 公共模块，2 个 Page 改为引用公共方法

### 2.5 docx_template_export 模块分离不充分

- **状态**: 🔶 部分改善
- **文件**: `src/tools/docx_template_export/DocxTemplateExportPage.vue`
- **问题**: 业务逻辑部分已提取到 `useDocxTemplateExport.ts` composable，但 Page 组件中仍保留较多模板生成、文件渲染逻辑，未完全拆分为独立模块
- **对比**: 其他工具将职责分离为 TemplateReader.ts、TemplateExporter.ts、ApiService.ts 等独立模块
- **修复**: 建议进一步拆分为 `TemplateExporter.ts`（模板下载）、`DocxRenderer.ts`（渲染逻辑），Page 仅负责状态管理和 UI 交互

### 2.6 架构文档内容过期

- **状态**: ❌ 未开始
- **文件**: `src/tools/tools-architecture.md`
- **问题**:
  - 第 4.1 节"各工具模块分布一览"表格缺少 `geo_data`、`gis2excel`、`docx_template_export`
  - 第 12.1 节"工具"列表已补充 `gis2excel` 和 `docx_template_export`，但 `geo_data` 仍标注为"方案设计文档"（实际已有可运行 Page 组件）
- **修复**: 补充 4.1 节中 3 个新工具的模块说明，修正 `geo_data` 在 12.1 节的归类

---

## 三、各工具对照总表

| 工具 ID | Page 命名 | h1 margin | 描述颜色 | 模块分离 | 状态 | 备注 |
|---------|----------|-----------|---------|---------|------|------|
| coord_convert | ✅ | ❌ mb-6 | ❌ text-gray-600 | ✅ | ❌ | 样式待统一 |
| coords_convert | ✅ | ✅ | ✅ | ❌ 命名 | ❌ | templateReader/Exporter 用小写 |
| distance_sensor | ✅ | ✅ | ✅ | ✅ | ✅ | parseCSV 已改用公共模块 |
| get_add | ✅ | ✅ | ✅ | ❌ 重复 | ❌ | parseCSV 内联重复 |
| get_lonlat | ✅ | ✅ | ✅ | ❌ 重复 | ❌ | parseCSV 内联重复 |
| table2kml_point | ✅ | ✅ | ✅ | ✅ | ✅ | |
| table2kml_basestation | ❌ 命名 | ✅ | ✅ | ✅ | ❌ | Page 应命名为 Table2KmlBasestationPage |
| geo_data | ✅ | ❌ mb-6 | ❌ text-gray-600 | ✅ | ❌ | 样式待统一 |
| gis2excel | ✅ | ✅ | ✅ | ✅ | ✅ | |
| docx_template_export | ✅ | ✅ | ✅ | 🔶 | 🔶 | 已有 useDocxTemplateExport.ts，需进一步拆分 |

---

## 四、改进执行计划

### 阶段一：紧急修复（命名 + 重复代码）

| 序号 | 任务 | 文件数 | 状态 |
|-----|------|-------|------|
| 1 | `BasestationPage.vue` → `Table2KmlBasestationPage.vue`，更新 import 引用 | 3 | ❌ |
| 2 | `coords_convert/templateReader.ts` → `TemplateReader.ts`、`templateExporter.ts` → `TemplateExporter.ts` | 4 | ❌ |
| 3 | 提取公共 `parseCSV` / `parseCSVLine` 到 `src/utils/`，2 个 Page 去重 | 3 | ❌ |

### 阶段二：风格统一

| 序号 | 任务 | 文件数 | 状态 |
|-----|------|-------|------|
| 4 | 统一 `CoordConvertPage.vue` h1 margin 和描述颜色 | 1 | ❌ |
| 5 | 统一 `GeoDataPage.vue` h1 margin 和描述颜色 | 1 | ❌ |

### 阶段三：架构优化 + 文档更新

| 序号 | 任务 | 文件数 | 状态 |
|-----|------|-------|------|
| 6 | `docx_template_export` 进一步模块拆分 | 2-3 | 🔶 |
| 7 | 更新 `tools-architecture.md` 补充 3 个新工具 + 修正 geo_data 归类 | 1 | ❌ |

---

*首次审核: 2026-05-22 · 状态复查: **2026-05-28** · 基于 `tools-architecture.md` 配套审查*
