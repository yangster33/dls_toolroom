# 大龙山 · 标识方案 01「山脊 / 信号」

> 山脊之上，信号可达。

## 概念

大龙山工具间目前是一套通信工程科研、规划与设计工具集，未来会演进为大龙山实验室。
标识因此不绑定“工具”这一具体形态，而是回到更稳定的三件事：**山、信号、图纸**。

- **两道山脊**：延续原双山图标，一大一小、一高一低，指代大龙山。
- **桅杆与信号弧**：较高山峰同时是基站桅杆；信号弧以塔顶黄点为中心，右侧两道、左侧三道，外圈半径 28，左侧多出的一瓣朝左上延伸，补住重心空白。
- **基准线与黄点**：底部测量基准线把图形固定在图纸上；塔顶赭黄点是站点，也是全标识唯一的热色。

同一枚符号可同时用于「工具间」与「实验室」，更名时只替换字标。

### 几何参数（96 × 96 网格）

- 基准线：`y = 86`，线宽 4（覆盖 `84…88`）。
- 山体：相对初版高度缩短 1/3，山峰落在 `y = 64.17 / 56.17`；山脚延长至 `y = 90` 并以 `y = 88` 裁切，与基准线重叠后再由基准线覆盖，交界没有缝隙，也没有线条越过地平线底部。
- 桅杆：从 `y = 56.17` 到 `y = 34.7`，高度为上一版的 2/3。
- 站点：圆心 `(64, 34.7)`，半径 6.8（初版 3.4 的两倍）。
- 信号弧：以站点为圆心，半径 13 / 20 / 28；左侧三道、右侧两道，弧段均为 ±40°。左侧第三道端点为 `(42.55, 16.7)` 与 `(42.55, 52.7)`。
- 应用图标：在 96 网格内把符号组整体平移 `(-3, -4)`（`translate(4.68 3.68) scale(0.84)`），让视觉重心回到蓝底中心；符号自身几何不变。

## 文件

```
public/brand/
├── logo-mark.svg              独立符号 · 白图（蓝线）
├── logo-mark-dark.svg         独立符号 · 蓝图（浅蓝线）
├── logo-mark-mono.svg         独立符号 · 单色（currentColor）
├── logo-lockup.svg            横版组合 · 工具间 · 白图
├── logo-lockup-dark.svg       横版组合 · 工具间 · 蓝图
├── logo-lockup-lab.svg        横版组合 · 实验室 · 白图
├── logo-lockup-lab-dark.svg   横版组合 · 实验室 · 蓝图
├── logo-app.svg               应用图标 / favicon 源文件
├── og-cover.png               1200 × 630 社交分享封面
└── png/
    ├── logo-app-512.png
    ├── logo-app-192.png
    ├── logo-app-180.png       （apple-touch-icon）
    ├── favicon-32.png
    ├── logo-mark-512.png
    ├── logo-mark-dark-512.png
    ├── logo-lockup-1032.png
    └── logo-lockup-dark-1032.png
```

`public/favicon.ico` 由 `logo-app.svg` 生成，内含 16 / 32 / 48 / 256 四个尺寸。

设计稿与说明页：`design/logo/preview.html`（渲染图 `preview.png`）。
方向对照：`design/logo/wind-study.html`（风图标）、`design/logo/upper-left-studies.html`（左上角填空，渲染图 `upper-left-studies.png`）；`design/logo/left-lobe-study.html`（左侧波瓣，渲染图 `left-lobe-study.png`）中的 **L1 已并入定稿**——左侧第三道弧，`r 28 / ±40°`。

## 色板

| 名称 | 值 | 用途 |
| --- | --- | --- |
| 蓝图蓝 Blueprint | `#16588C` | 白图模式主色 |
| 基准黄 Survey Point | `#D6A21C` | 塔顶站点，唯一强调色 |
| 图纸白 Drawing Paper | `#F4F3EC` | 浅色底 |
| 蓝图夜 Blueprint Night | `#121D2B` | 深色底 |
| 蓝图浅蓝 Blueprint Light | `#9AC8E6` | 蓝图模式主色 |

## 字体

- 中文名：长仿宋 / 仿宋（`FangSong`, `STFangsong`, `Noto Serif SC`），呼应工程制图图签。
- 辅助说明：思源黑体 / 系统黑体。
- 英文行：等宽字体（JetBrains Mono / Consolas），字距放大。

> SVG 中的文字仍为可编辑文本，依赖本机字体。用于印刷或需要绝对一致时，请先在矢量软件中把文字转曲。

## 使用规则

- **安全区**：四周不小于符号宽度的 8%（约一个山峰高度的 1/4）。
- **最小尺寸**：横版组合不小于 120 px 宽；独立符号不小于 24 px；印刷符号不小于 8 mm。
- **小尺寸**：16–32 px 优先使用 `logo-app.svg` 的蓝底实心图标。
- **不要**：改变线宽比例、旋转山脊、给右侧补第三道弧（左右不对称是定稿的一部分）、把黄点换成其他彩色、给线条加渐变或阴影。
- **主题**：白图用 `#16588C` 线，蓝图用 `#9AC8E6` 线；黄点位置与明度不变。

## 接入状态

- 站点页头已接入独立符号：`logo-mark.svg` 28 px + 现有文字，蓝图主题下自动切换为 `logo-mark-dark.svg`。
- `index.html` 已接入 `logo-app.svg`、`favicon-32.png` 与 `apple-touch-icon`；`og:image` 已指向 `/brand/og-cover.png`。
- PNG / ICO / 社交图 / 预览图由 `npm run brand:build` 从 SVG 重新导出（默认用本机 Edge，或先 `npx playwright install chromium`）。
- 未来更名实验室时，只替换字标文案与 `logo-lockup-lab*.svg`。
