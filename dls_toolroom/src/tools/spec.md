# Tools 开发规范与架构范式

## 零、核心范式：浏览器端纯 JS 计算

**所有工具全部在浏览器端完成数据处理和 API 请求，无任何后端服务。**

```
用户浏览器
    ├── 读取本地文件 (FileReader API)
    ├── 数据解析与验证 (xlsx / papaparse / shpjs / DOMParser)
    ├── 业务计算 (turf / proj4 / gcoord / exceljs / jsqr / qrcode)
    ├── 调用外部 API (fetch / axios → 高德 / Open-Meteo / USGS / GDACS)
    └── 生成输出文件 (Blob + URL.createObjectURL → 浏览器下载)
```

**这一范式的核心优势：零服务端成本，`npm run build` 产出纯静态文件，部署到任意静态托管即可全球分发。** 无需服务器运维、无需 API 代理、无需处理并发请求——所有计算由用户的浏览器承担。

---

## 一、工具模式分类

经过对全部 22 个工具 Page.vue 的分析，所有工具可归为三种模式：

### 模式 A：File-in → File-out（文件处理）

**流程**：用户上传文件 → 读取解析 → 业务处理 → 生成输出 → 浏览器下载

| 环节 | 负责模块 | 示例 |
|------|---------|------|
| 文件读取 | `TemplateReader.ts` / `FileReader` API | `readAndValidateKmlTemplate()` |
| 数据解析 | `xlsx` / `papaparse` / `shpjs` / `jszip` | 解析 XLSX、CSV、SHP、KMZ |
| 业务处理 | `*Generator.ts` / `*Exporter.ts` | `KmlGenerator`、`GisToExcelExporter` |
| 文件下载 | `Blob` + `URL.createObjectURL` + `<a download>` | 触发浏览器原生下载 |

**适配工具**：table2kml_point, table2kml_basestation, gis2excel, shp2excel, shp2kml, distance_sensor, elevations_batch, docx_template_export, xlsx_template_export, template_export

### 模式 B：Form → API → Display（查询展示）

**流程**：用户输入参数 → 调用外部 API → 解析响应 → 表格/图表展示 → 可选导出 JSON

| 环节 | 负责模块 | 示例 |
|------|---------|------|
| 参数输入 | Page.vue 中的表单控件 | 日期、经纬度、震级、气象变量 |
| API 调用 | `*Service.ts` / `*ApiService.ts` | `fetchEarthquakeData()`、`weatherHistoryService` |
| 数据展示 | 表格 + 统计卡片 + `ECharts` 图表 | 震级分布散点图、温度折线图 |
| 结果导出 | `downloadJson()` / `Blob` | JSON 格式下载 |

**适配工具**：earthquake_query, weather_history, gdacs, elevation_query, elevations_convert, get_add, get_lonlat

### 模式 C：Input → Real-time Transform（交互转换）

**流程**：用户输入 → 实时计算 → 即时展示结果 → 可选复制/下载

| 环节 | 负责模块 | 示例 |
|------|---------|------|
| 实时触发 | `watchEffect` / `watch` / `computed` | 无需点击按钮，输入即响应 |
| 核心计算 | 纯函数模块 | `coordConversion.ts`、`qrcode` / `jsqr` |
| 结果展示 | 输出面板 / Canvas / 图片 | 坐标卡片、二维码图片 |

**适配工具**：coord_convert, coords_convert, qrcode, geo_data, kml_viewer, gantt_chart

---

## 二、目录结构规范

```
src/tools/{tool_id}/
├── {Name}Page.vue           # [必需] 页面入口，统一从 toolData.ts 获取标题和描述
├── {name}Service.ts         # [B 模式] 外部 API 封装
├── {name}Chart.ts           # [B 模式] ECharts 图表配置
├── {Name}Generator.ts       # [A 模式] 输出文件生成器
├── TemplateReader.ts        # [A 模式] 文件读取与验证
├── TemplateExporter.ts      # [A 模式] 模板导出
├── {Name}Validator.ts       # [A 模式] 文件格式校验
├── SubComponent.vue         # [按需] 工具内部子组件
├── use{Name}.ts             # [按需] Composable 逻辑封装
└── types.ts                 # [按需] 类型定义
```

**Page.vue 统一模板**：
```vue
<template>
  <div class="p-6">
    <h1 class="text-3xl font-bold mb-6">{{ toolConfig?.name || '默认名称' }}</h1>
    <p class="text-base-content/70 mb-6">{{ toolConfig?.description || '默认描述' }}</p>
    <!-- 工具核心逻辑 -->
  </div>
</template>

<script setup lang="ts">
import { getToolById } from '@/tools/toolData'
const toolConfig = getToolById('tool_id')
// 业务逻辑
</script>
```

---

## 三、配置驱动注册

所有工具在 `toolData.ts` 中声明式注册，无需修改路由或布局：

```typescript
interface ToolConfig {
  id: string            // 对应路由 /tools/:toolId
  name: string          // Page.vue 的 h1 标题
  description: string   // Page.vue 的 p 描述
  icon: Component       // Phosphor 图标
  tags: string[]        // 搜索关键词
  docTypes?: string[]   // 道法术器文档类型
}
```

`ToolDetailView.vue` 通过 `import.meta.glob` 自动发现所有 Page 组件，按 `toolId` 做懒加载映射。新增工具只需三步：创建目录和 Page.vue → `toolData.ts` 添加配置 → `public/docs/{toolId}/` 添加文档。

---

## 四、共享基础设施

### Composables（`src/composables/`）
| 模块 | 用途 |
|------|------|
| `useECharts.ts` | ECharts 生命周期（init / theme 联动 / dispose），统一管理所有图表 |
| `useDaisyTheme.ts` | 提取 daisyUI 主题 CSS 变量（OKLCH），供 ECharts 响应主题切换 |

### 通用工具函数（`src/utils/`）
| 模块 | 用途 | 使用者 |
|------|------|--------|
| `TemplateExporter.ts` | CSV/XLSX 生成与下载 | A 模式工具 |
| `TemplateReader.ts` | XLSX/CSV 文件读取解析 | A 模式工具 |
| `coordinateConverter.ts` | gcoord + proj4 坐标转换封装 | coord_convert, coords_convert |
| `amapService.ts` | 高德 API Key 验证 + 提供商抽象 | get_add, get_lonlat |
| `GeocodeBatchService.ts` | 批量地理编码延迟/重试/进度 | get_add, get_lonlat |
| `colorUtils.ts` | OKLCH ↔ HEX 颜色转换 | ECharts 图表工具 |
| `logger.ts` | 统一日志（生产环境静默） | 全局 |

---

## 五、给 AI 的创建新工具指南

按以下模板严格执行，确保新工具风格一致：

1. **读 `toolData.ts`**，确认没有重复的 `id`
2. **确定模式**（A / B / C），在 `src/tools/{tool_id}/` 下创建对应文件
3. **Page.vue** 必须：顶部 `h1` + `p` 从 `getToolById(id)` 获取，剩余部分按模式填充
4. **不要在 Page.vue 里写独立样式**——全部用 Tailwind 工具类
5. **外部 API 调用**统一封装在 `*Service.ts` 中，Page.vue 只调用、不写请求细节
6. **文件下载**统一用 `Blob` + `URL.createObjectURL`，不另起方案
7. **图表**用 `useECharts` composable，图表配置抽到 `*Chart.ts`
8. **在 `toolData.ts` 中添加配置**，选好 Phosphor 图标
9. **在 `public/docs/{tool_id}/` 创建道法术器四个 md 文件**
10. **不要修改 `ToolDetailView.vue`**——`import.meta.glob` 会自动发现新 Page
