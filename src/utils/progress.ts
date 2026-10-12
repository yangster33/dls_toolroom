/**
 * 长任务进度回调的统一类型（C4 阶段 2 / P2-20）。
 *
 * 历史上仓库里有 3 处**逐字节等价**的本地定义（`geoDataService.ts`、
 * `DistanceCalculator.ts`、`geoAnalysisService.ts`）—— 正是审计 P3-4
 * 「同一逻辑复制 N 份，修一处漏一处」的模式。新代码一律用这里的定义，
 * 既有 3 处改为类型别名指向本文件。
 *
 * 约定：
 * - `percent` 为 0~100 的**整数**百分比（不要把浮点直接塞给 UI，会渲染出 "71.0002%"）；
 * - `message` 为"正在做什么"的文案；
 * - 默认不传回调时行为与改造前完全一致（所有新增参数均为可选）。
 *
 * 第二个参数保持**必填**（与既有 3 处定义逐字节一致）：若改成可选，所有
 * 既有的 `(p, m) => …` 回调都会因严格函数类型而不兼容。
 */
export type ProgressCallback = (percent: number, message: string) => void
