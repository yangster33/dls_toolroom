/**
 * frappe-gantt 的最小环境类型声明
 *
 * ⚠️ 本文件必须是「纯环境声明」——不能有任何顶层 import/export 语句，
 * 否则 `declare module` 会退化成模块增强（module augmentation），
 * 而 import 'frappe-gantt' 仍然解析不到类型（TS7016）。
 *
 * 背景：frappe-gantt@1.2.2 不附带类型定义（package.json 无 types/typings，
 * exports 也没导出 ./package.json）。原实现用 `// @ts-ignore` 压掉 import 错误，
 * 然后满屏 `as any` 访问实例内部状态（gantt_start / tasks / layers / make_arrows）。
 *
 * eslint 的 ban-ts-comment 与 no-explicit-any 都不允许这么做，所以这里补一份
 * 手写声明：只覆盖本项目**实际使用**的 API 面，不假装完整。
 *
 * 以下边界均已核对源码 node_modules/frappe-gantt/dist/frappe-gantt.es.js：
 * - popup 的 title/subtitle/details 走 innerHTML → 上游必须自行转义
 *   （GanttChartPage 已用 escapeHtml 处理）
 * - tasks / arrows / layers / make_arrows / map_arrows_on_bars 是内部实现，
 *   标为 @internal，升级依赖时需复查
 * - 构造函数经 bind_events() 注册匿名 document 监听器且库不提供移除方式，
 *   重复 new Gantt() 会累积监听器（已记录为性能问题）
 */

declare module 'frappe-gantt' {
  /** 一个甘特条任务（本项目侧的输入类型） */
  export interface FrappeGanttTask {
    id: string
    name: string
    start: string
    end: string
    progress: number
    dependencies: string | string[]
    custom_class?: string
    color?: string
    color_progress?: string
  }

  /** frappe-gantt 内部的 _Task 表示 */
  export interface FrappeGanttInternalTask {
    id: string
    name: string
    /** 原始输入值（字符串），setup_tasks 里 `e._start = parse(e.start)` */
    start: string
    /** 原始输入值（字符串） */
    end: string
    progress: number
    dependencies: string[]
    custom_class?: string
    color?: string
    /** 解析后的起止时间，改任务后需 delete 才能触发重算 */
    _start?: Date
    _end?: Date
    /** 排除节假日后的实际工期（天） */
    actual_duration?: number
    ignored_duration?: number
    duration?: number
  }

  /** 单个节假日条目 */
  export interface FrappeGanttHolidaySpec {
    date: string
    name: string
  }

  export type FrappeGanttHolidayMatcher = (date: Date) => boolean
  /** 兼容源码里对数组元素的宽松写法 */
  export type FrappeGanttSpec = FrappeGanttHolidaySpec | string
  export type FrappeGanttMatcher = FrappeGanttHolidayMatcher

  export interface FrappeGanttOptions {
    view_mode?: string
    view_modes?: string[]
    view_mode_select?: boolean
    today_button?: boolean
    scroll_to?: string | number
    language?: string
    popup_on?: string
    snap_at?: string
    lines?: string
    upper_limit?: number
    lower_limit?: number
    is_draggable?: boolean
    bar_height?: number
    padding?: number
    date_format?: string
    readonly?: boolean
    /** 是否显示「预期进度」细线 */
    show_expected_progress?: boolean
    /** 锁定起止日期不可拖拽 */
    readonly_dates?: boolean
    /** 锁定进度不可拖拽 */
    readonly_progress?: boolean
    /** 拖动任务时连带移动依赖它的任务 */
    move_dependencies?: boolean
    /** 容器高度是否自适应内容 */
    infinite_padding?: boolean
    /** 依赖箭头曲率 */
    arrow_curve?: number
    /** 甘特条圆角 */
    bar_corner_radius?: number
    /** 容器高度（像素或 'auto'） */
    container_height?: number | 'auto'
    /**
     * 排除日期（不计入工期）。
     * 'weekend' → 用 is_weekend 判定；也可传具体日期字符串数组。
     * 注意：不能传 undefined，setup_options 会 for...of undefined 抛错；
     * 要清除请传空数组。
     */
    ignore?: 'weekend' | string[] | FrappeGanttHolidayMatcher
    /** 周末判定函数，默认 getDay() 为 0 或 6 */
    is_weekend?: FrappeGanttHolidayMatcher
    /**
     * 节假日高亮。
     *
     * 键只是条目 id（仅用于标签查找，本身无语义），**值**才是语义：
     * - 'weekend' → 改用 is_weekend 判定周末
     * - { date, name } → 匹配具体日期
     * - 含函数的数组 / 函数 → 自定义匹配
     *
     * ⚠️ `holidays: { 'var(--g-weekend-highlight-color)': 'weekend' }` 这个写法
     * 直接抄自 frappe-gantt 自己的默认配置（dist 源码里 setup_options 的默认值
     * 就是这个键），所以它是有效的：值为 'weekend' 即触发 is_weekend 判定。
     * 键名是 CSS 变量名纯属历史，无语义影响。
     */
    holidays?: Record<
      string,
      | 'weekend'
      | FrappeGanttHolidaySpec
      | Array<FrappeGanttSpec | FrappeGanttMatcher>
      | FrappeGanttHolidayMatcher
    >
    /** 自定义 popup 渲染回调 */
    popup?: (ctx: FrappeGanttPopupContext) => void
    /** 点击甘特条空白处的回调 */
    on_click?: (task: FrappeGanttInternalTask) => void
    /** 点击日期区域 */
    on_date_change?: (task: FrappeGanttInternalTask, start: Date, end: Date) => void
    /** 进度变化 */
    on_progress_change?: (task: FrappeGanttInternalTask, progress: number) => void
    /** 视图切换 */
    on_view_change?: (mode: string) => void
  }

  export interface FrappeGanttLayers {
    grid: HTMLElement
    date: HTMLElement
    bar: HTMLElement
    arrow: HTMLElement
    popup_show: boolean
  }

  /**
   * popup 回调的上下文。
   *
   * ⚠️ set_title / set_subtitle / set_details 在库里走 innerHTML，
   * 所以传入内容必须先自行转义（本项目已用 escapeHtml 处理）。
   * 它们接受 string | Date——库里直接 innerHTML = a，Date 会被 toString。
   */
  export interface FrappeGanttPopupContext {
    task: FrappeGanttInternalTask
    chart: Gantt
    get_title(): string
    set_title(text: string | Date): void
    get_subtitle(): string
    set_subtitle(text: string | Date): void
    get_details(): string
    set_details(text: string | Date): void
    /** 添加 popup 操作按钮。text 可为函数，handler 收 (task, chart) */
    add_action(
      text: string | ((task: FrappeGanttInternalTask) => string),
      handler: (task: FrappeGanttInternalTask, chart: Gantt) => void,
    ): void
  }

  export default class Gantt {
    constructor(element: HTMLElement, tasks: FrappeGanttTask[], options?: FrappeGanttOptions)

    /** 视图最早/最晚日期 */
    readonly gantt_start: Date
    readonly gantt_end: Date

    /** @internal 内部任务数组 */
    readonly tasks: FrappeGanttInternalTask[]
    /** @internal 依赖箭头 SVG 元素数组（库里 make_arrows 时会整体重赋值） */
    arrows: SVGElement[]
    /** @internal SVG 图层容器 */
    readonly layers: FrappeGanttLayers

    refresh(tasks?: FrappeGanttTask[]): void
    change_view_mode(mode: string): void
    update_options(options: Partial<FrappeGanttOptions>): void
    update_task(id: string, updates: Partial<FrappeGanttTask>): void
    scroll_current(): void

    /** @internal 重绘依赖箭头 */
    make_arrows(): void
    /** @internal 把箭头对齐到条上 */
    map_arrows_on_bars(): void
  }
}
