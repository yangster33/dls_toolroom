/**
 * 文件名 / 命名模板工具（D2 / 审计 P3-2、P3-4）
 *
 * **为什么有这一份**：模板渲染与花括号校验曾在三处各有一份拷贝：
 *   - `template_export/useTemplateExport.ts` —— 生成导出**文件名**（要清理非法字符）
 *   - `shp2kml/Shp2KmlPage.vue`      —— 页面**实时预览** KML 要素名
 *   - `shp2kml/ShpToKmlGenerator.ts` —— 生成 KML 时**实际写出**的要素名
 *
 * 后两份是**同一个函数的两份拷贝**（审计已逐行比对）：页面用前者预览、
 * 生成器用后者出文件，任何一边改了另一边不会跟着变 —— 用户看到的预览
 * 与下载到的文件可能不一致。
 *
 * 花括号校验同样有两份，且 Shp2Kml 那份还留着阶段 0 刚修掉的死分支
 * （正则用 `[^}]+`，导致 `{}` 空占位符判不了、`m[1] === ''` 永远不成立）。
 * 收敛后只有一份实现，两边同时获得修复。
 *
 * 两类调用**刻意保留两个入口**，因为语义不同：
 *   - `generateFilename`        文件名：要清理 Windows 非法字符 + 空值兜底
 *   - `generateNameFromTemplate` KML 要素名：**不**清理（原始属性要进 KML，
 *     非法字符由 `escapeXml` 转义），无模板时原样返回 name
 */

/** Windows 文件名非法字符 → `-`，连续空白压成一个，空结果回退「未命名」 */
export function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim() || '未命名'
  )
}

/**
 * 校验模板的花括号与字段名。
 *
 * 两个已修过的坑（阶段 0 / 附加项），收敛后两边共享：
 *  1. 正则在占位符内容上用 `[^}]*` 而非 `[^}]+` —— 后者匹配不上 `{}`，
 *     下面的「空占位符」分支就是死代码，`报告_{}` 会被放过并生成 `报告_`。
 *  2. 用「已闭合括号的深度」判断多余/缺失的右括号， depth < 0 当场返回，
 *     循环之后不需要（也不可能有）第二次 depth < 0 判断。
 */
export function validateFilenameTemplate(template: string): { valid: boolean; error?: string } {
  let depth = 0
  for (const ch of template) {
    if (ch === '{') depth++
    if (ch === '}') depth--
    if (depth < 0) return { valid: false, error: '多余的 } 右花括号' }
  }
  if (depth > 0) return { valid: false, error: '花括号未闭合，缺少 } 右花括号' }

  const re = /\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(template)) !== null) {
    if (m[1] === '') return { valid: false, error: '存在空的 {} 占位符' }
    if (!/^[\w]+$/.test(m[1]!)) {
      return { valid: false, error: `字段名 "${m[1]!}" 包含非法字符，只允许字母、数字和下划线` }
    }
  }

  return { valid: true }
}

/**
 * 模板渲染的公共内核：把 `{field}` 替换成 context 里的值。
 *
 * 缺失 / null / undefined 的字段替换为**空字符串**（不写 "undefined"）。
 * 正则与两份旧拷贝逐字节一致（`[^}]+`，空白占位符由校验层先拦掉）。
 */
export function renderNameTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const val = context[key]
    return val != null ? String(val) : ''
  })
}

/**
 * 生成 KML 要素名（shp2kml）。
 *
 * 无模板时原样返回 `name`；有模板时以 `{ name, ...properties }` 为上下文渲染。
 * 与页面预览、生成器写出共用同一实现，保证「所见即所得」。
 */
export function generateNameFromTemplate(
  properties: Record<string, unknown>,
  name: string,
  template?: string,
): string {
  if (!template) return name
  return renderNameTemplate(template, { name, ...properties })
}

/**
 * 生成导出文件名（template_export）。
 *
 * - 无模板：取首列值；首列为空时回退 `文档_${index + 1}`
 *   （`!= null && trim() !== ''` 两个条件都要：旧实现只判 `!= null`，
 *    空串会走 `sanitizeFilename('')` → '未命名'，让兜底分支永不可达）
 * - 有模板：渲染后清理非法字符
 */
export function generateFilename(
  row: Record<string, unknown>,
  template: string,
  index: number,
): string {
  if (!template) {
    const firstKey = Object.keys(row)[0]
    const firstValue = firstKey !== undefined ? row[firstKey] : undefined
    if (firstValue != null && String(firstValue).trim() !== '') {
      return sanitizeFilename(String(firstValue))
    }
    return `文档_${index + 1}`
  }

  return sanitizeFilename(renderNameTemplate(template, row))
}

/**
 * 重名文件名的去重。
 *
 * 必须以「已产出的最终名」为集合，而不是「原始名出现次数」：
 * 旧实现输入 `['a','a','a(1)']` 得到 `['a','a(1)','a(1)']` —— 第三行与
 * 第二行撞名，JSZip 的 `zip.file(name)` 同名覆盖 → 少一个文件且不报错（审计 P1-4）。
 */
export function resolveDuplicates(
  names: string[],
  strategy: 'appendIndex' | 'rowPrefix',
): string[] {
  if (strategy === 'rowPrefix') {
    const pad = String(names.length).length
    return names.map((name, i) => `${String(i + 1).padStart(pad, '0')}-${name}`)
  }

  const used = new Set<string>()
  return names.map((name) => {
    if (!used.has(name)) {
      used.add(name)
      return name
    }
    let n = 1
    let candidate = `${name}(${n})`
    while (used.has(candidate)) {
      n++
      candidate = `${name}(${n})`
    }
    used.add(candidate)
    return candidate
  })
}
