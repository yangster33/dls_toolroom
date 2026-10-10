# 2026-10-10 · 阶段 2 执行记录

> **执行日期**：2026-10-10
> **依据报告**：[2026-10-09 审查总览](./2026-10-09-audit-00-summary.md) 阶段 2
> **对应计划**：[`../plan/2026-10-10-stage2-correctness-plan.md`](../plan/2026-10-10-stage2-correctness-plan.md)
> **提交**：`51ae048` P0-6 · `0a33d99` P0-5 · `589ef0c` P0-4
> **状态**：✅ 三个 P0 全部完成，门禁全绿

---

## 一、核心指标

| 检查项 | 阶段 2 前 | 阶段 2 后 |
|---|---|---|
| `npm run type-check` | 0 错误 | ✅ 0 错误 |
| `npx oxlint .` | 0 / 0 | ✅ 0 / 0（186 files） |
| `npx eslint .` | 0 | ✅ 0 |
| `npx prettier --check .` | 全符合 | ✅ 全符合 |
| `npx vitest run` | 564 passed / 38 files | ✅ **577 passed / 39 files** |
| `npm run build` | 门禁前置 | ✅ 全链路通过（lint→type-check→test→build→prerender） |

**改动规模**：3 个提交，+约 1200 / −约 300 行。

---

## 二、三项完成情况

按用户指定顺序 **P0-6 → P0-5 → P0-4**（改动更局部、验证更直接的优先）。

### 2.1 P0-6 批量高程查询（提交 `51ae048`）

三条独立失效路径：

| # | 问题 | 修法 |
|---|---|---|
| a | 单 URL 拼全部点位 → >100 点返 400 → 整个请求抛错 | 内部按 100 点分批 + `URLSearchParams` + 15s 超时 |
| b | 任一批失败后，前几批的部分结果仍可下载 | 单批失败只标记该批；页面 `hasPartialFailures` + 文件名 `_partial` |
| c | `?? 0` 把缺失当 0 米 | 缺失/非数值 → `NaN + error`，严格区分真实 0 米海拔 |

**额外**：放开 100 条硬上限（原页面已实现分批循环却永远走不到，用户被提示"请分批查询"但没有任何分批机制）。

### 2.2 P0-5 CGCS2000 参数（提交 `0a33d99`）

清空输入框 → `''` → `NaN` → 沿链路传播，旧代码只判 `length !== 2`（`[NaN,NaN]` 长度也是 2）→ NaN 被写进导出 Excel；单点转换则保留 `{lng:0, lat:0}` 伪装成本初子午线。

**三层防御**：

1. `validateCGCS2000Params` 集中校验 + `buildCGCS2000ProjString` 参数无效直接 throw
2. `convertAll` 入口预检；未成功转换的目标用 `NaN` 占位（不再用 `0`）
3. `coordsConversion` 逐行 `Number.isFinite` 校验

**关键细节**：`coordinateConverter.ts` 的 `result[0] ?? 0` **兜不住**这个 case —— `??` 只对 null/undefined 生效，proj4 失败返回的是 `NaN`。改为 `Number.isFinite` 校验。`toWGS84` 的 `cgcs2000_xy` 分支还要校验**中间结果**，否则含 NaN 的中间值会被继续喂给下一个 proj4 调用。

### 2.3 P0-4 畸形几何（提交 `589ef0c`）

**分三层**：

1. **解析层** `flattenGeometry`：把每个 feature 的 geometry 展开成「原子单几何」
2. **分析层**：9 个 `analyze*` 逐要素容错（`analyzeFeatureSafely`），坏要素记入 `result.errors`
3. **UI 层**：`performAnalysisAsync` 逐类型 try/catch；结果表加「要素状态」列 + 可展开的跳过详情

---

## 三、三个值得记录的发现

### 3.1 我覆盖了既有的 21 个测试（本阶段最大的失误）

写 P0-4 测试时直接 `write` 新建 `geo_data/__tests__/geoAnalysisService.spec.ts`，**没先检查它是否已存在**——它本来就有 21 个用例（审计报告甚至提过"现有的 geoAnalysisService.spec.ts 只构造合法几何"）。

**发现方式**：全量测试数从 564 掉到 553（少 11），核对文件后确认原文件 21 个用例被覆盖成 10 个。

**修复**：`git show HEAD:...` 取回原文件 → 我的 10 个用例追加到末尾（复用原有 `point/line/polygon` 辅助函数）→ 验证 21 + 10 = 31 全在。

**教训**：这正是我在自己报告里反复强调的"改代码前先确认引用与覆盖"。写新测试前应 `Test-Path` / `git ls-files` 确认，而不是假定为新建。**好在这一步被全量测试计数差异抓到**——如果没有 CI 跑全量测试，这个覆盖损失会静默漏过。

### 3.2 KML 的 `<MultiGeometry>` 是 GeometryCollection，不是 MultiPoint

计划里 P0-4 针对 GeoJSON 的 `MultiPoint`/`MultiLineString`。实测发现 KML 的 `<MultiGeometry>` 经 `togeojson` 转换后是 **`GeometryCollection`**：

```
node_modules/togeojson/togeojson.js:287
geometry: (geomsAndTimes.geoms.length === 1) ? geomsAndTimes.geoms[0] : {
    type: 'GeometryCollection', ...
```

旧代码 `default: return` 把整块丢弃。这个发现是 `multiGeometrySplit.spec.ts` 的失败暴露的——如果只按计划写代码、不写端到端测试，就会漏掉这类。

### 3.3 带高程的坐标是 `[lng, lat, alt]`

测试里我最初断言单点 coordinates 是 `[116.4, 39.9]`，实际是 `[116.4, 39.9, 0]`。KML 的 `lon,lat[,alt]` 带高程时 GeoJSON 保留第三分量。这是**既有行为，非 bug**——修正了测试期望而非改代码。

---

## 四、验证与反证

| 修复 | 新增测试 | 反证方式 | 反证结果 |
|---|---|---|---|
| P0-6 | `elevationService.spec.ts`（11） | 临时还原 `?? 0` | ✅ 3 个用例立即失败 |
| P0-5 | `coordTransform.spec.ts`（21） | 移除 `buildCGCS2000ProjString` 的 throw | ✅ 2 个用例立即失败 |
| P0-4 | `geoAnalysisService.spec.ts` +10、`multiGeometrySplit.spec.ts`（3） | 移除 `analyzeFeatureSafely` 的 try/catch | ✅ 8 个用例以 `coordinates must contain at least 2 positions` 失败 |

P0-4 的反证尤其有说服力：失败信息正是审计报告里描述的**原始症状**，证明这些用例确实在守护那个 bug。

---

## 五、测试清单（新增 13 个用例）

**`elevation_query/__tests__/elevationService.spec.ts`（11）**
- 250 点分 3 批、每批 ≤100；空数组不发请求
- 第 2 批失败只影响该批（前 100 与后 50 仍返回真实高程）；网络抛错同样只影响该批
- 接口少返一条 → NaN + error，不是 0
- 接口返回 null / 'abc' / 缺 elevation 字段 → 全部标记失败
- 真实的 0 米高程（海平面）必须保留

**`utils/__tests__/coordTransform.spec.ts`（21）**
- `validateCGCS2000Params` 覆盖空串/NaN/越界/0/非 3或6 度带
- `buildCGCS2000ProjString` 合法参数 + 无效参数 throw
- `computeCentralMeridian` 3 度带与 6 度带（含公式边界值）
- `convertAll` 无效参数返回 null、不产出含 0,0 的假结果
- 合法参数下各目标坐标系均为有限数

**`geo_data/__tests__/geoAnalysisService.spec.ts`（追加 10，原 21 保留）**
- 1 点 LineString / 未闭合 3 点环被跳过，好要素照常分析
- 坏线/坏面在各分析类型下只影响自身组合
- 取消仍抛错，不被容错吞掉

**`geo_data/__tests__/multiGeometrySplit.spec.ts`（3）**
- MultiPoint → 3 个独立 Point（coordinates 是平铺 `[lng,lat]`）
- MultiLineString → 2 个独立 LineString
- 单 Point 不受影响

---

## 六、遗留与下一步

1. **阶段 2 其余项未做**：本批只做三个 P0（静默数据错误）。性能/健壮性项（`push(...arr)` 崩溃、`manualChunks`、`shallowRef`、空间分析 O(n²)）待排期。
2. **`GeoDataPage.vue` 的分析进度弹窗与类型级错误提示可能同时出现**——小概率 UX 问题，未打磨。
3. **lefthook 未安装**：提交时提示 `Can't find lefthook in PATH`，git hook 未生效，需确认是否符合预期。

---

*上一份：[阶段 1 执行记录](./2026-10-10-stage1-fix-record.md) · 回到：[审查总览](./2026-10-09-audit-00-summary.md)*
