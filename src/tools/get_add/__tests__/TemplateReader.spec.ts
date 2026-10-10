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
  it('经度留空 → 报错，不产生 (0, x) 的假坐标', () => {
    const result = readAndValidateTemplate([{ 名称: 'A', 经度: '', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
    expect(result.errors.join()).toContain('经度')
  })

  it('纬度留空 → 报错', () => {
    const result = readAndValidateTemplate([{ 名称: 'A', 经度: '116.4', 纬度: '' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
  })

  it('null 单元格 → 报错', () => {
    const result = readAndValidateTemplate([
      { 名称: 'A', 经度: null, 纬度: '39.9' } as unknown as Record<string, string | number>,
    ])

    expect(result.isValid).toBe(false)
  })

  it('正常数据仍然通过', () => {
    const result = readAndValidateTemplate([{ 名称: 'A', 经度: '116.4', 纬度: '39.9' }])

    expect(result.isValid).toBe(true)
    expect(result.data[0]).toMatchObject({ longitude: 116.4, latitude: 39.9 })
  })

  it('脏前缀 "116.4abc" 被拒绝', () => {
    const result = readAndValidateTemplate([{ 名称: 'A', 经度: '116.4abc', 纬度: '39.9' }])

    expect(result.isValid).toBe(false)
    expect(result.data).toHaveLength(0)
  })
})
