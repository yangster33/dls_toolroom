import { describe, it, expect } from 'vitest'
import {
  sanitizeFilename,
  validateFilenameTemplate,
  generateFilename,
  resolveDuplicates,
  convertDateValue,
  convertDatesInData,
  upperFilter,
  lowerFilter,
  capitalizeFilter,
  numberFilter,
  currencyFilter,
  percentFilter,
  dateFilter,
  defaultFilter,
  truncateFilter,
  trimFilter,
  splitFilter,
} from '../docxTemplateFunctions'

describe('sanitizeFilename', () => {
  it('替换非法字符为连字符', () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j')
  })

  it('合并连续空白并去除首尾空格', () => {
    expect(sanitizeFilename('  报告  2024  ')).toBe('报告 2024')
  })

  it('空结果回退为未命名', () => {
    expect(sanitizeFilename('')).toBe('未命名')
    expect(sanitizeFilename('   ')).toBe('未命名')
  })

  it('非法字符替换后非空则保留结果', () => {
    expect(sanitizeFilename('///')).toBe('---')
  })

  it('保留中文', () => {
    expect(sanitizeFilename('点位报告:2024')).toBe('点位报告-2024')
  })
})

describe('validateFilenameTemplate', () => {
  it('合法模板通过', () => {
    expect(validateFilenameTemplate('{name}_{age}')).toEqual({ valid: true })
    expect(validateFilenameTemplate('固定前缀')).toEqual({ valid: true })
  })

  it('未闭合花括号报错', () => {
    expect(validateFilenameTemplate('{name')).toEqual({
      valid: false,
      error: '花括号未闭合，缺少 }',
    })
  })

  it('多余右花括号报错', () => {
    expect(validateFilenameTemplate('name}')).toEqual({
      valid: false,
      error: '多余的 } 右花括号',
    })
  })

  it('空占位符 {} 不匹配字段名正则，视为合法', () => {
    expect(validateFilenameTemplate('{}')).toEqual({ valid: true })
  })

  it('含空格的占位符报非法字符', () => {
    expect(validateFilenameTemplate('{ }')).toEqual({
      valid: false,
      error: '字段名 "{ }" 包含非法字符，只允许字母、数字和下划线',
    })
  })

  it('含非法字符的字段名报错', () => {
    expect(validateFilenameTemplate('{a b}')).toEqual({
      valid: false,
      error: '字段名 "{a b}" 包含非法字符，只允许字母、数字和下划线',
    })
  })
})

describe('generateFilename', () => {
  it('无模板时取首字段值', () => {
    expect(generateFilename({ name: '张三', age: 25 }, '', 0)).toBe('张三')
  })

  it('无模板且首字段为空时回退文档序号', () => {
    expect(generateFilename({ name: null }, '', 0)).toBe('文档_1')
    expect(generateFilename({}, '', 2)).toBe('文档_3')
  })

  it('替换模板中的字段', () => {
    expect(generateFilename({ name: '张三', age: 25 }, '{name}_{age}', 0)).toBe(
      '张三_25',
    )
  })

  it('缺失字段替换为空并清理文件名', () => {
    expect(generateFilename({ name: '张三' }, '{name}/{city}', 0)).toBe('张三-')
  })
})

describe('resolveDuplicates', () => {
  it('appendIndex：不重复的名称保持不变', () => {
    expect(resolveDuplicates(['a', 'b'], 'appendIndex')).toEqual(['a', 'b'])
  })

  it('appendIndex：重复名称追加序号', () => {
    expect(resolveDuplicates(['a', 'a', 'a'], 'appendIndex')).toEqual([
      'a',
      'a(1)',
      'a(2)',
    ])
  })

  it('rowPrefix：按位宽补零加行号前缀', () => {
    expect(resolveDuplicates(['甲', '乙'], 'rowPrefix')).toEqual(['1-甲', '2-乙'])
    const ten = Array.from({ length: 10 }, (_, i) => `名${i}`)
    expect(resolveDuplicates(ten, 'rowPrefix')).toEqual(
      ten.map((name, i) => `${String(i + 1).padStart(2, '0')}-${name}`),
    )
  })
})

describe('convertDateValue', () => {
  it('Date 对象转 yyyy-m-d 字符串', () => {
    expect(convertDateValue(new Date(2024, 0, 2))).toBe('2024-1-2')
  })

  it('Date 对象含时间时附加时分秒', () => {
    expect(convertDateValue(new Date(2024, 0, 2, 3, 4, 5))).toBe('2024-1-2 03:04:05')
  })

  it('数字原样返回', () => {
    expect(convertDateValue(45225)).toBe(45225)
  })

  it('中文格式日期字符串', () => {
    expect(convertDateValue('2024/1/2')).toBe('2024-1-2')
    expect(convertDateValue('2024-01-02')).toBe('2024-1-2')
    expect(convertDateValue('2024-01-02 03:04:05')).toBe('2024-1-2 03:04:05')
  })

  it('1900 年及之前的日期不转换', () => {
    expect(convertDateValue('1899/1/2')).toBe('1899/1/2')
  })

  it('美式日期字符串', () => {
    expect(convertDateValue('1/2/2024')).toBe('2024-1-2')
    expect(convertDateValue('1/2/2024 03:04')).toBe('2024-1-2 03:04:00')
  })

  it('8 位数字日期', () => {
    expect(convertDateValue('20240102')).toBe('2024-1-2')
  })

  it('其他字符串原样返回', () => {
    expect(convertDateValue('hello')).toBe('hello')
    expect(convertDateValue(null)).toBeNull()
  })
})

describe('convertDatesInData', () => {
  it('批量转换每行的日期值', () => {
    expect(
      convertDatesInData([
        { name: '张三', birthday: new Date(2024, 0, 2), age: 25 },
      ]),
    ).toEqual([{ name: '张三', birthday: '2024-1-2', age: 25 }])
  })
})

describe('过滤器', () => {
  it('upper：转大写，空值返回空串', () => {
    expect(upperFilter('abc')).toBe('ABC')
    expect(upperFilter(null)).toBe('')
  })

  it('lower：转小写', () => {
    expect(lowerFilter('ABC')).toBe('abc')
  })

  it('capitalize：首字母大写其余小写', () => {
    expect(capitalizeFilter('hELLO')).toBe('Hello')
  })

  it('number：保留指定位数小数', () => {
    expect(numberFilter(3.14159, 2)).toBe('3.14')
    expect(numberFilter('3.5', 0)).toBe('4')
    expect(numberFilter('abc', 1)).toBe('0.0')
  })

  it('currency：货币格式，默认 ¥', () => {
    expect(currencyFilter(1234.5)).toBe('¥1,234.50')
    expect(currencyFilter(1234.5, '$')).toBe('$1,234.50')
  })

  it('percent：百分数', () => {
    expect(percentFilter(0.85)).toBe('85%')
    expect(percentFilter(0.8567, 1)).toBe('85.7%')
  })

  it('date：按格式输出', () => {
    expect(dateFilter(new Date(2024, 0, 2), 'yyyy/mm/dd')).toBe('2024/01/02')
    expect(dateFilter('2024-01-02', 'yyyy-mm-dd')).toBe('2024-01-02')
    expect(dateFilter('not-a-date', 'yyyy')).toBe('not-a-date')
    expect(dateFilter(null, 'yyyy')).toBe('')
  })

  it('default：空值取默认', () => {
    expect(defaultFilter(null, '未填写')).toBe('未填写')
    expect(defaultFilter('', '未填写')).toBe('未填写')
    expect(defaultFilter('有值', '未填写')).toBe('有值')
    expect(defaultFilter(undefined)).toBe('')
  })

  it('truncate：截断加省略号', () => {
    expect(truncateFilter('abcdefghijk', 5)).toBe('abcde...')
    expect(truncateFilter('short', 10)).toBe('short')
    expect(truncateFilter('abcdefghijklmnop', 0)).toBe('abcdefghij...')
  })

  it('trim：去除首尾空白', () => {
    expect(trimFilter('  a b  ')).toBe('a b')
  })

  it('split：按分隔符取第 N 段', () => {
    expect(splitFilter('a b c', ' ', 1)).toBe('b')
    expect(splitFilter('a,b', ',', 0)).toBe('a')
    expect(splitFilter('a,b', ',', 5)).toBe('')
  })
})