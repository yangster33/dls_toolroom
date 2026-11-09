import { describe, it, expect } from 'vitest'
import { matrixToRows } from '../templateMatrix'

describe('matrixToRows', () => {
  it('按表头生成行对象，空单元格补空串', async () => {
    const result = await matrixToRows({
      fileHeaders: ['名称', '经度', '纬度'],
      rawData: [
        ['名称', '经度', '纬度'],
        ['A', 116.4, 39.9],
        ['B', '', ''],
      ],
    })

    expect(result.columns).toEqual(['名称', '经度', '纬度'])
    expect(result.rows).toEqual([
      { 名称: 'A', 经度: 116.4, 纬度: 39.9 },
      { 名称: 'B', 经度: '', 纬度: '' },
    ])
  })

  it('跳过整行空白的行，但仍保留表头列', async () => {
    const result = await matrixToRows({
      fileHeaders: ['名称', '经度', '纬度'],
      rawData: [
        ['名称', '经度', '纬度'],
        ['', '', ''],
        ['A', '116.4', '39.9'],
      ],
    })

    expect(result.rows).toEqual([{ 名称: 'A', 经度: '116.4', 纬度: '39.9' }])
  })

  it('表头为空时仍保持列数，不会让列凭空消失', async () => {
    const result = await matrixToRows({
      fileHeaders: ['名称', '', '纬度'],
      rawData: [
        ['名称', '', '纬度'],
        ['A', 'x', '39.9'],
      ],
    })

    expect(result.rows[0]).toEqual({ 名称: 'A', '': 'x', 纬度: '39.9' })
  })

  it('已取消时抛 AbortError，不返回半成品', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      matrixToRows(
        {
          fileHeaders: ['名称'],
          rawData: [['名称'], ['A']],
        },
        undefined,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('上报 0→99→100 进度', async () => {
    const reports: number[] = []
    await matrixToRows(
      {
        fileHeaders: ['名称'],
        rawData: [['名称'], ['A'], ['B']],
      },
      (percent) => reports.push(percent),
    )

    expect(reports[0]).toBe(0)
    expect(reports[reports.length - 1]).toBe(100)
    expect(reports.every((p) => p >= 0 && p <= 100)).toBe(true)
  })
})
