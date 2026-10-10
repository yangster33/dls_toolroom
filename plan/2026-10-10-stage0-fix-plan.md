# 阶段 0 止血计划（审查整改 · 第一批）

- **日期**：2026-10-10（计划）／2026-10-10（执行）
- **项目**：dls_toolroom（Vue 3 + Vite + TS + Tailwind v4 + daisyUI 5 + Pinia 3，纯前端工具间）
- **依据**：[`docs/2026-10-09-audit-00-summary.md`](../docs/2026-10-09-audit-00-summary.md) 的「四阶段修复路线图」阶段 0
- **配套执行记录**：[`docs/2026-10-10-stage0-fix-record.md`](../docs/2026-10-10-stage0-fix-record.md)
- **相关提交**：`161ac81` fix(tools) · `2752d83` docs

## 完成状态（2026-10-10 收尾）

- **P0-1** ✅ CSV 空经纬度被当作 (0,0) 几内亚湾——4 处 + 新增 `src/utils/coordinateValue.ts`
- **P0-2** ✅ KML `<coordinates>` 无空格分隔时坐标错位——**方案有变更，未采纳报告原方案 A**，见下方「实施偏差」
- **P0-3** ✅ 中文色名 Google 图钉是死代码——`PointRow` 增加 `colorRaw`
- **P1-1** ✅ `ToastContainer` 从未挂载，toast 静默丢失
- **P1-2** ✅ `GeoDataPage` 错误对话框绑定错变量，导出失败不可见
- **P1-3** ✅ `opacity = 0` 被 `||` 吞成 0.5
- **P2-1** ✅ 删除死配置 `tailwind.config.js`——已用产物 MD5 证明无影响
- **P2-5** ✅ 补声明幽灵依赖 `date-fns`（3 处 import 但 package.json 未声明）
- **P3-1** ✅ 删除 1114 行重构残留死代码（连带 29 个 debug.log，约 150 KB）
- **matchCount** ✅（对应上一轮审计 P1-7，本计划第 10 项）清空输入框 → `k=0` → TypeError 崩溃

**计划外但同批完成**：
- **P1-4** `resolveDuplicates` 重名导致 ZIP 内文件互相覆盖（删除死代码后发现 live 副本无测试覆盖，导出后测试立即暴露）
- 两个潜在死分支：`validateFilenameTemplate` 的 `{}` 检查不可达（正则 `[^}]+`）；`generateFilename` 的 `文档_N` 兜底不可达（`'' != null` 为 true）
- `exceljsRuntime.spec.ts` 超时 5s → 30s（既有 flake，被本次新增测试显性化）

**门禁结果**：type-check 0 错误 ✅ · vitest **539 passed / 37 files**（基线 524）· oxlint 0/0 ✅ · build-only 成功 · playwright（生产构建）**6 passed / 1 flaky / 0 failed**
**改动规模**：28 文件，+433 / −1579 行，净删除约 1,150 行
**遗留**：`npm run dev` 在 `F:\PPT\...` 路径下报 `EPERM rename node_modules/.vite/deps`（环境问题，stash 后同样失败；生产构建路径下 e2e 全过）

---

## 一、目标

1. 消除**静默产出错误数据**的工具缺陷——本项目拿输出做选址/坐标/高程决策，错误比报错危险得多
2. 消除功能静默失效与误导性展示（toast 丢失、错误对话框不显示、参数被吞）
3. 清掉两类"看起来生效其实没生效"的配置与死代码，缩小后续维护的踩坑面
4. 每项修复配一个**会因该 bug 而失败**的测试，避免再出现"测试假绿"

**约束**：不动阶段 2+ 的内容（大数据量崩溃、空间分析容错、CSV2000 NaN 等）；不改工具的业务语义。

---

## 二、选择标准（为什么是这 10 项）

从 6 + 10 + 22 + 15+ 项问题里挑阶段 0，判据是**投入产出比**：

| 判据 | 说明 |
|---|---|
| 修复成本 | 多在 15 分钟～2 小时，多为 1～5 行 |
| 用户后果 | 静默错误数据 / 功能完全失效 / 部署阻断 |
| 是否需要大重构 | 否——不碰 GanttChartPage 拆分、模板读取器收敛等阶段 3 工作 |
| 能否被测试证明 | 每项都能写出"修复前红、修复后绿"的用例 |

> 上一轮审计的阶段 0 是 **3 行代码**修掉一个 100% 崩溃的工具 + 一处静默数据损坏，是全场投入产出比最高的部分。本轮沿用同一思路。

---

## 三、实施明细

### P0 数据正确性

| # | 问题 | 位置 | 修法 |
|---|---|---|---|
| 1 | CSV 空经纬度 → `(0,0)` 几内亚湾。`Number('')` === 0 且落在合法区间 → 高程/地址 API 真的返回一个看似合理的结果 | `elevations_batch/TemplateReader.ts:47,69`、`get_add/TemplateReader.ts:51,74`、`GeocodeCommon.vue:775` | 新增 `utils/coordinateValue.ts` 的 `parseCoordinateValue`，显式判空 + 范围校验；顺带拒绝 `'116.4abc'` 宽松前缀 |
| 2 | KML `<coordinates>` 无空格分隔 → 坐标错位 | `utils/kmlCoordinates.ts:56-69` | 见「实施偏差」，重写 `inferStride` 为四级策略 |
| 3 | 中文色名图钉死代码 | `table2kml_point/KmlGenerator.ts:50-55` | `PointRow` 加 `colorRaw`；判定改为是否命中色名映射表 |

### P1 功能失效

| # | 问题 | 位置 | 修法 |
|---|---|---|---|
| 4 | `ToastContainer` 从未挂载 | `App.vue` | 挂载 `<ToastContainer />`（Teleport 到 body，不影响布局） |
| 5 | 错误对话框绑定错变量 | `GeoDataPage.vue:208,342,356` | 删 `errorDialogOpen`，统一 `showErrorDialog` 单入口，4 处路径改走 `showErrorDialogMsg` |
| 6 | `opacity = 0` 被 `||` 吞 | `utils/KmlGenerator.ts:239` | `?? 0.5` |

### P2 工程

| # | 问题 | 位置 | 修法 |
|---|---|---|---|
| 7 | `date-fns` 幽灵依赖 | `package.json` | 补 `^4.4.0` + `@types/date-fns` |
| 8 | `tailwind.config.js` 死配置 | 仓库根 | 删除（方案 A：与 v4 CSS-first 对齐） |
| 10 | `matchCount = 0` 崩溃 | `DistanceSensorPage.vue:524`、`DistanceCalculator.ts:237,250,339` | UI watcher 钳制 ≥1 + `matchDistances` 入口防御 |

### P3 死代码

| # | 问题 | 修法 |
|---|---|---|
| 9 | 1114 行重构残留（`docx/xlsx_template_export` 的 composable + functions，生产 0 引用） | 删除 6 个文件（含 2 个 spec）；保留 2 个转发壳 `*Page.vue` |

---

## 四、实施偏差（与计划不符处，均已在报告中回标）

### 4.1 P0-2 否决了报告里的「方案 A」

报告原文建议「含逗号时优先按 2 分组，仅当按 2 分组有余数时才回退到 3」。实施推演发现它会破坏**最主流的真实格式**：

```
输入：116.3,39.9,0 116.4,40.0,0     ← Google Earth / ArcGIS 默认输出，6 个数字
方案 A：6 % 2 === 0 → stride = 2
  i=0 → (116.3, 39.9) ✅
  i=3 → (0, 116.4)    ❌ lat=116.4 > 90，被范围校验静默丢弃
  i=6 → (40.0, 0)     ❌ 把高程 0 当成经度，产出一个错误点
```

即"修好 6 数字歧义区，却弄坏 KML 2.0 带高程格式"。

**实际实现**：利用 KML 规范给的**空白边界**这一强信号，四级策略从可靠到兜底：

1. 按空白切片，并把「以逗号结尾的片段」与下一片段合并（解决 QGIS 的 `116.3, 39.9,0` 写法）；若所有元组字段数一致且为 2 或 3，直接采用
2. 纯空格分隔、每段 1 个数字 → stride 2
3. 整除推断——只能被 2 整除取 2，只能被 3 整除取 3
4. 歧义区（可同时被 2 和 3 整除）——按「哪个 stride 得到更多合法坐标」选择，平手取 3（KML 2.0 规范形式）

`src/utils/kmlCoordinates.ts:56-154`。原有 5 种写法的用例全部仍通过。

### 4.2 P3-1 连带造成覆盖缺口，被迫补测并提前修 P1-4

删死代码时按报告要求「连 spec 一起删」，但它测的 `sanitizeFilename` / `generateFilename` / `resolveDuplicates` / `validateFilenameTemplate` 在 **live 的 `useTemplateExport.ts` 里有一份重复拷贝且此前完全没测**。

处理：把 live 实现的 4 个函数改为 `export`，新建 `useTemplateExport.spec.ts`（27 用例）补回覆盖。**新测试立刻失败**，确认 P1-4 在 live 代码里仍存在——既然测试已写好，就地修了。

断言策略：P1-4 断言的是**不变量**（输出唯一）而非具体命名方案。只要唯一，ZIP 内就不会互相覆盖；字面量 `a(1)` 被改成 `a(1)(1)` 与把它让给 `a` 而重命名第二个，两种方案都满足不变量。

### 4.3 第 10 项的交叉引用是错的

计划表第 10 项在初版报告里误标为 `[P2-16]`（PII 明文传输），实际对应的是**上一轮审计（2026-09-27）的 P1-7**。已在总览与执行记录中改正。

---

## 五、测试策略

沿用上一轮审计的教训：**有些测试会把 bug 行为写成期望值**（`CsvParser.spec.ts` 初版断言 `b: 0` 就是"测试名把 bug 写成需求"）。因此：

1. 每项修复先写「会因该 bug 而失败」的用例
2. 遇到既有测试变红，先判定是「测试保护 bug」还是「我的修复错了」，不盲目改测试
3. 对关键修复做**反证**：临时还原旧逻辑，确认新用例立即失败

新增测试（8 个文件 / +53 用例，另删 38 个死代码 spec 用例，净 +15）：

| 文件 | 用例 |
|---|---|
| `utils/__tests__/coordinateValue.spec.ts` | 17 |
| `utils/__tests__/kmlCoordinates.spec.ts` | +7 |
| `utils/__tests__/KmlGenerator.spec.ts` | +4 |
| `utils/__tests__/DistanceCalculator.spec.ts` | +3 |
| `table2kml_point/__tests__/KmlGenerator.spec.ts` | +7 |
| `template_export/__tests__/useTemplateExport.spec.ts` | 27 |
| `elevations_batch/__tests__/TemplateReader.spec.ts` | 13 |
| `get_add/__tests__/TemplateReader.spec.ts` | 5 |

**已做的反证**：
- P0-3：临时还原 `isChineseColor` 旧逻辑 → `KmlGenerator.spec.ts` 中「规范化后的红色仍走官方红图钉」立即失败 → 还原后恢复 19 passed。证明该用例真能捕获 bug，不是又一次假绿。
- P2-1：删除 `tailwind.config.js` 前后重新构建，比对 `dist/assets/*.css` 全部 15 个文件的 MD5，字节完全一致。
- P3-1：删除前后 `git stash` 对照跑 e2e，确认本地失败为既有环境问题。

---

## 六、明确不做（留在后续阶段）

| 项 | 原因 | 归入 |
|---|---|---|
| 修 133 个 eslint error（112 个 `as any`） | 需批量类型收窄，约 1 天，且要先决定 CI 是否改跑 `npm run lint` | 阶段 1 |
| `build` 脚本加质量门禁；CI 加 `npm run lint` / prettier | 属流程改造 | 阶段 1 |
| `engines` 收紧、CI node 版本统一、`.env` 重复 key | 属配置治理 | 阶段 1 |
| 修 `manualChunks`、首屏 810 kB、`ref`→`shallowRef` | 需逐 chunk 核对产物，风险高于收益门槛 | 阶段 2 |
| `push(...arr)` 大数据量崩溃（6 处） | 需构造万行级 fixture 验证 | 阶段 2 |
| 空间分析 `Multi*` 拆分 + 逐 feature try/catch（P0-4） | 约 1 天，涉及容错语义设计 | 阶段 2 |
| CGCS2000 NaN 进导出文件（P0-5） | 涉及 UX：参数无效时如何提示 | 阶段 2 |
| 批量高程失败被吞 + 缺失当 0 米（P0-6） | 需定义 `partial` 状态与下载命名约定 | 阶段 2 |
| 模板读取器 7 份 → 参数化工厂 | 大重构，需逐工具回归 | 阶段 3 |
| 拆 `GanttChartPage.vue`(1623 行) / `KmlViewerPage.vue`(1157) / `GeocodeCommon.vue`(983) | 大重构 | 阶段 3 |
| 删 12 个零引用依赖 | 需先确认构建产物无回归 | 阶段 3 |
| `vercel.json` 裸 IP → 环境变量 + HTTPS | 需 Vercel 控制台操作 | 阶段 4 |
| `geocodeStore` 的 `apiKeys` 退出持久化 | 安全加固，需评估用户会话体验 | 阶段 4 |

---

## 七、验收记录

| 检查项 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npm run type-check` | ✅ 0 错误 |
| 单元测试 | `npx vitest run` | ✅ 539 passed / 37 files |
| Lint | `npx oxlint .` | ✅ 0 warnings / 0 errors（183 files） |
| 生产构建 | `npm run build-only` | ✅ 成功（3.66s，66 chunks） |
| E2E（生产构建） | `CI=true npx playwright test` | ✅ 6 passed / 1 flaky / 0 failed |
| E2E（dev server） | `npx playwright test` | ⚠️ 环境问题：`EPERM rename node_modules/.vite/deps`，stash 后同样失败 |

**环境备注**：`F:\PPT\...` 路径下的 dev server 无法完成 Vite 依赖预构建（rename 被安全软件/同步客户端拦截）。评估 e2e 时请用 `CI=true` 走 preview server，或将仓库移出该路径。

---

## 八、遗留项

1. **`@types/date-fns` 停在 2.6.3** —— date-fns v4 不带类型，DefinitelyTyped 最新就是 2.6.3。type-check 0 错误、可用；若升级 date-fns 需复查。
2. **e2e `channel: 'msedge'`** —— 无 Edge 的机器需 `PLAYWRIGHT_CHANNEL=chromium` 或 `CI=true`。归阶段 1 统一处理。
3. **P0-4 / P0-5 / P0-6 三项静默数据错误仍在产线** —— 均属阶段 2，是下一批最该做的（用户后果与本次 P0 同级，只是修复成本更高）。
