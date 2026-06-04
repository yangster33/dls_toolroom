# 术

本工具采用现代化前端技术栈，实现高效的逆地理编码功能。

## 核心技术依赖

### axios
- **用途**：发送HTTP请求调用地理编码API
- **官网**：https://axios-http.com/
- **特点**：Promise-based、支持拦截器、自动转换JSON

### GeocodeBatchService（内部模块）
- **用途**：封装批量地理编码的延迟控制、错误重试和进度回调逻辑
- **位置**：`src/utils/GeocodeBatchService.ts`

### amapService（内部模块）
- **用途**：高德地图 API Key 验证，提供商接口抽象
- **位置**：`src/utils/amapService.ts`

## 关键实现

### API查询函数
```typescript
async function querySingleAddress(longitude, latitude, apiKey, provider) {
  const params = {
    key: apiKey,
    location: `${longitude},${latitude}`,
    output: 'json',
  }
  
  const response = await axios.get(config.url, { params, timeout: 10000 })
  
  if (response.status === 200) {
    const parsed = config.responseParser(response.data)
    return { ...parsed, longitude, latitude, provider }
  }
  
  throw new Error('查询失败')
}
```

### 批量查询实现
```typescript
export async function batchQueryAddresses(points, apiKeys, options, onProgress) {
  const results = []
  
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    
    await new Promise(resolve => 
      setTimeout(resolve, getRandomDelay(options))
    )
    
    const result = await querySingleAddress(
      point.longitude, point.latitude, 
      selectedKey.key, selectedKey.provider
    )
    
    results.push(result)
  }
  
  return results
}
```

## 技术架构

采用模块化设计：ApiService负责API调用，TemplateReader负责文件读取，TemplateExporter负责结果导出。支持多种地理编码服务提供商的扩展。