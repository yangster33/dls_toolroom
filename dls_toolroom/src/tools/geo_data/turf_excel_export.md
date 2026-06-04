# Turf.js 空间分析与 Excel 导出指南

## 概述

Turf.js 是一个强大的 JavaScript 地理空间分析库，可以对包含点（Point）、线（LineString）、面（Polygon）的 GeoJSON 数据进行各种空间关系判断和测量分析。这些分析结果都可以导出为 Excel 格式，便于进一步处理和报告生成。

---

## 一、单点要素分析与 Excel 输出

### 1.1 单点信息提取

| Excel 字段 | 说明 | 数据类型 | 示例值 |
|-----------|------|---------|--------|
| name | 点名称 | 字符串 | "北京天安门" |
| longitude | 经度 | 数值 | 116.3972 |
| latitude | 纬度 | 数值 | 39.9075 |
| bbox_min_lng | 外包矩形最小经度 | 数值 | 116.3972 |
| bbox_min_lat | 外包矩形最小纬度 | 数值 | 39.9075 |
| bbox_max_lng | 外包矩形最大经度 | 数值 | 116.3972 |
| bbox_max_lat | 外包矩形最大纬度 | 数值 | 39.9075 |
| properties | 自定义属性 | JSON字符串 | {"type": "landmark"} |

> 注：对外包矩形（bounding box）统一输出四项字段可保持与线/面要素结构一致，便于批量处理。

### 1.2 Turf.js 代码示例

```javascript
import * as turf from '@turf/turf';

const point = turf.point([116.3972, 39.9075], { name: '北京天安门', type: 'landmark' });
const bbox = turf.bbox(point);

const pointInfo = {
  name: point.properties.name,
  longitude: point.geometry.coordinates[0],
  latitude: point.geometry.coordinates[1],
  bbox_min_lng: bbox[0],
  bbox_min_lat: bbox[1],
  bbox_max_lng: bbox[2],
  bbox_max_lat: bbox[3],
  properties: JSON.stringify(point.properties)
};
```

---

## 二、单线要素分析与 Excel 输出

### 2.1 线要素信息提取

| Excel 字段 | 说明 | 数据类型 | 示例值 |
|-----------|------|---------|--------|
| name | 线名称 | 字符串 | "京藏高速" |
| length_km | 线长度(公里) | 数值 | 5570.8 |
| point_count | 坐标点数量 | 整数 | 45 |
| bearing_start_end_deg | 起点到终点方位角(度) | 数值 | 285.3 |
| start_lng | 起点经度 | 数值 | 116.3 |
| start_lat | 起点纬度 | 数值 | 39.9 |
| end_lng | 终点经度 | 数值 | 106.2 |
| end_lat | 终点纬度 | 数值 | 38.5 |
| bbox_min_lng | 外包矩形最小经度 | 数值 | 106.2 |
| bbox_min_lat | 外包矩形最小纬度 | 数值 | 38.5 |
| bbox_max_lng | 外包矩形最大经度 | 数值 | 116.3 |
| bbox_max_lat | 外包矩形最大纬度 | 数值 | 39.9 |

### 2.2 Turf.js 代码示例

```javascript
const line = turf.lineString([
  [116.3, 39.9],
  [115.2, 39.5],
  [106.2, 38.5]
], { name: '京藏高速' });

const coords = line.geometry.coordinates;
const start = turf.point(coords[0]);
const end = turf.point(coords[coords.length - 1]);
const bbox = turf.bbox(line);

const lineInfo = {
  name: line.properties.name,
  length_km: turf.length(line, { units: 'kilometers' }).toFixed(2),
  point_count: coords.length,
  bearing_start_end_deg: turf.bearing(start, end).toFixed(2),
  start_lng: coords[0][0],
  start_lat: coords[0][1],
  end_lng: coords[coords.length - 1][0],
  end_lat: coords[coords.length - 1][1],
  bbox_min_lng: bbox[0],
  bbox_min_lat: bbox[1],
  bbox_max_lng: bbox[2],
  bbox_max_lat: bbox[3]
};
```

### 2.3 延伸功能

| 函数 | 说明 |
|------|------|
| `turf.along(line, distance)` | 沿线上从起点走指定距离后的点位置 |
| `turf.lineSlice(startPt, endPt, line)` | 截取线上两点之间的子线段 |
| `turf.lineChunk(line, segmentLength)` | 将线按固定长度切分为多段 |

---

## 三、单面要素分析与 Excel 输出

### 3.1 面要素信息提取

| Excel 字段 | 说明 | 数据类型 | 示例值 |
|-----------|------|---------|--------|
| name | 面名称 | 字符串 | "北京市" |
| area_km2 | 面积(平方公里) | 数值 | 16410.54 |
| perimeter_km | 周长(公里) | 数值 | 528.3 |
| centroid_lng | 几何中心经度 | 数值 | 116.4074 |
| centroid_lat | 几何中心纬度 | 数值 | 39.9042 |
| inside_point_lng | 面内保证点经度 | 数值 | 116.4074 |
| inside_point_lat | 面内保证点纬度 | 数值 | 39.9042 |
| vertex_count | 顶点数量 | 整数 | 12 |
| hole_count | 孔洞数量 | 整数 | 0 |
| has_holes | 是否有孔洞 | 布尔值 | false |
| bbox_min_lng | 外包矩形最小经度 | 数值 | 115.4 |
| bbox_min_lat | 外包矩形最小纬度 | 数值 | 39.4 |
| bbox_max_lng | 外包矩形最大经度 | 数值 | 117.5 |
| bbox_max_lat | 外包矩形最大纬度 | 数值 | 41.0 |

> **重要**：`turf.centroid()` 对凹多边形返回的中心点可能在面外。如果业务需要保证"中心点一定在面内"，应使用 `turf.pointOnFeature()`，它会返回面内保证点。建议两个都输出（centroid 用于数学计算，inside_point 用于标签定位）。

### 3.2 Turf.js 代码示例

```javascript
const polygon = turf.polygon([[
  [115.4, 41.0],
  [117.5, 41.0],
  [117.5, 39.4],
  [115.4, 39.4],
  [115.4, 41.0]
]], { name: '北京市' });

const centroid = turf.centroid(polygon);
const insidePoint = turf.pointOnFeature(polygon);
const bbox = turf.bbox(polygon);
const outerRing = polygon.geometry.coordinates[0];
const holeRings = polygon.geometry.coordinates.slice(1);

const polygonInfo = {
  name: polygon.properties.name,
  area_km2: (turf.area(polygon) / 1000000).toFixed(2),
  perimeter_km: turf.length(turf.polygonToLine(polygon), { units: 'kilometers' }).toFixed(2),
  centroid_lng: centroid.geometry.coordinates[0],
  centroid_lat: centroid.geometry.coordinates[1],
  inside_point_lng: insidePoint.geometry.coordinates[0],
  inside_point_lat: insidePoint.geometry.coordinates[1],
  vertex_count: outerRing.length,
  hole_count: holeRings.length,
  has_holes: polygon.geometry.coordinates.length > 1,
  bbox_min_lng: bbox[0],
  bbox_min_lat: bbox[1],
  bbox_max_lng: bbox[2],
  bbox_max_lat: bbox[3]
};
```

---

## 四、点与点关系分析

### 4.1 可用判断方法

| 判断方法 | Turf.js 函数 | 说明 | 返回值 |
|---------|-------------|------|--------|
| 距离计算 | `turf.distance()` | 两点间大圆球面距离 | 数值(公里) |
| 恒向线距离 | `turf.rhumbDistance()` | 两点间恒向线距离 | 数值(公里) |
| 方位角 | `turf.bearing()` | 从点A到点B的大圆方位角 | 数值(度) |
| 恒向线方位角 | `turf.rhumbBearing()` | 从点A到点B的恒向线方位角 | 数值(度) |
| 中点计算 | `turf.midpoint()` | 两点之间的中点 | GeoJSON Point |
| 目标点计算 | `turf.destination()` | 从起点沿方位角走指定距离后的点 | GeoJSON Point |
| 最近点查找 | `turf.nearestPoint()` | 在点集合中查找距离目标最近的点 | GeoJSON Point |
| 相等判断 | `turf.booleanEqual()` | 两点是否相同 | 布尔值 |

### 4.2 Excel 输出格式

| Excel 字段 | 说明 | 数据类型 |
|-----------|------|---------|
| point_a_name | 点A名称 | 字符串 |
| point_a_lng | 点A经度 | 数值 |
| point_a_lat | 点A纬度 | 数值 |
| point_b_name | 点B名称 | 字符串 |
| point_b_lng | 点B经度 | 数值 |
| point_b_lat | 点B纬度 | 数值 |
| distance_km | 大圆距离(公里) | 数值 |
| rhumb_distance_km | 恒向线距离(公里) | 数值 |
| bearing_deg | 大圆方位角(度) | 数值 |
| rhumb_bearing_deg | 恒向线方位角(度) | 数值 |
| is_equal | 是否相等 | 布尔值 |

### 4.3 Turf.js 代码示例

```javascript
const pointA = turf.point([116.3972, 39.9075], { name: '天安门' });
const pointB = turf.point([116.4074, 39.9176], { name: '故宫' });

const pointPointRelation = {
  point_a_name: pointA.properties.name,
  point_a_lng: pointA.geometry.coordinates[0],
  point_a_lat: pointA.geometry.coordinates[1],
  point_b_name: pointB.properties.name,
  point_b_lng: pointB.geometry.coordinates[0],
  point_b_lat: pointB.geometry.coordinates[1],
  distance_km: turf.distance(pointA, pointB, { units: 'kilometers' }).toFixed(4),
  rhumb_distance_km: turf.rhumbDistance(pointA, pointB, { units: 'kilometers' }).toFixed(4),
  bearing_deg: turf.bearing(pointA, pointB).toFixed(2),
  rhumb_bearing_deg: turf.rhumbBearing(pointA, pointB).toFixed(2),
  is_equal: turf.booleanEqual(pointA, pointB)
};
```

---

## 五、点与线关系分析

### 5.1 可用判断方法

| 判断方法 | Turf.js 函数 | 说明 | 返回值 |
|---------|-------------|------|--------|
| 点在线上 | `turf.booleanPointOnLine()` | 点是否在线要素上 | 布尔值 |
| 点到线距离 | `turf.pointToLineDistance()` | 点到线的最短距离 | 数值(米) |
| 线上最近点 | `turf.nearestPointOnLine()` | 线上距离点最近的点 | GeoJSON Point |
| 点线不相交 | `turf.booleanDisjoint()` | 点与线是否不相交 | 布尔值 |

### 5.2 Excel 输出格式

| Excel 字段 | 说明 | 数据类型 |
|-----------|------|---------|
| point_name | 点名称 | 字符串 |
| point_lng | 点经度 | 数值 |
| point_lat | 点纬度 | 数值 |
| line_name | 线名称 | 字符串 |
| is_on_line | 点是否在线上 | 布尔值 |
| is_disjoint | 点线是否不相交 | 布尔值 |
| distance_m | 点到线的距离(米) | 数值 |
| nearest_point_lng | 线上最近点经度 | 数值 |
| nearest_point_lat | 线上最近点纬度 | 数值 |
| nearest_point_dist_along_km | 最近点距线起点的沿线距离(公里) | 数值 |

### 5.3 Turf.js 代码示例

```javascript
const point = turf.point([116.35, 39.9], { name: '测试点' });
const line = turf.lineString([
  [116.3, 39.9],
  [116.4, 39.9],
  [116.4, 40.0]
], { name: '测试线' });

const nearestOnLine = turf.nearestPointOnLine(line, point);

const pointLineRelation = {
  point_name: point.properties.name,
  point_lng: point.geometry.coordinates[0],
  point_lat: point.geometry.coordinates[1],
  line_name: line.properties.name,
  is_on_line: turf.booleanPointOnLine(point, line),
  is_disjoint: turf.booleanDisjoint(point, line),
  distance_m: turf.pointToLineDistance(point, line, { units: 'meters' }).toFixed(2),
  nearest_point_lng: nearestOnLine.geometry.coordinates[0],
  nearest_point_lat: nearestOnLine.geometry.coordinates[1],
  nearest_point_dist_along_km: (nearestOnLine.properties.location / 1000).toFixed(4)
};
```

> **变更说明**：Turf.js v7 中 `turf.pointOnLine()` 已废弃，统一使用 `turf.nearestPointOnLine()`。原文档中不存在的 `turf.project()` 已移除。

---

## 六、点与面关系分析

### 6.1 可用判断方法

| 判断方法 | Turf.js 函数 | 说明 | 返回值 |
|---------|-------------|------|--------|
| 点在面内 | `turf.booleanPointInPolygon()` | 点是否在多边形内 | 布尔值 |
| 面包含点(含边界) | `turf.booleanContains()` | 面是否包含点(点在边界上也返回 true) | 布尔值 |
| 面包含点(忽略边界) | `turf.booleanPointInPolygon(pt, poly, {ignoreBoundary: true})` | 忽略边界判断 | 布尔值 |
| 点面不相交 | `turf.booleanDisjoint()` | 点与面是否不相交 | 布尔值 |
| 点到面边界距离 | `turf.pointToLineDistance(point, turf.polygonToLine(polygon))` | 点到面边界的最短距离 | 数值(米) |

> **修正**：原文档使用 `turf.distance(point, polygon)` 计算点到面距离，这是错误的——`turf.distance()` 仅接受两个 Point 参数。正确做法是先将面转为线，再调用 `turf.pointToLineDistance()`。

### 6.2 Excel 输出格式

| Excel 字段 | 说明 | 数据类型 |
|-----------|------|---------|
| point_name | 点名称 | 字符串 |
| point_lng | 点经度 | 数值 |
| point_lat | 点纬度 | 数值 |
| polygon_name | 面名称 | 字符串 |
| is_inside | 点是否在面内 | 布尔值 |
| is_inside_ignore_boundary | 忽略边界时点是否在面内 | 布尔值 |
| polygon_contains_point | 面是否包含点 | 布尔值 |
| is_disjoint | 点面是否不相交 | 布尔值 |
| distance_to_boundary_m | 点到面边界的最短距离(米) | 数值 |

### 6.3 Turf.js 代码示例

```javascript
const point = turf.point([116.4, 39.95], { name: '测试点' });
const polygon = turf.polygon([[
  [116.3, 39.9],
  [116.5, 39.9],
  [116.5, 40.0],
  [116.3, 40.0],
  [116.3, 39.9]
]], { name: '测试区域' });

const polygonAsLine = turf.polygonToLine(polygon);

const pointPolygonRelation = {
  point_name: point.properties.name,
  point_lng: point.geometry.coordinates[0],
  point_lat: point.geometry.coordinates[1],
  polygon_name: polygon.properties.name,
  is_inside: turf.booleanPointInPolygon(point, polygon),
  is_inside_ignore_boundary: turf.booleanPointInPolygon(point, polygon, { ignoreBoundary: true }),
  polygon_contains_point: turf.booleanContains(polygon, point),
  is_disjoint: turf.booleanDisjoint(point, polygon),
  distance_to_boundary_m: turf.pointToLineDistance(point, polygonAsLine, { units: 'meters' }).toFixed(2)
};
```

---

## 七、线与线关系分析

### 7.1 可用判断方法

| 判断方法 | Turf.js 函数 | 说明 | 返回值 |
|---------|-------------|------|--------|
| 线相交 | `turf.booleanCrosses()` | 两线是否交叉(内部相交) | 布尔值 |
| 线相交(广义) | `turf.booleanIntersects()` | 两线是否相交(包括端点) | 布尔值 |
| 线不相交 | `turf.booleanDisjoint()` | 两线是否不相交 | 布尔值 |
| 线平行 | `turf.booleanParallel()` | 两线是否平行 | 布尔值 |
| 线相等 | `turf.booleanEqual()` | 两线是否相同 | 布尔值 |
| 线重叠段 | `turf.lineOverlap()` | 两线重叠的线段 | GeoJSON FeatureCollection |
| 交点计算 | `turf.lineIntersect()` | 计算两线交点 | GeoJSON FeatureCollection |

> **修正**：原文档使用 `turf.booleanOverlap()` 判断线重叠，这是错误的——`booleanOverlap` 仅适用于同维度的面要素（Polygon/MultiPolygon），对 LineString 调用始终返回 false。正确做法是用 `turf.lineOverlap()` 获取重叠线段，返回的 FeatureCollection 非空即表示存在重叠。

### 7.2 Excel 输出格式

| Excel 字段 | 说明 | 数据类型 |
|-----------|------|---------|
| line_a_name | 线A名称 | 字符串 |
| line_b_name | 线B名称 | 字符串 |
| line_a_length_km | 线A长度(公里) | 数值 |
| line_b_length_km | 线B长度(公里) | 数值 |
| is_crosses | 是否交叉 | 布尔值 |
| is_intersects | 是否相交 | 布尔值 |
| is_disjoint | 是否不相交 | 布尔值 |
| is_parallel | 是否平行 | 布尔值 |
| is_equal | 是否相等 | 布尔值 |
| has_overlap | 是否有重叠段 | 布尔值 |
| overlap_length_km | 重叠段总长度(公里) | 数值 |
| intersection_count | 交点数量 | 整数 |

### 7.3 Turf.js 代码示例

```javascript
const lineA = turf.lineString([
  [116.3, 39.9],
  [116.5, 40.1]
], { name: '线A' });
const lineB = turf.lineString([
  [116.4, 40.1],
  [116.4, 39.8]
], { name: '线B' });

const intersections = turf.lineIntersect(lineA, lineB);
const overlapSegments = turf.lineOverlap(lineA, lineB);
const hasOverlap = overlapSegments.features.length > 0;
const overlapLength = hasOverlap
  ? overlapSegments.features.reduce((sum, f) => sum + turf.length(f, { units: 'kilometers' }), 0)
  : 0;

const lineLineRelation = {
  line_a_name: lineA.properties.name,
  line_b_name: lineB.properties.name,
  line_a_length_km: turf.length(lineA, { units: 'kilometers' }).toFixed(4),
  line_b_length_km: turf.length(lineB, { units: 'kilometers' }).toFixed(4),
  is_crosses: turf.booleanCrosses(lineA, lineB),
  is_intersects: turf.booleanIntersects(lineA, lineB),
  is_disjoint: turf.booleanDisjoint(lineA, lineB),
  is_parallel: turf.booleanParallel(lineA, lineB),
  is_equal: turf.booleanEqual(lineA, lineB),
  has_overlap: hasOverlap,
  overlap_length_km: overlapLength.toFixed(4),
  intersection_count: intersections.features.length
};
```

---

## 八、线与面关系分析

### 8.1 可用判断方法

| 判断方法 | Turf.js 函数 | 说明 | 返回值 |
|---------|-------------|------|--------|
| 线面相交 | `turf.booleanIntersects()` | 线与面是否相交 | 布尔值 |
| 线穿过面 | `turf.booleanCrosses()` | 线是否穿过面(部分在内部分在外) | 布尔值 |
| 线在面内 | `turf.booleanWithin()` | 线是否完全在面内 | 布尔值 |
| 面包含线 | `turf.booleanContains()` | 面是否包含线 | 布尔值 |
| 线面不相交 | `turf.booleanDisjoint()` | 线与面是否不相交 | 布尔值 |
| 线面接触 | `turf.booleanTouches()` | 线是否仅接触面边界而不进入内部 | 布尔值 |
| 线面交点 | `turf.lineIntersect()` | 计算线与面的交点 | GeoJSON FeatureCollection |
| 线被面分割 | `turf.lineSplit(line, polygon)` | 用面对线进行分割 | GeoJSON FeatureCollection |

### 8.2 Excel 输出格式

| Excel 字段 | 说明 | 数据类型 |
|-----------|------|---------|
| line_name | 线名称 | 字符串 |
| line_length_km | 线总长度(公里) | 数值 |
| polygon_name | 面名称 | 字符串 |
| polygon_area_km2 | 面面积(平方公里) | 数值 |
| is_intersects | 是否相交 | 布尔值 |
| is_crosses | 是否穿过 | 布尔值 |
| line_is_within_polygon | 线是否在面内 | 布尔值 |
| polygon_contains_line | 面是否包含线 | 布尔值 |
| is_disjoint | 是否不相交 | 布尔值 |
| is_touches | 是否仅边界接触 | 布尔值 |
| length_inside_km | 线在面内部分的长度(公里) | 数值 |
| intersection_count | 交点数量 | 整数 |

### 8.3 Turf.js 代码示例

```javascript
const line = turf.lineString([
  [116.25, 39.95],
  [116.55, 39.95]
], { name: '穿越线' });
const polygon = turf.polygon([[
  [116.3, 39.9],
  [116.5, 39.9],
  [116.5, 40.0],
  [116.3, 40.0],
  [116.3, 39.9]
]], { name: '测试区域' });

const intersections = turf.lineIntersect(line, polygon);
const splitResult = turf.lineSplit(line, polygon);

// 计算线在面内的总长度
let lengthInside = 0;
splitResult.features.forEach(segment => {
  const mid = turf.pointOnFeature(segment);
  if (turf.booleanPointInPolygon(mid, polygon)) {
    lengthInside += turf.length(segment, { units: 'kilometers' });
  }
});

const linePolygonRelation = {
  line_name: line.properties.name,
  line_length_km: turf.length(line, { units: 'kilometers' }).toFixed(4),
  polygon_name: polygon.properties.name,
  polygon_area_km2: (turf.area(polygon) / 1000000).toFixed(4),
  is_intersects: turf.booleanIntersects(line, polygon),
  is_crosses: turf.booleanCrosses(line, polygon),
  line_is_within_polygon: turf.booleanWithin(line, polygon),
  polygon_contains_line: turf.booleanContains(polygon, line),
  is_disjoint: turf.booleanDisjoint(line, polygon),
  is_touches: turf.booleanTouches(line, polygon),
  length_inside_km: lengthInside.toFixed(4),
  intersection_count: intersections.features.length
};
```

---

## 九、面与面关系分析

### 9.1 可用判断方法

| 判断方法 | Turf.js 函数 | 说明 | 返回值 |
|---------|-------------|------|--------|
| 面面相交 | `turf.booleanIntersects()` | 两面是否相交 | 布尔值 |
| 面面重叠 | `turf.booleanOverlap()` | 两面是否部分重叠(非包含关系) | 布尔值 |
| 面A在面B内 | `turf.booleanWithin()` | 面A是否在面B内 | 布尔值 |
| 面A包含面B | `turf.booleanContains()` | 面A是否包含面B | 布尔值 |
| 面面不相交 | `turf.booleanDisjoint()` | 两面是否不相交 | 布尔值 |
| 面面接触 | `turf.booleanTouches()` | 两面是否仅边界接触 | 布尔值 |
| 面面相等 | `turf.booleanEqual()` | 两面是否相同 | 布尔值 |
| 交集计算 | `turf.intersect()` | 计算两面交集 | GeoJSON Polygon/null |
| 并集计算 | `turf.union()` | 计算两面并集 | GeoJSON Polygon |
| 差集计算 | `turf.difference()` | 计算两面差集(A减B) | GeoJSON Polygon |
| 对称差集 | `turf.symDifference()` | 计算对称差集(属于A或B但不属于交集) | GeoJSON Polygon |

### 9.2 Excel 输出格式

| Excel 字段 | 说明 | 数据类型 |
|-----------|------|---------|
| poly_a_name | 面A名称 | 字符串 |
| poly_a_area_km2 | 面A面积(平方公里) | 数值 |
| poly_b_name | 面B名称 | 字符串 |
| poly_b_area_km2 | 面B面积(平方公里) | 数值 |
| is_intersects | 是否相交 | 布尔值 |
| is_overlap | 是否部分重叠 | 布尔值 |
| is_touches | 是否仅边界接触 | 布尔值 |
| poly_a_within_poly_b | 面A是否在面B内 | 布尔值 |
| poly_a_contains_poly_b | 面A是否包含面B | 布尔值 |
| is_disjoint | 是否不相交 | 布尔值 |
| is_equal | 是否相等 | 布尔值 |
| intersection_area_km2 | 交集面积(平方公里) | 数值 |
| union_area_km2 | 并集面积(平方公里) | 数值 |
| difference_area_km2 | 差集面积(A减B, 平方公里) | 数值 |
| sym_difference_area_km2 | 对称差集面积(平方公里) | 数值 |

### 9.3 Turf.js 代码示例

```javascript
const polyA = turf.polygon([[
  [116.3, 39.9],
  [116.5, 39.9],
  [116.5, 40.0],
  [116.3, 40.0],
  [116.3, 39.9]
]], { name: '区域A' });
const polyB = turf.polygon([[
  [116.4, 39.95],
  [116.6, 39.95],
  [116.6, 40.05],
  [116.4, 40.05],
  [116.4, 39.95]
]], { name: '区域B' });

const intersection = turf.intersect(polyA, polyB);
const union = turf.union(polyA, polyB);
const difference = turf.difference(polyA, polyB);
const symDiff = turf.symDifference(polyA, polyB);

const polygonPolygonRelation = {
  poly_a_name: polyA.properties.name,
  poly_a_area_km2: (turf.area(polyA) / 1000000).toFixed(4),
  poly_b_name: polyB.properties.name,
  poly_b_area_km2: (turf.area(polyB) / 1000000).toFixed(4),
  is_intersects: turf.booleanIntersects(polyA, polyB),
  is_overlap: turf.booleanOverlap(polyA, polyB),
  is_touches: turf.booleanTouches(polyA, polyB),
  poly_a_within_poly_b: turf.booleanWithin(polyA, polyB),
  poly_a_contains_poly_b: turf.booleanContains(polyA, polyB),
  is_disjoint: turf.booleanDisjoint(polyA, polyB),
  is_equal: turf.booleanEqual(polyA, polyB),
  intersection_area_km2: intersection ? (turf.area(intersection) / 1000000).toFixed(4) : 0,
  union_area_km2: union ? (turf.area(union) / 1000000).toFixed(4) : 0,
  difference_area_km2: difference ? (turf.area(difference) / 1000000).toFixed(4) : 0,
  sym_difference_area_km2: symDiff ? (turf.area(symDiff) / 1000000).toFixed(4) : 0
};
```

---

## 十、缓冲区分析（Buffer）

### 10.1 概述

`turf.buffer()` 可对点、线、面生成指定半径的缓冲区。这是空间邻近分析的核心工具。

| 应用场景 | 示例 |
|---------|------|
| 点缓冲区 | 基站覆盖范围（半径 500m 的圆） |
| 线缓冲区 | 高速公路两侧 200m 保护带 |
| 面缓冲区 | 自然保护区外围 1km 缓冲带 |

### 10.2 Excel 输出格式

| Excel 字段 | 说明 | 数据类型 |
|-----------|------|---------|
| source_name | 源要素名称 | 字符串 |
| source_type | 源要素类型(Point/LineString/Polygon) | 字符串 |
| buffer_radius_km | 缓冲半径(公里) | 数值 |
| buffer_area_km2 | 缓冲区面积(平方公里) | 数值 |
| target_name | 目标要素名称 | 字符串 |
| target_in_buffer | 目标是否在缓冲区内 | 布尔值 |

### 10.3 Turf.js 代码示例

```javascript
const point = turf.point([116.4, 39.9], { name: '基站A' });
const targetPoint = turf.point([116.405, 39.902], { name: '目标位置' });
const radiusKm = 0.5;

const buffer = turf.buffer(point, radiusKm, { units: 'kilometers' });
const targetInBuffer = turf.booleanIntersects(buffer, targetPoint);

const bufferAnalysis = {
  source_name: point.properties.name,
  source_type: 'Point',
  buffer_radius_km: radiusKm,
  buffer_area_km2: (turf.area(buffer) / 1000000).toFixed(4),
  target_name: targetPoint.properties.name,
  target_in_buffer: targetInBuffer
};
```

---

## 十一、Multi* 几何类型处理

### 11.1 处理策略

| 函数 | 说明 | 适用场景 |
|------|------|---------|
| `turf.flatten()` | 将 Multi* 展平为单要素 FeatureCollection | 需要对每个子要素单独分析时 |
| `turf.explode()` | 将几何体分解为顶点集合 | 需要逐顶点操作时 |
| `turf.combine()` | 将同类型 FeatureCollection 合并为 Multi* | 合并分析结果时 |

### 11.2 处理示例

```javascript
// MultiPolygon → 逐个 Polygon 分析
const multiPolygon = turf.multiPolygon([...], { name: '多区域' });
const flattened = turf.flatten(multiPolygon);

flattened.features.forEach((poly, index) => {
  const area = turf.area(poly) / 1000000;
  console.log(`子面 ${index + 1}: ${area.toFixed(2)} km²`);
});
```

---

## 十二、Excel 导出实现方法

### 12.1 使用 xlsx 库导出

```bash
npm install xlsx
```

```javascript
import * as XLSX from 'xlsx';

// 将分析结果数组转换为Excel并导出
function exportToExcel(dataArray, sheetName, fileName) {
  const worksheet = XLSX.utils.json_to_sheet(dataArray);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

// 多 Sheet 导出（所有分析类型合并到一个文件）
function exportMultiSheetExcel(sheetsData, fileName) {
  const workbook = XLSX.utils.book_new();
  sheetsData.forEach(({ data, sheetName }) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

// 使用示例
exportMultiSheetExcel([
  { data: pointInfoArray, sheetName: '点详情' },
  { data: lineInfoArray, sheetName: '线详情' },
  { data: polygonInfoArray, sheetName: '面详情' },
  { data: pointPointArray, sheetName: '点-点关系' },
  { data: pointLineArray, sheetName: '点-线关系' },
  { data: pointPolygonArray, sheetName: '点-面关系' },
  { data: lineLineArray, sheetName: '线-线关系' },
  { data: linePolygonArray, sheetName: '线-面关系' },
  { data: polygonPolygonArray, sheetName: '面-面关系' }
], '空间分析结果');
```

### 12.2 使用 CSV 格式导出

```javascript
function exportToCsv(dataArray, fileName) {
  const headers = Object.keys(dataArray[0]);

  // CSV 值转义：处理逗号、引号、换行符
  function escapeCsvValue(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  const rows = dataArray.map(row =>
    headers.map(h => escapeCsvValue(row[h])).join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');

  // 添加 BOM 头，确保 Excel 正确识别 UTF-8 中文
  const bom = '﻿';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
```

---

## 十三、输出格式汇总表

| 分析类型 | Excel 文件名示例 | 主要字段 |
|---------|----------------|---------|
| 单点分析 | point_details.xlsx | name, longitude, latitude, bbox |
| 单线分析 | line_details.xlsx | name, length_km, point_count, bearing_start_end_deg |
| 单面分析 | polygon_details.xlsx | name, area_km2, perimeter_km, centroid, inside_point, hole_count |
| 点与点关系 | point_point_relation.xlsx | distance_km, rhumb_distance_km, bearing_deg, rhumb_bearing_deg |
| 点与线关系 | point_line_relation.xlsx | is_on_line, is_disjoint, distance_m, nearest_point |
| 点与面关系 | point_polygon_relation.xlsx | is_inside, is_disjoint, distance_to_boundary_m |
| 线与线关系 | line_line_relation.xlsx | is_crosses, is_intersects, is_parallel, has_overlap, overlap_length_km |
| 线与面关系 | line_polygon_relation.xlsx | is_intersects, is_crosses, is_touches, length_inside_km |
| 面与面关系 | polygon_polygon_relation.xlsx | is_intersects, is_overlap, is_touches, intersection_area_km2, sym_difference_area_km2 |
| 缓冲区分析 | buffer_analysis.xlsx | source_name, buffer_radius_km, target_in_buffer |

---

## 十四、注意事项

1. **坐标系**：Turf.js 默认使用 WGS84（EPSG:4326）地理坐标系，经纬度顺序为 `[longitude, latitude]`
2. **单位**：距离计算默认单位为公里，面积默认单位为平方米
3. **精度**：建议对浮点数值进行四舍五入处理（如 `.toFixed(4)`）；可用 `turf.truncate(geom, {precision: 6})` 对 GeoJSON 坐标做精度截断，减少文件体积
4. **复杂几何**：对于 MultiPoint、MultiLineString、MultiPolygon，使用 `turf.flatten()` 展平后逐个子要素处理（详见第十一节）
5. **性能**：对于大规模数据，建议分批处理或使用 Web Worker
6. **凹多边形陷阱**：`turf.centroid()` 返回的几何中心可能落在凹多边形外部；需要面内保证点时请使用 `turf.pointOnFeature()`
7. **buffer 性能**：`turf.buffer()` 计算量较大，大批量使用时建议控制缓冲半径精度（steps 参数）或对坐标先做 `turf.truncate()` 降精度

---

*文档版本: 2.0*
*最后更新: 2026-05-22*
*基于 Turf.js v7.x*
