# 术

本工具采用现代化前端技术栈，实现高效的距离传感器匹配功能。

## 核心技术依赖

### xlsx
- **用途**：读取和生成Excel文件
- **官网**：https://github.com/SheetJS/sheetjs

## 关键实现

### Haversine距离计算
```typescript
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000 // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}
```

### 匹配算法
```typescript
function findNearestSites(site, allSites, count) {
  const distances = allSites.map(other => ({
    site: other,
    distance: calculateDistance(site.latitude, site.longitude, 
                              other.latitude, other.longitude)
  }))
  return distances.sort((a, b) => a.distance - b.distance).slice(0, count)
}
```

## 技术架构

采用组件化设计：TemplateReader负责文件读取和验证，DistanceCalculator负责距离计算，TemplateExporter负责结果导出。各模块职责清晰，便于测试和维护。