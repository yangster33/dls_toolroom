# 电缆选型工具 · 结果透明化与状态徽标修复方案

> 分支：`maint/tool-23-cable-sizing`
> 日期：2026-11-09
> 状态：已实施（2026-11-09）
> 前置：`fbee2a2`（计算口径调整已完成）

## 1. 背景

计算口径调整后，结果信息已经比较完整，但暴露两个可用性问题：

1. **状态徽标换行**：校核表“结论”列的“通过/不通过”在窄列中折成两行，daisyUI `.badge` 固定高度导致第二个字溢出底色，看起来像没有被框住。
2. **信息不透明**：参数、公式、中间值都在，但彼此没有串起来。用户不知道公式里的符号对应哪个输入、数值怎么代入、最终为什么是这个截面。

本方案只改结果呈现与交互，不改计算引擎。

## 2. 已确认的选择

| 问题 | 选择 |
|---|---|
| 计算书位置 | 结果区下方折叠（复用现有“计算过程”面板） |
| 目标读者 | 主要是自己复核，不额外做“简明/专业”双模式 |
| 符号联动 | 静态符号对照表 + 悬停/聚焦联动高亮 |

## 3. 状态徽标修复

- 弃用 daisyUI `.badge`，新增页面级 `.check-status`：
  - `display: inline-flex`、`align-items: center`、`justify-content: center`
  - `min-width: 3.5em`、`padding: 0.15rem 0.45rem`
  - `white-space: nowrap`、`height: auto`、`line-height: 1.5`
  - 方角、等宽字体，与工程图纸风格一致
- 颜色沿用 `--color-success` / `--color-error`，背景用 `color-mix` 淡化。
- 校核表结论列 `white-space: nowrap`；窄屏依赖现有 `.table-wrap` 横向滚动。
- 同一个 `.check-status` 复用于计算书每一步的判定。

## 4. 计算书（结果区下方折叠）

把现有 `<details class="calc-panel">` 的“计算过程”升级为“计算书（逐步推导）”，默认展开。八步：

| 步 | 标题 | 公式 |
|---|---|---|
| ① | 计算负荷 | `Pjs = P × Kd`（按电流输入时反算） |
| ② | 计算电流 | 三相 `Ib = Pjs×1000 / (√3×U×cosφ×η)`；单相 `U×cosφ×η`；直流 `U×η` |
| ③ | 修正系数 | `kt = f(θ)`、`kg = f(敷设方式, 成束根数)`、`ks = f(ρ)`、`kh = f(h3)` |
| ④ | 载流量 | `Iz = I_table × kt × kg × ks × kh × n` |
| ⑤ | 电压降 | 三相 `ΔU = √3×Ib×L×(R·cosφ + X·sinφ)`；单相/直流按 2 倍 |
| ⑥ | 短路热稳定 | `Smin = Isc×√t / k` |
| ⑦ | 保护配合 | `Ib ≤ In ≤ Iz`；熔断器 `In ≤ Iz/k3` |
| ⑧ | 结论 | `S = max(各约束所需截面)` |

每步统一渲染为四行：

```text
① 计算电流
Ib = Pjs × 1000 / (√3 × U × cosφ × η)
   = 24.00 × 1000 / (1.732 × 380 × 0.85 × 0.90)
   = 47.67 A

Pjs 计算负荷 24.00 kW    U 标称电压 380 V
cosφ 功率因数 0.85       η 效率 0.90
```

约定：

- `R`、`X` 以 `Ω/km` 显示（数值等于引擎内部 mΩ/m）；`L` 以 km 代入。
- 数值与引擎结果对象同源，不在模板里重算。
- 每步可带 `pass` 判定，用 `.check-status` 显示。
- 第 ⑧ 步不重复选型逻辑，只展示 `drivers` 和最终截面。

## 5. 参数说明表

计算书末尾增加可折叠“参数说明”，列为：

| 符号 | 名称 | 含义 | 在计算中的位置 | 影响方向 | 依据 |
|---|---|---|---|---|---|

覆盖 `P / Kd / U / Ib / cosφ / η / L / S / kt / kg / ks / kh / n / Iz / R / X / Isc / t / In / k / k3`。

静态表放在 `calculationSteps.ts`，与页面模板分离，便于后续增补。

## 6. 符号联动

- 输入控件与公式符号统一用 `data-symbol` 标记，例如 `data-symbol="U"`、`data-symbol="Isc"`。
- 计算书中的符号做成 chip：`U 380 V`，同时显示名称。
- 页面根容器监听 `mouseover / mouseleave / focusin / focusout`，用事件委托读取最近的 `[data-symbol]`，写入 `activeSymbol`。
- 命中的输入控件与所有同符号 chip 加 `.is-symbol-active`：输入框描边高亮，chip 反色/加边框。
- 静态对照表始终可见，联动只是增强，不依赖它也能读懂。

## 7. 结论卡“为什么”一句话

在 `PASS/REVIEW` 下增加一段自然语言说明，例如：

> 计算电流 47.7 A；按 C 敷设、35 ℃、1 回路修正后，16 mm² 的允许载流量 85.4 A；压降 2.10%；热稳定要求至少 13.3 mm²；保护电器 50 A 不超过 85.4 A。最终取 16 mm²。

由页面 `computed` 基于 `result` 生成，不进入引擎。

## 8. 数据结构

```ts
export interface CalcSymbol {
  symbol: string
  name: string
  value: string
  unit?: string
  /** 对应输入控件的 data-symbol；计算值不填 */
  inputSymbol?: string
}

export interface CalcStep {
  key: string
  index: number
  title: string
  formula: string
  substitution: string
  result: string
  symbols: CalcSymbol[]
  pass?: boolean
  note?: string
}

export interface ParameterDoc {
  symbol: string
  name: string
  meaning: string
  position: string
  impact: string
  basis: string
}
```

`buildCalculationSteps(input, result)` 与 `buildParameterDocs()` 都是纯函数，放
`src/tools/cable_sizing/calculationSteps.ts`。

## 9. 改动文件

| 文件 | 改动 |
|---|---|
| `src/tools/cable_sizing/calculationSteps.ts` | 新增：八步推导 + 参数说明数据 |
| `src/tools/cable_sizing/__tests__/calculationSteps.spec.ts` | 新增：公式、代入值、分支用例 |
| `src/tools/cable_sizing/CableSizingPage.vue` | 状态徽标、计算书模板、符号联动、结论一句话 |
| `public/docs/cable_sizing/tool.md` | 补一句“结果区下方可展开计算书” |

## 10. 测试

- 默认三相工况：8 步齐全；第 ② 步含 `√3`；第 ④ 步代入含所选截面基准载流量；第 ⑥ 步含热稳定最小截面；第 ⑦ 步通过；第 ⑧ 步含最终截面。
- 单相：第 ② 步不含 `√3`。
- 直流：第 ② 步为 `U × η`。
- 熔断器：第 ⑦ 步含 `k3`。
- 参数说明表：符号齐全、字段非空。
- 页面验证：默认工况与“D 直埋 + 40% 谐波 + 3 回路 × 2 根并联”截图；悬停符号时输入框高亮。

## 11. 验收标准

- “通过/不通过”横向显示，完整落在底色内，窄屏不竖排。
- 计算书八步可展开，公式、符号、代入值、结果齐全，数值与结果卡一致。
- 悬停公式符号时对应输入框高亮；聚焦输入框时同符号 chip 高亮。
- 参数说明表能查到每个符号的含义、位置、影响方向和依据。
- `type-check`、`lint:check`、`vitest`、`build-only` 全部通过。

## 12. 不做

- 不做独立标签页、独立打印页、Word/PDF 导出。
- 不做“简明/专业”双模式。
- 不修改计算引擎与基础数据。
- 不做参数弹窗，统一用参数说明表。

## 13. 实施记录（2026-11-09）

- 状态徽标：`.check-status` 替换 daisyUI badge，`white-space: nowrap`、`height: auto`、`min-width: 3.5em`；实测 36.4 × 20.2 px，横向显示。
- 计算书：`calculationSteps.ts` 生成八步，复用结果区下方折叠面板；符号 chip + `data-symbol` 事件委托联动。
- 参数说明：覆盖 28 个符号，含含义、位置、影响方向、依据；表格移到工作区下方全宽显示，避免右栏拥挤。
- 结论卡：新增自然语言“为什么”一段。
- 测试：`calculationSteps.spec.ts` 6 条；cable_sizing 合计 26 条。
- 验证：`type-check`、`lint:check`、`vitest`、`build-only` 通过；默认工况与“D 直埋 + 40% 谐波 + 3 回路 × 2 根并联”截图正常。
- 联动实测：悬停 `U 380 V` chip → 电压输入框加 `is-symbol-active`；悬停电压输入框 → 同符号 chip 高亮。
