import { describe, it, expect } from 'vitest'
import {
  sanitizeFilename,
  validateFilenameTemplate,
  generateFilename,
  generateNameFromTemplate,
  renderNameTemplate,
  resolveDuplicates,
} from '../filenameTemplate'

/**
 * 文件名 / 命名模板的回归测试（D2 / 审计 P3-2、P3-4）
 *
 * 这些用例原本在 `template_export/__tests__/useTemplateExport.spec.ts`。
 * 背景：函数此前只在 `docx_template_export/docxTemplateFunctions.ts` 与
 * `xlsx_template_export/xlsxTemplateFunctions.ts` 中有测试，而那两个文件是
 * `template_export/` 合并重构后的**死代码副本**（2026-10-09 阶段 0 已删除）。
 *
 * D2 把三处拷贝收敛到 `utils/filenameTemplate.ts` 后，测试跟着实现搬到此处，
 * 并为 shp2kml（此前**没有**任何命名模板测试）补上用例。
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

/**
 * shp2kml 的 KML 要素名渲染（此前页面预览与生成器各有一份**逐字节相同**的拷贝，
 * 且页面那份的花括号校验留着 `[^}]+` 死分支 —— `报告_{}` 能通过校验）。
 */
describe('generateNameFromTemplate（shp2kml）', () => {
  it('无模板时原样返回 name', () => {
    expect(generateNameFromTemplate({ a: '1' }, '原始名')).toBe('原始名')
    expect(generateNameFromTemplate({ a: '1' }, '原始名', '')).toBe('原始名')
  })

  // 页面预览与生成器写出共用同一实现：这里同时锁住两边的行为
  it('按模板渲染，context = { name, ...properties }', () => {
    const result = generateNameFromTemplate({ road: '中山路', len: 120 }, '站点', '{road}_{name}')
    expect(result).toBe('中山路_站点')
  })

  it('缺失字段替换为空字符串，不写 undefined', () => {
    expect(generateNameFromTemplate({ a: '1' }, '站点', '{missing}_{a}')).toBe('_1')
  })

  // KML 要素名**不**清理 Windows 非法字符（那是文件名的规则）：
  // 属性值要原样进 XML，由 escapeXml 负责转义。
  it('不清理非法字符（与 generateFilename 的刻意差异）', () => {
    expect(generateNameFromTemplate({ a: 'b/c' }, '站点', '{a}')).toBe('b/c')
    expect(generateFilename({ a: 'b/c' }, '{a}', 0)).toBe('b-c')
  })

  // 注意：context 构造成 `{ name, ...properties }`，因此**属性表里的 name 列会覆盖**
  // 显式传入的 name —— 这是收敛前两份拷贝的既有语义（页面预览与生成器逐字节相同），
  // 本次刻意不改。若哪天要「显式 name 优先」，需要同时改预览与生成器并回归。
  it('属性表里的 name 列会覆盖显式 name（既有语义，勿莫名改动）', () => {
    expect(generateNameFromTemplate({ name: '属性名' }, '显式名', '{name}')).toBe('属性名')
    expect(generateNameFromTemplate({ road: '中山路' }, '显式名', '{name}_{road}')).toBe(
      '显式名_中山路',
    )
  })
})

describe('validateFilenameTemplate · shp2kml 侧的收敛修复', () => {
  // 收敛前 Shp2KmlPage 用 `[^}]+` 匹配占位符，`{}` 匹配不上，
  // 于是「存在空的 {} 占位符」分支是死代码，`报告_{}` 能通过校验。
  it('空占位符 {} 现在会被 shp2kml 的同一份校验拒绝（收敛前被放过）', () => {
    const r = validateFilenameTemplate('报告_{}')
    expect(r.valid).toBe(false)
    expect(r.error).toContain('空')
  })

  it('未闭合/多余右括号的报错文案收敛后一致', () => {
    expect(validateFilenameTemplate('报告_{name').error).toContain('未闭合')
    expect(validateFilenameTemplate('报告_name}').error).toContain('多余')
  })
})

describe('renderNameTemplate', () => {
  it('空模板返回空串；无占位符时原样返回', () => {
    expect(renderNameTemplate('', { a: 1 })).toBe('')
    expect(renderNameTemplate('固定名', { a: 1 })).toBe('固定名')
  })

  it('null / undefined 字段替换为空串', () => {
    expect(renderNameTemplate('{a}{b}', { a: null, b: undefined })).toBe('')
  })

  it('数值 0 正常替换（不当成空）', () => {
    expect(renderNameTemplate('{a}', { a: 0 })).toBe('0')
  })
})
