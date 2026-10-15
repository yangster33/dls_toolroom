# 2026-10-15 · D3 清理零引用依赖与死代码 · 实施记录

> **依据**：审计 [`2026-10-09-audit-04-P3-cleanup.md`](./2026-10-09-audit-04-P3-cleanup.md) 的 **P3-2**（零引用文件）与 **P3-3**（12 个零引用依赖）
> **台账**：[`../plan/2026-10-11-progress-ledger.md`](../plan/2026-10-11-progress-ledger.md) **D 档 D3**
> **提交**：`75fda16`（代码与依赖）+ `2485d1f`（本记录与台账回填）
> **前置批次**：阶段 0–2、A/B/C 档、C4 四阶段 + 收尾均已完成（HEAD `27d4052`，775 tests / 57 files）
> **实施方式**：先逐项核对引用（不凭 2026-10-09 的审计结论直接删），再删文件 → 卸依赖 → 全量门禁 → e2e

---

## 一、总览

| 项 | 结果 |
|---|---|
| 删除文件 | **18 个 / −808 行**（14 个源文件 + 1 个目录 + 1 个 spec + 2 个头文件常量） |
| 卸载依赖 | **13 个**（npm 报告 removed **196 packages**；`node_modules` 顶层目录 676 → **557**） |
| lock 变更 | `package-lock.json` −2170 行 |
| 新增声明 | `@types/geojson@^7946.0.16` 进 devDependencies（理由见 §三） |
| 杂项 | `src/assets/main.css:1` 删掉指向已删 `base.css` 的死注释 `@import` |
| 测试 | 775 → **769**（−6，全部来自被删的 `coordinateInputStore.spec.ts`，无失败） |

---

## 二、删除清单

### 2.1 源文件（引用核对方式见 §四）

| 文件 | 行数 | 核对结论 |
|---|---|---|
| `src/components/icons/IconCommunity.vue` 等 **5 个** | 47 | Vue create-vue 脚手架残留，全仓 0 命中（无 `import.meta.glob` 覆盖） |
| `src/components/common/BaseSkeleton.vue` | 46 | 0 引用 |
| `src/components/common/DateRangePicker.vue` | 151 | 0 引用（各页面直接用 `@vuepic/vue-datepicker`） |
| `src/components/common/ProgressBar.vue` | 33 | 0 引用（唯一引用者是被删的 `useProgress`） |
| `src/components/layout/ToolDocNav.vue` | 60 | 0 引用（`createToolNavItems.ts` 已接管） |
| `src/composables/useProgress.ts` | 22 | 仅被上面那个死组件引用 |
| `src/views/viewData.ts` | 69 | 0 引用（`docTypes`/`ViewConfig`/`getViewName` 与 `toolData.ts` 重复） |
| `src/views/pages/md-test/MdView.vue` | 12 | 0 引用，router 无该路由，引用的 `public/thisMd.md` 不存在 |
| `src/tools/coord_convert/coordinateInputStore.ts` | 48 | 仅被自己的 spec 引用（`CoordinateInput.vue` 用本地 `ref`） |
| `src/tools/coord_convert/__tests__/coordinateInputStore.spec.ts` | 66 | **随上一条一起删**（避免孤立测试） |
| `src/tools/get_add/TemplateExporter.ts` | 2 | `ADDRESS_HEADERS` 无人 import，`GeocodeCommon.vue:609` 自己重新定义 |
| `src/tools/get_lonlat/TemplateExporter.ts` | 2 | 同上（`LONLAT_HEADERS`） |
| `src/assets/base.css` | 63 | `main.css:1` 的 `@import` 是注释掉的 |
| `src/assets/markdown.css` | 102 | 从未被 import |

### 2.2 卸载的依赖

| 依赖 | 核对结论 |
|---|---|
| `markstream-vue` / `mermaid` / `h3-js` / `leaflet-kml` | `src`/`e2e`/`scripts`/`vite.config.ts` 0 命中 |
| `@iconify/vue` / `radix-vue` / `class-variance-authority` / `clsx` / `tailwind-merge` | 同上 |
| `@vueuse/core` | 卸载后仍作为 `@vuepic/vue-datepicker` 的**传递依赖**存在，正确 |
| `vue-use-monaco` / `vue-echarts` | 同上（自研 `useECharts` + `echarts` 才是在用的） |
| `geojson` | 运行时 0 import（见 §三 的更正） |

---

## 三、两处审计结论被证伪（重要，避免照着错报告删）

### 更正 1：`src/tools/geo_data/togeojson.d.ts` **不能删**

P3-2 写「`togeojson` 有官方类型，此声明文件无引用」。实测：

- `togeojson@0.16.0` 的 `package.json` **没有 `types`/`typings` 字段**；
- `node_modules/@types/togeojson` **不存在**（`@types` 目录 57 个包中无此包）；
- 而 `src/tools/geo_data/geoDataService.ts:2` 有 `import toGeoJSON from 'togeojson'`。

即这个 7 行文件是 togeojson 类型的**唯一来源**，删掉 `type-check` 立刻红。已保留。

### 更正 2：`geojson` 依赖不是「纯死」，删了要补类型声明

P3-3 写「唯一命中是 `earthquakeService.ts:85` 的字符串，未 import 包本身」。阶段 2 P0-4 之后出现：

```ts
// geoDataService.ts:7 / geoAnalysisService.ts:3
import type { Feature, LineString } from 'geojson'
```

运行时包 `geojson` 确实 0 使用（已卸），但类型解析一直靠 **`@types/geojson`**——而它是 `@turf/turf` 的**传递依赖**。直接删 `geojson` 会把「我们显式 import 的类型」变成又一个幽灵依赖，正是 P2-5（`date-fns` 幽灵依赖）的形态。

因此：**卸 `geojson` 运行时包，同时把 `@types/geojson@7946.0.16` 提为显式 devDependency**。`npm ls @types/geojson --depth=0` 确认挂在我们自己名下。

> 教训：**「审计说零引用」不等于「现在零引用」**。审计基线是 `c096944`（2026-10-09），之后的批次会新增 import。删依赖前必须重新 grep，而不是照抄报告表格。

---

## 四、验证

### 引用核对（删除前，`src/` + `e2e/` + `scripts/` + 根配置，含 `.vue` 模板）

- 每个候选文件名（`IconCommunity`/`BaseSkeleton`/`DateRangePicker`/`ToolDocNav`/`viewData`/`MdView`/`coordinateInputStore`/`ADDRESS_HEADERS`/`LONLAT_HEADERS`/`base.css`/`markdown.css`）逐一搜索，命中的均为**同名无关标识符**（`previewData` 含 `viewData` 子串、`GanttChartPage` 的局部变量 `progressBarHtml`、`GeocodeCommon` 自己定义的 `ADDRESS_HEADERS`），逐条人工排除后才删。
- `import.meta.glob('@/tools/*/*Page.vue')`（`ToolDetailView.vue:66`）只覆盖 `tools/` 目录，不含被删的 `md-test/`；仓库无任何 glob 覆盖 `components/icons/`。
- 删除后复查：上述 13 个关键词全部 0 命中；`src/` 下无残留空目录。

### 门禁

| 检查 | 结果 |
|---|---|
| `npm run type-check` | ✅ 0 错误 |
| `npx vitest run` | ✅ **769 passed / 56 files**（−6，全为被删 spec 的用例，无失败） |
| `npx oxlint .` | ✅ 0 warnings / 0 errors |
| `npx eslint .` | ✅ 0 errors |
| `npx prettier --check --experimental-cli .` | ✅ 全符合 |
| `npm run build`（lint+type-check+unit+build+prerender） | ✅ 通过，26 路由预渲染 |
| `CI=true npx playwright test` | ✅ **7 passed / 1 flaky**（flaky 项为 `tools.spec.ts` 工具卡片跳转，与 B4 记录的基线 flaky 一致，非本次引入） |

### 产物与体积

| 指标 | 改前 | 改后 |
|---|---|---|
| `node_modules` 顶层目录 | 676 | **557**（−119） |
| `package.json` dependencies | 49 | **37**（−13 +0；另有 `@types/geojson` 入 devDeps） |
| `package-lock.json` | — | −2170 行 |
| 首屏 JS（modulepreload 16 个文件） | B4 基线 360.5 KB raw / 129.2 KB gzip | **335.1 KB raw / 117.8 KB gzip** |
| `dist/assets/*.js` 中被删库的引用 | — | **0 命中**（mermaid / monaco / markstream / h3-js / leaflet-kml / radix-vue / vue-echarts） |
| 被卸 13 包 `npm ls` | — | 全部 `(empty)` |

> 首屏略降而非持平的原因：这些库本就零引用、不在首屏，本次变化主要来自删除图标组件后共享模块切分略有不同。**D3 的目标（依赖体积 / 安装时间 / `manualChunks` 规则的有效域）已达成，不要期待首屏大幅下降。**

### 反证

删除类改动没有可「改红」的代码路径，等价验证是**引用复查 + 全量门禁**，均已执行。另按台账教训逐条自查：

- 删 spec 随源文件一起删 → `coordinateInputStore.spec.ts` 已一并删除，无孤立 spec（vitest 56 files 无报错）。
- `npm uninstall` 无残留：被卸包在 `node_modules` 中不存在，且 `npm ls <pkg>` 均为 `(empty)`。

---

## 五、偏离与遗留

| # | 内容 |
|---|---|
| 1 | **未删 `togeojson.d.ts`**（审计 P3-2 误列，见更正 1） |
| 2 | **`geojson` 改为类型显式化**而非直接删（见更正 2），devDependencies +1 行 |
| 3 | **未删 `ToastContainer.vue`**——阶段 0 P1-1 已挂载，在用 |
| 4 | `vite.config.ts` 无需改动：`md-diagram` / `monaco` chunk 规则已在 B4 删除（本次确认现存 9 条规则全部有命中目标） |

**D 档剩余**：D1（7 份 TemplateReader → 参数化工厂）、D2（文件名模板/花括号校验/`sanitizeFilename` 收敛）、D4（拆 3 个超大页面）。

---

*上一份记录：[`2026-10-12-c4-fix-record.md`](./2026-10-12-c4-fix-record.md) · 回到：[审计总览](./2026-10-09-audit-00-summary.md)*
