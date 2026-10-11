import { describe, it, expect, vi } from 'vitest'
import {
  batchConvertCoordinates,
  resolveInputSystem,
  convertToCsv,
  convertToXlsx,
  type DataRow,
} from '../coordsConversion'

function row(name: string, lng: string | number, lat: string | number): DataRow {
  return { 名称: name, '经度/X（必填）': lng, '纬度/Y（必填）': lat }
}

describe('batchConvertCoordinates - 前置校验', () => {
  it('空数据返回错误', async () => {
    const result = await batchConvertCoordinates([], {
      inputSystem: 'wgs84',
      outputSystem: 'gcj02',
    })
    expect(result.success).toBe(false)
    expect(result.errors).toEqual(['没有可转换的数据'])
  })

  it('不支持的输入坐标系', async () => {
    const result = await batchConvertCoordinates([row('甲', '116.4', '39.9')], {
      inputSystem: 'mars',
      outputSystem: 'wgs84',
    })
    expect(result.errors).toEqual(['不支持的输入坐标系: mars'])
  })

  it('不支持的输出坐标系', async () => {
    const result = await batchConvertCoordinates([row('甲', '116.4', '39.9')], {
      inputSystem: 'wgs84',
      outputSystem: 'mars',
    })
    expect(result.errors).toEqual(['不支持的输出坐标系: mars'])
  })

  it('缺少经度/X 或纬度/Y 列', async () => {
    const result = await batchConvertCoordinates([{ 名称: '甲' }], {
      inputSystem: 'wgs84',
      outputSystem: 'gcj02',
    })
    expect(result.errors).toEqual(['数据中缺少经度/X或纬度/Y列'])
  })
})

describe('batchConvertCoordinates - 转换', () => {
  it('成功转换并输出完整表头', async () => {
    const result = await batchConvertCoordinates(
      [row('甲', '116.4', '39.9'), row('乙', '117.5', '40.1')],
      { inputSystem: 'wgs84', outputSystem: 'gcj02' },
    )
    expect(result.success).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.totalRows).toBe(2)
    expect(result.processedRows).toBe(2)
    expect(result.outputHeaders).toEqual([
      '名称',
      '经度/X（WGS84）',
      '纬度/Y（WGS84）',
      '经度/X（GCJ-02）',
      '纬度/Y（GCJ-02）',
    ])
    expect(result.data).toHaveLength(2)
    const first = result.data[0]!
    expect(first['名称']).toBe('甲')
    expect(first['经度/X（WGS84）']).toBe(116.4)
    expect(Math.abs((first['经度/X（GCJ-02）'] as number) - 116.4)).toBeGreaterThan(0.0005)
  })

  it('无名称列时使用点位+行号', async () => {
    const rows = [{ '经度/X（必填）': '116.4', '纬度/Y（必填）': '39.9' }]
    const result = await batchConvertCoordinates(rows, {
      inputSystem: 'wgs84',
      outputSystem: 'wgs84',
    })
    expect(result.data[0]!['名称']).toBe('点位1')
  })

  it('非法坐标行记录错误并继续', async () => {
    const result = await batchConvertCoordinates(
      [row('甲', '116.4', '39.9'), row('乙', 'abc', '39.9'), row('丙', '116.4', '39.9')],
      { inputSystem: 'wgs84', outputSystem: 'wgs84' },
    )
    expect(result.success).toBe(true)
    expect(result.processedRows).toBe(2)
    expect(result.errors).toEqual(['第 2 行: 坐标值不是有效的数字'])
  })

  it('全部行非法时 success 为 false', async () => {
    const result = await batchConvertCoordinates([row('甲', 'abc', '39.9')], {
      inputSystem: 'wgs84',
      outputSystem: 'wgs84',
    })
    expect(result.success).toBe(false)
  })

  it('提前中止返回已取消错误', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await batchConvertCoordinates([row('甲', '116.4', '39.9')], {
      inputSystem: 'wgs84',
      outputSystem: 'gcj02',
      abortSignal: controller.signal,
    })
    expect(result.success).toBe(false)
    expect(result.errors).toEqual(['转换已被取消'])
  })
})

describe('batchConvertCoordinates - 进度', () => {
  it('按批次上报进度', async () => {
    const onProgress = vi.fn()
    const rows = Array.from({ length: 60 }, (_, i) => row(`点${i + 1}`, '116.4', '39.9'))
    await batchConvertCoordinates(rows, {
      inputSystem: 'wgs84',
      outputSystem: 'wgs84',
      batchSize: 50,
      onProgress,
    })
    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress.mock.calls[0]![0].processedRows).toBe(50)
    expect(onProgress.mock.calls[1]![0].progress).toBe(100)
    expect(onProgress.mock.calls[1]![0].totalRows).toBe(60)
  })

  it('进度信息包含剩余时间估算', async () => {
    const onProgress = vi.fn()
    await batchConvertCoordinates([row('甲', '116.4', '39.9')], {
      inputSystem: 'wgs84',
      outputSystem: 'wgs84',
      onProgress,
    })
    const info = onProgress.mock.calls[0]![0]
    expect(info.progress).toBe(100)
    expect(info.estimatedRemainingTime).toBe(0)
    expect(info.elapsedTime).toBeGreaterThanOrEqual(0)
  })
})

describe('convertToCsv', () => {
  it('空数据或空表头返回空字符串', () => {
    expect(convertToCsv([], ['a'])).toBe('')
    expect(convertToCsv([{ a: 1 }], [])).toBe('')
  })

  it('生成带 BOM 的 CSV', () => {
    const csv = convertToCsv([{ 名称: '甲' }], ['名称'])
    expect(csv).toBe('\uFEFF名称\n甲')
  })

  it('逗号与引号字段转义', () => {
    const csv = convertToCsv([{ 备注: '他说 "你好",是吧' }], ['备注'])
    expect(csv).toBe('\uFEFF备注\n"他说 ""你好"",是吧"')
  })

  it('null/undefined 值输出为空', () => {
    const csv = convertToCsv([{ a: null, b: undefined }], ['a', 'b'])
    expect(csv).toBe('\uFEFFa,b\n,')
  })

  it('表头含特殊字符时转义', () => {
    const csv = convertToCsv([{ '名,称': '值' }], ['名,称'])
    expect(csv).toBe('\uFEFF"名,称"\n值')
  })
})

describe('convertToXlsx', () => {
  it('空数据返回空 Blob', () => {
    const blob = convertToXlsx([], ['a'])
    expect(blob.size).toBe(0)
    expect(blob.type).toBe('application/octet-stream')
  })

  it('返回 xlsx Blob', () => {
    const blob = convertToXlsx([{ 名称: '甲' }], ['名称'])
    expect(blob.type).toContain('spreadsheetml')
    expect(blob.size).toBeGreaterThan(0)
  })
})

/**
 * 审计 C2 / P0-5 余项：转换必须按【上传时】的输入坐标系解释数据，
 * 而不是用户当前下拉里选的那个。
 */
describe('resolveInputSystem', () => {
  it('尚无成功上传的数据时，用当前选择', () => {
    const r = resolveInputSystem('', 'gcj02')
    expect(r.effectiveSystem).toBe('gcj02')
    expect(r.mismatched).toBe(false)
  })

  it('快照与当前一致时，正常且不提示', () => {
    const r = resolveInputSystem('wgs84', 'wgs84')
    expect(r.effectiveSystem).toBe('wgs84')
    expect(r.mismatched).toBe(false)
  })

  it('上传后改了输入坐标系：仍按快照解释，并标记不一致', () => {
    // 关键用例：数据是按 wgs84 校验的，用户把下拉改成了 cgcs2000_xy。
    // 旧行为会按 cgcs2000_xy 解释经纬度值 —— 静默出错。
    const r = resolveInputSystem('wgs84', 'cgcs2000_xy')
    expect(r.effectiveSystem).toBe('wgs84')
    expect(r.mismatched).toBe(true)
  })

  it('同模式但不同系统时也标记不一致（gcj02 → bd09）', () => {
    const r = resolveInputSystem('gcj02', 'bd09')
    expect(r.effectiveSystem).toBe('gcj02')
    expect(r.mismatched).toBe(true)
  })

  it('反证：沿用旧的「按当前下拉解释」确实会算出不同结果', async () => {
    // 这份数据上传时是按 wgs84（经纬度）校验的，之后用户把下拉改成了 gcj02。
    const rows = [row('A', 116.4, 39.9)]

    const bySnapshot = await batchConvertCoordinates(rows, {
      inputSystem: resolveInputSystem('wgs84', 'gcj02').effectiveSystem,
      outputSystem: 'wgs84',
    })
    const byCurrent = await batchConvertCoordinates(rows, {
      inputSystem: 'gcj02', // 旧行为：改完下拉后直接用它
      outputSystem: 'wgs84',
    })

    expect(bySnapshot.success).toBe(true)
    expect(byCurrent.success).toBe(true)
    // 同一份数据按不同输入系解释，坐标值必然不同 —— 旧行为就是这样静默出错的
    expect(bySnapshot.data[0]).not.toEqual(byCurrent.data[0])
  })
})
