# 选型工具共用模块抽取方案（工具 23 / 24 → 25 / 26 / 28）

> 分支：`master`（工具 24 已合并；25/26/28 还在 `9f37ec1`，抽取落 master 后各自 rebase）
> 日期：2026-11-11
> 状态：待实施
> 定位：纯重构，不改任何计算口径；页面 DOM 结构与 class 名保持不变

## 1. 背景

工具 25 / 26 / 28 三份计划都写着「复用工具 23 的 `CalcSymbol` / `sourceLabel` / `check-status`」。
如果不抽，同样的代码会被复制到第 3、4、5 份；抽完则新工具页面从约 1300 行降到约 600 行。

## 2. 现状数据（实测）

| 层 | 证据 | 重复量 |
|---|---|---|
| 页面模板 + 脚本 | cable 1236 / battery 931 非空行，27 段 ≥8 行整段复制 | 600 行逐行相同 |
| 页面 scoped 样式 | cable 442 / battery 394 行，391 行相同；dc / hvac 也带同样 35 组规则 | 约 390 行 |
| `calculationSteps.ts` | 863 vs 854 行 | 290 行相同（类型 + helper） |
| `checkDetails.ts` | 406 vs 396 行 | 115 行相同（类型 + helper） |
| `traceability.ts` | 292 vs 171 行 | 仅 60 行相同，**不抽** |
| `UnitField.vue` | 4 份；battery / dc / hvac 三份 hash 完全一致，cable 那份多「清空不写回 0」修复 | 3 个工具仍带该 bug |

## 3. 抽取清单

```text
src/tools/shared/
  calcTrace.ts          # 类型 + makeSymbol + whyText + circled + formatNumber + sourceLabel
  report.ts             # 计算书文本拼装（步骤块 / 校核块）
  useSymbolLink.ts      # activeSymbol 联动（chip ↔ 输入框高亮）
  useUiMode.ts          # 简易 / 专业快照 + localStorage + toast
  components/
    UnitField.vue       # 合并 4 份，采用 cable 的“空值不写回 0”版本
    SymbolChip.vue
    CalcBook.vue        # 折叠计算书，暴露 openStep(key)
    CheckList.vue       # 校核卡，emit open-step
    ResultStrip.vue
    ParamDocs.vue
    AssumptionCard.vue
    ModeSwitch.vue
src/assets/
  calc-trace.css        # 已有（计算书 / 校核 / chip / 参数表）
  selection-tool.css    # 新增：页面壳（panel / field / verdict / notice / workbench …）
```

### 3.1 共用类型与函数

```ts
export type SymbolSource = 'input' | 'table' | 'calc' | 'constant' | 'default'

export interface CalcSymbol { symbol; name; value; unit?; inputSymbol?; source; sourceDetail? }
export interface CalcStep { key; index; title; keyValue; formula; substitution; result; symbols; pass?; controlling?; note? }
export interface ParameterDoc { symbol; name; meaning; position; impact; source; editable; basis }
export interface CheckDetail { key; label; keyValue; required; actual; pass; controlling; margin;
                               formula; substitution; symbols; why; stepKey?; stepLabel? }

export function makeSymbol(name, value, source, options?): CalcSymbol
export function whyText(result: { pass; controlling; margin }, drivers: string[], failHint: string): string
export function circled(index: number): string      // ①..⑩
export function stepLabelOf(step: CalcStep): string // "⑤ 所需容量"
export function formatNumber(value: number, digits?: number): string
export const SOURCE_LABELS; export function sourceLabel(source): string; export function sourceTitle(symbol): string
```

工具侧保留自己的 `buildXxxSteps` / `buildXxxCheckDetails` 与 `traceability.ts`，只把类型和 helper 换成 import；
为避免大改 import 路径，工具模块 `calculationSteps.ts` / `checkDetails.ts` 继续 `export type { … }` 转发。

### 3.2 组件契约

| 组件 | props | emits / 暴露 |
|---|---|---|
| `CalcBook` | `steps`、`modeNote?`、`activeSymbol?` | `activate` / `deactivate`；`expose({ openStep(key) })` |
| `CheckList` | `details`、`activeSymbol?` | `activate` / `deactivate` / `open-step` |
| `SymbolChip` | `symbol`、`active` | `activate` / `deactivate` |
| `ResultStrip` | `value`、`unit?`、`badge?`、`pass`、`drivers`、`href?` | — |
| `ParamDocs` | `docs`、`title?` | — |
| `AssumptionCard` | `title`、`items` | — |
| `ModeSwitch` | `modelValue` | `update:modelValue` |
| `UnitField` | 现有 API 不变（label / unit / hint / min / max / step / disabled） | `v-model` |

组件内 DOM 结构与 class 名与现状一致，保证样式零改动。

### 3.3 组合式

```ts
useSymbolLink()   // { activeSymbol, isActive, activateSymbol, deactivate, chipActive }
useUiMode({ storageKey, createSimple, createDefault, getForm, setForm, clone?, onSwitch? })
                  // { uiMode, isSimple, setUiMode, resetMode }
```

`useUiMode` 只负责快照、持久化、toast 与切换后的写入；派生字段（如蓄电池的 η_ah / U_min）仍留在页面 `watch` 里。

## 4. 实施顺序与验收

| # | 步骤 | 改动 | 验收 |
|---|---|---|---|
| 1 | 类型与 helper | 新增 `calcTrace.ts` / `report.ts`；两工具改为 import，删除本地副本 | type-check、单测全绿；`git diff` 无行为变化 |
| 2 | 组件 | 新增 7 个展示组件 + `UnitField` 合并；两页改造并删除重复模板 | 单测 + 1440×900 截图与基线对比（cable / battery 各 2 张） |
| 3 | 页面壳样式 | 新增 `selection-tool.css`；两页删除对应 scoped 规则；根节点加 `selection-tool` | 截图与第 2 步逐像素一致（PNG 字节数相同） |
| 4 | 组合式 | 新增 `useSymbolLink` / `useUiMode`；两页改用 | 模式切换、chip 联动、重置、刷新保持 手工回归 |
| 5 | 新工具迁移 | 更新 25/26/28 计划中的「复用工具 23」为「复用 `src/tools/shared`」 | 文档评审 |

门禁每一步都跑：`type-check`、`lint:check`、`test:unit`、`build-only`。

## 5. 不抽的部分

- `traceability.ts`：域内表数据，只有 60 行巧合相同；
- `buildXxxSteps` / `buildXxxCheckDetails`：域逻辑，占各工具 850 行的大头；
- 各工具引擎（`cableSizing.ts` / `batterySizing.ts` 等）；
- 报告里的域字段（只抽拼装骨架，标题与字段仍由页面给）。

## 6. 风险与对策

1. **组件化改动 DOM → 视觉回归**：组件内保持原 class 与层级；每步用 `test-results/` 基线截图对比，第 3 步要求逐像素一致。
2. **页面壳 CSS 外溢**：所有规则加 `.selection-tool` 前缀，与 `.calc-trace` 同一套路；dc / hvac 暂不接入（它们的分支重写时再加 class）。
3. **UnitField 统一是行为变化**：清空输入不再写回 0、失焦回填上次值；dc / hvac 的「0 = 自动」类字段逐项确认（0 仍可正常输入）。
4. **组合式抽取容易过度**：`useUiMode` 只处理快照/持久化/toast，业务 watch 留在页面。
5. **25/26/28 分支落后 17+ 提交**：抽取先落 master，它们 rebase 后再实施，避免边抽边改同一文件。

## 7. 提交拆分

1. `refactor(tools): 抽出计算书类型、来源标签与报告拼装`
2. `refactor(tools): 抽出符号 chip / 计算书 / 校核卡等共用组件`
3. `refactor(tools): 统一输入组件 UnitField（含空值不写回 0）`
4. `refactor(tools): 抽出选型工具页面壳样式`
5. `refactor(tools): 抽出符号联动与简易/专业模式组合式`
6. `test(tools): 共用模块用例`
7. `docs(tools): 共用模块抽取实施记录与台账`

## 8. 实施记录（2026-11-11）

已实施，提交 `1ec718e` / `bda2e9f` / `948a080` / `9e6fb6c`（+ 文档提交）。

| 层 | 结果 |
|---|---|
| 类型与工具 | `calcTrace.ts` + `report.ts`；两工具的 calculationSteps / checkDetails 去掉 290 / 115 行重复，类型继续原路径 re-export |
| 组件 | 7 个展示组件 + 统一 `UnitField`；cable / battery 页面改用组件，dc / hvac 的 UnitField 同步切换并删除 4 份副本 |
| 组合式 | `useSymbolLink` / `useUiMode` / `useCopyText`；两页删掉 chip 联动、快照、持久化、复制逻辑约 150 行 |
| 页面壳样式 | `selection-tool.css`（473 行）；cable / battery 的 scoped 样式从 442 / 394 行降到 20 / 57 行 |
| 页面规模 | cable 1860 → 1118 行，battery 1456 → 730 行（−40% / −50%） |
| 测试 | **1058 passed / 87 files**（shared 20 条：类型、报告、组合式、UnitField） |

验证：

- 蓄电池首屏截图与抽取前**逐字节相同**（sha256 `2a8222…`），说明组件化没有改动渲染；
- 电缆首屏仅差 40 字节（视觉一致），计算书展开、校核卡、chip、结论卡正常；
- Playwright：计算书展开/跳转、chip 悬停高亮对应输入、专业改 K=1.4 切简易再切回仍保留、刷新后模式保持；
- dc / hvac 页面正常渲染（14 / 17 个 UnitField），空输入不再写回 0；
- `type-check`、`lint:check`（175 files）、`build-only` 全绿。

与计划的差异：

1. **页面壳 CSS 提前到第 2 批**：组件里的 `.panel` / `.panel-head` 命中不到页面 scoped 规则，校核卡头一度错位；
   因此把 shell 抽成 `selection-tool.css` 与组件同批完成，原计划第 2、3 步合并。
2. 计划 6 个提交合并为 4 个代码提交 + 1 个文档提交（页面改动跨层，单独拆出不可编译）。
3. `useUiMode` 增加 `clone` 选项：电缆的 `dcManufacturerAmpacity` 数组需要深拷贝。
4. 后续工具 25 / 26 / 28 直接复用：根节点加 `selection-tool calc-trace`、`<script>` 里 import 两个 css，
   再用 `CalcBook / CheckList / ResultStrip / ParamDocs / AssumptionCard / ModeSwitch` 即可。

