# 2026-10-09 代码审查 · P3：死代码 · 重复实现 · 结构腐化

> **问题总数**：5 类，涉及约 **2,000 行可删除代码**
> **审计日期**：2026-10-09 · 基线 `c096944`
> **上一份**：[P2 工程配置 · 安全 · 性能](./2026-10-09-audit-03-P2-engineering.md)

本报告的问题不直接产生错误数据，但它们**是 P0–P2 中"修一处漏一处"类 bug 的温床**：同一段逻辑复制 N 份，修一份就漏 N-1 份。

---

## P3-1　重构残留：1,114 行死代码，且藏着与上一轮 P0-1 完全相同的崩溃

### 位置
| 文件 | 行数 | 状态 |
|---|---|---|
| `src/tools/docx_template_export/useDocxTemplateExport.ts` | 375 | **生产 0 引用** |
| `src/tools/docx_template_export/docxTemplateFunctions.ts` | 261 | 仅被自己的 spec 引用 |
| `src/tools/xlsx_template_export/useXlsxTemplateExport.ts` | 357 | **生产 0 引用** |
| `src/tools/xlsx_template_export/xlsxTemplateFunctions.ts` | 121 | 仅被自己的 spec 引用 |

### 严重度
中等（体积 + 误导 + 地雷）

### 触发场景
`template_export/` 是三个工具合并后的新家，旧的两份没删。它们被自己的单测"续命"，看起来像活代码。

### 后果
三份 `use*TemplateExport.ts` 的 import 列表**完全相同**（`docxtemplater`/`pizzip`/`jszip`/`file-saver`/`xlsx`/`papaparse`/`angular-expressions`），`angularParser` 实现逐行相同，11 个 angular filter 注册块（`upper`/`lower`/`capitalize`/`number`/`currency`/`percent`/`date`/`default`/`truncate`/`trim`/`split`）三份重复。

**最危险的**：`useXlsxTemplateExport.ts:210` 藏着和上一轮 P0-1 一模一样的 `new window.ExcelJS.Workbook()`。上一轮审计明确记录：

> `useXlsxTemplateExport.ts:210` 有一模一样的 `new window.ExcelJS.Workbook()`。两个文件都坏在同一处，说明这是**从同一份模板复制**的。

这是一个**未爆炸的地雷**：一旦有人接线这个 composable，就是 100% 崩溃回归。

### 修复建议
删除 4 个文件**及其 spec**（`__tests__/docxTemplateFunctions.spec.ts`、`__tests__/xlsxTemplateFunctions.spec.ts`）。删文件必须连 spec 一起删，否则留下孤立测试。

```bash
rm -rf src/tools/docx_template_export/useDocxTemplateExport.ts \
       src/tools/docx_template_export/docxTemplateFunctions.ts \
       src/tools/docx_template_export/__tests__ \
       src/tools/xlsx_template_export/useXlsxTemplateExport.ts \
       src/tools/xlsx_template_export/xlsxTemplateFunctions.ts \
       src/tools/xlsx_template_export/__tests__
```

注意：`DocxTemplateExportPage.vue` 和 `XlsxTemplateExportPage.vue`（各 172 字节）**不是死代码**，它们是转发壳（`<TemplateExportPage format="docx" />`），要保留。

### 工作量
1 小时（含 type-check + vitest 验证）

### 验收标准
- [ ] `npm run type-check` 0 错误
- [ ] `npx vitest run` 无孤立 spec 报错
- [ ] 工具页 `/tools/docx_template_export`、`/tools/xlsx_template_export` 仍正常打开

---

## P3-2　其余零引用文件：约 850 行

### 位置与证据（全部经全仓 grep 确认无生产引用）

| 文件 | 行数 | 说明 |
|---|---|---|
| `src/components/icons/IconCommunity.vue` | 7 | Vue create-vue 脚手架残留，0 命中 |
| `src/components/icons/IconDocumentation.vue` | 7 | 同上 |
| `src/components/icons/IconEcosystem.vue` | 7 | 同上 |
| `src/components/icons/IconSupport.vue` | 7 | 同上 |
| `src/components/icons/IconTooling.vue` | 19 | 同上 |
| `src/components/common/BaseSkeleton.vue` | 48 | 0 引用，且内部 `inlineStyle` computed 从未在模板中用 |
| `src/components/common/DateRangePicker.vue` | 167 | 0 引用（各页面直接用 `@vuepic/vue-datepicker`） |
| `src/components/common/ProgressBar.vue` | 33 | 0 引用 |
| `src/components/common/ToastContainer.vue` | 68 | **0 引用，但它是 P1-1 的修复对象 — 先修 P1-1，不要删！** |
| `src/components/layout/ToolDocNav.vue` | 71 | 0 引用（`createToolNavItems.ts` 已接管） |
| `src/composables/useProgress.ts` | 26 | 仅被已死的 `ProgressBar.vue` 引用；`startProgress`/`finishProgress` 全仓 0 调用 |
| `src/utils/index.ts` | 23 | barrel 文件，`from '@/utils'` 全 src 0 命中 |
| `src/views/viewData.ts` | 80 | 0 引用，且 `docTypes`/`ViewConfig`/`getViewName` 与 `toolData.ts` 重复定义 |
| `src/views/pages/md-test/MdView.vue` | 14 | 0 引用，且引用的 `public/thisMd.md` **不存在** |
| `src/tools/coord_convert/coordinateInputStore.ts` | 59 | 生产 0 引用，仅被自己的 spec 引用（`CoordinateInput.vue` 只用本地 `ref`） |
| `src/tools/get_add/TemplateExporter.ts` | 2 | `ADDRESS_HEADERS` 无人 import，`GeocodeCommon.vue:560` 自己重新定义了一份 |
| `src/tools/get_lonlat/TemplateExporter.ts` | 2 | `LONLAT_HEADERS` 无人 import，`GeocodeCommon.vue:561` 重新定义 |
| `src/assets/base.css` | 84 | `main.css:1` 的 `@import` 被注释掉了 |
| `src/assets/markdown.css` | 112 | 从未被 import |
| `src/tools/geo_data/togeojson.d.ts` | 7 | `togeojson` 有官方类型，此声明文件无引用 |

### 修复建议
**先完成 P1-1（挂载 ToastContainer），再删其余文件。**

```bash
rm -r src/components/icons/
rm src/components/common/BaseSkeleton.vue \
   src/components/common/DateRangePicker.vue \
   src/components/common/ProgressBar.vue \
   src/components/layout/ToolDocNav.vue \
   src/composables/useProgress.ts \
   src/utils/index.ts \
   src/views/viewData.ts \
   src/views/pages/md-test/ \
   src/tools/coord_convert/coordinateInputStore.ts \
   src/tools/coord_convert/__tests__/coordinateInputStore.spec.ts \
   src/tools/get_add/TemplateExporter.ts \
   src/tools/get_lonlat/TemplateExporter.ts \
   src/assets/base.css \
   src/assets/markdown.css
```

### 工作量
2 小时

### 验收标准
- [ ] `npm run type-check` 0 错误
- [ ] `npx vitest run` 全绿（删除的 spec 不再存在）
- [ ] `npx eslint .` 的 unused-vars 计数下降

---

## P3-3　12 个已安装但 src 零引用的依赖

### 位置
`package.json:21-69`

### 严重度
中等（安装体积 + 构建时间 + `manualChunks` 空转规则）

### 证据（grep 全 `src/**/*.{ts,vue}`，排除 `__tests__`）

| 依赖 | 状态 |
|---|---|
| `markstream-vue` | 0 命中，纯死依赖 |
| `mermaid` | 0 命中（`vite.config.ts:70` 还为它建了 `md-diagram` chunk） |
| `h3-js` | 0 命中 |
| `leaflet-kml` | 0 命中（`kml_viewer` 用 DOM 解析而非此库） |
| `geojson` | 唯一命中是 `earthquakeService.ts:85` 的 `format: 'geojson'` **字符串**，未 import 包本身 |
| `@iconify/vue` | 0 命中（图标统一用 `@phosphor-icons/vue`） |
| `radix-vue` | 0 命中 |
| `class-variance-authority` | 0 命中 |
| `clsx` | 0 命中 |
| `tailwind-merge` | 0 命中 |
| `@vueuse/core` | 0 命中（手动写了 `useCountUp`/`useDaisyTheme`/`useECharts`） |
| `vue-use-monaco` | 0 命中（`vite.config.ts:70` 的 `monaco` chunk 规则也是死的） |
| `vue-echarts` | 0 命中（实际用 `echarts` + 自研 `useECharts`） |

**同时在用、不要删**：`xlsx`、`jszip`、`file-saver`、`docxtemplater`、`pizzip`、`papaparse`、`angular-expressions`、`axios`、`gcoord`、`proj4`、`@turf/turf`、`togeojson`、`shpjs`、`frappe-gantt`、`vuedraggable`、`leaflet`、`qrcode`、`jsqr`、`echarts`、`exceljs`（动态 import）、`markdown-it`、`dompurify`、`@ckpack/vue-color`、`@vuepic/vue-datepicker`、`@phosphor-icons/vue`。

### 修复建议
```bash
npm uninstall markstream-vue mermaid h3-js leaflet-kml geojson @iconify/vue \
  radix-vue class-variance-authority clsx tailwind-merge @vueuse/core \
  vue-use-monaco vue-echarts
```
同时删除 `vite.config.ts:66-72` 中对应的 chunk 规则（这本身也是 P2-10 的一部分）。

### 工作量
1 小时

### 验收标准
- [ ] `npm run build-only` 成功
- [ ] 首屏 JS 载荷下降
- [ ] 所有 22 个工具页面仍可打开（用 e2e 的 `tools.spec.ts` 验证）

---

## P3-4　重复实现统计：同一逻辑复制 N 份，是"修一处漏一处"的根因

### 模板读取器 —— 7 份

| 文件 | 行数 | 是否基于通用层 |
|---|---|---|
| `src/utils/TemplateReader.ts` | 188 | **基座**，`XLSX.read` + 表头顺序无关 + `validateRow` 钩子 |
| `src/tools/coords_convert/templateReader.ts` | 119 | ✅ 包基座，只加 `validateCoordRow` |
| `src/tools/table2kml_basestation/TemplateReader.ts` | 203 | ✅ 包基座 |
| `src/tools/elevations_batch/TemplateReader.ts` | 94 | ❌ 自建，手写别名循环 |
| `src/tools/get_add/TemplateReader.ts` | 100 | ❌ 自建，**与 elevations_batch 版逻辑完全相同** |
| `src/tools/get_lonlat/TemplateReader.ts` | 80 | ❌ 自建 |
| `src/tools/distance_sensor/TemplateReader.ts` | 264 | ❌ 完全独立（3列/6列双集合语义） |

**已确认的问题**：
- `get_add` 与 `elevations_batch` 的 `readAndValidateTemplate` **逻辑完全相同**（逐行比对只剩 4 行注释差异）→ 这正是 P0-1 的 bug 同时存在于两处的原因。
- 三份自建版都没走 `utils/TemplateReader.ts` 的行验证钩子，各自重复了「取别名 → trim → 非空 → 范围检查 → push」这套循环。
- `distance_sensor/TemplateReader.ts:186-211` 的 `same-site` 与 `different-site` 两个分支体**逐字节相同**；`:253-256` `getResultHeaders` 的三元两个分支都是 `['名称','经度','纬度']`，且与 `:147` 的文档注释矛盾。

### 模板导出器 —— 6 份 + 1 个死 barrel

| 文件 | 内容 |
|---|---|
| `src/utils/TemplateExporter.ts` | 223 行，**唯一在用的真实导出引擎**（7 个页面引用） |
| `src/tools/distance_sensor/TemplateExporter.ts` | 20 行，3 个表头常量（`MATCH_RESULT_HEADERS` 无人用） |
| `src/tools/elevations_batch/TemplateExporter.ts` | 1 行，`['名称','经度','纬度']` |
| `src/tools/get_add/TemplateExporter.ts` | **死**（见 P3-2） |
| `src/tools/get_lonlat/TemplateExporter.ts` | **死**（见 P3-2） |
| `src/tools/table2kml_point/TemplateExporter.ts` | 6 行，在用 |
| `src/tools/table2kml_basestation/TemplateExporter.ts` | 29 行，在用 |
| `src/utils/index.ts` | 死 barrel |

`utils/TemplateExporter.ts` 内部也有 3 处 0 引用：`exportTable`（标了 `@deprecated`）、`downloadCsvTemplate`、`downloadXlsxTemplate`（注释写"兼容 table2kml"，但 table2kml 已用自己的 `TemplateExporter.ts`）。

### 文件名模板 / 花括号校验 —— 5 + 4 份

- 文件名模板渲染：`ShpToKmlGenerator.ts:65-81`、`Shp2KmlPage.vue:750-766`、`docxTemplateFunctions.ts:224-243`、`xlsxTemplateFunctions.ts:33-52`、`useTemplateExport.ts:213-232`
- 花括号校验：`useTemplateExport.ts:191-211`、`docxTemplateFunctions.ts:200-222`、`xlsxTemplateFunctions.ts:10-31`、`Shp2KmlPage.vue:728-748`

**其中 `Shp2KmlPage.vue:750-766` 与 `ShpToKmlGenerator.ts:65-81` 是同一函数两份拷贝**（我已逐行比对，`generateNameFromTemplate` 实现完全相同）——页面用前者做实时预览、生成器用后者出文件，**可能输出不一致**。

### 其余

| 关注点 | 份数 | 说明 |
|---|---|---|
| `sanitizeFilename` / `resolveDuplicates` | 3 | `docxTemplateFunctions.ts` 与 `xlsxTemplateFunctions.ts` **逐字节相同**；`useTemplateExport.ts` 是第三份（含 P1-4 的 bug，3 处都要修） |
| `escapeXml` | 2 | `table2kml_point/KmlGenerator.ts:97` 与 `shp2kml/ShpToKmlGenerator.ts:45` 完全相同 |
| CSV 解析 | 3 套 | `utils/CsvParser.ts`（100 行手写）、`ElevationsBatchPage.vue` 内一份（上一轮已删，改为复用共享实现）、3 个 composable 里的 PapaParse |
| KML 生成器 | 3 | `utils/KmlGenerator.ts`(354) / `table2kml_point/KmlGenerator.ts`(180) / `shp2kml/ShpToKmlGenerator.ts`(240) —— 几何类型不同，不宜强行合并，但公共件应抽出 |
| ECharts option 生成 | 7 | `weatherHistoryChart.ts`(419，5 个生成器) + `gdacsChart.ts`(299) + `earthquakeChart.ts`(356) |
| 进度弹窗（内联） | 3 | `components/common/ProgressModal.vue`(72 行) 已存在，但 `GisToExcelPage.vue:154`、`ShpToExcelPage.vue:199`、`TemplateExportPage.vue:190` 各自内联复制了约 12 行 |

### 手写 CSV 解析器的确定缺陷（`src/utils/CsvParser.ts`）

- `:18-19` `if (char === '"') inQuotes = !inQuotes` —— 标准的 `""` 转义会切换两次，引号字符被丢弃，**字段内容损坏**
- `:50` `cleanText.trim().split('\n')` 会在**引号内的换行符**处切断，产生虚假行
- `:80` `String(h || '')` 会把值为数字 `0` 的表头变成空字符串

### 修复建议
**优先级从高到低**：

1. **P1 阶段的等价修复**：`sanitizeFilename`/`resolveDuplicates`（P1-4）、文件名模板、`escapeXml` —— 这 3 项是"改一处漏 N 处"的直接风险，**修 bug 时必须同步改所有拷贝**。
2. **P3 阶段的收敛**：
   - 新建 `src/utils/templateReader/index.ts` 参数化工厂，7 份 → 1 份 + 6 个配置对象
   - 新建 `src/utils/kmlShared.ts` 放 `escapeXml`、`downloadBlob`、`hexToKmlColor`、`toKmlCoordinatesString`
   - 新建 `src/utils/filenameTemplate.ts` 收敛 5 份文件名逻辑
   - 把 `table2kml_point/ColorParser.ts` 移到 `src/utils/`（`shp2kml` 已经跨目录 import 它）
   - 3 处内联进度弹窗改用 `components/common/ProgressModal.vue`
3. CSV 解析：统一用 PapaParse（项目已依赖），弃用 `utils/CsvParser.ts` 的手写实现；或在保留前先修 `""` 转义与引号内换行。

### 工作量
约 1 周（分阶段，可增量进行）

### 验收标准
- [ ] 每个关注点只有一份实现（grep 关键字只命中 1 个文件）
- [ ] `npm run type-check` + `npx vitest run` 全绿
- [ ] 行为不变：用现有 fixture 对比重构前后的产出文件（尤其 `Shp2KmlPage` 预览 vs 下载文件）

---

## P3-5　超大文件与结构腐化

### 按行数排序

| 排名 | 文件 | 行数 | 拆分建议 |
|---|---|---|---|
| 1 | `src/tools/gantt_chart/GanttChartPage.vue` | **1623** | 三块天然边界：<br>• 972-1430（460 行）SVG/PNG/JPG 导出 + `collectGanttCSS`/`injectHeaderToSvg`/`cropEmptyDates` → `ganttSvgExport.ts`<br>• 565-794（230 行）`initGantt`/`destroyGantt`/`reinitGantt`/`refreshGantt`/`switchViewMode` → `useGanttInstance.ts`<br>• 790-960 任务表单模态 → `TaskEditModal.vue` |
| 2 | `src/tools/kml_viewer/KmlViewerPage.vue` | **1157** | Leaflet 生命周期 / KML DOM 解析 / 树渲染 / 图层管理四件事 |
| 3 | `src/utils/DistanceCalculator.ts` | 590 | 球面公式 / 索引构建 / 匹配算法分层 |
| 4 | `src/components/common/GeocodeCommon.vue` | **983** | `mode: 'add' \| 'lonlat'` 一个组件装两个工具，含 6 个 `showErrorDialog` 分支 |
| 5 | `src/tools/shp2kml/Shp2KmlPage.vue` | 832 | 含重复的 `generateNameFromTemplate`/花括号校验 + 内联样式面板 |
| 6 | `src/tools/template_export/useTemplateExport.ts` | 713 | 前 90 行 angular filter 注册可整体抽出 `angularFilters.ts` |
| 7 | `src/tools/geo_data/GeoDataPage.vue` | 702 | |
| 8 | `src/tools/distance_sensor/DistanceSensorPage.vue` | 679 | |
| 9 | `src/tools/coords_convert/CoordsConvertPage.vue` | 618 | |
| 10 | `src/components/layout/DlsComment.vue` | 390 | 4 个功能（取数/提交/验证码/统计）混在一起 |

> **优先级建议：`GanttChartPage.vue` ≫ `GeocodeCommon.vue` > `KmlViewerPage.vue` > `useTemplateExport.ts`。**
> 前两个都超过 1000 行且职责混杂。**只抽 `GanttChartPage` 的导出块就能立刻砍掉 460 行**，是投入产出比最高的一刀。

### 其他结构性问题

**(a) `src/tools/template_export/` 不是工具，却在 `tools/` 下**
`ToolDetailView.vue:66` 用 `import.meta.glob('@/tools/*/*Page.vue')` **按目录名**自动注册工具。结果 23 个 `*Page.vue` vs 22 个 `toolConfigs` id——`template_export` 会在 `componentMap` 里产出一个条目但 `toolData.ts` 没有对应 id → **不可达**，同时是隐性地雷：哪天有人往 `toolData` 加 `template_export`，页面会因缺 `format` prop 直接坏。

建议：共享实现移出 `src/tools/`（如 `src/features/template-export/`），或把 glob 改成显式映射表。

**(b) `coord_convert` vs `coords_convert` 的 30 倍字节差**
- `coord_convert/CoordConvertPage.vue` = 724 B / 22 行：几乎只有 `<CoordinateInput />` + 标题，逻辑外置到同目录组件
- `coords_convert/CoordsConvertPage.vue` = 21760 B / 618 行：自己内联了整套批量 UI、进度条、XLSX 读写、错误弹窗

两者功能有重叠（共用 `@/utils/coordinateConverter` + `coordTransform`），属两个真实工具，但**架构不一致**：一个外置、一个内联。

**(c) `templateHandler.ts` vs `TemplateReader.ts` 双通用层**
一套帕斯卡命名、一套小写命名，新代码随便用哪套。且 `templateHandler.ts` 里 5 个导出已死（`ValidationError`、`TemplateHeaders`、`ADDRESS_FIELDS`、`transformToCoordinatePoint`、`transformToFullAddress` 均仅被自己的 spec 引用）。

**(d) `useToolSeo` 死了，`ToolDetailView.vue` 手抄了它**
`composables/useSeo.ts:47-82` 的 `useToolSeo(tool)` **0 引用**；`views/layouts/ToolDetailView.vue:84-141`（58 行）手写了完全相同的 `useHead({ title/meta/og/twitter/canonical/ld+json SoftwareApplication })` 块。

**(e) `ApiService.ts` 命名混乱**
`get_add/ApiService.ts`(180) 与 `get_lonlat/ApiService.ts`(251) 导出的 API 完全对称，是两份平行实现。加上 `amapService.ts`、`GeocodeBatchService.ts`、`geoDataService.ts`、`geoAnalysisService.ts`、`elevationService.ts`、`gdacsService.ts`、`earthquakeService.ts`、`weatherHistoryService.ts` —— 共 7 种 `*Service` 后缀语义各不相同（有的全是纯函数，有的是 class 单例，有的只是 option 常量）。

`src/tools/spec.md:44` 自己规定了「`*Service.ts` / `*ApiService.ts`」，但落地成了两套并存。**建议统一 `xxxService.ts`。**

**(f) `shp2excel` 与 `gis2excel` 近乎逐行克隆**
`shp2excel/ShpToExcelPage.vue`(384 行) 与 `gis2excel/GisToExcelPage.vue`(278 行) 同样 6 个 reactive advancedOptions、同样的 `ref` 集合、同样的模板结构。`ShpFileReader.ts`(131 行) 已只是 `gis2excel/GisFileReader` 的门面，且其唯一导出的 `readAndValidateShpFiles` **0 引用**（Page 只 import 了两个 type）。

**(g) 仅被自己的单测引用的导出（伪存活）**
删生产代码时要连 spec 一起删：
`templateHandler.ts`(5 个)、`amapService.ts`(`FieldOption`/`parseLocation`)、`kmlCoordinates.ts`(`toKmlCoordinatesString`)、`DistanceCalculator.ts`(`haversineDistance`/`DistanceMatch`)、`TemplateReader.ts`(`readTemplate`)、`ColorParser.ts`(`isValidColor`)、`ganttTaskUtils.ts`(`toGanttDate`)、`tileProviders.ts`(`getTileProvider`)、`ShpFileReader.ts`(`readAndValidateShpFiles`)、`geoDataService.ts`(`performAnalysis` —— `GeoDataPage.vue:572` 自己写了本地 `performAnalysisAsync` 弃用了它)、`distance_sensor/TemplateExporter.ts`(`MATCH_RESULT_HEADERS`)、`useSeo.ts`(`useToolSeo`)、`toolData.ts`(`getToolName`/`getToolDocPath`)、`types/nav.ts`(`ComponentMap`)、`ThemeProvider.ts`(`themeProvider`)。

**(h) 仓库卫生**
- 29 个 `debug.log`（共 ~150 KB）散布在 `src/` 每个目录（`src/debug.log`、`src/components/layout/debug.log` 26.8 KB、`src/views/pages/home/debug.log` 32.2 KB …）。`git ls-files` 确认未入库，仅本地垃圾。建议 `git clean -fdX src/` 后跑一遍。
- `src/tools/geo_data/turf_excel_export.md`（741 行）和 `src/tools/spec.md`（152 行）是设计文档躺在源码目录里，应移到 `docs/`。
- `src/tools/gantt_chart/frappe-gantt.css`(6.7 KB) 被该页 import，但 `ganttTaskUtils.ts`/`ganttStore.ts` 与之分离存放，无 `index.ts` 出口，跨工具无法复用。
- `docs/` 与 `docs/2026-09-27-audit-report.md` 并存且功能重叠（后者是历史归档，保留）。

### 修复建议
按 P3 汇总表的顺序执行，每步都跑 `npm run type-check && npx vitest run`。

### 工作量
约 2–3 周（可增量，不要求一次做完）

### 验收标准
- [ ] `src/tools/gantt_chart/GanttChartPage.vue` 降至 1200 行以下
- [ ] 重复关注点各有唯一实现（grep 验证）
- [ ] 所有工具 e2e 通过（`npx playwright test`）
- [ ] 删除的死代码无 spec 残留

---

## P3 汇总表与执行顺序

| 阶段 | 动作 | 预计删减 | 前置 |
|---|---|---|---|
| **P3-a** | 删 1,114 行重构残留（docx/xlsx_template_export 4 文件 + spec） | **−1,114 行 / −35.6 KB** | — |
| **P3-b** | 挂载 ToastContainer，然后删 P3-2 的 20 个文件 | **−850 行** | 先做 **P1-1** |
| **P3-c** | 合并 `get_add` 与 `elevations_batch` 的 TemplateReader | −100 行 | 先做 **P0-1** |
| **P3-d** | 抽 `ganttSvgExport.ts`（先只抽这一块） | −460 行 | — |
| **P3-e** | 删 12 个零引用依赖 + 对应 chunk 规则 | 依赖体积 | 先做 **P2-10** |
| **P3-f** | 拆 `GeocodeCommon.vue`(983) / `KmlViewerPage.vue`(1157) | — | — |
| **P3-g** | 收敛模板读取器/导出器/文件名模板/`escapeXml`/进度弹窗 | — | P3-c |
| **P3-h** | 清理 debug.log、把 spec.md 移到 docs/ | — | — |

> **删除前必须跑**：`npm run type-check` + `npx vitest run`。上面多处死代码（尤其 `docx_template_export/*` 和 `coordinateInputStore.ts`）的 spec 是它们唯一的存在意义，删文件必须同时删 spec，否则留下孤立测试。

---

*上一份：[P2 工程配置 · 安全 · 性能](./2026-10-09-audit-03-P2-engineering.md) · 回到：[总览与路线图](./2026-10-09-audit-00-summary.md)*
