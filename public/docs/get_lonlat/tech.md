# 术

本工具采用现代化前端技术栈，实现高效的地理编码功能。

## 核心技术依赖

### axios
- **用途**：发送HTTP请求调用地理编码API
- **官网**：https://axios-http.com/
- **特点**：Promise-based、支持拦截器、自动转换JSON

### gcoord
- **用途**：处理坐标系转换（GCJ02转WGS84）
- **官网**：https://github.com/hujiulong/gcoord
- **特点**：轻量级、纯JavaScript实现

## 关键实现

### 地址构建函数
```typescript
function buildFullAddress(addressData) {
  const parts = []
  if (addressData.province) parts.push(addressData.province)
  if (addressData.city) parts.push(addressData.city)
  if (addressData.district) parts.push(addressData.district)
  if (addressData.township) parts.push(addressData.township)
  if (addressData.community) parts.push(addressData.community)
  if (addressData.address) parts.push(addressData.address)
  return parts.join('')
}
```

### GCJ02转WGS84
```typescript
const [wgsLng, wgsLat] = gcoord.transform(
  [gcjLng, gcjLat], 
  gcoord.GCJ02, 
  gcoord.WGS84
) as [number, number]
```

### 边界判断
```typescript
function isInBounds(lng, lat, bounds) {
  return lng >= bounds.southwest.lng && 
         lng <= bounds.northeast.lng && 
         lat >= bounds.southwest.lat && 
         lat <= bounds.northeast.lat
}
```

## 技术架构

采用模块化设计：ApiService负责API调用和坐标转换，TemplateReader负责文件读取，TemplateExporter负责结果导出。支持多种地理编码服务提供商的扩展。