# 2026-11-09 · room_layout MVP 实施记录

> **依据**：[`2026-11-08-telecom-room-layout-research.md`](./2026-11-08-telecom-room-layout-research.md)
> **状态**：MVP 已落地（矩形/L 形、横向机柜列、四类设备、走线架/线缆、Top 3、SVG/PNG/JSON）
> **测试**：新增 5 条生成器单测 + 1 条 Playwright e2e

---

## 一、范围

首版严格按调研文档的 MVP 收缩：

- 房间：矩形 + L 形（右上角缺口）；
- 设备：机柜、电源柜、电池架、空调；
- 基础：柱网、馈线窗；
- 走线架：1 条主干 + 每列 1 条分支；
- 线缆：AC / DC / 光纤 / 信号四类，曼哈顿束路由；
- 优化：多起点模拟退火，加权单目标，输出 Top 3；
- 导出：SVG / PNG / JSON；
- 可复现：同一 seed + 参数 → 同一套几何。

**不在首版**：任意多边形、NSGA-II、双路由、MILP、DWG、PDF/DXF、设备厂家库、多机房联动。

---

## 二、代码结构

```text
src/tools/room_layout/
├─ types.ts                  类型（RoomParams / Genome / LayoutSolution / Metrics）
├─ rules.ts                  默认工程规则（冷/热/搬运/维护/走线架）
├─ rng.ts                    可复现 mulberry32
├─ geometry.ts               正交多边形、矩形包含/重叠、曼哈顿距离
├─ generator.ts              分区 → 机柜列 → 电源/电池/空调 → 走线架 → 线缆
├─ simulatedAnnealing.ts     多起点 SA + Top 3 去重
├─ planSvg.ts                分层 SVG（房间/轴网/功能区/设备/走线架/线缆/尺寸/图签）
└─ RoomLayoutPage.vue        参数、方案卡、预览、图层开关、导出
```

注册：`toolData.ts` / `toolTaxonomy.ts`；文档：`public/docs/room_layout/*`。

---

## 三、算法要点

1. **分区**：电源/电池按 genome 选左右侧墙，空调靠南墙，中间留机柜列与搬运通道。
2. **列模式**：横向机柜列，`perRow` 受可用宽度约束；行数放不下时自动加大 `perRow`。
3. **通道**：行间交替冷/热通道；列长 > 6m 时给 warning。
4. **约束**：设备越界/重叠直接过滤；柱网与设备冲突时略去该柱并记 warning。
5. **走线架**：机柜列上方主干 + 每列分支 + 右端竖向连接。
6. **线缆**：机柜中心 → 分支 → 主干 → 馈线窗，曼哈顿长度用于方案比较。
7. **目标**：`线缆 km + 0.5×走线架 km - 20×面积利用率 + 违规罚分`，越低越好。
8. **SA**：4 条链 × 120 次迭代，变异 `perRow / 电源侧 / 电池侧 / 预留比例`，取 Top 3 去重。

---

## 四、验证

- `roomLayout.spec.ts`：
  - 同 seed 结果一致；
  - 设备在房间内且互不重叠；
  - Top 3 内包含机柜/走线架/线缆；
  - L 形不把设备放进缺口；
  - 小房间返回 invalid + warning，不静默越界。
- `e2e/room-layout.spec.ts`：打开页面 → 生成 → SVG 可见 → 导出 JSON。
- 全量门禁：type-check / vitest / build-only / oxlint / eslint / prettier。

---

## 五、已知边界

- 只做横向机柜列，竖向列/任意多边形为二期；
- 柱网是“冲突则略去”的简化处理，不做结构避让优化；
- 线缆为束路由估算，不生成真实线缆表；
- 空调只按南墙排布，不做气流场；
- 方案需工程师复核，不能直接作为施工图。
