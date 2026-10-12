import { describe, it, expect } from 'vitest'
import { readAndValidateTemplate } from '../TemplateReader'

/**
 * 审计报告 P0-1 的回归测试（get_add）
 *
 * 与 `elevations_batch/__tests__/TemplateReader.spec.ts` 的用例集合同构 ——
 * 这两个文件是同一份逻辑的两份拷贝，历史上正是"修一处漏一处"的典型。
 * 两边都保留测试，确保其中任何一份回归都会被发现。
 */
describe('get_add TemplateReader - 空白单元格（P0-1 回归）', () => {
  it('经度留空 → 报错，不产生 (0, x) 的假坐标', async () => {
    const result = await readAndValidateTemplate([{ 名称: 'A', 经度: '', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
    expect(result.errors.join()).toContain('经度')
  })

  it('纬度留空 → 报错', async () => {
    const result = await readAndValidateTemplate([{ 名称: 'A', 经度: '116.4', 纬度: '' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
  })

  it('null 单元格 → 报错', async () => {
    const result = await readAndValidateTemplate([
      { 名称: 'A', 经度: null, 纬度: '39.9' } as unknown as Record<string, string | number>,
    ])

    expect(result.isValid).toBe(false)
  })

  it('正常数据仍然通过', async () => {
    const result = await readAndValidateTemplate([{ 名称: 'A', 经度: '116.4', 纬度: '39.9' }])

    expect(result.isValid).toBe(true)
    expect(result.data[0]).toMatchObject({ longitude: 116.4, latitude: 39.9 })
  })

  it('脏前缀 "116.4abc" 被拒绝', async () => {
    const result = await readAndValidateTemplate([{ 名称: 'A', 经度: '116.4abc', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
  })

  it('传入 onProgress 时逐行上报，percent 单调不减且末次为 100', async () => {
    // 行数 ≥ 1200 以覆盖 ROW_YIELD_INTERVAL=500 的分片让出（i=0/500/1000）。
    const rows: Record<string, string | number>[] = Array.from({ length: 1200 }, (_, i) => ({
      名称: `P${i}`,
      经度: String(116 + (i % 10) * 0.001),
      纬度: String(39 + (i % 10) * 0.001),
    }))

    const percents: number[] = []
    const messages: string[] = []
    const result = await readAndValidateTemplate(rows, (percent, message) => {
      percents.push(percent)
      messages.push(message)
    })

    expect(result.isValid).toBe(true)
    expect(result.data).toHaveLength(1200)

    // 回调确实被调用，且 percent/message 一一对应
    expect(percents.length).toBeGreaterThan(0)
    expect(messages.length).toBe(percents.length)

    // 末次必为 100（校验完成）
    expect(percents[percents.length - 1]).toBe(100)

    // percent 单调不减
    const monotonic = percents.every(
      (percent, i) => i === 0 || percent >= (percents[i - 1] as number),
    )
    expect(monotonic).toBe(true)
  })
})
