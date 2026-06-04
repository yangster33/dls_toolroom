# 术

## 工具动态加载系统

工具页面采用按需加载架构，每个工具独立打包为异步模块，仅在用户首次访问时加载。

```typescript
// 使用 Vite 的 import.meta.glob 实现工具页面的按需懒加载
const pagesGlob = import.meta.glob('@/tools/*/*Page.vue')

// 每个工具页面通过 defineAsyncComponent 包装为异步组件
for (const [path, loader] of Object.entries(pagesGlob)) {
  const match = path.match(/@\/tools\/([^/]+)\/([^/]+)Page\.vue$/)
  if (match && match[1]) {
    componentMap[match[1]] = defineAsyncComponent(loader)
  }
}
```

每个工具页面的路由也是动态的：

```typescript
{
  path: 'tools/:toolId',
  name: 'ToolDetail',
  component: () => import('@/views/layouts/ToolDetailView.vue'),
}
```

## 工具配置声明式注册

所有工具通过统一的配置数组注册，包括名称、描述、图标、标签和文档类型：

- **@phosphor-icons/vue**：提供 PhMapPin、PhArrowsOutCardinal 等图标，每个工具独立按需引入
- **nav.ts 类型系统**：定义 NavItem、ComponentMap 等接口，确保工具注册的类型安全

## 工具详情页组件映射

`ToolDetailView` 根据路由参数 `toolId` 从配置中查找工具信息，再通过组件映射表加载对应的页面组件。`createToolNavItems` 函数为每个工具生成"道法术器"导航标签，包含 MdPage（文档渲染）、ToolWithMdPage（工具+文档）和 Moment（动态）等多种布局模板。
