# 术

## 实现方式

纯前端 TypeScript 计算，无后端、无文件上传。核心逻辑在 `hvacCooling.ts`，页面只负责表单与展示。

```text
输入表单 → 纯函数 calculateHvacCooling() → 结果对象 → 卡片 / 表格 / 计算过程
```

## 计算模块

- `createDefaultInput()`：默认参数（100 m² 通信机房、30 kW 设备、15% 余量、N+1）。
- `freshAirLoadFromAirflow()`：按风量和焓差计算新风冷负荷。
- `nextStandardUnitKw()`：向上取常用单机容量档。
- `getRoomTypePreset()` / `getAcUnitTypeOption()`：机房类型和空调类型的默认值。
- `calculateHvacCooling()`：返回分项负荷、设计冷负荷、设备所需制冷量、显冷量、选型配置、校核项和告警。

## 类型与结果

结果对象同时包含详细法和面积法字段，页面按 `calculationMode` 分支展示。所有校核项统一为：

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

这样新增机房类型或空调类型时，只需增加预设，不必改校核表结构。

## 测试

`__tests__/hvacCooling.spec.ts` 覆盖：

- 详细法逐项累加与默认 N+1 配置；
- 面积法计算；
- 舒适性空调显热比不足时校核失败；
- 修正系数降低时所需制冷量增大；
- 2N 双倍备用；
- 手动单台容量不足时校核失败；
- 无效输入返回 `null`；
- 新风负荷、标准容量档和机房预设。

## 边界

面积指标、单机容量档和匹数换算都是经验值，不是标准原文表格。正式设计应按现行标准逐时计算，并按厂家样本做海拔、室外温度、管路长度等修正。工具不处理气流组织、冷热通道、承重、消防和冷凝水排放。
