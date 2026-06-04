/**
 * 通用批量地理编码查询骨架
 * 提取 get_add 和 get_lonlat 中完全相同的批量查询循环逻辑
 */
import type { ApiKeyInfo, ApiProvider, QueryProgress } from './amapService'
import { getRandomDelay } from './amapService'

export interface BatchQueryOptions {
  delay: number
  randomDelay: boolean
  minRandomDelay: number
  maxRandomDelay: number
  mixedMode: boolean
}

/**
 * 通用批量地理编码查询
 *
 * @param items - 待查询项数组
 * @param apiKeys - API Key 列表
 * @param options - 查询选项（延迟、混合模式等）
 * @param singleQueryFn - 单次查询函数
 * @param mergeResult - 将单次查询结果合并为最终 TResult（成功时调用）
 * @param onErrorResult - 查询失败时的默认结果（传入 item 和 provider）
 * @param onProgress - 进度回调
 * @param progressMessage - 进度消息生成函数
 */
export async function batchGeocodeQuery<TInput, TPartial, TResult>(
  items: TInput[],
  apiKeys: ApiKeyInfo[],
  options: BatchQueryOptions,
  singleQueryFn: (
    item: TInput,
    apiKey: string,
    provider: ApiProvider,
  ) => Promise<TPartial>,
  mergeResult: (item: TInput, partial: TPartial, provider: ApiProvider) => TResult,
  onErrorResult: (item: TInput, provider: ApiProvider) => TResult,
  onProgress?: (progress: QueryProgress) => void,
  progressMessage?: (item: TInput, index: number, total: number) => string,
): Promise<TResult[]> {
  const results: TResult[] = []
  const validKeys = apiKeys.filter((k) => k.isValid && k.provider)

  if (validKeys.length === 0) {
    throw new Error('没有有效的API Key')
  }

  const firstKey = validKeys[0]
  let currentKeyIndex = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item || !firstKey) continue

    const keyIndex = currentKeyIndex % validKeys.length
    const selectedKey: ApiKeyInfo =
      options.mixedMode && validKeys.length > 1 && validKeys[keyIndex]
        ? validKeys[keyIndex]
        : firstKey
    currentKeyIndex++

    await new Promise((resolve) =>
      setTimeout(
        resolve,
        getRandomDelay(
          options.delay,
          options.randomDelay,
          options.minRandomDelay,
          options.maxRandomDelay,
        ),
      ),
    )

    try {
      const partialResult = await singleQueryFn(
        item,
        selectedKey.key,
        selectedKey.provider!,
      )
      results.push(mergeResult(item, partialResult, selectedKey.provider!))
    } catch {
      results.push(onErrorResult(item, selectedKey.provider!))
    }

    if (onProgress) {
      const msg = progressMessage
        ? progressMessage(item, i, items.length)
        : `正在查询: ${i + 1}/${items.length}`
      onProgress({
        progress: Math.round(((i + 1) / items.length) * 100),
        message: msg,
      })
    }
  }

  return results
}
