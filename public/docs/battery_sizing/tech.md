# 术

## 实现方式

纯前端 TypeScript 计算，无后端、无文件上传。核心逻辑在 `batterySizing.ts`，页面只负责表单与展示。

```text
输入表单 → 纯函数 calculateBatterySizing() → 结果对象 → 卡片 / 表格 / 计算过程
```

## 计算模块

- `createDefaultInput()`：默认参数（100 kVA、80% 负载、0.9 PF、30 min、480 V）。
- `capacityCoefficientForHours()`：按备电小时数对典型放电容量系数做线性插值。
- `alphaForHours()`：按放电小时率返回 0.006 / 0.008 / 0.01。
- `nextStandardAh()`：向上取标准容量。
- `calculateBatterySizing()`：返回容量、串并联、恒功率需求、倍率、校核项和告警。

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

这样新增电池类型时只需增加计算分支，不必改校核表和结果卡片的结构。

## 测试

`__tests__/batterySizing.spec.ts` 覆盖：

- 默认铅酸安时法与恒功率需求；
- 低温 α 修正后容量增大；
- 2V 单体与 12V 电池块串联单体数一致；
- 厂家 W/单体不足时校核失败；
- 锂电能量法与倍率控制；
- 无效输入返回 `null`；
- 容量系数和 α 分段。

## 边界

内置放电容量系数是常用典型值，不是标准原文表格。正式设计应替换为现行标准表或厂家数据。工具不处理消防、通风、承重、短路电流和 BMS 通信，这些需要另行校核。
