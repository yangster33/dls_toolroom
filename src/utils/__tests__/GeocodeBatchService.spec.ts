import { describe, it, expect, vi, afterEach } from 'vitest'
import { batchGeocodeQuery, type BatchQueryOptions } from '../GeocodeBatchService'
import type { ApiKeyInfo, ApiProvider } from '../amapService'

const KEY_A: ApiKeyInfo = { id: 'a', provider: 'gaode', key: 'key-a', isValid: true }
const KEY_B: ApiKeyInfo = { id: 'b', provider: 'gaode', key: 'key-b', isValid: true }
const INVALID_KEY: ApiKeyInfo = { id: 'c', provider: null, key: 'key-c', isValid: false }

const OPTIONS: BatchQueryOptions = {
  delay: 0,
  randomDelay: false,
  minRandomDelay: 0,
  maxRandomDelay: 0,
  mixedMode: false,
}

interface BatchResult {
  item: string
  apiKey?: string
  ok?: boolean
  error?: boolean
  provider: ApiProvider
}

const singleQueryFn = vi.fn(
  async (
    _item: string,
    apiKey: string,
    _provider: ApiProvider,
  ): Promise<{ apiKey: string; ok: boolean }> => ({
    apiKey,
    ok: true,
  }),
)
const mergeResult = vi.fn(
  (item: string, partial: { apiKey: string; ok: boolean }, provider: ApiProvider): BatchResult => ({
    item,
    ...partial,
    provider,
  }),
)
const onErrorResult = vi.fn(
  (item: string, provider: ApiProvider): BatchResult => ({ item, error: true, provider }),
)

afterEach(() => {
  vi.restoreAllMocks()
  singleQueryFn.mockReset()
  mergeResult.mockReset()
  onErrorResult.mockReset()
})

describe('batchGeocodeQuery - 前置校验', () => {
  it('无有效 API Key 时抛出错误', async () => {
    await expect(
      batchGeocodeQuery(['a'], [INVALID_KEY], OPTIONS, singleQueryFn, mergeResult, onErrorResult),
    ).rejects.toThrow('没有有效的API Key')
  })

  it('空 Key 列表抛出错误', async () => {
    await expect(
      batchGeocodeQuery(['a'], [], OPTIONS, singleQueryFn, mergeResult, onErrorResult),
    ).rejects.toThrow('没有有效的API Key')
  })

  it('空条目列表返回空结果', async () => {
    const results = await batchGeocodeQuery(
      [],
      [KEY_A],
      OPTIONS,
      singleQueryFn,
      mergeResult,
      onErrorResult,
    )
    expect(results).toEqual([])
  })
})

describe('batchGeocodeQuery - 查询循环', () => {
  it('成功查询合并结果', async () => {
    const results = await batchGeocodeQuery(
      ['甲', '乙'],
      [KEY_A],
      OPTIONS,
      singleQueryFn,
      mergeResult,
      onErrorResult,
    )
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({ item: '甲', apiKey: 'key-a', ok: true, provider: 'gaode' })
    expect(singleQueryFn).toHaveBeenCalledTimes(2)
    expect(mergeResult).toHaveBeenCalledTimes(2)
    expect(onErrorResult).not.toHaveBeenCalled()
  })

  it('查询失败时使用错误结果', async () => {
    singleQueryFn.mockRejectedValueOnce(new Error('网络错误'))
    const results = await batchGeocodeQuery(
      ['甲'],
      [KEY_A],
      OPTIONS,
      singleQueryFn,
      mergeResult,
      onErrorResult,
    )
    expect(results[0]).toEqual({ item: '甲', error: true, provider: 'gaode' })
  })

  it('非混合模式始终使用第一个有效 Key', async () => {
    await batchGeocodeQuery(
      ['甲', '乙'],
      [KEY_A, KEY_B],
      OPTIONS,
      singleQueryFn,
      mergeResult,
      onErrorResult,
    )
    expect(singleQueryFn.mock.calls.map((c) => c[1])).toEqual(['key-a', 'key-a'])
  })

  it('混合模式按顺序轮换 Key', async () => {
    await batchGeocodeQuery(
      ['甲', '乙', '丙'],
      [KEY_A, KEY_B],
      { ...OPTIONS, mixedMode: true },
      singleQueryFn,
      mergeResult,
      onErrorResult,
    )
    expect(singleQueryFn.mock.calls.map((c) => c[1])).toEqual(['key-a', 'key-b', 'key-a'])
  })
})

describe('batchGeocodeQuery - 进度', () => {
  it('进度回调覆盖全部条目且最后为 100', async () => {
    const onProgress = vi.fn()
    await batchGeocodeQuery(
      ['甲', '乙', '丙'],
      [KEY_A],
      OPTIONS,
      singleQueryFn,
      mergeResult,
      onErrorResult,
      onProgress,
    )
    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress.mock.calls.map((c) => c[0].progress)).toEqual([33, 67, 100])
    expect(onProgress.mock.calls[2]![0].message).toBe('正在查询: 3/3')
  })

  it('自定义进度消息函数生效', async () => {
    const onProgress = vi.fn()
    await batchGeocodeQuery(
      ['甲'],
      [KEY_A],
      OPTIONS,
      singleQueryFn,
      mergeResult,
      onErrorResult,
      onProgress,
      (item, i, total) => `${item}(${i + 1}/${total})`,
    )
    expect(onProgress.mock.calls[0]![0].message).toBe('甲(1/1)')
  })
})
