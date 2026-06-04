# SHP 转 KML — 技术说明

## 技术栈

- **SHP 解析**：直接读取 Shapefile 的二进制格式（.shp 文件），按 record 逐条解析
- **KML 生成**：基于 XML 模板生成符合 OGC KML 2.2 标准的文件
- **颜色处理**：CSS Hex 颜色 → KML AABBGGRR 格式转换

## SHP 文件格式

Shapefile 由文件头（100 字节）和若干记录组成。文件头以 Big-Endian `9994` 魔数开头。

每条记录包含：
- 记录头（8 字节）：记录编号 + 内容长度
- 记录内容：Shape Type + 坐标数据

支持的 Shape Type：
- `1` — Point
- `3` — PolyLine（LineString）
- `5` — Polygon
- `13` — PolyLineZ
- `15` — PolygonZ

## KML 样式映射

| 几何类型 | KML 元素 | Style 类型 |
|---------|---------|-----------|
| Point | `<Point>` | `<IconStyle>` — 白底图钉 + 颜色叠加 |
| LineString | `<LineString>` | `<LineStyle>` — 颜色 + 宽度 |
| Polygon | `<Polygon>` + `<LinearRing>` | `<PolyStyle>` — 填充色 + `<LineStyle>` 边框 |

## 代码架构

- `ShpToKmlGenerator.ts` — KML 生成与下载
- `Shp2KmlPage.vue` — 用户交互 UI
- 复用 `gis2excel/GisFileReader.ts` 的 SHP 解析
- 复用 `table2kml_point/ColorParser.ts` 的颜色转换
