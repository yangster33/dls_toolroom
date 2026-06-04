# 术

## 技术栈概览

### npm 包

| 包名 | 用途 | 链接 |
|------|------|------|
| `docxtemplater` | 将数据渲染到 DOCX 模板中，支持段落循环、换行保持、自定义解析器 | https://www.npmjs.com/package/docxtemplater |
| `pizzip` | 读取和生成 ZIP 格式（DOCX 文件本质是 ZIP），为 docxtemplater 提供底层压缩/解压能力 | https://www.npmjs.com/package/pizzip |
| `jszip` | 创建 ZIP 压缩包，用于将多份渲染结果打包供用户批量下载 | https://www.npmjs.com/package/jszip |
| `file-saver` | 在浏览器端触发文件下载（saveAs），无需服务端参与 | https://www.npmjs.com/package/file-saver |
| `xlsx` (SheetJS) | 读取和写入 Excel 文件（.xlsx/.xls），提供 JSON 与工作表之间的双向转换 | https://www.npmjs.com/package/xlsx |
| `papaparse` | 解析和生成 CSV 格式数据，支持表头映射和空行跳过 | https://www.npmjs.com/package/papaparse |
| `angular-expressions` | 编译和执行类 Angular 表达式字符串，用于模板标签中支持过滤器语法 | https://www.npmjs.com/package/angular-expressions |

### 全局脚本

| 名称 | 用途 |
|------|------|
| `ExcelJS` | 通过浏览器全局对象 `window.ExcelJS` 加载，用于读取和写入 XLSX 模板（逐单元格操作、保留单元格格式） |

## 核心数据结构

```ts
// 数据行的类型定义
type DataRow = Record<string, any>

// 渲染结果的类型定义
interface RenderResult {
  name: string   // 输出文件名
  blob: Blob     // 文件二进制数据
}

// 导出格式枚举
type ExportFormat = 'docx' | 'xlsx'

// 重名处理策略
type DuplicateStrategy = 'appendIndex' | 'rowPrefix'
```

## 关键算法与代码片段

### 1. 自定义 Angular 表达式解析器 (`angularParser`)

`docxtemplater` 默认使用简单的占位符替换（`{field}`），但本项目通过 `angular-expressions` 注入自定义解析器，使模板支持过滤器语法（如 `{name | upper}`）。

```ts
import expressions from 'angular-expressions'

function angularParser(tag: string) {
  const expr = expressions.compile(tag)
  return {
    get(scope: Record<string, any>, context: any) {
      try {
        const result = expr(scope)
        if (result instanceof Date) {
          const year = result.getFullYear()
          const month = result.getMonth() + 1
          const day = result.getDate()
          const hours = String(result.getHours()).padStart(2, '0')
          const minutes = String(result.getMinutes()).padStart(2, '0')
          const seconds = String(result.getSeconds()).padStart(2, '0')
          const hasTime = hours !== '00' || minutes !== '00' || seconds !== '00'
          return hasTime
            ? `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
            : `${year}-${month}-${day}`
        }
        return result !== undefined && result !== null ? result : ''
      } catch {
        return ''
      }
    },
  }
}
```

设计思路：在 `angular-expressions` 编译表达式后，自定义 `get` 方法接管值获取逻辑。对 Date 类型做特殊处理（格式化为可读字符串），对 undefined/null 返回空字符串避免模板中出现 "undefined" 字样。外层 try-catch 确保任何表达式求值异常都不会中断整个渲染流程。

### 2. 内置过滤器函数

通过扩展 `expressions.filters` 对象注册了 10 个内置过滤器，供模板标签使用：

```ts
expressions.filters.upper = (input: any) => ensureString(input).toUpperCase()
expressions.filters.lower = (input: any) => ensureString(input).toLowerCase()
expressions.filters.capitalize = (input: any) => {
  const str = ensureString(input)
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}
expressions.filters.number = (input: any, decimals: any) => {
  const n = ensureNumber(input)
  const d = ensureNumber(decimals)
  return n.toFixed(d)
}
expressions.filters.currency = (input: any, symbol: any) => {
  const n = ensureNumber(input)
  const s = symbol != null ? String(symbol) : '¥'
  return s + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
expressions.filters.percent = (input: any, decimals: any) => {
  const n = ensureNumber(input) * 100
  const d = decimals != null ? ensureNumber(decimals) : 0
  return n.toFixed(d) + '%'
}
expressions.filters.date = (input: any, format: any) => {
  if (input === null || input === undefined) return ''
  const fmt = format != null ? String(format) : 'yyyy-mm-dd'
  let d: Date
  if (input instanceof Date) {
    d = input
  } else {
    d = new Date(input)
    if (isNaN(d.getTime())) return ensureString(input)
  }
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  return fmt
    .replace(/yyyy/g, String(year))
    .replace(/yy/g, String(year).slice(-2))
    .replace(/mm/g, String(month).padStart(2, '0'))
    .replace(/dd/g, String(day).padStart(2, '0'))
    .replace(/hh/g, hours)
    .replace(/ii/g, minutes)
    .replace(/ss/g, seconds)
}
expressions.filters.default = (input: any, fallback: any) => {
  if (input === null || input === undefined || input === '') {
    return fallback != null ? fallback : ''
  }
  return input
}
expressions.filters.truncate = (input: any, length: any) => {
  const str = ensureString(input)
  const len = ensureNumber(length) || 10
  return str.length > len ? str.substring(0, len) + '...' : str
}
expressions.filters.trim = (input: any) => ensureString(input).trim()
expressions.filters.split = (input: any, delimiter: any, index: any) => {
  const str = ensureString(input)
  const delim = delimiter != null ? String(delimiter) : ' '
  const i = ensureNumber(index)
  const parts = str.split(delim)
  return parts[i] !== undefined ? parts[i] : ''
}
```

### 3. 多格式日期识别与归一化 (`convertDateValue`)

数据源中的日期可能以多种格式存在（Date 对象、中文日期字符串、美式日期字符串、8 位紧凑数字），该函数统一识别并转换为标准可读格式。

```ts
function convertDateValue(value: any): any {
  if (value instanceof Date) {
    // 原生 Date 对象直接格式化
    const year = value.getFullYear()
    const month = value.getMonth() + 1
    const day = value.getDate()
    const hours = String(value.getHours()).padStart(2, '0')
    const minutes = String(value.getMinutes()).padStart(2, '0')
    const seconds = String(value.getSeconds()).padStart(2, '0')
    const formatted = `${year}-${month}-${day}`
    const hasTime = hours !== '00' || minutes !== '00' || seconds !== '00'
    return hasTime ? `${formatted} ${hours}:${minutes}:${seconds}` : formatted
  }

  if (typeof value === 'number') {
    return value  // 纯数字直接返回，不做日期转换
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    // 中文本地日期格式：2024-01-15 或 2024/01/15
    const chineseDatePattern =
      /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    const matchChinese = trimmed.match(chineseDatePattern)
    if (matchChinese && parseInt(matchChinese[1]!) > 1900) { /* 转换逻辑 */ }

    // 美式日期格式：01/15/2024
    const usDatePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    const matchUS = trimmed.match(usDatePattern)
    if (matchUS) { /* 转换逻辑 */ }

    // 8位紧凑格式：20240115
    if (/^\d{8}/.test(trimmed)) { /* 转换逻辑 */ }

    return value
  }
  return value
}
```

设计思路：采用模式匹配的级联策略，按优先级依次尝试中文本地格式（`yyyy-mm-dd`）、美式格式（`mm/dd/yyyy`）、紧凑数字格式（`yyyymmdd`）。每种格式匹配后统一输出 `年-月-日` 格式。对包含时间部分的日期保留 `HH:mm:ss` 后缀。不匹配任何格式的值原样返回，避免误转换。

### 4. 文件名模板校验 (`validateFilenameTemplate`)

通过栈式括号匹配和正则校验，确保用户输入的文件名模板语法正确。

```ts
function validateFilenameTemplate(template: string): { valid: boolean; error?: string } {
  let depth = 0
  for (const ch of template) {
    if (ch === '{') depth++
    if (ch === '}') depth--
    if (depth < 0) return { valid: false, error: '多余的 } 右花括号' }
  }
  if (depth > 0) return { valid: false, error: '花括号未闭合，缺少 }' }

  const re = /\{([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(template)) !== null) {
    if (m[1] === '') return { valid: false, error: '存在空的 {} 占位符' }
    if (!/^[\w]+$/.test(m[1]!)) {
      return { valid: false, error: `字段名 "{${m[1]!}}" 包含非法字符，只允许字母、数字和下划线` }
    }
  }
  return { valid: true }
}
```

### 5. 重名处理策略 (`resolveDuplicates`)

两种策略处理批量生成时的文件名冲突：

```ts
function resolveDuplicates(names: string[], strategy: 'appendIndex' | 'rowPrefix'): string[] {
  if (strategy === 'rowPrefix') {
    // 策略A：行号前缀，等宽补零，保证字典序与行序一致
    const pad = String(names.length).length
    return names.map((name, i) => `${String(i + 1).padStart(pad, '0')}-${name}`)
  }

  // 策略B：追加序号，首次出现的名称不加序号，后续同名追加 (1)(2)...
  const seen = new Map<string, number>()
  return names.map((name) => {
    const count = seen.get(name) || 0
    seen.set(name, count + 1)
    if (count === 0) return name
    return `${name}(${count})`
  })
}
```

### 6. DOCX 渲染核心流程

```ts
async function handleRenderDocx() {
  const dataList = actualDataList.value
  const rawNames = dataList.map((row, i) => generateFilename(row, filenameTemplate.value, i))
  const finalNames = resolveDuplicates(rawNames, duplicateStrategy.value)

  for (let i = 0; i < dataList.length; i++) {
    const rowData = dataList[i]
    const zip = new PizZip(templateContent.value!)
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: function () { return '' },
      parser: angularParser,
    })

    doc.render({
      ...rowData,
      items: dataList,
      rowIndex: i + 1,
      totalRows: dataList.length,
    })

    const blob = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    renderResults.value.push({ name: `${finalNames[i]}.docx`, blob })
  }
}
```

设计思路：每行独立加载模板 ZIP 副本（通过 `PizZip`），确保每次渲染都是从干净的模板开始，避免前一行渲染产生的副作用污染后续行。通过 `nullGetter` 将未定义字段替换为空字符串而非报错。注入 `rowIndex`、`totalRows`、`items` 三个内置上下文变量，满足"显示当前行号""显示总行数""引用全部数据"等高级模板需求。

### 7. XLSX 渲染核心流程

```ts
async function handleRenderXlsx() {
  for (let i = 0; i < dataList.length; i++) {
    const rowData = dataList[i]
    const workbook = new (window as any).ExcelJS.Workbook()
    await workbook.xlsx.load(templateContent.value!)
    const worksheet = workbook.getWorksheet(1)

    worksheet.eachRow((row: any) => {
      row.eachCell((cell: any) => {
        const val = cell.value
        if (typeof val !== 'string') return

        const singleKeyMatch = val.match(/^\{([^}]+)\}$/)

        if (singleKeyMatch) {
          // 整单元格替换：保留原始数字格式
          const v = resolveValue(singleKeyMatch[1]!, rowData!, i, dataList)
          if (v !== '' && v !== undefined && v !== null) {
            cell.value = v
            cell.numFmt = origNumFmt
          }
        } else {
          // 字符串内嵌替换
          const replaced = val.replace(/\{([^}]+)\}/g, (_match, key) => {
            const v = resolveValue(key, rowData!, i, dataList)
            return v != null && v !== '' ? String(v) : ''
          })
          if (replaced !== val) cell.value = replaced
        }
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    renderResults.value.push({ name: `${finalNames[i]}.xlsx`, blob: new Blob([buffer], { ... }) })
  }
}
```

设计思路：XLSX 渲染与 DOCX 的关键区别在于需要逐单元格操作。当单元格值是纯占位符（如 `{name}`）时，直接替换为数据值并保留原始的数字格式；当单元格值包含混合文本（如 `姓名：{name}`）时，进行字符串内嵌替换。`resolveValue` 函数额外处理了数值字符串转数字、日期字符串转 Excel 序列号等数据类型转换逻辑，确保数据填入 Excel 后仍能正确参与公式计算和格式显示。

### 8. XLSX 数值解析 (`resolveValue` 与 `dateStringToSerial`)

```ts
function dateStringToSerial(trimmed: string): number | null {
  const chineseDatePattern =
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  const m = trimmed.match(chineseDatePattern)
  if (m && parseInt(m[1]!) > 1900) {
    const MS_PER_DAY = 1000 * 60 * 60 * 24
    const totalMs = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, hours, minutes, seconds)
    return (totalMs - Date.UTC(1899, 11, 30)) / MS_PER_DAY
  }
  return null
}

function resolveValue(key: string, rowData: DataRow, index: number, dataList: DataRow[]): any {
  let v: any = undefined
  if (rowData[key] !== undefined && rowData[key] !== null) {
    v = rowData[key]
  } else if (key === 'rowIndex') {
    v = index + 1
  } else if (key === 'totalRows') {
    v = dataList.length
  } else if (key === 'items') {
    v = JSON.stringify(dataList)
  }
  // 数值字符串 → 数字；日期字符串 → Excel 序列号
  if (typeof v === 'string') {
    const trimmed = v.trim()
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
    const serial = dateStringToSerial(trimmed)
    if (serial !== null) return serial
  }
  return v
}
```

## 数据流架构

```
用户上传数据文件 (CSV / XLSX / XLS)
    │
    ├── CSV  →  Papa.parse(text, { header: true })
    │           ↓
    ├── XLSX →  XLSX.read(arrayBuffer)
    │           →  sheet_to_json({ raw: true })
    │           →  [DOCX模式] convertDatesInData()
    │           ↓
    └──────────→  dataList: Record<string, any>[]
                      │
                      │  skipRows 截取
                      ↓
              actualDataList
                      │
        ┌─────────────┼─────────────┐
        ↓                           ↓
  generateFilename()        resolveDuplicates()
        ↓                           ↓
  rawNames[]                finalNames[]
        │                           │
        └───────────┬───────────────┘
                    ↓
          逐行渲染循环
    ┌───────DOCX─────────┬─────────XLSX───────┐
    │ PizZip(template)   │ ExcelJS.Workbook() │
    │ Docxtemplater()    │ .xlsx.load()       │
    │ doc.render(data)   │ eachRow → eachCell │
    │ doc.getZip()       │ resolveValue()     │
    │ .generate(blob)    │ .writeBuffer()     │
    └───────┬────────────┴─────────┬─────────┘
            ↓                      ↓
    renderResults: { name, blob }[]
                    │
        ┌───────────┴───────────┐
        │ 单文件  →  saveAs()   │
        │ 多文件  →  JSZip()    │
        │           →  saveAs() │
        └───────────────────────┘
```

## 辅助工具函数

| 函数 | 功能 |
|------|------|
| `ensureString(input)` | 安全转字符串，null/undefined 返回空串 |
| `ensureNumber(input)` | 安全转数字，NaN 返回 0 |
| `sanitizeFilename(name)` | 去除文件名中非法字符（`\/:*?"<>\|`），空白规范化 |
| `convertDatesInData(data)` | 批量对数据行中的 Date 值进行格式化转换 |
| `generateFilename(row, template, index)` | 根据模板和数据行生成文件名 |
| `validateFilenameTemplate(template)` | 校验文件名模板的括号配对和字段名合法性 |
