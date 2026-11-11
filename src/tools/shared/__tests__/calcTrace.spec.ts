import { describe, expect, it } from 'vitest'
import {
  circled,
  formatNumber,
  makeSymbol,
  signed,
  sourceLabel,
  sourceTitle,
  stepLabelOf,
  whyText,
  type CalcStep,
} from '../calcTrace'

describe('makeSymbol', () => {
  it('只带必填字段时不产生空的可选键', () => {
    const symbol = makeSymbol('负荷功率', '72.00', 'input')

    expect(symbol).toEqual({
      symbol: '负荷功率',
      name: '负荷功率',
      value: '72.00',
      source: 'input',
    })
    expect('unit' in symbol).toBe(false)
    expect('inputSymbol' in symbol).toBe(false)
    expect('sourceDetail' in symbol).toBe(false)
  })

  it('保留单位、输入联动名与来源细节', () => {
    const symbol = makeSymbol('计算电流', '45.6', 'calc', {
      symbol: 'Ib',
      unit: 'A',
      inputSymbol: 'I',
      sourceDetail: '表 B.52.14',
    })

    expect(symbol).toMatchObject({
      symbol: 'Ib',
      unit: 'A',
      inputSymbol: 'I',
      sourceDetail: '表 B.52.14',
    })
  })
})

describe('数值与序号格式', () => {
  it('formatNumber 默认 1 位小数，signed 带符号', () => {
    expect(formatNumber(2.345)).toBe('2.3')
    expect(formatNumber(2.345, 2)).toBe('2.35')
    expect(signed(2.345)).toBe('+2.3')
    expect(signed(-2.345, 2)).toBe('-2.35')
  })

  it('circled 与 stepLabelOf 使用带圈序号', () => {
    expect(circled(1)).toBe('①')
    expect(circled(5)).toBe('⑤')
    expect(circled(12)).toBe('12')

    const step = { index: 5, title: '所需容量' } as CalcStep
    expect(stepLabelOf(step)).toBe('⑤ 所需容量')
  })
})

describe('whyText', () => {
  it('不通过时带上域内的处置建议', () => {
    expect(
      whyText(false, false, '-0.5 A', ['载流量'], {
        subject: '截面',
        failHint: '需要调整截面或敷设条件。',
      }),
    ).toBe('不满足；缺口 -0.5 A，需要调整截面或敷设条件。')
  })

  it('控制项与非控制项措辞不同', () => {
    const options = { subject: '容量', failHint: '需要调整容量。' }

    expect(whyText(true, true, '+12 Ah', ['安时容量'], options)).toBe(
      '满足，且是控制项；余量 +12 Ah。',
    )
    expect(whyText(true, false, '+12 Ah', ['安时容量'], options)).toBe(
      '满足，但未控制最终容量；当前由 安时容量 控制，余量 +12 Ah。',
    )
    expect(whyText(true, false, '+0 Ah', [], options)).toContain('其他约束')
  })
})

describe('来源标签', () => {
  it('五个来源都有中文标签，标题带细节', () => {
    expect(sourceLabel('input')).toBe('输入')
    expect(sourceLabel('table')).toBe('查表')
    expect(sourceLabel('calc')).toBe('计算')
    expect(sourceLabel('constant')).toBe('常数')
    expect(sourceLabel('default')).toBe('默认')

    expect(
      sourceTitle(makeSymbol('放电容量系数', '0.42', 'input', { sourceDetail: 'GB 51194' })),
    ).toBe('放电容量系数：输入 · GB 51194')
    expect(sourceTitle(makeSymbol('负荷功率', '72 kW', 'calc'))).toBe('负荷功率：计算')
  })
})
