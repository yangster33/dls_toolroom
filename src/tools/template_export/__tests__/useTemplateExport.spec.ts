import { describe, it, expect } from 'vitest'
import {
  sanitizeFilename,
  validateFilenameTemplate,
  generateFilename,
  resolveDuplicates,
} from '../useTemplateExport'

/**
 * useTemplateExport 纯函数的回归测试
 *
 * 背景：这些函数此前只在 `docx_template_export/docxTemplateFunctions.ts` 与
 * `xlsx_template_export/xlsxTemplateFunctions.ts` 中有测试，而那两个文件是
 * `template_export/` 合并重构后的**死代码副本**（2026-10-09 阶段 0 已删除）。
 * 删除死代码时把测试一起删了，导致 live 实现失去覆盖。
 * 这里把 live 实现（useTemplateExport.ts）的函数导出并补回测试。
 */
describe('sanitizeFilename', () => {
  it('替换 Windows 非法字符', () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j')
  })

  it('压缩连续空白', () => {
    expect(sanitizeFilename('  a    b  ')).toBe('a b')
  })

  it('空结果回退为「未命名」（仅当结果为空串时）', () => {
    expect(sanitizeFilename('')).toBe('未命名')
    expect(sanitizeFilename('   ')).toBe('未命名')
  })

  it('全非法字符会被替换而非回退（属于预期行为）', () => {
    // '///' → '---'，是 truthy，不触发 '未命名' 兜底
    expect(sanitizeFilename('///')).toBe('---')
  })
})

describe('validateFilenameTemplate', () => {
  it('合法模板通过', () => {
    expect(validateFilenameTemplate('报告_{name}')).toEqual({ valid: true })
    expect(validateFilenameTemplate('')).toEqual({ valid: true })
  })

  it('检测未闭合的左花括号', () => {
    const r = validateFilenameTemplate('报告_{name')
    expect(r.valid).toBe(false)
    expect(r.error).toContain('未闭合')
  })

  it('检测多余的右花括号', () => {
    const r = validateFilenameTemplate('报告_name}')
    expect(r.valid).toBe(false)
    expect(r.error).toContain('多余')
  })

  it('检测空占位符', () => {
    const r = validateFilenameTemplate('报告_{}')
    expect(r.valid).toBe(false)
    expect(r.error).toContain('空')
  })

  it('检测非法字段名（只允许字母数字下划线）', () => {
    expect(validateFilenameTemplate('{a-b}').valid).toBe(false)
    expect(validateFilenameTemplate('{a b}').valid).toBe(false)
    expect(validateFilenameTemplate('{a_b2}').valid).toBe(true)
  })
})

describe('generateFilename', () => {
  it('无模板时取首列值', () => {
    expect(generateFilename({ 名称: '大龙山' }, '', 0)).toBe('大龙山')
  })

  it('无模板且首列为空时回退序号', () => {
    expect(generateFilename({ 名称: '' }, '', 0)).toBe('文档_1')
    expect(generateFilename({ 名称: 'x' }, '', 4)).toBe('x')
  })

  it('按模板替换占位符', () => {
    expect(generateFilename({ name: '大龙山', id: '7' }, '报告_{name}_{id}', 0)).toBe(
      '报告_大龙山_7',
    )
  })

  it('缺失字段替换为空字符串', () => {
    expect(generateFilename({ name: 'A' }, '报告_{missing}', 0)).toBe('报告_')
  })

  it('非法字符被清理', () => {
    expect(generateFilename({ name: 'a/b' }, '{name}', 0)).toBe('a-b')
  })
})

describe('resolveDuplicates', () => {
  it('rowPrefix 策略加行号前缀并补零', () => {
    expect(resolveDuplicates(['a', 'b'], 'rowPrefix')).toEqual(['1-a', '2-b'])
  })

  it('rowPrefix 在 10+ 行时补零对齐', () => {
    const names = Array.from({ length: 12 }, () => 'a')
    const result = resolveDuplicates(names, 'rowPrefix')
    expect(result[0]).toBe('01-a')
    expect(result[9]).toBe('10-a')
  })

  it('同名文件追加 (1) (2) 序号', () => {
    expect(resolveDuplicates(['a', 'a', 'a'], 'appendIndex')).toEqual(['a', 'a(1)', 'a(2)'])
  })

  // ── 审计报告 P1-4 的回归用例 ──
  // 旧实现用 Map 记「出现次数」，但候选名不再回填集合，
  // 导致输入 ['a','a','a(1)'] 产出 ['a','a(1)','a(1)'] —— 第三行与第二行撞名，
  // JSZip 的 zip.file(name) 同名覆盖 → 少一个文件，且 zip 生成时不报错。
  //
  // 这里断言的是**不变量**（输出唯一）而非具体命名方案：
  // 只要唯一，ZIP 里就不会互相覆盖。字面量 'a(1)' 被改成 'a(1)(1)'
  // 与把它让给 'a' 而重命名第二个，两种方案都满足不变量。
  it('P1-4：字面量就叫 "a(1)" 时不能与去重结果撞名', () => {
    const result = resolveDuplicates(['a', 'a', 'a(1)'], 'appendIndex')

    // 三个名字必须互不相同（否则 ZIP 内会互相覆盖）
    expect(new Set(result).size).toBe(3)
    expect(result[0]).toBe('a')
    expect(result[1]).toBe('a(1)')
    expect(result[2]).not.toBe('a')
    expect(result[2]).not.toBe('a(1)')
  })

  it('P1-4：多重碰撞下输出仍然全部唯一', () => {
    const result = resolveDuplicates(['a', 'a', 'a', 'a(1)', 'a(1)', 'a(2)'], 'appendIndex')
    expect(new Set(result).size).toBe(6)
    expect(result).toHaveLength(6)
  })

  it('P1-4：无碰撞时名字原样保留', () => {
    expect(resolveDuplicates(['x', 'y', 'z'], 'appendIndex')).toEqual(['x', 'y', 'z'])
  })

  it('P1-4：空数组安全', () => {
    expect(resolveDuplicates([], 'appendIndex')).toEqual([])
  })
})
