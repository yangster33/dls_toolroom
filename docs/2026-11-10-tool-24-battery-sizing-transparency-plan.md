# 工具 24 · 蓄电池容量计算 · 显式可追溯改造计划

> 分支：`maint/tool-24-battery-sizing`
> 日期：2026-11-10
> 状态：待实施
> 范围：只改展示层与数据描述，不改电池容量计算模型

## 1. 现状

现有页面是“左侧参数 + 右侧结论 + 校核表格”：

- 参数：电池类型、负荷模式、UPS kVA / 负载率 / 功率因数、负荷功率、备电时间、效率、线路效率、环境温度、直流电压、单体电压、终止电压、设计余量、容量系数、厂家 W/单体、最大并联组数、DOD、SOH、温度降额、最大倍率。
- 结果：串联单元/单体数、终止电压、放电电流、所需 Ah、单只 Ah、并联组数、配置 Ah/能量、预估备电时间、容量系数、温度系数、W/单体校核。
- 校核：安时容量、并联组数、终止电压、恒功率、能量容量、放电倍率、温度降额。

问题：

- 没有逐步计算书，容量系数、温度系数、α、W/单体等只出现在结果或备注里，容易变成“孤儿变量”；
- 校核表只有“要求 / 实际 / 结论”，没有公式、代入、裕度、为什么；
- 没有来源标签，用户分不清哪些是输入、查表、计算、常数、默认；
- 没有参数说明表，不知道某个值能不能改、依据是什么；
- 右栏没有吸顶速览，结果和校核分散。

## 2. 目标

每个数都能回答：

1. 从哪来？（输入 / 查表 / 计算 / 常数 / 默认）
2. 怎么算？（公式、代入、表号、插值）
3. 能不能改？（直接改 / 间接改 / 不能改）
4. 校核差多少？为什么通过/不通过？由谁控制？

## 3. 复用工具 23 的四个模式

1. **计算书**：步骤可折叠，折叠显示关键值，展开显示公式、代入、符号、来源、备注。
2. **来源标签**：`输入 / 查表 / 计算 / 常数 / 默认`，符号 chip 带标签，`sourceDetail` 放表号/规则。
3. **校核明细**：每条校核可展开，显示要求式、实际式、裕度、来源符号、“为什么”、控制标记。
4. **参数说明 + 视口优先**：参数表增加“来源 / 可修改 / 依据”；右栏吸顶速览，默认折叠计算书。

## 4. 计算书步骤

### ① 负荷功率

- UPS 模式：`P = S × 负载率 × cosφ`
- 功率模式：`P = 输入负荷功率`
- 关键值：`P = 24.00 kW`
- 符号：`S`、`K_load`、`cosφ`、`P`

### ② 放电电流

```text
I = P × 1000 / (U × η × η_line)
```

- `U` 取串联后的实际直流电压 `dcVoltageActual`；
- 关键值：`I = 555.6 A`；
- 符号：`P`、`U`、`η`、`η_line`、`I`。

### ③ 串联单元 / 单体

```text
seriesUnits = round(U / cellVoltage)
seriesCells = seriesUnits × (12 V 单体 ? 6 : 1)
endVoltage = seriesCells × endVoltagePerCell
```

- 关键值：`seriesCells = 24 只`、`endVoltage = 42.0 V`；
- 符号：`U`、`U_cell`、`N_s`、`N_c`、`U_end`。

### ④ 容量系数 / 温度 / 老化

- 铅酸：
  - `α = f(备电小时数)`，查表/插值；
  - `Kt = 1 + α × (T - 25)`；
  - `capacityCoefficient = f(备电小时数)`，查表/插值。
- 锂电：
  - `DOD`、`SOH`、`tempDerating` 由输入/厂家数据；
  - `Kt` 为温度降额。
- 关键值：`Kt = 1.05`、`K = 0.42`、`α = 0.006`；
- 来源：`查表 / 输入 / 厂家数据`。

### ⑤ 所需容量

铅酸（安时法）：

```text
Q = K × I × T / (Kt × temperatureFactor)
```

锂电（能量法）：

```text
E = (P × T) / (η × η_line) × K / (DOD × SOH × KT)
Q = E × 1000 / U
Q_min,C = I / maxCRate
```

- 关键值：`Q = 120.5 Ah`；
- 符号：`K`、`I`、`T`、`Kt`、`DOD`、`SOH`、`KT`、`Q`。

### ⑥ 并联组数 / 标准容量

铅酸：

```text
strings = ceil(Q / MAX_UNIT_AH)
unitAh = nextStandardAh(Q / strings)
configuredAh = unitAh × strings
```

锂电：

```text
unitAh = nextStandardAh(max(Q, Q_min,C))
configuredAh = unitAh
```

- 关键值：`2 组 × 100 Ah = 200 Ah`；
- 符号：`Q`、`MAX_UNIT_AH`、`strings`、`unitAh`、`configuredAh`；
- 来源：标准 Ah 序列（常数表）。

### ⑦ 恒功率 / W 单体校核

```text
W_cell = P × 1000 × K / (seriesCells × η × η_line)
```

- 与厂家 W/单体比较；
- 关键值：`W_cell = 35.2 W`；
- 来源：`计算` / `厂家数据`。

### ⑧ 备电时间 / 放电倍率

```text
runtime = configuredAh / requiredAh × backupMinutes
C-rate = I / configuredAh
```

- 关键值：`runtime = 120 min`、`C-rate = 0.28 C`；
- 符号：`Q_config`、`Q_req`、`T`、`I`、`C-rate`。

## 5. 校核明细

每条校核改成可展开卡片：

| 校核 | 要求 | 实际 | 裕度 | 控制 |
|---|---|---|---|---|
| 安时容量 | `Q ≥ 120.5 Ah` | `200 Ah` | `+79.5 Ah` | 视情况 |
| 并联组数 | `≤ 4 组` | `2 组` | `+2 组` | 视情况 |
| 终止电压 | `U_end ≥ U_min` | `42.0 V` | `+2.0 V` | 视情况 |
| 恒功率 | `W_cell ≥ 35.2 W` | `40 W` | `+4.8 W` | 视情况 |
| 能量容量 | `E ≥ 5.8 kWh` | `9.6 kWh` | `+3.8 kWh` | 视情况 |
| 放电倍率 | `C-rate ≤ 1.0 C` | `0.28 C` | `+0.72 C` | 视情况 |
| 温度降额 | `Kt ≥ 1.0` | `1.05` | `+0.05` | 视情况 |

额外增加“容量系数 / 温度”行，避免 `Kt`、`α`、`K` 变成孤儿：

```text
容量系数 / 温度
Kt = 1 + 0.006 × (35 - 25) = 1.06
K = 0.42（查表，备电 2h）
→ 已参与 Q 计算；控制 / 未控制
```

每条校核展开后显示：

- 要求式、实际式；
- 要求 / 实际 / 裕度；
- 符号 chips（来源标签）；
- “为什么”；
- “查看计算书第 X 步”。

控制项建议：

- 容量由 `requiredAh`、`minAhByCRate`、`powerCheck`、`parallel` 中的最大约束决定；
- 在 `BatterySizingResult` 增加 `drivers: string[]`，例如 `['安时容量']`、`['放电倍率']`、`['恒功率']`；
- 校核卡用 `drivers.includes(label)` 标记“控制”。

## 6. 来源与数据

| 数据 | 来源 | 可修改 |
|---|---|---|
| 容量系数 K | 表 / 厂家放电曲线 | 间接（改备电时间/电池类型） |
| α | 表 / 插值 | 间接 |
| Kt | 公式 | 间接（改温度） |
| 标准 Ah | 常数表 | 否 |
| W/单体 | 厂家数据 | 是 |
| DOD / SOH / 温度降额 | 厂家/项目 | 是 |
| 最大并联组数 | 规范/项目 | 是 |

可选：增加“厂家电池表”入口，允许覆盖容量系数和 W/单体，类似工具 23 的厂家 DC 表。

## 7. 页面布局

右栏顺序：

1. 吸顶结果速览：配置容量 Ah、并联组数、预估备电、PASS/REVIEW；
2. 计算书（8 步，默认折叠）；
3. 结论卡；
4. 警告；
5. 校核明细（可展开卡片）；
6. 数据与依据；
7. 页面下方参数说明表（来源/可修改/依据）。

1440×900 首屏应看到：结果速览、结论、校核摘要；计算书默认折叠。

## 8. 数据模型

```ts
export interface BatteryStep {
  key: string
  index: number
  title: string
  keyValue: string
  formula: string
  substitution: string
  result: string
  symbols: CalcSymbol[]
  note?: string
}

export interface BatteryCheckDetail {
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
}
```

- 新增 `buildBatterySteps(input, result)` 和 `buildBatteryCheckDetails(input, result)`；
- 复用 `CalcSymbol` / `sourceLabel` / `check-status`；
- 结果增加 `drivers`，用于控制标记。

## 9. 测试

- 计算书：铅酸/锂电各一条，步骤数、公式、关键值、来源标签；
- 校核：容量、并联、终止电压、恒功率、能量、倍率、温度；
- 控制标记：容量 vs 倍率 vs 恒功率；
- 参数表：来源/可修改非空；
- 页面：1440×900 截图，计算书展开/折叠、校核卡展开；
- 门禁：`type-check`、`lint:check`、`vitest`、`build-only`。

## 10. 实施顺序

1. `refactor(battery): 结果增加 drivers 与控制标记`
2. `feat(battery): 新增逐步计算书与来源标签`
3. `feat(battery): 校核明细可展开，补裕度/为什么`
4. `feat(battery): 参数说明来源列与吸顶速览`
5. `test(battery): 黄金用例与页面截图`
6. `docs(battery): 同步工具/方法/技术说明`

## 11. 不做

- 不改电池容量模型；
- 不做多厂家电池库；
- 不做电池组接线/熔断器/直流断路器完整选型；
- 不做电池健康度在线评估。

## 12. 风险

- 容量系数、α、温度降额依赖电池厂家数据，内置表只能作初选；
- 铅酸与锂电公式不同，计算书必须按类型分支显示，避免把锂电的 DOD/SOH 套到铅酸；
- 多组并联的均流、保护选择性不在本工具范围，结果页要明确。
