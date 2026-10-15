# 2026-10-15 · D2 收敛命名模板与花括号校验 · 实施记录

> **依据**：审计 [`2026-10-09-audit-04-P3-cleanup.md`](./2026-10-09-audit-04-P3-cleanup.md) 的 **P3-4**（文件名模板 5 份 / 花括号校验 4 份 / `sanitizeFilename` 3 份）
> **台账**：[`../plan/2026-10-11-progress-ledger.md`](../plan/2026-10-11-progress-ledger.md) **D 档 D2**
> **前置**：D3（`75fda16`）、D1（`cafc56d` + `d606716`）已完成
> **提交**：`fce7aec`
> **规模**：src **242 insertions / 157 deletions（净 +85 行，含 41 条测试）**，测试 **756 → 766**

---

## 一、动手前先核对：审计的「5 + 4 + 3」已过期

审计基线 `c096944` 时，docx/xlsx 两个死代码副本还各自有一份。阶段 0 删掉那 4 个文件后，实际剩余：

| 关注点 | 审计写 | 实际 | 文件 |
|---|---|---|---|
| 模板渲染 | 5 份 | **3 份** | `ShpToKmlGenerator.ts:65`、`Shp2KmlPage.vue:758`、`useTemplateExport.ts:252`（渲染+sanitize+兜底） |
| 花括号校验 | 4 份 | **2 份** | `useTemplateExport.ts:228`、`Shp2KmlPage.vue:736` |
| `sanitizeFilename` | 3 份 | **1 份** ✅ | `useTemplateExport.ts:219`（阶段 0 已因删死代码而唯一） |
| `resolveDuplicates` | 3 份 | **1 份** ✅ | `useTemplateExport.ts:276` |

**其中 `ShpToKmlGenerator.ts` 与 `Shp2KmlPage.vue` 的那份是同一个函数的两份拷贝**（审计已逐行比对）：页面用前者做实时预览、生成器用后者出文件 → 预览与下载可能不一致。

---

## 二、改动

### 1. 新增 `src/utils/filenameTemplate.ts`（147 行）

| 导出 | 职责 |
|---|---|
| `sanitizeFilename` | Windows 非法字符 → `-`，压缩空白，空结果回退「未命名」 |
| `validateFilenameTemplate` | 花括号配平 + 字段名合法（`[^}]*` 口径，见 §三） |
| `renderNameTemplate` | **渲染内核**：`{field}` → context 值，缺失/ null 替换为空串 |
| `generateNameFromTemplate` | shp2kml 要素名：无模板返回 name，否则以 `{ name, ...properties }` 渲染 |
| `generateFilename` | template_export 文件名：首列取值 / `文档_N` 兜底 + 渲染后清理非法字符 |
| `resolveDuplicates` | 以「已产出最终名」为集合去重（P1-4 修复的形态） |

`generateFilename` 与 `generateNameFromTemplate` 的差异是**刻意保留**的，不是漏收敛：

- 文件名要清理非法字符、要有空值兜底；
- KML 要素名**不能**清理（原始属性要进 XML，由 `escapeXml` 转义），无模板时原样返回。

两者共用同一个 `renderNameTemplate`，正则只有一份。

### 2. `useTemplateExport.ts`（−103 行）

四个函数改为从共用模块 `import` + `export`（**不能只写 `export ... from`**——本次实测：那样函数名不在模块作用域内，文件内部 5 处调用直接 `TS2304: Cannot find name`）。既有 import 面与 spec 不变。

### 3. `Shp2KmlPage.vue`（−46 行）与 `ShpToKmlGenerator.ts`（−20 行）

删掉本地两份拷贝，改引共用模块：页面用 `validateFilenameTemplate` 做实时校验、`generateNameFromTemplate` 做预览，生成器用同一个 `generateNameFromTemplate` 写文件。

---

## 三、收敛顺带修掉的两个问题

### 1. shp2kml 的空占位符校验是死分支（`{}` 能通过）

`Shp2KmlPage.validateNameTemplate` 的正则用 `[^}]+` 匹配占位符内容，导致 `{}` **匹配不上**，于是「存在空的 {} 占位符」分支永远是死代码——用户在命名模板里写 `报告_{}` 会通过校验并生成 `报告_`。

阶段 0 已在 `useTemplateExport` 那侧改掉（`[^}]*`），但**拷贝到 shp2kml 的那份没跟着改**——正是「同一逻辑复制 N 份，修一处漏一处」的现场。收敛后两边共享 `[^}]*` 口径，shp2kml 同时获得修复，并有专项用例钉住：

```ts
it('空占位符 {} 现在会被 shp2kml 的同一份校验拒绝（收敛前被放过）', ...)
```

### 2. 删掉一处不可达分支

`Shp2KmlPage.validateNameTemplate` 里循环之后还有一次 `if (depth < 0) return { ... '花括号不匹配' }`——`depth < 0` 在循环内已当场返回，循环后不可能再成立。共用实现没有这个分支。

### 3. 记录一个既有语义（**未改**）

`generateNameFromTemplate` 的 context 构造成 `{ name, ...properties }`，因此**属性表里的 `name` 列会覆盖显式传入的 name**。两份旧拷贝行为一致，属长期语义；本次只加了一条用例把它钉住并注明「勿莫名改动」。若产品认为「显式 name 应优先」，需要单独立项（会改变预览与导出两端）。

---

## 四、测试

| 检查 | 结果 |
|---|---|
| `npm run type-check` | ✅ 0 错误 |
| `npx vitest run` | ✅ **766 passed / 54 files**（756 → 766，+10） |
| `npx oxlint .` / `npx eslint .` | ✅ 0 / 0 |
| `npx prettier --check --experimental-cli .` | ✅ 全符合 |
| `npm run build` | ✅ 26 路由预渲染 |
| `CI=true npx playwright test` | ✅ **7 passed / 1 flaky**（与基线同一项） |

### 用例迁移

`template_export/__tests__/useTemplateExport.spec.ts` 的 21 条用例**整文件搬空**（该 spec 只测这 4 个函数，`normalizeSkipRows` 另有 `skipRows.spec.ts`），搬到 `utils/__tests__/filenameTemplate.spec.ts` 并与实现同处；新 spec 共 **31 条**：

| 来源 | 条数 |
|---|---|
| 原 spec 迁移（sanitize 4 / 校验 5 / generateFilename 5 / resolveDuplicates 7） | 21 |
| shp2kml `generateNameFromTemplate`（此前**零** reader 级用例）：无模板/渲染/缺失字段/不清理非法字符/name 覆盖语义 | 5 |
| shp2kml 收敛修复：`{}` 被拒、报错文案一致 | 2 |
| `renderNameTemplate`：空模板/空串/null·undefined/数值 0 | 3 |

### ⚠ 一次危险的假绿，被测试计数当场抓住

搬完用例后全量跑出 **745 passed**（比上一批 756 少 11）。逐条核对发现：**新写的 spec 文件头注释没有闭合**（`/**` 之后漏了 `*/`），从第 22 行到后面的第一个 `*/` 全被当成注释——**迁移过来的 21 条用例一条都没跑，而 vitest 全绿**。

这类失败和审计反复强调的「绿灯来自于没测」是同一类：测试数不降反升时最容易漏。**触发条件是「文件数不变、用例数应该变」**，本次因为同时删了一个 spec、加了一个 spec，被 745 vs 预期的 766 抓了个正着。

> 教训：**搬运用例后必须核对用例总数**（而不是只看绿）。文件头注释未闭合会让整段代码静默失效。

---

## 五、与审计预估的偏差

| 项 | 审计预估 | 实际 |
|---|---|---|
| 删除行数 | −400 | src **净 +85 行** |
| 原因 | 以为要删 5+4 份 | 阶段 0 已删掉 4 份死副本；且把三处实现合成一份后，把原本零覆盖的 shp2kml 补了 10 条用例、`renderNameTemplate` 等新增 API 有文档注释 |

**行数不降反升是预期的**：本项的目标从来不是「行数」，而是「同一逻辑只有一份实现」——三个关注点各自的 grep 命中从 3/2/1 收敛到 **1/1/1**（`escapeXml` 仍是 2 份，见下）。

## 六、遗留

- `escapeXml` 仍有 **2 份逐字节相同**的拷贝（`table2kml_point/KmlGenerator.ts:97`、`shp2kml/ShpToKmlGenerator.ts:45`）。审计 P3-4 建议它与 `downloadBlob` / `hexToKmlColor` / `toKmlCoordinatesString` 一起抽 `utils/kmlShared.ts`——那是一个新模块、影响 3 个 KML 工具，**未纳入 D2**，建议单独立项。
- `GanttChartPage.vue` / `KmlViewerPage.vue` / `GeocodeCommon.vue` 三个超大文件仍是 **D4**。

---

*上一份记录：[`2026-10-15-d1-fix-record.md`](./2026-10-15-d1-fix-record.md) · 回到：[审计总览](./2026-10-09-audit-00-summary.md)*
