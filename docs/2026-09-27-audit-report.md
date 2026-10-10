# 大龙山工具间 · 代码审计报告

| 项目 | 内容 |
| --- | --- |
| 仓库 | `dls_toolroom` |
| 审计日期 | 2026-09-27 |
| 审计基线 | `e11206a` (fix(home): 首页推荐工具改为随机抽取) |
| 技术栈 | Vue 3.5 · TypeScript 6 · Vite 8 (rolldown) · Tailwind CSS 4 · daisyUI 5 · Pinia 3 |
| 部署 | Vercel 静态托管 + 自建 Django API (`8.137.195.0`) |
| 规模 | 22 个工具 · src 下 ~180 个源文件 · `GanttChartPage.vue` 最大 (52 KB) |

---

## 一、结论摘要

### 1.1 好消息：工具链是干净的

本次审计**先跑通了全量质量门禁**，四项全部通过：

| 检查项 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npm run type-check` | ✅ 0 错误 |
| 单元测试 | `npx vitest run` | ✅ **450 passed / 32 files**，0 失败 |
| Lint | `npx oxlint .` | ✅ 0 warnings, 0 errors（180 files, 116 rules） |
| 生产构建 | `npm run build-only` | ✅ 成功，3.68s |

代码风格统一、注释到位、纯函数抽取有配套单测（`docxTemplateFunctions` / `xlsxTemplateFunctions` / `KmlGenerator` / `DistanceCalculator` 等均有覆盖），近 20 次提交的 commit message 规范清晰。这是一个**维护意识良好**的仓库。

### 1.2 坏消息：绿灯掩盖了真实的功能性 Bug

问题恰恰出在**没有 CI** 上：

```
"build": "run-s build-only prerender"
```

`npm run build` **不跑 type-check、不跑单元测试、不跑 lint**，仓库里也没有 `.github/` 工作流。
这直接解释了为什么 P0-1（一个已注册的工具 100% 崩溃）能一路走到线上——450 个测试全绿，但**没有一个测试覆盖到它**。

### 1.3 问题分布

| 级别 | 数量 | 定义 |
| --- | --- | --- |
| **P0 严重** | 4 | 功能直接不可用 / 安全漏洞 / 静默产出错误数据 |
| **P1 高危** | 12 | 大数据量崩溃、结果错误、内存泄漏、卡死 |
| **P2 中等** | 19 | 首屏性能、构建流程、死代码、重复实现、部署配置 |
| **P3 低** | 20+ | 时区、错误提示缺失、API 健壮性、代码风格 |

> **核心风险**：本项目是**纯前端数据处理工具**，用户拿它的输出去做基站选址、坐标转换、空间分析。
> 因此「静默产出错误数据」比「报错」危险得多——P0-4 和 P1-11 属于这一类。

---

## 二、P0 严重问题（4 项）

### P0-1　XLSX 模板导出工具 100% 崩溃（已注册但完全不可用）

**位置**：`src/tools/template_export/useTemplateExport.ts:517`

```js
const workbook = new (window as any).ExcelJS.Workbook()
```

**问题**：
`exceljs` 是 npm 依赖，由 Vite 正常打包进产物。但代码中**从未 `import ExcelJS`，也从未给 `window.ExcelJS` 赋值**：

- 全仓库 grep `ExcelJS` 仅 3 处命中：上面的使用点、一处 `declare global` 谎言（`useXlsxTemplateExport.ts:15`）、以及类型声明
- `index.html` 中没有 CDN `<script>` 标签
- 没有任何 `window.ExcelJS = ...` 的赋值语句

因此 `window.ExcelJS` 恒为 `undefined`，
执行到 `new undefined.Workbook()` 抛 `TypeError: Cannot read properties of undefined`。

**影响链路**：
`toolData.ts:160` 注册了 `xlsx_template_export` 工具 →
`XlsxTemplateExportPage.vue` 渲染 `<TemplateExportPage format="xlsx" />` →
`useTemplateExport.ts:517` 崩溃 →
被同文件 `:609-613` 的 catch 吞成「渲染失败：…」。

**用户视角**：工具能打开、能上传文件、能识别字段，但**永远无法生成文件**，且错误信息毫无指向性。

**为什么能上线**：
```ts
// useXlsxTemplateExport.ts:13-17 —— 编译器谎言
declare global {
  interface Window {
    ExcelJS: typeof import('exceljs')   // 声称 window 上有这个类型
  }
}
```
`as any` + `declare global` 联手让 `vue-tsc` 完全满意。

**修复**（一行）：
```js
import ExcelJS from 'exceljs'
// ...
const workbook = new ExcelJS.Workbook()
```

---

### P0-2　KML 查看器 / GIS转Excel 丢失全部线、面要素

**位置**：
- `src/tools/kml_viewer/KmlViewerPage.vue:786`
- `src/tools/gis2excel/GisFileReader.ts:52, 59`

```js
const pairs = text.split(/[\s\n]+/).filter(Boolean)
```

**问题**：
KML 的 `<coordinates>` 合法写法是**元组间用空格、元组内用逗号**：

```xml
<coordinates>116.3, 39.9,0 116.4, 40.0,0 116.5, 40.1,0</coordinates>
```

按 `/[\s\n]+/`（纯空白）切分后得到：

```
["116.3,", "39.9,0", "116.4,", "40.0,0", "116.5,", "40.1,0"]
```

后续 `p.split(',')` 后 `parts.length < 2` → 返回 `null` → `parseCoords` 返回 `[]`。

**影响链路（KML 查看器）**：
`createLayerForPlacemark:726` 要求 `latlngs.length > 1` → 返回 `null`
→ `createPlacemarkNode:677` 返回 `null`
→ **该 placemark 被静默丢弃，用户看不到任何错误提示**。

**影响链路（GIS转Excel，更糟）**：
`GisFileReader.ts:59` 的 `filter(s => s.includes(','))` 会保留 `["116.3,", "116.4,"]`
→ 导出的 Excel 单元格里是**字面量垃圾字符串** `"116.3,;116.4,"`，而不是真实坐标。

**影响范围**：
Google Earth、ArcGIS、QGIS 导出的 KML **点能正常显示，线和面 100% 消失**。
KML 正是该工具的核心输入格式，这是最严重的功能性缺陷之一。

**修复方向**：
按元组解析而非按空白切分，例如先按空白分元组、再对每个元组按逗号分字段；
或直接用 `turf` / `DOMParser` + 规范化的坐标解析器替换。

### P0-3　甘特图：导入 JSON 可触发 XSS，并导致标签页永久死循环

**位置**：`src/tools/gantt_chart/GanttChartPage.vue`

#### (a) 反射型 XSS —— 已核对依赖源码确认

`GanttChartPage.vue:613` 与 `:619-625`：
```js
ctx.set_title(t.name)
ctx.set_details(`<div ...><div><b>依赖:</b> ${deps}</div></div>`)
```

已核对 `node_modules/frappe-gantt/dist/frappe-gantt.es.js`：

```js
685:  set_title:    (a) => this.title.innerHTML = a,
687:  set_subtitle: (a) => this.subtitle.innerHTML = a,
689:  set_details:  (a) => this.details.innerHTML = a,
```

而 `importTasks`（`:1403-1423`）对导入的 JSON **没有任何 schema 校验**，
直接把 `store.tasks = data`。因此任务名 / 依赖字段中的 HTML 会被执行。

PoC：一个任务名写 `<img src=x onerror=alert(document.cookie)>` 的 JSON 文件 → 导入即触发。

**附带问题**：`GanttChartPage.vue:614` 把 `t.color` 直接插进 `style` 属性
```js
style="background:${t.color || '#3b82f6'};..."
```
→ 可做 CSS 注入（视觉欺骗、数据外泄探针）。

#### (b) 永久死循环 —— 标签页彻底卡死

`GanttChartPage.vue:1414`：
```js
store.nextTaskId = Math.max(...data.map(t => Number(t.id)), 0) + 1
```

任一任务 `id` 为非数字（如 `"a"`、`null`、缺失）→ `Number()` 得 `NaN`
→ `Math.max(NaN, 0)` 为 `NaN` → `store.nextTaskId = NaN`。

接着 `getNextId()`（`:755-760`）：
```js
while (store.tasks.some(t => t.id === String(store.nextTaskId))) {
  store.nextTaskId++
}
```
`String(NaN)` 是 `"NaN"`（恒定），`NaN++` 仍是 `NaN`
→ 条件一旦命中 `"NaN"` 这个 id，**循环永不退出，主线程永久阻塞，页面无响应**。

#### (c) 调用栈溢出

`Math.max(...arr)` 展开参数。任务数超过约 10 万时抛
`RangeError: Maximum call stack size exceeded`。

**修复方向**：
1. `importTasks` 加 schema 校验（必填字段、类型、`id` 为数字字符串、日期格式合法）
2. `getNextId` 加 `Number.isFinite` 守卫 + 循环上限
3. `Math.max` 改为 `reduce`
4. `set_title` / `set_details` 传入纯文本，或先经 DOMPurify 过滤

---

### P0-4　CSV 空单元格静默变成数字 `0`（静默数据损坏）

> **⚠ 范围修正（2026-10-02）**：初版报告写的是「2 处实现」，**实际是 4 处，
> 且行为互相不一致**。修正过程见文末「附录二」。

**位置**（修正后，共 4 处）：

| # | 实现 | 空单元格变成 | 是否有测试固化 |
| --- | --- | --- | --- |
| ① | `src/utils/CsvParser.ts:86` | `0` | ⚠️ 有，spec 把 `0` 写成了期望 |
| ② | `src/tools/elevations_batch/ElevationsBatchPage.vue:441` | `0` | 无测试 |
| ③ | `src/utils/templateHandler.ts:92`（地址字段） | `0` | ⚠️ 有，spec 把 `0` 写成了期望 |
| ④ | `src/utils/TemplateReader.ts` | `undefined` | spec 期望 `undefined`（**这个是对的**） |

```js
row[header] = isNaN(Number(value)) ? value : Number(value)
```

**问题**：
JS 中 `Number('')` **等于 `0`**，且 `isNaN(0)` 为 `false`。
因此**每一个空白单元格都被写成数字 `0`**，而非空字符串。

**影响链路（距离测算）**：
CSV 中某行经度留空 → 被当作 `0` → 通过范围校验（0 在合法区间内）
→ 与 `(0°N, 0°N)` 处的基站做距离匹配 → 得到一个**看起来合理但完全错误**的匹配结果。

**影响链路（批量高程查询）**：
空白经纬度 → `(0, 0)` 位于几内亚湾 → 请求 Open-Meteo
→ 返回一个**真实的海平面高程值**，用户无从察觉。

**为什么这是 P0**：
本项目的定位是数据处理工具。用户不会怀疑「空白单元格」，
只会信任工具给出的距离/高程数字。**错误比报错危险得多。**

**修复方向**：
```js
const trimmed = value.trim()
row[header] = (trimmed !== '' && !isNaN(Number(trimmed))) ? Number(trimmed) : value
```
更稳妥的做法是默认 `convertNumbers: false`，由调用方按字段显式声明。

### P0 汇总

| 编号 | 问题 | 位置 | 修复成本 |
| --- | --- | --- | --- |
| P0-1 | XLSX 模板导出 100% 崩溃 | `useTemplateExport.ts:517` | **1 行** |
| P0-2 | KML 线/面要素全部丢失 | `KmlViewerPage.vue:786`、`GisFileReader.ts:52,59` | 中（约 30 行） |
| P0-3 | 甘特图 XSS + 永久死循环 | `GanttChartPage.vue:613,755,1414` | 中（约 60 行） |
| P0-4 | CSV 空单元格 → `0` | **4 处实现**（初版误写为 2 处），行为不一致 | **1 行 ×3 + 删 1 份复制品** |

> **P0-1 与 P0-4 合计 3 行代码即可修复**，却是本次审计中投入产出比最高的部分。

---

## 三、P1 高危问题（12 项）

### P1-1　大数据量导出必然崩溃（影响 6+ 个工具）

**位置**：

| 文件 | 行 | 代码 |
| --- | --- | --- |
| `src/utils/TemplateExporter.ts` | 31 | `rows.push(...dataRows)` |
| `src/utils/TemplateExporter.ts` | 56 | `[headers, ...(dataRows \|\| [])]` |
| `src/tools/gis2excel/GisToExcelExporter.ts` | 171-173, 277-279 | `Math.max(...worksheetData.map(...), 30)` |
| `src/tools/gis2excel/GisFileReader.ts` | 263 | `features.push(...shpFeatures)` |
| `src/tools/shp2excel/ShpFileReader.ts` | 43 | `allFeatures.push(...features)` |
| `src/tools/shp2excel/ShpToExcelPage.vue` | 314 | `allFeatures.push(...features)` |

**问题**：展开运算符 `...` 把整个数组作为**函数参数**传入，
受调用栈大小限制（约 10⁵ ~ 10⁶ 元素），超出即 `RangeError: Maximum call stack size exceeded`。

**影响范围**：`TemplateExporter.ts` 是**被 6 个工具共用的导出器**
（距离测算、批量高程、批量坐标转换、表格转KML、GIS转Excel、基站KML）——
而这些**恰恰是为大数据量设计的工具**。

**修复方向**：
```js
for (const row of dataRows) rows.push(row)              // push 循环
const worksheetData = dataRows ? [headers, ...] : [headers]  // 换 concat / AoA 直接构造
Math.max(...arr) → arr.reduce((m, v) => Math.max(m, v), 30)
```

---

### P1-2　空间分析 O(n²) + 每次迭代 `setTimeout(0)` → 实际不可用

**位置**：`src/tools/geo_data/geoAnalysisService.ts:159, 206, 253, 302, 350, 410`

6 个两两配对分析函数，**内层循环的每一次迭代**都：
```js
await new Promise(r => setTimeout(r, 0))
```

同时 `GeoDataPage.vue:522-529` 的 `autoSelectAnalysisTypes`（在 `:459` 被调用）
**默认勾选全部可用分析类型**，点击「开始分析」时 6 种分析背靠背连续执行。

**耗时估算**：
嵌套 `setTimeout` 被浏览器钳制为 **≥ 1ms**（HTML spec），
因此 1000 个点的 `point_to_point` 分析 = `499,500` 次定时器往返 ≈ **8.3 分钟**；
再加上 `point_to_line` / `line_to_line` / `polygon_to_polygon` 等。

5000 点 = 1250 万次迭代 ≈ **数天**。

**次生问题**：唯一的取消手段是在深层循环里 `throw new Error('取消')`（`:21`），
在同步长循环中几乎无法响应。

**修复方向**：
- 进度让步应放在**外层批次**（如每 500 行 `await` 一次），而非每次迭代
- 或改用 `requestIdleCallback` / Web Worker
- 配合空间索引（`@turf/points-within-polygon` 等）避免暴力 O(n²)

---

### P1-3　一个坏要素导致空间分析**全部结果被丢弃**

**位置**：`src/tools/geo_data/geoDataService.ts:209-211, 219-221`（及 `:308-310, 318-320`）

```js
case 'MultiPoint':     type = 'Point'    // ← 标签改了，coordinates 仍是嵌套结构
case 'MultiPolygon':   type = 'Polygon'  // ← 同上
```

**问题**：
类型被强行降级为单几何，但 `coordinates` 保留了 Multi\* 的嵌套数组结构。
下游 `geoAnalysisService.ts` 直接调用：
- `turf.point(coords)`（`:139-140`）
- `turf.polygon(coords)`（`:95, 233`）
- `turf.lineString(coords)`（`:55, 186, 330`）

已核对安装的 Turf 7.3.5 (`@turf/helpers/dist/esm/index.js`)：
- 嵌套数组 → `throw "coordinates must contain numbers"`
- 未闭合环 → `throw "Each LinearRing of a Polygon must have 4 or more Positions."`

**影响链路**：
`GeoDataPage.vue:550-557` 只在**整个循环全部成功**时才赋值 `analysisResults`
→ **一个 `MultiPolygon`（Google Earth KML 中极常见）就让所有已算出的分析结果全部作废**，
用户只看到一句「分析失败: Each LinearRing of a Polygon must have 4 or more Positions.」

**同一处还会对以下常见情况抛错**：任何 1 个点的 LineString、任何 3 点未闭合环。

**修复方向**：把 `Multi*` 拆成多个独立 feature 再分析；每个 feature 的
`turf.polygon` / `turf.lineString` 包 try/catch 并记录逐要素错误。

---

### P1-4　GDACS 分页永远停在第 1 页

**位置**：`src/tools/gdacs/gdacsService.ts:141, 167`
```js
total = jsonData.features.length   // 当前页的条数，不是服务端总数
```
消费方 `GdacsPage.vue:433, 364-366`：
```js
total.value = result.total || result.data.length
totalPages = Math.ceil(total / 20)
```

**影响**：满页 20 条 → `totalPages === 1` → 分页器**永不出现**，
即使 GDACS 有数千条匹配事件。空页 → `totalPages === 0` → 显示「第 1 / 0 页」。

### P1-5　批量高程查询硬上限 100 条，且分批逻辑是死代码

**位置**：`src/tools/elevations_batch/ElevationsBatchPage.vue`
- `:327` — `canExecuteQuery` 要求 `validationResult.data.length <= 100`
- `:480-485` — 实现了 100 条一批的分批循环，**因此永远执行不到**
- `:386-388` — 提示用户「请分批查询」，但**没有任何机制可以分批**

**影响**：「批量」高程工具一次最多 100 行，用户无路可走。

---

### P1-6　距离测算：结果表硬编码 3 列，却宣称展示 N 个近邻

**位置**：`src/tools/distance_sensor/DistanceSensorPage.vue`
- `:393-398` — 表头**写死** `匹配站1/2/3` + `距离1/2/3(米)`
- `:383` — 横幅写 `共匹配 N 个站，每个站 {{ matchCount }} 个近邻`，默认 `matchCount = 10`

**影响**：用户被告知找到 10 个近邻，屏幕上只显示 3 个，
**没有任何提示说明还有 7 个**。完整数据只在下载文件里。
该工具用于真实选址决策，这种「报数与展示不符」很危险。

---

### P1-7　距离测算：`matchCount` 可被清空为 0 → 计算崩溃

**位置**：
- `DistanceSensorPage.vue:524-528`
  ```js
  watch(matchCount, v => { matchCount.value = Math.floor(v) })
  ```
  输入框是 `type="number" min="1"`，但**清空时** `v-model.number` 产出 `''`
  → `Math.floor('')` === `0` → **没有 `>= 1` 的下限钳制**
- `src/utils/DistanceCalculator.ts:338-341`
  ```js
  if (topK.length >= k && topK[k - 1]!.distance <= ...)
  ```
  `k === 0` 时 `topK.length (0) >= 0` 成立 → `topK[-1]` 是 `undefined` → **TypeError**
- 同文件 `:237` `insertSortedAsc` 中 `arr[arr.length - 1]!.distance` 同样在 `k === 0` 时抛错

**影响**：清空「匹配数量」输入框后点执行计算即崩溃，只弹一个无信息量的「计算失败」。

---

### P1-8　距离测算：取消计算后，部分结果仍可下载且无任何标记

**位置**：
- `DistanceSensorPage.vue:617` — `matchResult.value = await matchDistances(...)`
- `DistanceCalculator.ts:449, 514` — 收到 abort 后 **`break` 出循环并 return 部分 `results`**
- `DistanceCalculator.ts:486` — 仅调用 `onProgress(0, '计算已终止')`
- `DistanceSensorPage.vue:640-642` — `finally` 置 `isMatching = false` → `canDownloadResult` 变 true

**影响**：用户在 50% 处点取消，界面提示「计算已终止」，
但随后**可以下载一个看起来像完整结果的文件**。全程无「部分结果」标记。
用于工程决策的数据集里混入半截数据，是很典型的数据事故源头。

---

### P1-9　批量坐标转换：校验用的坐标系 ≠ 转换用的坐标系

**位置**：`src/tools/coords_convert/CoordsConvertPage.vue`
- `:467-470` — `readAndValidateCoordTemplate(file, inputCoordinateSystem.value)` **在上传时**捕获坐标系
- `:518` — 转换时使用 `inputCoordinateSystem.value` 的**当前值**
- 无任何 watcher 或请求序号守卫；文件输入框仅在 `!canUploadFile` 时禁用（`:176`）

**复现路径**：
1. 以 WGS84 模式上传文件 → 行按**经纬度范围**校验通过
2. 把「输入坐标系」切换为 `cgcs2000_xy`（投影坐标，单位米）
3. 点击「开始转换」

**结果**：行数据按**米**解释而非经纬度 → 静默产出完全错误的坐标，**无任何提示**。

**次生**：两次上传重叠时存在竞态，后完成的覆盖先完成的。

---

### P1-10　所有模板读取器「全有或全无」——一个错行阻断整个文件

**位置**：`src/utils/TemplateReader.ts:123-132`
```js
// 收集该行错误后 continue，但最后：
result.isValid = result.errors.length === 0
```
已经解析成功的 `result.dataRows` 被直接丢弃。

所有调用方都以 `isValid` 作为闸门：
`CoordsConvertPage.vue:472`、`elevations_batch/TemplateReader.ts:90`、
`distance_sensor/TemplateReader.ts:135`、`table2kml_basestation/TemplateReader.ts`、
`get_add`、`get_lonlat`。

**影响**：一个 10000 行文件里出现 1 处笔误 → **整个文件无法处理**，
用户只看到列出 5 条错误的弹窗（`CoordsConvertPage.vue:477-481`），没有任何继续的途径。
正确做法应是「N / M 行有效」的部分成功流程。

**相关**：`TemplateReader.ts:114-119` 只用 `expectedHeaders` 构建行对象，
**用户模板里多出来的属性列会被静默丢弃**，且表头校验（`:83-91`）只检查期望列是否存在，从不提示多余列。

---

### P1-11　模板导出：扩展名判断大小写敏感 → 静默无反应

**位置**：
- `src/tools/template_export/useTemplateExport.ts:356, 360`
- `useDocxTemplateExport.ts:103, 107`、`useXlsxTemplateExport.ts:76, 80`

```js
file.name.endsWith('.csv')   // 没有 .toLowerCase()
```

`DATA.CSV` 两个分支都不匹配 → `data` 保持 `[]` → `dataRowCount` 保持 `0`
→ `canRender` 为 false → **不报任何错，界面就是不动**。

**对比**：本仓库其他所有文件处理器都正确地写了 `.toLowerCase().endsWith(...)`，
说明这是**局部遗漏**而非约定缺失。

**同处其他静默数据损坏**：
`useTemplateExport.ts:291` 与 `xlsxTemplateFunctions.ts:114`
```js
if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
```
→ `"007"` 变 `7`；11 位手机号/身份证 `"13800138000"` 变成**数字** `13800138000`，
写入 Excel 后显示为 `1.38001E+10`，前导零与格式全部丢失。
这是**最常见的 ID 字段类型**，静默损坏风险很高。

---

### P1-12　甘特图时区偏移：UTC+8 下 00:00–08:00 操作少一天

**位置**：`GanttChartPage.vue:457-461`
```js
function formatDate(date: string): string {
  return new Date(date).toISOString().split('T')[0]   // UTC
}
```
传入的是**本地时区**的 `Date` 对象：
- `:643-644` `on_date_change` — CST 本地 2026-09-27 00:00 → `toISOString()` = `2026-09-26T16:00Z` → **存成 09-26**
- `:769-770` `openAddTaskModal` — 默认开始日期可能变成「昨天」
- `:1430` `loadDemoData` — 整个 6 任务演示时间轴整体前移一天

**影响**：一个**专门用于排期的工具**，每次在凌晨时段拖拽都会静默丢一天。
面向中国用户的应用（UTC+8）必现。

**同类问题**：`gdacsService.ts:98-101`、`ShpToKmlGenerator.ts:226`、
`KmlGenerator.ts:166`、`useTemplateExport.ts:631` 的默认日期与文件名都用 UTC。

---

### P1 汇总

| 编号 | 问题 | 主要位置 | 类型 |
| --- | --- | --- | --- |
| P1-1 | `push(...arr)` 大数据量崩溃 | `TemplateExporter.ts:31,56` 等 6 处 | 崩溃 |
| P1-2 | 空间分析 O(n²) + 逐次 setTimeout | `geoAnalysisService.ts` 6 处 | 卡死 |
| P1-3 | 坏要素丢弃全部分析结果 | `geoDataService.ts:209-221` | 静默错误 |
| P1-4 | GDACS 分页恒为 1 页 | `gdacsService.ts:141,167` | 功能失效 |
| P1-5 | 批量高程硬上限 100，分批是死代码 | `ElevationsBatchPage.vue:327,480` | 功能缺失 |
| P1-6 | 结果表 3 列 vs 宣称 N 个 | `DistanceSensorPage.vue:383,393` | 误导 |
| P1-7 | `matchCount=0` 触发 TypeError | `DistanceSensorPage.vue:524` | 崩溃 |
| P1-8 | 取消后部分结果可下载 | `DistanceCalculator.ts:449,514` | 静默错误 |
| P1-9 | 校验坐标系 ≠ 转换坐标系 | `CoordsConvertPage.vue:467,518` | 静默错误 |
| P1-10 | 一个错行阻断整个文件 | `TemplateReader.ts:123-132` | 可用性 |
| P1-11 | `.CSV` 静默无反应 + 数字型 ID 损坏 | `useTemplateExport.ts:291,356` | 静默错误 |
| P1-12 | UTC 时区偏移少一天 | `GanttChartPage.vue:457` | 数据错误 |

### 附：内存泄漏（每次导航/点击累积）

| 位置 | 问题 |
| --- | --- |
| `KmlViewerPage.vue:505-510` | `document.addEventListener('fullscreenchange')` 在 **setup 顶层**注册，`onBeforeUnmount`（`:419-425`）只清理了绘制监听器和 `map.remove()`，**该监听器从不移除**。每次访问 KML 查看器泄漏一个闭包，持有整个组件作用域（map / layers / tree）。 |
| `GanttChartPage.vue:676-679` | 每次缩放 `reinitGantt()` = `new Gantt(...)`。已核对 `frappe-gantt.es.js:1567`，其构造函数经 `bind_events()` 注册**匿名** `document.addEventListener("mouseup", ...)`，**库不提供 removeEventListener**。点 50 次缩放 = 50 个存活监听器，各自持有完整 Gantt 对象图。 |

---

## 四、P2 中等问题（19 项）

### 4.1　首屏多下载约 810 kB（gzip 后约 190 kB）

**根因**：`vite.config.ts:41` 的 `manualChunks` 规则**顺序错误**。

```js
if (id.includes('vue') || id.includes('pinia') || ...) return 'vue-ecosystem'
                                          ↑ 命中一切路径含 "vue" 的包
if (id.includes('radix-vue') || id.includes('@vuepic') || ...) return 'ui-libs'
                                          ↑ 因此永远不会被命中（死规则）
```

被劫持进 `vue-ecosystem` 的包（已 grep 产物确认）：
`vuedraggable`、`sortablejs`、`@vuepic/vue-datepicker`。

**放大机制**：`src/main.ts:7` 引入了
```js
import '@vuepic/vue-datepicker/dist/main.css'
```
datepicker 的 **JS** 因此进入入口依赖图；`manualChunks` 又把整块强制聚合，
于是 604 kB 的 `vue-ecosystem` 变成**首屏静态依赖**，被写进 `dist/index.html`：
```html
<link rel="modulepreload" crossorigin href="/assets/vue-ecosystem-CREX5igH.js">
```

**首屏实际 JS 载荷**（gzip 后约 392 kB）：

| chunk | 原始 | gzip | 说明 |
| --- | --- | --- | --- |
| `vue-ecosystem` | 604.86 kB | 189.70 kB | vue + pinia + vuedraggable + sortablejs + datepicker |
| `vendor` | 570.46 kB | 193.54 kB | phosphor-icons + **dompurify** + **axios** + **proj4** + tailwind-merge |
| `index`（入口） | 17.82 kB | 6.79 kB | |
| `toolData` | 5.22 kB | 1.90 kB | |
| 其余 helper | ~3.6 kB | ~1.5 kB | |

**首页只渲染 4 张工具卡片**，却要下载 1.2 MB JS。
`proj4`（仅 1 个工具使用）、`dompurify`（仅 markdown 页使用）本不该进首屏。

> 注：`echarts` 1.1 MB / `document-libs` 784 kB **未**进首屏（懒加载正常），
> 但单次进入图表类工具仍需下载 echarts 全量 1.1 MB（gzip 365 kB），可考虑按需注册。

**修复方向**：
1. 调整 `manualChunks` 顺序，把具体包名判断放在 `'vue'` 模糊匹配**之前**
2. 或改用 `node_modules/<pkg>` 精确路径匹配
3. 把 `@vuepic/vue-datepicker` 的 CSS 从 `main.ts` 移到使用它的组件内
4. `proj4` / `dompurify` 改为动态 `import()`

---

### 4.2　没有 CI，且生产构建不卡任何质量门禁

```json
"build": "run-s build-only prerender",
"build:fast": "run-p type-check \"build-only {@}\" --"
```

`npm run build`（**实际部署使用的命令**）只做构建和预渲染，
**不跑 `type-check`、不跑单元测试、不跑 lint**。
`build:fast` 虽然含 type-check，但名字表明它是「快速」通道，且未包含测试。

仓库中**不存在 `.github/` 目录**，即无任何持续集成。

**这是本次审计最重要的流程结论**：
450 个测试全绿、`oxlint` 零告警，却没有一个测试覆盖 P0-1 的崩溃路径。
**绿灯来自于「没测」，而不是「没 bug」。**

**建议**新增 `.github/workflows/ci.yml`：
```yaml
on: [push, pull_request]
jobs:
  verify:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run type-check
      - run: npx oxlint .
      - run: npx vitest run --coverage
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```
并把 `build` 改为 `run-s type-check lint test:unit build-only prerender`。

---

### 4.3　测试配置把 devtools 插件拖进测试环境

**位置**：`vitest.config.ts:3`
```js
import viteConfigFn from './vite.config'
```
直接复用了 `vite.config.ts`，其中包含 `vueDevTools()` 与 `viteMockServe`。
测试环境不需要 devtools 插件，却承担了它的初始化开销（本次测试 import 阶段耗时 15.8s）。

**修复方向**：为测试单独写一份精简 config，或用 `defineConfig` 只挑选需要的插件。

### 4.4　死代码约 1500+ 行

以下代码**没有任何生产引用**（已全仓库 grep 确认）：

| 文件 / 符号 | 估算行数 | 说明 |
| --- | --- | --- |
| `src/tools/docx_template_export/useDocxTemplateExport.ts` | 375 | composable 本体无引用；只有其抽离出的纯函数被单测覆盖 |
| `src/tools/xlsx_template_export/useXlsxTemplateExport.ts` | 357 | 同上 |
| `geoDataService.ts:356` `performAnalysis` + 9 个私有 `analyzeX` | ~200 | 页面实际用的是 `geoAnalysisService.ts` 的 9 个导出函数 |
| `src/components/layout/ToolDocNav.vue` | 42 | 无引用 |
| `src/views/viewData.ts` | 54 | 无引用（且与 `toolData.ts` 的 `docTypes` 重复定义） |
| `src/tools/toolData.ts:245` `getToolDocPath` | 3 | 无引用 |
| `src/tools/kml_viewer/tileProviders.ts:102` `getTileProvider` | — | 无引用 |
| `src/utils/TemplateReader.ts:147` `readTemplate` | ~42 | 仅被自己的 spec 使用 |
| `src/utils/DistanceCalculator.ts:98` `haversineDistance` | ~14 | 仅被单测使用，与 `:119` `sphericalCosDistance` 重复 |
| `geoDataService.ts:733-735` `turf.intersect(fcA, fcB)` | 3 | **Turf 6 签名**，Turf 7 只接受一个参数 → 必然抛错被 catch 吞成 `'0'`；`as any` 掩盖了它 |

**死代码里还藏着 P0-1**：
`useXlsxTemplateExport.ts:210` 有一模一样的 `new window.ExcelJS.Workbook()`。
两个文件都坏在同一处，说明这是**从同一份模板复制**的。

### 4.5　重复实现统计

| 关注点 | 份数 | 位置 |
| --- | --- | --- |
| **模板读取器** | **7** | `utils/TemplateReader.ts`（在用）、`coords_convert/templateReader.ts`、`distance_sensor/TemplateReader.ts`、`elevations_batch/TemplateReader.ts`、`get_add/TemplateReader.ts`、`get_lonlat/TemplateReader.ts`、`table2kml_basestation/TemplateReader.ts` |
| **模板导出器** | **7** | `utils/TemplateExporter.ts`（在用）、以及 `distance_sensor` / `elevations_batch` / `get_add` / `get_lonlat` / `table2kml_basestation` / `table2kml_point` 各自的 `TemplateExporter.ts` |
| 文件名模板逻辑 | 5 | `ShpToKmlGenerator.ts:65-81`、`Shp2KmlPage.vue:750-766`、`docxTemplateFunctions.ts:224-243`、`xlsxTemplateFunctions.ts:33-52`、`useTemplateExport.ts:213-232` |
| 花括号校验 | 4 | `useTemplateExport.ts:191-211`、`docxTemplateFunctions.ts:200-222`、`xlsxTemplateFunctions.ts:10-31`、`Shp2KmlPage.vue:728-748` |
| CSV 解析 | 3 套（2 套手写） | `utils/CsvParser.ts`、`ElevationsBatchPage.vue:423-468`、以及 3 个 composable 里的 PapaParse |
| `sanitizeFilename` / `resolveDuplicates` 等 | 3 | `docxTemplateFunctions.ts:196-261` 与 `xlsxTemplateFunctions.ts:6-70` **逐字节相同**；`useTemplateExport.ts:187-250` 是第三份 |
| `escapeXml` | 2 | `table2kml_point/KmlGenerator.ts:97`、`shp2kml/ShpToKmlGenerator.ts:45`（完全相同） |
| ECharts option 生成 | 7 | `weatherHistoryChart.ts`（5 个近乎相同的生成器）、`gdacsChart.ts`、`earthquakeChart.ts` |

**重复带来的实际危害**（不只是体积）：
- `CsvParser.ts` 与 `ElevationsBatchPage.vue` 的两份手写 CSV 解析**行为已经漂移**，
  P0-4 的 bug 在两处都存在，修一处会漏一处
- `Shp2KmlPage.vue:750-766` 与 `ShpToKmlGenerator.ts:65-81` 是同一函数的两份拷贝，
  页面用前者做实时预览、生成器用后者出结果 —— **可能输出不一致**
- `distance_sensor/TemplateReader.ts:186-239` 的 `same-site` 与 `different-site` 两个分支
  **逐字节相同**；`:253-256` `getResultHeaders` 的三元表达式两个分支也相同，
  且与 `:147` 的文档注释矛盾

**手写 CSV 解析器的额外缺陷**（`utils/CsvParser.ts`）：
- `:18-19` — `if (char === '"') inQuotes = !inQuotes`。标准的 `""` 转义会切换两次，
  引号字符被丢弃，字段内容损坏
- `:50` — `cleanText.trim().split('\n')` 会在**引号内的换行符**处切断，产生虚假行
- `:80` — `String(h || '')` 会把值为数字 `0` 的表头变成空字符串

### 4.6　部署与配置文件

| 问题 | 位置 | 影响 |
| --- | --- | --- |
| `.env` **被 git 跟踪** | `.gitignore` 未排除；`git ls-files` 确认已入库 | 目前只有开关变量，无密钥。但**这是坏惯例**，将来加任何 key 都会直接泄露。应改为 `.env.example` 入库、`.env` 忽略 |
| `.env` 存在**重复 key** | `.env:8` 与 `.env:13` 都是 `VITE_USE_MOCK=false` | 同一配置写两遍，改动时极易只改一处 |
| 后端地址**硬编码 IP + 明文 HTTP** | `vercel.json:5` → `http://8.137.195.0/api/$1` | IP 变更需改代码；明文 HTTP 传输可被窃听篡改。应改为环境变量 + HTTPS |
| catch-all rewrite **吞掉所有 404** | `vercel.json:6` `/(.*)` → `/index.html` | 任意不存在的 URL 都返回 **200 + index.html**，软 404 对 SEO 是负分 |
| README 与实现矛盾 | README 称「纯前端，无需后端」，但 `router/index.ts:85`、`DlsComment.vue:304,316,328` 都在打 `/api` | 文档误导，新维护者会踩坑 |

### 4.7　浏览量被重复统计

**位置**：
- `src/router/index.ts:85` — 每次路由跳转 POST `/api/page-stats/{toolId}/view`
- `src/components/layout/DlsComment.vue:328` — 组件挂载时 POST `/api/page-stats/{pageKey}/view`

`DlsMoment.vue:20-23` 的 `currentPageKey` 就是 `route.params.toolId`，
与 router 传入的 key **完全相同**。

**结果**：进入任一工具页且「势」tab 挂载时，**同一次访问被计 2 次**。

### 4.8　安全问题

| 问题 | 位置 | 评价 |
| --- | --- | --- |
| **客户端验证码** | `DlsComment.vue:196-203, 288` | 4 位码在浏览器生成、浏览器校验，对脚本**零阻力**。属于**安全剧场**，却给人「有防刷」的错觉。真正防护必须在服务端（rate limit + 验证码服务） |
| **API key 明文持久化** | `src/stores/geocodeStore.ts:165` `persist: true` | 高德 API key 明文写入 localStorage。任何 XSS（含 P0-3）都能窃取。建议改为 session 存储或仅内存 |
| **无请求超时 / 无 AbortSignal** | `gdacsService.ts:125`、`earthquakeService.ts:108`、`weatherHistoryService.ts:81`、`elevationService.ts:15,44` | 4 处一致的裸 `fetch()`。连接挂起则 spinner 永久显示；离开页面后请求仍在跑并继续改状态 |

### 4.9　其他值得修的点

| 问题 | 位置 |
| --- | --- |
| `computed` 内做副作用（`showErrorToast` + `logger.error`）—— computed 应是纯函数 | `ToolDetailView.vue:143-149` |
| `vercel.json` 的 `cleanUrls: true` 与预渲染产物 `dist/tools/<id>/index.html` 组合需在 CI 实测 | `vercel.json:2` |
| `vite.config.ts:13-75` 整个 return 对象缩进错乱（`return {` 之后未缩进） | `vite.config.ts` |
| `DlsMainLayout.vue` 的 tab 状态 `activeIndex` 切换工具时不重置 | `DlsMainLayout.vue:49` |
| `DlsMainLayout` 一次渲染全部 5 个 tab-content → 每个工具页首屏并发请求 **4 个 md + 评论 + 统计** | `DlsMainLayout.vue:11-28` |
| `useToast.ts:17` 的 `setTimeout` 未 track，卸载后仍会改动共享 `toasts` 数组 | `useToast.ts:17` |
| `shp2excel` 永远读不到属性（`accept=".shp"`，`validateSingleShpFile` 拒绝非 `.shp`，`.dbf` 根本无法选择）；而 `shp2kml` 却支持 `.dbf` —— **同输入两工具行为不一致** | `ShpToExcelPage.vue:15-16`、`ShpFileReader.ts:72-84` |
| `shp2kml` 选 2 个以上 SHP 时静默丢失全部属性（多文件分支不配对 `.dbf`） | `Shp2KmlPage.vue:487-493` |
| `GDACS` 的 `parseFloat(...) \|\| 0` 把缺失坐标变成 **(0,0) 尼罗河源点** 并照常绘图；且 `parseFloat('0')` 为 falsy，会丢弃合法的赤道/本初子午线坐标 | `gdacsService.ts:160-161` |
| 天气历史时区**硬编码 `Asia/Shanghai`**，查纽约/柏林会整体偏移 12 小时；返回的 `utc_offset_seconds` 拿到了却没用 | `weatherHistoryService.ts:76` |
| 天气历史默认结束日期是「今天」，但 `archive-api` 数据滞后约 5 天 → **开箱即用的默认查询必然失败** | `WeatherHistoryPage.vue:229` |
| 高程服务把**全部点位拼进一个 URL**，超过 100 个 Open-Meteo 返 400；且 `data.elevation[index] ?? 0` 把缺失高程**替换成海平面 0** | `elevationService.ts:36-46, 61` |
| `elevations_convert` 把所有非法行物化成 `{longitude: 0, latitude: 0}` → 结果表显示「0.000000, 0.000000」，**看起来像真实结果** | `ElevationsConvertPage.vue:122,127,130,181` |
| 地震查询硬上限 2000 条且无截断提示；USGS 按时间升序返回 → 宽日期范围会**静默只给最早 2000 条** | `earthquakeService.ts:104` |
| KML 查看器用 `el.tagName === 'Folder'` 判断，带命名空间前缀的 `<kml:Folder>` **全部匹配不到**，用户只看到空树无报错 | `KmlViewerPage.vue:606,618,638` |
| KML 查看器 `getElementsByTagName('Point')[0]` 搜整棵子树且**优先判断** → 含 `<MultiGeometry><LineString/><Point/></MultiGeometry>` 的 placemark 被降级成一个图标，线丢失 | `KmlViewerPage.vue:712-719` |
| `parseFloat(...)!` 无 `NaN` 守卫 → `L.latLng(NaN, NaN)` → marker 静默落在 (0,0) | `KmlViewerPage.vue:717,756,791` |
| `distance_sensor` 经纬度窗口**不跨越 ±180°** → 179.999°E 与 −179.999°E（相距约 200m）互相匹配不到 | `DistanceCalculator.ts:306-314` |
| KML 导出**前置 UTF-8 BOM**，严格 XML 解析器（Python `ElementTree`/lxml）会拒绝 BOM 后的 `<?xml?>` | `ShpToKmlGenerator.ts:227`、`KmlGenerator.ts:167` |
| `revokeObjectURL` 紧跟 `click()` 立即调用（Firefox 会中断下载）；`GanttChartPage.vue:936` 的 anchor 甚至**从未 append 到 DOM** | Gantt 4 处 + 4 个 service |
| `setTimeout(() => {}, 200)` 被当作节流器使用（`setTimeout` 立即返回，**完全是空操作**） | `GisToExcelExporter.ts:147` |
| 甘特图拖动进度条时**每个 mousemove 都做一次全量深拷贝并压入 undo 栈**（无 drag 守卫），50 条上限导致真正的初始状态被挤掉，撤销失效 | `GanttChartPage.vue:647-653, 470` |
| 甘特图直接操作 frappe-gantt 私有 API（`gi.layers.arrow`、`gi.make_arrows()`、`delete internalTask._start`）且无 try/catch | `GanttChartPage.vue:873-908` |
| `GanttChartPage.vue:384` 在 `:387` 的 import 之前调用 `logger.log`（靠 ESM 提升才工作） | 同上 |
| 甘特图 `:722/731`、`:739/747`、`:553/659` 的 `if (store.currentViewMode !== savedMode)` **恒为 false**，是死比较 | 同上 |
| 大量 `ref`（而非 `shallowRef`）承载大数组 → Vue 深度代理，内存 2–3 倍 | `CoordsConvertPage.vue:415,419`、`ElevationsBatchPage.vue:302`、`GisToExcelPage.vue:185`、`Shp2KmlPage.vue:372`、`useTemplateExport.ts:308,316` |
| `weatherHistoryChart.ts` 5 个生成器在缺数据时 `return {}`；`{}` 是 truthy → 通过 `useECharts` 的 `if (option)` 判断 → `setOption({})` **把上一个图表清成空白** | `weatherHistoryChart.ts:22,95,162,238,306` |
| `useECharts` 缺 `dispose()` 的 `onUnmounted` 清理 | `useECharts.ts` |
| `elevation_query` / `weather_history` 用 `parseFloat` 校验，`parseFloat("39abc") === 39` → 垃圾输入通过校验 | `ElevationQueryPage.vue:89`、`WeatherHistoryPage.vue:263` |
| 空间分析导出失败的错误对话框**永远不显示**（模板绑定的是 `showErrorDialog` 而非 `errorDialogOpen`） | `GeoDataPage.vue:207-214` vs `:342-357, 685` |
| `batchConvertCoordinates` 在 0 行时返回 `success: true` | `coordsConversion.ts:207-211` |
| `isXYMode` 分支**完全没有范围校验**（与 `validateCoordinate` 不一致） | `coords_convert/templateReader.ts:70-110` |
| `Papa.parse().errors` 从不检查 → 畸形 CSV（参差行、未闭合引号）静默产出半截数据 | `useTemplateExport.ts:358-359` |
| `qrcode` 手写 debounce 无 `cancel`；canvas 不降采样（6000×4000 照片 → 96 MB ImageData） | `QrcodePage.vue:195-201, 320-322` |
| 绝大多数文件处理路径**同步全量加载、无分块、无 Worker**（`TemplateReader.ts:55-72`、`GisFileReader.ts:159`、`ShpToKmlGenerator.ts:164-218`、`KmlViewerPage.vue:588,679`）→ 大文件必卡死 | 多处 |

---

## 五、修复路线图

### 阶段 0：止血（约 1 小时，3 行代码）

| # | 动作 | 位置 |
| --- | --- | --- |
| 1 | `import ExcelJS from 'exceljs'`，替换 `new (window as any).ExcelJS.Workbook()` | `useTemplateExport.ts:517` |
| 2 | 空字符串不转数字 | `CsvParser.ts:86` |
| 3 | 同样的空值判断 | `ElevationsBatchPage.vue:441` |

> 这 3 处修完，**一个工具从完全不可用变为可用，一个静默数据损坏被消除**。

### 阶段 1：正确性（约 1 天）

1. **P0-2** 重写 KML 坐标解析（按元组切分），同步修 `KmlViewerPage.vue:786` 与 `GisFileReader.ts:52,59` —— 建议抽成 `src/utils/kmlCoordinates.ts` 单一实现
2. **P0-3** 甘特图 `importTasks` 加 schema 校验；`getNextId` 加 `Number.isFinite` 守卫 + 循环上限；`Math.max` 改 `reduce`；`set_title`/`set_details` 改用 `textContent` 或经 DOMPurify
3. **P1-9** `CoordsConvertPage` 捕获上传时的坐标系快照，或在坐标系变更时清空已校验数据
4. **P1-12** 甘特图 `formatDate` 改用本地时区格式化（`getFullYear/getMonth/getDate`），或统一用 `date-fns` 的 `format`
5. **P1-11** 所有 `endsWith('.csv')` 补 `.toLowerCase()`；`resolveValue` 增加「超过 15 位数字或含前导零则按字符串处理」的白名单逻辑
6. **P1-8** 取消计算时给结果加 `partial: true` 标记，并禁用下载或下载文件名加 `_partial` 后缀

### 阶段 2：健壮性（约 2 天）

1. **P1-1** 全部 `push(...arr)` / `Math.max(...arr)` / `[a, ...arr]` 改循环或 `concat`
2. **P1-2** 空间分析让步粒度从「每次迭代」改为「每 N 次」；考虑 Web Worker
3. **P1-3** `Multi*` 要素拆分 + 逐要素 try/catch，**部分失败不再丢弃全部结果**
4. **P1-4** GDACS 使用服务端 total 或 `hasMore` 标志
5. **P1-5** 放开 100 条上限，让既有分批逻辑生效
6. **P1-6 / P1-7** 结果表改为按 `matchCount` 动态渲染；`matchCount` 加 `Math.max(1, ...)` 钳制
7. **P1-10** 模板读取改为「部分成功」模式，明确告知 N/M 行有效
8. 4 处 `fetch` 补 `AbortController` + `setTimeout` 竞速取消 + `onUnmounted` 中断
9. 修复两处内存泄漏（`KmlViewerPage.vue:505` 移入 `onMounted` 并在卸载时移除；甘特图停止重复实例化）

### 阶段 3：工程化（约 2 天）

1. **加 CI**（`.github/workflows/ci.yml`）：`type-check` + `oxlint` + `vitest` + `playwright` 全挂上 PR
2. **`build` 改为质量门禁前置**：`run-s type-check lint test:unit build-only prerender`
3. **修 `manualChunks` 顺序**；`@vuepic/vue-datepicker` CSS 移出 `main.ts`；`proj4`/`dompurify` 改动态 import
4. **补测试缺口**（当前完全无覆盖的部分）：
   - `ToolDetailView` 的组件映射与降级路径
   - `createToolNavItems` 的 navItems 生成
   - `router.afterEach` 的埋点
   - `useTemplateExport` 的渲染主流程（正是 P0-1 漏网的原因）
   - 一个 `importTasks` 的非法 JSON 用例（正是 P0-3 漏网的原因）
5. **`vitest.config.ts` 独立配置**，不引入 devtools 插件

### 阶段 4：清理（约 3 天）

1. 删除 4.4 节列出的约 1500 行死代码
2. 7 份 `TemplateReader` → 抽 `src/utils/templateReader/` 参数化工厂
3. 7 份 `TemplateExporter` → 单一实现 + 配置对象
4. 5 份文件名模板 / 4 份花括号校验 / 3 份 `sanitizeFilename` → 各收敛为 1 份
5. 2 份手写 CSV 解析 → 统一用 PapaParse（项目已依赖）
6. `weatherHistoryChart.ts` 5 个生成器 → 参数化合并
7. 部署配置：`.env` → `.env.example` + 忽略 `.env`；后端地址改环境变量 + HTTPS；修 catch-all 404；README 补充后端说明
8. 删掉客户端验证码，或明确注释「仅防误输入，防刷请在服务端实现」

---

## 六、值得肯定的地方

审计不是只挑毛病，这个仓库有几处**明显高于同类项目平均水平**的做法：

1. **纯函数抽取有纪律**　`coordConversion` / `KmlGenerator` / `DistanceCalculator` /
   `docxTemplateFunctions` / `ShpToKmlGenerator` 等都做到了「逻辑与视图分离」，
   这也是本次审计能精确定位到行号的原因
2. **测试数量可观且真的在跑**　450 个用例、32 个文件，覆盖了坐标转换、CSV/Excel 解析、
   KML 生成、距离算法、地震/GDACS 服务等核心逻辑
3. **KML 渲染做了 XSS 防护**　`DlsMdPage.vue:89` 用了 `DOMPurify.sanitize`，
   说明团队**已经意识到 XSS 风险**，只是没有推广到甘特图那条路径（P0-3）
4. **Worker 化导出有意识**　`useProgressTimer` / `useProgress` / `ProgressModal` 提供了
   统一的长任务进度反馈抽象（虽然 P1-2 没用上）
5. **构建考虑周全**　`prerender.mjs` 用 Puppeteer 做 SSR 预渲染 + 生成 sitemap/robots，
   本地/CI 双 Chromium 探测，考虑到了 Vercel Lambda 环境
6. **commit message 规范**　`fix(home):` / `style(tools):` / `refactor:` 分类清晰，
   能看出演进过程

**结论**：这不是一个「糟糕的项目」，而是一个**质量门禁缺位导致严重 Bug 漏网**的项目。
补上 CI + 修掉阶段 0/1 的问题，可靠性会有质的提升。

---

## 七、附录：审计方法与可复现命令

### 7.1 执行的验证

```powershell
npm run type-check          # → 0 错误
npx vitest run              # → 450 passed / 32 files
npx oxlint .                # → 0 warnings, 0 errors (180 files)
npm run build-only          # → 成功，3.68s
git ls-files                # → 315 个跟踪文件
```

### 7.2 重点核对方式

- **P0-1**：全仓库 grep `ExcelJS`（3 处命中，均无赋值）+ 检查 `index.html` 无 script 标签
- **P0-3**：读 `node_modules/frappe-gantt/dist/frappe-gantt.es.js:685,687,689,1567` 确认
  `set_title` 用 `innerHTML`、构造函数注册匿名 `document` 监听器
- **P1-3**：读 `node_modules/@turf/helpers/dist/esm/index.js` 确认嵌套坐标必抛错
- **P1-4**：`total = jsonData.features.length` 语义为「当前页长度」
- **4.1**：读 `dist/index.html` 确认 `modulepreload` 列表；对产物 grep
  `vuedraggable` / `sortablejs` / `proj4` / `dompurify` 确认被打包进首屏 chunk
- **4.4**：全仓库 grep 确认死代码无生产引用
- **内存泄漏**：读 `KmlViewerPage.vue:419-425` 的 `onBeforeUnmount` 确认未移除监听器

### 7.3 未覆盖范围（诚实声明）

本次审计**未**覆盖以下部分，如需可另行安排：

- `e2e/` 下 4 个 Playwright 用例的实际执行结果（仅阅读了配置与用例源码）
- `src/mock/` 下的 mock 数据（17.5 KB）是否与真实后端契约一致
- 视觉/交互层面的可用性与响应式布局
- 后端 Django 服务（本仓库不含）
- 依赖库的 CVE 漏洞扫描（建议接入 `npm audit` / Dependabot）
- 各工具的**领域正确性**（如距离算法是否符合测绘规范、坐标系转换参数是否准确）——
  本次只检查了代码层面的逻辑缺陷

---

## 附录二　阶段 0–1 修复记录（2026-10-02 执行）

### 附二.1　「修复前要不要补测试」的结论

初版报告隐含一个假设：测试没覆盖到 bug，所以要先补测试。
实际动手前的调查推翻了半个假设 —— **问题不只是缺测试，还有测试在保护 bug**。

关键证据（`CsvParser.spec.ts:76`，初版）：

```js
it('空单元格转换为数字 0', () => {          // ← 测试名把 bug 写成了需求
  const rows = parseCSV('a,b\n1,')
  expect(rows).toEqual([{ a: 1, b: 0 }])    // ← 焊死
})
```

`templateHandler.spec.ts:137` 同理：`it('ADDRESS_FIELDS 支持别名，空字段转换为数字 0')`。

实测验证：临时修 `CsvParser.ts` 后，这 2 个测试立刻变红并阻止修复。

**所以修复前必须先「改测试」而不是「补测试」。**

由此也修正了初版报告的另一个判断：测试断言的是「代码现在做什么」，
而不是「代码应该做什么」。450 个测试全绿，**其中 3 个在反向保护错误行为**。

### 附二.2　补测试的三层策略

| 层次 | 判断 | 落地 |
| --- | --- | --- |
| 必须先做 | 固化 bug 的测试 | 改 3 处期望值，否则修复被挡 |
| 值得做 | 能剥离成纯函数的逻辑 | 新建 `kmlCoordinates.ts`、`ganttTaskUtils.ts`，先写失败测试 |
| **不值得做** | 巨型组件的 mount 测试 | 32 个 spec 里只有 2 处 import `.vue`；给 52KB 的 `GanttChartPage` 写 mount 测试要 mock Leaflet/frappe-gantt/FileReader/canvas，测试会死贴实现。**正确路径是抽纯函数** |

真正的杠杆是 **CI 而非覆盖率**：450 个测试漏掉 4 个 P0，瓶颈是「没跑」不是「没写」。

### 附二.3　实际改动清单

**新增文件**

| 文件 | 用途 |
| --- | --- |
| `.github/workflows/ci.yml` | 质量门禁：`type-check` + `oxlint` + `vitest` → E2E → 构建 |
| `src/utils/kmlCoordinates.ts` | KML 坐标解析纯函数（P0-2），28 个测试 |
| `src/tools/gantt_chart/ganttTaskUtils.ts` | 甘特图日期/ID/schema 纯函数（P0-3、P1-12），34 个测试 |
| `src/utils/__tests__/kmlCoordinates.spec.ts` | 上述测试 |
| `src/tools/gantt_chart/__tests__/ganttTaskUtils.spec.ts` | 上述测试 |
| `src/tools/template_export/__tests__/exceljsRuntime.spec.ts` | P0-1 运行时回归，6 个测试 |

**P0 修复**

| 项 | 改动 |
| --- | --- |
| **P0-1** | `useTemplateExport.ts:517` `new (window as any).ExcelJS.Workbook()` → `const { Workbook } = await import('exceljs')`。用动态 import 使 930KB 的 exceljs 懒加载；`vite.config.ts` 新增独立 chunk 规则，不进首屏 |
| **P0-2** | `KmlViewerPage.vue` 与 `GisFileReader.ts` 统一改用 `parseKmlCoordinates`。实测旧实现在「逗号后带空格」上产出 `[{lat: NaN, lng: 116.3}, ...]` 共 4 个含 NaN 的点（初版报告写「静默丢弃」，实际更严重）。顺带修 gx:Track 的 NaN 缺口、消除 `,undefined` 垃圾 |
| **P0-3** | `importTasks` 加 `validateImportedTasks` schema 校验（拒绝非数字 id、空 name、无效日期）；`getNextId` 改用 `computeNextTaskId`（永不返回 NaN，消除死循环）；`set_title`/`set_subtitle`/`set_details` 的动态值全部经 `escapeHtml`，color 加 `#hex` 白名单防 style 注入 |
| **P0-4** | 修 3 处实现（`CsvParser.ts`、`templateHandler.ts`、`ElevationsBatchPage.vue`）；删除 `ElevationsBatchPage.vue` 内 `parseCSV`/`parseCSVLine` 的复制品改为复用共享实现（同时获得 BOM 处理与引号内逗号支持） |

**顺带修复（同批次，成本极低）**

| 项 | 改动 |
| --- | --- |
| P1-11 | `useTemplateExport.ts` 扩展名判断加 `.toLowerCase()`；`Papa.parse` 的 `errors` 不再被忽略 |
| P1-12 | 甘特图 `formatDate` 改本地时区；`ganttStore.GanttTask.dependencies` 类型从 `string` 修正为 `string \| string[]`（原声明与运行时行为不符） |
| — | `playwright.config.ts` 的 `channel` 支持 `PLAYWRIGHT_CHANNEL` 覆盖，使 E2E 可在 Linux CI 运行 |

### 附二.4　验证结果

| 检查项 | 初版基线 | 修复后 |
| --- | --- | --- |
| `type-check` | 0 错误 | **0 错误** |
| `oxlint` | 0 / 0 | **0 / 0**（184 files） |
| `vitest` | 450 passed / 32 files | **524 passed / 35 files**（+74） |
| `build` | 成功 | **成功** |
| 首屏 JS | 1,202 kB（gzip 392 kB） | **不变**（exceljs 为懒加载独立 chunk） |
| `document-libs` | 784 kB | **784 kB**（exceljs 已拆出） |

**回归测试有效性已实测验证**，不是「新写的测试当然通过」：
把 `parseKmlCoordinates` 临时替换回旧逻辑后，28 个测试中有对应用例立即失败，
失败输出为 `expected [ { lat: NaN, lng: 116.3 }, … ] to have a length of 2 but got 4`。

### 附二.5　尚未处理（阶段 2–4）

本次只推进到阶段 1，以下**明确未做**，避免造成「已修完」的错觉：

- **P1 其余全部**：大数据量 `push(...arr)` 崩溃、空间分析 O(n²) 与 Multi\* 拆分、GDACS 分页、
  批量高程 100 条上限、距离测算 3 列与 `matchCount=0`、坐标系竞态、模板读取部分成功、取消后部分结果
- **两处内存泄漏**：`KmlViewerPage.vue:505` 的 document 监听器、甘特图每次缩放重建 Gantt 实例
- **P2 全部**：首屏 `manualChunks` 顺序 bug、死代码约 1500 行、7 份重复实现、
  `.env` 被跟踪、vercel catch-all 404、客户端验证码
- **CI 尚未实际运行**：工作流已写好但未在 GitHub 上跑过，E2E 在 Linux 上的表现需首次实跑确认

### 附二.6　给下一步的三条建议

1. **先跑一次 CI**。工作流是新建的，第一次在 GitHub 上运行可能暴露环境差异
   （尤其 E2E 的 `channel: chromium` 切换和 `npm run preview` 需要已构建产物）。
2. **P1-1（`push(...arr)`）性价比最高**。6 个工具共用的导出器，改成循环即可，
   但需要构造大数据用例才能验证 —— 建议加一个「10 万行不抛异常」的测试。
3. **P2 的 `manualChunks` 顺序 bug 独立修**。当前 `id.includes('vue')` 会劫持
   `radix-vue` / `vuedraggable` / `@vuepic`，使首屏多下载约 810KB（gzip 190KB）。
   改动集中在 `vite.config.ts` 一个函数，风险低、收益直接。

---

*报告生成于 2026-09-27 · 基线 commit `e11206a` · 审计范围 `src/`、`scripts/`、构建与部署配置*
*附录二（阶段 0–1 修复记录）追加于 2026-10-02*

