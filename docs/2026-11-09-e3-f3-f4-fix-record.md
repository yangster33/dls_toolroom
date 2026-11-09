# 2026-11-09 · E3 / F3 / F4 修复记录

> **依据**：[`../plan/2026-10-11-progress-ledger.md`](../plan/2026-10-11-progress-ledger.md) 的 **E3 / F3 / F4**
> **提交**：`5d761a5`
> **状态**：E3 ✅ / F3 ✅ / F4 ✅
> **测试**：884 passed / 71 files（master；新增 7 条）

---

## 一、E3 · 浏览量双计

### 问题

同一页面浏览被上报两次：

- `router/index.ts` 的 `afterEach`：`POST /api/page-stats/{toolId|pageName}/view`
- `DlsComment.vue` 的 `onMounted`：再次 `POST /api/page-stats/{pageKey}/view`

### 修法

保留 router 作为**唯一**浏览量入口；`DlsComment` 只保留 `fetchComments` / `fetchStats`，删除 `incrementView()`。

理由：

- router 覆盖所有页面（工具页、列表页、首页），而 `DlsComment` 只在评论区挂载；
- 组件在 tab 切换/重新挂载时也会再次触发，天然不适合计数。

### 测试

`DlsComment.spec.ts` 新增一条：挂载后筛出所有 `/view` + `POST` 调用，断言为 0。

### 已知边界

首次进入评论区时，`fetchStats` 与 router 的 `POST /view` 是并发的，统计数字可能暂时少 1；下次进入即为准确值。这是“只保留一端”的取舍，不再产生重复计数。

---

## 二、F3 · 三页页内 XLSX 解析统一走 filePipeline

### 覆盖页面

| 页面 | 改动 |
|---|---|
| `elevations_batch/ElevationsBatchPage.vue` | XLSX 分支改 `filePipeline.parse` + `matrixToRows` |
| `distance_sensor/DistanceSensorPage.vue` | XLSX 分支改 `filePipeline.parse` + 现有 `aoaToTemplateRows` |
| `components/common/geocode/useGeocodeWorkflow.ts` | XLSX 分支改 `filePipeline.parse` + `matrixToRows` |

CSV 分支保持原样（`file.text()` + 共享 `parseCSV`），因为 CSV 解析成本远低于 XLSX。

### 新增通用行整形

`utils/templateMatrix.ts` 新增：

```ts
matrixToRows(matrix, onProgress?, signal?)
```

职责与 `distance_sensor/templateRows.aoaToTemplateRows` 一致：

- 列名/列数从表头行推；
- 整行空白跳过；
- 空单元格补 `''`，保证每行 key 集合与表头一致；
- 每 500 行 `yield` 并复查 `signal`。

### 进度映射

三页统一：

- 解析阶段 0→30，映射到进度条 10→30；
- 行整形阶段 0→100，映射到 30→100。

### 收益

- `XLSX.read + sheet_to_json` 不再阻塞主线程；
- 导入期间点“取消”会贯通到 Worker（`worker.terminate()`），不再只能停在逐行校验阶段；
- 三条链路与 `TemplateReader` 使用同一份 `parseTemplateMatrix`，行为一致。

### 测试

`utils/__tests__/templateMatrix.spec.ts` 新增 5 条：表头映射、空单元格补空串、空行跳过、空表头保列、AbortError、进度区间。

---

## 三、F4 · GeoFeature 不再强引用原始 GeoJSON

### 问题

`geoDataService.GeoFeature` 有一个 `feature: GeoJSON.Feature` 字段，并把 togeojson 的整个 feature 挂到每个拆分子要素上。大文件下同一份几何/属性被长期强引用，内存放大。

### 修法

- 从 `GeoFeature` 删除 `feature` 字段；
- `parseKML` / `parseKMZ` 两处构造 `features.push({...})` 删除 `feature,`；
- 分析链路只依赖 `coordinates` / `properties`，功能不变。

### 测试

`multiGeometrySplit.spec.ts` 新增：`parseKML` 结果的每个 feature 都不存在 `feature` 属性。

---

## 四、验证

| 检查 | 结果 |
|---|---|
| `npm run type-check` | ✅ 0 错误 |
| `oxlint` / `eslint`（改动范围） | ✅ 0 / 0 |
| `prettier --check` | ✅ |
| `npx vitest run` | ✅ **884 passed / 71 files** |
| `npm run build-only` | ✅ 成功 |

---

## 五、剩余

- **E1**：`vercel.json` 裸 IP + HTTP，需 Vercel 控制台；
- **E2 / E4**：确认后关闭台账；
- ~~**F1**：部署侧 CSP `worker-src 'self'`~~ —— ✅ 2026-11-09 已由 `cfee896` 完成；
- ~~**F2**：xlsx 导出边框，产品决策~~ —— ✅ 2026-11-09 已由 `28f7196` 完成；
- **F5**：togeojson 嵌套 MultiGeometry 上游限制。
