# 2026-10-09 代码审查 · 总览与修复路线图

> **文件性质**：全面代码审查报告（索引 + 路线图）
> **审计日期**：2026-10-09
> **审查基线**：`c096944` (test(e2e): Playwright 浏览器通道支持环境变量覆盖)
> **技术栈**：Vue 3.5 · TypeScript 6 · Vite 8 (rolldown) · Tailwind CSS 4 · daisyUI 5 · Pinia 3
> **部署**：Vercel 静态托管 + 自建 Django API (`8.137.195.0`)
> **审查方式**：人工阅读 + 全仓 grep 交叉验证 + 实跑质量门禁

---

## 一、审查方法

本次审查**先实跑了当前的质量门禁**，再逐文件阅读核心逻辑，并用 grep 交叉验证引用关系。所有结论均已核验，未臆测。

| 检查项 | 命令 | 实测结果 |
|---|---|---|
| 类型检查 | `npm run type-check` | ✅ 0 错误 |
| 单元测试 | `npx vitest run --reporter=dot` | ✅ **524 passed / 35 files**，0 失败 |
| Lint（oxlint） | `npx oxlint .` | ✅ 0 warnings / 0 errors（185 files, 116 rules） |
| Lint（eslint） | `npx eslint .` | ❌ **133 errors**（112 `no-explicit-any` + 17 unused-vars + 1 `no-empty-object-type` + 1 `@ts-ignore`）—— **CI 不跑这项** |
| 生产构建 | `npm run build-only` | ✅ 成功 |
| lock 一致性 | 逐包比对 `node_modules` ↔ `package-lock.json` | ✅ 零偏差（1039 顶层目录，`lockfileVersion: 3`） |
| 上一轮审计报告归档 | `git ls-files docs/` | ⚠️ `.gitignore:56` 的 `docs/` 曾使审计报告**不入库**（本次已修正） |

**审查范围**：`src/` 下 173 个源文件、`scripts/`、`e2e/`、`.github/`、全部构建与部署配置。

---

## 二、核心结论

这不是一个糟糕的项目。524 个真实在跑的测试、干净的纯函数抽取、规范的 commit message、KML 渲染与 JSON 导入的纵深 XSS 防护，都说明维护意识良好。

但存在三个**结构性**问题，它们的共同点是：**让"看起来没问题"掩盖"实际有问题"**。

### 2.1 绿灯来自于「没测」，而不是「没 bug」

`npm run build` 不跑 type-check、不跑测试、不跑 lint。CI 有 3 个 job，但 lint 只跑 `oxlint`——而 `oxlint` 报 0 error，`eslint` 报 133 error。**两个 linter 对同一份代码给出相反结论，而 CI 只信那个永远绿的。**

上一轮审计（`docs/2026-09-27-audit-report.md`）已经指出过这一点。当时没有 CI，本轮已补上，但**lint 门禁仍然只覆盖了一半**。

### 2.2 同一类 bug 在 N 处出现，修一处漏一处

这是本次最重要的发现。已确认的同模式问题：

| 模式 | 处数 | 已知被修过 | 仍未修 |
|---|---|---|---|
| `Number('') === 0` 空值转数字 | 4 | `CsvParser.ts`、`templateHandler.ts`、`ElevationsBatchPage.vue` 已修 | `TemplateReader.ts` ×3、`GeocodeCommon.vue` 私有 `parseCSV` 未修 |
| `endsWith('.csv')` 大小写敏感 | 5 | `useTemplateExport.ts` 已修 | `useDocxTemplateExport.ts`、`useXlsxTemplateExport.ts` 未修（目前是死代码，接线即回归） |
| `push(...arr)` 大数据量崩溃 | 6 | 未修 | 全部未修 |
| `escapeXml` | 2 | — | 两份逐字节相同 |
| 文件名模板渲染 / 花括号校验 | 5 + 4 | — | 其中 `Shp2KmlPage.vue` 与 `ShpToKmlGenerator.ts` 是同一函数两份拷贝 |
| `setTimeout(() => {}, N)` 当节流器 | 1 | — | `GisToExcelExporter.ts:147` 纯空操作 |

**教训**：修 bug 时应搜索"同一模式在整个仓库的所有出现"，而非只修报错的那一处。

### 2.3 配置「看起来生效其实没生效」

| 配置 | 真相 |
|---|---|
| `tailwind.config.js` | Tailwind v4 + `@plugin` 路线，**无 `@config` 指令 → 整个 JS 配置从未被读取** |
| `eslint.config.ts` | 本地有效（133 error），**CI 不跑** |
| `ToastContainer.vue` | 写好了，**从未挂载**，所有 toast 静默丢失 |
| `GeoDataPage` 的错误对话框 | 模板绑定 `showErrorDialog`，业务代码设置 `errorDialogOpen` → **永不显示** |
| `vite.config.ts` 的 `ui-libs` / `md-diagram` chunk | 判据 `id.includes('vue')` 命中 `@vuepic`/`vuedraggable` → **规则永远走不到** |
| `@tailwindcss/vite` | 在 `dependencies` 里，但 `vite.config.ts:8,23` 已注释掉 → 死依赖 |
| `vue-use-monaco` | 已安装，全 src 零引用 |

---

## 三、问题分布

按**用户可感知的后果**分级，而非按代码体积。

| 级别 | 数量 | 定义 |
|---|---|---|
| **P0 严重** | 6 | **静默产出错误数据**（用户拿输出做工程决策，且无从察觉） |
| **P1 高危** | 10 | 功能完全失效 / 静默失败 / 误导性展示 |
| **P2 中等** | 22 | 工程配置、安全、性能、健壮性、大数据量崩溃 |
| **P3 轻微** | 15+ | 死代码、重复实现、结构腐化、文档矛盾 |

> **关于分级标准的说明**：本项目定位是数据处理工具，用户拿它的输出去做基站选址、坐标转换、空间分析。因此「静默产出错误数据」比「报错」危险得多——一个明确的报错最多造成不便，一个看似合理的错误数字会造成决策失误。**P0 全部属于这一类别。**

---

## 四、报告索引

| 报告 | 内容 | 问题数 |
|---|---|---|
| [`2026-10-09-audit-00-summary.md`](./2026-10-09-audit-00-summary.md) | 本文件：总览、结论、路线图 | — |
| [`2026-10-09-audit-01-P0-data-correctness.md`](./2026-10-09-audit-01-P0-data-correctness.md) | 数据正确性：静默产出错误数据 | 6 |
| [`2026-10-09-audit-02-P1-functional.md`](./2026-10-09-audit-02-P1-functional.md) | 功能失效与静默失败 | 10 |
| [`2026-10-09-audit-03-P2-engineering.md`](./2026-10-09-audit-03-P2-engineering.md) | 工程配置 · 安全 · 性能 · 健壮性 | 22 |
| [`2026-10-09-audit-04-P3-cleanup.md`](./2026-10-09-audit-04-P3-cleanup.md) | 死代码 · 重复实现 · 结构拆分 | 15+ |
| [`2026-10-10-stage0-fix-record.md`](./2026-10-10-stage0-fix-record.md) | **阶段 0 执行记录**（含方案偏差与验证证据） | 10 项已修 |
| [`2026-09-27-audit-report.md`](./2026-09-27-audit-report.md) | 上一轮审计（历史归档，阶段 0–1 已修） | — |

每份报告中的问题卡片结构统一：

```
问题编号 / 标题
├─ 位置          file:line
├─ 严重度        类型 / 影响工具
├─ 触发场景      复现步骤
├─ 后果          用户可见的影响
├─ 根因          为什么会这样
├─ 修复建议      可直接执行的代码
├─ 工作量        预估
└─ 验收标准      如何确认修好了
```

---

## 五、修复路线图

### 阶段 0：止血（约 2 小时，约 15 行代码）— ✅ **已完成（2026-10-10）**

> 执行记录见 [`2026-10-10-stage0-fix-record.md`](./2026-10-10-stage0-fix-record.md)。
> 测试 524 → **539 passing**，type-check / oxlint / e2e 全绿，净删除约 1,150 行。
>
> ⚠️ **方案变更**：P0-2 报告原方案（含逗号优先按 2 分组）实施时发现会破坏最主流的
> KML 2.0 带高程格式（6 个数字 → stride 2 → 坐标错位），已改用基于空白边界的四级策略。
>
> ⚠️ **交叉引用修正**：第 10 项初版误标为 `[P2-16]`，实际对应上一轮审计（2026-09-27）
> 的 P1-7；本报告 P2-16 是另一条问题。

| # | 动作 | 位置 | 报告 | 状态 |
|---|---|---|---|---|
| 1 | 空字符串显式判空，不再 `Number('')` | `TemplateReader.ts` ×3、`GeocodeCommon.vue:775` | [P0-1](./2026-10-09-audit-01-P0-data-correctness.md) | ✅ |
| 2 | KML coordinates stride 推断 | `kmlCoordinates.ts` | [P0-2](./2026-10-09-audit-01-P0-data-correctness.md) | ✅ 方案有变更 |
| 3 | 中文色判定改为「是否命中色名映射」 | `KmlGenerator.ts` | [P0-3](./2026-10-09-audit-01-P0-data-correctness.md) | ✅ |
| 4 | 挂载 `ToastContainer` | `App.vue` | [P1-1](./2026-10-09-audit-02-P1-functional.md) | ✅ |
| 5 | 修错误对话框绑定错变量 | `GeoDataPage.vue` | [P1-2](./2026-10-09-audit-02-P1-functional.md) | ✅ |
| 6 | `opacity ?? 0.5` | `utils/KmlGenerator.ts:239` | [P1-3](./2026-10-09-audit-02-P1-functional.md) | ✅ |
| 7 | `package.json` 补 `date-fns` | `package.json` | [P2-5](./2026-10-09-audit-03-P2-engineering.md) | ✅ |
| 8 | 删 `tailwind.config.js` | 仓库根 | [P2-1](./2026-10-09-audit-03-P2-engineering.md) | ✅ 产物哈希证明 |
| 9 | 删 1114 行重构残留死代码 | `docx/xlsx_template_export/` | [P3-1](./2026-10-09-audit-04-P3-cleanup.md) | ✅ |
| 10 | `matchCount` 钳制到 ≥ 1 | `DistanceSensorPage.vue`、`DistanceCalculator.ts` | 旧审计 P1-7 | ✅ |

> 阶段 0 完成后：**一个功能从静默失效变为可用（toast），一个工具的核心特性从失效变为可用（中文色图钉），一处静默数据错误被消除（空经纬度）。**
>
> **额外收获**：删除死代码后导出的 live 纯函数暴露出 P1-4（ZIP 内文件互相覆盖）与两个潜在死分支（`{}` 空占位符校验失效、`文档_N` 兜底不可达），已一并修复。

### 阶段 1：让门禁真实生效（约半天）

1. CI 加 `npm run lint`，并修 133 个 eslint error（主要是 112 个 `as any`）→ [P2-3](./2026-10-09-audit-03-P2-engineering.md)
2. `engines` 收紧为 `>=22.17.0`，CI `node-version` 升到 `24` → [P2-6](./2026-10-09-audit-03-P2-engineering.md)
3. `.env` 删重复 key；`VITE_ENABLE_MOMENT_TAB` 生产默认值写进代码 → [P2-7](./2026-10-09-audit-03-P2-engineering.md)
4. CI 加 `prettier --experimental-cli --check .` → [P2-9](./2026-10-09-audit-03-P2-engineering.md)
5. `build` 改为 `run-s type-check lint test:unit build-only prerender` → [P2-2](./2026-10-09-audit-03-P2-engineering.md)
6. `vitest.config.ts` 独立精简配置，不引入 devtools / mock / `loadEnv('')` → [P2-4](./2026-10-09-audit-03-P2-engineering.md)

### 阶段 2：正确性与健壮性（约 2 天）

1. 修 `manualChunks` 顺序；`@vuepic` CSS 移出 `main.ts`；`proj4`/`dompurify` 改动态 import → [P2-11](./2026-10-09-audit-03-P2-engineering.md)
2. 所有 `push(...arr)` / `Math.max(...arr)` 改循环 / `reduce` → [P2-13](./2026-10-09-audit-03-P2-engineering.md)
3. 空间分析：`Multi*` 拆分 + 逐 feature try/catch，部分失败不再丢弃全部结果 → [P0-4](./2026-10-09-audit-01-P0-data-correctness.md)
4. `CoordsConvertPage` 捕获上传时坐标系快照 → [P0-5](./2026-10-09-audit-01-P0-data-correctness.md)
5. `elevationService` 分批 + `AbortController` + 缺失值用 `null` 而非 `0` → [P0-6](./2026-10-09-audit-01-P0-data-correctness.md)
6. 4 处裸 `fetch` 补 `AbortController` + 超时 + `onUnmounted` 中断 → [P2-15](./2026-10-09-audit-03-P2-engineering.md)
7. 修两处内存泄漏（`KmlViewerPage.vue:507` 的 fullscreenchange；甘特图重复实例化）→ [P2-14](./2026-10-09-audit-03-P2-engineering.md)
8. `resolveDuplicates` 改 `while`；`skipRows` 差一错；`Number()` 后回验字符串 → [P1-4](./2026-10-09-audit-02-P1-functional.md)、[P1-5](./2026-10-09-audit-02-P1-functional.md)、[P1-9](./2026-10-09-audit-02-P1-functional.md)

### 阶段 3：清理与拆分（约 1 周）

1. 7 份 `TemplateReader` → 参数化工厂；7 份 `TemplateExporter` → 单一实现 + 配置 → [P3-2](./2026-10-09-audit-04-P3-cleanup.md)
2. 5 份文件名模板 / 4 份花括号校验 / 3 份 `sanitizeFilename` → 各收敛为 1 份 → [P3-2](./2026-10-09-audit-04-P3-cleanup.md)
3. 删 12 个零引用依赖 + 约 850 行零引用文件 → [P3-1](./2026-10-09-audit-04-P3-cleanup.md)、[P3-3](./2026-10-09-audit-04-P3-cleanup.md)
4. 拆 `GanttChartPage.vue`（1623 行）、`KmlViewerPage.vue`（1157 行）、`GeocodeCommon.vue`（983 行）→ [P3-5](./2026-10-09-audit-04-P3-cleanup.md)
5. 统一 `ref` → `shallowRef`；`useECharts` 缺数据时不清空图表 → [P2-12](./2026-10-09-audit-03-P2-engineering.md)

### 阶段 4：文档与部署（约半天）

1. README 补后端依赖说明，删掉"无需后端"的矛盾表述 → [P1-8](./2026-10-09-audit-02-P1-functional.md)
2. `vercel.json` 后端地址改 Vercel 环境变量 + HTTPS 域名 → [P2-8](./2026-10-09-audit-03-P2-engineering.md)
3. 修 catch-all 软 404 → [P2-8](./2026-10-09-audit-03-P2-engineering.md)
4. `geocodeStore` 的 `apiKeys` 从持久化中排除 → [P2-18](./2026-10-09-audit-03-P2-engineering.md)
5. 客户端验证码加注释"仅防误输入，防刷在服务端" → [P2-20](./2026-10-09-audit-03-P2-engineering.md)

---

## 六、值得肯定的地方

审查不是只挑毛病。以下几处明显高于同类项目平均水平：

1. **纯函数抽取有纪律**　`coordConversion` / `DistanceCalculator` / `kmlCoordinates` / `ganttTaskUtils` / `docxTemplateFunctions` 等都做到了逻辑与视图分离——这也是本次能精确定位到行号的原因。
2. **524 个真实在跑的测试**　坐标转换、CSV/Excel 解析、KML 生成、距离算法、地震/GDACS 服务都有覆盖，且回归测试被实测验证过（把 `parseKmlCoordinates` 换回旧逻辑，28 个用例立即红）。
3. **KML 渲染与 JSON 导入的 XSS 防护是纵深防御**　`validateImportedTasks` schema 校验 + `escapeHtml` + DOMPurify 三层都有，`color` 还有 `#hex` 白名单防 style 注入。
4. **所有 blob URL 都有配对回收**　逐处核对 Gantt 的 6 处导出路径（含 onerror 分支），无泄漏。
5. **上一轮做了认真的审计并留下了报告**　P0–P3 分级 + 阶段 0–4 路线图 + 修复记录，质量很高。
6. **commit message 规范**　`fix/refactor/style/docs/test/ci` 分类清晰，能看出演进过程。
7. **README 的代码生成声明诚实**　不假装全是人写的。

---

## 七、未覆盖范围（诚实声明）

本次审查**未**覆盖以下部分：

- `e2e/` 下 Playwright 用例的**实际执行结果**（仅阅读了配置与用例源码）
- 视觉/交互层面的可用性与响应式布局
- 后端 Django 服务（本仓库不含）
- 依赖库的 CVE 漏洞扫描（建议接入 `npm audit` / Dependabot）
- 各工具的**领域正确性**（距离算法是否符合测绘规范、坐标系转换参数是否准确）——仅检查了代码层面的逻辑缺陷
- `src/mock/page.ts` 与真实后端契约是否一致

---

## 八、附录：可复现命令

```powershell
# 质量门禁基线
npm run type-check                          # → 0 错误
npx vitest run --reporter=dot               # → 524 passed / 35 files
npx oxlint .                                # → 0 warnings, 0 errors (185 files)
npx eslint .                                # → 133 errors（CI 未覆盖）
npm run build-only                          # → 成功

# 关键结论的验证方式
git check-ignore -v docs/2026-09-27-audit-report.md   # → .gitignore 曾忽略审计报告（本次已修）
git ls-files | Select-String "docs/"                   # → 确认 docs 下无跟踪文件
Select-String -Path src/**/*.ts -Pattern "date-fns"    # → 3 处 import，package.json 未声明
```

---

*报告生成：2026-10-09 · 审查基线 `c096944` · 下一份报告请见 [P0 数据正确性](./2026-10-09-audit-01-P0-data-correctness.md)*
