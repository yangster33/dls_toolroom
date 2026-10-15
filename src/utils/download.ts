/**
 * Blob 下载的统一入口
 *
 * **为什么单独一份**：仓库里原本有 3 份逐字节等价的 `triggerDownload`
 * （`utils/TemplateExporter.ts`、`gis2excel/GisToExcelExporter.ts`、
 * `geo_data` 的 `XLSX.writeFile` 内部那份），C4 收尾时在 `exceljsCore.ts`
 * 里收了口（`downloadXlsxBlob`），但那拴在 xlsx 场景。D4 拆甘特图导出时
 * 又需要它，于是提到这里。
 *
 * 两个关键细节（沿用 C4 评审 M2 的结论，都是浏览器实测问题）：
 *  1. `<a>` 必须 **appendChild 进文档** 才触发下载（Firefox 历史上要求节点在文档内）；
 *  2. `revokeObjectURL` 必须**延迟**执行 —— 大文件的 Blob 在 `click()` 之后
 *     仍被浏览器读取，立即 revoke 会下载到空文件。
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()

  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 100)
}
