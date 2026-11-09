# 机房通信配套平面图「随机生成 + 多目标近似最优」可行性调研

> 调研日期：2026-11-08
> 目标：判断能否在 DLS Toolroom（纯前端、静态部署、Vue 3 + TypeScript）中实现
> 「随机机房平面 → 基础设施 → 设备最优布局 → 线缆布放 → 可视化呈现」。
> 结论先行：**可行，但要把“最优”定义为“规则约束下的多目标 Pareto 近似最优”，而不是数学意义上的全局最优。**
> **实施状态（2026-11-09）**：MVP 已落地，见 [`2026-11-09-room-layout-mvp.md`](./2026-11-09-room-layout-mvp.md)。

---

## 一、一句话结论

这件事可以拆成四个可独立验证的算法层：

1. **房间轮廓随机生成**：正交多边形/多矩形拼接，约束随机 + 拒绝采样，成熟。
2. **基础设施生成**：馈线窗、走线架、接地排、空调位，规则驱动 + 最短路径/生成树，成熟。
3. **设备布局优化**：二维带通道的设施布局问题（FLP），NP-hard；用“规则构造初解 + 模拟退火/NSGA-II 局部搜索 + 约束修复”最务实。
4. **线缆布放**：走线架拓扑近似树，用“分层束路由 + 最短路 + 容量校验”，可算、可画、可出量。

真正的难点不在代码，而在**约束库和评分函数**：通道宽度、维护间距、强弱电分离、电池承重、空调气流、扩容预留，这些必须做成可配置、可追溯的规则，而不是写死在算法里。

---

## 二、先把问题定义清楚

### 2.1 “随机”不等于“乱画”

工程图生成需要的是**受约束的随机**：

- 随机的是：房间形状、柱网、门/馈线窗位置、机柜列数、设备组合、优化初始解、方案多样性。
- 不随机的是：规范硬约束、几何不重叠、通道净宽、设备维护面、线缆连通性。

因此建议引入 **seed（随机种子）**：

- 同一个 seed + 同一组参数 → 完全相同的图（可复现、可回归测试）。
- “换一批”只换 seed，便于对比方案。
- 方案卡片上显示 seed，方便复现和评审。

### 2.2 “最优”只能定义为多目标近似最优

设备布局同时要优化：

| 目标 | 说明 | 方向 |
|---|---|---|
| 线缆总长 | 电源线 + 信号线 + 光缆 + 馈线，按类型加权 | 最小 |
| 走线架长度/造价 | 主干 + 支线 + 支撑 | 最小 |
| 机柜数量/面积利用率 | 同样面积放更多机柜 | 最大 |
| 制冷风险 | 热点、气流短路、空调覆盖距离 | 最小 |
| 扩容预留 | 预留柜位、走线架余量、配电余量 | 最大 |
| 施工/维护便利 | 通道、检修面、设备分区 | 最大 |

这些目标互相冲突（机柜越多越挤、线越短可能越堵），不存在唯一最优。正确做法是：

- 用**加权和**给普通用户一个“推荐方案”；
- 用**Pareto 前沿**给专业用户 3~5 个“线缆最短 / 容量最大 / 最易扩容”的候选；
- 显示与**理论下界**的差距（例如面积下界、曼哈顿距离下界），诚实标注“近似最优”。

---

## 三、规范与约束库（必须先做）

### 3.1 建议覆盖的规范

| 规范 | 用途 |
|---|---|
| GB 50174-2017《数据中心设计规范》 | 机房布局、通道、机柜间距、环境要求 |
| GB 51194-2016《通信电源设备安装工程设计规范》 | 电源柜、电池组布置与维护间距 |
| GB 50311-2016《综合布线系统工程设计规范》 | 走线架/线槽、强弱电间距、线缆填充率 |
| GB 50016-2014《建筑设计防火规范》 | 疏散、防火分区、消防通道 |
| YD/T 5003-2016《通信建筑工程设计规范》 | 通信机房建筑与工艺配合 |
| YD 5059-2005《电信设备安装抗震设计规范》 | 机柜/电池架抗震固定 |
| GB 50462-2015《数据中心基础设施施工及验收规范》 | 施工可行性、验收 |
| 项目/运营商企业标准 | 实际项目往往比国标更严 |

> 注意：不同版本、不同运营商、不同机房等级（A/B/C）取值不同。实现时不要把数字写死在算法里，要做成 `LayoutRules` 配置，并给每条规则标注来源和“可覆盖”。

### 3.2 建议的默认规则（工程建议值，实施前需按项目规范核对）

| 规则 | 建议默认 | 说明 |
|---|---|---|
| 冷通道（面对面机柜正面间距） | ≥ 1200 mm | GB 50174 常见要求 |
| 热通道（背对背机柜背面间距） | ≥ 1000 mm | 常见要求 |
| 搬运通道 | ≥ 1500 mm | 设备进出 |
| 机柜侧面检修 | ≥ 600 mm | 需要侧面维护时 |
| 电源柜正面操作 | ≥ 1500 mm | GB 51194 相关章节 |
| 电源柜背面检修 | ≥ 800~1000 mm | 按柜型和项目 |
| 电池架间通道 | ≥ 1000 mm | 另需考虑承重与通风 |
| 走线架安装高度 | 2400~2600 mm | 与机柜顶净距、梁底净空有关 |
| 走线架宽度 | 300/400/600 mm | 按线缆量选 |
| 线槽/走线架填充率 | ≤ 40%~50% | 按 GB 50311 与项目 |
| 强弱电平行间距 | ≥ 300 mm | 按 GB 50311 表取值，可配置 |
| 馈线窗距地 | 2200~2500 mm | 靠近走线架，避开门/柱 |
| 空调正面检修 | ≥ 1500 mm | 按厂家要求 |
| 机柜行长度 | > 6 m 两端设出口 | 长列疏散/检修 |

**规则库的数据结构建议：**

```ts
export interface RuleValue {
  value: number
  unit: 'mm' | 'mm2' | 'ratio' | 'count'
  source: string          // 规范号/条款/企业标准
  overridable: boolean
  note?: string
}

export interface LayoutRules {
  aisle: {
    cold: RuleValue
    hot: RuleValue
    handling: RuleValue
    sideMaintenance: RuleValue
    perimeter: RuleValue
  }
  power: { front: RuleValue; back: RuleValue; side: RuleValue }
  battery: { aisle: RuleValue; wall: RuleValue; floorLoad: RuleValue }
  tray: {
    height: RuleValue
    width: RuleValue
    fillRatio: RuleValue
    supportSpacing: RuleValue
    strongWeakGap: RuleValue
  }
  ac: { front: RuleValue; top: RuleValue; outdoor: RuleValue }
  fire: { egressWidth: RuleValue; maxTravel: RuleValue }
}
```

---

## 四、四层算法设计

### 4.1 第一层：房间轮廓随机生成

#### 可选做法

| 方法 | 优点 | 缺点 | 建议 |
|---|---|---|---|
| 模板 + 参数采样（矩形/L/T/U/凹凸） | 简单、真实、易控制 | 形状多样性有限 | **首版主力** |
| 递归切分（slicing tree / guillotine） | 天然多矩形拼接、可控制房间比例 | 边界较规整 | **推荐** |
| 网格生长（polyomino） | 形状最自由 | 易产生窄颈、凹角、孔洞 | 进阶 |
| 手绘导入（SVG/DXF） | 贴合真实项目 | 需要解析器 | 二期 |

#### 推荐方案：模板族 + 递归切分 + 规则化

1. 在包围盒内递归做水平/垂直切割，得到若干矩形单元；
2. 随机合并相邻单元，形成“主机房 + 辅助区”；
3. 对边界做 100 mm 规则化，去掉过短边；
4. 检查：简单多边形、无孔洞、最小宽度 ≥ 通道要求、面积在目标范围；
5. 不满足则重采样（拒绝采样），最多 N 次后回退到矩形。

伪代码：

```ts
function generateRoom(rng: Rng, p: RoomParams): RoomOutline {
  for (let attempt = 0; attempt < p.maxAttempts; attempt++) {
    const cells = recursiveSplit(rng, p.bounds, p.minCell, p.maxDepth)
    const rects = mergeRandomAdjacent(rng, cells, p.mergeRate)
    const polygon = unionRects(rects)          // polygon-clipping / 自研正交并
    if (!isSimpleOrthogonal(polygon)) continue
    if (minWidth(polygon) < p.minWidth) continue
    if (area(polygon) < p.minArea || area(polygon) > p.maxArea) continue
    return {
      rects,
      polygon,
      columns: placeColumns(rng, polygon, p.columnGrid),   // 6/8/9 m 柱网
      doors: placeDoors(rng, polygon, p.doorRules),
      feederCandidates: exteriorWallCandidates(polygon, p.feederRules),
      exteriorWalls: classifyWalls(polygon),
    }
  }
  return fallbackRectangle(p)
}
```

#### 生成时同时要产出的“底图要素”

- 外墙/内墙、门（含开启弧）、窗；
- 结构柱（矩形，按柱网）；
- 馈线窗候选段（外墙、避开门/柱、靠近走线架方向）；
- 空调室外机位/平台；
- 地沟/架空地板范围（可选）；
- 消防栓、配电井、弱电井等固定设施。

#### 几何鲁棒性

- 正交多边形并集：建议引入 `polygon-clipping`（MIT，~350 KB）或复用 `@turf/turf` 的 `union`；前者对自交/共线更稳。
- 点在多边形内、线段相交、矩形碰撞：自研 + `rbush` 空间索引即可。
- 所有坐标用 **mm 整数**，避免浮点误差；渲染时再缩放到 px。

---

### 4.2 第二层：基础设施生成

基础设施不是“随便摆”，它决定了后面的线缆长度。建议**先定走线架主干，再定机柜列**，或者至少二者联合生成。

#### 4.2.1 馈线窗（Feeder Window）

候选位置来自外墙段，评分：

```text
score = w1 * 到主干走线架距离
      + w2 * 到机房几何中心距离
      + w3 * 避开门/柱/空调的惩罚
      + w4 * 外墙可开洞惩罚（承重墙、立面限制）
      + w5 * 室外馈线进入方向合理性
```

选取得分最高的 1~2 个位置；支持用户手动锁定。

#### 4.2.2 走线架（Cable Tray）

推荐拓扑：**主干 + 分支 + 垂直引下**。

- **主干**：从馈线窗进入机房，沿长轴或设备区中线布置；用 A* 在粗网格上避柱、避空调、少转弯（转弯惩罚）。
- **分支**：每一列机柜上方一条，垂直于或平行于主干，接到主干。
- **垂直引下**：机柜顶到走线架的短段；电池/电源柜单独引下。
- **双层/多通道**：强电、弱电、光纤分层，间距按规则。
- **容量**：每条边记录可用截面，后续线缆路由做填充率校验。

伪代码：

```ts
function generateTrays(room: RoomOutline, rows: Row[], rules: LayoutRules): TrayNetwork {
  const feeder = pickFeederWindow(room, rows)
  const spine = astarOrthogonal(
    grid(room, 100),
    feeder.entry,
    room.center,
    { avoid: [...room.columns, ...room.acZones], turnPenalty: 3, clearance: rules.tray.width.value / 2 }
  )
  const branches = rows.map(row => ({
    id: `branch-${row.id}`,
    path: [row.centerTop, nearestPointOn(spine, row.centerTop)],
    width: rules.tray.width.value,
  }))
  return buildGraph([spine, ...branches], { level: rules.tray.height.value })
}
```

#### 4.2.3 其他基础设施（规则驱动）

| 设施 | 规则 |
|---|---|
| 接地排 | 靠近电源柜/电池，沿墙，长度按设备数 |
| 交流配电/ UPS | 靠近电源区，维护面朝通道 |
| 空调室内机 | 周边或列间，正面检修、气流不直吹机柜正面 |
| 空调室外机 | 外墙/屋面平台，管路最短，避开馈线窗 |
| 消防 | 沿墙、疏散路径、气瓶间 |
| 照明/摄像/温湿度/漏水 | 按覆盖规则均匀布置 |
| 桥架/线槽 | 与走线架协同，强弱电分离 |

---

### 4.3 第三层：设备布局优化（核心）

#### 4.3.1 问题本质

这是 **2D Facility Layout Problem（FLP）** 的一个变体：

- 矩形设备（机柜、电源柜、电池架、空调）；
- 允许 0°/90° 旋转；
- 设备之间有通道/维护间距；
- 房间是正交多边形；
- 目标多且冲突。

它是 NP-hard。真实项目规模（几十到几百个机柜）不适合直接求全局最优，应该用**构造 + 局部搜索**。

#### 4.3.2 推荐流水线

```text
分区(Zoning)
  → 列模式枚举(Row patterns)
  → 构造初解(Decoder)
  → 约束修复(Repair)
  → 模拟退火/NSGA-II 局部搜索
  → Pareto 筛选
  → 输出 Top-N 方案
```

**① 分区（Zoning）**

把房间分成若干功能区：

- 设备区（机柜列，居中/靠一侧）；
- 电源区（电源柜、UPS，靠近进线/外墙）；
- 电池区（独立或半独立，靠墙，考虑承重）；
- 空调区（周边/列间）；
- 主通道/搬运通道；
- 扩容预留区。

分区可以用规则 + 随机边界生成，作为后续布局的软约束。

**② 列模式枚举（Row Patterns）**

给定房间可用宽度/深度和通道要求，枚举：

- 列方向（横/竖）；
- 每列机柜数（如 8/10/12/15）；
- 列数（2/3/4/6）；
- 通道组合（冷/热/冷/热…）；
- 是否背靠背、是否靠墙。

对每种模式计算理论容量和占用尺寸，过滤放不下的模式。

**③ 构造初解（Decoder）**

把“基因”解码成具体坐标：

```ts
interface Genome {
  rowPattern: RowPattern
  rowOrder: number[]
  powerZone: ZoneChoice
  batteryZone: ZoneChoice
  acSlots: number[]
  orientation: 0 | 90
  reservedRatio: number
}

function decode(g: Genome, room: RoomOutline, rules: LayoutRules): Layout {
  const rows = placeRows(g.rowPattern, room, rules)
  const power = placePowerCabinets(g.powerZone, rows, room, rules)
  const battery = placeBatteryRacks(g.batteryZone, room, rules)
  const ac = placeAcUnits(g.acSlots, room, rules)
  return repair({ rows, power, battery, ac }, room, rules)
}
```

**④ 约束修复（Repair）**

局部搜索产生的解可能越界/重叠。修复顺序建议：

1. 夹回房间边界；
2. 推开重叠（沿最小分离轴）；
3. 恢复通道净宽（优先移动软设备，不动承重/固定设备）；
4. 恢复维护面；
5. 仍不可行则丢弃该解。

**⑤ 模拟退火（MVP 主算法）**

- 状态：`Genome`
- 邻域动作：
  - 平移一列/一个设备；
  - 交换两个设备；
  - 改变列方向；
  - 拆分/合并列；
  - 移动空调位；
  - 调整预留比例；
  - 交换电源/电池区。
- 能量：加权目标 + 违规罚函数。
- 温度：`T0` 按初始解尺度归一化，`T *= 0.995`，迭代 2~5 万次。
- 接受准则：`exp(-ΔE/T)`。
- 多起点：不同 seed/初解并行跑 4~8 条链，取最优。

**⑥ NSGA-II（进阶，出方案集）**

- 种群 40~100，代数 100~300；
- 非支配排序 + 拥挤度；
- 输出 Pareto 前沿 3~5 个方案；
- 计算量比 SA 大，放 Worker，给进度条。

**⑦ MILP/CP-SAT（可选，做校验/小规模精修）**

- 网格化 0-1 变量：`x[e][i][j][o]` 表示设备 e 放在格子 (i,j)、方向 o；
- 非重叠、边界、通道用线性约束；
- 线缆长度用曼哈顿距离线性化；
- 适合：小房间、固定列模式下的“电源柜/空调位”子问题；
- 不适合：全房间、多目标、非线性气流。

浏览器可用求解器：

| 库 | 许可 | 体积 | 说明 |
|---|---|---|---|
| `highs` (WASM) | MIT | ~4 MB unpacked | HiGHS MILP，性能好，推荐做可选精修 |
| `cpsat-js` / `or-tools-wasm` | Apache-2.0 | 12 MB / 180 MB | CP-SAT 强，但体积大；`or-tools-wasm` 不适合前端 |
| `glpk.js` | GPL-3.0 | 中等 | GPL 与 MIT 项目混用需谨慎 |
| `yalps` | MIT | ~240 KB | 纯 JS LP/MIP，轻量但规模有限 |

**建议：首版不引入 MILP。** 用 SA/NSGA-II 足够；等约束稳定后，再用 `highs` 做“小规模子问题最优性校验”，避免一上来就被建模和 WASM 体积拖住。

#### 4.3.3 评分函数

```ts
interface Metrics {
  cableLength: Record<CableType, number>
  trayLength: number
  cabinetCount: number
  areaUtilization: number
  coolingRisk: number
  expansionScore: number
  violationCount: number
  violationArea: number
}

function score(m: Metrics, w: Weights, lowerBounds: Bounds): number {
  const cable = normalized(m.cableLength.total, lowerBounds.cable)
  const tray = normalized(m.trayLength, lowerBounds.tray)
  const util = 1 - m.areaUtilization
  const cool = m.coolingRisk
  const exp = 1 - m.expansionScore
  const penalty = m.violationCount * 1000 + m.violationArea * 0.01
  return w.cable * cable + w.tray * tray + w.util * util + w.cool * cool + w.exp * exp + penalty
}
```

权重用 UI 滑杆暴露，预设三档：

- **省线缆**：cable 0.45 / tray 0.2 / util 0.15 / cool 0.1 / exp 0.1
- **多装机**：util 0.4 / cable 0.2 / tray 0.15 / cool 0.15 / exp 0.1
- **易扩容**：exp 0.35 / cable 0.2 / tray 0.15 / util 0.15 / cool 0.15

---

### 4.4 第四层：线缆布放

#### 4.4.1 分层路由

```text
设备端口 → 列内引下 → 分支走线架 → 主干走线架 → 馈线窗 / 电源柜 / ODF
```

- **Level 1**：机柜到列顶走线架（短垂直段）。
- **Level 2**：列顶到主干（曼哈顿路径）。
- **Level 3**：主干到目标（馈线窗、电源柜、电池、ODF）。

#### 4.4.2 图模型

```ts
interface TrayNode { id: string; p: Pt; kind: 'junction' | 'end' | 'entry' | 'device' }
interface TrayEdge {
  id: string
  a: string
  b: string
  length: number
  width: number
  level: number
  allowed: CableType[]
  usedArea: number
}
interface CableDemand {
  id: string
  from: string
  to: string
  type: 'ac' | 'dc' | 'fiber' | 'signal' | 'ground' | 'rf'
  count: number
  diameterMm: number
  redundancy: 0 | 1   // 是否需要双路由
}
```

#### 4.4.3 路由策略

| 策略 | 适用 | 说明 |
|---|---|---|
| 树上最短路 | 走线架是树 | 最快；主干+分支天然是树 |
| Dijkstra/A* | 有环网/多路径 | 支持避障、转弯惩罚 |
| 最小费用流 | 容量受限、多需求 | 把线缆当流量，边容量=填充率 |
| 多商品流 | 强/弱电分离、双路由 | 复杂，首版不做 |
| Steiner 树 | 主干规划 | 适合“先布架、后布线” |

**推荐首版：树状最短路 + 容量校验。**

- 走线架拓扑生成后，本身就是树/近似树；
- 每根电缆沿树唯一路径走，长度可精确算；
- 按类型聚合为“束”，计算截面占用；
- 超填充率时：加宽走线架、增加第二层、或改列位；
- 双路由需求：在树上找两条边不相交路径（环网）或加冗余主干。

#### 4.4.4 线缆类型与呈现

| 类型 | 颜色建议 | 线型 | 备注 |
|---|---|---|---|
| AC 电源 | 红/橙 | 实线粗 | 强电 |
| DC 电源 | 蓝 | 实线 | -48V |
| 光缆 | 橙/黄 | 实线细 | 弯曲半径 |
| 信号/网线 | 绿/青 | 虚线 | 弱电 |
| 接地 | 黄绿 | 点划线 | 接地排 |
| 射频馈线 | 紫/灰 | 实线粗 | 馈线窗 |

**不要逐根画几百根线**，否则 SVG 会糊成一团。建议：

- 默认画“束”（bundle），线宽按根数/截面；
- 悬停/选中某机柜时，高亮它的单根路径；
- 提供“显示全部单线”开关（性能警告）；
- 线缆明细表单独输出（Excel/CSV）。

---

## 五、可视化与呈现

### 5.1 技术选择：SVG 优先

| 方案 | 优点 | 缺点 |
|---|---|---|
| SVG | 矢量、清晰、可导出、易交互、DOM 可测 | 节点多时性能下降 |
| Canvas | 大量图元快 | 交互/导出/可访问性差 |
| WebGL | 极大量 | 过重，不适合工程图 |

**结论：主体用 SVG；线缆层在“显示全部”时可用 Canvas 叠加。** 本仓库已有 SVG 导出先例（`ganttSvgExport.ts`），可复用 `downloadBlob` 和 SVG→PNG 的思路。

### 5.2 图层设计

样图采用 10 个可独立开关的图层，顺序从下到上：

```text
00 轴网            轴线、轴号定位线
01 建筑轮廓        墙体、柱、门、窗、馈线窗洞口
02 功能区/通道     冷通道、热通道、电源/电池区底色
03 设备            电源柜、电池架、空调、UPS 等
04 机柜            设备机柜（A-01…B-06）
05 走线架          主干/分支走线架、横档、宽度/标高标注
06 线缆            交流/直流/光缆/信号/接地（按束）
07 照明/消防/接地   灯具、烟感、喷淋、应急灯、灭火器、接地排
08 尺寸标注        三道尺寸、净距、设备间距、轴号
09 图框/图签/说明   图框、图签、图例、设计说明、材料表、比例尺
```

实现方式：

```xml
<g id="layer-building"
   data-layer="building"
   data-label="01 建筑轮廓"
   data-color="#6b6255"
   inkscape:groupmode="layer"
   inkscape:label="01 建筑轮廓">
  ...
</g>
```

- `data-layer` / `data-label` 供查看器动态生成图层开关；
- `inkscape:groupmode="layer"` 让 Inkscape/Illustrator 打开时识别为图层；
- 每个图层内部仍保留自己的 `<g transform="translate(260,240) scale(0.08)">`，坐标统一用 mm；
- 图层顺序就是绘制顺序，避免“设备压住标注”或“底色盖住设备”。

配套的交互查看器：`docs/assets/room-layout-plan-viewer.html`

- 左侧动态列出 10 个图层，可单独勾选/取消；
- 预设视图：全部显示、仅建筑、设备布置、走线架/线缆、仅标注、全部隐藏；
- 默认关闭“功能区/通道”和“照明/消防/接地”，避免压住设备图；
- “导出当前视图 SVG”会移除隐藏图层，适合直接发给施工/评审；
- “下载完整分层 SVG”保留全部图层，适合后续在 Inkscape/Illustrator 中编辑。

### 5.3 施工图俯视图表达（重点）

> 第一版概念图偏“拓扑/示意”，只能说明连接关系，不能用于施工沟通。
> 施工方要的是**按比例的俯视平面图**：轴线、尺寸链、设备真实占地、通道净宽、走线架宽度与标高、图签和图例。
> 样图见：`docs/assets/room-layout-plan-sample.svg`（12m×8m 机房，含 12 台机柜、3 台电源柜、4 组电池、4 台空调、1 个馈线窗、主干/分支走线架及尺寸标注）。

#### 5.3.1 参考图纸的共性

从公开的通信机房 CAD 施工图可以看到，能用于施工的平面图通常同时包含：

1. **建筑底图**：240mm 墙体、结构柱、门（门扇+开启弧）、窗、馈线窗洞口、外墙/内墙区分。
2. **轴网**：纵向 1/2/3…、横向 A/B/C…，轴号用圆圈标注。
3. **三道尺寸**：总尺寸、轴线尺寸、细部尺寸；尺寸线闭合，单位 mm。
4. **设备布置**：机柜/电源柜/电池架/空调按真实 W×D 画，标编号、规格、数量。
5. **净距标注**：冷通道、热通道、搬运通道、正面维护、背面检修、距墙距离。
6. **走线架**：主干/分支、宽度、底标高、长度、上方/下方、强弱电分层。
7. **线缆**：按束表达，颜色/线型区分类型，配线缆表；不逐根堆线。
8. **图签与说明**：工程名称、图名、图号、比例、日期、设计/审核、版本、图例、比例尺、指北针、设计说明。

#### 5.3.2 拓扑图 vs 施工俯视图

| 拓扑/示意图 | 施工俯视图 |
|---|---|
| 只表达“谁连谁” | 按比例表达“在哪里、多大、离多远” |
| 设备用图标 | 设备用真实平面尺寸（W×D） |
| 没有轴线/尺寸链 | 轴线 + 三道尺寸 + 净距 |
| 线缆是一条示意线 | 走线架有宽度/标高，线缆按束 |
| 没有图签 | 图签、图例、说明、比例尺、指北针 |
| 不能指导施工 | 能指导放线、预埋、桥架安装、设备进场 |

#### 5.3.3 算法必须输出的“可标注几何”

施工图不是“画完再标”，而是**几何生成时就把标注所需的数据带出来**：

```ts
interface Dimension {
  id: string
  kind: 'overall' | 'axis' | 'clearance' | 'equipment' | 'tray'
  from: Pt
  to: Pt
  offset: number          // 尺寸线偏移
  text: string            // 12000 / 1200 / 600
  level: 0 | 1 | 2        // 三道尺寸的层次
}

interface PlanDrawing {
  room: RoomOutline
  axes: { id: string; p1: Pt; p2: Pt }[]
  equipment: Equipment[]
  trays: TraySegment[]
  dimensions: Dimension[]   // 由生成器自动产生，不靠手工补
  labels: LabelPlacement[]  // 带避让结果
  legend: LegendItem[]
  titleBlock: TitleBlockData
}
```

关键点：

- 所有坐标是 **mm 整数**，渲染时统一缩放到 px；
- 尺寸标注由几何关系自动生成（轴线、设备边、通道边、走线架中心线）；
- 文字要有**避让/白底**，避免压设备、压尺寸线；
- 图签、图例、说明是模板，不是算法随机内容；
- 同一 seed 的输出必须包含同一套标注，保证可复现。

#### 5.3.4 样图说明

`docs/assets/room-layout-plan-sample.svg` 按 A2 横幅（1700×1200）绘制，包含：

- 12m×8m 主机房，240mm 外墙，400×400 结构柱；
- 轴线 1~5 / A~D，顶部/底部/左侧/右侧三道尺寸；
- A/B 两列机柜，每列 6 台（600×1200），冷通道 1200、热通道 1000；
- 3 台电源柜（600×800）、4 组电池架（600×800）、4 台精密空调（800×600）；
- 1 个馈线窗（600×400，底标高 2.40m）；
- 主干走线架 400×100（L≈10.6m）、分支走线架 300×100（2×8.0m），底标高 2.40m；
- 线缆按束表达：交流/直流/光缆/信号/接地；
- 设备材料表、图例、设计说明、图签、比例尺、指北针。

这张图是**手工样图**，用于确认表达深度；下一步应由算法生成同样的几何与标注。

分层版本：

- `docs/assets/room-layout-plan-sample.svg`：10 个命名图层，带 `data-layer` / `inkscape:groupmode="layer"`；
- `docs/assets/room-layout-plan-viewer.html`：图层开关查看器，支持单独显示/隐藏、预设视图、导出当前视图/完整分层 SVG。

算法侧建议直接输出“图层化”的 `PlanDrawing`：

```ts
interface PlanDrawing {
  layers: {
    grid: AxisGrid
    building: BuildingElements
    zones: ZoneFill[]
    equipment: Equipment[]
    cabinets: Cabinet[]
    trays: TraySegment[]
    cables: CableRoute[]
    aux: AuxElement[]        // 照明/消防/接地
    annotations: Dimension[]
    sheet: SheetTemplate
  }
}
```

这样渲染器只需按图层顺序拼装 SVG，查看器也无需理解业务语义，直接根据图层元数据生成开关。

### 5.4 交互

- 平移/缩放/适配窗口；
- 图层开关；
- 悬停高亮 + 信息卡（设备型号、功率、线缆数）；
- 点击选中，显示“到馈线窗/电源柜”的路径；
- 手动锁定/拖动设备，重新优化其余部分；
- “换一批”（换 seed）；
- 方案对比（并排/叠加差异）；
- 违规高亮（红色虚线 + 原因）；
- 导出 SVG / PNG / PDF / JSON / BOM Excel。

### 5.5 导出

- **SVG**：`XMLSerializer` + 内联样式，最稳。
- **PNG**：SVG → `Image` → `canvas.toBlob`，2x/4x。
- **PDF**：首版用浏览器打印（`window.print()` + `@media print`）；后续可加 `jspdf`/`pdf-lib`。
- **JSON**：完整 `LayoutSolution`，便于复现/二次编辑。
- **Excel**：设备表、线缆表、材料表，复用现有 `xlsx`。

---

## 六、在本仓库怎么落地

### 6.1 工具形态

新增工具：

- **id**：`room_layout`
- **名称**：机房配套平面图生成
- **描述**：随机生成机房轮廓，自动布置走线架、馈线窗、电源柜、机柜、电池、空调，并给出线缆布放与多目标优化方案。
- **标签**：机房、平面图、布局、走线架、馈线窗、机柜、电源、电池、空调、线缆、优化
- **图标**：`PhBlueprint` / `PhSquaresFour`（`@phosphor-icons/vue`）

注册位置：`src/tools/toolData.ts` 的 `toolConfigs`。

页面自动发现：`ToolDetailView.vue` 用 `import.meta.glob('@/tools/*/*Page.vue')`，只要目录和文件名符合 `src/tools/room_layout/RoomLayoutPage.vue` 即可，无需改路由。

### 6.2 目录结构

```text
src/tools/room_layout/
├─ RoomLayoutPage.vue          # 页面：参数、方案卡、画布、指标
├─ RoomPlanSvg.vue             # 纯展示 SVG（输入 solution）
├─ roomLayout.ts               # 类型、默认参数、入口 generateSolutions()
├─ rng.ts                      # 可复现随机数（mulberry32）
├─ room/
│  ├─ roomGenerator.ts         # 房间轮廓、柱网、门窗、馈线窗候选
│  └─ geometry.ts              # 正交多边形、碰撞、面积、边界
├─ infra/
│  ├─ trayGenerator.ts         # 走线架主干/分支
│  ├─ feederWindow.ts          # 馈线窗评分与选择
│  └─ facilityRules.ts         # 接地、消防、照明等规则
├─ layout/
│  ├─ zones.ts                 # 分区
│  ├─ rowPatterns.ts           # 列模式枚举
│  ├─ decoder.ts               # Genome → Layout
│  ├─ repair.ts                # 约束修复
│  ├─ simulatedAnnealing.ts    # SA 主优化
│  ├─ nsga2.ts                 # 可选：多目标
│  └─ evaluate.ts              # 指标与评分
├─ routing/
│  ├─ trayGraph.ts             # 走线架图
│  ├─ cableRouter.ts           # 束路由 + 容量
│  └─ cableTypes.ts            # 线缆类型/颜色/线型
├─ export/
│  ├─ planSvgExport.ts         # SVG/PNG 导出
│  └─ bomExport.ts             # 设备/线缆/材料表
├─ roomLayout.worker.ts        # 优化 + 路由在 Worker 中跑
├─ useRoomLayout.ts            # 页面状态编排
└─ __tests__/
   ├─ roomGenerator.spec.ts
   ├─ layoutConstraints.spec.ts
   ├─ cableRouter.spec.ts
   └─ determinism.spec.ts
```

### 6.3 核心数据模型

```ts
export type Mm = number

export interface Pt { x: Mm; y: Mm }
export interface Rect { x: Mm; y: Mm; w: Mm; h: Mm }

export interface RoomOutline {
  rects: Rect[]
  polygon: Pt[]
  area: number
  columns: Rect[]
  doors: Door[]
  exteriorWalls: WallSegment[]
  feederCandidates: WallSegment[]
}

export type EquipmentKind =
  | 'cabinet' | 'power' | 'battery' | 'ups'
  | 'ac_indoor' | 'ac_outdoor' | 'odf' | 'ground_bar' | 'fire'

export interface Equipment {
  id: string
  kind: EquipmentKind
  label: string
  rect: Rect
  rotation: 0 | 90
  clearances: { front: Mm; back: Mm; left: Mm; right: Mm }
  powerKw?: number
  heatKw?: number
  weightKg?: number
  ports?: PortSpec[]
}

export interface TraySegment {
  id: string
  from: Pt
  to: Pt
  width: Mm
  level: Mm
  kind: 'main' | 'branch' | 'drop'
  allowed: CableType[]
  capacityMm2: number
  usedMm2: number
}

export interface CableRoute {
  demandId: string
  type: CableType
  path: Pt[]
  trayIds: string[]
  lengthMm: number
  count: number
}

export interface LayoutSolution {
  seed: number
  room: RoomOutline
  equipment: Equipment[]
  trays: TraySegment[]
  routes: CableRoute[]
  metrics: Metrics
  violations: Violation[]
  score: number
  paretoRank?: number
}
```

### 6.4 生成流水线

```ts
export async function generateSolutions(
  params: LayoutParams,
  onProgress: (p: Progress) => void,
  signal: AbortSignal,
): Promise<LayoutSolution[]> {
  const rng = mulberry32(params.seed)
  const room = generateRoom(rng, params.room)
  const rows = generateRowPatterns(room, params, rng)
  const candidates: LayoutSolution[] = []

  for (let i = 0; i < params.restarts; i++) {
    signal.throwIfAborted()
    const genome = randomGenome(rows, rng)
    const layout = decode(genome, room, params.rules)
    const optimized = simulatedAnnealing(layout, room, params, rng, onProgress)
    const trays = generateTrays(room, optimized.rows, params.rules)
    const routes = routeCables(optimized, trays, params.cables)
    candidates.push(evaluate(optimized, trays, routes, params))
  }

  return paretoSelect(candidates, params.topN)
}
```

#### 6.4.1 生成流水线与图层索引的关系

**结论：图层 index 是“渲染顺序”，不是“生成顺序”。两者应该高度对齐，但不建议强行 1:1 线性一致。**

原因是有跨层依赖：

- `00 轴网` 通常由 `01 建筑` 的轴线反推，生成时建筑在前、渲染时轴网在前；
- `02 功能区` 依赖机柜列模式，生成时间晚于 `04 机柜` 的“列决策”；
- `05 走线架` 依赖 `04 机柜` 和 `01 馈线窗`；
- `06 线缆` 依赖 `05 走线架` 和 `03/04` 的设备端口；
- `07 照明/消防` 依赖建筑与设备覆盖，但渲染时放在线缆之上；
- `08 尺寸标注` 依赖所有几何，生成最后、渲染接近最上；
- `09 图签` 是模板，几乎独立。

所以真实生成顺序更接近：

```text
建筑/轴线 → 分区 → 机柜列 + 设备（可联合生成）→ 走线架 → 线缆 → 照明/消防 → 标注 → 图签
```

而渲染顺序是：

```text
轴网 → 建筑 → 功能区 → 设备 → 机柜 → 走线架 → 线缆 → 照明/消防 → 标注 → 图签
```

两者“同向”，但不“同序”。建议用**图层注册表 + 阶段 DAG** 对齐，而不是把生成器写成 `for layer of layers`：

```ts
export interface LayerSpec {
  id: string
  index: number          // 图层序号，仅用于显示/排序
  z: number              // 渲染 z-order
  label: string
  defaultVisible: boolean
}

export const LAYERS: readonly LayerSpec[] = [
  { id: 'grid',        index: 0, z: 0, label: '00 轴网',          defaultVisible: true },
  { id: 'building',    index: 1, z: 1, label: '01 建筑轮廓',      defaultVisible: true },
  { id: 'zones',       index: 2, z: 2, label: '02 功能区/通道',   defaultVisible: false },
  { id: 'equipment',   index: 3, z: 3, label: '03 设备',          defaultVisible: true },
  { id: 'cabinets',    index: 4, z: 4, label: '04 机柜',          defaultVisible: true },
  { id: 'trays',       index: 5, z: 5, label: '05 走线架',        defaultVisible: true },
  { id: 'cables',      index: 6, z: 6, label: '06 线缆',          defaultVisible: true },
  { id: 'aux',         index: 7, z: 7, label: '07 照明/消防/接地', defaultVisible: false },
  { id: 'annotations', index: 8, z: 8, label: '08 尺寸标注',      defaultVisible: true },
  { id: 'sheet',       index: 9, z: 9, label: '09 图框/图签',     defaultVisible: true },
] as const

export interface StageSpec {
  id: string
  produces: string[]       // 产出哪些图层
  dependsOn: string[]      // 依赖哪些阶段
}

export const STAGES: readonly StageSpec[] = [
  { id: 'building',    produces: ['building'],             dependsOn: [] },
  { id: 'axes',        produces: ['grid'],                 dependsOn: ['building'] },
  { id: 'zoning',      produces: ['zones'],                dependsOn: ['building'] },
  { id: 'placement',   produces: ['cabinets', 'equipment'], dependsOn: ['zoning'] },
  { id: 'trays',       produces: ['trays'],                dependsOn: ['placement', 'building'] },
  { id: 'routing',     produces: ['cables'],               dependsOn: ['trays', 'placement'] },
  { id: 'aux',         produces: ['aux'],                  dependsOn: ['building', 'placement'] },
  { id: 'annotations', produces: ['annotations'],          dependsOn: ['building', 'placement', 'trays', 'cables'] },
  { id: 'sheet',       produces: ['sheet'],                dependsOn: [] },
] as const
```

对齐规则：

1. **每个图元必须带 `layerId`**，由阶段在生成时打标，不能渲染时再猜。
2. **渲染器只按 `z` 排序**，不按生成顺序；这样阶段可以并行/重排。
3. **每个图层至少有一个生产者阶段**；一个阶段可以产出多个图层（如 `placement` 同时产 `cabinets` 和 `equipment`）。
4. **生成阶段按 DAG 拓扑排序执行**，不按 `index` 硬编码。
5. **查看器只读 `LayerSpec`**，不理解业务；业务变化不影响图层开关。

建议加三条契约测试：

- 所有 `layerId` 都能在 `LAYERS` 中找到；
- 所有 `LAYERS` 都有至少一个 `STAGES.produces` 覆盖；
- 任意图层隐藏/显示不改变任何几何、尺寸或指标（纯视图操作）。

如果以后确实想要“严格按 index 生成”，可以加一个 `linearMode`：阶段按 `index` 顺序执行，但代价是机柜/设备、走线架/线缆之间需要共享上下文和多次修正，算法会更脆。首版不建议。

### 6.5 Worker 协议

```ts
// 主线程 → Worker
type Request =
  | { type: 'generate'; seed: number; params: LayoutParams }
  | { type: 'cancel' }

// Worker → 主线程
type Response =
  | { type: 'progress'; phase: 'room' | 'layout' | 'routing' | 'evaluate'; pct: number }
  | { type: 'result'; solutions: LayoutSolution[] }
  | { type: 'error'; message: string }
```

要点：

- Worker 只做计算，不碰 DOM；
- 结果用 `structuredClone` 友好的普通对象；
- 取消用 `AbortController` + 消息双保险；
- 大结果（几千条线缆）可只回传“束 + 明细索引”，页面按需展开。

### 6.6 与现有工具联动（很强的产品点）

本仓库已经有：

- `dc_power_cabinet`：直流电源柜选型 → 电源柜数量/尺寸/模块数；
- `battery_sizing`：电池容量/只数 → 电池架数量；
- `hvac_cooling`：冷负荷 → 空调匹数/台数；
- `cable_sizing`：电缆截面/压降 → 线缆规格。

建议做**联动入口**：

```text
电源柜选型结果 ─┐
电池计算结果   ─┼→ 机房平面图生成（自动带入设备数量/尺寸/功率）
空调计算结果   ─┤
电缆选型结果   ─┘
```

实现方式二选一：

1. **URL 参数**：`/tools/room_layout?source=dc_power_cabinet&powerCabinets=2&...`（简单、可分享）；
2. **Pinia store**：`useRoomLayoutStore` 保存“上游选型结果”，页面初始化时读取（更适合多工具串联）。

首版建议 URL 参数 + 默认值；二期做 store。

---

## 七、实施计划

### 7.1 MVP（建议 5~8 个工作日）

目标：能生成、能看、能导出、能复现。

| 阶段 | 内容 | 产出 |
|---|---|---|
| D1 | 类型/规则库/seed RNG/几何工具 | `roomLayout.ts`、`rng.ts`、`geometry.ts` |
| D2 | 矩形 + L 形房间生成、柱网、门窗、馈线窗候选 | `roomGenerator.ts` |
| D3 | 列模式 + 分区 + 构造初解 + 约束校验 | `rowPatterns.ts`、`decoder.ts`、`repair.ts` |
| D4 | SA 单目标优化 + 指标 | `simulatedAnnealing.ts`、`evaluate.ts` |
| D5 | 走线架 + 线缆束路由 | `trayGenerator.ts`、`cableRouter.ts` |
| D6 | SVG 渲染 + 图层 + 图例/图签 | `RoomPlanSvg.vue` |
| D7 | 页面参数、方案卡、导出 SVG/PNG | `RoomLayoutPage.vue`、`planSvgExport.ts` |
| D8 | 测试、边界、文档 | `__tests__/*`、`tool.md` |

**MVP 范围收缩：**

- 房间：矩形 + L 形（先不做任意多边形）；
- 设备：机柜、电源柜、电池架、空调四类；
- 走线架：1 条主干 + 每列 1 条分支；
- 线缆：AC/DC/光纤/信号四类，束路由；
- 优化：SA 单目标加权，输出 Top 3；
- 导出：SVG + PNG + JSON；
- 不做：PDF/DXF、3D、真实厂家库、双路由、NSGA-II。

### 7.2 二期（建议 5~8 个工作日）

- 任意正交多边形（T/U/凹形/多矩形拼接）；
- NSGA-II + Pareto 前沿 + 方案对比；
- 强弱电分层走线架 + 填充率校验 + 自动加宽；
- 双路由/冗余；
- 设备库（厂家型号、尺寸、功率、端口）；
- 与 4 个选型工具联动；
- Excel BOM；
- 手动锁定/拖动 + 局部重优化。

### 7.3 三期（可选）

- MILP/CP-SAT 小规模精修（`highs` WASM）；
- DXF 导出 / CAD 对接；
- 3D 预览 / 气流场简化模拟；
- 多机房/多楼层；
- 施工图标注、材料表、造价估算；
- AI 辅助：自然语言描述 → 参数。

---

## 八、验收标准与测试

### 8.1 硬性验收

- 同一 seed + 参数 → 输出完全一致（JSON 深度相等）。
- 所有设备在房间多边形内，设备之间不重叠。
- 冷/热/搬运/维护通道满足规则（可配置）。
- 走线架连通馈线窗与每一列；线缆路径连续。
- 走线架填充率不超过阈值。
- 导出 SVG 在浏览器/Illustrator/Inkscape 中可打开。
- 页面在 20m×15m、60 柜规模下：生成 < 2 s，优化 2~5 s，渲染 < 500 ms（Worker + 进度条）。

### 8.2 测试策略

| 测试 | 内容 |
|---|---|
| 单元测试 | 几何并集/面积/点在多边形内、碰撞、RNG 可复现 |
| 约束测试 | 随机 100 个 seed，断言无越界/重叠/通道违规 |
| 路由测试 | 路径连续、边容量、线缆长度与曼哈顿下界对比 |
| 快照测试 | 固定 seed 的 SVG 快照（防回归） |
| E2E | 生成 → 切图层 → 选方案 → 导出 PNG/SVG |
| 性能测试 | 60/120/200 柜三档，记录耗时 |

### 8.3 可解释性

每个方案卡片显示：

- 机柜数、面积利用率、线缆总长、走线架长度；
- 与下界的差距（如“线缆比下界多 12%”）；
- 违规项（0 项为绿色）；
- 权重配置；
- seed；
- “为什么这样排”的一句话解释（规则命中）。

---

## 九、风险与边界

| 风险 | 影响 | 对策 |
|---|---|---|
| 规范取值因项目而异 | 生成结果“不合规” | 规则库可配置 + 来源标注 + 免责声明 |
| “最优”期望过高 | 用户不接受近似解 | 明确 Pareto/加权，展示下界与差距 |
| 任意多边形几何鲁棒性 | 自交/孔洞/窄颈 | 首版限制矩形/L 形；用成熟几何库 |
| 浏览器性能 | 卡顿 | Worker、粗网格、束路由、分层渲染 |
| 线缆太多画不清 | 图不可读 | 默认画束，按需展开，明细表 |
| 设备库维护 | 尺寸/功率不准 | 首版内置常用规格，支持用户编辑/导入 |
| 输出被当施工图 | 安全/责任 | 标注“方案示意，需工程师复核” |
| 算法参数难调 | 结果不稳定 | 预设权重、固定 seed 回归、指标监控 |
| GPL 依赖 | 许可污染 | 避免 `glpk.js`；优先 MIT/Apache |

---

## 十、技术选型对比

### 10.1 布局优化

| 方法 | 可行性 | 解质量 | 速度 | 可解释 | 建议 |
|---|---|---|---|---|---|
| 规则构造 | 高 | 中 | 极快 | 高 | 初解/兜底 |
| 模拟退火 | 高 | 良 | 快 | 中 | **MVP 主算法** |
| 遗传算法 | 高 | 良 | 中 | 中 | 备选 |
| NSGA-II | 中高 | 良（多目标） | 中慢 | 中 | 二期 |
| MILP (HiGHS) | 中 | 优（小规模） | 慢 | 高 | 可选精修 |
| CP-SAT | 中 | 优（小规模） | 慢 | 高 | 可选精修 |
| 强化学习 | 低 | 不确定 | 快（推理） | 低 | 不推荐首版 |

### 10.2 线缆路由

| 方法 | 可行性 | 说明 |
|---|---|---|
| 树上最短路 | 高 | 走线架是树时最优、最快 |
| Dijkstra/A* | 高 | 有环网/避障时用 |
| 最小费用流 | 中高 | 容量约束 |
| 多商品流 | 中 | 强/弱电分离、双路由，复杂 |
| Steiner 树 | 中 | 主干规划，近似 |

### 10.3 几何/渲染依赖

| 库 | 许可 | 用途 | 是否建议 |
|---|---|---|---|
| `polygon-clipping` | MIT | 正交多边形并/交/差 | 建议 |
| `rbush` | MIT | 矩形空间索引（已在依赖树） | 建议 |
| `@turf/turf` | MIT | 已有，可做面积/点在多边形内 | 可用 |
| `highs` | MIT | 可选 MILP | 二期 |
| `cpsat-js` | Apache-2.0 | 可选 CP-SAT | 二期，注意体积 |
| `glpk.js` | GPL-3.0 | 不推荐 | 许可风险 |

---

## 十一、参考与延伸

### 规范

- GB 50174-2017《数据中心设计规范》
- GB 51194-2016《通信电源设备安装工程设计规范》
- GB 50311-2016《综合布线系统工程设计规范》
- GB 50016-2014《建筑设计防火规范》
- YD/T 5003-2016《通信建筑工程设计规范》
- YD 5059-2005《电信设备安装抗震设计规范》
- GB 50462-2015《数据中心基础设施施工及验收规范》

### 算法/开源

- Facility Layout Problem（FLP）、2D orthogonal packing with aisles
- Slicing tree / B*-tree / sequence pair（floorplanning）
- Simulated Annealing、NSGA-II
- Rectilinear Steiner Tree、Manhattan routing、min-cost flow
- HiGHS（MIT, WASM）：<https://highs.dev>
- OR-Tools CP-SAT（Apache-2.0）：<https://developers.google.com/optimization/cp/cp_solver>
- `polygon-clipping`：<https://github.com/mfogel/polygon-clipping>
- `rbush`：<https://github.com/mourner/rbush>

### 本仓库可复用

- `src/tools/dc_power_cabinet/dcPowerCabinet.ts`：电源柜数量/尺寸
- `src/tools/battery_sizing/batterySizing.ts`：电池容量/只数
- `src/tools/hvac_cooling/hvacCooling.ts`：冷负荷/空调台数
- `src/tools/cable_sizing/cableSizing.ts`：电缆截面
- `src/tools/gantt_chart/ganttSvgExport.ts`：SVG/PNG 导出范式
- `src/utils/download.ts`：`downloadBlob`
- `src/workers/filePipeline.worker.ts`：Worker 写法参考
- `src/tools/toolData.ts`：工具注册
- `src/views/layouts/ToolDetailView.vue`：`*Page.vue` 自动发现

---

## 十二、从样图到可复用生成器还差什么

### 12.1 现状盘点

**已经有的：**

- 一张分层施工俯视样图：`docs/assets/room-layout-plan-sample.svg`；
- 一个图层查看器：`docs/assets/room-layout-plan-viewer.html`；
- 规范、算法、评分、路由、图层注册表、阶段 DAG 的设计；
- 与现有 4 个选型工具（电源柜、电池、空调、电缆）的联动思路。

**还没有的：**

- 真正的数据模型和生成器；
- 设备库、规则库、符号库；
- 可编辑画布、撤销重做、锁定和局部重生成；
- 主题系统；
- 自动尺寸标注/文字避让引擎；
- 持久化、版本、导入导出；
- 测试与性能预算。

一句话：**现在有“样图 + 方案”，还没有“产品”。**

### 12.2 缺口清单（按系统）

| 系统 | 现在有什么 | 还差什么 | 优先级 |
|---|---|---|---|
| 数据模型 | 文档里的 TS 接口 | `PlanDocument` 正式 schema、`schemaVersion`、迁移、运行时校验、稳定 ID、单位约定 | P0 |
| 设备/符号库 | 样图硬编码 4 类 | 数据驱动设备库：尺寸、维护间距、端口、功率/发热、重量、符号、厂家/型号、来源；支持导入/导出 | P0 |
| 规则库 | 文档里的默认值 | 规则包（国标/企业/项目）、版本、覆盖、来源标注、独立校验器、违规报告 | P0 |
| 生成引擎 | 伪代码 | 阶段 DAG、确定性 RNG、进度/取消、缓存、局部重生成 | P0 |
| 布局优化 | 方案 | SA/NSGA-II 实现、约束修复、评分、Pareto、下界对比 | P0 |
| 线缆路由 | 方案 | 走线架图、束路由、容量校验、双路由 | P1 |
| 编辑模型 | 无 | 选择、拖动、旋转、吸附、锁定、属性面板、撤销重做、命令模式、命中测试 | P0 |
| 主题系统 | 一套固定样式 | `ThemeSpec`、设计 token、主题 JSON、运行时切换、导出继承、打印/深色/蓝图主题 | P0 |
| 标注/图签 | 手工坐标 | 自动尺寸链、文字避让、引线、CJK 字体度量、图签模板、纸张/比例、图例/材料表自动生成 | P0 |
| 持久化/导出 | SVG/PNG 方案 | JSON 保存/加载、localStorage、URL 分享、版本历史、迁移、SVG/PNG/PDF/DXF/Excel BOM | P1 |
| 查看器/UI | 图层开关 | 属性面板、设备面板、校验面板、版本对比、测量工具、小地图 | P1 |
| 性能 | 无 | Worker、增量渲染、`rbush` 空间索引、Canvas 线缆层、缓存、防抖 | P1 |
| 测试 | 无 | 黄金 seed、几何不变量、视觉回归、性能预算、模糊测试、schema 往返 | P0 |
| 集成 | 思路 | 与 4 个选型工具联动、BOM、项目数据、分享链接 | P2 |
| 文档/许可 | 调研文档 | schema/主题/插件文档、示例、迁移指南、设备数据来源、免责声明 | P2 |

### 12.3 优先级建议

**P0：先把“能生成、能改、能存、能切主题”跑通**

1. `PlanDocument` schema + 运行时校验 + 迁移；
2. 设备库 + 符号库 + 规则包；
3. 阶段 DAG + 确定性 RNG + 进度/取消；
4. 规则构造 + SA + 约束修复 + 评分；
5. 可编辑画布：选择/拖动/旋转/吸附/锁定/撤销重做；
6. 局部重生成：按阶段、保留锁定、diff；
7. `ThemeSpec` + 2~3 套主题 + 运行时切换；
8. 自动尺寸标注 + 文字避让 + 图签模板；
9. JSON 保存/加载 + localStorage + 自动保存；
10. 黄金 seed + 几何不变量 + 视觉回归测试。

**P1：把“施工可用”补齐**

- 线缆束路由 + 容量校验 + 双路由；
- PDF/DXF 导出；
- 图例/材料表自动生成；
- 校验面板 + 违规定位；
- Worker + 增量渲染 + 大方案性能；
- 版本历史 + 方案对比。

**P2：把“平台化”补齐**

- 与 4 个选型工具联动；
- 插件 SDK / 自定义设备库 / 自定义规则包；
- 多机房/多楼层；
- 3D/气流简化；
- AI 参数生成。

### 12.4 建议目录（与现有仓库一致）

```text
src/tools/room_layout/
├─ core/                 # 与 Vue 无关，可被其他工具复用
│  ├─ schema.ts          # PlanDocument / LayerSpec / ThemeSpec
│  ├─ registry.ts        # 图层注册表 + 阶段 DAG
│  ├─ rng.ts             # mulberry32
│  ├─ pipeline.ts        # 阶段调度、进度、取消
│  ├─ validate.ts        # 规则校验 + 违规报告
│  └─ diff.ts            # 方案/版本 diff
├─ library/
│  ├─ equipment.ts       # 设备库
│  ├─ symbols.ts         # 符号库
│  └─ rules/             # 规则包
├─ generators/
│  ├─ room.ts
│  ├─ zones.ts
│  ├─ placement.ts
│  ├─ trays.ts
│  ├─ routing.ts
│  ├─ aux.ts
│  ├─ annotations.ts
│  └─ sheet.ts
├─ render/
│  ├─ svgRenderer.ts     # render(plan, theme) → SVG
│  ├─ dimensionEngine.ts
│  ├─ labelLayout.ts
│  ├─ themes/
│  └─ export/
├─ editor/
│  ├─ usePlanEditor.ts
│  ├─ commands.ts        # 撤销/重做
│  ├─ hitTest.ts
│  └─ snapping.ts
├─ io/
│  ├─ planFile.ts        # JSON + 迁移
│  ├─ exportSvg.ts
│  ├─ exportPng.ts
│  ├─ exportPdf.ts
│  ├─ exportDxf.ts
│  └─ exportBom.ts
├─ ui/
│  ├─ RoomLayoutPage.vue
│  ├─ PlanCanvas.vue
│  ├─ LayerPanel.vue
│  ├─ PropertyPanel.vue
│  ├─ EquipmentPalette.vue
│  ├─ ThemeSwitcher.vue
│  ├─ ValidationPanel.vue
│  └─ VersionHistory.vue
└─ __tests__/
```

### 12.5 “四个可”的验收标准

| 目标 | 验收 |
|---|---|
| 可复用 | `core/` 不依赖 Vue；schema、设备库、规则包、主题都是数据；可被其他工具直接调用 |
| 可修改 | 任意设备可选中/拖动/旋转/锁定；属性面板可改；撤销重做；修改后自动校验 |
| 可重生成 | 同 seed + 同参数 → 同结果；支持按阶段重生成；保留锁定；显示 diff |
| 可切主题 | `render(plan, theme)` 纯函数；切主题不重算布局；导出继承当前主题；主题可导入/导出 |
| 可随时切换 | 图层/主题状态独立于数据；切换不改变几何、尺寸和指标 |

### 12.6 先不做什么

- 3D 实时渲染；
- 多人实时协作；
- 完整 CAD 内核；
- AI 直接生成施工图；
- 多楼层/多园区；
- 结构承重/气流场精确仿真。

这些都可以在 P2 之后再说，首版不要被它们拖住。

### 12.7 一句话

**缺的不是算法，是产品化层：schema、设备库、规则库、编辑器、主题、标注引擎、持久化、测试。**

---

## 十三、原始数据与 DXF/DWG 导出

### 13.1 结论先行

| 导出物 | 纯浏览器（服务器只传输） | 说明 |
|---|---|---|
| `plan.json` / JSON Schema | ✅ 成立 | 直接 `Blob` 下载，最应该先做 |
| CSV / XLSX / BOM | ✅ 成立 | 复用现有 `xlsx` |
| SVG / PNG | ✅ 成立 | 已有方案 |
| PDF | ✅ 成立 | 浏览器打印或 `jspdf` / `pdf-lib` |
| **DXF** | ✅ 成立 | ASCII 文本，Worker 里生成，几 MB 无压力 |
| **DWG** | ❌ 不成立 | 原生 DWG 是封闭二进制格式，纯浏览器没有成熟可靠的写入方案 |

**建议：把 DXF 作为“CAD 交换”的主交付，DWG 作为可选的转换能力。**
AutoCAD 打开 DXF 后“另存为 DWG”只需要一步；不要为了 DWG 把整个架构改成后端计算。

### 13.2 原始数据导出（优先级最高）

原始数据不是“附带文件”，而是整个生成器的**可复用契约**：

```text
room-layout-export.zip
├─ plan.json            # 完整 PlanDocument（几何/设备/走线架/线缆/图层/主题）
├─ plan.schema.json     # JSON Schema，外部工具可校验
├─ manifest.json        # seed / 生成器版本 / 规则包版本 / 设备库版本 / 主题 ID
├─ metrics.json         # 面积利用率、线缆总长、走线架长度、违规项
├─ bom.xlsx             # 设备/材料/线缆明细
├─ plan.svg             # 当前主题的矢量图
├─ plan.dxf             # CAD 交换文件
└─ README.txt           # 如何复现、如何导入
```

`PlanDocument` 至少包含：

```ts
interface PlanDocument {
  schemaVersion: 1
  id: string
  meta: {
    name: string
    project: string
    seed: number
    generatorVersion: string
    rulesVersion: string
    libraryVersion: string
    themeId: string
    createdAt: string
  }
  room: RoomOutline
  rules: RulePack
  equipment: Equipment[]
  cabinets: Cabinet[]
  trays: TraySegment[]
  cables: CableRoute[]
  aux: AuxElement[]
  annotations: Dimension[]
  layers: LayerState
  theme: ThemeSpec
  sheet: SheetData
}
```

关键点：

- `seed` + 版本号必须进 manifest，否则无法复现；
- `plan.json` 是源数据，SVG/DXF 都是派生文件；
- 导入时要先校验 `schemaVersion`，再做迁移；
- 设备库/规则包/主题都可以单独导出，便于跨项目复用。

### 13.3 DXF 导出（纯浏览器可行）

#### 版本与编码

| 版本 | 兼容性 | 中文 | 建议 |
|---|---|---|---|
| R12（AC1009） | 最广 | 需 GBK / `\U+XXXX` | 兼容老 CAD，但实体少 |
| R2000（AC1015） | 广 | 代码页，需处理 | 支持 LWPOLYLINE |
| R2010+（AC1024+） | 现代 CAD | UTF-8 | **推荐**，中文最稳 |

建议首版直接输出 **R2010+ ASCII DXF（UTF-8）**；如果客户坚持 R12，再增加 GBK 编码分支（需要引入 GBK 编码表或 `iconv-lite` 的浏览器版）。

#### 图层映射

| DXF 图层 | 内容 | 颜色/线型 |
|---|---|---|
| `A-GRID` | 轴网 | 灰、CENTER |
| `A-WALL` | 墙体、柱 | 白/黑、CONTINUOUS |
| `A-DOOR` | 门、开启弧 | 灰、CONTINUOUS |
| `E-EQUIP` | 电源柜、电池架、空调 | 红/绿/蓝、CONTINUOUS |
| `E-CABINET` | 机柜 | 青、CONTINUOUS |
| `T-TRAY` | 走线架 | 橙、CONTINUOUS/DASHED |
| `C-CABLE-AC` | 交流电源 | 红、CONTINUOUS |
| `C-CABLE-DC` | 直流电源 | 蓝、CONTINUOUS |
| `C-FIBER` | 光缆 | 橙、CONTINUOUS |
| `C-SIGNAL` | 信号/网线 | 绿、DASHED |
| `L-AUX` | 照明/消防/接地 | 灰/绿、CONTINUOUS |
| `D-DIM` | 尺寸标注 | 灰、CONTINUOUS |
| `S-SHEET` | 图框、图签 | 白/黑、CONTINUOUS |

#### 实体映射

| 平面图元素 | DXF 实体 |
|---|---|
| 墙体/房间轮廓 | `LWPOLYLINE` 或 `LINE` + `HATCH` |
| 结构柱 | `LWPOLYLINE` 闭合 |
| 门/开启弧 | `LINE` + `ARC` |
| 机柜/电源/电池/空调 | `BLOCK` + `INSERT`，属性写编号/型号 |
| 走线架 | 双 `LWPOLYLINE` + 横档 `LINE` |
| 线缆束 | `LWPOLYLINE`，按类型分图层/颜色/线型 |
| 灯具/烟感/喷淋 | `BLOCK` + `INSERT` |
| 尺寸 | `DIMENSION`（推荐）或 `LINE` + `TEXT`（MVP） |
| 文字 | `TEXT` / `MTEXT`，指定中文文字样式 |
| 图框/图签 | `LWPOLYLINE` + `TEXT`，可放 paper space |

#### 关键设置

- `$INSUNITS = 4`（毫米），`$MEASUREMENT = 1`（公制）；
- 模型空间按 **1:1 mm** 画，不要预先缩放；比例放到 paper space 视口；
- 设备用块（BLOCK）+ 属性，方便 CAD 里替换/统计；
- 尺寸优先用真正的 `DIMENSION` 实体，并定义 `DIMSTYLE`；
- 文字样式指定 `SimSun` / `Microsoft YaHei`，并设置宽度因子；
- 主题切换时，把主题颜色映射到 ACI 色号或 true color，线型映射到 `CONTINUOUS/DASHED/CENTER/HIDDEN`。

#### 可用库

| 库 | 许可 | 体积 | 能力 | 建议 |
|---|---|---|---|---|
| `@tarikjabiri/dxf` | MIT | ~442 KB unpacked | 块、插入、HATCH、尺寸、MTEXT、paper space | **推荐** |
| `dxf-writer` | MIT | ~61 KB | 基础实体（线/圆/多段线/文字） | 轻量 MVP |
| 自研 R12/R2010 writer | — | 小 | 完全可控 | 需要深度定制时 |

建议用**动态 import** 把 DXF 库放进独立 chunk，并在 Worker 里生成字符串，避免拖慢主包和主线程。

### 13.4 DWG 导出（纯浏览器不成立）

原生 DWG 是 Autodesk 的封闭二进制格式，浏览器端没有成熟、可靠、许可友好的写入方案：

- **LibreDWG**：GPL-3.0，WASM 构建重、复杂图纸兼容性有限，和 MIT 项目混用有许可风险；
- **ODA / RealDWG / Teigha**：商业授权，需要原生库，不适合纯前端；
- **AutoCAD CLI**：需要安装 AutoCAD，只能桌面/服务器；
- **第三方云转换 API**：可用，但引入服务端、按文件计费、图纸外发隐私问题。

可行路线：

| 方案 | 架构影响 | 成本 | 建议 |
|---|---|---|---|
| **导出 DXF，CAD 里另存 DWG** | 无，纯浏览器 | 0 | **首选** |
| 后端转换服务（ODA/LibreDWG） | 增加服务端 | 3~5 天 + 授权 | 有强 DWG 需求时 |
| 桌面壳（Electron/Tauri）+ 原生库 | 增加桌面端 | 1~2 周 | 内部工具可考虑 |
| 第三方云转换 API | 增加外部依赖 | 按量付费 | 看隐私/预算 |

**结论：如果“DWG”是硬性验收项，现有“服务器只传输、全部浏览器计算”的边界必须为一个转换服务开例外；否则建议把验收项改成“DXF + CAD 另存 DWG”。**

### 13.5 工作量与性能预估

| 任务 | 预估 |
|---|---|
| `plan.json` + JSON Schema + manifest + ZIP 打包 | 1 天 |
| DXF MVP（图层、线/多段线、文字、块、单位、下载） | 3~5 天 |
| DXF 施工级（尺寸、HATCH、paper space、中文、主题映射、CAD 往返测试） | 1.5~2 周 |
| DWG 后端转换（含授权/部署） | 3~5 天 + 授权成本 |
| DWG 云 API 接入 | 1~2 天 + 按量费用 |

性能：

- 12 柜样图 DXF 约 100~300 KB；
- 200 柜 + 1000 段线缆约 2~10 MB；
- Worker 内生成字符串通常 < 1 s；
- `Blob` 下载不占主线程，浏览器内存足够；
- DXF 库动态加载，不进入首屏包。

### 13.6 对现有架构的最终判断

**成立的部分：**

- 静态站点 + 浏览器计算 + `Blob` 下载；
- JSON / CSV / XLSX / SVG / PNG / PDF / **DXF**；
- Worker 里做几何、优化、路由、DXF 序列化；
- 无数据库、无后端、无用户数据上传。

**不成立的部分：**

- **DWG 原生导出**。要么接受“DXF + CAD 另存”，要么增加一个可选的转换服务/桌面壳。

建议把导出能力设计成适配器：

```ts
interface ExportAdapter {
  id: 'json' | 'svg' | 'png' | 'pdf' | 'dxf' | 'dwg'
  supports: 'browser' | 'server' | 'desktop'
  export(plan: PlanDocument, theme: ThemeSpec): Promise<Blob>
}
```

这样主应用仍然是纯静态；`dwg` 适配器默认提示“请导出 DXF 后另存”，有后端时再挂上转换服务，不影响其他功能。

---

## 十四、最终建议

**先做 MVP，不要一上来做“全能最优”。**

推荐的第一版边界：

- 房间：矩形 + L 形；
- 设备：机柜、电源柜、电池架、空调；
- 基础设施：1 个馈线窗、1 条主干走线架、每列分支；
- 优化：规则构造 + SA，加权单目标，Top 3；
- 线缆：四类，束路由，填充率校验；
- 呈现：SVG + 图层 + 图例/图签 + SVG/PNG/JSON 导出；
- 可复现：seed；
- 免责声明：方案示意，需工程师复核。

这个范围足以验证“能不能生成、好不好看、算得快不快、结果合不合理”。验证通过后，再逐步加任意多边形、NSGA-II、双路由、MILP 精修和工具联动。

---

> **一句话给决策者：**
> 这不是“AI 画图”，而是一个**规则引擎 + 随机生成 + 多目标局部搜索 + 正交路由 + SVG 工程图渲染**的组合。
> 技术栈完全落在现有纯前端架构内，MVP 可行；真正的护城河是规范规则库和设备库，而不是算法本身。
