import { describe, it, expect } from 'vitest'
import {
  sanitizeFilename,
  validateFilenameTemplate,
  generateFilename,
  resolveDuplicates,
  dateStringToSerial,
  resolveValue,
} from '../xlsxTemplateFunctions'

describe('dateStringToSerial', () => {
  it('中文格式日期转 Excel 序列号', () => {
    expect(dateStringToSerial('2024-01-01')).toBe(45292)
    expect(dateStringToSerial('2024/1/2')).toBe(45293)
  })

  it('含时间的日期按一天的比例折算', () => {
    expect(dateStringToSerial('2024-01-01 12:00:00')).toBe(45292.5)
  })

  it('1900 年及之前的日期返回 null', () => {
    expect(dateStringToSerial('1899/12/31')).toBeNull()
  })

  it('非日期字符串返回 null', () => {
    expect(dateStringToSerial('abc')).toBeNull()
    expect(dateStringToSerial('2024')).toBeNull()
  })
})

describe('resolveValue', () => {
  const dataList = [{ name: '张三' }, { name: '李四' }]

  it('行内存在的字段直接取值', () => {
    expect(resolveValue('name', { name: '张三', age: 25 }, 0, dataList)).toBe('张三')
  })

  it('数字透传不变', () => {
    expect(resolveValue('age', { name: '张三', age: 25 }, 0, dataList)).toBe(25)
  })

  it('缺失字段回退 rowIndex / totalRows / items', () => {
    expect(resolveValue('rowIndex', { name: 'a' }, 3, dataList)).toBe(4)
    expect(resolveValue('totalRows', { name: 'a' }, 0, dataList)).toBe(2)
    expect(resolveValue('items', { name: 'a' }, 0, dataList)).toBe(
      JSON.stringify(dataList),
    )
  })

  it('行内值优先于特殊键', () => {
    expect(resolveValue('rowIndex', { rowIndex: '自定义' }, 3, dataList)).toBe(
      '自定义',
    )
  })

  it('空值返回空字符串', () => {
    expect(resolveValue('name', { name: null }, 0, dataList)).toBe('')
    expect(resolveValue('name', { name: '' }, 0, dataList)).toBe('')
    expect(resolveValue('missing', {}, 0, dataList)).toBe('')
  })

  it('纯数字字符串转数字', () => {
    expect(resolveValue('v', { v: '42' }, 0, dataList)).toBe(42)
    expect(resolveValue('v', { v: '-3.14' }, 0, dataList)).toBe(-3.14)
  })

  it('日期字符串转 Excel 序列号', () => {
    expect(resolveValue('v', { v: '2024-01-01' }, 0, dataList)).toBe(45292)
  })

  it('其他字符串原样返回', () => {
    expect(resolveValue('v', { v: '  abc  ' }, 0, dataList)).toBe('  abc  ')
  })
})

describe('文件名函数', () => {
  it('sanitizeFilename 替换非法字符并回退未命名', () => {
    expect(sanitizeFilename('a/b:c')).toBe('a-b-c')
    expect(sanitizeFilename('')).toBe('未命名')
  })

  it('validateFilenameTemplate 校验占位符', () => {
    expect(validateFilenameTemplate('{name}')).toEqual({ valid: true })
    expect(validateFilenameTemplate('{name')).toEqual({
      valid: false,
      error: '花括号未闭合，缺少 }',
    })
    expect(validateFilenameTemplate('name}')).toEqual({
      valid: false,
      error: '多余的 } 右花括号',
    })
    expect(validateFilenameTemplate('{a-b}')).toEqual({
      valid: false,
      error: '字段名 "{a-b}" 包含非法字符，只允许字母、数字和下划线',
    })
  })

  it('generateFilename 替换字段并清理文件名', () => {
    expect(generateFilename({ name: '张三', age: 25 }, '{name}_{age}', 0)).toBe(
      '张三_25',
    )
    expect(generateFilename({ name: null }, '', 1)).toBe('文档_2')
  })

  it('resolveDuplicates 处理重名', () => {
    expect(resolveDuplicates(['a', 'a'], 'appendIndex')).toEqual(['a', 'a(1)'])
    expect(resolveDuplicates(['甲', '乙'], 'rowPrefix')).toEqual(['1-甲', '2-乙'])
  })
})