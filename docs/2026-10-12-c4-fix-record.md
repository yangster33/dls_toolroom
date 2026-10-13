# 2026-10-12 · C4 文件处理链路异步化与进度化 · 实施记录

> **依据计划**：[`2026-10-12-async-pipeline-plan.md`](./2026-10-12-async-pipeline-plan.md)（C4 / P2-20，四阶段）
> **台账**：[`../plan/2026-10-11-progress-ledger.md`](../plan/2026-10-11-progress-ledger.md) C 档 C4
> **排查基线**：`6a8e1ea`（计划提交）· 测试基线 693 passed / 50 files
> **实施方式**：分四阶段推进，每阶段跑全量门禁 + 独立评审（全新上下文的评审子代理）+ 反证，再进入下一阶段
> **状态**：阶段 1 ✅ / 阶段 2 ✅ / 阶段 3 ⬜ / 阶段 4 ⬜

---

## 一、总览

| 阶段 | 内容 | 状态 | 提交 |
|---|---|---|---|
| 1 | 止血：拆伪 yield、修假进度、新增 `yieldToUI` | ✅ | `50ff7d2` |
| 2 | 表格链路进度化：共用 reader/exporter 加可选 `onProgress` + 分片让出，8 个页面接入 | ✅ | `309e6fe` + `59940c6`（评审整改） |
| 3 | exceljs 迁移（非流式 `Workbook` + 逐行 `addRow` 分片让出，见偏离 D-6） | ✅ | 见下 |
| 4 | Worker 化（根治主线程阻塞） | ⬜ | — |

**范围外**：D1（7 份 `TemplateReader` 收敛成参数化工厂）是台账 D 档独立项，本批不做。
现有代码事实：`utils/TemplateReader.ts` 已是共用基座（coords_convert / table2kml_point / table2kml_basestation 三个包已包它），
4 个自建 reader（distance_sensor / elevations_batch / get_add / get_lonlat）走「页面自行解析文件 → 同步校验器」路径。

---

## 二、阶段 1 · 止血（提交 `50ff7d2`）

**改动**

| # | 文件 | 内容 |
|---|---|---|
| 1.4 | `src/utils/yieldToUI.ts`（新增） | `yieldToUI(ms=0)`；注释写清「`await` ≠ 不阻塞」 |
| 1.1 | `src/tools/gis2excel/GisToExcelExporter.ts` | `exportToExcel`/`exportSeparateFiles` 改 async；`forEach`→`for...of`；伪 yield `setTimeout(()=>{},200)` → 真 `await yieldToUI(200)`（让出移到循环首部并跳过首组）；`exportToXlsx`/`exportSingleTypeToXlsx` 改 async 并在重活前让出 |
| 1.1 | `GisToExcelPage.vue`、`ShpToExcelPage.vue` | `downloadAll`/`downloadSeparate` 改 async 并 await；加 `isExporting` 单飞（防双击并发跑两个循环） |
| 1.2/1.3 | `src/tools/geo_data/geoDataService.ts` | `parseKML`/`parseKMZ` 的 `forEach` → `for...of`；新增 `FEATURE_YIELD_INTERVAL=500`；进度改 1% 粒度节流（KML 70→100、KMZ 80→100，KMZ 原本整段无进度）；重活（`toGeoJSON`）前让出一帧 |

**测试**：`utils/__tests__/yieldToUI.spec.ts`（2）、`geo_data/__tests__/parseProgressYield.spec.ts`（7，含「让出次数」与「外部宏任务是否真的推进」两类断言）、`GisToExcelExporter.spec.ts` 适配 +「真的让出主线程」1 条。
**反证**：临时还原 `parseKML` 为旧 `forEach` + 每要素同步回调 → `expected 0 to be greater than or equal to 3`（0 次让出）、`expected 1205 to be less than 50`（1205 次同步回调）当场变红；恢复后全绿。

**门禁**：type-check 0 / oxlint 0·0 / eslint 0 / prettier 全符合 / vitest 700·52 / `npm run build` 全链路通过。

---

## 三、阶段 2 · 表格链路进度化（提交 `309e6fe` + 评审整改）

**改动**

| 层 | 文件 | 内容 |
|---|---|---|
| 新增 | `src/utils/progress.ts` | 统一 `ProgressCallback`（percent 整数、message 必填） |
| 共用 reader | `utils/TemplateReader.ts` | `readAndValidateTemplate` 的 options 增 `onProgress?`；`readTemplate(file, onProgress?)`；行循环每 500 行让出 + 1% 粒度上报；`XLSX.read`/`sheet_to_json` 前让出一帧 |
| 共用 exporter | `utils/TemplateExporter.ts` | `generateXlsx(headers, dataRows?, sheetName?, onProgress?)` 改 async（边框循环每 5000 单元格让出 + 上报 30→90，`XLSX.write` 前上报 95 并让出）；`exportTemplate`/`exportData`/`exportTable`/`downloadXlsxTemplate` 改 async 并透传 `onProgress` |
| 整形 | `distance_sensor/templateRows.ts` | `aoaToTemplateRows` 改 async + `onProgress?` + 分片让出 |
| 包装 reader | `coords_convert/templateReader.ts`、`table2kml_point/TemplateValidator.ts`、`table2kml_basestation/TemplateReader.ts` | 各增可选 `onProgress?` 并转发 |
| 自建 reader | `get_add`、`get_lonlat`、`elevations_batch` 的 `TemplateReader.ts` | 改 async + `onProgress?` + 分片让出 |
| 类型收敛 | `geoDataService.ts`、`DistanceCalculator.ts`、`geoAnalysisService.ts` | 3 处重复的进度回调定义改为指向 `utils/progress`（审计 P3-4 同类收敛） |
| 页面 | `coords_convert`、`table2kml_point`、`table2kml_basestation`、`elevations_convert`、`elevations_batch`、`GeocodeCommon.vue`、`distance_sensor` | 统一接 `ProgressModal` + `useProgressTimer`，导入/导出进度接到上传/下载入口（`get_add`/`get_lonlat` 是 GeocodeCommon 的壳，随其覆盖） |

**测试**：+13（702 → 715 / 52 files）。核心是 `utils/__tests__/TemplateReader.spec.ts` 的「全坏行时仍让出」（反证点）与 `utils/__tests__/TemplateExporter.spec.ts` 的「不推进定时器就不 resolve / 大表 ≥3 次让出 / onProgress 0→100」。
**反证**：把 `TemplateReader` 的让出从循环**开头**挪到**结尾** → 「全坏行仍让出」当场变红（`expected 1 to be greater than or equal to 3`）；恢复后 19/19 绿。
**门禁**：type-check 0 / oxlint 0·0 / eslint 0 / prettier 全符合 / vitest 715·52 / `npx playwright test` **7 passed**（含 `kml-upload` 的上传→进度→下载全链路）/ `npm run build` 全链路通过。

### 计划偏离与理由（评审要求落库追溯）

| # | 偏离 | 理由 |
|---|---|---|
| D-1 | 计划 1.1 要求伪 yield 换为 `setTimeout(r,0)`；实现用 `yieldToUI(200)` | 保留原 200ms 的下载间隔意图（浏览器对连续程序化下载可能丢包），但改为**真 await** —— 既真让出又不回归下载可靠性 |
| D-2 | 计划 2.5 要求 `columnsFromRows` 也加 `onProgress`；**未加** | 它只读第一行的 key（O(1)），没有可分的段，加回调是纯噪音 |
| D-3 | 让出位置计划未指定；实现一律放在**循环开头**（并同步把阶段 1 的 `parseKML`/`parseKMZ` 也移到开头） | 校验失败的行会 `continue`，放在结尾会被整批跳过 —— 一份「全是坏行」的文件就退化成同步阻塞。有反证测试守护 |
| D-4 | 计划 2.1 要求「新增默认 no-op」；最终**未保留** `noopProgress` 常量 | 所有调用点用 `?.()` 已达成「不传则行为不变」；导出一个零引用的常量正是审计 P3「死代码」要清的东西 |
| D-5 | 计划 2.6 要求 8 个页面接进度；审查后**追加**整改（Table2KmlPage 的模板 XLSX 下载补进度、DistanceSensorPage 匹配中禁用模板下载防双弹窗遮挡、3 页在页内 `XLSX.read` 前先让出画出文案） | 首轮实现遗漏/新引入的 UX 问题 |

### 阶段 2 评审裁定的已知残差（未达标之处，如实记录）

1. **页内 XLSX 解析仍是不可中断同步块**：`ElevationsBatchPage` / `GeocodeCommon` / `DistanceSensorPage` 自己在页面里调 `XLSX.read + sheet_to_json`，进度会在这段时间**停在 10%**（整改后至少能看到「正在解析表格...」文案，但确实不动）。计划阶段 2 的验收句「0→100 连续前进」在这三页的**导入**上并未完全达成 —— 根治在阶段 4（Worker）。
2. **50%→70% 段同理**：`parseKML`/`parseKMZ` 的 `DOMParser + toGeoJSON` 是单一不可中断同步块，阶段 1 只能保证「先画出 50%/80%」。
3. **Safari 的跨任务下载**未实测：首份下载仍保留在点击任务内（已缓解），但多文件连续下载跨任务边界在 Safari 上历史上有拦截行为，建议后续补一条 e2e 或手工验证。
4. `utils/index.ts`（barrel）把这些函数静默改为 async 返回 Promise；当前全仓 `from '@/utils'` **零引用**，无实际消费者，但属公开面变更。

---

## 四、阶段 3 · exceljs 迁移（2026-10-12）

**新共享管线**：`src/utils/exceljsPipeline.ts`
- `writeXlsx(sheets, onProgress?): Promise<Blob>`；`SheetSpec { name, headers, rows?, colWidths?, border?, defaultColWidths? }`
- 让出粒度：逐行每 2000 行、边框每 200 行；进度 0→99 → 95 → 100
- 列宽补偿 `EXCELJS_WIDTH_OFFSET = 0.83`（exceljs 写出的列宽比传入值固定小 0.83，实测 8→7.17、12.5→11.67）
- `collectHeaders` / `rowsFromObjects`（对齐 `json_to_sheet` 的键并集语义）、`safeSheetName`（OOXML 非法字符/31 字上限）

**迁移的 4 处**：`utils/TemplateExporter.generateXlsx`（−90 行）、`coords_convert/coordsConversion.convertToXlsx`、`gis2excel/GisToExcelExporter.exportToXlsx/exportSingleTypeToXlsx`（抽出 `toSheetSpec` 去重）、`geo_data/geoDataService.exportToXLSX`（下载方式统一为 `exportToCSV` 同款 `<a download>`）。四处调用方均已 `await`。

**计划偏离（阶段 3）**

| # | 偏离 | 理由 |
|---|---|---|
| D-6 | 计划要求「exceljs streaming writer（逐行 addRow + commit）」 | 实测 exceljs@4.4.0 的浏览器 bundle（`dist/exceljs.min.js`，947 KB）**不含 WorkbookWriter**（只存在于 Node 的 `lib/stream/…`）。改用非流式 `Workbook` + 逐行 `addRow` 分片让出 + `xlsx.writeBuffer()`，与 `useTemplateExport.ts` 已验证的路径一致 |
| D-7 | 新建共享管线文件，而不是在 4 处各写一遍 exceljs 代码 | P3-4「同一逻辑复制 N 份」的教训；同时让产物一致性断言只需一处 |

**⚠ 迁移中发现的既有死代码：旧实现的边框从未真正生效（经决策，本次保持关闭）**
排查中期发现：旧实现的「为有内容的单元格添加边框」是**死代码**——xlsx@0.18.5 会把单元格样式整体丢弃：`<borders count="1">` 里只有一个空 `<border>`，`sheetData` 的单元格不带 `s=`；连官方 `add_style` 与 fill 同样落不了盘（有实测探针留档）。因此迁移前导出的文件**从来没有边框**。

性能实测进一步表明：在 exceljs 里打开边框会让 5万×9 的总耗时从 1987ms 涨到 2967ms（+50%，1987ms 与旧 xlsx 的 1926ms 基本持平——差距几乎全部来自边框）。

**用户决策（2026-10-12）：保留 exceljs 管线、生产路径关闭边框。** 即产物与旧实现零差异（含"本来就没有边框"这件事），总耗时与迁移前持平；管线的 `border` 能力保留为 opt-in 并有专项用例，确认要修这个老 bug 时把 `toSheetSpec`/`generateXlsx` 里改成 `border: true` 即可（相关断言会提醒同步预期）。

**遗留立项建议**：「Toolroom 的 xlsx 导出没有边框」是代码意图与产物不一致的老 bug，修不修、何时修由产品决定。

**已知残差（已显式钉住，非静默）**
- `geo_data` 某类型 `data: []` 时：旧实现读回 `[]`，新实现读回 `[['']]`（sheet 维度导致的一个零单元格空行；Excel 里都渲染成空表，无列宽无边框）。已写成显式断言。
- 空结果集：旧实现 `XLSX.writeFile` 抛 `Workbook is empty`（页面弹错），新实现写出合法空工作簿。已记档并断言。
- `XLSX.write` 的最大连续阻塞换成了 exceljs `writeBuffer`（仍是单一同步块），主线程最长阻塞**降低但未消除**——根治在阶段 4。
- `gis2excel` 的下载按钮仍未接进度弹窗（该页只有"转换中"的既有进度区）；`utils/index.ts` barrel 里这些函数已静默变 async（当前全仓零引用）。

**测试**（+21，715 → 736 / 52 → 54 files）
- `utils/__tests__/exceljsPipeline.spec.ts`（新建，10）：黄金参考 `legacyXlsx()` 内联，比对**表名/逐格值/列宽**；列宽 0.83 映射；边框用 exceljs 读回；进度与让出。
- `utils/__tests__/TemplateExporter.spec.ts`：29（原有 22 适配 async；新增「不推进定时器就不 resolve」「5000 行 ≥4 次让出」「onProgress 0→100」）。
- `coords_convert/__tests__/coordsConversion.spec.ts` +2 产物比对（9 列×3 行 + 10 列×4 行 fixture；做了 3 次变异验证）。
- `gis2excel/__tests__/GisToExcelExporter.spec.ts` +4 产物比对（多类型/空分组/超长阈值；阈值 8→14 变异即红）。
- `geo_data/__tests__/exportXlsxParity.spec.ts`（新建，4）：键不一致的并集顺序、空 data、空结果集、无列宽无边框；3 次变异验证。

**测试基建踩坑（已修复，复跑 3 次全量确认稳定）**：exceljs 是**懒加载**的，而 vitest 的 fake timers 会让首次 `await import('exceljs')` 永不 settle（探针实测：不推定时器、`vi.getTimerCount()` 为 0）。解法：在装 fake timers 的 spec 顶部预载 `await import('exceljs')`（`TemplateExporter.spec.ts`、`coordsConversion.spec.ts`、`GisToExcelExporter.spec.ts`；`exportXlsxParity.spec.ts` 用了静态 import 天然免疫）。另：大表用例改用真实计时器（fake timers 下 writeBuffer 内部推进成本很高）。

**门禁**：type-check 0 / oxlint 0·0 / eslint 0 / prettier 全符合 / vitest **739 passed·54 files** / `npm run build` 全链路通过 / `npx playwright test` **7 passed**。

**关掉边框后的最终状态（用户决策后）**：`TemplateExporter.generateXlsx` 与 `GisToExcelExporter.toSheetSpec` 的 `border` 均为 `false`；`coords_convert.convertToXlsx` 与 `geo_data.exportToXLSX` 本来就不设边框。管线 `writeXlsx(sheets, onProgress)` 的 `border` 仍可用，`utils/__tests__/exceljsPipeline.spec.ts` 有 opt-in 专项用例；生产路径无边框已由 gis2excel / exceljsPipeline 两个 spec 的断言钉住（改成 `true` 会红）。

### 评审整改（阶段 3）

| # | 评审发现 | 处理 |
|---|---|---|
| M2 | geo_data 下载换了 `<a download>` 但丢了 `appendChild`、`revokeObjectURL` 立即执行、以及 `XLSX.writeFile` 原有的 saveAs 对话框 | 新增 `downloadXlsxBlob`（appendChild + 延迟 100ms revoke），统一收口仓库里 3 份逐字节等价的 `triggerDownload`；saveAs 差异记入残差 |
| M3 | 多 sheet 时进度会倒退（4 个 sheet 时 `sheetBase=round(i/4*90)` 得到 0/23/45/68，而 span=round(90/4)=23，于是 sheet1 末尾可到 46、sheet2 却从 45 开始）| 上报统一走单调夹取（含 sheet 开始那次回调）；新增专项用例，反证可复现 `expected 45 to be greater than or equal to 46` |
| 安全 | `safeSheetName` 的注释把两库的校验行为写反了（xlsx 会抛错、exceljs 静默写坏）；两个超长表名截断后同名会写出两张同名表 → Excel 弹"需要修复"并丢表 | 注释纠正 + 同工作簿内重名直接抛错（保持旧实现的响亮失败模式）|
| 精度 | 列宽补偿 0.83 是近似值，XML 里系统性差 0.002 | 改为 `5/6`（由两个库的公式推导：exceljs 原样写 width，SheetJS 写入侧是 `wch + 5/6`），由列宽断言钉住 |
| 体验 | `await import('exceljs')` 发生在第一次让出之前，947 KB chunk 下载+eval 期间进度弹窗不出现 | 先把 `await yieldToUI()` 移到动态 import 之前 |
| 覆盖 | 多 sheet 进度单调性、稀疏行无断言 | 各补 1 条用例 |

### 阶段 3 的性能实测：与预期不同，已按数据决策（如实记录）

计划阶段 3 的预期是「主线程最长连续阻塞显著低于阶段 2」。实测（Node 侧基准，与浏览器相对趋势一致；探针已删除，方法可复现）：

| 规模 | 旧（xlsx aoa_to_sheet+write，无让出） | exceljs 关边框 | exceljs 开边框 |
|---|---|---|---|
| 2 万行 × 6 列 | 485ms 单次连续块 | 820ms（其中 writeBuffer 772ms 单一连续块） | 约 +50% |
| 5 万行 × 9 列 | 1926ms 单次连续块 | 1987ms（≈持平） | 2967ms（+50%） |

**结论：最长连续阻塞并没有变短**（旧是一次性 1926ms，新是 addRow 129ms + 边框 29ms 可分片让出 + **writeBuffer 2774ms 单一连续块**）；而**总耗时差距几乎全部来自边框**（关掉边框后与旧实现持平）。

换言之：阶段 3 实际交付的是统一的 exceljs 管线 + 逐格一致性（已证明）+ 可分片的 addRow/边框阶段；"降低阻塞"要靠**阶段 4（Worker）**——而在 Worker 里只有总耗时重要，因此按上面的数据把边框关掉。

补充：`addRow` 阶段（129ms / 5万行）虽然只占总耗时 6%，却是**唯一能被打断**的部分；`writeBuffer` 仍是单一同步块，彻底消除要等 Worker。

---

## 五、阶段 4 · Worker 化（待实施）

---

## 六、本批次期间新发现、未修的问题（超出 C4 范围，建议单独立项）

- **`geoDataService.parseKMZ` 的 `<MultiGeometry>` 静默丢弃**：`parseKMZ` 的要素转换仍是旧的 `switch` + `default: continue`，没有阶段 2 为 `parseKML` 补的 `flattenGeometry`。KML 的 `<MultiGeometry>` 经 togeojson 变成 `GeometryCollection` → 整块被丢弃。与已修的 P0-4 是**同一类静默数据丢失**（KML 已修、KMZ 未修）。建议作为 P0-4 补立项。
- `geoDataService` 的要素持有原始 GeoJSON 对象的强引用（`feature` 字段），大文件下内存放大；阶段 4 Worker 化时一并评估。
