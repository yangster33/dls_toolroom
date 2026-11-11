# 工具 25 · 通信直流电源柜选型 · 显式可追溯改造计划

> 分支：`maint/tool-25-dc-power-cabinet`
> 日期：2026-11-10
> 状态：已实施（2026-11-11，见 §13）
> 范围：只改展示层与数据描述，不改电源柜容量/模块/柜体计算模型

## 1. 现状

现有页面按“直流系统与负荷 → 蓄电池与均充 → 整流模块与冗余 → 柜体与交流进线”四组参数输入，右侧给结论和校核表。

- 输入：直流电压、负荷模式（电流/功率）、近期负荷、远期增长、电池 Ah、均充倍率、模块电流、模块降额、冗余（N/N+1/N+2）、模块 U、备用 U、柜高/宽/深、单柜最大模块数、交流相数/电压/功率因数、整流效率、断路器余量。
- 结果：负荷电流、均充电流、设计电流、远期电流、模块有效电流、主用/备用/总模块、安装标称/有效容量、满架模块/容量、模块槽位、U 位、柜数、推荐柜体、直流主断路器、DC/AC 功率、AC 输入电流、AC 断路器。
- 校核：整流容量、冗余配置、满架容量、模块槽位、柜内 U 位、直流主断路器、交流输入断路器。

问题：

- 没有逐步计算书，模块数、冗余、U 位、柜数、断路器之间的推导链不可见；
- 校核表只有“要求 / 实际 / 结论”，没有公式、代入、裕度、为什么；
- 没有来源标签，模块降额、标准壳架、柜高 U 数、断路器余量等来源不清；
- 没有参数说明表，用户不知道哪些是厂家数据、哪些是规范值；
- 右栏没有吸顶速览。

## 2. 目标

每个数都能回答：

1. 从哪来？（输入 / 查表 / 计算 / 常数 / 默认）
2. 怎么算？（公式、代入、表号、标准壳架）
3. 能不能改？（直接改 / 间接改 / 不能改）
4. 校核差多少？为什么通过/不通过？由谁控制？

## 3. 复用工具 23 的四个模式

1. **计算书**：步骤可折叠，折叠显示关键值，展开显示公式、代入、符号、来源、备注。
2. **来源标签**：`输入 / 查表 / 计算 / 常数 / 默认`，符号 chip 带标签。
3. **校核明细**：每条校核可展开，显示要求式、实际式、裕度、来源符号、“为什么”、控制标记。
4. **参数说明 + 视口优先**：参数表增加“来源 / 可修改 / 依据”；右栏吸顶速览，默认折叠计算书。

## 4. 计算书步骤

### ① 负荷电流

```text
电流模式：I_load = 输入负荷电流
功率模式：I_load = P_load × 1000 / U_dc
```

- 关键值：`I_load = 200.0 A`；
- 符号：`P_load`、`U_dc`、`I_load`。

### ② 均充电流

```text
I_charge = C10 × k_charge
```

- `C10` 为电池额定容量 Ah，`k_charge` 为均充倍率（如 0.1C10）；
- 关键值：`I_charge = 50.0 A`；
- 符号：`C10`、`k_charge`、`I_charge`；
- 来源：电池容量输入 / 厂家充电参数。

### ③ 设计电流

```text
I_design = I_load + I_charge
```

- 关键值：`I_design = 250.0 A`；
- 说明：近期负荷 + 均充，用于模块数量和直流主断路器。

### ④ 远期电流

```text
I_frame = I_design × futureGrowth
```

- 关键值：`I_frame = 325.0 A`；
- 用途：只校核满架容量和柜体 U 位预留，不直接决定近期模块数。

### ⑤ 模块数量

```text
I_module,eff = I_module × derating
mainModules = ceil(I_design / I_module,eff)
redundantModules = N ? 0 : N+1 ? 1 : 2
totalModules = mainModules + redundantModules
installedNameplateA = totalModules × I_module
installedEffectiveA = totalModules × I_module,eff
```

- 关键值：`4 主用 + 1 备用 = 5 个模块`；
- 符号：`I_module`、`derating`、`mainModules`、`redundantModules`、`totalModules`；
- 来源：模块电流/降额（厂家数据）、冗余方式（输入/规范）。

### ⑥ 满架容量

```text
frameMainModules = ceil(I_frame / I_module,eff)
frameModules = frameMainModules + redundantModules
frameCapacityA = frameModules × I_module,eff
```

- 关键值：`满架 6 个模块 / 360 A`；
- 说明：满架按远期负荷预留，柜体 U 位和配电分路应按远期一次预留。

### ⑦ 柜体 U 位 / 柜数

```text
installedU = totalModules × moduleU + reserveU
frameU = frameModules × moduleU + reserveU
requiredU = max(installedU, frameU)
usableU = 柜高对应可用 U 数
cabinetCount = max(
  1,
  ceil(requiredU / usableU),
  ceil(max(totalModules, frameModules) / maxModulesPerCabinet)
)
```

- 关键值：`占用 32U，2000mm/42U 柜 × 1 面`；
- 符号：`moduleU`、`reserveU`、`requiredU`、`usableU`、`cabinetCount`；
- 来源：柜高 U 数（常数表）、单柜最大模块数（输入/厂家）。

### ⑧ 直流主断路器 / 交流输入

```text
mainBreakerA = nextStandardBreaker(I_design × breakerMargin)
P_dc = I_design × U_dc / 1000
P_ac = P_dc / η_rect
I_ac = P_ac × 1000 / (√3 × U_ac × PF)   // 三相
I_ac = P_ac × 1000 / (U_ac × PF)        // 单相
acBreakerA = nextStandardBreaker(I_ac × breakerMargin)
```

- 关键值：`DC 315 A / AC 100 A`；
- 符号：`breakerMargin`、`P_dc`、`P_ac`、`η_rect`、`PF`、`I_ac`；
- 来源：标准壳架（常数表）、效率/功率因数（输入/厂家）。

## 5. 校核明细

每条校核改成可展开卡片：

| 校核 | 要求 | 实际 | 裕度 | 控制 |
|---|---|---|---|---|
| 整流容量 | `≥ 250 A（近期+均充）` | `5 × 50 A = 250 A` | `+0 A` | 可能 |
| 冗余配置 | `N+1（1 个备用）` | `4 主用 + 1 备用` | `满足` | 可能 |
| 满架容量 | `≥ 325 A（远期）` | `360 A` | `+35 A` | 可能 |
| 模块槽位 | `≤ 16 个/柜 × 1 柜` | `6 个` | `+10 个` | 可能 |
| 柜内 U 位 | `≤ 42U × 1 柜` | `32U` | `+10U` | 可能 |
| 直流主断路器 | `≥ 312.5 A（1.25 倍）` | `315 A` | `+2.5 A` | 可能 |
| 交流输入断路器 | `≥ 92.5 A（1.25 倍）` | `100 A` | `+7.5 A` | 可能 |

额外增加“模块降额 / 均充”行，避免 `derating`、`k_charge` 变成孤儿：

```text
模块降额
I_module,eff = 50 A × 0.9 = 45 A
→ 已参与模块数量；控制 / 未控制
```

每条校核展开后显示：

- 要求式、实际式；
- 要求 / 实际 / 裕度；
- 符号 chips（来源标签）；
- “为什么”；
- “查看计算书第 X 步”。

控制项建议：

- 在 `DcCabinetResult` 增加 `drivers: string[]`，记录最终由哪项约束决定（整流容量 / 冗余 / 满架 / 槽位 / U 位 / 断路器）；
- 校核卡用 `drivers.includes(label)` 标记“控制”；
- 未控制的行写“当前由 XXX 控制”。

## 6. 来源与数据

| 数据 | 来源 | 可修改 |
|---|---|---|
| 模块电流 / 降额 | 厂家数据 | 是 |
| 均充倍率 | 电池厂家 / 规范 | 是 |
| 标准断路器壳架 | 常数表 | 否 |
| 柜高 / 可用 U | 常数表 / 厂家 | 间接 |
| 单柜最大模块数 | 厂家 | 是 |
| 整流效率 / 功率因数 | 厂家 / 输入 | 是 |
| 断路器余量 | 规范/项目 | 是 |

可选：增加“厂家模块表”入口，允许覆盖模块电流、降额、U 数，类似工具 23 的厂家 DC 表。

## 7. 页面布局

右栏顺序：

1. 吸顶结果速览：总模块数、安装容量、柜数、DC/AC 断路器、PASS/REVIEW；
2. 计算书（8 步，默认折叠）；
3. 结论卡 / 柜体与配电建议；
4. 警告；
5. 校核明细（可展开卡片）；
6. 数据与依据；
7. 页面下方参数说明表。

1440×900 首屏应看到：结果速览、结论、校核摘要；计算书默认折叠。

## 8. 数据模型

```ts
export interface DcCabinetStep {
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

export interface DcCabinetCheckDetail {
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

- 新增 `buildDcCabinetSteps(input, result)` 和 `buildDcCabinetCheckDetails(input, result)`；
- 结果增加 `drivers`；
- 复用 `CalcSymbol` / `sourceLabel` / `check-status`。

## 9. 测试

- 计算书：电流/功率模式各一条，8 步公式和关键值；
- 校核：容量、冗余、满架、槽位、U 位、DC/AC 断路器；
- 控制标记：容量 vs 满架 vs U 位；
- 参数表：来源/可修改非空；
- 页面：1440×900 截图；
- 门禁：`type-check`、`lint:check`、`vitest`、`build-only`。

## 10. 实施顺序

1. `refactor(dc-cabinet): 结果增加 drivers 与控制标记`
2. `feat(dc-cabinet): 新增逐步计算书与来源标签`
3. `feat(dc-cabinet): 校核明细可展开，补裕度/为什么`
4. `feat(dc-cabinet): 参数说明来源列与吸顶速览`
5. `test(dc-cabinet): 黄金用例与页面截图`
6. `docs(dc-cabinet): 同步工具/方法/技术说明`

## 11. 不做

- 不改模块/柜体/断路器计算模型；
- 不做多厂家模块库；
- 不做直流配电分路、保护选择性、均流完整设计；
- 不做电池容量计算（由工具 24 负责）。

## 12. 风险

- 模块降额、均充倍率、柜体 U 数依赖厂家数据，内置值只能作初选；
- 多柜并联的均流、直流汇接、保护选择性不在本工具范围；
- 交流输入电流按效率/功率因数估算，正式设计应按整流器样本和 AC 配电规范复核。

## 13. 实施记录（2026-11-11）

先 rebase 到 master（拿到 `src/tools/shared` 共用模块），再按本计划实施。

| 提交 | 内容 |
|---|---|
| `66525e3` | 引擎 `SIMPLE_MODE_FIXED` + `createSimpleInput()`（固定 9 项厂家/规范参数，负荷侧 7 个控件保留）；结果增加只用于展示的 `drivers` |
| `2e455bd` | 新增 `calculationSteps.ts`（8 步 + 41 行参数说明）与 `checkDetails.ts`（9 条卡片）；页面改用共用组件、双模式、假定卡、符号联动与报告模式行（+301 / −655） |
| `8803569` | 3 个 spec：`dcPowerCabinet` 32 条（含简易默认与固定值）、`calculationSteps`、`checkDetails` |

与计划的差异：

- `drivers` 取真实控制项「整流容量 / 冗余配置 / 满架容量」，没有按计划示例虚构候选；
- 为保住 1440×900 首屏，把「柜体与配电建议」和「注意事项」改成默认折叠的 `details`（内容与顺序不变），
  首屏可见速览条、折叠计算书、结论卡、警告摘要与校核摘要；
- 计算书/校核卡/参数表全部用共用组件与 `calc-trace.css`，未复制模板与 CSS。

验证：`type-check`、`lint:check`、`prettier`、`vitest`（32 条）、`build-only` 全绿；专业默认结果与改造前一致
（-48 V / 200 A / 500 Ah → 主用 3 + 冗余 1、1 柜、DC 315 A、AC 13.0 kW / 20.0 A / 32 A）。

