# 2026-10-09 代码审查 · P1：功能失效与静默失败

> **问题总数**：10 项
> **审计日期**：2026-10-09 · 基线 `c096944`
> **上一份**：[P0 数据正确性](./2026-10-09-audit-01-P0-data-correctness.md) · **下一份**：[P2 工程配置 · 安全 · 性能](./2026-10-09-audit-03-P2-engineering.md)

本报告收录「功能完全失效」「静默失败」「误导性展示」三类问题。它们不会产出错误数据，但会让用户要么什么都看不到，要么看到与事实不符的信息。

---

## P1-1　`ToastContainer.vue` 从未被挂载 → 所有 toast 提示静默丢失

### 位置
`src/components/common/ToastContainer.vue`（0 引用） · `src/composables/useToast.ts` · `src/tools/qrcode/QrcodePage.vue:217,219,254`

### 严重度
- **类型**：功能完全失效（静默）
- **影响工具**：二维码工具（当前唯一使用者）

### 触发场景
在二维码工具中点「生成」但生成失败。

### 后果
`QrcodePage.vue:254` 调用 `toastError('生成二维码时发生错误')`。`useToast.ts` 只往一个**模块级 `toasts` ref** 里 `push`，而唯一会渲染它的 `ToastContainer.vue` **从未被挂载到任何地方**：

```
App.vue               → 只有 <router-view />
main.ts               → 没有注册
DlsMainLayout.vue     → 没有引用
DlsHeader.vue         → 没有引用
```

全仓 grep `ToastContainer` 只有两个命中：`useToast.ts` 的定义、`ToastContainer.vue` 自身的 import。**用户看不到任何错误提示**，只会觉得"点了没反应"。

### 根因
`useToast` 是模块级单例，`ToastContainer` 是独立组件，两者之间没有应用级挂载点。这是"死组件拖累活功能"的典型：组件写了、composable 写了、调用方也写了，唯独缺一个 `<ToastContainer />`。

### 修复建议
**方案 A（推荐）**：在 `App.vue` 挂载：

```vue
<template>
  <router-view />
  <ToastContainer />
</template>

<script setup lang="ts">
import ToastContainer from '@/components/common/ToastContainer.vue'
</script>
```

**方案 B**：改为全局 provide + 挂载点，或直接用 daisyUI 的 `toast` 类（项目已依赖 daisyUI，可能更省心）。

### 工作量
15 分钟

### 验收标准
- [ ] 任意 toast 调用后，页面右上/右下出现可见提示并在数秒后消失
- [ ] 二维码生成失败时用户能看到错误信息
- [ ] 卸载页面时 toast 定时器被清理（`useToast.ts:17` 的 `setTimeout` 当前未 track）

---

## P1-2　`GeoDataPage` 的导出错误对话框永远不显示

### 位置
| 文件 | 行 | 代码 |
|---|---|---|
| `src/tools/geo_data/GeoDataPage.vue` | 208 | `:is-open="showErrorDialog"`（模板绑定） |
| `src/tools/geo_data/GeoDataPage.vue` | 339 | `const showErrorDialog = ref(false)` |
| `src/tools/geo_data/GeoDataPage.vue` | 342 | `const errorDialogOpen = ref(false)` |
| `src/tools/geo_data/GeoDataPage.vue` | 352, 356 | `showErrorDialogMsg()` 设置的是 `errorDialogOpen.value = true` |
| `src/tools/geo_data/GeoDataPage.vue` | 685 | `showErrorDialogMsg('error', '导出失败', ...)` |

### 严重度
- **类型**：静默失败
- **影响工具**：空间分析（导出 CSV / Excel）

### 触发场景
空间分析结果导出时发生异常。

### 后果
模板 `:208` 绑定的是 `showErrorDialog`，而 `showErrorDialogMsg()` 在 `:356` 设置的是**另一个变量** `errorDialogOpen`。所以 `:685` 调用完后，`showErrorDialog` 仍是 `false` → **用户看不到任何错误**，只会以为导出没反应。

文件里有两套平行变量：`showErrorDialog`（模板绑定）、`errorDialogOpen`（业务代码设置），后者**从未被模板使用**。

### 修复建议
删除 `errorDialogOpen`（`:342,348,356`），统一用 `showErrorDialog`。ESLint 的 `no-unused-vars` 其实已经在报 `'error' is defined but never used` 一类的信号，但 oxlint 不报这个规则，所以漏掉了。

### 工作量
15 分钟

### 验收标准
- [ ] 强制导出失败（如构造一个超长字符串）时，错误对话框可见
- [ ] 全仓不再有"设置 A 变量、模板读 B 变量"的模式（可用 grep 自检）

---

## P1-3　`opacity = 0` 被 `||` 吞掉，永远变成 0.5

### 位置
`src/utils/KmlGenerator.ts:239`

```ts
const color = formatColor(sector.color || '', sector.opacity || 0.5)
```

### 严重度
- **类型**：参数失效
- **影响工具**：基站转 KML

### 触发场景
基站扇区表的「半透明度」列填写 `0`（想要完全透明的填充）。

### 后果
`0 || 0.5` === `0.5`。用户填 `0` 和填 `0.5` 效果完全一样，填充永远是半透明的，遮挡底图。而填 `0.0001` 反而正常——这个不对称性正是 `||` 误判 falsy 值的特征。

模板校验允许 `0 ≤ opacity ≤ 1`（`table2kml_basestation/TemplateReader.ts:112`），所以 `0` 是合法输入。

### 修复建议
```ts
const opacity = sector.opacity ?? 0.5
const color = formatColor(sector.color ?? '', opacity)
```

同时 grep 全仓同模式：`grep -n "|| 0\.5\||| ''\||| 1\b" src/`，检查所有对**合法 0 值/空串**做 `||` 默认的地方。

### 工作量
10 分钟

### 验收标准
- [ ] 半透明度填 `0` → KML 中 fill 的 alpha 通道为 00（全透明）
- [ ] 半透明度留空 → 仍默认 0.5

---

## P1-4　文件名去重策略可产生新的重名，ZIP 内条目互相覆盖

### 位置
`src/tools/docx_template_export/docxTemplateFunctions.ts:254-260`（另在 `useTemplateExport.ts`、`useDocxTemplateExport.ts`、`useXlsxTemplateExport.ts` 内有 3 份拷贝）

```ts
const seen = new Map<string, number>()
return names.map((name) => {
  const count = seen.get(name) || 0
  seen.set(name, count + 1)
  if (count === 0) return name
  return `${name}(${count})`
})
```

### 严重度
- **类型**：静默丢失文件
- **影响工具**：模板导出（DOCX / XLSX）

### 触发场景
数据中存在字面量就叫 `a(1)` 的行。输入 `['a', 'a', 'a(1)']`：

| 输入 | 输出 | 结果 |
|---|---|---|
| `a` | `a` | ✅ |
| `a` | `a(1)` | ✅ |
| `a(1)` | `a(1)` | ❌ **与上一行撞名** |

JSZip 后续 `zip.file(name)` 同名覆盖 → **少一个文件，且 zip 生成时不报错**。用户拿到一个少了文件的 ZIP，无从察觉。

### 修复建议
```ts
const used = new Set<string>()
return names.map((name) => {
  if (!used.has(name)) { used.add(name); return name }
  let n = 1
  let candidate = `${name}(${n})`
  while (used.has(candidate)) {
    n++
    candidate = `${name}(${n})`
  }
  used.add(candidate)
  return candidate
})
```

> `used` 集合必须包含**所有最终输出**，而不只是原始输入。

### 工作量
20 分钟（改一处 + 同步其余 3 份拷贝，或先按 P3-2 收敛为 1 份）

### 验收标准
- [ ] 输入 `['a','a','a(1)']` → 输出 `['a','a(1)','a(2)']`
- [ ] 生成的 ZIP 条目数等于数据行数

---

## P1-5　`skipRows`（忽略行数）差一错，与界面文案不符

### 位置
| 文件 | 行 | 代码 |
|---|---|---|
| `src/tools/template_export/useTemplateExport.ts` | 437-439 | `rawDataList.value.slice(skipRows.value - 1)` |
| `src/tools/template_export/TemplateExportPage.vue` | 74 | 界面标注"默认 1 行" |

### 严重度
- **类型**：误导性参数
- **影响工具**：模板导出

### 触发场景
数据文件首行是垃圾数据，用户按界面提示把「忽略行数」填 `1`。

### 后果
`slice(1 - 1)` = `slice(0)` → **一行都不忽略**，垃圾行照样被渲染成文档。填 `2` 才真正忽略 1 行。

同时 `dataRowCount` 显示的是 slice 前的行数，与最终产出文档数不一致。

### 修复建议
```ts
const actualDataList = computed(() => rawDataList.value.slice(skipRows.value))
function setSkipRows(value: number) { skipRows.value = Math.max(0, value) }
```
并把界面文案改为「忽略前 N 行（0 = 不忽略）」，默认值改为 `0`。

### 工作量
15 分钟

### 验收标准
- [ ] `skipRows = 1` → 确实跳过 1 行
- [ ] `skipRows = 0` → 不跳过
- [ ] 界面提示的数据行数与实际产出一致

---

## P1-6　异站址模式下 XLSX 首行空单元格导致列数误判，整个文件被拒

### 位置
`src/tools/distance_sensor/TemplateReader.ts:36-53`

```ts
const firstRow = rows[0] || {}
const columns = Object.keys(firstRow).map((col) => col.trim())
const columnCount = columns.length
if (columnCount !== 3 && columnCount !== 6) {
  return { isValid: false, errors: [`模板列数不正确，需要3列（同站址）或6列（异站址），当前为${columnCount}列`] }
}
```

### 严重度
- **类型**：合法输入被拒 + 误导性错误信息
- **影响工具**：距离测算

### 触发场景
一个合法的 6 列异站址模板，其中**第一条数据**的「名称2 / 经度2 / 纬度2」为空。

### 后果
`sheet_to_json` **默认不给空单元格建 key**。第一行的 `data2` 三个字段为空 → `columnCount` = 3 → 走进「同站址」分支 → `getColumnName('名称')` 在后三个列里找不到 → **每一行都报「名称不能为空」**。

用户看到的是误导性的「模板列数不正确」或「名称不能为空」，而文件其实是合法的。

与 `utils/TemplateReader.ts` 用 `rawData + headerIndexMap`（从表头行推列数）的健壮做法不一致。

### 修复建议
列数从**表头行**推断，不从数据行的 key 数量推断：

```ts
// 方案：readAndValidateTemplate 接收 headerRow（sheet_to_json 的 header:1 输出）
const headerRow = rawData[0] ?? []
const columnCount = headerRow.length
```

或在 `readAndValidateTemplate` 的调用方改用 `XLSX.utils.sheet_to_json(ws, { header: 1 })` 拿二维数组，自行构建行对象并保证列数恒定。

### 工作量
约 2 小时

### 验收标准
- [ ] 6 列异站址模板 + 首行 `data2` 三列为空 → 正确识别为异站址模式
- [ ] `distance_sensor` 补一个 XLSX 导入的测试（现有单测全部走 CSV 数组路径，碰不到 `sheet_to_json` 的特性）

---

## P1-7　批量高程查询硬上限 100 条，且提示"请分批查询"却没有任何分批机制

### 位置
| 文件 | 行 | 代码 |
|---|---|---|
| `src/tools/elevations_batch/ElevationsBatchPage.vue` | 328 | `validationResult.value.data.length <= 100` |
| `src/tools/elevations_batch/ElevationsBatchPage.vue` | 441-446 | 已实现 100 条一批的分批循环 |
| `src/tools/elevations_batch/ElevationsBatchPage.vue` | 386-388 | 提示"请分批查询" |

### 严重度
- **类型**：功能缺失 + 误导性提示
- **影响工具**：批量高程查询

### 触发场景
导入超过 100 个坐标点。

### 后果
`:328` 的 `canExecuteQuery` 要求 `<= 100`，所以 `:441-446` 的分批循环**永远执行不到**（只有一批）。而 `:386-388` 提示用户"请分批查询"——但界面上**没有任何分批机制**，用户无路可走。

「批量」工具一次最多 100 行，名不副实。

### 修复建议
放开 `:328` 的上限（改为如 `<= 5000`），让已实现的分批循环真正生效。这同时是 P0-6 修复的前提——分批逻辑本来就是为超 100 条设计的。

### 工作量
20 分钟（与 P0-6 一起做）

### 验收标准
- [ ] 导入 250 个点 → 正常执行，分 3 批请求
- [ ] 超过上限时提示具体数字与真正的限制原因

---

## P1-8　README 声称"无需后端"，实际有 6 处在打 `/api/*`

### 位置
| 文件 | 行 | 代码 |
|---|---|---|
| `README.md` | 5, 7 | "所有工具均为纯 JS 实现……**无需后端服务器**" |
| `src/router/index.ts` | 85 | `fetch('/api/page-stats/${toolId}/view')` |
| `src/components/layout/DlsComment.vue` | 304, 316, 328, 341 | 评论 / 浏览量 |
| `src/components/layout/DlsChart.vue` | 216 | `fetch('/api/map-data?tool_id=...')` |
| `vercel.json` | 5 | 代理到 `http://8.137.195.0/api/$1` |

### 严重度
- **类型**：文档与实现矛盾
- **影响**：所有新接手者

### 后果
README 是新人（和 AI agent）的第一入口。它明确说"零服务端成本，静态文件部署即可分发，无需服务器运维、无需 API 代理"，而实际上一离开 Django 后端，评论、浏览量、地图数据三个功能全部失效，且 `vercel.json` 里就写着 API 代理。

同时**浏览量被重复统计**：

```
router/index.ts:85        POST /api/page-stats/{toolId}/view        ← 每次路由跳转
DlsComment.vue:328        POST /api/page-stats/{props.pageKey}/view ← onMounted → incrementView()
```

`DlsMoment.vue:20-23` 的 `currentPageKey` 就是 `route.params.toolId`，两者 key **完全相同**。默认 `.env` 开「势」tab 时，**同一次访问被计 2 次**。

### 修复建议
1. README 增加"后端依赖"章节，明确列出 3 个需要后端的特性，及其在后端不可用时的降级行为。
2. 删掉 `router/index.ts:85` 的埋点，统一由 `DlsComment` 的 `incrementView()` 负责（或反之），只保留一处。

### 工作量
30 分钟

### 验收标准
- [ ] README 与 `vercel.json`、`src/` 中的 `/api` 调用一致
- [ ] 打开一个工具页，network 面板只看到 1 次 `/view` 请求

---

## P1-9　`parseFloat` 宽松前缀解析，脏数据被"净化"成看似合法的坐标

### 位置
8 处：

| 文件 | 行 |
|---|---|
| `src/utils/coordinateConverter.ts` | 43-44 |
| `src/utils/templateHandler.ts` | 37 |
| `src/tools/coords_convert/templateReader.ts` | 82-83 |
| `src/tools/table2kml_point/TemplateValidator.ts` | 45, 46, 88, 96 |
| `src/tools/table2kml_basestation/TemplateReader.ts` | 52, 60 |
| `src/tools/distance_sensor/TemplateReader.ts` | 71-72 |
| `src/tools/elevation_query/ElevationQueryPage.vue` | 111-114 |
| `src/tools/weather_history/WeatherHistoryPage.vue` | 263 |

### 严重度
- **类型**：校验绕过
- **影响工具**：所有涉及坐标输入的工具

### 触发场景
用户在经度列填 `116.4abc`、`N39.9`、`39.9度` 等脏数据。

### 后果
`parseFloat('116.4abc')` === `116.4`，通过范围校验。用户以为自己的数据被完整读取，实际静默丢掉了后缀。对于**从其他系统复制粘贴过来的坐标**，这是很常见的场景。

类似的还有 `CsvParser.ts:89` 的 `Number(trimmed)`：接受 `'0x1A'` → 26、`'1e5'` → 100000、`'Infinity'` → Infinity。

### 修复建议
统一用一个严格的坐标解析函数：

```ts
// src/utils/numeric.ts
export function parseStrictNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
```

替换全部 8 处 `parseFloat`。

### 工作量
约 2 小时（1 个工具函数 + 8 处替换 + 补测试）

### 验收标准
- [ ] `116.4abc` / `N39.9` / `39.9度` 全部报"经度无效"
- [ ] `116.4` / `-39.9` / `1.16e2` / ` 116.4 `（带空格）正常通过
- [ ] `Infinity`、`0x1A` 被拒绝

---

## P1-10　`weatherHistoryChart` 缺数据时 `return {}`，把上一个图表清成空白

### 位置
| 文件 | 行 | 代码 |
|---|---|---|
| `src/tools/weather_history/weatherHistoryChart.ts` | 22, 96, ... | `return {}` |
| `src/composables/useECharts.ts` | 42-45 | `if (option) { chartInstance.setOption(option, true) }` |

### 严重度
- **类型**：展示异常
- **影响工具**：历史天气查询

### 触发场景
切换图表类型时新数据缺 `hourly.time` / `daily.precipitation_sum` 等字段。

### 后果
`{}` 是 **truthy**，所以 `if (option)` 判断通过 → `setOption({}, true)` 的第二个参数 `true` 是 `notMerge` → **把上一个已经渲染好的图表整个清成空白**。

用户看到图表区域突然变白，没有任何错误提示。

（注：`useECharts.ts` 本身有正确的 `onUnmounted` 清理——`98-101` 行 dispose + removeEventListener。此项只针对 `return {}` 的交互。）

### 修复建议
```ts
// weatherHistoryChart.ts：缺数据时返回 null
if (!hourly?.time || !hourly.temperature_2m) return null
```
并将各生成器的返回类型改为 `EChartsOption | null`。`useECharts.ts:43` 的 `if (option)` 已能正确处理 `null`。

### 工作量
30 分钟

### 验收标准
- [ ] 构造一个缺 `precipitation_sum` 的响应 → 切换到降水图表时，保持上一个图表不清空
- [ ] 类型签名改为 `EChartsOption | null`

---

## P1 汇总

| 编号 | 问题 | 位置 | 工作量 |
|---|---|---|---|
| P1-1 | `ToastContainer` 未挂载，toast 静默丢失 | `App.vue` | 15 min |
| P1-2 | 导出错误对话框绑定错变量 | `GeoDataPage.vue:208,342,356` | 15 min |
| P1-3 | `opacity = 0` 被 `||` 吞掉 | `utils/KmlGenerator.ts:239` | 10 min |
| P1-4 | 文件名去重新重名，ZIP 覆盖 | `docxTemplateFunctions.ts:254`（+3 份） | 20 min |
| P1-5 | `skipRows` 差一错 | `useTemplateExport.ts:438` | 15 min |
| P1-6 | XLSX 列数误判拒合法文件 | `distance_sensor/TemplateReader.ts:37` | 2 h |
| P1-7 | 批量高程 100 条硬上限 + 假提示 | `ElevationsBatchPage.vue:328,386` | 20 min |
| P1-8 | README/实现矛盾 + 浏览量双计 | `README.md:5`、`router/index.ts:85` | 30 min |
| P1-9 | `parseFloat` 宽松解析（8 处） | 见上表 | 2 h |
| P1-10 | `return {}` 清空上一个图表 | `weatherHistoryChart.ts:22,96` | 30 min |

> **合计约 0.75 人天**，其中 P1-1 / P1-2 / P1-3 / P1-5 / P1-10 五项**合计约 1.5 小时**，全部是「一行到几行的修复让一个功能从失效变为可用」。

---

*上一份：[P0 数据正确性](./2026-10-09-audit-01-P0-data-correctness.md) · 下一份：[P2 工程配置 · 安全 · 性能](./2026-10-09-audit-03-P2-engineering.md)*
