# 2026-10-10 · 阶段 1 执行记录

> **执行日期**：2026-10-10
> **依据报告**：[2026-10-09 审查总览](./2026-10-09-audit-00-summary.md) 阶段 1
> **对应计划**：[`../plan/2026-10-10-stage1-gates-plan.md`](../plan/2026-10-10-stage1-gates-plan.md)
> **提交**：`30a5403` style（格式化基线，99 files）· `7c4489b` chore(ci)（逻辑改动，39 files）
> **状态**：✅ 阶段 1 全部完成，eslint 从 133 error 归零

---

## 一、核心指标

| 检查项 | 阶段 1 前 | 阶段 1 后 |
|---|---|---|
| `npm run type-check` | 0 错误 | ✅ 0 错误 |
| `npx oxlint .` | 0 / 0 | ✅ 0 / 0（184 files） |
| `npx eslint .` | ❌ **133 errors** | ✅ **0** |
| `npx prettier --check .` | ❌ 216 files 不符 | ✅ 全部符合 |
| `npx vitest run` | 539 passed / 37 files | ✅ 539 passed / 37 files |
| `npx playwright test`（生产构建） | 6 passed / 1 flaky | ✅ 6 passed / 1 flaky |
| `npm run build` | 不带门禁 | ✅ `lint → type-check → test → build → prerender` |

**改动规模**：138 files changed，+31034 / −1697 行，拆成 2 个提交。

---

## 二、6 项完成情况

### 2.1 P2-3 eslint 133 → 0（本次最大的一项）

**为什么这条最关键**：实测 `npx oxlint .` 报 0 error，而 `npx eslint .` 对**同一份代码**报 133 error。CI 只跑 oxlint，等于门禁形同虚设——修 133 个 error 是"让 CI 敢跑 lint"的前提。

112 个 `no-explicit-any` 按可推断性分三类：

| 类别 | 处理 | 示例 |
|---|---|---|
| 能推断真实类型 | 直接替换 | `GdacsFeature` / `DataRow` / `Record<string, unknown>` / `unknown[]` |
| 库不导出类型 | 本地最小接口 + 运行时归一化 | echarts 的 `TopLevelFormatterParams` 未从主入口导出 |
| 库签名有缺口 | 收窄辅助函数，集中断言 | leaflet class `protected _map`、turf 联合返回类型 |

**`src/types/frappe-gantt.d.ts`（新增，32 行）**：`frappe-gantt` 无类型声明，原代码 `// @ts-ignore` 压掉 import 错误后满屏 `as any`。这份声明覆盖项目实际用到的 API，且**每个签名都核对过 `node_modules/frappe-gantt/dist/frappe-gantt.es.js`**：

- ESM 构建只有 `export { B as default }`，无命名导出 → 删掉死分支 `GanttModule.default \|\| GanttModule`
- `holidays` 的**键是条目 id、值才是语义**（值 `'weekend'` 才触发 `is_weekend`）—— 项目现有写法抄自库自己的默认配置，有效
- popup 回调的 `set_title/subtitle/details` 走 `innerHTML` → 上游必须自行转义

### 2.2 P2-4 vitest 独立化

原 `vitest.config.ts` 复用 `vite.config.ts`，副作用：
1. `loadEnv(mode, cwd, '')` 空前缀把 `.env` 全部内容注入 config（含未来可能的真密钥）
2. `viteMockServe` / `vueDevTools` 白拖进测试环境
3. `manualChunks` 对 vitest 无意义
4. mock 开关依赖 `.env` 是否存在 → 删 `.env` 后行为漂移

改为只带 Vue 编译 + 路径别名的独立配置。

### 2.3 P2-2 build 加门禁

`build` 原本可带着 type error 直接产出可部署产物。改为：

```
run-s lint type-check test:unit build-only prerender
```

顺带修 `"test:unit": "vitest"` → `"vitest run"`（前者是 watch 模式，CI 里永不退出）。

### 2.4 P2-9 prettier 门禁 + 基线

`format` 脚本写的是 `--write src/` 但**从未真正跑过**——全仓 216 个文件不符合。先建立基线再接门禁，否则一上就红、无法区分新问题与历史欠账。

新增 `.prettierignore`（排除 dist / node_modules / coverage / 测试产物 / `*.log` / `.scrape` / md 文档 / 锁文件 / 脚本产出的 sitemap 与 robots）。

### 2.5 P2-6 engines + Node 版本统一

`engines` 从 `^20.19.0 \|\| >=22.12.0` 收紧为 `>=22.17.0`（原范围覆盖 Node 20，但 jsdom 需 22.13+、`@sparticuz/chromium` 需 22.17+，装依赖就挂）。`.nvmrc` 22→24，CI 三个 job 统一 24。

### 2.6 P2-7 .env 去重 + 默认值入码

- 删 `.env` 里重复的 `VITE_USE_MOCK`（原第 8、13 行）
- `createToolNavItems.ts`：`=== 'true'` → `!== 'false'`，默认开启
- `.env.example` 改为全注释 + 说明默认值，避免复制后覆盖代码默认

---

## 三、修 lint 时暴露的 3 个真实 bug（计划外）

`as any` 的作用就是把类型错误藏起来，而**类型错误常常就是逻辑错误**。这不是计划内的，但属必然产出：

| Bug | 位置 | 说明 |
|---|---|---|
| **turf v7 `intersect` 传两个参数** | `geoDataService.ts:735` | turf v7 只接受一个 `FeatureCollection`；旧代码传两个，且按 Turf 6 的"返回带 features 的集合"判空 → **面/面相交面积恒为 0** |
| `L.latLngBounds()` 传两个 bounds | `KmlViewerPage.vue:626,633` | 两个参数都被当 `LatLngExpression`，bounds 构造错误 |
| leaflet `TileLayer.extend()` 构造签名 | `KmlViewerPage.vue:468` | 返回类型推断不出构造签名；腾讯瓦片 Y 翻转层改为"实例化后覆写 `getTileUrl`" |

---

## 四、做得不顺的一处（记录决策过程）

`KmlTreeNodeData.leafletLayer` 原本是 `any`。第一反应改成 `L.Layer`，但跨 `.vue` 传 props 报 `Property '_map' is missing`——`@types/leaflet` 的 `Layer` 是带 `protected _map` 的 class，TS 按名义子类型检查。

中间又试过改成宽松结构类型 `{addTo, remove, removeFrom, getPane}`，结果 `map.addLayer()` 报出**更多**错。

**最终方案**：types.ts 声明「实际用到的接口子集」（`LeafletLayerLike`），在 KmlViewerPage 里用 `asLeafletLayer()` 集中收窄。若一开始就查 leaflet 的 d.ts 是 class，可以少走两步弯路。

---

## 五、两个提交为什么拆开

全仓格式化涉及 **99 files / +29294 / −978 行**。若与逻辑改动混在一个提交，`git log -p` 完全不可读。

分离方法（可复现）：

1. 备份当前所有改动文件
2. `git checkout --` 还原到 HEAD
3. 重新跑 `prettier --write .`
4. 比对「备份版本」与「重新格式化版本」的 MD5 → 一致即纯格式化

结果：**99 个纯格式化 + 39 个含逻辑改动**，分两个提交。

---

## 六、验证与反证

| 验证项 | 方法 | 结果 |
|---|---|---|
| **P2-2 门禁真的会卡** | 注入 `const __gate_test: number = 'deliberate type error'` 到 `logger.ts`，跑 `npm run build` | ✅ **exit 1**，在 type-check 阶段中止，未进入构建 |
| **P2-4 不依赖 `.env`** | `Move-Item .env .env.bak` 后 `npx vitest run` | ✅ 539 passed（已恢复） |
| **P2-7 默认值方向** | 无 `.env` 时 `npm run build`，检查 dist | ✅ 「势」tab 存在 |
| **P2-3 无行为变化** | 全量 vitest + playwright | ✅ 539 passed / 6 passed / 1 flaky |
| 提交分离正确 | MD5 比对（见 §5） | ✅ 99 + 39 |

---

## 七、环境备注

- **lefthook 未安装**：提交时提示 `Can't find lefthook in PATH`。仓库配了 git hook 但本机没装，钩子未生效——需确认这是否符合预期。
- **e2e 本地 dev server 仍报 `EPERM rename node_modules/.vite/deps`**：`F:\PPT\...` 路径被安全软件/同步客户端拦截 rename。评估 e2e 请用 `CI=true`（走 preview server，已验证 6 passed）。
- **`.env` 已改为全注释**：本地若此前依赖它开启「势」tab，现在默认即开。

---

*上一份：[阶段 0 执行记录](./2026-10-10-stage0-fix-record.md) · 回到：[审查总览](./2026-10-09-audit-00-summary.md)*
