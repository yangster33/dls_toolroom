# 金光鎏金（Aura Gold）效果 + 道法术器势布局改版计划

- **日期**：2026-08-17
- **项目**：dls_toolroom（Vue 3 + Vite + TS + Tailwind v4 + daisyUI，纯前端工具间）
- **目标**：
  1. 给所有「卡片类」元素引入 Aura Gold 金光鎏金效果（金色渐变描边 + 流光/辉光动画）
  2. 工具详情页布局改版：真正的工具（器）**常驻上方**，道法术器势切换栏**移到下方**，切换时**只切换下方说明文本**，上方工具页面不变

## 完成状态（任务 A ✅ 2026-08-17 三轮 + 用户反馈收敛，任务 B ✅ 2026-08-18）

- **第一轮（自定义 CSS）**：`main.css` 手写 `.aura-gold`（mask 圆环 + 流光 + 辉光）——已**整体废弃删除**（与 daisyUI 命名冲突、伪元素方案不如官方 wrapper 组件）。
- **第二轮（改用 daisyUI 官方 Aura 组件，✅ 现役）**：
  - **升级** `daisyui 5.5.19 → 5.7.17`（`aura` 组件自 5.6 引入），`main.css` 自定义 aura CSS 全部删除。
  - **统一 markup 模式**（与官方文档一致）：`<div class="aura aura-holo"><div class="card...">…</div></div>` —— wrapper 全息幻彩 conic 描边 + 双层 blur 辉光（默认 20s 循环；**第三轮由金色改为 holo 幻彩，并去掉 4s 时长类**）；子元素圆角不匹配时用 `[--aura-radius:Xrem]` 对齐，`inline-block` 宽度用 `w-full`/`w-[calc(100%-3rem)]` 修正。
  - 已应用：`IndexPage` 推荐卡、`ToolsPage` 网格卡+搜索结果项（hover 位移/点击缩放移到 wrapper，防卡片脱离光环）、`DonatePage` 两张渐变卡、`DlsComment` 评论表单+列表项、`ToolWithMdPage` 使用注意卡。**样式定为 `aura aura-holo`（不再带 duration，用 daisyUI 默认 20s）。**
- **第三轮（用户反馈收敛，✅ 2026-08-18）**：用户反馈首页/工具集「太浮夸」——**取消** `IndexPage` 推荐卡与 `ToolsPage` 网格卡+搜索项的 aura（删除 wrapper，还原 `.card-hover`/`.tool-item`/`.search-result-item` 原始 hover CSS）；`DonatePage` 两张卡与 `DlsComment` 两处**保留** `aura-holo`。
- **第四轮（✅ 2026-08-18，用户追加需求）**：`DlsMainLayout` 的工具常驻框套 `aura aura-holo w-full [--aura-radius:0.5rem]`；同时移除 `ToolsPage`/`AboutPage` 根节点 `mx-6`。
- **第四轮修正（✅ 2026-08-18，用户指出仍差一层）**：aura 的 2px 内边距使工具根 div 比外层窄 4px（1192→1188），tab 框仍为 1192，两侧各凸出 2px——`tabs` 容器改为 `w-[calc(100%-4px)]`，使道法术器势框与工具根 div（aura 内层）同宽；光环紧贴工具根 div。运行态实测三页 toolRoot=tabs=tabContent=1188px、left 全部对齐 72px。
- **工具页内部面板不再套金边**（用户已表达「浮夸」反馈，与 daisyUI「Aura 只用于重点元素」理念一致；A3 兜底方案弃用）。
- **验收**：`vite build` ✅；`oxlint` 触碰文件 ✅；`playwright test` 7/7 ✅；运行态校验（conic-gradient 生效、`animation-duration: 4s`、wrapper/卡片宽度匹配、使用注意卡全宽 1094px）。
- **任务 B 验收（✅ 2026-08-18）**：`vue-tsc` ✅；`vite build` ✅；`oxlint` 8 文件 ✅；`vitest` 450/450 ✅；`playwright` 7/7 ✅；运行态脚本校验 —— 工具页 h1+表单常驻上方、切「法」后表单输入值保留（**工具不重挂载**）、默认选中「道」（DOM `checked` 确认）、「器」tab 渲染 tool.md、/tools 列表常驻 5 tab、/about 窗口常驻 5 tab。
- **遗留**：`DlsChart`/弹窗类未套（无自有卡片容器/保持低调）；`ToolWithMdPage.vue` 已删除。

---

## 一、现状分析

### 1.1 道法术器势现状

- 入口组件：`DlsMainLayout.vue`（tabs-lift 单选 tab，内容整块切换）+ `createToolNavItems.ts`
- tab 结构与内容（`createToolNavItems.ts:15-51`）：

| tab | 内容 | 组件 |
|-----|------|------|
| 道 | `docs/{tool}/tao.md` | `DlsMdPage` |
| 法 | `docs/{tool}/method.md` | `DlsMdPage` |
| 术 | `docs/{tool}/tech.md` | `DlsMdPage` |
| 器 | 工具页面 + 下方 tool.md「使用注意」 | `ToolWithMdPage` |
| 势 | 图表+评论（`VITE_ENABLE_MOMENT_TAB=true` 时出现） | `DlsMoment` |

- 现状问题：**切 tab 时整个内容区被换掉**，看道/法/术时工具页消失；默认选中第 4 个「器」（`DlsMainLayout.vue:41-44`，`defaultIndex = 3`）
- `DlsMainLayout` 消费方共 3 处：`ToolDetailView.vue`（工具详情）、`ToolsView.vue`（/tools 工具集）、`AboutView.vue`（关于页）；`docs/about`、`docs/tools` 的 4 个 md 均已存在

### 1.2 卡片类元素现状

- 无统一的卡片样式体系，散落为 `bg-base-100/70 backdrop-blur-sm rounded-lg shadow-lg` 等组合类
- 主要卡片清单（详见任务 A）

---

## 二、任务 A：Aura Gold 金光鎏金效果

### A1. 全局工具类（地基）

在 `src/assets/main.css` 末尾新增 `.aura-gold` 工具类，**不改变卡片自身底色**，只叠加金色描边与辉光（伪元素方案，避免与各卡片现有 `bg-*` 冲突）：

```css
/* Aura Gold 金光鎏金：金色渐变描边 + 流光 + 辉光 */
.aura-gold {
  position: relative;
}
.aura-gold::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px; /* 描边宽度，可调 */
  background: linear-gradient(
    115deg,
    #b8860b 0%, #f5d97c 25%, #fff8dc 50%, #fce4a0 65%, #d4a017 85%, #b8860b 100%
  );
  background-size: 300% 300%;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  animation: aura-gold-shine 6s linear infinite;
  pointer-events: none;
  z-index: 0;
}
.aura-gold::after { /* 外层辉光 */
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 0 12px rgba(212, 175, 55, 0.25);
  animation: aura-gold-glow 4s ease-in-out infinite alternate;
  pointer-events: none;
  z-index: 0;
}
@keyframes aura-gold-shine {
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}
@keyframes aura-gold-glow {
  from { box-shadow: 0 0 8px rgba(212, 175, 55, 0.15); }
  to   { box-shadow: 0 0 18px rgba(212, 175, 55, 0.4); }
}
@media (prefers-reduced-motion: reduce) {
  .aura-gold::before,
  .aura-gold::after { animation: none; }
}
```

- 说明：`mask-composite` 让金色只出现在 1px 圆环上，卡片原有背景、`backdrop-blur` 全部保留；卡片自带 `overflow: hidden` 时需注意（若裁掉光环可退化为仅 box-shadow 辉光）
- 后续强度/配色统一由这一个类调，卡片处只需加一个类名

### A2. 核心卡片逐一应用（改动清单）

| # | 文件 | 位置 | 加类目标 |
|---|------|------|---------|
| 1 | `src/views/pages/home/IndexPage.vue` | L25 推荐工具卡片 | `.card.card-hover` 加 `aura-gold` |
| 2 | `src/views/pages/home/ToolsPage.vue` | L97 网格工具卡片 | `.tool-item` 加 `aura-gold` |
| 3 | `src/views/pages/home/ToolsPage.vue` | L41 搜索结果项 | `.search-result-item` 加 `aura-gold` |
| 4 | `src/views/pages/donate/DonatePage.vue` | L19、L35 两张渐变卡 | 加 `aura-gold` |
| 5 | `src/components/layout/DlsComment.vue` | L15、L116 评论卡片 | 加 `aura-gold` |
| 6 | `src/components/layout/DlsChart.vue` | 图表容器 | 加 `aura-gold`（若有圆角容器） |
| 7 | `src/components/layout/DlsSidebar.vue` | L48 搜索下拉 | 加 `aura-gold`（可选） |
| 8 | 弹窗类 `ProgressModal.vue` / `ErrorDialog.vue` / `ToastContainer.vue` | 容器 | 加 `aura-gold`（可选，弹窗少放） |

### A3. 工具页内部面板（约 20 个工具页）

各工具页根面板几乎统一为 `bg-base-100 rounded-lg shadow-lg p-6`（如 `CoordConvertPage.vue:9`、`GisToExcelPage`、`ShpToExcelPage` 等）。

**方案（推荐，二选一）：**

- **方案 A（零侵入，推荐）**：在 `main.css` 加一条低优先级兜底规则，一次性覆盖全部工具页主面板，不改 20 个文件：
  ```css
  /* 工具页主面板统一鎏金（兜底，可整段删除回退） */
  :is(.bg-base-100.rounded-lg.shadow-lg, .bg-base-100\/70.rounded-lg.shadow-lg):not(.no-aura) { ... }
  ```
  注意：该选择器会命中 sidebar 搜索下拉等同类元素，属可接受范围；个别不想套的加 `.no-aura` 排除。
- **方案 B（逐个手工加）**：对 20 个工具页根面板逐个加 `aura-gold`，可控但工作量大、易漏。
- 结果面板（`ElevationsConvertPage.vue:40` 等「结果区」卡片）同样被方案 A 兜底覆盖，无需单列。

### A4. 与任务 B 的联动

- 改版后工具页常驻上方，新外层容器（见任务 B）直接加 `aura-gold`，工具页内部面板是否再叠加由 A3 方案决定（建议工具页内部**不叠**，避免金光过重；只保留外层容器一层鎏金，可读性最佳）

---

## 三、任务 B：道法术器势布局改版（器常驻上方，下方仅切文本）

### B1. 目标布局

```
┌────────────────────────────────────────┐
│  器（真正的工具页面，常驻，永不随 tab 切换）   │  ← aura-holo（第四轮追加，[--aura-radius:0.5rem]）
├────────────────────────────────────────┤
│  道 │ 法 │ 术 │ 器 │ 势                    │  ← tab 栏在下方
├────────────────────────────────────────┤
│  说明文本区（仅此区域随 tab 切换）            │
│  道=tao.md / 法=method.md / 术=tech.md / │
│  器=tool.md（使用注意）/ 势=DlsMoment      │
└────────────────────────────────────────┘
```

### B2. 改动明细

| # | 文件 | 改动 |
|---|------|------|
| 1 | `src/tools/createToolNavItems.ts` | 重构为返回 `{ navItems, toolPage, toolPageProps }`；**「器」tab 改为纯文本** `DlsMdPage(tool.md)`（不再包 `ToolWithMdPage`）；`ToolWithMdPage` 引用删除；势 tab 的 env 开关逻辑保留 |
| 2 | `src/components/layout/DlsMainLayout.vue` | 新增 props：`toolPage?: Component \| null`、`toolPageProps?: Record<string, unknown>`；模板顶部渲染「器」常驻区（`aura aura-holo w-full [--aura-radius:0.5rem]` 光环容器，与下方 tab 同宽，留 `mb-4` 间距），下方才是 tabs-lift；默认 `activeIndex` 从 3 改为 **0（道）** |
| 3 | `src/components/layout/ToolWithMdPage.vue` | **删除**（其职责被 B1 布局取代：工具页常驻上方 + 器 tab 呈现 tool.md「使用注意」） |
| 4 | `src/types/nav.ts` | `ToolWithMdPageProps` 及相关联合类型按新结构收窄（`NavItemProps` 只保留 `DlsMdPageProps \| DlsMomentProps`） |
| 5 | `src/views/layouts/ToolDetailView.vue` | 解构 `createToolNavItems` 返回值，`navItems`、`toolPage`、`toolPageProps` 一并传给 `DlsMainLayout` |
| 6 | `src/views/pages/home/ToolsView.vue` | 同上（`/tools` 页：工具列表常驻上方，下方 tab 切 `docs/tools/*.md`，文件已存在） |
| 7 | `src/views/pages/about/AboutView.vue` | 同上（关于页窗口常驻上方，下方切 `docs/about/*.md`） |

### B3. 交互与样式细节

- tab 交互沿用现有 daisyUI `tabs tabs-lift`（radio input 方案）不动，`tab-in` 切换动画保留
- 器常驻区与下方 tab 区之间留 `mb-4` 间距；tab-content 文本面板保留 `bg-base-100 border-base-300 p-6`（**无 aura**）；`ToolsPage`/`AboutPage` 根节点移除 `mx-6` 保证与 tab 框全宽一致
- 默认选中「道」（文档打头），不再默认器
- 工具加载中（`ToolSkeleton`）逻辑不受影响（`toolComponent` 判断在 `ToolDetailView`）

---

## 四、验收标准

1. **Aura Gold**
   - ~~首页推荐卡、工具集网格卡与搜索结果项~~（2026-08-18 用户反馈太浮夸，已取消）；使用注意卡、关于/打赏卡保留 aura-holo
   - 深色主题（night/dracula 等）与浅色主题下金色均可辨识，不破坏可读性
   - `prefers-reduced-motion` 下无动画（daisyUI 内置）
2. **道法术器势**
   - 进入任意工具页：工具页面常驻上方，切换 道/法/术/器/势 时上方工具**保持不动**，仅下方文本变化
   - 「器」tab 显示 tool.md（使用注意）文本
   - 默认选中「道」
   - `/tools`（工具列表）、`/about` 同样生效
3. **回归**
   - `npm run type-check` 全绿
   - `npm run lint`（eslint/oxlint 涉及文件）通过
   - `vitest run` 450/450 全绿（本次未动被测纯函数）
   - `playwright test` 7/7 全绿（e2e 断言的是 h1 与工具表单、`/tools` 卡片，均在常驻区，不受下方 tab 改造影响）

## 五、实施顺序

1. **批次 1（Aura Gold 地基）**：A1 全局类 → A2 核心卡片 → A4 外层联动 ——（最终形态：daisyUI 官方 aura-holo wrapper，两轮实现后收敛为仅打赏/评论保留）
2. **批次 2（布局改版 ✅）**：`createToolNavItems` 重构 → `DlsMainLayout` → `nav.ts` 收窄 → 三个消费方接线 → 删除 `ToolWithMdPage`
3. **批次 3（收尾）**：~~A3 工具页面板兜底规则~~（弃用）、首页/工具集 aura 取消（用户反馈）、手测 8 主题 × 3 页面、跑验收回归

## 六、风险与备注

- **默认 tab 变化**：从「器」变「道」，首屏行为变化属预期，文案上如需提示可在常驻区底部加一行小字（可选）
- **`:is()` 兜底选择器误伤**：会命中 sidebar 搜索下拉等 `bg-base-100 rounded-lg shadow-lg` 元素，属可接受；如不接受改方案 B 逐个加
- **overflow: hidden 的卡片**：金色圆环用 `inset:0 + mask` 方案绘制在卡片内缘，不会超出自身盒，不受 `overflow:hidden` 影响；辉光 `box-shadow` 才可能被裁（极小概率，可接受）
- **流光动画性能**：`background-position` 动画与 mask 组合在低端机上可能掉帧；`.aura-gold` 数量控制（核心卡片 ≤15 个）+ `will-change` 不加，必要时可关闭 `::before` 动画只留辉光
- **势 tab**：依赖 `VITE_ENABLE_MOMENT_TAB=true`（.env 已开），无后端时图表/评论静默失败，保持现状不处理
- **删除 ToolWithMdPage**：确认无其他引用后再删（当前仅 `createToolNavItems` 引用）
