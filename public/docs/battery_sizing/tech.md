# 术

## 实现方式

纯前端 TypeScript 计算，无后端、无文件上传。核心逻辑在 `batterySizing.ts`，展示层拆成三个纯函数模块，页面只负责表单与渲染。

```text
输入表单 → calculateBatterySizing() → 结果对象
                                   ├─ calculationSteps.ts  计算书步骤 + 参数说明
                                   ├─ checkDetails.ts      校核明细（裕度 / 为什么 / 控制）
                                   └─ traceability.ts      查表、插值、限幅、标准序列的描述
```

## 计算模块

- `createDefaultInput()`：默认参数（100 kVA、80% 负载、0.9 PF、30 min、480 V）。
- `capacityCoefficientForHours()`：按备电小时数对典型放电容量系数做线性插值，用于给出计算书建议值。
- `alphaForHours()`：按放电小时率返回 0.006 / 0.008 / 0.01。
- `nextStandardAh()`：向上取标准容量。
- `calculateBatterySizing()`：返回容量、串并联、恒功率需求、倍率、`drivers`、校核项和告警。
- `traceability.ts`：`describeCapacityCoefficient()` / `describeAlpha()` / `describeTemperatureFactor()` / `describeStandardAh()` / `describeEndVoltage()`，与引擎读同一份表数据，保证显示值与计算值一致。
- `calculationSteps.ts`：`buildBatterySteps()` 按电池类型分支生成 8 步 / 6 步；`buildParameterDocs()` 生成参数说明表；`stepLabel()` 给出带圈序号。
- `checkDetails.ts`：`buildBatteryCheckDetails()` 从 `result.checks` 取要求/实际/结论，补裕度、公式、符号、为什么与跳转目标。

## 类型与结果

结果对象同时包含铅酸和锂电字段，页面按 `batteryType` 分支展示。所有校核项统一为：

```ts
interface CheckResult {
  key: string
  label: string
  required: string
  actual: string
  pass: boolean
  note: string
}
```

透明度相关的字段：

- `drivers: string[]`：真正决定容量的约束，铅酸恒为 `['安时容量']`，锂电为 `['能量容量']` 或 `['放电倍率']`；
- `endVoltagePerCellActual`：限幅到 1.5~1.9 V 后参与计算的单体终止电压，避免页面显示未参与计算的原值。

## 视口与吸顶

右栏速览条用 `position: sticky`，需要 window 滚动而不是内部滚动容器；`ToolDetailView.vue` 里对 `tool-detail-battery_sizing` 设 `overflow-y: visible`，与电缆选型页同理。计算书默认折叠，1440×900 首屏可见速览、结论与校核摘要。

## 测试

- `__tests__/batterySizing.spec.ts`：安时法与恒功率、低温 α 修正、2V/12V 串联一致、厂家 W/单体校核、锂电能量法与倍率控制、无效输入、`drivers` 与控制项、终止电压限幅、容量系数与 α 分段。
- `__tests__/calculationSteps.spec.ts`：步骤数量与顺序、公式与关键值、符号来源标签、容量系数偏差提示、限幅备注、厂家 W/单体缺失时不出判定、参数说明完整性。
- `__tests__/checkDetails.spec.ts`：五行/三行校核、控制项归属、未设置下限与未输入厂家值的措辞、跳转计算书的步骤名。

## 边界

内置放电容量系数是常用典型值，不是标准原文表格。正式设计应替换为现行标准表或厂家数据。工具不处理消防、通风、承重、短路电流和 BMS 通信，这些需要另行校核。
