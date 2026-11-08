# 2026-11-08 · D4 拆分超大文件（第二批：KmlViewerPage / GeocodeCommon）· 实施记录

> **依据**：审计 [`2026-10-09-audit-04-P3-cleanup.md`](./2026-10-09-audit-04-P3-cleanup.md) 的 **P3-5**（超大文件与结构腐化）
> **台账**：[`../plan/2026-10-11-progress-ledger.md`](../plan/2026-10-11-progress-ledger.md) **D 档 D4**
> **前置**：[`2026-10-16-d4-fix-record-gantt.md`](./2026-10-16-d4-fix-record-gantt.md)（第一批：GanttChartPage）
> **提交**：`c66de9c`
> **状态**：**D4 全部完成**（Gantt + KmlViewer + GeocodeCommon）
> **测试**：887 → **948 passed / 75 files**（新增 61 条）

---

## 一、总览

| 文件 | 行数 | 拆分后 | 抽出内容 |
|---|---|---|---|
| `src/tools/kml_viewer/KmlViewerPage.vue` | 1389 | **540** | 5 个纯模块 + 1 个组合式 + 2 个 UI 子组件 |
| `src/components/common/GeocodeCommon.vue` | 1144 | **148** | 4 个纯模块/组合式 + 5 个步骤子组件 |

两页均降到 600 行以下；最大的新文件是 `useGeocodeWorkflow.ts`（397 行），没有再出现「换个名字继续堆」的情况。

---

## 二、KmlViewerPage.vue（1389 → 540）

### 1. 纯逻辑模块

| 新文件 | 行数 | 职责 |
|---|---|---|
| `kmlStyle.ts` | 88 | `parseKmlStyles` / `parseKmlColorEl` / `kmlColorToHex`（Style / StyleMap / AABBGGRR） |
| `kmlPlacemark.ts` | 99 | 几何类型判定、名称/描述/颜色元数据、`<coordinates>` / Track 坐标解析 |
| `kmlLayerBuilder.ts` | 214 | Placemark → Leaflet 图层、递归建树、bounds 传播、图层挂载 |
| `kmlMarkerIcon.ts` | 33 | Google 风格彩色图钉生成与按颜色缓存 |
| `kmlMeasureMath.ts` | 50 | 测角、鞋带公式面积、长度/面积格式化 |

### 2. 有状态逻辑

| 新文件 | 行数 | 职责 |
|---|---|---|
| `useKmlMeasure.ts` | 285 | 测距/测面积/测角/采点的状态、图层、事件监听、结果与复制 |

### 3. UI 子组件

| 新文件 | 行数 | 职责 |
|---|---|---|
| `KmlSidebar.vue` | 138 | 天地图 Key、底图选择、KML 上传、图层树 |
| `KmlMapToolbar.vue` | 174 | 全屏/缩放按钮、测量工具条、结果与采集坐标浮层 |

页面只保留：地图初始化、瓦片图层、文件读取入口、图层树节点操作、生命周期与错误对话框。

---

## 三、GeocodeCommon.vue（1144 → 148）

### 1. 纯模块 / 组合式

| 新文件 | 行数 | 职责 |
|---|---|---|
| `geocode/geocodeParsing.ts` | 58 | CSV 解析（引号、BOM、空值保持空串） |
| `geocode/geocodeFields.ts` | 55 | 字段中文名与 add/lonlat 两种取值 |
| `geocode/geocodeTypes.ts` | 12 | `GeocodeMode` / 查询结果 / 校验结果联合类型 |
| `geocode/useGeocodeWorkflow.ts` | 397 | 模板下载、导入校验、API Key 校验、批量查询、结果导出、进度与错误弹窗 |

### 2. 步骤子组件

| 新文件 | 行数 | 职责 |
|---|---|---|
| `GeocodeTemplatePanel.vue` | 54 | 第 1 步：下载模板 |
| `GeocodeApiKeyPanel.vue` | 145 | 第 2 步：API Key 增删改与校验触发 |
| `GeocodeQueryOptionsPanel.vue` | 218 | 第 3 步：延迟/随机延迟/混合模式/区域约束 |
| `GeocodeFieldPicker.vue` | 48 | 第 4 步：输出字段选择 |
| `GeocodeUploadPanel.vue` | 148 | 第 5 步：上传、执行、下载、清除、查询进度 |
| `GeocodeResultsTable.vue` | 116 | 校验结果与查询结果预览（最多 20 行） |

---

## 四、测试与验证

### 新增测试（61 条）

| 文件 | 覆盖点 |
|---|---|
| `kmlStyle.spec.ts` | 颜色转换、Style 优先级、StyleMap |
| `kmlPlacemark.spec.ts` | 几何类型、内联/引用颜色、coordinates、Track 过滤 |
| `kmlLayerBuilder.spec.ts` | 点/线/面/轨迹/多几何建层、建树挂载、popup 清洗 |
| `kmlMeasureMath.spec.ts` | 测角、面积、长度/面积格式化 |
| `KmlViewerPage.spec.ts` | 追加侧栏天地图 Key 的 v-model 回写 |
| `geocodeParsing.spec.ts` | CSV 引号/空值/数字转换（P0-1 回归） |
| `geocodeFields.spec.ts` | 两种模式的字段名与取值 |
| `GeocodeResultsTable.spec.ts` | 校验提示、20 行截断、区域标红 |
| `GeocodeCommon.spec.ts` | 五步标题渲染、add/lonlat 模式差异 |

### 门禁

| 检查 | 结果 |
|---|---|
| `npm run type-check` | ✅ 0 错误 |
| `npx oxlint src/tools/kml_viewer src/components/common/geocode` | ✅ 0 / 0 |
| `npx eslint ...`（同上范围） | ✅ 0 |
| `prettier --check`（同上范围） | ✅ 全部符合 |
| `npx vitest run` | ✅ **948 passed / 75 files** |
| `npm run build-only` | ✅ 成功 |

---

## 五、关键决策与踩坑

1. **纯逻辑与 Leaflet 解耦**：样式、Placemark 元数据、测量数学都做成不依赖 Leaflet 的模块，测试可以直接用 `DOMParser`；图层创建单独放 `kmlLayerBuilder.ts`，用注入的图标工厂单测。
2. **`buildKmlTree` 保持原语义**：递归 Folder/Document、挂载图层、bounds 向上传播；MultiGeometry 仍取第一个能创建的子几何。原实现里一个未使用的 `wrapper` 和重复 `cloneNode` 一并删掉，不影响结果。
3. **测量 composable 由页面注入 `getMap`**：避免把 `map` 变成模块级单例；卸载时页面仍调用 `cleanupDrawListeners()` 再 `map.remove()`，B3 监听器配对测试不改。
4. **取消导入要同时清原生 input**：拆出 `GeocodeUploadPanel` 后 input 在子组件里，`cancelImport` / `clearUploadFile` / `clearAll` 由页面统一包一层，既清校验结果也清文件名。这是拆分时最容易漏的行为。
5. **`v-model:tianditu-key` 的 kebab 参数**：补了一条页面级测试，确认子组件 emit `update:tiandituKey` 能回写到页面 ref，避免只靠类型检查。
6. **子组件直接读写 geocode store**：第 2~4 步面板是页面专属组件，继续沿用原来的单一数据源（Pinia store），没有引入第二套 props/emit 状态镜像。

---

## 六、遗留

- KML 查看器的地图交互（加载 KML、图层树开关、测量、采点）仍以组件挂载测试 + 纯函数测试覆盖，**没有新增 Playwright e2e**；仓库目前没有该页的 e2e 先例。
- `GeocodeCommon` 的页内 `XLSX.read + sheet_to_json` 仍是同步块（台账 **F3**），本次只做结构拆分，不改解析链路。
- 地址查询/经纬度查询的真实 API 调用仍依赖手动配置 Key，测试只覆盖纯逻辑与渲染，不发真实请求。

---

*上一批：[D4 第一批 · GanttChartPage](./2026-10-16-d4-fix-record-gantt.md) · 台账：[`../plan/2026-10-11-progress-ledger.md`](../plan/2026-10-11-progress-ledger.md)*
