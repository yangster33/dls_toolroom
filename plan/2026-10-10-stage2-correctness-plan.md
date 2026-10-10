# 阶段 2 计划（正确性与健壮性 · 第三批）

- **日期**：2026-10-10（计划）／2026-10-10（执行）
- **项目**：dls_toolroom（Vue 3 + Vite + TS + Tailwind v4 + daisyUI 5 + Pinia 3，纯前端工具间）
- **依据**：[`docs/2026-10-09-audit-00-summary.md`](../docs/2026-10-09-audit-00-summary.md) 阶段 2
- **配套执行记录**：[`docs/2026-10-10-stage2-fix-record.md`](../docs/2026-10-10-stage2-fix-record.md)
- **相关提交**：`51ae048` P0-6 · `0a33d99` P0-5 · `589ef0c` P0-4

## 完成状态（2026-10-10 收尾）

按用户指定的顺序 **P0-6 → P0-5 → P0-4** 执行（改动更局部、验证更直接的优先）。

- **P0-6** ✅ 批量高程查询：分批 + 超时 + 逐点 error，缺失值不再当 0 米
- **P0-5** ✅ CGCS2000 参数清空：三层防御阻止 NaN 进导出文件
- **P0-4** ✅ 畸形几何：解析层拆 Multi*/GeometryCollection，分析层逐要素容错，UI 部分成功

**三项都属于「静默产出错误数据」**——用户后果与阶段 0 的 P0 同级，但修复成本更高（各 1.5～3 小时，涉及容错语义与 UI 设计）。

**门禁结果**：

| 检查项 | 阶段 2 前 | 阶段 2 后 |
|---|---|---|
| `type-check` | 0 错误 | ✅ 0 错误 |
| `oxlint` | 0/0 | ✅ 0/0（186 files） |
| `eslint` | 0 | ✅ 0 |
| `prettier --check` | 全符合 | ✅ 全符合 |
| `vitest` | 564 passed / 38 files | ✅ **577 passed / 39 files**（+13） |
| `npm run build` | 门禁前置 | ✅ 全链路通过 |

---

## 一、目标

消除三处**仍在产线的静默数据错误**：数据处理工具里，一个看似合理的错误数字比一个明确的报错危险得多。

---

## 二、实施明细

### P0-6 批量高程查询（`elevationService.ts` + `ElevationsBatchPage.vue`）

三条独立失效路径一次性修掉：

| # | 问题 | 修法 |
|---|---|---|
| a | 单 URL 拼全部点位，>100 点返 400，整个请求抛错 | `getElevations` 内部按 100 点分批，用 `URLSearchParams` 构造查询串 |
| b | 任一批失败后前几批的部分结果仍可下载 | 单批失败只标记该批（`elevation: NaN + error`），不影响其它批；页面用 `hasPartialFailures` 标记，下载文件名加 `_partial` |
| c | `data.elevation[index] ?? 0` → 缺失当 0 米 | 缺失/非数值返回 `NaN + error`，严格区分真实的 0 米海拔 |

顺带放开 100 条硬上限（原页面已实现分批循环却永远走不到），并加 `AbortSignal.timeout(15s)`。

### P0-5 CGCS2000 参数（`coordTransform.ts` + `coordConversion.ts` + `coordsConversion.ts` + `coordinateConverter.ts`）

清空输入框 → `''` → `NaN` → 沿链路传播。三层防御：

1. **`validateCGCS2000Params`** 集中校验；`buildCGCS2000ProjString` 参数无效直接 throw
2. **`convertAll`** 入口预检 + 未成功转换的目标用 `NaN` 占位（不再用 `0` 伪装成本初子午线）；`fromWGS84` 结果要求两端有限
3. **`coordsConversion`** 逐行 `Number.isFinite` 校验，不再只判 `length !== 2`

UI 层新增 `cgcsParamError` 实时校验 + 参数区红色警示 + 禁用「开始转换」按钮。

### P0-4 畸形几何（`geoDataService.ts` + `geoAnalysisService.ts` + `GeoDataPage.vue`）

分三层：

1. **解析层**：新增 `flattenGeometry`，把每个 feature 的 geometry 展开成「原子单几何」
   - `GeometryCollection`（KML `<MultiGeometry>` 经 togeojson 的产物）→ 递归展开
   - `MultiPoint`/`MultiLineString`/`MultiPolygon` → 拆成多个单几何
   - 展开后 coordinates 形状与 type 严格对应
2. **分析层**：9 个 `analyze*` 函数全部逐要素容错（`analyzeFeatureSafely`），坏要素记入 `result.errors` 并跳过
3. **UI 层**：`performAnalysisAsync` 逐类型 try/catch；结果表加「要素状态」列 + 可展开的跳过详情

---

## 三、实施偏差与计划外发现

### 3.1 覆盖了既有的 21 个测试（已修复）

写 P0-4 测试时直接新建 `geo_data/__tests__/geoAnalysisService.spec.ts`，**覆盖了原有的 21 个用例**——原文件本来就存在（审计报告里提过"现有的 geoAnalysisService.spec.ts 只构造合法几何"）。

发现方式：全量测试数从 564 掉到 553，核对文件后确认。

**处理**：从 `git show HEAD:...` 取回原文件，把我的 10 个用例追加到末尾（复用原有 `point/line/polygon` 辅助函数），保留全部 21 个原用例。这正是我在自己报告里反复强调的教训——"删/改代码时先确认它的引用与覆盖"。

**教训**：写新测试前应先确认目标文件是否已存在，而不是假定为新建。

### 3.2 KML 的 `<MultiGeometry>` 是 GeometryCollection，不是 MultiPoint

计划里 P0-4 的修复针对 GeoJSON 的 `MultiPoint`/`MultiLineString`。实测发现 KML 的 `<MultiGeometry>` 经 `togeojson` 转换后是 **`GeometryCollection`**（可能混合类型）：

```
node_modules/togeojson/togeojson.js:287
geometry: (geomsAndTimes.geoms.length === 1) ? geomsAndTimes.geoms[0] : {
    type: 'GeometryCollection', ...
```

旧代码 `default: return` 把整块丢弃。因此 `flattenGeometry` 必须额外处理 `GeometryCollection`——这是计划外的发现，由 `multiGeometrySplit.spec.ts` 的失败暴露。

### 3.3 带高程的坐标是 `[lng, lat, alt]`

测试里我最初断言单点 coordinates 是 `[116.4, 39.9]`，实际是 `[116.4, 39.9, 0]`——KML 坐标 `lon,lat[,alt]` 带高程时 GeoJSON 保留第三个分量。这是既有行为（非 bug），修正了测试期望。

---

## 四、测试策略

沿用「先写会因 bug 而失败的用例，再修」+ 反证：

| 修复 | 新增测试 | 反证方式 | 反证结果 |
|---|---|---|---|
| P0-6 | `elevationService.spec.ts`（11） | 还原 `?? 0` 逻辑 | ✅ 3 个用例立即失败 |
| P0-5 | `coordTransform.spec.ts`（21） | 移除 `buildCGCS2000ProjString` 的 throw | ✅ 2 个用例立即失败 |
| P0-4 | `geoAnalysisService.spec.ts` +10、`multiGeometrySplit.spec.ts`（3） | 移除 `analyzeFeatureSafely` 的 try/catch | ✅ 8 个用例以原始错误信息失败 |

---

## 五、明确不做（留在后续阶段）

| 项 | 原因 | 归入 |
|---|---|---|
| 空间分析 O(n²) + 逐次 `setTimeout(0)` | 性能问题，与本批正确性无关；需引入空间索引 | 阶段 2 剩余 / 阶段 3 |
| `push(...arr)` 大数据量崩溃（6 处） | 需构造万行级 fixture | 阶段 2 剩余 |
| `manualChunks` 顺序、首屏 810 kB | 需逐 chunk 核对产物 | 阶段 2 剩余 |
| `ref`→`shallowRef`、大文件 Worker 化 | 性能优化 | 阶段 3 |
| 模板读取器 7 份 → 参数化工厂 | 大重构 | 阶段 3 |
| 拆 `GanttChartPage.vue` / `KmlViewerPage.vue` | 大重构 | 阶段 3 |
| `vercel.json` 裸 IP → 环境变量 | 需 Vercel 控制台 | 阶段 4 |

---

## 六、遗留项

1. **阶段 2 其余项未做**：本批只做了三个 P0（静默数据错误）。`P0 汇总` 之外还有 P2 里的性能/健壮性项（`push(...arr)`、`manualChunks`、`shallowRef` 等）待排期。
2. **`GeoDataPage.vue` 的分析进度弹窗与类型级错误提示可能同时出现**——小概率 UX 问题，未进一步打磨。
3. **lefthook 未安装**（提交时提示 `Can't find lefthook in PATH`）——仓库配了 git hook 但本机没装，钩子未生效，需确认是否符合预期。
