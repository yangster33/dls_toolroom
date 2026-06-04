# 术

## 核心框架

### Vue 3
- **用途**：渐进式前端框架，采用组合式 API 构建用户界面
- **官网**：https://vuejs.org/
- **版本**：^3.5.33
- **核心能力**：响应式数据绑定、组件系统、虚拟 DOM、组合式函数复用逻辑

### Vite
- **用途**：下一代前端构建工具
- **官网**：https://vite.dev/
- **版本**：^8.0.3
- **核心能力**：ES 模块原生开发服务器、Rolldown 生产构建、热模块替换（HMR）、CSS 分割、自动 chunk 分包

## 路由与状态

### Vue Router
- **用途**：官方路由管理
- **官网**：https://router.vuejs.org/
- **版本**：^5.0.4
- **核心能力**：HTML5 History 模式、嵌套路由、导航守卫、路由懒加载

### Pinia
- **用途**：Vue 3 官方状态管理库
- **官网**：https://pinia.vuejs.org/
- **版本**：^3.0.4
- **核心能力**：模块化 store、TypeScript 原生支持、DevTools 集成

### pinia-plugin-persistedstate
- **用途**：Pinia 持久化插件，自动将 store 状态同步到 localStorage
- **官网**：https://github.com/prazdevs/pinia-plugin-persistedstate
- **版本**：^4.7.1

## UI 与样式

### Tailwind CSS
- **用途**：原子化 CSS 框架
- **官网**：https://tailwindcss.com/
- **版本**：^4.2.4
- **核心能力**：工具类优先的样式系统、JIT 编译、设计令牌、暗色模式、响应式断点

### daisyUI
- **用途**：基于 Tailwind CSS 的组件库
- **官网**：https://daisyui.com/
- **版本**：^5.5.19
- **核心能力**：语义化组件类名（btn、card、drawer、dropdown）、多主题切换、无 JavaScript 纯 CSS 组件

### radix-vue
- **用途**：无样式、无障碍的基础 UI 组件原语
- **官网**：https://www.radix-vue.com/
- **版本**：^1.9.17
- **核心能力**：符合 WAI-ARIA 标准、键盘导航、焦点管理

### @tailwindcss/typography
- **用途**：Tailwind CSS 排版插件，为 Markdown 渲染内容提供优雅的默认样式
- **官网**：https://github.com/tailwindlabs/tailwindcss-typography
- **版本**：^0.5.19

### class-variance-authority + tailwind-merge + clsx
- **用途**：组件变体管理（CVA）、类名智能合并（tailwind-merge）、条件类名拼接（clsx）
- **官网**：https://cva.style/ | https://github.com/dcastil/tailwind-merge | https://github.com/lukeed/clsx

## 数据可视化与内容渲染

### ECharts + vue-echarts
- **用途**：数据可视化图表库及其 Vue 封装
- **官网**：https://echarts.apache.org/ | https://github.com/ecomfe/vue-echarts
- **版本**：^6.0.0 / ^8.0.1

### markdown-it
- **用途**：Markdown 解析与渲染
- **官网**：https://github.com/markdown-it/markdown-it
- **版本**：^14.1.1

### Mermaid
- **用途**：流程图、时序图等文本驱动图表渲染
- **官网**：https://mermaid.js.org/
- **版本**：^11.14.0

## 图标

### @phosphor-icons/vue
- **用途**：Phosphor 图标库的 Vue 组件封装
- **官网**：https://phosphoricons.com/
- **版本**：^2.2.1

### @iconify/vue
- **用途**：Iconify 统一图标框架，支持 200+ 图标集
- **官网**：https://iconify.design/
- **版本**：^5.0.0

## 工具函数

### @vueuse/core
- **用途**：Vue 组合式函数工具集
- **官网**：https://vueuse.org/
- **版本**：^14.2.1

## 开发工具链

### TypeScript
- **用途**：JavaScript 超集，提供静态类型检查
- **官网**：https://www.typescriptlang.org/
- **版本**：~6.0.0

### vue-tsc
- **用途**：Vue 模板的类型检查工具
- **官网**：https://github.com/vuejs/language-tools
- **版本**：^3.2.6

### ESLint + Prettier + Oxlint
- **用途**：代码规范检查（ESLint）、代码格式化（Prettier）、Rust 编写的高性能 Linter（Oxlint）
- **官网**：https://eslint.org/ | https://prettier.io/ | https://oxc.rs/

### Vitest + Playwright
- **用途**：单元测试（Vitest）、端到端测试（Playwright）
- **官网**：https://vitest.dev/ | https://playwright.dev/
