# 2026-11-09 · F1 / F2 / D4-e2e / D5 修复记录

> **依据**：[`../plan/2026-10-11-progress-ledger.md`](../plan/2026-10-11-progress-ledger.md)
> **提交**：
> - F2 `28f7196`
> - F1 `cfee896`
> - D4 e2e `e8554ff`
> - D5 分支 `feat/sizing-sheet-tools` `8ce26e1`（待合并）
> **状态**：F1 ✅ / F2 ✅ / D4 e2e ✅ / D5 ✅（分支）

---

## 一、F2 · xlsx 导出边框

### 决策

旧实现本来就想给导出加边框，只是 xlsx@0.18.5 把单元格样式整体丢弃。迁到 exceljs 后边框能真正落盘，但 5 万行 × 9 列实测总耗时 +50%（1987ms → 2967ms）。

最终策略：

- **≤ 20000 行：默认带边框**（绝大多数导出）；
- **> 20000 行：自动关闭边框**（保护大表性能）；
- 调用方仍可显式传 `border: true/false` 覆盖。

### 改动

- `utils/exceljsCore.ts`：新增 `BORDER_AUTO_ROW_LIMIT = 20_000` 与 `autoBorder(rowCount)`。
- `utils/exceljsPipeline.ts`：重新导出。
- `utils/TemplateExporter.ts`：`generateXlsx` 按行数传 `border`。
- `tools/gis2excel/GisToExcelExporter.ts`：`toSheetSpec` 按要素数传 `border`。

### 测试

- `autoBorder` 阈值用例；
- `TemplateExporter` 用 exceljs 读回断言小表 `A1` / `B2` 有 thin 边框；
- `GisToExcelExporter` 小表断言点/线/面三张表都有边框，旧 xlsx 实现仍为 0。

---

## 二、F1 · CSP `worker-src 'self'`

### 改动

- `vercel.json`：全局 `Content-Security-Policy`，包含 `worker-src 'self'`；
- `deploy/nginx/snippets/dls_security_headers.conf`：nginx 版 CSP；
- `deploy/README.md`：说明在 443 `server {}` 内 include，以及为什么 `script-src` 需要 `'unsafe-inline'`（首屏主题脚本/JSON-LD）与 `hm.baidu.com`（百度统计）。

策略允许：

- 同源脚本/样式/Worker；
- 首屏内联脚本（`'unsafe-inline'`）；
- 百度统计 `hm.baidu.com`；
- 外部地图/API（`https:`）；
- `blob:` / `data:` 图片与下载。

### 测试

新增 `deployCsp.spec.ts`：读取 `vercel.json` 与 nginx snippet，断言包含 `worker-src 'self'`。

### 仍需部署侧确认

仓库只能保证配置正确；线上是否真正下发该响应头，需要部署后 `curl -I https://<site>` 确认（见 `deploy/README.md`）。

---

## 三、D4 e2e · KML 查看器与 Geocode

### KML 查看器

`e2e/kml-viewer.spec.ts` + fixture：

- 上传 KML；
- 图层树显示 Folder / 两个 Placemark；
- 全部隐藏 / 全部显示；
- 测距：地图点两个点后出现「长度:」；
- 采点：点地图后出现「采集坐标 (WGS84)」。

### Geocode

`e2e/geocode-import.spec.ts` + fixtures：

- `get_add` CSV 导入 → 验证通过 2 条；
- 清除上传；
- XLSX 导入 → 验证通过，并断言 `filePipeline.worker` 响应 200（F3 路径真实走 Worker）；
- `get_lonlat` CSV 地址模板导入 → 验证通过 2 条。

---

## 四、D5 · 拆分 SheetTemplatePage

> 位于 `feat/sizing-sheet-tools` 分支，提交 `8ce26e1`。

| 文件 | 行数 |
|---|---:|
| `SheetTemplatePage.vue` | 3484 → **1161** |
| `SheetTemplatePage.css` | 新增 1300（scoped `src`） |
| `useSheetEditor.ts` | 877 |
| `useSheetGrid.ts` | 416 |
| `useSheetExport.ts` | 189 |
| `useSheetStatus.ts` | 23 |
| `sheetTemplateUi.ts` | 94 |

拆分内容：

- 样式抽到 `SheetTemplatePage.css`，页面用 `<style scoped src>` 引用；
- 文档/历史/纸张/字体/字段/视图/快捷键/本地草稿 → `useSheetEditor`；
- 网格行列/合并拆分/自适应/归一化 → `useSheetGrid`；
- PNG/JSON/Schema/SVG/DXF 导出与 JSON 导入 → `useSheetExport`；
- 选项常量、模板缩略图/名称/描述 → `sheetTemplateUi`；
- 状态提示 → `useSheetStatus`。

新增 `e2e/sheet-template.spec.ts`：加载 → 专业模式 → 切 A3 → 导出 JSON。

### 验证

- 分支：type-check / oxlint / eslint / prettier / vitest **948 passed / 75 files** / `build-only` / Playwright 1 passed。
- master：type-check / vitest **887 passed / 72 files** / `build-only` / 新增 3 条 e2e passed。

---

## 五、剩余

- **E1**：`vercel.json` 裸 IP + HTTP（需 Vercel 控制台）；
- **E2 / E4**：确认后关闭；
- **F5**：togeojson 嵌套 MultiGeometry，等上游。
