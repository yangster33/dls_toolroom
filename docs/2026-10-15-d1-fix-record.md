# 2026-10-15 · D1 收敛 7 份 TemplateReader · 实施记录

> **依据**：审计 [`2026-10-09-audit-04-P3-cleanup.md`](./2026-10-09-audit-04-P3-cleanup.md) 的 **P3-4**（模板读取器 7 份）与 **P3-5(c)**（双通用层）
> **台账**：[`../plan/2026-10-11-progress-ledger.md`](../plan/2026-10-11-progress-ledger.md) **D 档 D1**
> **前置**：D3 已完成（`75fda16`）。C4 已把 3 个 reader 改成共用基座的包装，剩下 4 个仍是自建。
> **提交**：`cafc56d`（收敛 reader）+ `d606716`（删第二套通用层）
> **规模**：src **741 insertions / 1095 deletions（净 −354 行）**，测试 **777 → 756 passed**（删了 19 条只测死代码的用例，净覆盖不减）

---

## 一、动手前先核对：审计的「7 份」已经过期

C4 批次把 3 个 reader 改成了共用基座的包装，实际待收敛的是 **4 个自建 reader**：

| 文件（收敛前） | 行数 | 实际状态 |
|---|---|---|
| `utils/TemplateReader.ts` | 239 | 共用基座（File → 解析 → 校验），**不动** |
| `tools/coords_convert/templateReader.ts` | 130 | ✅ 已是包装（只加 `validateCoordRow`） |
| `tools/table2kml_basestation/TemplateReader.ts` | 213 | ✅ 已是包装（只加 `validateRow` + 类型映射） |
| `tools/table2kml_point/TemplateValidator.ts` | 128 | ✅ 已是包装（动态 import 基座） |
| `tools/elevations_batch/TemplateReader.ts` | 114 | ❌ 自建，逐行循环 |
| `tools/get_add/TemplateReader.ts` | 119 | ❌ **与上一个逐行相同** |
| `tools/get_lonlat/TemplateReader.ts` | 102 | ❌ 自建，地址语义 |
| `tools/distance_sensor/TemplateReader.ts` | 268 | ❌ 自建，3/6 列双集语义，**同步** |

所以 D1 实际做的是：**合并 4 个自建 reader 的循环机制**，而不是把 7 份各写一遍。

---

## 二、改动

### 1. 新增 `src/utils/templateRowReader.ts`（188 行）

把四个自建 reader 重复的「逐行循环」收成一份，工具只提供取值与校验：

| 导出 | 职责 |
|---|---|
| `readRows(rows, extract, options)` | 循环机制：每 500 行 `await yieldToUI()` + 同频复查 `signal` + 逐行进度 + 空行跳过 + 结果装配 |
| `readCoordinatePointRows(rows, onProgress?, signal?)` | 「名称+经度+纬度」坐标点模板，`get_add` 与 `elevations_batch` **共用** |
| `resolveAlias` / `resolveCoordinateByAliases` | 别名取值原语（两个语义刻意不同，见 §四） |
| `toValidationResult` | 统一收尾：`isValid = 无错误 && 有数据` |
| `RawRow` / `TemplateValidationResult<T>` / `CoordinatePoint` | 类型（原在 `templateHandler.ts`） |

`RowExtractor<T>` 返回 `{ records?, errors? }`，所以**一行能产出 0..N 条记录**——这是 distance_sensor（同站址一行出 2 条、异站址一行出 0..2 条）能复用同一循环的关键。

### 2. 删掉两份逐字节相同的 reader

`get_add/TemplateReader.ts` 与 `elevations_batch/TemplateReader.ts` 逻辑完全相同（这正是 P0-1 的空经纬度 bug 同时存在于两处的原因）—— **两个文件连同各自的 spec 一起删**，改用共用的 `readCoordinatePointRows`。

调用方改向：

| 文件 | 改动 |
|---|---|
| `GeocodeCommon.vue` | `validateAddTemplate` 改引 `@/utils/templateRowReader`；`CoordinatePoint` 类型同步 |
| `ElevationsBatchPage.vue` | 同上 |

两边 spec 的 **20 条回归用例全部合并**进 `utils/__tests__/templateRowReader.spec.ts`（见 §五的用例来源表）。

### 3. `get_lonlat/TemplateReader.ts`（102 → 62 行）

只保留地址语义（6 个字段、只强制「地址」），循环与收尾走公共实现。

### 4. `distance_sensor/TemplateReader.ts`（268 → 279 行）

保留 3/6 列模式判定与双集合产出，**行循环改走 `readRows`**（`startRowNumber: 2` 保住原有的 `第N行` 行号口径）。

由此**顺带修掉一个既有的取消缺口**：该 reader 原本是同步的，页面只能在「解析」阶段取消，校验阶段一旦开始就跑完几万行。现在与其它三个 reader 对齐，`DistanceSensorPage` 把 `controller.signal` 传了进去。

刻意**不传 onProgress**：行整形阶段进度已到 100%，再上报会让进度条从 0 重来（已在调用处写注释）。

### 5. 删掉第二套通用层 `utils/templateHandler.ts`（244 行）

审计 P3-5(c) 的「双通用层」：一套帕斯卡命名（`TemplateReader`）+ 一套小写命名（`templateHandler`）。该文件的**同步通用工厂在生产零调用**（只有它自己的 spec 在用），收敛后仅剩 `CoordinatePoint` / `TemplateValidationResult` 两个类型有人 import → 文件删除，类型并入 `templateRowReader.ts`，spec 一起删。

**删除前核对**：它 19 条用例里 3 条是 B5 的严格解析回归，已在 `utils/__tests__/coordinateValue.spec.ts`（17 条）逐条覆盖同一批输入（`116.4abc` / `N39.9` / `Infinity` / `0x1A`），无覆盖损失。

---

## 三、验证

| 检查 | 结果 |
|---|---|
| `npm run type-check` | ✅ 0 错误 |
| `npx vitest run` | ✅ **756 passed / 54 files** |
| `npx oxlint .` | ✅ 0 / 0 |
| `npx eslint .` | ✅ 0 |
| `npx prettier --check --experimental-cli .` | ✅ 全符合 |
| `npm run build` | ✅ 通过，26 路由预渲染 |
| `CI=true npx playwright test` | ✅ **7 passed / 1 flaky**（与基线同一项） |

### 测试数变化的解释

`777 → 756`：删掉 20 条（两份重复 reader 的 spec）+ 19 条（`templateHandler` 死代码 spec），新增 28 条到共用 spec。**净覆盖不减**——合并时把两份 spec 的回归用例逐条搬了过来（下表），并为原本零 reader 单测的 `get_lonlat` 补了 4 条。

### 合并前被删 spec 的用例来源（逐条核对无遗漏）

| 来源 | 用例数 | 去向 |
|---|---|---|
| `elevations_batch/__tests__/TemplateReader.spec.ts` | 14 | 空白×5 / 合法×4 / 脏数据×3 / 进度×1 / 让出×1 → 全部迁入 |
| `get_add/__tests__/TemplateReader.spec.ts` | 6 | 其中 1200 行进度用例的独有断言（intermediate≥2、message 与 percent 一一对应）迁入 |
| `utils/__tests__/templateHandler.spec.ts` | 19 | 死代码用例；严格解析回归已由 `coordinateValue.spec.ts` 覆盖 |
| **新增** | 28 | `readRows` 契约（进度/让出/行号平移/空行/取消 5 条）、别名原语 2 条、`toValidationResult` 1 条、`get_lonlat` 地址 4 条，以及**反证合并时差点丢掉的 1200 行进度用例** 1 条 |

### 反证与踩坑

1. **一个真实的静默回归，被测试当场抓住**：第一版把具体 reader 的签名从位置参数 `(rows, onProgress?, signal?)` 改成了 options 对象，`GeocodeCommon.vue:951` 仍按老签名调用 → `onProgress` 变成 options 对象、进度**完全不上报**，而 `tsc` 与其余 27 条用例全绿。抓它的是新 spec 里「1200 行跨分片仍有中间进度」这条（`percents[0]` 为 `undefined`）。**已改回位置参数签名，与改动前的调用约定一致。**
   > 教训：重构时若必须改公开签名，先看有几处调用点；类型不匹配能靠 tsc 抓，**语义错配只能靠测试**。
2. **让出位置的反证保留**：1200 行全失败仍 ≥2 次 yield 的用例从旧 spec 原样搬来（把让出从循环开头挪到结尾即红）。
3. `it(...)` 后不能写 `}),`（C4 教训）—— 本次沿用 `})`。

---

## 四、行为等价性（重点核对项）

| 语义 | 收敛前 | 收敛后 |
|---|---|---|
| 别名取值·名称 | 首个**非空**别名，取到空串就不再找 | `resolveAlias` 同 |
| 别名取值·经纬度 | 第一个**能解析成功**的别名（中文列为空还会找英文列） | `resolveCoordinateByAliases` 同，并补了专门用例 |
| 每行错误数 | 名称/经度/纬度首个失败即 `continue` → 每行最多 1 条 | 同（新增强断言 `errors).toHaveLength(1)`） |
| 进度 | 每行上报一次（`Math.min(99, …)`）+ 结尾 100 | 同 |
| 让出 | 循环**开头**每 500 行 | 同（反证用例守护） |
| `isValid` | 无错误 && 有数据 | 同（`toValidationResult`） |
| 行号 | `get_add`/`get_lonlat` 第 `i+1` 行；`distance_sensor` 第 `i+2` 行 | 同（`startRowNumber` 参数） |
| `locationPoint` 两个集合 | 同站址一次 push 两个字面量（两个独立对象） | 同（显式 `{ ...point }`） |

---

## 五、收敛后的 reader 全景

| 文件 | 行数 | 角色 |
|---|---|---|
| `utils/TemplateReader.ts` | 211 | **File 入口**共用基座（解析在 Worker，校验走基座循环） |
| `utils/templateRowReader.ts` | 188 | **行入口**共用机制 + 坐标点 reader（4 个工具共用） |
| `tools/get_lonlat/TemplateReader.ts` | 62 | 地址语义（薄） |
| `tools/distance_sensor/TemplateReader.ts` | 279 | 双集语义（保留模式判定，循环共用） |
| `tools/coords_convert/templateReader.ts` | 112 | 基座包装 |
| `tools/table2kml_basestation/TemplateReader.ts` | 193 | 基座包装 |
| `tools/table2kml_point/TemplateValidator.ts` | 108 | 基座包装 |

**循环机制现在只剩 4 处，且每处都有独立存在的理由**（grep `ROW_YIELD_INTERVAL` 可验证）：行读取（500）、File 读取（500）、`aoaToTemplateRows` 行整形（500）、`exceljsCore` 导出（2000 / 边框 200）——分属链路的不同阶段、阈值不同，不再有「同一阶段抄 N 份」。

---

## 六、与审计预估的偏差

| 项 | 审计预估 | 实际 | 原因 |
|---|---|---|---|
| 删除行数 | −800 | **src 净 −354** | C4 已先把 3 个 reader 变成包装；且新增 188 行共用模块 + 28 条用例 |
| 「7 份 → 1 份」 | 7 份合成 1 份 | 4 个自建 reader 的**循环**合成 1 份 | 剩下 3 个在 C4 已是包装；工具特有权值/校验仍需各留一处（这正是参数化的正确形态） |

---

*上一份记录：[`2026-10-15-d3-fix-record.md`](./2026-10-15-d3-fix-record.md) · 回到：[审计总览](./2026-10-09-audit-00-summary.md)*
