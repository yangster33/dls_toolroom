# 术

本工具集成了以下技术组件实现空间数据的解析、分析与导出。

## 核心技术依赖

### @turf/turf — 空间分析引擎

- **用途**：提供完整的空间几何计算与布尔关系判定功能，包括距离、方位角、面积、质心、线上最近点、线交点，以及包含、相交、交叉、平行、重叠、分离、相等、点在线判断、点在面内判断等空间谓词。
- **官网**：https://www.npmjs.com/package/@turf/turf
- **GitHub**：https://github.com/Turfjs/turf
- **项目角色**：承担全部空间分析计算的底层实现，从简单属性度量到复杂拓扑关系判断均由 Turf.js 完成。

### togeojson — KML 格式转换

- **用途**：将 KML（Keyhole Markup Language）格式的地理标记文档转换为 GeoJSON 标准的地理要素集合。
- **官网**：https://www.npmjs.com/package/togeojson
- **GitHub**：https://github.com/mapbox/togeojson
- **项目角色**：作为 KML 文件解析的核心桥梁，将 XML 结构的 KML 文档转换为标准化的 GeoJSON FeatureCollection，供后续分析使用。

### jszip — KMZ 压缩文件处理

- **用途**：读取并解压 KMZ 格式文件（本质上是一个包含 KML 文件的 ZIP 压缩包），从中提取 KML 内容。
- **官网**：https://www.npmjs.com/package/jszip
- **GitHub**：https://github.com/Stuk/jszip
- **项目角色**：用于处理 KMZ 格式的上传文件，解压后提取其中包含的 .kml 文件，再交由 togeojson 进行解析。

### xlsx (SheetJS) — 表格数据导出

- **用途**：将分析结果导出为 Excel (.xlsx) 和 CSV 格式的电子表格文件。
- **官网**：https://www.npmjs.com/package/xlsx
- **GitHub**：https://github.com/SheetJS/sheetjs
- **项目角色**：将分析结果的结构化数据写入工作簿并触发浏览器下载，支持多工作表和多格式导出。

## 关键实现

### KML 文件解析与 GeoJSON 转换

```typescript
const parser = new DOMParser()
const xmlDoc = parser.parseFromString(content, 'text/xml')

const parseError = xmlDoc.querySelector('parsererror')
if (parseError) {
  errors.push('KML 文件格式不正确，无法解析')
  return { success: false, features: [], errors, totalPoints: 0, totalLines: 0, totalPolygons: 0 }
}

const geojson = toGeoJson.kml(xmlDoc)
```

设计思路：使用浏览器原生的 DOMParser 解析 XML 内容，通过检查 `parsererror` 节点快速判定格式合法性，再交由 togeojson 完成 KML 到 GeoJSON 的语义转换。

### KMZ 文件解压与提取

```typescript
const zip = await JSZip.loadAsync(arrayBuffer)

// 查找 KML 文件
const kmlFile = zip.file(/\.kml$/i)[0]
if (!kmlFile) {
  errors.push('KMZ 文件中未找到 KML 文件')
  return { success: false, features: [], errors, totalPoints: 0, totalLines: 0, totalPolygons: 0 }
}

const kmlContent = await kmlFile.async('string')
```

设计思路：使用正则匹配在 ZIP 包中定位 .kml 文件而非硬编码文件名，增强了容错性。将 ArrayBuffer 加载、文件查找、内容提取分为三个清晰的异步步骤。

### 点与点关系分析（两两笛卡尔积，上三角优化）

```typescript
for (let i = 0; i < points.length; i++) {
  for (let j = i + 1; j < points.length; j++) {
    const ptA = turf.point(pointA.coordinates)
    const ptB = turf.point(pointB.coordinates)
    const distance = turf.distance(ptA, ptB, { units: 'kilometers' })
    const bearing = turf.bearing(ptA, ptB)

    data.push({
      距离_km: distance.toFixed(4),
      方位角_度: bearing.toFixed(2),
      是否重合: turf.booleanEqual(ptA, ptB) ? '是' : '否',
    })
  }
}
```

设计思路：内层循环从 `j = i + 1` 开始，仅遍历上三角矩阵，使计算次数从 n² 降为 n(n-1)/2，避免重复计算 A→B 和 B→A。距离采用公里单位并保留 4 位小数，方位角保留 2 位小数。

### 线与线拓扑关系判定

```typescript
const intersections = turf.lineIntersect(lineA, lineB)

data.push({
  是否相交: turf.booleanIntersects(lineA, lineB) ? '是' : '否',
  是否交叉: turf.booleanCrosses(lineA, lineB) ? '是' : '否',
  是否平行: turf.booleanParallel(lineA, lineB) ? '是' : '否',
  是否相等: turf.booleanEqual(lineA, lineB) ? '是' : '否',
  是否重叠: turf.booleanOverlap(lineA, lineB) ? '是' : '否',
  交点数量: intersections.features.length,
})
```

设计思路：通过 Turf.js 的多种布尔谓词函数一次性覆盖所有线线关系维度，每个判断互不依赖、并行可读。交点数量通过 `lineIntersect` 返回的 FeatureCollection 的 features 数量直接获取。

### 面与面交叠面积计算

```typescript
let intersectionArea = '0'
try {
  const fcA = turf.featureCollection([polyA])
  const fcB = turf.featureCollection([polyB])
  const intersection = turf.intersect(fcA, fcB)
  if (intersection && intersection.features && intersection.features.length > 0) {
    intersectionArea = (turf.area(intersection) / 1000000).toFixed(4)
  }
} catch {
  intersectionArea = '0'
}
```

设计思路：将两个多边形分别包装为 FeatureCollection 后调用 `turf.intersect` 计算交集区域，再使用 `turf.area` 获取交叠面积。使用 try-catch 包裹以应对无交集或几何异常情况，确保分析流程不被单对数据的错误中断。

### XLSX 多工作表导出

```typescript
const workbook = XLSX.utils.book_new()

for (const result of results) {
  if (selectedTypes.includes(result.type)) {
    const worksheet = XLSX.utils.json_to_sheet(result.data)
    XLSX.utils.book_append_sheet(workbook, worksheet, result.label)
  }
}

XLSX.writeFile(workbook, `空间分析报告_${timestamp}.xlsx`)
```

设计思路：每种分析类型对应一个独立工作表，工作表名使用分析类型的中文标签。文件以"空间分析报告"加日期时间戳命名，直观可追溯。

### 几何类型分类与标准化接口

```typescript
export interface GeoFeature {
  id: string
  name: string
  type: 'Point' | 'LineString' | 'Polygon'
  coordinates: number[] | number[][] | number[][][]
  properties: Record<string, unknown>
  feature: GeoJSON.Feature
}

export interface PointFeature extends GeoFeature {
  type: 'Point'
  coordinates: number[]
}
```

设计思路：定义统一的 GeoFeature 基础接口，再通过 TypeScript 的类型派生细化三种几何类型的坐标结构（一维数组/二维数组/三维数组），确保类型系统在编译期即可捕获不匹配的几何操作。

## 技术架构

整体数据流为单向流水线：

```
文件上传 (KML/KMZ)
  → 格式识别（扩展名检测）
    → [KML] DOMParser 解析 XML → togeojson 转 GeoJSON
    → [KMZ] JSZip 解压 → 提取 .kml → DOMParser 解析 → togeojson 转 GeoJSON
  → 几何类型分类（Point/LineString/Polygon，含 Multi 类型拍平）
  → 可用分析类型筛选（根据要素数量阈值）
  → 逐类型空间分析（Turf.js 计算）
  → 结果聚合 → 表格导出（SheetJS: XLSX/CSV）
```

每条分析任务支持进度回调与取消信号，确保长耗时计算（如大量要素的笛卡尔积分析）的用户体验可控。