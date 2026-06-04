# 术

本工具采用现代化前端技术栈，实现高效的表格转KML点位功能。

## 核心技术依赖

### xlsx
- **用途**：读取Excel文件
- **官网**：https://github.com/SheetJS/sheetjs
- **特点**：支持多种Excel格式、处理效率高

## 关键实现

### 颜色解析
```typescript
const CHINESE_COLOR_TO_PUSHPIN: Record<string, string> = {
  '#FF0000': 'red',
  '#00FF00': 'grn',
  '#0000FF': 'blue',
  '#FFFF00': 'ylw',
  '#FF00FF': 'pink',
  '#FFFFFF': 'wht',
}

function isChineseColor(color) {
  return !color.trim().startsWith('#')
}
```

### KML生成
```typescript
export function generateKml(points) {
  const folders = groupByFolder(points)
  const styles = collectStyles(points)
  
  // 生成样式定义
  const styleDefs = styles.map(([color, id]) => `
    <Style id="${id}">
      <IconStyle>
        <color>${kmlColor}</color>
        <Icon><href>${pushpinUrl}</href></Icon>
      </IconStyle>
    </Style>
  `)
  
  // 生成Placemark
  const placemarks = folders.map(folder => folder.points.map(pt => `
    <Placemark>
      <name>${pt.name}</name>
      <Point><coordinates>${pt.lng},${pt.lat},0</coordinates></Point>
    </Placemark>
  `))
  
  return `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>${styleDefs.join('')}${placemarks.join('')}</Document>
    </kml>`
}
```

## 技术架构

采用模块化设计：TemplateReader负责文件读取和验证，KmlGenerator负责KML生成，ColorParser负责颜色处理，TemplateExporter负责模板导出。各模块职责清晰，便于测试和维护。