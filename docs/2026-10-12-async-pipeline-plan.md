# 专项计划：文件处理链路异步化与进度化（C4 / P2-20）

> **排查日期**：2026-10-12
> **排查方式**：逐文件读代码 + 全量 grep 核对（非仅凭审计报告）
> **前置批次**：阶段 0/1/2、A 档、B 档、C 档 C1~C3 已完成
> **评审基线**：`1f53c9d`（C3 完成） / 台账 HEAD `9d40c84`

---

## 一、一句话结论

**问题不是"没有进度条"，而是"没有让出主线程"。** 进度条大部分已经有了，缺的是 yield/Worker。
按「是否让出主线程」这个标准重新切分，链路是三段，其中两段不及格，且已跑起来那段里还有**假进度**。

---

## 二、排查全景（按链路三段）

### 2.1 导入（读取）段

| 入口 | 位置 | async 签名 | 让出主线程 | 进度 | 说明 |
|---|---|---|---|---|---|
| `utils/TemplateReader.readAndValidateTemplate` | `:56-134` | async，**函数体全同步** | ❌ | ❌ | `file.arrayBuffer` → `XLSX.read` → `sheet_to_json` → **逐行校验循环**。**7+ 工具共用的表格入口** |
| `utils/TemplateReader.readTemplate` | `:157-193` | async，同步体 | ❌ | ❌ | 上面的无校验版 |
| `utils/templateHandler.readAndValidateTemplate(rows,…)` | `:118-224` | 同步 | ❌ | ❌ | 拿到 rows 之后的第二段逐行校验 |
| `utils/CsvParser.parseCSV` | `:40-99` | 同步 | ❌ | ❌ | 量级小，风险低（见 §七） |
| `distance_sensor/templateRows.aoaToTemplateRows` | `:32-53` | 同步 | ❌ | ❌ | C1 新增的行对象构造 |
| `coords_convert/templateReader.readAndValidateCoordTemplate` | `:24-66` | async，同步体 | ❌ | ❌ | 包共用 reader |
| `table2kml_point/TemplateValidator.readAndValidateKmlTemplate` | `:29-58` | async，同步体 | ❌ | ❌ | 同上 |
| `table2kml_basestation/TemplateReader.readAndValidateBasestationTemplate` | `:149-190` | async，同步体 | ❌ | ❌ | 同上 |
| `get_add` / `get_lonlat` / `elevations_batch` 的 `TemplateReader.readAndValidateTemplate` | 各 `:9` / `:56` / `:7` | 同步 | ❌ | ❌ | 收 rows 后逐行校验 |
| `gis2excel/GisFileReader.readAndValidateGisFile` | `:277-` | async，**有真 await**（`arrayBuffer`/JSZip/shpjs） | ❌ | ❌ | KML 走 `DOMParser`（同步）、SHP 走 shpjs（Promise 但内部 CPU 同步） |
| `gis2excel/GisFileReader.parseKmlXml` | `:26-140` | 同步 | ❌ | ❌ | `DOMParser` + 全量遍历 |
| `gis2excel/GisToExcelPage.vue` | `:584` | — | ❌ | ❌ | 页内自己 `XLSX.read`，绕过共用 reader |
| `shp2excel/ShpFileReader.readAndValidateShpFiles` | `:26-68` | async，同步体 | ❌ | ❌ | 多文件合并 |

### 2.2 处理段（**这一段是合格的**）

| 入口 | 位置 | 让出主线程 | 进度 |
|---|---|---|---|
| `geo_data/geoAnalysisService.analyzePoints/Lines/Polygons/…` ×9 | `:54-630` | ✅ 每条后 `await new Promise(r=>setTimeout(r,0))` | ✅ `onProgress` |
| `geo_data/geoDataService.performAnalysis` | `:487-530` | ✅ 每个 type 之间 | ✅ |
| `coords_convert/coordsConversion.batchConvertCoordinates` | `:81-269` | ✅ 逐行 `delay(0)` | ✅ `onProgress` |
| `elevations_batch/ElevationsBatchPage` 查询循环 | `:517` | ✅ 逐条 delay（含限速） | ✅ |
| `utils/DistanceCalculator.matchDistances` | `:584-` | ✅ | ✅ |
| `utils/GeocodeBatchService.batchGeocodeQuery` | `:28-` | ✅ | — （外部请求为主） |
| `get_add` / `get_lonlat` `ApiService.batchQuery*` | `:76` / `:114` | ✅ | — |
| `template_export/useTemplateExport` 渲染循环 | `:578-690` | ✅ 逐份 50~500 ms | ✅ 文字进度 |

### 2.3 导出段

| 入口 | 位置 | 让出主线程 | 进度 | 说明 |
|---|---|---|---|---|
| `utils/TemplateExporter.generateXlsx` | `:47-98` | ❌ | ❌ | `aoa_to_sheet` + **逐格 border 遍历** + `XLSX.write` |
| `utils/TemplateExporter.generateCsv` | `:25-37` | ❌ | ❌ | `map+join`，量级较小 |
| `utils/TemplateExporter.exportData` / `exportTable` / `exportTemplate` | `:170-207` | ❌ | ❌ | 调上面两个 |
| `gis2excel/GisToExcelExporter.exportToXlsx` | `:154-222` | ❌ | ❌ | 逐组 `aoa_to_sheet` + border + `write` |
| `gis2excel/GisToExcelExporter.exportSeparateFiles` | `:132-152` | ❌ **伪 yield** | ❌ | `setTimeout(() => {}, 200)`：**未 await、空函数体 → 完全无效** |
| `coords_convert/coordsConversion.convertToXlsx` | `:307-343` | ❌ | ❌ | `XLSX.write` |
| `geo_data/geoDataService.exportToXLSX` | `:974-986` | ❌ | ❌ | `XLSX.writeFile` |
| `geo_data/geoDataService.exportToCSV` | `:991-1015` | ❌ | ❌ | 逐 sheet `sheet_to_csv` + 逐个 `click` |
| `shp2kml/ShpToKmlGenerator.generateKml` | `:164-222` | ❌ | ❌ | entries × features 双层循环拼字符串 |
| `utils/KmlGenerator.generateKml` | `:211-337` | ❌ | ❌ | sectors 循环 |
| `table2kml_point/KmlGenerator.generateKml` | `:122-180` | ❌ | ❌ | points 循环 |
| `amapService` / `get_add` / `get_lonlat` 的 `exportResultsToRows` | `:198` / `:154` / `:218` | ❌ | — | 仅拼字符串，轻量，**不在本次范围**（见 §七） |

---

## 三、三个已确认的具体缺陷（本次排查新发现，审计未列）

### 缺陷 A：伪 yield —— `GisToExcelExporter.exportSeparateFiles:150`

```ts
groupedFeatures.forEach((features) => {
  …
  exportSingleTypeToXlsx(features, type, filename, options)
  …
  setTimeout(() => {}, 200)   // ← 未 await、空函数体、在 forEach 里
})
```

这不是 yield：没有 `await`、回调是空的、外层是同步 `forEach`。**留着一个骗人的 yield 比没有更糟** —— 后人会以为这里已经让出过了。

### 缺陷 B：假进度 —— `geoDataService.parseKML:328`

```ts
onProgress?.(70, '正在处理要素...')
geojson.features.forEach((feature, index) => {
  …
  onProgress?.(70 + (index / geojson.features.length) * 30, `正在处理要素: ${name}`)
})
onProgress?.(100, '解析完成')
```

`forEach` 内无 `await`。`onProgress` 被同步调用几千次，Vue 一次都重绘不了。
**用户看到进度条死在 70%，直到整个循环跑完，然后一把跳 100%。**
50% 的 `togeojson` 转换、30% 的 `DOMParser` 同理。`parseKMZ:379` 同样。

### 缺陷 C：`await` 被误当成"不阻塞"

`useTemplateExport.ts:631` 的 `await workbook.xlsx.writeBuffer()`（exceljs）与 `XLSX.write`
的差别只是前者返回 Promise —— 序列化仍在主线程跑，页面一样冻结。
**exceljs 的 streaming writer 才是真流式**，这是阶段 3 的目标。

---

## 四、四阶段实施计划

### 阶段 1 · 止血（0.5 天）

**目标**：让已有的进度条不说谎；拆掉伪 yield。

| # | 改动 | 文件 |
|---|---|---|
| 1.1 | `exportSeparateFiles` 的 `forEach` → `for...of`，`setTimeout(()=>{},200)` → `await new Promise(r=>setTimeout(r,0))`；函数签名改 `async`，调用方同步适配 | `gis2excel/GisToExcelExporter.ts` |
| 1.2 | `parseKML` 的 `forEach` → `for...of` + `await yieldToUI()` | `geo_data/geoDataService.ts:328` |
| 1.3 | `parseKMZ` 同上（解压后的循环） | `geo_data/geoDataService.ts:379-486` |
| 1.4 | 新增 `src/utils/yieldToUI.ts`：统一导出 `yieldToUI(ms=0)`，加注释说清"`await` ≠ 不阻塞" | 新增 |

**验收**：GeoDataPage 解析 5 万要素，进度条逐 1% 前进，不停在 70%；期间按钮可点。
**风险**：低。只改循环形式，不改数据处理逻辑。

---

### 阶段 2 · 表格链路进度化（1–2 天）

**目标**：给共用表格 reader/exporter 加 `onProgress` + 分片 yield，让 7 个工具的导入导出都有进度。

| # | 改动 | 文件 |
|---|---|---|
| 2.1 | 新增 `ProgressCallback` 类型与默认 no-op；`readAndValidateTemplate` / `readTemplate` 增加可选 `onProgress?: ProgressCallback` 参数（**默认不传，行为不变**） | `utils/TemplateReader.ts` |
| 2.2 | 逐行校验循环 `:101-134` 改为每 500 行 `await yieldToUI()` + 上报 0→100 | 同上 |
| 2.3 | `generateXlsx` 的逐格 border 循环 `:75-85` 改为可分批 yield；`XLSX.write` 前上报"正在生成文件" | `utils/TemplateExporter.ts` |
| 2.4 | `exportData` 增加 `onProgress` 透传 | 同上 |
| 2.5 | `aoaToTemplateRows` / `columnsFromRows` 增加 `onProgress` 可选参数 | `distance_sensor/templateRows.ts` |
| 2.6 | 8 个 page 接入 `ProgressModal` + `useProgressTimer`，把进度接到上传/下载按钮上 | `distance_sensor/`、`coords_convert/`、`table2kml_point/`、`table2kml_basestation/`、`elevations_batch/`、`get_add/`、`get_lonlat/`、`components/common/GeocodeCommon.vue` |

**验收**：5 万行 XLSX 导入，进度条 0→100 连续前进，且每个 yield 点之间页面可交互。
**风险**：中。`TemplateReader` 是共用入口，参数加可选值保持向后兼容；但需跑全量单测
（现有 693 个，含 7 个工具的 TemplateReader spec）。

---

### 阶段 3 · 重库替换为 streaming writer（1–2 天）

**目标**：消除 `XLSX.write` 的一次性全量序列化。exceljs 已在依赖、且 B4 已把它拆成懒加载 chunk，
`useTemplateExport` 也已在用 `writeBuffer`，迁移路径已验证过。

| # | 改动 | 文件 |
|---|---|---|
| 3.1 | `generateXlsx` 改用 exceljs streaming writer（逐行 `addRow` + `commit`） | `utils/TemplateExporter.ts` |
| 3.2 | `convertToXlsx` 同样替换 | `coords_convert/coordsConversion.ts` |
| 3.3 | `exportToXlsx` / `exportSingleTypeToXlsx` 同样替换 | `gis2excel/GisToExcelExporter.ts` |
| 3.4 | `exportToXLSX` 同样替换（`json_to_sheet` + `writeFile` → streaming） | `geo_data/geoDataService.ts` |

**验收**：5 万行导出的主线程最长连续阻塞显著低于阶段 2；产物与阶段 2 结果**逐格一致**（需写比对断言）。
**风险**：**高**。`xlsx` 与 `exceljs` 的样式 / 列宽 / 数字格式 API 不同，border 与 `!cols` 需逐项重写；
cell 级视觉回归只能靠产物比对，不能靠肉眼看。

---

### 阶段 4 · Worker 化（2–3 天，根治）

**目标**：解析与生成移出主线程，达成审计验收"阻塞 < 2s"。

| # | 改动 |
|---|---|
| 4.1 | 新增 `src/workers/filePipeline.worker.ts`：承接 `TemplateReader` 的解析 + `TemplateExporter` 的生成 |
| 4.2 | 用 `new Worker(new URL('./filePipeline.worker.ts', import.meta.url), { type: 'module' })`；注意 Vite 需能静态分析该 URL |
| 4.3 | 消息协议：`{ kind:'read' } \| { kind:'write' }` → 请求；`{ progress }` → 回传；`{ ok, result } \| { error }` → 结束 |
| 4.4 | `File` / `ArrayBuffer` / `Blob` 走结构化克隆，零拷贝；大 `Blob` 结果回传主线程 |
| 4.5 | 进度接现有 `ProgressModal` + `useProgressTimer`（已存在，勿重造） |
| 4.6 | 降级：`typeof Worker === 'undefined'` 或构造抛错时，退回阶段 2 的主线程路径 |
| 4.7 | `abortSignal` 贯通到 Worker（`worker.terminate()`），复用 B2 已建的取消模型 |

**验收**：5 万行导入/导出，主线程最长阻塞 < 2s（即消息构造 + 结构化克隆的时间）。
**风险**：高。Worker 内 `import('xlsx')` 的打包、`type:'module'` 的浏览器兼容、以及
降级路径的测试覆盖都需要单独验证。

---

## 五、与 D1 的耦合关系（**必须先读**）

阶段 2/3/4 要动的 `utils/TemplateReader.ts` 与 `utils/TemplateExporter.ts`，
正是 **D1**（7 份 `TemplateReader` → 参数化工厂，−800 行）要重构的文件。

- 若**先做 D1**：阶段 2/4 只需改一份实现，7 个工具的接入自动继承。
- 若**先做 C4**：要么改 7 遍，要么改完再被 D1 返工一遍。

**建议顺序：D1 → C4 阶段 1 → C4 阶段 2 → C4 阶段 3 → C4 阶段 4。**
阶段 1 与 D1 无重叠，可立即先做。

---

## 六、验收标准（汇总）

| 标准 | 对应阶段 | 可否自动化 |
|---|---|---|
| 5 万行 XLSX 导入，进度条 0→100 连续前进且每步之间可交互 | 1、2 | ✅ 见下方"指标 1" |
| 5 万行导入/导出主线程最长阻塞 < 2s | 4 | ⚠️ 需浏览器 Performance 录制 |
| 产物与现状逐格一致（阶段 3 迁移） | 3 | ✅ 写产物比对断言 |
| 超阈值有明确提示 | 2 | ✅ 单测 |
| 全量单测不回归 | 全部 | ✅ 现 693 passed / 50 files |

### 指标 1：把"有没有让出主线程"变成可自动化的断言

比起肉眼看进度条，更可靠的度量是**控制权交还事件循环的次数**：

```ts
// 在 5 万行 fixture 下，readAndValidateTemplate 至少 yield N 次
it('5 万行 fixture 下至少 yield 20 次', async () => {
  vi.useFakeTimers()
  let yields = 0
  const p = readAndValidateTemplate(file, headers, { onProgress: () => {} })
  // 用可注入的 yield 实现计数
  …
  expect(yields).toBeGreaterThanOrEqual(20)
})
```

配合 `performance.now()` 记录单次同步连续时长，就能在没有 DevTools 的环境里给出量化验收。

---

## 七、范围内 / 范围外

**范围内**：表格与 GIS 文件的读取、生成、导出的主线程让出与进度。

**范围外（本次明确不做，理由记录在案）**：

1. `CsvParser.parseCSV` —— CSV 解析成本远低于 XLSX/SHP，且 CSV 通常不做 5 万行级别。
   若后续成为热点，用同一套 `onProgress` 参数扩展即可。
2. `amapService` / `get_add` / `get_lonlat` 的 `exportResultsToRows` —— 只拼字符串，不构造
   workbook，无阻塞风险。
3. SHP 解析内部（shpjs）—— 第三方库，只能整体替换或 Worker 化，无法分块。

---

## 八、风险登记

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | `TemplateReader` 是 7 个工具共用入口，改坏影响面大 | 高 | 参数全部可选、默认行为不变；每步跑全量单测 |
| R2 | exceljs 与 xlsx 样式 API 差异导致产物静默变形 | 高 | 写逐格比对断言，不做肉眼验收 |
| R3 | Worker 的 `type:'module'` 兼容与打包 | 中 | 保留主线程降级路径，并对降级路径写测试 |
| R4 | 加 yield 后大量小任务拖慢整体吞吐 | 中 | yield 粒度按行数分片（500 行）而非逐行 |
| R5 | 进度回调在同步段被高频调用仍不重绘（阶段 2 未覆盖到的路径） | 中 | 用 §六 指标 1 的 yield 计数断言兜底，而非只看进度条 |

---

*本计划为排查结论与实施方案，尚未开始实施。实施记录见 `docs/2026-10-1x-c4-fix-record.md`（实施后创建）。*
