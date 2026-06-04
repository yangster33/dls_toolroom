# 术

本工具采用现代化的前端技术栈，实现高效、准确的高程查询功能。

## 核心技术依赖

### Open-Meteo Elevation API
- **用途**：提供全球高程数据查询服务
- **官网**：https://open-meteo.com/
- **特点**：免费使用、支持跨域访问、数据覆盖全球、响应速度快
- **数据来源**：基于 SRTM (Shuttle Radar Topography Mission) 90m 精度数字高程模型

## API接口规范

### 请求格式
```
GET https://api.open-meteo.com/v1/elevation?latitude=<纬度>&longitude=<经度>
```

### 响应格式
```json
{
  "elevation": [44.4]
}
```

### 请求示例
```javascript
fetch('https://api.open-meteo.com/v1/elevation?latitude=39.9&longitude=116.4')
  .then(response => response.json())
  .then(data => console.log(data.elevation[0]))
```

## CORS支持

Open-Meteo Elevation API 支持跨域资源共享（CORS），响应头包含：
- `access-control-allow-origin: *`
- `access-control-allow-methods: GET, POST, OPTIONS`

这使得前端可以直接调用该API，无需后端代理。

## 技术架构

采用简单直接的请求-响应模式：输入验证 → API请求 → 结果解析 → 界面展示。各环节清晰分离，便于维护和扩展。