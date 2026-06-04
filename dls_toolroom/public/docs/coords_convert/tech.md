# 术

本工具采用现代化前端技术栈，实现高效的批量坐标转换功能。

## 核心技术依赖

### gcoord
- **用途**：提供中国大陆常用坐标系（WGS84、GCJ02、BD09）之间的转换
- **官网**：https://github.com/hujiulong/gcoord
- **特点**：轻量级、纯JavaScript实现

### proj4
- **用途**：处理投影坐标系与地理坐标系之间的转换
- **官网**：https://proj4js.org/
- **特点**：支持多种投影方式

### xlsx
- **用途**：读取和生成Excel文件
- **官网**：https://github.com/SheetJS/sheetjs
- **特点**：支持多种Excel格式、处理效率高

## 关键实现

### 批量转换核心函数
```typescript
export async function batchConvertCoordinates(dataRows, options) {
  const result = { success: false, data: [], errors: [] }
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    // 坐标转换逻辑
    const converted = convertFunction([lngNum, latNum])
    if (converted) {
      result.data.push(newRow)
    } else {
      result.errors.push(`第 ${rowNum} 行转换失败`)
    }
  }
  
  return result
}
```

### CSV导出
```typescript
export function convertToCsv(data, headers) {
  const csvRows = [headers.join(',')]
  for (const row of data) {
    const rowValues = headers.map(header => row[header] || '')
    csvRows.push(rowValues.join(','))
  }
  return '\uFEFF' + csvRows.join('\n')
}
```

## 技术架构

采用模块化设计：TemplateReader负责文件读取和验证，coordsConversion负责坐标转换，TemplateExporter负责结果导出。各模块职责清晰，便于测试和维护。