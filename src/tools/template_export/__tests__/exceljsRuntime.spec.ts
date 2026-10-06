import { describe, it, expect } from 'vitest'
import type * as ExcelJS from 'exceljs'

/**
 * 回归测试（审计 P0-1）
 *
 * 旧实现在 `useTemplateExport.ts` 中写的是：
 *   new (window as any).ExcelJS.Workbook()
 * 而 window.ExcelJS 从未被赋值、也没有 CDN script 标签，
 * 导致「XLSX 模板批量导出」工具 100% 崩溃，且被 `as any` + `declare global`
 * 完全掩盖（type-check 与 lint 全绿）。
 *
 * 这个测试确保修复后的动态导入在**运行时**真的能拿到 Workbook 构造函数，
 * 并完成「读取模板 → 填充单元格 → 写出 buffer」的完整往返。
 */
describe('exceljs 动态导入（P0-1 回归）', () => {
  it('await import("exceljs") 能取到 Workbook 构造函数', async () => {
    const mod = await import('exceljs')
    expect(mod.Workbook).toBeTypeOf('function')
  })

  it('不再依赖 window.ExcelJS（该全局从未被赋值）', () => {
    expect((window as unknown as { ExcelJS?: unknown }).ExcelJS).toBeUndefined()
  })

  it('完整往返：新建 → 写单元格 → 读回 → 输出 buffer', async () => {
    const { Workbook } = await import('exceljs')

    const workbook = new Workbook()
    const ws = workbook.addWorksheet('Sheet1')
    ws.getCell('A1').value = '{名称}'
    ws.getCell('B1').value = '{经度}'

    expect(ws.getCell('A1').value).toBe('{名称}')

    const buffer = await workbook.xlsx.writeBuffer()
    expect(buffer.byteLength).toBeGreaterThan(0)

    // 复现 useTemplateExport.ts 的实际流程：
    //   load(template) → getWorksheet(1) → 逐 cell 替换 {字段}
    const reloaded = new Workbook()
    await reloaded.xlsx.load(buffer as ArrayBuffer)

    const ws2 = reloaded.getWorksheet(1)
    expect(ws2).toBeDefined()
    expect(ws2!.getCell('A1').value).toBe('{名称}')

    ws2!.getCell('A1').value = '大龙山'
    expect(ws2!.getCell('A1').value).toBe('大龙山')
    expect(ws2!.getCell('B1').value).toBe('{经度}')
  })

  it('无工作表时 getWorksheet(1) 返回 undefined（对应实际代码的抛错分支）', async () => {
    const { Workbook } = await import('exceljs')

    const empty = new Workbook()
    const buffer = await empty.xlsx.writeBuffer()

    const reloaded = new Workbook()
    await reloaded.xlsx.load(buffer as ArrayBuffer)
    expect(reloaded.getWorksheet(1)).toBeUndefined()
  })

  it('模板文件损坏时 load 抛错（而不是静默崩溃）', async () => {
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    await expect(workbook.xlsx.load(new ArrayBuffer(0))).rejects.toBeDefined()
  })

  it('类型与 exceljs 官方定义一致（防止再次用 as any 掩盖）', async () => {
    const mod = await import('exceljs')
    // 编译期校验：动态导入得到的 Workbook 与 ExcelJS.Workbook 类型兼容
    const ctor: typeof ExcelJS.Workbook = mod.Workbook
    expect(ctor).toBeTypeOf('function')
  })
})
