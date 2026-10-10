# 2026-10-09 代码审查 · P0：数据正确性

> **问题总数**：6 项，全部属于「**静默产出错误数据**」
> **审计日期**：2026-10-09 · 基线 `c096944`
> **上一份**：[总览与路线图](./2026-10-09-audit-00-summary.md)

---

## 关于 P0 的定义

本项目是纯前端数据处理工具，用户拿它的输出去做**基站选址、坐标转换、空间分析、高程测算**。因此：

> **一个明确的报错最多造成不便；一个看似合理的错误数字会造成工程决策失误。**

所以本报告的 6 项全部是"不报错、不提示、结果看起来完全正常，但数字是错的"。它们比崩溃类 bug 危险得多。

---

## P0-1　CSV 空经纬度被当作 (0, 0) 几内亚湾，静默产出错误高程/地址

### 位置
| 文件 | 行 | 代码 |
|---|---|---|
| `src/tools/elevations_batch/TemplateReader.ts` | 47, 69 | `const val = Number(row[alias])` |
| `src/tools/get_add/TemplateReader.ts` | 51, 74 | 同上 |
| `src/components/common/GeocodeCommon.vue` | 775 | `row[header] = isNaN(Number(value)) ? value : Number(value)` |

消费链路：`ElevationsBatchPage.vue:372 → 375 → 459-467`

### 严重度
- **类型**：静默数据损坏
- **影响工具**：批量高程查询、地址解析、经纬度查询

### 触发场景
CSV 模板（`名称,经度,纬度`）中某行的「经度」或「纬度」单元格**留空**。

### 后果
`CsvParser.ts` 在上一轮审计（P0-4）后已正确地把空单元格返回为 `''`。但三个消费方又把它变回数字：

```ts
// TemplateReader.ts:47
const val = Number(row[alias])       // Number('') === 0
if (!isNaN(val) && val >= -180 && val <= 180) {
  longitude = val                    // ← 0 落在合法区间内，通过校验
  break
}
```

于是该点位变成 `(0, 39.9)`——**几内亚湾**：

- **批量高程查询**：Open-Meteo 真实返回一个海平面海拔值（约 0 米），用户看到 `海拔 0.00 m`，无从察觉这是空值。
- **地址解析**：高德逆地理编码返回一个真实的海洋地址描述。
- **距离测算**：与 `(0°N, 0°E)` 处的基站匹配，得到一个看似合理的错误距离。

### 根因
这是上一轮已修复问题（`2026-09-27-audit-report.md` 的 P0-4）的**回归**：修复只做在解析层（`CsvParser.ts`、`templateHandler.ts`、`ElevationsBatchPage.vue`），没有推广到三个消费方。

**旁证这是漏洞而非设计**：同一个文件用 XLSX 导入会正常报错（`sheet_to_json` 不给空单元格建 key → `row[alias] !== undefined` 不成立 → 走"经度无效"分支），而 CSV 导入静默出错。两条路径行为不一致。

`CsvParser.spec.ts:76-81` 写有「空单元格保持空字符串」的回归用例——但解析层的修复被三个消费方逐条推翻了。

### 修复建议
三处统一改为显式判空：

```ts
for (const alias of lonAliases) {
  const raw = row[alias]
  if (raw === undefined || raw === null) continue
  const trimmed = String(raw).trim()
  if (trimmed === '') continue          // ← 关键：空字符串不是 0
  const val = Number(trimmed)
  if (!Number.isFinite(val) || val < -180 || val > 180) continue
  longitude = val
  break
}
```

`GeocodeCommon.vue:775`：

```ts
// 原：row[header] = isNaN(Number(value)) ? value : Number(value)
const trimmed = value.trim()
row[header] =
  trimmed !== '' && /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : value
```

> 更好的做法：让 `utils/TemplateReader.ts` 成为唯一入口，各工具只提供「字段映射表 + validateRow 回调」。

### 工作量
约 30 分钟（3 处 + 3 个回归测试）

### 验收标准
- [ ] `名称,经度,纬度\nA,,39.9\n` 导入后报「第 1 行：经度无效或超出范围」，且不产生任何 `CoordinatePoint`
- [ ] `名称,经度,纬度\nA,116.4,\n` 同样报纬度无效
- [ ] 合法数据行仍正常通过
- [ ] `npx vitest run` 无回归

---

## P0-2　KML `<coordinates>` 无空格分隔时坐标错位，线/面要素数量与内容均错误

### 位置
`src/utils/kmlCoordinates.ts:56-69`（`inferStride`）+ `:95-105`（主循环）

### 严重度
- **类型**：静默数据损坏 + 功能失效
- **影响工具**：KML 查看器、GIS 转表格、SHP 转表格、空间分析

### 触发场景
QGIS 或部分国产工具导出的 `<coordinates>` 使用「逗号连接、无空格分隔」：

```xml
<coordinates>116.3,39.9,116.4,40.0,116.5,40.1</coordinates>
```

### 后果
`inferStride` 在「文本含逗号」时**优先按 3 分组**：

```
6 个数字，6 % 3 === 0 → stride = 3
  i=0 → (116.3, 39.9)  ✅ 正确
  i=3 → (40.0, 116.5)  ❌ lat=116.5 > 90 → 被范围校验静默丢弃
  i=6 → 循环结束       ❌ 第 3 个真实点从未被访问
```

12 个数字（6 个点）时更糟：只输出第 1、4 个点，**2/6 个真实点位 + 若干错位后丢弃的坐标**。全程无任何警告。

该文件头注释明确声称：

```
 * 现实上存在多种写法，必须全部兼容：
 *   3. `116.3,39.9,116.4,40.0`            —— KML 2.2，无高程，纯逗号
 *   4. `116.3,39.9,0,116.4,40.0,0`        —— 无空白分隔
 * 本模块改为「提取全部数字 token + 按 stride 分组」，对上述 5 种写法均正确。
```

第 3/4 种写法在点数 `%3 == 0` 时是错的。`kmlCoordinates.spec.ts:26`（2 点）和 `:33`（4 数字）恰好绕开了 6 数字这个歧义区。

### 根因
`stride` 推断是**有损启发式**。当元组间分隔符与元组内分隔符相同时（都是逗号），仅凭数字个数无法区分「N 个二元组」和「N/3 个三元组」。

### 修复建议
**方案 A（推荐，简单且覆盖绝大多数真实数据）**：含逗号时优先按 2 分组，仅当按 2 分组有余数时才回退到 3。

```ts
function inferStride(text: string, numberCount: number): number {
  const hasComma = text.includes(',')
  if (hasComma) {
    // KML 2.2 无高程是主流（QGIS / 大部分国产工具默认导出）
    if (numberCount % 2 === 0) return 2
    return 3
  }
  if (numberCount % 2 === 0) return 2
  return 3
}
```

**方案 B（更稳，但成本高）**：先按**空白**切分元组，再对每个元组按逗号切字段；只有当切分后的元组全部 `< 2` 个字段时才走「纯数字 token + stride」的兜底路径。这能真正利用 KML 规范中「元组间有空白」这一信息。

**无论选哪个方案，都要补这个测试**：

```ts
it('纯逗号无空格的 3 个二元组', () => {
  expect(parseKmlCoordinates('116.3,39.9,116.4,40.0,116.5,40.1')).toEqual([
    { lng: 116.3, lat: 39.9 },
    { lng: 116.4, lat: 40.0 },
    { lng: 116.5, lat: 40.1 },
  ])
})
```

### 工作量
约 1 小时（改推断逻辑 + 补 3 个测试）

### 验收标准
- [ ] `116.3,39.9,116.4,40.0,116.5,40.1` → 3 个点，坐标不遗漏不错位
- [ ] 12 个数字（6 点）→ 6 个点
- [ ] 原有 5 种写法的用例全部仍通过
- [ ] `npx vitest run` 无回归

---

## P0-3　中文颜色名的 Google 图钉是死代码，功能 100% 失效且测试假绿

### 位置
| 文件 | 行 | 代码 |
|---|---|---|
| `src/tools/table2kml_point/KmlGenerator.ts` | 50-55 | `isChineseColor()` 恒返回 false |
| `src/tools/table2kml_point/TemplateValidator.ts` | 50, 52 | `color: parsedColor`（已规范化为 `#RRGGBB`）|

### 严重度
- **类型**：功能完全失效 + 测试假绿
- **影响工具**：表格转 KML

### 触发场景
用户在 Excel 模板的「颜色」列填写中文颜色名（如 `红色`、`蓝色`）。

### 后果
```ts
// KmlGenerator.ts:50-55
function isChineseColor(color: string): boolean {
  const parsed = parseColor(color)
  if (!parsed) return false
  // 如果原始颜色不是以 # 开头，但能解析出颜色值，则是中文颜色名
  return !color.trim().startsWith('#')      // ← 恒为 false
}
```

`TemplateValidator.ts:50,52` 已经把颜色规范化成 `#RRGGBB` 后才放进 `PointRow`：

```ts
const parsedColor = parseColor(colorRaw) || '#FF0000'
points.push({ name, lng, lat, folder, color: parsedColor })
```

所以进到 `generateKml` 的 `p.color` **一定以 `#` 开头** → `isChineseColor` 永远返回 `false` → `getChinesePushpinUrl()` 永远走不到。文档承诺的「中文色名 → 官方 6 色图钉」功能**完全失效，且无任何提示**，全部降级成"白底图标 + IconStyle 叠色"。

### 根因
**测试假绿**：`KmlGenerator.spec.ts:44-52` 直接构造 `color: '红色'` 的 `PointRow`，**绕过了 `TemplateValidator` 的规范化层**，所以断言能通过。e2e `kml-upload.spec.ts` 只校验下载文件名，不校验图标。二者叠加，这条链路是彻底的测试盲区。

### 修复建议
`PointRow` 需要同时保留原始输入与规范化值：

```ts
interface PointRow {
  name: string
  lng: number
  lat: number
  folder: string
  color: string      // 规范化后的 #RRGGBB，用于 IconStyle
  colorRaw?: string  // 用户原始输入，用于判定中文色名
}
```

`isChineseColor` 改为判定是否命中色名映射：

```ts
function isChineseColor(row: PointRow): boolean {
  const raw = (row.colorRaw ?? row.color).trim()
  return CHINESE_COLOR_MAP.has(raw) || raw in CHINESE_COLOR_TO_PUSHPIN
}
```

### 工作量
约 1 小时（改类型 + 改判定 + 补端到端测试）

### 验收标准
- [ ] 上传包含「颜色 = 红色」的 CSV，下载的 KML 中 `<Icon><href>` 指向 `red-pushpin.png`
- [ ] 上传包含「颜色 = #FF0000」的 CSV，走 IconStyle 叠色路径
- [ ] `KmlGenerator.spec.ts` 的用例改为经 `TemplateValidator` 规范化后的输入（消除假绿）

---

## P0-4　一条畸形几何让整场空间分析崩掉，已完成的结果全部丢弃

### 位置
| 文件 | 行 | 问题 |
|---|---|---|
| `src/tools/geo_data/geoAnalysisService.ts` | 55, 95, 186, 233, 281, 330, 378 | `turf.lineString` / `turf.polygon` 无 try/catch |
| `src/tools/geo_data/geoDataService.ts` | 208-235 | `MultiPoint` 标为 `Point`、`MultiLineString` 标为 `LineString`，coordinates 仍是嵌套结构 |

### 严重度
- **类型**：静默丢弃全部结果 + 类型断言被破坏
- **影响工具**：空间分析

### 触发场景
KML 中含以下**真实数据里很常见**的情况之一：

1. 一条只有 1 个点的 `<LineString>`（turf 要求 ≥ 2 点）
2. 一个 3 点未闭合的 `<Polygon>`（turf 要求每个 ring ≥ 4 点）
3. 一个 `<MultiGeometry>` / GeoJSON `MultiPoint` / `MultiLineString`

### 后果
turf v7 遇到上述输入直接抛错。`performAnalysisAsync` 整体 reject → **已算完的 N-1 个分析结果全部作废**，用户只看到一句 `分析失败: coordinates must contain at least 2 positions`，不知道是哪条数据、也不知道重跑会不会再炸。

`MultiPoint` 被标为 `Point` 时，`coordinates` 是 `number[][]` 而非 `number[]`，下游 `analyzePoints` 里 `经度: coords[0] ?? 0` 输出的是 `[lng,lat]` 数组 → Excel 单元格里出现 `116.4,39.9` 这种数组字符串。

`kmlCoordinates.spec.ts:132` 的注释自己都写着「审计 P1-3 提到 turf 会因未闭合环抛错」——解析层修好了，**分析层没修**。

### 修复建议

**(a) `Multi*` 拆分**（`geoDataService.ts:208-235`）：

```ts
case 'MultiPoint':
  // 拆成多个 Point 要素，而不是改标签
  feature.geometry.coordinates.forEach((c: number[], i: number) => {
    features.push({ id: `feature_${index}_${i}`, name: `${name} (${i + 1})`,
                    type: 'Point', coordinates: c, ... })
  })
  break
```

**(b) 逐 feature try/catch**（`geoAnalysisService.ts` 全部 6 个分析函数）：

```ts
for (const [i, feature] of features.entries()) {
  try {
    // ... turf.lineString / turf.polygon ...
  } catch (err) {
    errors.push(`${feature.name}: ${(err as Error).message}`)
    continue          // ← 不再让整个分析 reject
  }
  if (i % 500 === 0) await new Promise(r => setTimeout(r, 0))  // 让步粒度放到批次级
}
```

**(c) `GeoDataPage.vue` 改为部分成功赋值**：即使 `errors.length > 0` 也赋值 `analysisResults`，并在 UI 上明确展示「N 个要素分析失败」。

### 工作量
约 1 天

### 验收标准
- [ ] 含 1 点 LineString + 3 点未闭合 Polygon + MultiPoint 的 KML，其余要素的分析结果正常产出
- [ ] 畸形要素出现在 errors 列，不导致整体失败
- [ ] MultiPoint 在结果表中拆成多行，每行一个坐标点
- [ ] 补一个畸形几何的测试用例（现有的 `geoAnalysisService.spec.ts` 只构造合法几何）

---

## P0-5　CGCS2000 投影参数清空后，NaN 被写入导出文件 / 单点显示 0,0

### 位置
| 文件 | 行 | 代码 |
|---|---|---|
| `src/tools/coord_convert/CoordinateInput.vue` | 52, 62 | `v-model.number="cgcs2000Params.centralMeridian"` |
| `src/tools/coords_convert/CoordsConvertPage.vue` | 97 | `v-model.number` |
| `src/utils/coordTransform.ts` | 44 | `computeCentralMeridian('')` → `Math.round(NaN/3)*3` = `NaN` |
| `src/utils/coordinateConverter.ts` | 77-79, 107, 113 | proj4 抛错被 `catch` 吞成 `null`，或返回 `[NaN, NaN]` |
| `src/tools/coord_convert/coordConversion.ts` | 105-113 | `fromWGS84` 返回 null 时**保留初始的 `{lng:0, lat:0}`** |
| `src/tools/coords_convert/coordsConversion.ts` | 133-138 | 只检查 `converted.length !== 2`，`[NaN,NaN]` 顺利通过 |

### 严重度
- **类型**：静默数据损坏
- **影响工具**：坐标转换、批量坐标转换

### 触发场景
1. 清空「中央子午线经度」输入框（`v-model.number` 清空时产出 `''`）
2. 填写非数字
3. 比例因子填 `0`

### 后果
- **单点转换**：`coordConversion.ts:105-113` 在 `fromWGS84` 返回 `null` 时**保留了初始值 `{lng:0, lat:0}`**，界面显示 `0, 0`——看起来完全像一个合法坐标。
- **批量转换**：`coordsConversion.ts:133-138` 只校验 `converted.length !== 2`，`[NaN, NaN]` 长度是 2，顺利通过 → `convertToCsv` / `convertToXlsx` 把 `NaN` 写进结果文件。

用户拿到一份含 `NaN` 的 Excel，或一个坐标 `0,0`，都不会意识到参数没填对。

> 注意 `coordinateConverter.ts:107,113` 的 `[result[0] ?? 0, result[1] ?? 0]` **不能**兜住这个 case：`??` 只对 `null`/`undefined` 生效，proj4 失败返回的是 `NaN` 而非 `undefined`。

### 修复建议

**(a) 输入层**：CGCS2000 参数输入加 `isNaN` 前置校验，空值不允许进入计算。

**(b) `coordTransform.ts:44`**：

```ts
export function buildCGCS2000ProjString(p: CGCS2000Params): string {
  const cm = computeCentralMeridian(p.centralMeridian, p.zoneWidth)
  if (!Number.isFinite(cm) || !Number.isFinite(p.scaleFactor) || p.scaleFactor === 0) {
    throw new Error('CGCS2000 投影参数无效：请检查中央子午线、比例因子等输入')
  }
  // ...
}
```

**(c) `coordConversion.ts:105-113`**：失败时返回 `null` 并让调用方报错，不要保留 `{lng:0, lat:0}`。

**(d) `coordsConversion.ts:133-138`**：加 `Number.isFinite` 校验：

```ts
if (!converted || converted.length !== 2 ||
    !Number.isFinite(converted[0]) || !Number.isFinite(converted[1])) {
  errors.push(`第 ${i + 1} 行：坐标转换失败，请检查投影参数`)
  continue
}
```

### 工作量
约 2 小时

### 验收标准
- [ ] 清空中央子线框后点转换 → 明确报错，不显示 `0,0`
- [ ] 批量转换遇到无效参数 → 该行进 errors，`result.success` 为 false，不产出含 NaN 的文件
- [ ] 合法参数正常转换

---

## P0-6　批量高程查询：错误被丢弃、永远显示"成功"、缺失高程被当作 0 米

### 位置
| 文件 | 行 | 代码 |
|---|---|---|
| `src/tools/elevation_query/elevationService.ts` | 36-46, 61 | 全部点位拼进一个 URL；`data.elevation[index] ?? 0` |
| `src/tools/elevations_batch/ElevationsBatchPage.vue` | 459-467, 501-502 | `result.error` 被丢弃；`canDownload` 仍为 true |

### 严重度
- **类型**：静默数据损坏 + 误导性成功
- **影响工具**：批量高程查询、高程查询

### 触发场景
1. 导入 > 100 个坐标点（Open-Meteo 对超长 URL 返回 400）
2. 某一批请求失败（网络抖动 / 限流）
3. 接口返回条数少于请求条数

### 后果
三条独立的失效路径：

**(a) 单 URL 拼全部点位**（`elevationService.ts:41-45`）：
```ts
const latitudes = points.map(p => p.latitude).join(',')
const longitudes = points.map(p => p.longitude).join(',')
const response = await fetch(`${this.baseUrl}?latitude=${latitudes}&longitude=${longitudes}`)
```
超过约 100 个点，Open-Meteo 直接返 400。整个请求抛错。

**(b) 失败被吞且部分结果可下载**（`ElevationsBatchPage.vue:459-467`）：
```ts
results.forEach((result, index) => {
  queryResults.value.push({
    name: point!.name, longitude: ..., latitude: ...,
    elevation: result.elevation,        // ← result.error 被丢弃
  })
})
```
任一批失败 → `catch` 弹窗 → 但 `queryResults` 保留了**前几批的部分结果**，`canDownload` 仍为 `true` → 用户下载到一份「缺了后 80% 却看似完整」的 Excel。

**(c) 缺失值当 0 米**（`elevationService.ts:61`）：
```ts
elevation: data.elevation[index] ?? 0     // ← 接口少返一条，就变成"海平面"
```

### 修复建议

```ts
// elevationService.ts
async getElevations(points) {
  const BATCH = 100
  const results: ElevationResult[] = []
  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH)
    const params = new URLSearchParams({
      latitude: batch.map(p => p.latitude).join(','),
      longitude: batch.map(p => p.longitude).join(','),
    })
    const res = await fetch(`${this.baseUrl}?${params}`, {
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      // 整批标记为失败，不要混入成功结果
      batch.forEach(p => results.push({ ...p, elevation: NaN, error: `HTTP ${res.status}` }))
      continue
    }
    const data = await res.json()
    batch.forEach((p, idx) => {
      const e = data.elevation?.[idx]
      results.push({ ...p, elevation: typeof e === 'number' ? e : NaN,
                     error: typeof e === 'number' ? undefined : '接口未返回该点高程' })
    })
  }
  return results
}
```

消费侧：

```ts
// ElevationsBatchPage.vue
if (queryResults.value.some(r => r.error !== undefined)) {
  partialResults.value = true          // 明确标记"部分失败"
}
// canDownload 增加 partialResults 提示；下载文件名加 _partial 后缀
```

**同时修 `ElevationsBatchPage.vue:328` 的 100 条硬上限**：既然已实现分批循环（`:441-446`），应放开上限让分批真正生效，而不是让用户"请分批查询"却没有任何分批机制。

### 工作量
约 3 小时

### 验收标准
- [ ] 导入 250 个点 → 分 3 批请求，全部成功
- [ ] 某批失败 → 该批点标记 error，`partialResults` 为 true，下载文件名带 `_partial`
- [ ] 接口少返一条 → 该点高程为 `null`/NaN 并在表格中标红，**不是 0**
- [ ] 缺失/失败点不计入"成功"计数

---

## P0 汇总

| 编号 | 问题 | 位置 | 类型 | 工作量 |
|---|---|---|---|---|
| P0-1 | CSV 空经纬度 → (0,0) 几内亚湾 | `TemplateReader.ts` ×3、`GeocodeCommon.vue:775` | 静默数据损坏 | 30 min |
| P0-2 | KML coordinates 逗号无空格错位 | `kmlCoordinates.ts:56-69` | 静默数据损坏 | 1 h |
| P0-3 | 中文色名图钉死代码 | `KmlGenerator.ts:50-55` | 功能失效 + 假绿 | 1 h |
| P0-4 | 坏几何丢弃全部分析结果 | `geoAnalysisService.ts`、`geoDataService.ts:208` | 静默丢弃结果 | 1 d |
| P0-5 | CGCS2000 参数清空 → NaN 进文件 | `coordTransform.ts:44` 等 6 处 | 静默数据损坏 | 2 h |
| P0-6 | 批量高程失败被吞 + 缺失当 0 米 | `elevationService.ts:36-61`、`ElevationsBatchPage.vue:459` | 静默数据损坏 | 3 h |

> **合计约 1.5 人天**，其中 P0-1/P0-2/P0-3 三项**合计 2.5 小时**即可消除三类静默错误/失效，投入产出比最高。

---

## 附：为什么这些问题能一路存活到线上

三轮证据：

1. **测试没有覆盖消费方**：`CsvParser.spec.ts` 测了解析器，但没有一个测试从「读 CSV」走到「发出请求」。
2. **测试断言的是「代码现在做什么」而非「应该做什么」**：`KmlGenerator.spec.ts` 构造未规范化的 `PointRow`，恰好绕过了生产链路。
3. **`npm run build` 不跑任何门禁**，CI 的 lint 又只跑永远绿的 oxlint。

**建议的结构性改进**：为每个 A 模式工具补一条「上传 → 校验 → 产出」的端到端集成测试，用最小 fixture 走完整链路。这是上一轮审计指出的缺口，本轮仍未补上。

---

*上一份：[总览与路线图](./2026-10-09-audit-00-summary.md) · 下一份：[P1 功能失效与静默失败](./2026-10-09-audit-02-P1-functional.md)*
