# 术

本工具采用现代化前端技术栈，实现高效的基站扇区KML生成功能。

## 核心技术依赖

### xlsx
- **用途**：读取Excel文件
- **官网**：https://github.com/SheetJS/sheetjs
- **特点**：支持多种Excel格式、处理效率高

### KmlGenerator (utils)
- **用途**：生成KML文档
- **特点**：支持扇区多边形生成、样式定义、文件夹分组

## 关键实现

### 扇区数据转换
```typescript
const sectors = dataRows.map(row => ({
  name: row['扇区名称'],
  longitude: row['经度'],
  latitude: row['纬度'],
  azimuth: row['方位角'],
  halfPowerAngle: row['半功率角'],
  radius: row['半径'],
  folder: row['文件夹'],
  color: row['颜色'],
  opacity: row['半透明度'] || 0.5,
}))
```

### KML生成调用
```typescript
const kmlContent = generateKml(sectors, { name: '基站扇区图' })
downloadKml(kmlContent, 'basestation.kml')
```

## 技术架构

采用模块化设计：TemplateReader负责文件读取和验证，KmlGenerator负责KML生成（位于utils目录），TemplateExporter负责模板导出。各模块职责清晰，便于测试和维护。

## 数据字段说明

### 必填字段
- **扇区名称**：扇区的标识名称
- **经度**：基站经度坐标（WGS84）
- **纬度**：基站纬度坐标（WGS84）
- **方位角**：扇区主瓣方向（0-360度）
- **半功率角**：扇区覆盖角度的一半
- **半径**：扇区覆盖半径（米）

### 可选字段
- **区域**：行政区域划分
- **小区覆盖类型**：覆盖类型描述
- **厂家**：设备制造商
- **天线挂高**：天线架设高度（米）
- **带宽**：频段带宽
- **收发模式**：收发配置
- **网管基站名**：网管系统中的基站名称
- **物理站名**：实际物理站点名称
- **颜色**：扇区显示颜色
- **半透明度**：填充透明度（0-1）
- **文件夹**：KML中的分组名称