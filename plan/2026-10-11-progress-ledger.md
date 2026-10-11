# 整改总台账（Progress Ledger）

> **用途**：单一事实来源，汇总各阶段已修/待办条目及其提交哈希。
> **维护方式**：每完成一批改动，更新「已完成」表与「待办」表状态。
> **配套**：各阶段的详细计划与执行记录见 `plan/2026-10-10-*.md`、`docs/2026-10-10-*.md`。

| 属性 | 值 |
|---|---|
| 审查基线 | `c096944`（2026-10-09 审计） |
| 台账更新 | 2026-10-11（A 档 5 项完成） |
| 当前 HEAD | `d43ff75` |
| 工具数 | 26 个路由（预渲染 sitemap） |
| 测试 | 606 passed / 43 files |

---

## 一、已完成台账

### 阶段 0 · 止血（提交 `161ac81`，2026-10-10）

| # | 编号 | 问题 | 提交 |
|---|---|---|---|
| 1 | P0-1 | CSV 空经纬度被当作 (0,0) 几内亚湾（4 处 + 共享 `coordinateValue.ts`） | ✅ |
| 2 | P0-2 | KML `<coordinates>` 无空格分隔时坐标错位（方案有变更，见记录 §3.1） | ✅ |
| 3 | P0-3 | 中文色名 Google 图钉是死代码（`PointRow.colorRaw`） | ✅ |
| 4 | P1-1 | `ToastContainer` 从未挂载，toast 静默丢失 | ✅ |
| 5 | P1-2 | `GeoDataPage` 错误对话框绑定错变量，导出失败不可见 | ✅ |
| 6 | P1-3 | `opacity = 0` 被 `\|\|` 吞成 0.5 | ✅ |
| 7 | P2-5 | 补声明幽灵依赖 `date-fns` | ✅ |
| 8 | P2-1 | 删死配置 `tailwind.config.js`（产物 MD5 证明无影响） | ✅ |
| 9 | P3-1 | 删 1114 行重构残留死代码 | ✅ |
| 10 | 旧P1-7 | `matchCount` 清空 → `k=0` → TypeError 崩溃 | ✅ |
| 附加 | P1-4 | `resolveDuplicates` 重名导致 ZIP 内文件互相覆盖 | ✅ |
| 附加 | — | `validateFilenameTemplate` 空占位符 + `generateFilename` 兜底两个死分支 | ✅ |
| 附加 | — | 删 29 个 `debug.log` 本地垃圾 | ✅ |

### 阶段 1 · 门禁生效（提交 `7c4489b` + `30a5403`，2026-10-10）

| # | 编号 | 问题 | 提交 |
|---|---|---|---|
| 1 | P2-3 | eslint **133 error → 0**（112 `no-explicit-any` + 17 unused + 2 其他） | ✅ |
| 2 | P2-4 | `vitest.config.ts` 独立化（不读 `.env`、不挂 mock/devtools） | ✅ |
| 3 | P2-2 | `build` 前置全部门禁，并反证会因 type error 中止 | ✅ |
| 4 | P2-9 | prettier 门禁 + 全仓格式化基线（216 files → 0） | ✅ |
| 5 | P2-6 | `engines` 收紧 `>=22.17.0`；CI/`.nvmrc` 统一 Node 24 | ✅ |
| 6 | P2-7 | `.env` 去重；`VITE_ENABLE_MOMENT_TAB` 默认值入码 | ✅ |
| 附加 | — | 给 `frappe-gantt` 补 `src/types/frappe-gantt.d.ts`（替代 `@ts-ignore`） | ✅ |
| 附加 | — | 修 3 个被 `as any` 掩盖的真 bug（turf v7 `intersect` 双参、`latLngBounds` 双参、leaflet `TileLayer.extend` 构造签名） | ✅ |
| 附加 | — | 清掉 `tsconfig.node.json` 引用的 `cypress.config.*` | ✅ |

### 阶段 2（部分）· 正确性（提交 `51ae048` / `0a33d99` / `589ef0c`，2026-10-10）

| # | 编号 | 问题 | 提交 |
|---|---|---|---|
| 1 | P0-6 | 批量高程查询：分批 + 超时 + 逐点 error；缺失值不再当 0 米 | ✅ |
| 2 | P0-5 | CGCS2000 参数清空：三层防御阻止 NaN 进导出文件 | ✅ |
| 3 | P0-4 | 畸形几何：解析层拆分 + 分析层逐要素容错 + UI 部分成功 | ✅ |

### 新增测试（相对基线 `c096944`）

| 文件 | 用例数 |
|---|---|
| `elevation_query/__tests__/elevationService.spec.ts` | 11 |
| `utils/__tests__/coordTransform.spec.ts` | 21 |
| `geo_data/__tests__/geoAnalysisService.spec.ts` | 追加 10（原 21 保留） |
| `geo_data/__tests__/multiGeometrySplit.spec.ts` | 3 |
| `utils/__tests__/coordinateValue.spec.ts` | 17 |
| `elevations_batch/__tests__/TemplateReader.spec.ts` | 13 |
| `get_add/__tests__/TemplateReader.spec.ts` | 5 |
| `template_export/__tests__/useTemplateExport.spec.ts` | 27 |
| **合计** | 524 → **577** |

### 门禁基线演进

| 检查项 | 基线 `c096944` | 当前 |
|---|---|---|
| `type-check` | 0 错误 | ✅ 0 |
| `oxlint` | 0 / 0 | ✅ 0 / 0 |
| `eslint` | ❌ 133 errors | ✅ **0** |
| `prettier --check` | ❌ 216 files 不符 | ✅ 全符合 |
| `vitest` | 524 / 35 files | ✅ **577 / 39 files** |
| `playwright`（生产构建） | 未验证 | ✅ 6 passed / 1 flaky |
| `npm run build` | 不带门禁 | ✅ 全链路通过 |

---

## 二、待办台账

### A 档 · 立即可做（约 1.5 小时）

| # | 编号 | 问题 | 工作量 | 状态 |
|---|---|---|---|---|
| A1 | P1-5 | `skipRows` 差一错：`slice(skipRows-1)`，填 1 等于不忽略 | 15 min | ⬜ |
| A2 | P1-10 | `weatherHistoryChart` 的 `return {}` 是 truthy → `setOption({},true)` 清空上一个图表 | 30 min | ⬜ |
| A3 | P2-12 | `geocodeStore` 的 `apiKeys` 明文持久化到 localStorage | 15 min | ⬜ |
| A4 | P2-13 | 无效 Key 时弹窗把含完整 Key 的 URL 渲染到 DOM | 20 min | ⬜ |
| A5 | P2-14 | GDACS 外链未过滤 `javascript:` 协议 | 20 min | ⬜ |

### B 档 · 值得排期（约 1.5 天）

| # | 编号 | 问题 | 工作量 | 状态 |
|---|---|---|---|---|
| B1 | P2-13 | `push(...arr)` / `Math.max(...arr)` 共 21 处，大数据量 `RangeError` | 3 h | ⬜ |
| B2 | P2-15 | 4 处裸 `fetch` 无 `AbortController` + 超时 | 2 h | ⬜ |
| B3 | P2-14 | `KmlViewerPage:611` fullscreenchange 监听器泄漏；甘特图重复实例化累积监听器 | 1 h | ⬜ |
| B4 | P2-11 | `manualChunks` 顺序错误，首屏 810 kB / 1.2 MB JS | 3 h | ⬜ |
| B5 | P1-9 | 8 处 `parseFloat` 宽松前缀，脏数据被"净化" | 2 h | ⬜ |

### C 档 · 需专门排期（各 1 天以上）

| # | 编号 | 问题 | 工作量 | 状态 |
|---|---|---|---|---|
| C1 | P1-6 | `distance_sensor` XLSX 首行空单元格 → 列数误判，合法文件被拒 | 2 h | ⬜ |
| C2 | 旧P1-9 | `CoordsConvertPage` 上传后切换坐标系 → 按错误语义解释坐标 | 2 h | ⬜ |
| C3 | P2-18 | 12 处 `ref` 承载大数组，Vue 深度代理内存 2–3 倍 | 2 h | ⬜ |
| C4 | P2-10 | 文件处理全内存同步，大文件卡死（需 Worker 化） | 3–5 d | ⬜ |

### D 档 · 大重构（阶段 3）

| # | 编号 | 问题 | 规模 | 状态 |
|---|---|---|---|---|
| D1 | P3-2 | 7 份 `TemplateReader` → 参数化工厂 | −800 行 | ⬜ |
| D2 | P3-2 | 5 份文件名模板 / 4 份花括号校验 / 3 份 `sanitizeFilename` → 各 1 份 | −400 行 | ⬜ |
| D3 | P3-3 | 删 12 个零引用依赖 + 850 行死代码 | 依赖体积 | ⬜ |
| D4 | P3-5 | 拆 `GanttChartPage.vue`(1623) / `KmlViewerPage.vue`(1157) / `GeocodeCommon.vue`(983) | 1 周 | ⬜ |

### E 档 · 需决策（非纯技术）

| # | 编号 | 问题 | 需要什么 | 状态 |
|---|---|---|---|---|
| E1 | P2-16 | `vercel.json` 裸 IP + 明文 HTTP 传输评论 PII | Vercel 控制台 | ⬜ |
| E2 | P1-8 | README 写"无需后端"，实际 6 处 `/api/*` 调用 | 文档更新 | ⬜ |
| E3 | — | 浏览量双计（`router:85` + `DlsComment:332`） | 决定保留哪一端 | ⬜ |
| E4 | — | lefthook 未装，git hook 从未生效 | 确认是否故意 | ⬜ |

---

## 三、已识别的教训（避免重复踩）

1. **改代码前先确认引用与覆盖**——阶段 2 曾因未检查文件已存在，覆盖掉既有 21 个测试用例。由全量测试计数差异（564→553）发现。
2. **`??` 兜不住 NaN**——proj4 失败返回 `NaN` 而非 `undefined`，`x ?? 0` 仍是 `NaN`。凡涉及第三方库的数值返回，必须 `Number.isFinite`。
3. **同一个 bug 会在 N 处出现**——`Number('')`、`endsWith('.csv')`、`push(...arr)`、`escapeXml` 都是这个模式。修复时应全局搜索同模式。
4. **测试断言的是「代码现在做什么」而非「应该做什么」**——`KmlGenerator.spec.ts` 曾因构造未规范化输入而假绿。
5. **计划赶不上变化**——P0-4 计划针对 GeoJSON `MultiPoint`，实测 KML `<MultiGeometry>` 是 `GeometryCollection`。端到端测试才能暴露这类。
