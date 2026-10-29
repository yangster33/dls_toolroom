# 大龙山工具间 · DLS Toolroom

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

一个**纯前端数据处理平台**，也是一套可复用的**静态部署框架**：
数据处理全部在用户浏览器中完成，服务器只负责把静态资源分发出去。

不限定数据类型——表格、文档、地理数据、图形图像、结构化文本……只要浏览器能算，就能作为这套框架上的一个工具运行。

> 🔗 在线体验：<https://dlslab.cn>

---

## 这是什么

传统在线工具的工作方式通常是「上传文件 → 服务器处理 → 下载结果」。这意味着你的文件必须离开本机，服务器要承担解析、计算和存储的成本，还要面对并发、隐私与合规问题。

这个项目换了一条路线：

- **文件永远不离开浏览器**：读取、解析、计算、生成结果全部在本地完成；
- **服务器只做分发**：`npm run build` 产出的 `dist/` 是纯静态资源，扔到任意静态托管或 CDN 即可上线；
- **计算成本转移给客户端**：没有排队、没有并发上限，也没有需要运维的后端进程。

换句话说，它是一个「把计算放在端上、把分发交给静态托管」的部署框架。现有工具只是这套框架的落地样例，而非它的能力边界。

---

## 架构：静态分发 + 浏览器计算

```text
┌───────────────────────────── 用户浏览器 ──────────────────────────────┐
│                                                                      │
│   输入：文件 / 拖拽 / 表单 / 粘贴 / 接口返回                            │
│            │                                                         │
│            ▼                                                         │
│   解析：表格、文档、地理数据、图像、结构化文本                           │
│            │        （xlsx · papaparse · shpjs · jszip · DOMParser）  │
│            ▼                                                         │
│   计算：业务逻辑 + 领域库                                               │
│            │        （turf · proj4 · exceljs · docxtemplater · qrcode）│
│            ▼                                                         │
│   输出：结果文件 / 图表 / 图片 / 剪贴板                                 │
│                 （Blob + URL.createObjectURL → 浏览器原生下载）        │
│                                                                      │
└───────────▲──────────────────────────────────────┬───────────────────┘
            │                                      │
   一次性下载静态资源                      按需直连公开数据接口
   （HTML / JS / CSS / 字体）              （如 Open-Meteo / USGS / GDACS）
            │                                      │
   ┌────────┴─────────┐                            ▼
   │  静态托管 / CDN   │                    第三方公开数据服务
   │  dist/ 纯静态文件  │
   │  只分发字节       │  ← 不接收文件、不执行计算、不保存数据
   └──────────────────┘
```

### 三条边界

| 边界 | 约束 |
| --- | --- |
| 用户文件 | 只存在于浏览器内存与本地磁盘，任何环节都不上传 |
| 业务计算 | 由浏览器执行，可下沉到 Web Worker，主线程保持可交互 |
| 服务端 | 只做静态资源分发；可选提供匿名访问计数、评论等与文件无关的轻接口 |

### 为什么这样设计

- **隐私默认成立**：不是「承诺不存储」，而是结构上没有接收文件的通道；
- **成本随流量线性且极低**：静态文件交给 CDN，服务端不需要为每个用户准备算力；
- **没有并发瓶颈**：一万个用户同时跑批量任务，等价于一万个浏览器各算一次；
- **部署简单**：没有数据库、没有运行时、没有反向代理规则要维护；
- **可离线**：静态资源与前端逻辑可在断网环境下继续处理本地文件。

### 适合承载什么

框架与「地理空间」没有绑定关系，判断标准只有一条：**任务能否在浏览器内完成**。

- **表格与结构化数据**：清洗、合并、格式转换、批量填充；
- **文档与报表**：Word / Excel / PDF 模板生成与批量导出；
- **地理与时序数据**：坐标转换、空间分析、轨迹与地图可视化；
- **图像与媒体**：压缩、水印、二维码、格式转换（可接入 WASM 编解码器）；
- **查询与聚合**：调用公开 API、筛选、统计与图表展示；
- **内部工具**：把一次性脚本变成团队可复用、可分享的页面。

同样需要说明它不适合什么：依赖服务端私密密钥的运算、需要长期存储或多人实时协作的状态、以及超出浏览器内存的超大数据集——这些仍然需要真正的后端。

---

## 技术栈

| 分层 | 选型 |
| --- | --- |
| 框架 | Vue 3（Composition API + `<script setup>`）· Pinia · vue-router |
| 语言 | TypeScript（严格模式） |
| 构建 | Vite · 构建期预渲染（SEO）· 手动分包 |
| 样式 | Tailwind CSS 4 · daisyUI |
| 通用数据 | SheetJS · PapaParse · JSZip · ExcelJS · docxtemplater |
| 领域库（示例） | Leaflet · shpjs · togeojson · Turf.js · proj4 · gcoord · jsQR |
| 可视化 | ECharts · frappe-gantt |
| 工程 | Vitest · Playwright · oxlint · ESLint · Prettier |

> 表中的领域库只是当前工具用到的实现。新工具可以引入任意浏览器端库或 WASM 模块，框架不绑定具体领域。

---

## 项目结构

```text
.
├── src/
│   ├── tools/                  # 工具实现，一个目录一个工具
│   │   ├── toolData.ts         # 工具注册表（配置驱动）
│   │   └── {tool_id}/          # Page.vue + Service / Generator / ...
│   ├── views/                  # 页面与布局（首页、工具详情、About…）
│   ├── components/             # 通用组件（侧边栏、图表、评论、弹窗…）
│   ├── composables/            # useECharts、主题同步、SEO 等
│   ├── utils/                  # 数据读写、领域计算、日志、进度等基础能力
│   ├── workers/                # Web Worker（大文件解析 / 生成）
│   ├── router/                 # 路由与懒加载边界
│   └── mock/                   # 开发期 Mock API
├── scripts/prerender.mjs       # 构建后预渲染 + sitemap
├── public/                     # 静态资源、工具文档
├── vercel.json                 # 静态托管 + SPA 回退 + 缓存策略
└── vite.config.ts              # 分包、别名、开发代理
```

---

## 本地开发

环境要求：**Node.js ≥ 22.17**。

```sh
npm install
npm run dev        # 启动开发服务器
```

常用脚本：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器（默认启用 Mock API） |
| `npm run build` | 完整构建：lint → 类型检查 → 单测 → 打包 → 预渲染 |
| `npm run build:fast` | 跳过 lint / 测试，只做类型检查与打包 |
| `npm run preview` | 预览构建产物 |
| `npm run test:unit` | Vitest 单元测试 |
| `npm run test:e2e` | Playwright 端到端测试 |
| `npm run lint` / `npm run format` | 代码检查与格式化 |

环境变量（均可省略，见 [`.env.example`](./.env.example)）：

| 变量 | 说明 |
| --- | --- |
| `VITE_SITE_URL` | 站点地址，用于预渲染 sitemap 与 SEO 元信息 |
| `VITE_USE_MOCK` | 开发期是否使用 Mock API |
| `VITE_ENABLE_MOMENT_TAB` | 是否展示「势」标签页 |

---

## 构建与部署

```sh
npm run build
```

产物是 `dist/` 下的**纯静态文件**（含预渲染好的 HTML 与 `sitemap.xml`）。把它交给任意静态托管即可：

- **Vercel / Netlify / Cloudflare Pages**：构建命令 `npm run build`，输出目录 `dist`。仓库内的 `vercel.json` 已配置 SPA 回退、可选的 `/api` 转发与长缓存头；
- **Nginx / Apache / 对象存储 + CDN**：只需一条「未命中文件回退到 `index.html`」规则，并为 `assets/` 设置 `immutable` 缓存；
- **完全内网**：把 `dist/` 拷进内网静态服务器即可，工具功能不依赖外网后端（仅在线查询类工具需要访问对应公开数据源）。

Nginx 参考配置：

```nginx
server {
    listen 80;
    root /var/www/dls_toolroom/dist;
    index index.html;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

> 预渲染在 CI 中通过 Puppeteer + `@sparticuz/chromium` 执行，本地则复用 Playwright 浏览器；若托管平台不支持在构建时启动浏览器，可单独运行 `npm run build-only`，SPA 回退后依然可用，只是首屏 SEO 收益减少。

### 境外数据源：同源反向代理

在线查询类工具依赖若干境外 API（Open-Meteo、USGS、GDACS）。生产站点 `dlslab.cn` 由本项目自带的 nginx 提供一层同源代理，前端在 `dlslab.cn` 下自动改走 `/proxy/*`：

| 前端路径 | 上游 |
| --- | --- |
| `/proxy/openmeteo/*` | `api.open-meteo.com` |
| `/proxy/openmeteo-archive/*` | `archive-api.open-meteo.com` |
| `/proxy/usgs/*` | `earthquake.usgs.gov` |
| `/proxy/gdacs/*` | `www.gdacs.org` |

- 路由与开关：`src/utils/apiProxy.ts`（生产 + 站点域名自动启用，`VITE_API_PROXY=true/false` 可强制）；
- nginx 配置：`deploy/nginx/`（缓存、限速、CORS、固定上游白名单）；
- 核实数据与设计说明：[`docs/2026-10-29-api-proxy-verification.md`](./docs/2026-10-29-api-proxy-verification.md)。

> 这层代理解决的是「跨境抖动 / 缺 CORS / Key 暴露 / 超时不可控」，**不能**让被全网阻断的域名（Google、OSM 瓦片）变得可访问，也不会代理地图瓦片。

---

## 扩展：新增一个工具

工具通过 `src/tools/toolData.ts` **声明式注册**，路由和侧边栏自动生效，无需改动布局：

1. 在 `src/tools/{tool_id}/` 下创建 `{Name}Page.vue`；
2. 在 `toolData.ts` 的 `toolConfigs` 中追加一条配置（`id`、名称、描述、图标、标签）；
3. 需要文档时，在 `public/docs/{tool_id}/` 放置对应 Markdown。

`ToolDetailView.vue` 通过 `import.meta.glob` 自动发现页面组件并按 `toolId` 懒加载，因此新增工具不会影响首屏体积。工具的领域不受限制，只要遵循同一套约定（页面入口、服务封装、结果生成）即可。详细的目录约定、三种实现模式（文件处理 / API 查询 / 实时转换）与共享基础设施说明见 [`src/tools/spec.md`](./src/tools/spec.md)。

---

## 工程与性能

- **按路由 + 按工具懒加载**：ECharts、Leaflet、ExcelJS、docxtemplater 等大库各自成块，只在实际使用时下载；
- **精确手动分包**：基于 `node_modules/<pkg>/` 的包名匹配，避免把按需库拖进首屏 `modulepreload`；
- **Web Worker**：文件解析与表格生成放到 `src/workers/filePipeline.worker.ts`，大文件不阻塞 UI；
- **构建期预渲染**：把 SPA 路由渲染成静态 HTML，兼顾静态部署与搜索引擎可读性；
- **质量闸门**：`npm run build` 串联 lint、类型检查、单元测试与预渲染，构建失败即拦截。

---

## 内置工具（示例）

以下工具是这套框架的落地样例，覆盖地理空间与文档处理的常见场景：

- **坐标与距离**：单点 / 批量坐标转换、两点距离测算、地址与经纬度互查；
- **地理数据转换**：表格转 KML、SHP 转 KML、SHP / KML / KMZ 转 Excel；
- **空间与地图**：基于 Turf.js 的空间分析、KML 查看器；
- **文档与表格**：Word / Excel 模板批量填充、甘特图与工期倒排、二维码生成与识别；
- **公开数据查询**：高程、历史天气、地震、GDACS 灾害事件。

它们证明的是框架的通用性，而不是框架的范围。工具会持续增加，但框架本身保持不变：**计算在端上，分发在边缘**。

---

## 隐私边界

为了让「隐私」可验证而不是口号，这里明确列出运行时的网络行为：

| 行为 | 是否发生 | 说明 |
| --- | --- | --- |
| 上传用户选择的文件 | 否 | 文件仅通过 `FileReader` 在本地读取 |
| 上传解析后的数据 | 否 | 解析与计算均在浏览器内完成 |
| 匿名页面访问计数 | 是 | 仅上报页面标识，不含文件、输入内容或身份信息；可在部署侧屏蔽 `/api` 关闭 |
| 评论 / 站点统计图表 | 是（可选） | 与用户文件无关的社区功能 |
| 查询公开数据 | 是（按需） | 浏览器直连 Open-Meteo、USGS、GDACS 等；高德等需要用户自备 Key |

---

## 许可证

[MIT](./LICENSE) © 2025 DLS Rango（大龙山兰戈）
