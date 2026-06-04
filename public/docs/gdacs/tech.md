# 术

本项目在 TypeScript 中使用了以下技术栈和算法实现。

## 数据获取

### Web Fetch API

使用浏览器内置的 `fetch` 函数发起 HTTP GET 请求，通过 `URLSearchParams` 构建查询字符串。

```ts
const params = new URLSearchParams()
params.set('fromdate', startDate!)
params.set('todate', endDate!)
params.set('pagenumber', formData.pageNumber.toString())
params.set('pagesize', formData.pageSize.toString())

const url = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?${params.toString()}`
const response = await fetch(url)
```

- 说明：Fetch API 是浏览器原生支持的 HTTP 客户端，无需额外安装。
- 参考：https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API

## 数据解析

### GeoJSON 格式处理

GDACS 接口返回的数据为 GeoJSON FeatureCollection 结构，核心数据结构定义如下：

```ts
export interface GdacsFeature {
  type: string
  properties: {
    eventid: string
    eventtype: string
    name: string
    title: string
    alertlevel: string
    severity: string
    fromdate: string
    todate: string
    country: string
    population: number
    url: string
    geometry: { type: string; coordinates: number[] }
  }
  geometry: { type: string; coordinates: number[] }
}

export interface GdacsApiResponse {
  type: string
  features: GdacsFeature[]
}
```

解析时将 FeatureCollection 中的每个 feature 映射为内部使用的 `GdacsEvent` 结构，同时兼容数组格式的直接响应：

```ts
if (jsonData.type === 'FeatureCollection' && jsonData.features) {
  events = jsonData.features.map((feature: any) => {
    const props = feature.properties || {}
    const coords = feature.geometry?.coordinates || []
    return {
      id: props.eventid || '',
      title: props.title || '',
      latitude: parseFloat(props.latitude) || parseFloat(coords[1]) || 0,
      longitude: parseFloat(props.longitude) || parseFloat(coords[0]) || 0,
      // ... 其他字段映射
    }
  })
}
```

- 参考：https://geojson.org/

### DOMParser XML 解析

对于 XML 格式的 RSS 订阅源数据，使用浏览器内置 `DOMParser` 解析，并通过命名空间提取自定义字段：

```ts
function parseGdacsXml(xmlText: string): GdacsEvent[] {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
  const items = xmlDoc.querySelectorAll('item')
  const gdacsNamespace = 'http://www.gdacs.org'

  items.forEach((item) => {
    const gdacsAlertLevel = getGdacsElementContent(item, gdacsNamespace, 'alertlevel')
    const gdacsLat = parseFloat(getGdacsElementContent(item, gdacsNamespace, 'lat') || '0')
    // ...
  })
}

function getGdacsElementContent(
  parent: Element, namespace: string, tagName: string
): string | null {
  const elements = parent.getElementsByTagNameNS(namespace, tagName)
  return elements.length > 0 ? elements[0]!.textContent : null
}
```

- 说明：DOMParser 是浏览器原生 API，用于将 XML 字符串解析为 DOM 树。
- 参考：https://developer.mozilla.org/en-US/docs/Web/API/DOMParser

## 数据可视化

### Apache ECharts (echarts)

用于绘制交互式图表，支持环形图、柱状图、散点图三种类型。

- 包名：`echarts`
- npm：https://www.npmjs.com/package/echarts
- 官网：https://echarts.apache.org/
- 在本项目中：生成事件类型分布（pie）、警报级别统计（bar）、时间分布（scatter）三张图表，每张图表支持动态主题色注入。

图表的 ECharts Option 通过工厂函数生成，以警报级别柱状图为例：

```ts
import * as echarts from 'echarts'

export function generateAlertLevelChart(
  data: GdacsEvent[], theme: ChartThemeColors
): EChartsOption {
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: Object.keys(levelCounts),
    },
    yAxis: { type: 'value', name: '数量' },
    series: [{
      type: 'bar',
      data: Object.entries(levelCounts).map(([level, count]) => ({
        value: count,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: getAlertLevelColor(level) },
            { offset: 1, color: getAlertLevelColor(level) + '80' },
          ]),
        },
      })),
    }],
  }
}
```

## 色彩空间转换算法

### OKLCH 到 sRGB 十六进制转换

本项目的核心算法之一：将 DaisyUI 主题使用的 OKLCH 色彩空间转换为 ECharts 渲染所需的 sRGB 十六进制颜色值。

- 算法来源：自实现，遵循 CSS Color Module Level 4 规范中的 OKLCH 到 sRGB 转换数学公式。

```ts
export function oklchToHex(color: string): string {
  const match = color.match(/oklch\(([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\)/)
  if (!match) return null
  let L = parseFloat(match[1]!)
  if (match[2] === '%' || L > 1) L = L / 100
  const { L, C, H } = parts

  // OKLCH → OKLab
  const hRad = (H * Math.PI) / 180
  const a = C * Math.cos(hRad)
  const b = C * Math.sin(hRad)

  // OKLab → Linear sRGB
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l3 = l_ * l_ * l_
  const m3 = m_ * m_ * m_
  const s3 = s_ * s_ * s_

  let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3

  // Gamma 校正 (sRGB transfer function)
  const gamma = (c: number) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055

  r = gamma(r); g = gamma(g); bl = gamma(bl)

  // 输出十六进制
  const hex = (c: number) => {
    const v = Math.round(Math.max(0, Math.min(1, c)) * 255)
    return v.toString(16).padStart(2, '0')
  }
  return `#${hex(r)}${hex(g)}${hex(bl)}`
}
```

转换路径：OKLCH → OKLab → Linear sRGB → Gamma校正 → sRGB HEX。

## 日期处理

### date-fns

- 包名：`date-fns`
- npm：https://www.npmjs.com/package/date-fns
- 在本项目中：提供中文日期本地化配置（`zhCN` locale），用于日期选择器的界面显示。

## 文件导出

### Blob + URL.createObjectURL

使用浏览器原生 API 实现客户端文件下载，无需服务端参与：

```ts
export function downloadJson(data: GdacsEvent[], filename: string = 'gdacs_events.json'): void {
  const jsonStr = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
```

- 参考：https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL

## 技术架构数据流

```
用户输入参数 → URLSearchParams 编码 → fetch() 请求 GDACS API
                                        ↓
                              GeoJSON / Array 响应
                                        ↓
                           数据标准化 (GdacsEvent[])
                                        ↓
                      ┌─────────────────┼─────────────────┐
                      ↓                 ↓                  ↓
                 环形图(Pie)       柱状图(Bar)      散点图(Scatter)
                事件类型分布      警报级别统计        时间分布
                      ↑                 ↑                  ↑
                      └─────────────────┼──────────────────┘
                                        ↓
                              ECharts Instance 渲染
                              (OKLCH→sRGB 主题色注入)
                                        ↓
                              JSON.stringify → Blob → 下载
```
