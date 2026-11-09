# 术

## 实现方式

纯前端 TypeScript 计算，无后端、无文件上传。核心逻辑在 `dcPowerCabinet.ts`，页面只负责表单与展示。

```text
输入表单 → 纯函数 calculateDcCabinet() → 结果对象 → 结论卡 / 校核表 / 柜体建议 / 计算过程
```

## 计算模块

- `createDefaultInput()`：默认 -48V、200A 近期负荷、500Ah 电池、100A 模块、N+1、2000mm 柜高。
- `nextStandardBreaker()`：向上取标准断路器壳架。
- `usableUForHeight()`：按柜高返回参考可用 U 数。
- `recommendCabinetSize()`：按占用 U、模块槽位和单柜最大模块数选择柜高与柜数。
- `calculateDcCabinet()`：返回电流、模块、满架、U 位、断路器、交流进线和校核项。

## 类型与结果

结果对象把“容量侧”和“柜体侧”分开：

- 容量侧：`designCurrentA`、`frameCurrentA`、`mainModules`、`totalModules`、`frameModules`、`installedNameplateA`、`installedEffectiveA`。
- 柜体侧：`requiredU`、`usableU`、`cabinetCount`、`recommended*`、`selected*`。
- 配电侧：`mainBreakerA`、`acInputPowerKw`、`acInputCurrentA`、`acBreakerA`。

所有校核项统一为：

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

## 测试

`__tests__/dcPowerCabinet.spec.ts` 覆盖：

- 默认近期负荷 + 均充 + N+1 的模块数和柜体；
- 电流输入与功率输入等效；
- N+2 比 N+1 多一个备用模块；
- 远期负荷增长抬高满架模块数；
- 不配置电池时均充电流为 0；
- 大负荷时自动建议多柜；
- 所选柜高不足时增加柜数；
- 无效输入返回 `null`；
- 断路器、电压标签、柜高 U 数等辅助函数。

## 边界

- 柜体宽×深×高是工程建议，不是国标强制值；GB 51194 只规定布置和维护间距。
- 模块降额、均充电流、断路器壳架都是初选值，正式设计按厂家资料和保护选择性校验。
- 不处理短路电流、直流拉弧、绝缘配合、接地、消防、通风、承重和抗震；这些需另行校核。
- 240V/336V 直流系统的绝缘、防触电和保护要求与 -48V 不同，不能直接套用 -48V 经验。
