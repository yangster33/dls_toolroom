# 术

本工具采用现代化的前端技术栈，实现高效、准确的坐标转换功能。

## 核心技术依赖

### gcoord
- **用途**：提供中国大陆常用坐标系（WGS84、GCJ02、BD09）之间的转换
- **官网**：https://github.com/hujiulong/gcoord
- **特点**：轻量级、纯JavaScript实现、无需后端支持

### proj4
- **用途**：处理投影坐标系与地理坐标系之间的转换，支持CGCS2000等国家标准坐标系
- **官网**：https://proj4js.org/
- **特点**：支持多种投影方式、精度高、配置灵活

## 关键实现

### 坐标系定义
```typescript
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs')
proj4.defs('EPSG:4490', '+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs')
```

### CGCS2000投影构建
```typescript
function buildCGCS2000ProjString(params) {
  const cm = computeCentralMeridian(params.centralMeridian, params.zoneWidth)
  return `+proj=tmerc +lat_0=${params.originLatitude} +lon_0=${cm} 
          +k=${params.scaleFactor} +x_0=${params.falseEasting} 
          +y_0=${params.falseNorthing} +ellps=GRS80 +units=m +no_defs`
}
```

## 技术架构

采用单向数据流架构：输入验证 → 基准转换 → 目标转换 → 结果输出。各环节解耦，便于维护和扩展。