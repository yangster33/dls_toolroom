# 术

## 核心依赖

### exceljs
- **用途**：XLSX 模板渲染引擎，读取带占位符的 Excel 模板文件并填充数据
- **官网**：https://github.com/exceljs/exceljs
- **版本**：^4.4.0
- **注意**：通过全局脚本 `window.ExcelJS` 加载（非 ES Module import），需要提前在 HTML 中引入

### xlsx
- **用途**：SheetJS 社区版，用于读取用户上传的 Excel 数据文件
- **官网**：https://sheetjs.com/
- **版本**：^0.18.5

### papaparse
- **用途**：高性能 CSV 解析库
- **官网**：https://www.papaparse.com/
- **版本**：^5.5.3

### jszip
- **用途**：批量导出时将多个生成的 XLSX 文件打包为 ZIP
- **官网**：https://stuk.github.io/jszip/
- **版本**：^3.10.1

### file-saver
- **用途**：触发浏览器文件下载
- **官网**：https://github.com/eligrey/FileSaver.js
- **版本**：^2.0.5

## 工作原理

```
用户数据 (CSV / Excel)
       ↓
  数据解析层 (papaparse / xlsx)
       ↓
  JSON 数据数组 [{行1字段...}, {行2字段...}, ...]
       ↓
  模板渲染层 (exceljs — workbook.xlsx.load + 逐个Sheet/Row填充)
       ↓
  XLSX 文件生成 (Buffer)
       ↓
  文件下载 (file-saver) 或 ZIP 打包 (jszip)
```

## 占位符语法

模板中使用单层花括号 `{field_name}` 标记占位符：

```typescript
// 文件名模板验证逻辑 — 支持 {字段名} 格式
function validateFilenameTemplate(template: string): { valid: boolean; error?: string } {
  // 检查花括号匹配、空占位符、非法字符
  const re = /\{([^}]+)\}/g
}
```

- `{name}` → 替换为数据行中 name 字段的值
- `{城市}` → 支持中文字段名
- 仅支持字母、数字、下划线和中文字段名

## 关键实现

### ExcelJS 工作簿渲染

```typescript
// 使用 exceljs 加载模板并逐行填充
declare global {
  interface Window {
    ExcelJS: typeof import('exceljs')
  }
}

// 渲染流程：load template → for each data row → clone template sheet → fill cells → write buffer
```

### 文件名去重

```typescript
// 多行数据生成同名文件时自动追加序号
function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || '未命名'
}
```

## 文件大小限制

- 数据文件：建议不超过 10MB
- 模板文件：建议不超过 5MB

## 已知限制

1. 依赖浏览器全局 `window.ExcelJS` 对象，需确保 `public/exceljs.min.js` 已正确加载
2. 复杂图表和样式可能无法完全保留，取决于 exceljs 对模板特性的支持程度
