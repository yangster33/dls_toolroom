# 术

本工具采用现代化的前端技术栈，实现高效、准确的批量高程查询功能。

## 核心技术依赖

### Open-Meteo Elevation API
- **用途**：提供全球高程数据查询服务
- **官网**：https://open-meteo.com/
- **特点**：免费使用、支持跨域访问、支持批量查询、数据覆盖全球

### XLSX
- **用途**：Excel 文件读写
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
- **TemplateExporter.ts**：定义模板表头
- **TemplateReader.ts**：验证上传的模板数据
- **ElevationsBatchPage.vue**：主页面组件

## 输入格式

模板文件包含三列：
- **名称**：点位名称
- **经度**：经度值（范围：-180 至 180）
- **纬度**：纬度值（范围：-90 至 90）

## CORS支持

Open-Meteo Elevation API 支持跨域资源共享（CORS），响应头包含：
- `access-control-allow-origin: *`
- `access-control-allow-methods: GET, POST, OPTIONS`

这使得前端可以直接调用该API，无需后端代理。

## 查询参数

- **请求延迟**：批量请求之间的固定延迟时间（单位：毫秒）
- **随机延迟**：启用后，延迟时间在最小延迟和最大延迟之间随机取值
- **最小延迟**：随机延迟的最小值（单位：毫秒）
- **最大延迟**：随机延迟的最大值（单位：毫秒）