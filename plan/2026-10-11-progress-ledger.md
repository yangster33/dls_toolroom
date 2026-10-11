# 整改总台账（Progress Ledger）

> **用途**：单一事实来源，汇总各阶段已修/待办条目及其提交哈希。
> **维护方式**：每完成一批改动，更新「已完成」表与「待办」表状态。
> **配套**：各阶段的详细计划与执行记录见 `plan/2026-10-10-*.md`、`docs/2026-10-10-*.md`。

| 属性 | 值 |
|---|---|
| 审查基线 | `c096944`（2026-10-09 审计） |
| 台账更新 | 2026-10-11（A 档 + B 档 + C 档 C1~C3 完成） |
| 当前 HEAD | `1f53c9d` |
| 工具数 | 26 个路由（预渲染 sitemap） |
| 测试 | 693 passed / 50 files |
| 最近更新 | 2026-10-11 · A 档 5 项 + B 档全部 + C 档 C1~C3 |

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
| A 档新增：`skipRows`/`weatherHistoryChart`/`geocodeStore`/`amapService`(追加)/`safeUrl` | +29 |
| B3 新增：`kml_viewer/__tests__/KmlViewerPage.spec.ts` | +4 |
| B2 新增：`fetchWithTimeout`(22) / `weatherHistoryService`(4) / `earthquakeService`+2 / `gdacsService`+2 / `DlsComment`(3) | +33 |
| B1 新增：`arrayUtils`(14) / `TemplateExporter`追加(3) | +17 |
| B5 新增：`templateHandler`+3 / `CsvParser`+3 / `TemplateValidator`+2 / `TemplateReader`(基站)+3 | +11 |
| B4 新增：无（构建配置，以首屏体积与 e2e 验收） | — |
| C1 新增：`distance_sensor/__tests__/TemplateReader.spec.ts` | +13 |
| C2 新增：`coordsConversion.spec.ts` 追加 | +5 |
| C3 新增：`utils/__tests__/shallowRefArray.spec.ts` | +4 |
| **合计** | 524 → **693** |

### 门禁基线演进

| 检查项 | 基线 `c096944` | 当前 |
|---|---|---|
| `type-check` | 0 错误 | ✅ 0 |
| `oxlint` | 0 / 0 | ✅ 0 / 0 |
| `eslint` | ❌ 133 errors | ✅ **0** |
| `prettier --check` | ❌ 216 files 不符 | ✅ 全符合 |
| `vitest` | 524 / 35 files | ✅ **693 / 50 files** |
| `playwright`（生产构建） | 未验证 | ✅ 6 passed / 1 flaky |
| `npm run build` | 不带门禁 | ✅ 全链路通过 |

---

## 二、待办台账

### A 档 · 立即可做（约 1.5 小时）

| # | 编号 | 问题 | 工作量 | 状态 |
|---|---|---|---|---|
| A1 | P1-5 | `skipRows` 差一错：`slice(skipRows-1)`，填 1 等于不忽略 | 15 min | ✅ `f013589` |
| A2 | P1-10 | `weatherHistoryChart` 的 `return {}` 是 truthy → `setOption({},true)` 清空上一个图表 | 30 min | ✅ `5957c24` |
| A3 | P2-12 | `geocodeStore` 的 `apiKeys` 明文持久化到 localStorage | 15 min | ✅ `81f9099` |
| A4 | P2-13 | 无效 Key 时弹窗把含完整 Key 的 URL 渲染到 DOM | 20 min | ✅ `7a7a285` |
| A5 | P2-14 | GDACS 外链未过滤 `javascript:` 协议 | 20 min | ✅ `248b485` |

### B 档 · 值得排期（✅ 全部完成，2026-10-11）

| # | 编号 | 问题 | 工作量 | 状态 |
|---|---|---|---|---|
| B1 | P2-19 | `push(...arr)` / `Math.max(...arr)` 共 20 处，大数据量 `RangeError`（另 ganttTaskUtils 已于前批次修复） | 3 h | ✅ `460c002` |
| B2 | P2-15 | 4 处裸 `fetch` 无 `AbortController` + 超时 | 2 h | ✅ `c8903b5` |
| B3 | P2-14 | `KmlViewerPage:611` fullscreenchange 监听器泄漏；甘特图重复实例化累积监听器 | 1 h | ✅ `c93a842` |
| B4 | P2-11 | `manualChunks` 判据撞车，首屏含 datepicker/draggable；实测 387 KB→129 KB (gzip) | 3 h | ✅ `b98b0cd` |
| B5 | P1-9 | `parseFloat` 宽松前缀，脏数据被"净化"（审计 8 处，实修 10 文件 20+ 站点） | 2 h | ✅ `b4c66c2` |

### C 档 · 需专门排期（✅ C1~C3 完成，2026-10-11；C4 待单独立项）

| # | 编号 | 问题 | 工作量 | 状态 |
|---|---|---|---|---|
| C1 | P1-6 | `distance_sensor` XLSX 首行空单元格 → 列数误判，合法文件被拒（列数改从表头推） | 2 h | ✅ `2eebf23` |
| C2 | P0-5 余项 | `CoordsConvertPage` 上传后切换坐标系 → 按错误语义解释坐标（阶段 2 只修了 CGCS2000 NaN，快照未做） | 2 h | ✅ `a9b09f4` |
| C3 | P2-18 | 只读大数组 `ref` → `shallowRef`，避免深代理内存翻倍（审计 5 文件中 3 处是 push 累积，未纳入） | 2 h | ✅ `1f53c9d` |
| C4 | P2-20 | 文件处理全内存、同步、无分块、无 Worker，大文件卡死主线程 | 3–5 d | ⬜ |

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

---

## 三-A、A 档执行明细（2026-10-11 完成）

> A 档 = 「立即可做」5 项，合计预估 1.5 小时，实际约 3 小时（含调试与返工）。

| # | 编号 | 提交 | 变更 | 新增测试 |
|---|---|---|---|---|
| A1 | P1-5 | `f013589` | `slice(skipRows-1)` → `slice(skipRows)`；默认 1→0；抽出模块级 `normalizeSkipRows`；UI 文案与行数提示同步 | `template_export/__tests__/skipRows.spec.ts` ×6 |
| A2 | P1-10 | `5957c24` | 3 文件 8 处 `return {}` → `return null`，返回类型同步 `EChartsOption \| null` | `weather_history/__tests__/weatherHistoryChart.spec.ts` ×4 |
| A3 | P2-12 | `81f9099` | `persist: true` → `pick` 白名单；`apiKeys` 退出 localStorage | `stores/__tests__/geocodeStore.spec.ts` ×3 |
| A4 | P2-13 | `7a7a285` | 新增 `maskSensitiveUrl`；`validateApiKey` 返回值脱敏；删"复制 URL"提示；**改掉 1 条固化 Key 外泄的旧断言** | `amapService.spec.ts` 追加 ×6 |
| A5 | P2-14 | `248b485` | 新增 `utils/safeUrl.ts`；GDACS + 地震两处 `:href` 接入 | `utils/__tests__/safeUrl.spec.ts` ×10 |
| — | lint 修复 | `ebef5bb` | A5 引入 `no-control-regex`，正则改逐字符 `stripControlChars` | — |

**测试增量**：577 → 606（+29）

### A 档期间踩到的坑（重要经验）

1. **Pinia 3.0.4 插件安装语义**（A3 最大耗时点）
   `pinia.use(plugin)` 在没有 active app 时只把插件推进 `toBeInstalled` 队列，
   必须 `app.use(pinia)`（即 `install()`）才搬进 `_p`，而 store 创建时才读 `_p`。
   → 测试里只写 `createPinia + use + setActivePinia`，插件根本不执行，
     `$persist` 恒 undefined，写入库恒空，「不含 Key」退化成**空集合上的假绿**。
     修正：`createApp({ render: () => null }).use(pinia)`，与 main.ts 一致。

2. **两次覆盖既有测试文件**（A3 / A4 各一次）
   A3 写 `geocodeStore.spec.ts`、A4 写 `amapService.spec.ts` 时直接 write 新建，
   未先确认文件已存在，覆盖了原有 3 个和 19 个用例。
   A3 由测试数 587→583 发现；A4 由"24 passed 但原文件 19 用例"发现。
   两次均 `git show HEAD:` 取回原文后改为追加。

3. **一条测试固化了 bug 行为**（A4）
   `amapService.spec.ts`「状态 1 判定有效」原断言 `result.url` 含 `key=k1`，
   锁死了明文 Key 必须出现在返回值。修安全问题时这类断言必须同步改。

4. **教训 1 一天内犯了两次** —— 报告中"改代码前先确认引用与覆盖"这条，
   在 A3/A4 各违反一次。**写新 spec 前必须先 `git ls-files` / `Test-Path`。**


### B3 执行明细（2026-10-11）

提交 `c93a842`。两处监听器泄漏：

| 组件 | 根因 | 修法 |
|---|---|---|
| KmlViewerPage | setup 顶层匿名函数注册 fullscreenchange，onBeforeUnmount 未移除 | 提为具名函数，注册移入 onMounted，卸载配对移除 |
| GanttChartPage | frappe-gantt 构造函数内匿名注册 document mouseup，库不提供解绑 API；缩放按钮每次全量重建 | 500ms trailing 节流合并连续重建；onUnmounted 清定时器；initGantt 改同步（移除 nextTick import） |

新增 `kml_viewer/__tests__/KmlViewerPage.spec.ts`（4 用例）。
jsdom 无 getEventListeners，改为劫持 document 的
add/removeEventListener 精确计数（类型 + 同一函数引用配对）。

反证：还原旧注册方式后 4 用例全红；恢复后 4 passed。

**过程中一次替换误伤 5 处 cleanupDrawListeners**（fastctx replace 的
literal 模式匹配到了多处相同文本），按行号精确剥离后恢复。
教训：对多处重复的相同文本做替换时，改用带上下文的模式或行号定位。

**遗留**：甘特图那处是**缓解非根治**——frappe-gantt 不暴露解绑能力，
只要还在用该库，每次重建仍会泄漏一个 document 监听器。
根治需要：a) 减少重建场景（已完成节流）；b) 上游支持解绑；
c) 换甘特库。已记入 D4（拆 GanttChartPage）的关联项。


### B2 执行明细（2026-10-11）

提交 `c8903b5`。核心是新增统一请求封装并把外部 API 与组件守卫接上。

**新增 `src/utils/fetchWithTimeout.ts`**

| 导出 | 作用 |
|---|---|
| `fetchWithTimeout(url, {timeoutMs, signal, ...})` | 默认 15s 超时，返回原生 `Response`，调用方 `res.ok`/`res.json()` 不变 |
| `FetchTimeoutError` / `isFetchTimeoutError` | 超时错误带可识别标记，可与"取消""断网"区分 |
| `describeFetchError` | 转中文可读信息 |
| `createAbortScope` | 一次性作用域取消 |
| `createRequestGate` | 「单飞」闸门：`begin()` 取消上一请求返回新 signal |

**接入点**

| 层 | 文件 | 变更 |
|---|---|---|
| 外部 API | weatherHistory / earthquake / gdacs Service | 裸 `fetch` → `fetchWithTimeout`，新增可选 `signal` 参数透传（elevation 已在阶段 0 处理） |
| 组件 | `DlsComment` | `onUnmounted` 置 `disposed`，三个响应回调写 ref 前检查 |
| 组件 | `DlsChart` | async `onMounted` 跨 `await`，await 后检查 `disposed` |
| 页面 | WeatherHistory / EarthquakeQuery / Gdacs Page | 接入 `createRequestGate`：新查询取消旧查询 + 卸载取消在途；`await` 后判 `signal.aborted` |

**一个语义坑**：service 层 `catch` 会把 `AbortError` 也吞成 `{success:false, error}`，
所以组件不能只看 `result.success`，必须用 `signal.aborted` 判断"是否已被取消/取代"，
否则卸载后仍会弹一个"请求已取消"的错误框。

**测试 +33（610 → 643）**：`fetchWithTimeout`(22) + `weatherHistoryService`(4) +
`earthquakeService`(+2) + `gdacsService`(+2) + `DlsComment`(3)。

**可观测性难点**：组件守卫的 `disposed` 是闭包变量，无法直接读。DlsComment 测试通过
内部实例的 `setupState` 观察 `comments` ref，并配一个「对照组」（未卸载时应正常写入）
防止断言假绿。

**反证**：
- weather 服务还原裸 `fetch` → 3 用例失败（超时用例直接挂起到测试超时）；
- DlsComment 去掉 `onUnmounted` 守卫 → 2 用例失败（迟到响应写入 `comments`）。

**门禁**：type-check 0 / oxlint 0 / eslint 0 / prettier 全符合 /
vitest 643 passed（47 files） / `npm run build` 全链路通过。
期间 `npm run build` 的 `lint:oxlint` 暴露 spec 中两处
「Async assertions must be awaited」，改为先挂 `catch` 再断言。

**残留**：`DlsChart` 的守卫未加组件测试（依赖 echarts，mount 成本高），
仅由代码审查与 type-check 保证；如需覆盖，应把 `loadChinaMap` 的编排抽成可测函数。


### B1 执行明细（2026-10-11）

提交 `460c002`。**编号修正**：原台账把本项记为 P2-13，实为 **P2-19**
（P2-13 是 API Key 渲染，即 A 档 A4）。处数由审查时的"21 处"经全量扫描
校准为 **20 处**（另有 `ganttTaskUtils` 的 `Math.max(...)` 已在前批次修复）。

**新增 `src/utils/arrayUtils.ts`**

| 导出 | 等价于 | 说明 |
|---|---|---|
| `pushAll(target, items)` | `target.push(...items)` | 循环追加，返回 target |
| `maxOf(values, fallback=-Infinity)` | `Math.max(...values, fallback)` | 逐元素 `Math.max` 归约，保留 NaN 传播 |
| `minOf(values, fallback=Infinity)` | `Math.min(...values, fallback)` | 同上 |

关键点：**不能用 `if (v > m) m = v`** —— `NaN > m` 恒为 false，会把原生
`Math.max` 的 NaN 传播行为悄悄改掉。归约实现则完全一致。

**替换清单（20 处）**

| 文件 | 处数 | 类型 |
|---|---|---|
| `utils/TemplateExporter.ts` | 1 | push（**被 6 个工具共用**，风险最高） |
| `tools/gis2excel/GisToExcelExporter.ts` | 6 | Math.max |
| `tools/gis2excel/GisFileReader.ts` | 4 | push |
| `tools/shp2excel/ShpFileReader.ts` | 2 | push |
| `tools/shp2excel/ShpToExcelPage.vue` | 2 | push |
| `utils/templateHandler.ts` | 1 | push |
| `utils/TemplateReader.ts` | 1 | push |
| `tools/earthquake_query/EarthquakeQueryPage.vue` | 2 | Math.max |
| `components/layout/DlsChart.vue` | 1 | Math.max |

**审查的一处误报**：`[headers, ...dataRows]` 是**数组字面量展开**，走迭代器
协议，不受调用栈限制，并非崩溃点。审计在 TemplateExporter / GisToExcelExporter
两处把它列为风险；TemplateExporter 那处按审计建议改为 `concat` 统一语义，
GisToExcelExporter 保持不变，并在 commit 与本节都写明原因。

**测试 +17（643 → 660）**
- `arrayUtils.spec.ts`（新建，14）：语义等价（含 fallback、NaN 传播）、
  空输入、`Set`/生成器、20 万元素不抛错；两条**反证**断言原生
  `push(...arr)` / `Math.max(...arr)` 在 20 万规模下确实抛 `RangeError`。
- `TemplateExporter.spec.ts` 追加 3：20 万行 `generateCsv` 不抛错且
  行数 = 输入 + 1；大行数 `generateXlsx` 链路冒烟；20 万行 `exportData`
  完整导出链路不抛错。（原 22 用例保留。）

**反证**：还原 `rows.push(...dataRows)` → 200k 用例立即
`RangeError: Maximum call stack size exceeded`（2 失败）；恢复后全绿。

**门禁**：type-check 0 / oxlint 0 / eslint 0 / prettier 全符合 /
vitest 660 passed（48 files） / `npm run build` 全链路通过。
期间 oxlint `no-useless-spread` 提示测试里 `Math.max(...[字面量])` 无意义，
已改为先绑定变量再展开。


### B5 执行明细（2026-10-11）

提交 `b4c66c2`。审计列的 8 处 `parseFloat` 中，`utils/coordinateConverter.ts`
已在前批次改动（parseFloat 已消失），其余 7 处保留；另按"同一类 bug"扩展到
共 3 类、**10 个文件**：

| 层 | 文件 | 站点 |
|---|---|---|
| 通用 | `utils/templateHandler.ts` | `validateCoordinate` + `validateRow` 数值转换 |
| 通用 | `utils/CsvParser.ts` | 单元格数字转换（原 `Number()`） |
| 表格 | `coords_convert/templateReader.ts` | `validateCoordRow` |
| 表格 | `table2kml_point/TemplateValidator.ts` | 校验 + 转换 |
| 表格 | `table2kml_basestation/TemplateReader.ts` | 经纬度/方位角/半功率角/半径/挂高/半透明度 |
| 表格 | `distance_sensor/TemplateReader.ts` | 同站址 + 异站址三组坐标 |
| 页面 | `elevation_query/ElevationQueryPage.vue` | `isValid` + 查询 |
| 页面 | `weather_history/WeatherHistoryPage.vue` | `isValid` |
| 工具 | `coord_convert/coordConversion.ts` | `validateCoordinate` |
| 工具 | `coords_convert/coordsConversion.ts` | 批量转换循环 |

复用阶段 0 的 `parseStrictNumber`（失败返回 `null`）。两个关键点：
1. 所有 `isNaN(x)` 判断同步改为 `x === null`，null 分支 `continue`/`return`，
   绝不写入 0 或 NaN（P0-1 的同类防线）。
2. `distance_sensor`：`isValidCoordinate(null, null)` 会返回 **true**
   （`isNaN(null)` 为 false 且 null 当 0），所以必须先判 `=== null` 再调用。

**未纳入**（不同风险画像）：kml_viewer 解析 KML 内部 `gx:coord`；gantt 解析
SVG 属性；charts/colorUtils 解析 oklch 分量；GeoDataPage 文件体积；get_lonlat
解析高德返回串。

反证：`validateCoordinate` 还原为 `parseFloat` 后，「拒绝宽松前缀」「拒绝
Infinity/十六进制」两条立即失败（脏值 `116.4abc`/`0x1A`/`Infinity` 被放过）；
恢复后全绿。测试 +11。

---

### B4 执行明细（2026-10-11）

提交 `b98b0cd`。**这是本批最大的体积问题**。

**根因**：`manualChunks` 用 `id.includes('vue')` 子串匹配，把
`@vuepic/vue-datepicker`、`vuedraggable` 并进 `vue-ecosystem`；vue 是入口
静态依赖 → 整块进 `modulepreload`。`vendor` 兜底同理，把 proj4/dompurify
等按需库也拖进首屏。

**改法**：
1. 精确包名匹配（`node_modules/<pkg>/`）替代子串；
2. 删除 catch-all `vendor`，未命中模块交还构建器按静态/动态边界自动切分；
3. datepicker 的 CSS 从 `main.ts` 移到实际使用它的 3 个页面。

**踩到的坑**：给 `@vuepic`、`vuedraggable`/`sortablejs` 指定 chunk 名时，
Rolldown 会把它们依赖的 `@vue/shared` 等首屏共享模块并入该块，反而把整块
拖回 `modulepreload`（实测 draggable/datepicker 块被预加载）。故这几个
**故意不命名**；其余大库正常命名。

**实测结果**（`npm run build` 后的 dist/index.html）：

| 指标 | 改前 | 改后 |
|---|---|---|
| 首屏 JS（gzip） | 387.5 KB | **129.2 KB** |
| 首屏 JS（raw） | 1,179 KB | 360.5 KB |
| modulepreload 中的重型 npm 库 | vue-ecosystem(含 datepicker/draggable)、vendor | 无 |

改后 `modulepreload` 仅剩 vue-ecosystem / vue 运行时 / toolData / IndexPage /
useSeo / logger / Ph* 图标；echarts / leaflet / exceljs / document-libs / turf /
frappe-gantt / geo-libs / md-utils 均为独立懒加载块。

**验收**：首屏 387 → 129 KB（< 250）；`CI=true npx playwright test`
= 6 passed / 1 flaky（与基线一致，工具详情用例需真实加载懒加载 chunk）。
B4 无新增单测（构建配置，以体积 + e2e 验收）。

**B 档至此全部完成**（B1 `460c002` / B2 `c8903b5` / B3 `c93a842` /
B4 `b98b0cd` / B5 `b4c66c2`）。


### C1 执行明细（2026-10-11）

提交 `2eebf23`。6 列异站址模板里，若**第一条数据**的后 3 列是完全空白的单元格，
XLSX 默认的 `sheet_to_json(ws)`（对象模式）不给空单元格建 key，首行只剩 3 个
key → 列数被数成 3 → 误判为同站址模式 → 之后每行都报「名称不能为空」。
文件其实合法，用户看到的是误导性错误。

- `readAndValidateTemplate(rows, headerColumns?)` 新增可选表头参数，列数与列名
  一律从表头行推；省略时退回旧行为。
- 新增 `distance_sensor/templateRows.ts`：`aoaToTemplateRows`（二维数组 → 行对象，
  每行带齐全部表头 key、空白补 ''、整行空白跳过）、`columnsFromRows`。
- `DistanceSensorPage.vue`：XLSX 改 `{header:1}` 拿二维数组再整形，CSV 显式传列名。

**一个有价值的发现**：若空白被写成**空串** `''`，`aoa_to_sheet` 会为其建立 cell，
对象模式同样有 6 个 key —— 旧代码碰巧不误判。真正的坑是单元格**完全空白**。
测试里专门有一条锁住这个前提，避免后人误以为空串也能触发。

刻意没按审计建议改 `utils/TemplateReader.ts` 的共用签名（会波及所有工具），
改为只给本工具补本地整形函数。

---

### C2 执行明细（2026-10-11）

提交 `a9b09f4`。数据是按【上传当时】的输入坐标系校验的（经纬度模式与 XY 模式
的列语义、取值范围都不同），但 `startConversion` 一直读当前下拉值。用户上传后
改一下输入坐标系，已校验数据就被按新系统解释，静默产出错误坐标 ——
这是阶段 2 P0-5 遗留的另一半（当时只修了 CGCS2000 的 NaN）。

- `coordsConversion.ts` 新增纯函数 `resolveInputSystem(uploaded, current)`：
  有快照时一律用快照；快照与当前不一致时置 `mismatched` 交 UI 提示。
- `CoordsConvertPage.vue`：校验成功时锁定快照；转换参数改走
  `inputSystemResolution`；模板新增口径不一致提示。
  刻意不自动清空已校验数据（会白丢用户上传的文件），也刻意不静默按新系统解释。
- 反证：按当前下拉解释同一份数据，`batchConvertCoordinates` 的结果与按快照
  解释**确实不同**；把 `resolveInputSystem` 还原为"始终用当前值"后 3 条立即失败。

**覆盖缺口**：`effectiveSystem` 的取值被单测钉住，但组件把它接进
`conversionOptions` 这一层靠 type-check + 代码审查保证，未做 mount 测试。

---

### C3 执行明细（2026-10-11）

提交 `1f53c9d`。`ref` 会给数组及每个元素建深度响应式代理，对只做整体替换的
解析结果是纯浪费（内存 2–3 倍）。项目此前 **0 处** `shallowRef`。

**逐个读代码后确认"整体替换、从不就地改元素"才改，共 6 处：**

| 文件 | 变量 |
|---|---|
| coords_convert/CoordsConvertPage.vue | `validatedDataRows`、`conversionResultData` |
| gis2excel/GisToExcelPage.vue | `convertedData`（`GisFeature[][]` 两层数组，深代理成本最高） |
| geo_data/GeoDataPage.vue | `analysisResults` |
| template_export/useTemplateExport.ts | `rawDataList` |
| common/GeocodeCommon.vue | `queryResults` |

**刻意不改**（存在 `.push`/`.splice` 等就地修改，改 shallowRef 会让响应式
静默失效）：`Shp2KmlPage.fileEntries`、`ShpToExcelPage.fileEntries`、
`ElevationsBatchPage.queryResults`、`useTemplateExport.renderResults`、
gantt 的 `undoStack`/`redoStack`、kml_viewer 的 `treeNodes`/`anglePoints`/`pickedCoords`。
要让这些也受益，得先把 push 累积改成整体替换，属另一件事。

**审计口径修正**：审计列的 5 个文件中，有 3 处其实是 push 累积的
（并非"只读大数组"），所以实际只改 6 处、分布在 5 个文件。

**验收缺口（如实记录）**：审计要求「万行数据下内存峰值下降（DevTools 对比）」，
本环境无 Chrome Memory 面板，未做量化前后对比。以代码审查 + 全量门禁 + e2e 为准。

**C 档剩余**：C4（P2-20 文件处理 Worker 化，3–5 天）需单独立项。
