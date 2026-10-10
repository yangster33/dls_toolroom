# 阶段 1 计划（门禁真实生效 · 第二批）

- **日期**：2026-10-10（计划）／2026-10-10（执行）
- **项目**：dls_toolroom（Vue 3 + Vite + TS + Tailwind v4 + daisyUI 5 + Pinia 3，纯前端工具间）
- **依据**：[`docs/2026-10-09-audit-00-summary.md`](../docs/2026-10-09-audit-00-summary.md) 阶段 1
- **配套执行记录**：[`docs/2026-10-10-stage1-fix-record.md`](../docs/2026-10-10-stage1-fix-record.md)
- **相关提交**：`30a5403` style（格式化基线）· `7c4489b` chore(ci)（逻辑改动）

## 完成状态（2026-10-10 收尾）

- **P2-3** ✅ eslint 133 error → **0**（112 `no-explicit-any` + 17 unused-vars + 1 空接口 + 1 `@ts-ignore`）
- **P2-4** ✅ `vitest.config.ts` 独立化，不再复用 vite.config.ts（不读 `.env`、不挂 mock/devtools、不做 build 分包）
- **P2-2** ✅ `build` 改为 `run-s lint type-check test:unit build-only prerender`，并已反证会因 type error 中止
- **P2-9** ✅ prettier 门禁 + 全仓格式化基线（216 个文件 → 全部符合）
- **P2-6** ✅ `engines` 收紧为 `>=22.17.0`；`.nvmrc` 22→24；CI 三个 job 统一 Node 24
- **P2-7** ✅ `.env` 删重复 key；`VITE_ENABLE_MOMENT_TAB` 默认值写进代码（CI 产物与本地一致）

**计划外但同批完成**：
- 给 `frappe-gantt` 补 `src/types/frappe-gantt.d.ts`（32 行），替代 `// @ts-ignore`
- 修掉 3 个被 `as any` 掩盖的真实 bug（见 §4）
- 清掉 `tsconfig.node.json` 里引用的 `cypress.config.*`（项目无 Cypress）

**门禁结果**：

| 检查项 | 阶段 1 前 | 阶段 1 后 |
|---|---|---|
| `type-check` | 0 错误 | ✅ 0 错误 |
| `oxlint` | 0/0 | ✅ 0/0（184 files） |
| `eslint` | ❌ **133 errors** | ✅ **0** |
| `prettier --check` | ❌ 216 files 不符 | ✅ 全部符合 |
| `vitest` | 539 passed | ✅ 539 passed |
| `playwright`（生产构建） | 6 passed / 1 flaky | ✅ 6 passed / 1 flaky |
| `npm run build` | 不带门禁 | ✅ 门禁前置，注入 type error 实测 exit 1 |

---

## 一、目标

把「看起来在管、其实没管」的配置变成真实门禁：

1. **CI 真正卡住问题** —— 而不是被永远绿的 `oxlint` 蒙蔽（`eslint` 同一份代码报 133 error，CI 却只跑前者）
2. **`npm run build` 不再能带着 type error / 红测试产出可部署产物**
3. **消除配置层面的静默分叉** —— `.env` 缺字段时 CI 产物与本地不一致、`engines` 声称支持装不上依赖的 Node 版本
4. 借修 lint 的机会，把 `as any` 换成真实类型，顺带暴露被掩盖的 bug

---

## 二、选择标准

阶段 1 的 6 项共同点是**投入小、影响面覆盖整个发布流程**，且都不需要改业务逻辑。其中 P2-3（修 133 个 lint error）工作量最大，但它是"门禁可信度"的前提——不修它，CI 加 `npm run lint` 只会让 CI 变红而无法合并。

---

## 三、实施明细

### P2-3 eslint 清零（核心）

按「能不能推断出真实类型」把 112 个 `no-explicit-any` 分三类处理：

| 类别 | 处理方式 | 例子 |
|---|---|---|
| 能推断出真实类型 | 直接换成真实类型 | `GdacsFeature`、`DataRow`、`Record<string, unknown>`、`unknown[]` |
| 库不导出类型 | 本地声明最小接口 + 运行时归一化 | echarts 的 `TopLevelFormatterParams` 未从主入口导出 |
| 库签名有缺口 | 写收窄辅助函数，集中一处断言 | leaflet class 的 `protected _map`、turf 的联合返回类型 |

**关键实现**：`src/types/frappe-gantt.d.ts`（32 行）—— `frappe-gantt` 无类型声明，原代码用 `// @ts-ignore` 压掉 import 错误后满屏 `as any`。补声明覆盖本项目实际用到的 API（含 `popup` 回调、内部 `tasks`/`layers`/`make_arrows`），并核对过 `node_modules/frappe-gantt/dist/frappe-gantt.es.js` 的真实签名。

同时删掉 `GanttModule.default \|\| GanttModule` —— 实测 ESM 构建只有 `export { B as default }`，`.default` 是死分支。

### P2-4 vitest 配置独立化

原 `vitest.config.ts` 直接复用 `vite.config.ts`，把 `viteMockServe`、`vueDevTools`、`manualChunks` 全拖进测试环境，且 `loadEnv(mode, cwd, '')` 空前缀会把 `.env` 全部内容注入 config。

改为独立配置，只带 Vue 编译 + 路径别名。

### P2-2 / P2-9 脚本与门禁

```diff
- "build": "run-s build-only prerender"
+ "build": "run-s lint type-check test:unit build-only prerender"
- "test:unit": "vitest"            // watch 模式，CI 里不会退出
+ "test:unit": "vitest run"        // 一次性运行
- "format": "prettier --write --experimental-cli src/"
+ "format": "prettier --write --experimental-cli ."
+ "format:check": "prettier --check --experimental-cli ."
+ "lint:check": "run-s lint:check:*"   // 不带 --fix，供 CI 用
```

### P2-6 / P2-7 配置治理

- `engines`：`^20.19.0 \|\| >=22.12.0` → `>=22.17.0`（原范围覆盖 Node 20，但 `jsdom` 需 22.13+、`@sparticuz/chromium` 需 22.17+）
- `.nvmrc` 22→24、CI 三个 job 的 `node-version` 22→24（与 `@tsconfig/node24` 对齐）
- 删 `.env` 里重复一遍的 `VITE_USE_MOCK`
- `createToolNavItems.ts`：`=== 'true'` → `!== 'false'`，并把默认值说明写进注释

### CI 变化（`.github/workflows/ci.yml`）

`verify` job 从 3 步扩到 5 步（type-check + oxlint + eslint + prettier + vitest）；`build` job 新增回归断言：`grep dist/index.html` 必须包含「势」tab。

---

## 四、实施偏差与计划外发现

### 4.1 修 lint 时暴露 3 个被 `as any` 掩盖的真实 bug

**这不是计划内的，但属于同一批工作的必然产出**——`as any` 的作用就是把类型错误藏起来，而类型错误常常就是逻辑错误：

| Bug | 位置 | 说明 |
|---|---|---|
| turf v7 `intersect` 传两个参数 | `geoDataService.ts:735` | turf v7 只接受一个 `FeatureCollection`，旧代码传两个并按 Turf 6 的"返回带 features 的集合"判空 → **面/面相交面积恒为 0** |
| `L.latLngBounds()` 传两个 bounds | `KmlViewerPage.vue:626,633` | 两个参数都会被当 `LatLngExpression`，产出的 bounds 是错的 |
| leaflet `TileLayer.extend()` 构造签名 | `KmlViewerPage.vue:468` | 返回类型推断不出构造签名，腾讯瓦片 Y 翻转层改用"实例化后覆写 `getTileUrl`" |

### 4.2 frappe-gantt 的类型是核对源码得出的，不是猜的

写 `frappe-gantt.d.ts` 前逐个核对了 `node_modules/frappe-gantt/dist/frappe-gantt.es.js`，确认了几件与直觉相反的事：

- ESM 构建只有 `export { B as default }`，**没有命名导出**，原代码的 `GanttModule.default \|\| GanttModule` 是死分支
- `holidays` 选项的**键是条目 id、值才是语义**（值为 `'weekend'` 才触发 `is_weekend`）——本项目现有写法 `{ 'var(--g-weekend-highlight-color)': 'weekend' }` 直接抄自库自己的默认配置，是有效的
- popup 回调的 `set_title`/`set_subtitle`/`set_details` 走 `innerHTML`（因此上游必须自行转义）

### 4.3 提交拆成两个：格式化基线与逻辑改动分离

全仓格式化涉及 99 个文件、+29294/−978 行。如果和逻辑改动混在一个提交里，`git log -p` 将完全不可读。

采用「还原→重新格式化→哈希比对」的方法精确分离：99 个纯格式化文件 + 39 个含逻辑改动的文件，分两个提交。

### 4.4 leaflet 的 `L.Layer` 一度改错方向

`KmlTreeNodeData.leafletLayer` 原本是 `any`，第一反应是改成 `L.Layer`，但跨 `.vue` 组件传 props 时报 `Property '_map' is missing`——因为 `@types/leaflet` 的 `Layer` 是带 `protected _map` 的 class，TS 按名义子类型检查。

中间还试过改成宽松结构类型（`{addTo, remove, ...}`），结果让 `map.addLayer()` 报更多错。最终方案是：types.ts 声明「实际用到的接口子集」+ 在 KmlViewerPage 里用 `asLeafletLayer()` 收窄，集中一处断言。

---

## 五、验证方法与反证

不只跑通了门禁，对每项关键改动做了**反证**：

| 验证 | 方法 | 结果 |
|---|---|---|
| P2-2 门禁真的会卡 | 注入 `const __gate_test: number = 'deliberate type error'`，跑 `npm run build` | ✅ exit 1，在 type-check 阶段中止，**未进入构建** |
| P2-4 不依赖 `.env` | `Move-Item .env .bak` 后跑 vitest | ✅ 539 passed；已恢复 |
| P2-7 默认值方向 | 无 `.env` 时 `npm run build`，检查 dist 产物 | ✅ 「势」tab 存在 |
| P2-3 无行为变化 | 全量 vitest + playwright | ✅ 539 passed / 6 passed / 1 flaky |
| 提交分离正确 | 比对"当前版本"与"HEAD→重新格式化"的 MD5 | ✅ 99 纯格式化 + 39 逻辑改动 |

---

## 六、明确不做（留在后续阶段）

| 项 | 原因 | 归入 |
|---|---|---|
| 修 `manualChunks` 顺序、首屏 810 kB | 需逐 chunk 核对产物，与 lint 无关 | 阶段 2 |
| `push(...arr)` 大数据量崩溃（6 处） | 需构造万行级 fixture | 阶段 2 |
| 空间分析 `Multi*` 拆分 + 逐 feature try/catch | 涉及容错语义设计 | 阶段 2 |
| CGCS2000 NaN / 批量高程失败被吞 | 需定义 `partial` 状态约定 | 阶段 2 |
| 模板读取器 7 份 → 参数化工厂 | 大重构，需逐工具回归 | 阶段 3 |
| 拆 `GanttChartPage.vue`(1623) / `KmlViewerPage.vue`(1176) | 大重构 | 阶段 3 |
| 删 12 个零引用依赖 + 约 850 行死代码 | 需先确认构建产物无回归 | 阶段 3 |
| `vercel.json` 裸 IP → 环境变量 | 需 Vercel 控制台操作 | 阶段 4 |
| `geocodeStore` 的 `apiKeys` 退出持久化 | 安全加固，需评估会话体验 | 阶段 4 |

---

## 七、遗留项

1. **`npm run lint`（带 `--fix`）与 CI 的 `lint:check`（不带 `--fix`）刻意分开** —— 避免 CI 悄悄改代码。本地仍可 `npm run lint` 自动修。
2. **lefthook 未安装**（提交时提示 `Can't find lefthook in PATH`）—— 仓库配了 git hook 但本机没装，钩子未生效。需确认是否符合预期。
3. **e2e 本地跑 dev server 仍报 `EPERM rename node_modules/.vite/deps`** —— `F:\PPT\...` 路径被安全软件/同步客户端拦截。评估 e2e 请用 `CI=true`（走 preview server，已验证 6 passed）。
4. **`.env` 已改为全注释**（`VITE_ENABLE_MOMENT_TAB` 移到 `.env` 里并注释），本地若之前依赖它开启「势」tab，现在默认就是开的。
