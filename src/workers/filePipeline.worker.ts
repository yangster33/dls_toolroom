/**
 * 文件生成/解析管线 Worker（C4 阶段 4 / P2-20）
 *
 * 承接两类最重的纯计算工作，把它们从主线程搬走：
 * - `parse`：File → 二维矩阵（`XLSX.read` + `sheet_to_json`，单一不可中断同步块）
 * - `write`：SheetSpec[] → xlsx Blob（exceljs 逐行 addRow + writeBuffer）
 *
 * **不承接**「逐行校验」：`validateRow` 是调用方的函数，无法结构化克隆进 Worker。
 * 那部分留在主线程，由 `utils/TemplateReader` 的 500 行分片让出兜住。
 *
 * 协议见 `./filePipelineClient.ts`（请求从这里发，响应回那里）。
 */
/// <reference lib="webworker" />
import { parseTemplateMatrix, type CellValue } from '@/utils/templateMatrix'
import { writeXlsx, type SheetSpec } from '@/utils/exceljsPipeline'
import type { ProgressCallback } from '@/utils/progress'

export interface WorkerParseRequest {
  id: number
  kind: 'parse'
  payload: {
    file: File
  }
}

export interface WorkerWriteRequest {
  id: number
  kind: 'write'
  payload: {
    sheets: SheetSpec[]
  }
}

export type WorkerRequest = WorkerParseRequest | WorkerWriteRequest

export type WorkerResponse =
  | { id: number; type: 'progress'; percent: number; message: string }
  | { id: number; type: 'ok'; kind: 'parse'; rawData: CellValue[][]; fileHeaders: string[] }
  | { id: number; type: 'ok'; kind: 'write'; blob: Blob }
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
    if (request.kind === 'parse') {
      const { rawData, fileHeaders } = await parseTemplateMatrix(request.payload.file, onProgress)
      post({ id: request.id, type: 'ok', kind: 'parse', rawData, fileHeaders })
      return
    }

    const blob = await writeXlsx(request.payload.sheets, onProgress)
    post({ id: request.id, type: 'ok', kind: 'write', blob })
  } catch (error) {
    post({
      id: request.id,
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
