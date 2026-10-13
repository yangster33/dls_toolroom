/**
 * xlsx 生成的主线程出口（C4 阶段 4）
 *
 * 分层（这是为了把「生成」搬进 Worker 而必须的解耦）：
 * - `./exceljsCore.ts`：纯粹的 exceljs 生成实现（worker 与主线程共用，不依赖任何管线）
 * - `./filePipelineClient.ts`：Worker 客户端（写路径的降级回退会调 core）
 * - 本文件：给页面用的主线程 API，`writeXlsx` 走 Pipeline（默认进 Worker，不可用时自动降级）
 *
 * 为什么不再由本文件直接实现生成：旧实现里 worker 与本模块都 import 同一份 exceljs 代码，
 * 一旦本模块又依赖 Pipeline，就会形成「worker → 本模块 → Pipeline → worker」的环。
 * 把实现下沉到 core 之后：worker → core，本模块 → Pipeline → core，环就断了。
 */
export {
  writeXlsxBlob as writeXlsxCore,
  downloadXlsxBlob,
  collectHeaders,
  rowsFromObjects,
  safeSheetName,
  type SheetSpec,
} from './exceljsCore'
import type { SheetSpec } from './exceljsCore'
import { filePipeline } from './filePipelineClient'
import type { ProgressCallback } from './progress'

/**
 * 生成 xlsx Blob —— 默认在 Worker 里跑（exceljs 的 `writeBuffer` 是单一同步块，
 * 5 万行 × 9 列实测约 2.4~2.8s，是导出链路里最后一块占用主线程的硬骨头）。
 *
 * Worker 不可用时自动降级到主线程的同一份实现，产物一致。
 *
 * @param sheets 一个或多个工作表
 * @param onProgress 进度回调（可选）
 * @param signal 取消信号（可选）：abort 时 terminate worker
 */
export async function writeXlsx(
  sheets: readonly SheetSpec[],
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<Blob> {
  // Worker 首次要下载并 eval chunk：先画一帧，别让进度停在 0% 干等
  onProgress?.(0, '正在准备生成文件...')
  return filePipeline.write(sheets, onProgress, signal)
}
