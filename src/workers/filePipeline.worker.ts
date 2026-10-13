/**
 * 文件解析管线 Worker（C4 阶段 4 / P2-20）
 *
 * 只承接「表格解析」这一件事：`File → 二维矩阵`（`XLSX.read` + `sheet_to_json`，
 * 导入链路里最重的单一同步块）。
 *
 * 为什么不承接「xlsx 生成」（exceljs）：`writeXlsx` 是主线程与 worker 都会用到的
 * 公共实现，而 client 若在 worker 里调它会形成循环依赖。彻底解耦需要把
 * 「exceljs 生成」抽成第三个模块（D 档工作）。在此之前，把 write 放进 worker
 * 只会让 worker chunk 白胖 ~900KB（exceljs 死货）。
 *
 * **不承接**「逐行校验」：`validateRow` 是调用方的函数，无法结构化克隆进 Worker。
 * 那部分留在主线程，由 `utils/TemplateReader` 的 500 行分片让出兜住。
 *
 * 协议见 `./filePipelineClient.ts`（请求从那里发，响应回那里）。
 */
/// <reference lib="webworker" />
import { parseTemplateMatrix, type CellValue } from '@/utils/templateMatrix'
import type { ProgressCallback } from '@/utils/progress'

export interface WorkerParseRequest {
  id: number
  kind: 'parse'
  payload: {
    file: File
  }
}

export type WorkerRequest = WorkerParseRequest

export interface WorkerParseResult {
  rawData: CellValue[][]
  fileHeaders: string[]
}

export type WorkerResponse =
  | { id: number; type: 'progress'; percent: number; message: string }
  | ({ id: number; type: 'ok'; kind: 'parse' } & WorkerParseResult)
  | { id: number; type: 'error'; message: string }

const post = (response: WorkerResponse) => {
  ;(self as unknown as DedicatedWorkerGlobalScope).postMessage(response)
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  const onProgress: ProgressCallback = (percent, message) => {
    post({ id: request.id, type: 'progress', percent, message })
  }

  try {
    const { rawData, fileHeaders } = await parseTemplateMatrix(request.payload.file, onProgress)
    post({ id: request.id, type: 'ok', kind: 'parse', rawData, fileHeaders })
  } catch (error) {
    post({
      id: request.id,
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
