# 甘特图 — 术

## 技术架构

本工具基于 **[Frappe Gantt](https://github.com/frappe/gantt)** 开源甘特图库构建，使用 Vue 3 组合式 API 进行封装。

## 技术栈

| 层级 | 技术 |
|------|------|
| **甘特图引擎** | Frappe Gantt v1.x（纯 JavaScript / SVG 渲染） |
| **图标** | @phosphor-icons/vue |
| **数据格式** | JSON（导入/导出） |

## 数据模型

```typescript
interface TaskData {
  id: string           // 唯一标识（数字递增）
  name: string         // 任务名称
  start: string        // 开始日期 (YYYY-MM-DD)
  end: string          // 结束日期 (YYYY-MM-DD)
  progress: number     // 进度 0-100
  dependencies?: string // 依赖任务ID，逗号分隔
  color?: string       // 条形颜色 (CSS颜色值)
  color_progress?: string // 进度条颜色
  custom_class?: string // 自定义CSS类名
}
```

## 组件架构

```
GanttChartPage.vue
├── 工具栏 (视图切换、添加、导入导出等)
├── 甘特图容器 (Frappe Gantt 实例)
├── 任务列表表格 (CRUD 操作)
├── 快捷操作提示 (键盘/鼠标)
└── 添加/编辑任务弹窗 (Modal)
```

## 状态管理

- **任务数据**：使用 Vue `ref` 存储，变更时同步到 Gantt 实例
- **撤销/重做**：基于快照栈（`undoStack` / `redoStack`），每次变更前保存数组拷贝
- **主题适配**：通过 `MutationObserver` 监听 `data-theme` 属性变化

## Frappe Gantt 配置

```typescript
const defaultOptions = {
  view_mode: 'Day',          // 默认视图
  language: 'zh-CN',         // 中文本地化
  popup: customPopupHandler, // 自定义弹窗
  move_dependencies: true,   // 依赖联动
  infinite_padding: true,    // 无限滚动
  // 事件回调
  on_date_change: ...,
  on_progress_change: ...,
  on_view_change: ...,
}
```

## 核心功能实现

### 撤销/重做
- 在每次修改任务前，将当前任务数组深拷贝 push 到 `undoStack`
- 撤销时从 `undoStack` pop，当前数据 push 到 `redoStack`
- 重做时反向操作
- 限制堆栈大小（50），防止内存溢出

### 刷新机制
- 调用 `ganttInstance.refresh(tasks)` 全量刷新甘特图
- 调用 `ganttInstance.update_task(id, changes)` 增量更新单个任务

### 暗色模式
- 通过 CSS 选择器 `[data-theme*='dark']` 覆盖甘特图样式
- `MutationObserver` 实时监听主题切换
