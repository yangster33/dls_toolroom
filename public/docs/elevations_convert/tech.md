# 术

本工具采用现代化的前端技术栈，实现高效、准确的批量高程查询功能。

## 核心技术依赖

### Open-Meteo Elevation API
- **用途**：提供全球高程数据查询服务
- **官网**：https://open-meteo.com/
- **特点**：免费使用、支持跨域访问、支持批量查询、数据覆盖全球

### XLSX
- **用途**：Excel 文件导出
- **特点**：支持多种格式、兼容性好

## API接口规范

### 批量查询请求格式
```
GET https://api.open-meteo.com/v1/elevation?latitude=lat1,lat2,lat3&longitude=lon1,lon2,lon3
```

### 响应格式
```json
{
  "elevation": [44.4, 156.2, 89.1]
}
```

## 技术架构

采用模块化设计：
- **elevationService.ts**：封装 API 请求逻辑，提供单点和批量查询方法
- **ElevationsConvertPage.vue**：批量查询页面组件
- **ElevationQueryPage.vue**：单点查询页面组件

两个页面组件共享同一个服务类，避免代码重复。

## 输入格式

每行一个坐标，格式为：`经度,纬度`

示例：
```
116.4074,39.9042
120.1535,30.2874
104.0668,30.5728
```

## CORS支持

Open-Meteo Elevation API 支持跨域资源共享（CORS），响应头包含：
- `access-control-allow-origin: *`
- `access-control-allow-methods: GET, POST, OPTIONS`

这使得前端可以直接调用该API，无需后端代理。