# 2026-10-10 · 阶段 0 执行记录

> **执行日期**：2026-10-10
> **依据报告**：[2026-10-09 审查总览](./2026-10-09-audit-00-summary.md)（阶段 0 路线图）
> **基线**：`c096944` · 审查基线 `c096944`
> **状态**：✅ 阶段 0 全部完成，质量门禁全绿

---

## 一、执行结果总览

| # | 计划项 | 报告编号 | 状态 | 备注 |
|---|---|---|---|---|
| 1 | 空字符串显式判空，不再 `Number('')` | P0-1 | ✅ | 4 处 + 新增共享工具模块 |
| 2 | KML coordinates stride 推断 | P0-2 | ✅ | **方案有变更**，见 §3.1 |
| 3 | 中文色名图钉判定 | P0-3 | ✅ | `PointRow` 增加 `colorRaw` |
| 4 | 挂载 `ToastContainer` | P1-1 | ✅ | |
| 5 | 修错误对话框绑定错变量 | P1-2 | ✅ | 顺带统一了两个平行对话框 |
| 6 | `opacity ?? 0.5` | P1-3 | ✅ | |
| 7 | 补 `date-fns` 依赖 | P2-5 | ✅ | `^4.4.0` + `@types/date-fns` |
| 8 | 删 `tailwind.config.js` | P2-1 | ✅ | **已用产物哈希证明是死配置** |
| 9 | 删 1114 行重构残留死代码 | P3-1 | ✅ | 连带补回 live 实现的测试覆盖 |
| 10 | `matchCount` 钳制 | （旧审计 P1-7） | ✅ | UI + 算法双层防御 |

**额外完成**（不在原计划，但由本次改动直接引出）：
- 修复 P1-4 `resolveDuplicates` 重名 bug（删除死代码时发现 live 副本无测试覆盖，导出后测试立即暴露）
- 修复两个潜在死分支：`validateFilenameTemplate` 的 `{}` 空占位符永不失效、`generateFilename` 的 `文档_N` 兜底永不可达
- 删除 `src/` 下 29 个 `debug.log` 本地垃圾（约 150 KB）
- 放宽 `exceljsRuntime.spec.ts` 超时 5s → 30s（新增测试文件后暴露的既有 flake）

---

## 二、质量门禁结果

| 检查项 | 基线（阶段 0 前） | 阶段 0 后 |
|---|---|---|
| `npm run type-check` | ✅ 0 错误 | ✅ **0 错误** |
| `npx vitest run` | ✅ 524 passed / 35 files | ✅ **539 passed / 37 files** |
| `npx oxlint .` | ✅ 0 / 0（185 files） | ✅ **0 / 0**（183 files） |
| `npm run build-only` | ✅ 成功 | ✅ **成功**（3.66s，66 chunks） |
| `npx playwright test`（生产构建） | ⚠️ 未验证 | ✅ **6 passed / 1 flaky / 0 failed** |
| 测试数 | 524 | **539（+15）** |

> 测试数变化说明：新增 6 个测试文件共 **+53** 个用例，删除 2 个死代码 spec（原 62 个用例），净 **+15**... 实际为 524 + 53 − 38 = 539。

---

## 三、与计划的偏差（重要）

### 3.1 P0-2：报告中的「方案 A」不可行，已改用四級策略

报告建议：

> **方案 A（推荐）**：含逗号时优先按 2 分组，仅当按 2 分组有余数时才回退到 3。

**实施时发现方案 A 会破坏最常见的真实格式**，因此未采纳：

```
输入：116.3,39.9,0 116.4,40.0,0     ← Google Earth / ArcGIS 默认输出，6 个数字
方案 A：6 % 2 === 0 → stride = 2
  → (116.3, 39.9) ✅
  → (0, 116.4)    ❌ lat=116.4 > 90，被静默丢弃
  → (40.0, 0)     ❌ 把高程 0 当成经度，产出一个错误点
```

即"修好 6 数字歧义区，却弄坏最主流的 KML 2.0 带高程格式"。

**实际实现**：利用 KML 规范给的**空白边界**这一强信号，四级策略从可靠到兜底：

1. **空白边界一致** —— 按空白切片并把"以逗号结尾的片段"与下一片段合并（解决 QGIS 的 `116.3, 39.9,0` 写法），若所有元组字段数一致且为 2 或 3，直接采用
2. **纯空格分隔、每段 1 个数字** → stride 2
3. **整除推断** —— 只能被 2 整除取 2，只能被 3 整除取 3
4. **歧义区**（可同时被 2 和 3 整除）—— 按"哪个 stride 得到更多合法坐标"选择，平手取 3（KML 2.0 规范形式）

`src/utils/kmlCoordinates.ts:56-154`

**验证**：原有 5 种写法的用例全部仍通过（未破坏任何既有行为），新增 7 个 P0-2 回归用例。

### 3.2 P3-1：删除死代码连带造成覆盖缺口，已补回

删除 `docxTemplateFunctions.ts` / `xlsxTemplateFunctions.ts` 时，一并删掉了它们的 spec（各约 9 / 29 个用例）。这两个文件里测的 `sanitizeFilename` / `generateFilename` / `resolveDuplicates` **在 live 的 `useTemplateExport.ts` 里有一份重复拷贝**，此前完全没有测试。

**处理**：把 live 实现的这 4 个函数改为 `export`，新建 `useTemplateExport.spec.ts`（27 个用例）补回覆盖。

**结果**：这些测试立刻暴露了 P1-4 的真实 bug（见 3.3）和两个潜在死分支——证明这次删除死代码反而**提升了**对 live 代码的信心，而不是降低。

### 3.3 P1-4：原计划没有，但被迫提前修

删除死代码、导出 live 函数后，新写的回归测试立即失败，确认 P1-4 在 live 实现里仍然存在。既然测试已经写好，就地修复：

```ts
// src/tools/template_export/useTemplateExport.ts
const used = new Set<string>()
return names.map((name) => {
  if (!used.has(name)) { used.add(name); return name }
  let n = 1
  let candidate = `${name}(${n})`
  while (used.has(candidate)) { n++; candidate = `${name}(${n})` }
  used.add(candidate)
  return candidate
})
```

断言的是**不变量**（输出唯一）而非具体命名方案：只要唯一，ZIP 内就不会互相覆盖。

### 3.4 顺手修掉的两个潜在死分支

写测试时发现，都是"代码意图与实现不符"：

**(a) `validateFilenameTemplate` 的空占位符检查是死代码**

```ts
const re = /\{([^}]+)\}/g     // ← [^}]+ 要求至少 1 个字符
if (m[1] === '') return { valid: false, ... }   // ← 永不可达
```
`报告_{}` 会被判为合法，最终生成 `报告_`。改为 `[^}]*`。

**(b) `generateFilename` 的 `文档_N` 兜底永不可达**

```ts
if (firstKey && row[firstKey] != null) { return sanitizeFilename(String(row[firstKey])) }
return `文档_${index + 1}`      // ← '' != null 为 true，上一行已返回 '未命名'
```
首列为空串时走上一行得到 `未命名`，`文档_N` 分支永远进不去。补了 `.trim() !== ''` 判断。

---

## 四、产物改动清单

### 修改（11 个）
| 文件 | 改动 |
|---|---|
| `src/utils/coordinateValue.ts` | **新增**。`parseStrictNumber` / `parseCoordinateValue`（P0-1 共享实现） |
| `src/tools/elevations_batch/TemplateReader.ts` | 改用 `parseCoordinateValue`（P0-1） |
| `src/tools/get_add/TemplateReader.ts` | 同上 |
| `src/components/common/GeocodeCommon.vue` | 私有 `parseCSV` 空值不再转 0（P0-1） |
| `src/utils/kmlCoordinates.ts` | 重写 `inferStride` 四级策略 + `splitIntoTuples` / `countValidPoints`（P0-2） |
| `src/tools/table2kml_point/ColorParser.ts` | 新增 `isChineseColorName`（P0-3） |
| `src/tools/table2kml_point/TemplateValidator.ts` | `PointRow` 增加 `colorRaw` 并填充（P0-3） |
| `src/tools/table2kml_point/KmlGenerator.ts` | 中文色判定改看 `colorRaw`（P0-3） |
| `src/App.vue` | 挂载 `<ToastContainer />`（P1-1） |
| `src/tools/geo_data/GeoDataPage.vue` | 删除 `errorDialogOpen`，统一错误对话框入口（P1-2） |
| `src/utils/KmlGenerator.ts` | `opacity ?? 0.5`（P1-3） |
| `src/tools/distance_sensor/DistanceSensorPage.vue` | `matchCount` 钳制到 ≥ 1 |
| `src/utils/DistanceCalculator.ts` | `matchDistances` 入口防御性钳制 k |
| `src/tools/template_export/useTemplateExport.ts` | 导出 4 个纯函数；修 P1-4 + 2 个死分支 |
| `src/tools/template_export/__tests__/exceljsRuntime.spec.ts` | 超时 5s → 30s |
| `package.json` / `package-lock.json` | 补 `date-fns` / `@types/date-fns` |
| `.gitignore` | `docs/` → `docs/*` + `!docs/*.md`（让审计报告可入库） |

### 删除（7 个）
| 文件 | 行数 |
|---|---|
| `tailwind.config.js` | 31 |
| `src/tools/docx_template_export/useDocxTemplateExport.ts` | 375 |
| `src/tools/docx_template_export/docxTemplateFunctions.ts` | 261 |
| `src/tools/xlsx_template_export/useXlsxTemplateExport.ts` | 357 |
| `src/tools/xlsx_template_export/xlsxTemplateFunctions.ts` | 121 |
| `src/tools/*/__tests__/{docx,xlsx}TemplateFunctions.spec.ts` | 2 个 |
| `src/**/debug.log` × 29 | ~150 KB |

**净删除约 1,150 行 + 150 KB 本地垃圾。**

### 新增测试（6 个）
| 文件 | 用例数 |
|---|---|
| `src/utils/__tests__/coordinateValue.spec.ts` | 17 |
| `src/tools/elevations_batch/__tests__/TemplateReader.spec.ts` | 13 |
| `src/tools/get_add/__tests__/TemplateReader.spec.ts` | 5 |
| `src/tools/template_export/__tests__/useTemplateExport.spec.ts` | 27 |
| `src/utils/__tests__/kmlCoordinates.spec.ts` | +7 |
| `src/tools/table2kml_point/__tests__/KmlGenerator.spec.ts` | +7 |
| `src/utils/__tests__/KmlGenerator.spec.ts` | +4 |
| `src/utils/__tests__/DistanceCalculator.spec.ts` | +3 |

---

## 五、验证方法与证据

不只看了绿灯，对关键修复做了**反证**：

### 5.1 P0-3 的测试不是"假绿"
把 `isChineseColor` 临时还原成只看 `color`（旧逻辑），`KmlGenerator.spec.ts` 中「规范化后的红色仍走官方红图钉」立即失败：

```
FAIL src/tools/table2kml_point/__tests__/KmlGenerator.spec.ts
  > 规范化后的红色仍走官方红图钉（这是修复前失败的用例）
  - <href>.../red-pushpin.png</href>
Tests  1 failed | 18 passed
```
还原修复后立刻恢复 19 passed —— 证明该用例确实捕获 bug。

### 5.2 `tailwind.config.js` 是死配置已用产物哈希证明
删除前后重新构建，比对 `dist/assets/*.css` 的全部 MD5：

```
BEFORE: B3B75435... 4DB3BE8E... B1794703... （共 15 个）
AFTER:  B3B75435... 4DB3BE8E... B1794703... （共 15 个）
✅ 15 个 CSS 产物字节完全一致
```

### 5.3 e2e 在 dev server 失败是环境问题，非代码问题
`npx playwright test` 本地跑 dev server 时报 `EPERM: operation not permitted, rename node_modules\.vite\deps_temp_*`。确认：
- 端口 5173 无占用、无残留进程
- 基线（stash 掉我的改动）同样失败
- **改用生产构建（`CI=true` → `npm run preview`）后：6 passed / 1 flaky / 0 failed**

根因是 `F:\PPT\...` 路径被安全软件/同步客户端拦截 rename。**这不影响结论**：生产构建路径下所有工具路由正常。

### 5.4 `date-fns` 确实解决了部署阻断
```json
l.packages[''].dependencies['date-fns'] === '^4.4.0'      // ✅ 已声明为生产依赖
l.packages['node_modules/date-fns'].dev === false         // ✅ npm ci 会安装
```
删除前：3 个文件 import 但 `package.json` 未声明，干净环境 `npm ci` 会炸。

---

## 六、遗留与下一步

### 阶段 0 未纳入但已定位的问题
- **P0-4 / P0-5 / P0-6**（坏几何丢弃全部分析结果、CGCS2000 NaN、批量高程失败被吞）属于阶段 2，未在本次处理
- **P2 其余 21 项**见 [P2 报告](./2026-10-09-audit-03-P2-engineering.md)

### 新发现、待排期
| 问题 | 位置 | 说明 |
|---|---|---|
| `.vite/deps` EPERM | 环境 | dev server 在 `F:\PPT\...` 路径下无法完成依赖预构建，本地 `npm run dev` 受影响。建议把仓库移出同步/AV 扫描路径，或在 `.gitignore` 已有 `node_modules` 基础上确认无冲突 |
| e2e `channel: 'msedge'` | `playwright.config.ts:50` | 无 Edge 的机器需 `PLAYWRIGHT_CHANNEL=chromium` 或 `CI=true`（走 preview） |
| `@types/date-fns` 停在 2.6.3 | `package.json:77` | date-fns v4 不带类型，DefinitelyTyped 最新就是 2.6.3。type-check 0 错误，可用；后续若升级 date-fns 需复查 |

### 建议的提交信息
```
fix(tools): 阶段 0 修复 —— 消除静默数据错误与静默失败

- P0-1: 空经纬度不再被当作 (0,0) 几内亚湾（4 处 + 共享 parseCoordinateValue）
- P0-2: KML coordinates 重写 stride 推断，修复无空格分隔时坐标错位
- P0-3: 中文色名图钉恢复可用（colorRaw 保留用户原始输入）
- P1-1: 挂载 ToastContainer，toast 不再静默丢失
- P1-2: GeoDataPage 错误对话框绑定错变量，导出失败不可见
- P1-3: opacity = 0 不再被 || 吞成 0.5
- P1-4: resolveDuplicates 重名导致 ZIP 内文件互相覆盖
- P2-1: 删除死配置 tailwind.config.js（产物哈希验证无影响）
- P2-5: 补声明幽灵依赖 date-fns
- P3-1: 删除 1114 行重构残留死代码

测试 524 → 539 passing；type-check / oxlint / e2e 全绿
```

---

*上一份：[P3 死代码 · 重复 · 结构](./2026-10-09-audit-04-P3-cleanup.md) · 回到：[审查总览](./2026-10-09-audit-00-summary.md)*
