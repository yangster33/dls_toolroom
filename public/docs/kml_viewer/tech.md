# 术

## 核心依赖

### leaflet
- **用途**：轻量级开源地图引擎，提供瓦片加载、图层管理、交互控制
- **官网**：https://leafletjs.com/
- **版本**：^1.9.4

## 地图底图配置

底图切换通过 Leaflet 的 `TileLayer` 实现，各底图采用标准的 WMTS/TMS 瓦片协议：

- **OpenStreetMap**：标准 OSM 瓦片，坐标系 EPSG:3857
- **高德地图**：GCJ-02 坐标系，无需 API Key
- **Google 地图**：WGS-84/GCJ-02（国内），无需 API Key
- **腾讯地图**：GCJ-02 坐标系，无需 API Key

瓦片地址配置在 `tileProviders.ts` 中集中管理：

```typescript
// tileProviders.ts — 统一的底图 TileLayer 工厂函数
export function createTileLayer(provider: TileProvider): L.TileLayer {
  return L.tileLayer(provider.url, { attribution: provider.attribution })
}
```

## KML 解析流程

KML 文件使用浏览器原生 `DOMParser` 手动解析，不依赖第三方 KML 解析库：

```
用户拖拽/选择 KML 文件
    ↓
FileReader 读取文件为文本
    ↓
DOMParser 解析 XML → DOM 树
    ↓
parseKmlStyles() 提取 <Style> 元素，建立 styleId → 颜色映射
    ↓
parseKmlNode() 递归遍历 DOM：解析 Folder / Placemark / Point / LineString / Polygon
    ↓
构建树形数据结构（KmlTreeNode），每条节点包含名称、几何类型、坐标数组、颜色
    ↓
Leaflet GeoJSON Layer 渲染到地图，自适应视野（fitBounds）
```

### 样式解析

```typescript
// 解析 KML 中的 <Style> 定义
function parseKmlStyles(xmlDoc: Document): Map<string, string> {
  const styles = new Map<string, string>()
  // 遍历 Style 元素，提取 IconStyle/LineStyle/PolyStyle 的颜色
  // 通过 parseKmlColorEl() 解析 ABGR 格式颜色值并转换为 #RRGGBB
}
```

### 节点递归解析

```typescript
// 递归解析 KML DOM 节点树
function parseKmlNode(xmlEl: Element, parent: KmlTreeNodeData, styles: Map<string, string>) {
  // 根据标签名分发：Folder → 递归子节点
  //                Placemark → 提取名称、几何、样式
  //                Point / LineString / Polygon → 解析坐标串
}
```

## 坐标系说明

大部分在线底图使用 GCJ-02 坐标系（火星坐标），KML 文件通常使用 WGS-84 坐标系。加载到国内底图时可能存在数百米的偏移。可在后续版本中集成坐标转换模块进行自动纠偏。

## 图层树与拖拽

KML 文件结构以可交互的树形组件呈现，每个节点对应 KML 中的 Folder 或 Placemark。支持复选框控制图层显隐，Leaflet LayerGroup 管理多图层，操作复杂度为 O(1)。

## 性能考虑

- KML 解析为一次性操作（FileReader + DOMParser），解析完成后不重复执行
- 单个 KML 文件即使包含数千个要素，在 Leaflet 中仍能流畅浏览
- 图层的显隐切换通过 Leaflet 的 addLayer/removeLayer 方法，无需重新解析
