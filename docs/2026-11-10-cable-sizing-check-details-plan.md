# 电缆选型 · 校核明细透明化方案与实施记录

> 分支：`maint/tool-23-cable-sizing`
> 日期：2026-11-10
> 状态：已实施
> 范围：只改校核明细的展示层，不改选型计算

## 1. 背景

计算书已经做到逐步可折叠、关键值、来源标签和查表/插值明细；校核明细仍是 4 列表格：

```text
项目 | 要求 | 实际 | 结论
```

存在三个问题：

- 三相的“3 次谐波含量”在引擎里参与了 `kh`、`IN`、`ampacityDesignCurrentA`、`requiredInA`、`totalAmpacityA` 和 `drivers`，但校核明细没有独立行，只在载流量备注里出现 `kh=...`，看起来像孤儿变量；
- 校核明细没有“控制 / 未控制”“裕度”“为什么”，用户看不出某个变量是否真的影响了最终截面；
- 要求值和实际值只是字符串，没有公式、代入和来源。

## 2. 目标

每条校核都能回答：

1. 要求是什么？（公式 + 代入 + 来源）
2. 实际怎么算？（公式 + 代入 + 来源）
3. 差多少？（裕度/缺口）
4. 为什么通过/不通过？由谁控制？

## 3. 设计

### 3.1 增加“谐波 / 中性线”独立行

三相交流时固定显示一行，按 `h3` 分档：

| h3 | 行内容 |
|---|---|
| 0% | `kh=1.00，IN=0，不修正`，结论“通过”，控制“否” |
| 1–15% | `kh=1.00，IN=0`，结论“通过”，控制“否” |
| 15–33% | `kh=0.86`，`Iz` 已乘 0.86 |
| 33–45% | `IN = 3 × h3 × Ib`，按 `IN` 选型 |
| >45% | `IN = 3 × h3 × Ib`，按 `IN` 选型 |

即使 `h3=0` 也显示，避免再次出现“孤儿”感。

### 3.2 校核行改成可展开卡片

折叠时显示：项目 + 关键值 + 控制标记 + 结论。

展开时显示：

- 要求式；
- 实际式；
- 要求 / 实际；
- 裕度；
- 符号 chips（复用计算书的来源标签）；
- “为什么”文案；
- “查看计算书第 ④ 步”跳转。

### 3.3 控制与裕度

- 控制：载流量、电压降、短路热稳定、机械强度、保护配合分别对应 `drivers`；
- 谐波控制：`(kh < 1 || neutralBased) && drivers.includes('载流量')`；
- 裕度：载流量用 `Iz - Ib/IN` 和百分比，压降用百分点，热稳定/机械用 mm²，保护用 `In - Ib` 和 `Iz - In`。

### 3.4 数据模型

新增 `checkDetails.ts`：

```ts
interface CheckDetail {
  key: string
  label: string
  keyValue: string
  required: string
  actual: string
  pass: boolean
  controlling: boolean
  margin: string
  formula: string
  substitution: string
  symbols: CalcSymbol[]
  why: string
  stepKey?: string
  stepLabel?: string
}
```

`buildCheckDetails(input, result)` 只读结果，不改计算。

## 4. 实施记录

- 新增 `src/tools/cable_sizing/checkDetails.ts`。
- 页面“校核明细”从表格改为 `<details>` 卡片列表，默认折叠。
- 增加“谐波 / 中性线”行；`h3=0` 显示“不修正”。
- 每行显示要求式、实际式、要求/实际、裕度、符号来源、“为什么”。
- 控制项加“控制”标记和蓝色左边框。
- 增加“查看计算书第 X 步”按钮，打开计算书并展开对应步骤。
- 测试：新增 `checkDetails.spec.ts` 7 条；cable_sizing 合计 52 条；全量 **1004 passed / 81 files**。
- 截图：`test-results/check-summary.png`、`check-harmonic.png`、`check-ampacity.png`、`check-jump.png`。
- 提交：待提交（提交后回填）。

## 5. 不做

- 只看未通过/只看控制项的筛选；
- 校核明细的打印/导出单独排版；
- 把校核明细和计算书合并成同一份文档。
