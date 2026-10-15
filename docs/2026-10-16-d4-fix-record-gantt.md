# 2026-10-16 · D4 拆分超大文件（第一批：GanttChartPage.vue）· 实施记录

> **依据**：审计 [`2026-10-09-audit-04-P3-cleanup.md`](./2026-10-09-audit-04-P3-cleanup.md) 的 **P3-5**（超大文件与结构腐化）
> **台账**：[`../plan/2026-10-11-progress-ledger.md`](../plan/2026-10-11-progress-ledger.md) **D 档 D4**
> **提交**：`b2d3978`（导出模块）/ `87280cc`（实例生命周期）/ `1d73d5a`（任务弹窗）
> **状态**：**D4 仅完成第一个文件**。`KmlViewerPage.vue`(1183) 与 `GeocodeCommon.vue`(1037) 未开始，见 §六。
> **测试**：766 → **785 passed / 55 files**（含仓库**首个 .vue 组件挂载测试**）

---

## 一、总览

| 文件 | 行数 | 拆分结果 |
|---|---|---|
| `GanttChartPage.vue` | 1839 → **1026** | −813 行 |
| `ganttSvgExport.ts`（新） | 437 | 导出链路（SVG/PNG/JPG/JSON） |
| `useGanttInstance.ts`（新） | 334 | 实例生命周期 + popup 构造 |
| `TaskEditModal.vue`（新） | 174 | 任务编辑弹窗 |
| `download.ts`（新） | 27 | Blob 下载统一入口 |

审计预估「只抽导出块就能砍掉 460 行，是投入产出比最高的一刀」——实际三步合计 −813 行。

---

## 二、第一步 · 导出链路 → `ganttSvgExport.ts`（`b2d3978`）

原内联的 8 个函数（`collectGanttCSS` / `injectHeaderToSvg` / `cropEmptyDates` /
`exportSVG` / `exportPNG` / `exportJPG` / `dataURLToBlob` / `exportTasks`）只依赖
容器元素与一个错误回调，不碰任何 Vue 状态，抽出后可单测。

**合并的两处近似实现**（审计 P3-4 同模式）：
- `exportPNG` 与 `exportJPG` 原本是两份几乎相同的代码（SVG → canvas → dataURL → Blob → 下载），
  差异只有 mime / quality / 扩展名 → 合成 `exportGanttRaster(ctx, { format, scale, quality })`；
- 三种导出重复的「克隆 SVG → 嵌 CSS → 注入 HTML 头部 → 裁剪空白」前置 → 合成 `prepareSvg`。

**顺带收口下载**：新建 `utils/download.ts` 的 `downloadBlob`（appendChild + **延迟 100ms** revoke），
`exceljsCore.downloadXlsxBlob` 改为委托它。这同时修掉了 2026-09-27 审计记录的
「`click()` 后立即 `revokeObjectURL`，Firefox 会下载到空文件」在甘特图三条导出路径上的残留
（C4 只修了 xlsx 路径）。

**新增测试** `ganttSvgExport.spec.ts`（11 条）：`dataURLToBlob` 解析/失败分支、
`cropEmptyDates` 的裁剪数学（含 padX 钳制、无任务条、铺满不裁）、
`injectHeaderToSvg` 的三条短路。`collectGanttCSS` / `prepareSvg` 依赖真实布局，
**刻意不写假绿断言**，靠 e2e 覆盖。

---

## 三、第二步 · 实例生命周期 → `useGanttInstance.ts`（`87280cc`）

`initGantt` / `destroyGantt` / `reinitGantt` / `refreshGantt` / `switchViewMode` /
`updateGanttOptions` / `applyWeekendOption` + frappe-gantt 的 popup 构造
（那段同时是 XSS 防御关键路径：`set_title/set_details` 直通 innerHTML）。

composable 只依赖 `store` + 3 个页面回调（`onEditTask` / `onDeleteTask` / `onBeforeMutation`），
反向 import 页面的循环依赖被消掉。

**`escapeHtml` 移入 `ganttTaskUtils.ts`** 并补 3 条回归用例（转义元字符 / null→空串 / 数字）。
它是 popup 的 XSS 防线，此前是页面内的私有函数，完全没被测过。

### ⚠ 一个自己差点引入的行为回归

旧 `pushUndo()` 会重置 `dragUndoRecorded`（拖动一次只入栈一次的标志）。该标志随
`initGantt` 移进 composable 后，页面侧入栈就不再重置它 → **一次拖动之后，
后续所有拖动都不再记 undo**（类型检查发现不了，因为两边都"能跑"）。

修法：composable 导出 `resetDragUndoFlag()`，页面的 `pushUndo()` 调用它，等价于旧行为。
已在代码注释与本节记录。

---

## 四、第三步 · 任务编辑弹窗 → `TaskEditModal.vue`（`1d73d5a`）

`<dialog>` 表单 DOM（模板 78 行）+ 表单状态与 CRUD 约 90 行，抽成独立组件。
组件**不碰 store**：保存动作经 `@save` 把表单值交给页面（页面负责 pushUndo / 写 store / 刷新），
页面只剩一行 `<TaskEditModal ref="taskModal" ... @save="onSaveTask" />`。

**仓库第一个 .vue 组件挂载测试**（`TaskEditModal.spec.ts`，5 条）：两种模式的标题/按钮、
`openForCreate`/`openForEdit` 的表单填充（用属性选择器定位，不用下标）、提交时 `@save` 的载荷。
jsdom 不实现 `<dialog>` 的 showModal/close，测试内补桩。

### 踩坑：SFC 里的类型不能跨文件 import

`TaskFormValue` 最初定义在 `TaskEditModal.vue` 的 `<script setup>` 里并 export，
页面 import 时报 **TS2614「Module has no exported member」**。改为把契约类型放在同目录的
`ganttTaskUtils.ts`，两边都从那里 import（组件里留注释说明原因）。

### 踩坑：prettier 解析不了注释里的闭合标签

文件头注释里写了「页面只剩一行 `<TaskEditModal ref="taskModal" ... />`」，
prettier 的 Vue 解析器直接报 `Unexpected closing tag "template"`（179:1）。
**注释中的 `</Xxx ...>` 会被当成顶层闭合标签**。改写措辞后通过——教训记入台账。

---

## 五、验证

| 检查 | 结果 |
|---|---|
| `npm run type-check` | ✅ 0 错误 |
| `npx vitest run` | ✅ **785 passed / 55 files**（766 +19） |
| `npx oxlint .` / `npx eslint .` | ✅ 0 / 0 |
| `npx prettier --check --experimental-cli .` | ✅ 全符合 |
| `npm run build-only` | ✅ 通过 |
| `CI=true npx playwright test` | ✅ **7 passed / 1 flaky**（与基线同一项 `tools.spec.ts` 卡片跳转） |
| `npm run build`（含 prerender） | ❌ **本地环境问题，与本批无关**，见下 |

### `npm run build` 的 prerender 步骤在本地跑不起来（已排除是本次改动）

`prerender` 用 puppeteer-core 启动浏览器，本机报 `Failed to launch the browser process: Code: 0`。

**排除过程**：
1. `git stash` 全部改动后在 clean HEAD 上复现 → **同样失败**，说明与 D4 无关；
2. 同一台机器上 Playwright 用 `channel: 'msedge'` 能正常启动 Edge 155（e2e 7 passed），
   而 puppeteer-core 启动不了，`msedge.exe --version` 甚至无任何输出；
3. 诊断过程中我在仓库根目录建的临时 profile 目录（`.tmp-edge-profile` / `.tmp-edge2`）
   一度让 oxlint 扫出 **52602 个 error**（扫到了浏览器自带文件）——已删除目录、清掉残留进程，
   复测 oxlint 回到 0/0。

**结论与处置**：这是本机浏览器环境问题（puppeteer 与 Edge 155 的兼容），不是代码回归；
本批改用 `build-only` + 完整 e2e 验证产物与运行时行为。**未改 prerender 脚本**（改构建链路
超出 D4 范围，且牵涉 Vercel 侧配置），建议单独立项评估「prerender 也改用 Playwright 启动器」。

---

## 六、D4 剩余（未开始）

| 文件 | 行数 | 拆分建议（审计 P3-5 原文） |
|---|---|---|
| `KmlViewerPage.vue` | 1183 | Leaflet 生命周期 / KML DOM 解析 / 树渲染 / 图层管理四件事 |
| `GeocodeCommon.vue` | 1037 | `mode: 'add' \| 'lonlat'` 一个组件装两个工具，含 6 个 `showErrorDialog` 分支 |

这两个文件的拆分尚未动工，本记录只覆盖 GanttChartPage。

---

*上一份记录：[`2026-10-15-d2-fix-record.md`](./2026-10-15-d2-fix-record.md) · 回到：[审计总览](./2026-10-09-audit-00-summary.md)*
