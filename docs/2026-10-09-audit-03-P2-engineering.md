# 2026-10-09 代码审查 · P2：工程配置 · 安全 · 性能

> **问题总数**：22 项
> **审计日期**：2026-10-09 · 基线 `c096944`
> **上一份**：[P1 功能失效与静默失败](./2026-10-09-audit-02-P1-functional.md) · **下一份**：[P3 死代码 · 重复 · 结构](./2026-10-09-audit-04-P3-cleanup.md)

本报告分三节：**A 工程配置与构建**（11）、**B 安全**（6）、**C 性能与内存**（5）。

---

## A. 工程配置与构建

### P2-1　`tailwind.config.js` 是死配置 —— v4 走 CSS 侧，JS 配置从未被读取

### 位置
`tailwind.config.js:1-31` · `src/assets/main.css:1-6` · `postcss.config.js:5` · `vite.config.ts:8,23`

### 严重度
中等 · 影响所有后续维护者

### 触发场景
任何人修改 `tailwind.config.js` 中的任何选项。

### 后果
项目使用 Tailwind **v4**（`@tailwindcss/postcss`）。v4 为了兼容旧式 JS 配置，**只在 CSS 中出现 `@config` 指令时**才读取 JS 配置文件。而 `main.css` 全文只有：

```css
@import 'tailwindcss';
@plugin '@tailwindcss/typography';
@plugin 'daisyui' {
  themes: light, dark, corporate, business, night, dracula, winter, forest;
}
```

**没有任何 `@config`**。因此 `tailwind.config.js` 里的全部内容都不生效：

- `content: ['./index.html', './src/**/*.{...}']`（v4 已自动探测）
- `darkMode: 'class'`（v4 语义不同）
- `plugins: [typography, daisyui]`（与 `@plugin` 双份注册，daisyUI 会被初始化两次）
- `daisyui.themes` —— **与 `main.css:5` 是同一份配置抄了两遍**
- `darkTheme` / `base` / `styled` / `utils` / `prefix` / `themeRoot` / `logs` —— 仅在死文件中存在

这是最典型的"看起来配了其实没配"陷阱：改 `tailwind.config.js` 没有任何效果，极易让维护者改错文件、白干。

### 修复建议
二选一：

- **方案 A（推荐，与 v4 CSS-first 对齐）**：删除 `tailwind.config.js`，把 `themeRoot`/`prefix`/`logs`/`darkTheme` 等有效字段迁到 `main.css` 的 `@plugin 'daisyui' { ... }` 中。
- **方案 B**：在 `main.css` 顶部加 `@config "../tailwind.config.js";`，并删除 v3-only 的 `content`/`darkMode`/`plugins`。

### 工作量
15 分钟

### 验收标准
- [ ] 改一处主题配置（如在 `main.css` 中删掉一个主题），构建产物中该主题的 CSS 变量消失
- [ ] 全仓只有一处 daisyUI 主题声明

---

### P2-2　`npm run build` 不跑任何质量门禁

### 位置
`package.json:8` `"build": "run-s build-only prerender"`

### 严重度
中等 · 影响整个发布流程

### 触发场景
执行 `npm run build`（**实际部署使用的命令**）。

### 后果
只做构建和预渲染，**不跑 `type-check`、不跑单元测试、不跑 lint**。`build:fast` 含 type-check 但名字暗示是"快速"通道且未包含测试。

上一轮审计已指出这一点。本轮 CI 已补上（`.github/workflows/ci.yml`），但**本地 `npm run build` 仍然可以带着红测试直接产出可部署产物**。

### 修复建议
```json
"build": "run-s type-check lint test:unit build-only prerender"
```

如担心耗时，先用 `run-p` 并行 type-check 与 lint，再串行测试。

### 工作量
5 分钟

### 验收标准
- [ ] 故意制造一个 type error，`npm run build` 失败

---

### P2-3　`eslint` 报 133 个 error，但 CI 只跑永远绿的 `oxlint`

### 位置
`.github/workflows/ci.yml:31-32` vs `package.json:16-18` vs `eslint.config.ts`

### 严重度
中等 · 影响代码质量门禁的可信度

### 实测结果
```
npx oxlint .  → 0 warnings, 0 errors (185 files, 116 rules)
npx eslint .  → 133 problems (133 errors, 0 warnings)
                 ├─ 112 × @typescript-eslint/no-explicit-any
                 ├─  17 × @typescript-eslint/no-unused-vars
                 │        （disposeChart ×3、props ×2、tools、_、inlineStyle、
                 │          FullAddress、fields、error、e、CoordinatePoint、
                 │          closeErrorDialog、allFiles、_cls、hasUploadedFile、
                 │          PhArrowRight、nextTick）
                 ├─   1 × @typescript-eslint/no-empty-object-type
                 └─   1 × ban-ts-comment（用了 @ts-ignore）
```

### 后果
`package.json:16` 的 `"lint": "run-s lint:*"` 本地会同时跑两个 linter（本地是红的），但 CI 只跑 `npx oxlint .`（永远绿）。**133 个 error 被 CI 完全放过。**

两套工具链共享同一份 `.oxlintrc.json` 阈值（`eslint.config.ts:35` 的 `buildFromOxlintConfigFile`），却给出相反结论——修 lint 的人不知道哪套是权威。

`vitest.config.ts:11` 的 `as any` 自己就是 violation 制造者。

### 修复建议
二选一，不要留"看起来在管其实没管"的配置：

- **A（推荐）**：CI 改为 `npm run lint`，并修 133 个 error。其中 112 个 `as any` 可批量替换为 `unknown` + 类型收窄。
- **B**：明确删掉 `lint:eslint` / `eslint.config.ts` / 4 个 `eslint-plugin-*`，承认只用 oxlint。

同时在 README 写明"oxlint 管 correctness/性能，eslint 管 type-aware 规则，以哪套为准"。

### 工作量
方案 A 约 1 天；方案 B 约 30 分钟

### 验收标准
- [ ] CI 的 lint job 与本地 `npm run lint` 结论一致
- [ ] `npx eslint .` 无输出

---

### P2-4　`vitest.config.ts` 把 vite 配置无差别搬进测试环境

### 位置
`vitest.config.ts:1-19` · `vite.config.ts:11-24, 35-79`

### 严重度
中等

### 后果
`vitest.config.ts:5-8` 用手写 `as`-cast 调用 `viteConfigFn({command:'serve', mode:'test', ...})`，而不是让 vitest 自己跑 config hook。导致：

1. `vite.config.ts:12` 的 `loadEnv(mode, process.cwd(), '')` 在 vitest 下读当前工作目录的 `.env`。而 `.env:8` 是 `VITE_USE_MOCK=false`，于是 mock 在单测里被禁用——但 `vitest.config.ts` 没有反注册 mock。**若有人删掉 `.env` 或改成非 `false`，`vite-plugin-mock` 会在 vitest 进程里挂中间件。**
2. `viteMockServe` + `vueDevTools` 被拖进测试环境，承担不必要的初始化开销（测试 import 阶段实测 15.8s）。
3. `manualChunks` 对 vitest 完全无意义，成了"看似生效实则空转"的配置。
4. `loadEnv(..., '')` 的**空前缀**会把 `.env` 里所有内容（含未来可能出现的真密钥）注入 config 的 `env` 对象。

### 修复建议
```ts
// vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'
import type { UserConfig } from 'vite'

export default defineConfig((env) =>
  mergeConfig(viteConfig(env) as UserConfig, {
    test: { environment: 'jsdom', include: ['src/**/*.{test,spec}.{ts,tsx}'] },
  })
)
```
并在 `vite.config.ts:12` 收紧前缀：`loadEnv(mode, process.cwd(), ['VITE_'])`。

### 工作量
1 小时

### 验收标准
- [ ] `npx vitest run` 不加载 vite-plugin-mock / vite-plugin-vue-devtools
- [ ] 删除 `.env` 后 `npx vitest run` 仍正常

---

### P2-5　`date-fns` 是幽灵依赖 —— 3 处 import，`package.json` 未声明

### 位置
| 文件 | 行 |
|---|---|
| `src/tools/earthquake_query/EarthquakeQueryPage.vue` | 269 |
| `src/tools/gdacs/GdacsPage.vue` | 266 |
| `src/tools/weather_history/WeatherHistoryPage.vue` | 189 |

均为 `import { zhCN } from 'date-fns/locale'`

### 严重度
**高（部署阻断级）** · 影响 3 个工具

### 后果
`package.json` 既无 `date-fns` 也无 `@types/date-fns`。当前能编译运行，只是因为 npm 把某个传递依赖提升到了 `node_modules` 顶层。**`npm ci` 的干净安装环境（CI / Vercel）下解析策略稍有变化就会炸**，且 3 个页面的 `@vuepic/vue-datepicker` 中文 locale 会失效。

### 修复建议
```bash
npm install date-fns@^4
npm install -D @types/date-fns
```

### 工作量
10 分钟

### 验收标准
- [ ] `package.json` 的 `dependencies` 含 `date-fns`
- [ ] `rm -rf node_modules && npm ci && npm run build` 成功
- [ ] 三个页面的日期选择器显示中文

---

### P2-6　`engines` 允许 Node 20，但 devDeps 最低要 22.13/22.17

### 位置
`package.json:114` · `.github/workflows/ci.yml:22,46,72` · `.nvmrc:1` · `tsconfig.node.json:3,14-15`

### 严重度
中等 · 影响安装与 CI 稳定性

### 后果
`package.json:114` 的 `engines` 是 `^20.19.0 || >=22.12.0`，宽松到覆盖 Node 20。但实际依赖：

| 依赖 | engines 要求 |
|---|---|
| `jsdom` | `^22.13.0 \|\| >=24` |
| `@sparticuz/chromium` | `^22.17.0 \|\| >=24.0.0` |
| `eslint` | `^22.13.0 \|\| >=24` |
| `@tsconfig/node24` | Node 24 |

**项目声称支持 Node 20，但装依赖时就会挂。** 同时 CI 的四个 setup-node 全是 `node-version: 22`，若 runner 解析到 < 22.17.0，`@sparticuz/chromium`（预渲染用）直接装不上。

`.nvmrc` 是 `22`，CI 是 `22`，`engines` 却说 20 —— 三方不一致。

### 修复建议
```json
"engines": { "node": ">=22.17.0" }
```
- CI 的 `node-version` 改为 `24`（或显式 `22.17+`）
- `tsconfig.node.json:3` 若真要跑在 Node 22，应继承 `@tsconfig/node22`；否则把 CI/engines 统一到 24
- `.nvmrc` 与 CI 保持一致

### 工作量
30 分钟

### 验收标准
- [ ] `npm ci` 在 Node 20 上给出明确的 engines 警告/错误
- [ ] CI 与 `engines` 一致

---

### P2-7　`.env` 重复 key，且 `VITE_ENABLE_MOMENT_TAB` 导致 CI 产物与本地不一致

### 位置
`.env:3, 8, 13` · `.gitignore:58-60` · `.env.example:5` · `src/tools/createToolNavItems.ts:46`

### 严重度
中等

### 后果
**(a) 重复 key**：`.env:8` 和 `.env:13` 都是 `VITE_USE_MOCK=false`，`:10-12` 的注释块是 `:6-7` 的副本。同一配置写两遍，改动时极易只改一处。

**(b) CI 产物分叉**：`.env` 不入库（这是正确的），CI 的 build job 跑 `npm ci` 后**没有 `.env`**。于是 `createToolNavItems.ts:46` 的：

```ts
import.meta.env.VITE_ENABLE_MOMENT_TAB === 'true'
```

在 CI 是 `undefined === 'true'` → false → **CI 构建出的 dist 不含「势」tab**，而本地（有 .env）含。这是"CI 产物与预想不同"的隐性分叉。

**(c) `VITE_SITE_URL` 缺失**：`scripts/prerender.mjs:18`、`composables/useSeo.ts:6` 都读它，但 `.env.example` 里没有，本地不设就 fallback 到 `https://dlslab.cn`。

### 修复建议
1. `.env` 删掉 `:10-13` 的重复块。
2. 把生产默认值写进代码而非依赖 `.env`：
   ```ts
   // createToolNavItems.ts
   const enableMomentTab = import.meta.env.VITE_ENABLE_MOMENT_TAB !== 'false'  // 默认开
   ```
   或在 Vercel 项目设置里显式配置该变量。
3. `.env.example` 补 `VITE_SITE_URL`。

### 工作量
20 分钟

### 验收标准
- [ ] `rm .env && npm run build && grep -c "Moment" dist/index.html` 本地与 CI 一致
- [ ] `.env` 无重复 key

---

### P2-8　`vercel.json` 后端地址硬编码裸 IP + 明文 HTTP + catch-all 软 404

### 位置
`vercel.json:5` `{ "source": "/api/(.*)", "destination": "http://8.137.195.0/api/$1" }` · `vercel.json:6` `/(.*)` → `/index.html`

### 严重度
**高** · 影响部署韧性与安全

### 后果
**(a) 裸 IP + 明文 HTTP**：无 TLS、无域名。后端一迁 IP，全站 API 挂；且无法用 Vercel 环境变量按 preview/production 区分后端。评论 PII（昵称/电话/邮箱，见 `DlsComment.vue:344-351`）在该段明文传输，可被窃听篡改。

**(b) 三处后端地址割裂**：`vite.config.ts:32` dev proxy 写死 `127.0.0.1:8000`，`vercel.json` 写死公网 IP，`.env` 的 mock 开关控制第三条路径。没有任何共享配置来源。

**(c) catch-all 吞掉所有 404**：`/(.*)` → `/index.html` 让任意不存在的 URL 都返回 **200 + index.html**。软 404 对 SEO 是负分（本项目有 prerender + sitemap，说明在意 SEO）。

### 修复建议
1. `vercel.json` 用环境变量：
   ```json
   { "source": "/api/(.*)", "destination": "$API_ORIGIN/api/$1" }
   ```
   在 Vercel Project Settings 配 `API_ORIGIN=https://your-domain`。
2. 404：保留 rewrite 但确保 prerender 的 sitemap 只含真实路由；或在 Vercel 配 `"cleanUrls": true` + 明确的 404 页面（项目已有 `NotFoundPage.vue`）。
3. 把后端地址统一收到一个 `.env.example` 的 `VITE_API_ORIGIN` + 各处读取。

### 工作量
1 小时（需配合 Vercel 控制台操作）

### 验收标准
- [ ] `curl -I https://<site>/api/comments` 返回 HTTPS 后端响应
- [ ] 访问不存在路径返回非 200 状态码（或明确记录这是有意为之）
- [ ] 后端地址只在一个配置源中定义

---

### P2-9　`format` 只覆盖 `src/`，CI 无 prettier 检查，已发生漂移

### 位置
`package.json:19` `"format": "prettier --write --experimental-cli src/"` · `.github/workflows/ci.yml`（无 prettier job）

### 严重度
轻微

### 后果
`--experimental-cli` 本身对 `prettier@3.8.1` 是有效的（实测 `--help` 能识别该 flag，`--file-info` 在 experimental-cli 模式下返回专属错误而非 "unknown option"）。问题在于"半套格式化 + 无门禁"：

以下 4 个仓库内文件已不符合 `.prettierrc.json`（`prettier --check` 报 4 个 warn）：
`index.html`、`playwright.config.ts`、`tailwind.config.js`、`vite.config.ts`

格式漂移不可发现，且 `vite.config.ts:13-75` 的整个 return 对象缩进错乱（`return {` 之后未缩进）。

### 修复建议
```json
"format": "prettier --write --experimental-cli ."
```
CI 加：
```yaml
- name: Prettier
  run: npx prettier --experimental-cli --check .
```

### 工作量
30 分钟（含修复 4 个文件的格式）

### 验收标准
- [ ] `npx prettier --experimental-cli --check .` 通过

---

### P2-10　`manualChunks` 判据撞车，多条规则是死的

### 位置
`vite.config.ts:38-76`（特别是 `:41`、`:66`、`:70`）

### 严重度
**高（体积）**

### 后果
`:41` 的判据是 `id.includes('vue')`，它命中一切路径含 "vue" 的包。实测比对 `dist/assets/*.js`：

| chunk | 实际内容 |
|---|---|
| `echarts`（1085.8 KB） | ECharts 核心 + **vuedraggable/Sortable** |
| `vue-ecosystem`（590.7 KB） | `@vuepic/vue-datepicker` + **vuedraggable** |

因为 `@vuepic/vue-datepicker` 的路径含 "vuepic"、`vuedraggable` 含 "vuedraggable"，都命中 `:41` → `:66` 的 `radix-vue || @vuepic || frappe-gantt || vuedraggable` 分支**永远走不到**。

`:70` 的 `id.includes('monaco')` 是死规则：`vue-use-monaco`（`package.json:66`）在 src 里零引用，dist 里没有 monaco 代码。

同理 `markstream-vue`/`mermaid`（均为零引用依赖）的 chunk 规则也是空转。

### 修复建议
改为基于 `node_modules/<pkg>/` 的精确匹配：

```ts
manualChunks(id) {
  if (!id.includes('node_modules')) return
  const m = id.match(/node_modules[\\/](@?[^\\/]+(?:[\\/][^\\/]+)?)/)
  if (!m) return 'vendor'
  const pkg = m[1]
  if (pkg === 'vue' || pkg === 'pinia' || pkg === 'vue-router') return 'vue-ecosystem'
  if (pkg.startsWith('echarts') || pkg === 'zrender') return 'echarts'
  if (pkg === 'leaflet') return 'leaflet'
  if (pkg.startsWith('@turf/')) return 'turf'
  if (pkg === 'exceljs') return 'exceljs'
  if (['docxtemplater', 'xlsx', 'jszip', 'pizzip'].includes(pkg)) return 'document-libs'
  if (pkg.startsWith('@vuepic') || pkg === 'vuedraggable' || pkg.startsWith('radix-vue')
      || pkg === 'frappe-gantt') return 'ui-libs'
  if (pkg === 'markdown-it' || pkg === 'dompurify') return 'md-utils'
  return 'vendor'
}
```

删除零引用依赖对应的规则（见 P3-3）。

### 工作量
2 小时（需逐个核对产物）

### 验收标准
- [ ] `dist/assets/` 中每个 chunk 的成员符合预期（可用 `grep -l` 抽查）
- [ ] 首屏 JS 载荷下降（见 P2-18）

---

### P2-11　首屏多下载约 810 kB（gzip 后约 392 kB）

### 位置
`vite.config.ts:41` · `src/main.ts:7` · `src/main.ts:9`

### 严重度
**高（体积）**

### 后果
`manualChunks` 顺序错误（P2-10）把 `vuedraggable`、`sortablejs`、`@vuepic/vue-datepicker` 全劫持进 `vue-ecosystem`。而 `main.ts:7`：

```ts
import '@vuepic/vue-datepicker/dist/main.css'
```

datepicker 的 **JS** 因此进入入口依赖图，整块 604 kB 的 `vue-ecosystem` 变成首屏静态依赖，被写进 `dist/index.html` 的 `modulepreload`。

**首页只渲染 4 张工具卡片，却要下载 1.2 MB JS。** `proj4`（仅 1 个工具使用）、`dompurify`（仅 markdown 页使用）本不该进首屏。

### 修复建议
1. 修 `manualChunks`（P2-10）——这是根因。
2. `@vuepic/vue-datepicker/dist/main.css` 从 `main.ts` 移到实际使用它的组件内，或接受 CSS 预加载但让 JS 走动态 import。
3. `proj4` / `dompurify` 改为 `await import()`。

### 工作量
3 小时（与 P2-10 一起）

### 验收标准
- [ ] `dist/index.html` 的 `modulepreload` 只含 vue/pinia/vue-router + 入口
- [ ] 首屏 JS（gzip）从 392 kB 降到 250 kB 以下
- [ ] 懒加载仍正常（echarts / exceljs / leaflet 类工具首次进入时才下载）

---

## B. 安全

**总体结论：未发现可直接利用的严重漏洞。** 代码库对 XSS 已有明确防护（见本节末「已确认防御到位」）。以下是确认的问题。

### P2-12　高德 API Key 明文持久化到 localStorage

### 位置
`src/stores/geocodeStore.ts:33, 164-166`（`persist: true`，未配置 `paths`/`omit`）

### 严重度
中等

### 触发场景
任何用户在「地址解析」/「经纬度查询」填入高德 API Key 后即落盘，跨会话保留。

### 后果
`pinia-plugin-persistedstate` 会把整个 state（含 `apiKeys[].key`，见 `geocodeStore.ts:4-10` 的 `ApiKeyInfo` 接口）以明文 JSON 写入 `localStorage`（key 为 `geocode`）。**任何 XSS、恶意浏览器扩展、本地脚本均可读取。**

上一轮审计已指出此问题，本轮仍未修。

### 修复建议
```ts
{
  persist: {
    paths: ['queryOptions', 'enableBounds', 'bounds', 'selectedFields'],  // 排除 apiKeys
  },
}
```
或让用户每次会话手动输入 Key，完全不持久化。

### 工作量
15 分钟

### 验收标准
- [ ] 填 Key 后 `localStorage.getItem('geocode')` 不含 key 字段
- [ ] 刷新页面后 queryOptions/bounds 仍保留

---

### P2-13　API Key 被拼进 URL，并在错误弹窗中原样渲染到 DOM

### 位置
| 文件 | 行 | 代码 |
|---|---|---|
| `src/utils/amapService.ts` | 85-91 | `params = { [config.keyParam]: key, ... }` → `url = buildApiUrl(config.url, params)` |
| `src/components/common/GeocodeCommon.vue` | 744-748 | `errorModalData.value = { url: result.url, ... }` |
| `src/components/common/ErrorDialog.vue` | 33-40 | `<p ...>{{ details.url }}</p>` + 提示"您可以复制上面的URL到浏览器中直接访问" |

### 严重度
中等

### 触发场景
用户输入无效/过期的 Key → 失焦触发校验 → 弹窗展示含完整 Key 的 URL。

### 后果
`validateApiKey()` 返回的 `url` 里含 `&key=<APIKEY>`（`amapService.ts:86` 把 key 放入 params 再 `buildApiUrl`）。Key 无效时 `GeocodeCommon.vue:746` 将其塞入 `errorModalData.url`，`ErrorDialog.vue:35` 用 `{{ details.url }}` **渲染到 DOM**，第 39 行还主动提示用户"复制此 URL 到浏览器访问"。

Key 进入可见 DOM，易被录屏/快照、会话回放（Session Replay）工具、浏览器扩展或用户二次分享时捕获。违反"勿将密钥放入 URL"的通行规范。

### 修复建议
错误对象不要返回完整 URL。如确需展示，对 query 中的 key 脱敏：

```ts
function maskUrl(url: string): string {
  return url.replace(/([?&](?:key|ak|apikey)=)[^&]*/gi, '$1****')
}
```

并删除 `ErrorDialog.vue:38-40` 的"复制 URL 访问"提示。

### 工作量
30 分钟

### 验收标准
- [ ] Key 校验失败时，弹窗与 `localStorage`、console 中均不出现完整 Key
- [ ] `amapService.spec.ts` 补一个"url 已脱敏"断言

---

### P2-14　外部数据直接绑定 `:href`，未做协议白名单

### 位置
`src/tools/gdacs/GdacsPage.vue:200-203`

```vue
<a :href="gdacsEvent.url" target="_blank" rel="noopener noreferrer" ...>
```

### 严重度
轻微（需上游被攻陷才可利用）

### 触发场景
`gdacsEvent.url` 源自 GDACS API 响应（`gdacsService.ts:146-147, 163, 169, 186`）。虽有 `rel="noopener noreferrer"`，但这只影响 `target=_blank` 的 window opener，**不能阻断 `javascript:` 协议执行**。Vue 的 `v-bind:href` 不会过滤协议。

### 修复建议
```ts
// src/utils/safeUrl.ts
export function safeUrl(raw: string): string {
  try {
    const u = new URL(raw, window.location.origin)
    return u.protocol === 'http:' || u.protocol === 'https:' ? raw : '#'
  } catch { return '#' }
}
```
绑定 `:href="safeUrl(gdacsEvent.url)"`。

### 工作量
20 分钟

### 验收标准
- [ ] 构造一个 `url: 'javascript:alert(1)'` 的 mock 响应 → 渲染为 `#`
- [ ] 正常 https URL 不受影响

---

### P2-15　4 处裸 `fetch()` 无超时、无 `AbortSignal`

### 位置
| 文件 | 行 |
|---|---|
| `src/tools/gdacs/gdacsService.ts` | 125 |
| `src/tools/earthquake_query/earthquakeService.ts` | 108 |
| `src/tools/weather_history/weatherHistoryService.ts` | 81 |
| `src/tools/elevation_query/elevationService.ts` | 15, 44 |

### 严重度
中等

### 触发场景
外部 API 连接挂起（弱网 / 服务端无响应）。

### 后果
三重伤势：
1. **spinner 永久显示**，用户以为还在加载。
2. **离开页面后请求仍在跑**，响应回来后继续改状态（组件已卸载 → 潜在内存泄漏 + 无意义的 setState）。
3. 无超时意味着弱网下用户永远等不到错误提示。

### 修复建议
统一封装：

```ts
export async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  ms = 15_000,
): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}
```
配合 `onUnmounted(() => ctrl.abort())` 做组件级中断。

### 工作量
2 小时（1 个工具函数 + 4 处替换 + 页面级 abort）

### 验收标准
- [ ] 用 Playwright 的 route delay 模拟挂起 → 15s 后出现明确超时错误，spinner 停止
- [ ] 请求中离开页面 → 不再有状态更新

---

### P2-16　评论 PII 经明文 HTTP 裸 IP 传输

### 位置
`vercel.json:5`

### 严重度
中等（依赖部署修复）

### 后果
edge → 源站段为明文 HTTP、无域名/TLS/鉴权。评论提交的 PII（昵称/电话/邮箱，见 `DlsComment.vue:344-351`）在该段明文传输，可被中间人窃听或篡改。

### 修复建议
见 P2-8 的 `API_ORIGIN` 环境变量方案，并使用 HTTPS 域名源站。

### 工作量
随 P2-8

### 验收标准
- [ ] 评论提交全程 HTTPS

---

### P2-17　验证码纯前端生成与校验 —— 安全剧场

### 位置
`src/components/layout/DlsComment.vue:196-204, 288`

### 严重度
中等（给人虚假的安全感）

### 触发场景
任何脚本直接 POST `/api/comments`。

### 后果
4 位验证码在浏览器生成、在浏览器校验（`formCaptcha.toUpperCase() !== captchaCode`）。可被读 JS 或直接打接口轻易绕过。**客户端验证码不提供任何实际防刷能力**，却让人以为"有防刷"。

### 修复建议
人机校验必须依赖服务端（rate limit + 验证码服务）。若短期不上服务端，至少在代码中明确标注：

```ts
// ⚠ 仅防误输入，不提供防刷能力。真正的限流必须在服务端实现。
```

### 工作量
30 分钟（加注释）；服务端改造另行评估

### 验收标准
- [ ] 代码注释明确说明其局限
- [ ] 后端有限流（需后端配合验证）

---

### 已确认防御到位（列出以示覆盖）

- `GanttChartPage.vue` JSON 导入：`validateImportedTasks` schema 校验（id 纯数字、color 仅 `#hex`、progress 钳制、剔除多余字段，见 `ganttTaskUtils.ts:118-196`）+ 渲染前统一 `escapeHtml` + color 二次校验。**纵深防御完善。**
- `KmlViewerPage.vue:708-710`：KML name/descr 经 `DOMPurify.sanitize(...,{ALLOWED_TAGS:[]|['br']})` 后才入 Leaflet popup；树节点名用 `{{ }}` 文本渲染。
- `DlsMdPage.vue:42,89`：`MarkdownIt()` 默认 `html:false`（原始 HTML 被转义），再经 `DOMPurify.sanitize()`。
- `DlsComment.vue`：评论内容用 `{{ }}` 文本插值，非 `v-html`。
- **无 eval / `new Function` / 用户可控动态 import**：所有 `import()` 均为构建期静态字面量；`import.meta.glob` 亦为构建期映射。
- **所有 blob URL 都有配对回收**：逐处核对 Gantt 的 6 处（含 onerror 分支），无泄漏。
- **无硬编码密钥**；`mock/user.ts` 的 `mock-token-12345` 为本地 mock 数据。
- **未使用 `VITE_` 变量承载密钥**（仅 `VITE_SITE_URL`/`VITE_ENABLE_MOMENT_TAB`/`VITE_USE_MOCK`，均非敏感）。
- **无 dist 产物入库**，未开启 `build.sourcemap`。

> 纵深防御可再收紧一处：`DlsMdPage.vue:89` 的 DOMPurify 未配置 `ALLOWED_TAGS`，默认允许 SVG/MathML。因输入无原始 HTML/SVG，当前不可达；建议显式白名单。

---

## C. 性能与内存

### P2-18　大量 `ref`（而非 `shallowRef`）承载大数组，Vue 深度代理致内存 2–3 倍

### 位置
| 文件 | 行 |
|---|---|
| `src/tools/coords_convert/CoordsConvertPage.vue` | 415, 419 |
| `src/tools/elevations_batch/ElevationsBatchPage.vue` | 302 |
| `src/tools/gis2excel/GisToExcelPage.vue` | 185 |
| `src/tools/shp2kml/Shp2KmlPage.vue` | 372 |
| `src/tools/template_export/useTemplateExport.ts` | 308, 316 |

### 严重度
中等

### 触发场景
导入万行级 XLSX / SHP。

### 后果
`ref` 会让 Vue 对数组及其中每个对象建立深度响应式代理。对**只读的解析结果**（读入后不再逐字段修改）来说，这是纯浪费：内存占用 2–3 倍，且遍历时代理拦截带来额外开销。

### 修复建议
```ts
// 解析结果是只读的大数组
const features = shallowRef<GisFeature[]>([])
```
仅在需要响应式到元素内部时才用 `ref`。

### 工作量
约 2 小时（5 处 + 验证各处是否真的依赖深度响应）

### 验收标准
- [ ] 万行数据下内存峰值下降（可用 Chrome DevTools Memory 面板前后对比）
- [ ] 各处 UI 仍正常更新

---

### P2-19　所有 `push(...arr)` / `Math.max(...arr)` 在大数据量下必崩

### 位置
| 文件 | 行 | 代码 |
|---|---|---|
| `src/utils/TemplateExporter.ts` | 31 | `rows.push(...dataRows)` |
| `src/utils/TemplateExporter.ts` | 56 | `[headers, ...(dataRows \|\| [])]` |
| `src/tools/gis2excel/GisToExcelExporter.ts` | 171-173, 277-279 | `Math.max(...worksheetData.map(...), 30)` |
| `src/tools/gis2excel/GisFileReader.ts` | 263 | `features.push(...shpFeatures)` |
| `src/tools/shp2excel/ShpFileReader.ts` | 43 | `allFeatures.push(...features)` |
| `src/tools/shp2excel/ShpToExcelPage.vue` | 314 | `allFeatures.push(...features)` |

### 严重度
**高** · 影响 6+ 个工具

### 触发场景
导出的数据超过约 10⁵ ~ 10⁶ 个元素。

### 后果
展开运算符 `...` 把整个数组作为**函数参数**传入，受调用栈大小限制，超出即 `RangeError: Maximum call stack size exceeded`。

**尤其讽刺的是**：`TemplateExporter.ts` 是被 6 个工具共用的导出器（距离测算、批量高程、批量坐标转换、表格转KML、GIS转Excel、基站KML）——**而这些恰恰是为大数据量设计的工具**。

### 修复建议
```ts
// push
for (const row of dataRows) rows.push(row)
// 或 rows.push(...dataRows) → rows = rows.concat(dataRows)

// Math.max
arr.reduce((m, v) => Math.max(m, v), 30)

// 构造二维数组
const worksheetData = dataRows?.length ? [headers, ...dataRows] : [headers]
// → 用 concat 或 aoa_to_sheet 直接构造，避免展开
```

### 工作量
3 小时（6 处 + 大数据量回归测试）

### 验收标准
- [ ] 用 20 万行数据的 fixture 走一遍导出，不抛 RangeError
- [ ] 导出结果行数与输入一致

---

### P2-20　文件处理全内存、同步、无分块、无 Worker —— 大文件必卡死

### 位置
`src/utils/TemplateReader.ts:55-72` · `src/utils/TemplateExporter.ts:55-96` · `src/utils/templateHandler.ts` · `src/tools/gis2excel/GisFileReader.ts:159` · `src/tools/shp2kml/ShpToKmlGenerator.ts:164-218` · `src/tools/kml_viewer/KmlViewerPage.vue:588, 679` · `src/tools/coords_convert/coordsConversion.ts:259-294` · `src/tools/gis2excel/GisToExcelExporter.ts:151-207`

### 严重度
中等（取决于用户实际数据量）

### 触发场景
上传几万行的 XLSX、大型 SHP。

### 后果
`file.arrayBuffer()` 整文件读入 → `XLSX.read` 全量解析 → `aoa_to_sheet` → `write` **同步阻塞主线程**。一个几万行的表就能让页面卡死数秒甚至 OOM。

`GisToExcelExporter.ts` 还为每个非空单元格设置 border style 对象（`for key in worksheet` 全量遍历），进一步放大开销。

### 修复建议
1. 读大文件用 `XLSX.read(idata, { dense: true })`。
2. 导出路径改用 exceljs 的 streaming writer（项目已依赖 exceljs）。
3. 给行数加阈值提示：「文件超过 N 行，处理可能需要数十秒」。
4. 中长期：把解析/生成移入 Web Worker（`useProgressTimer` / `ProgressModal` 已有长任务进度抽象，正好接上）。

### 工作量
3–5 天（分阶段；先做 1+2 的快速缓解）

### 验收标准
- [ ] 5 万行 XLSX 导入/导出主线程阻塞 < 2s
- [ ] 超阈值时有明确提示

---

### P2-21　`KmlViewerPage` 的 `fullscreenchange` 监听器从不移除

### 位置
`src/tools/kml_viewer/KmlViewerPage.vue:505-511`（注册）vs `:420-426`（`onBeforeUnmount`）

### 严重度
中等（内存泄漏，每次导航累积）

### 触发场景
每次访问 KML 查看器页面后离开。

### 后果
```ts
// :505-511 —— 在 setup 顶层注册，没有移到 onMounted
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    isWebFullscreen.value = !!document.fullscreenElement
    nextTick(() => map?.invalidateSize())
  })
}
// :420-426 —— onBeforeUnmount 只清理了绘制监听器和 map.remove()
onBeforeUnmount(() => {
  cleanupDrawListeners()
  if (map) { map.remove(); map = null }
})
```

**每次访问 KML 查看器泄漏一个闭包**，该闭包持有整个组件作用域（map / layers / tree）。来回切换几次就能观察到内存持续增长。

### 修复建议
```ts
function onFullscreenChange() {
  isWebFullscreen.value = !!document.fullscreenElement
  nextTick(() => map?.invalidateSize())
}
onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange))
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  cleanupDrawListeners()
  if (map) { map.remove(); map = null }
})
```

### 工作量
20 分钟

### 验收标准
- [ ] 反复进入/离开 KML 查看器 10 次，`getEventListeners(document).fullscreenchange.length` 不增长
- [ ] 内存曲线平稳

---

### P2-22　模板批量渲染：内存无上限 + 失败后残留"可下载"的半成品

### 位置
`src/tools/template_export/useTemplateExport.ts:475-509, 527-574, 629-647`

### 严重度
中等

### 触发场景
批量导出 1000 行 × 100KB 模板。

### 后果
**(a) 内存无上限**：每行 `new PizZip(templateContent)` / `workbook.xlsx.load(template)`，模板被完整反序列化 N 次；所有产物 Blob 堆在 `renderResults` 里直到下载。1000 行 × 100KB ≈ **100MB+，浏览器直接 OOM**。

**(b) 半成品可下载**：中途某行渲染抛错 → `catch` 只置 `showError`，**不清空 `renderResults`** → `canDownload` 为 true → 用户拿到的 ZIP 是残缺的，且没有"已完成 X/N"的状态提示。

（`useDocxTemplateExport.ts:238-272`、`useXlsxTemplateExport.ts:207-254` 有同构问题，但这两个文件是死代码，见 P3-1。）

### 修复建议
1. 分批流式：渲染一行 → 生成 Blob → 立即从内存释放 → 下一行。
2. 失败时清空 `renderResults`，或在状态里标记 `partial: true`，下载文件名加 `_partial`。
3. 加进度反馈：「已完成 350 / 1000」。

### 工作量
约 1 天

### 验收标准
- [ ] 1000 行批量导出过程中内存峰值可控（不 OOM）
- [ ] 中途失败 → 下载按钮禁用或文件名带 `_partial`
- [ ] 有「已完成 X/N」的可见进度

---

## P2 汇总表

| 编号 | 问题 | 类别 | 工作量 |
|---|---|---|---|
| P2-1 | `tailwind.config.js` 死配置 | 配置 | 15 min |
| P2-2 | `build` 不跑门禁 | 流程 | 5 min |
| P2-3 | eslint 133 error，CI 不跑 | 流程 | 1 d / 30 min |
| P2-4 | `vitest.config` 复用 vite config | 配置 | 1 h |
| P2-5 | `date-fns` 幽灵依赖 | **部署阻断** | 10 min |
| P2-6 | `engines` 与 devDeps 矛盾 | 配置 | 30 min |
| P2-7 | `.env` 重复 key + CI 分叉 | 配置 | 20 min |
| P2-8 | `vercel.json` 裸 IP + 软 404 | 部署 | 1 h |
| P2-9 | `format` 半套 + CI 无 prettier | 流程 | 30 min |
| P2-10 | `manualChunks` 判据撞车 | 构建 | 2 h |
| P2-11 | 首屏多下载 810 kB | 性能 | 3 h |
| P2-12 | API Key 明文持久化 | 安全 | 15 min |
| P2-13 | Key 出现在错误弹窗 | 安全 | 30 min |
| P2-14 | `javascript:` 协议未过滤 | 安全 | 20 min |
| P2-15 | 4 处裸 fetch 无超时 | 健壮性 | 2 h |
| P2-16 | PII 明文传输 | 安全 | 随 P2-8 |
| P2-17 | 客户端验证码安全剧场 | 安全 | 30 min |
| P2-18 | `ref` 深度代理大数组 | 性能 | 2 h |
| P2-19 | `push(...arr)` 大数据量崩溃 | **健壮性** | 3 h |
| P2-20 | 全内存同步处理大文件 | 性能 | 3–5 d |
| P2-21 | `fullscreenchange` 监听器泄漏 | 内存 | 20 min |
| P2-22 | 批量渲染内存无上限 + 半成品 | 健壮性 | 1 d |

> **最优先**：P2-5（10 分钟，可能阻断 CI 部署）、P2-12（15 分钟）、P2-13（30 分钟）、P2-21（20 分钟）—— 合计约 1.2 小时消除一个部署风险和一个安全暴露面。

---

*上一份：[P1 功能失效与静默失败](./2026-10-09-audit-02-P1-functional.md) · 下一份：[P3 死代码 · 重复 · 结构](./2026-10-09-audit-04-P3-cleanup.md)*
