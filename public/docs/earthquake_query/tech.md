# 术

本工具涉及三个核心 npm 技术包，均在实际 TypeScript 文件中直接使用。

---

## 1. echarts

- **用途**：数据可视化图表库，用于生成散点图、柱状图等统计图表。
- **官网**：https://echarts.apache.org/
- **npm**：https://www.npmjs.com/package/echarts
- **版本**：^6.0.0

在本项目中，echarts 负责三类图表的渲染：震级-时间散点图、震级分布柱状图、震源深度散点图。以下是图表生成的核心类型定义与实际代码片段：

```typescript
import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts'

export type ChartType = 'magnitudeTime' | 'magnitudeDist' | 'depth'

export const chartConfigs: Record<
  ChartType,
  { title: string; generator: typeof generateMagnitudeTimeChart }
> = {
  magnitudeTime: { title: '震级时间分布', generator: generateMagnitudeTimeChart },
  magnitudeDist: { title: '震级分布统计', generator: generateMagnitudeDistributionChart },
  depth: { title: '震源深度分布', generator: generateDepthChart },
}
```

震级-时间分布图使用散点序列（`type: 'scatter'`），气泡大小与震级正相关（`symbolSize: (data) => Math.max(10, data.mag * 5)`），纵轴范围固定为 0 到 10 级。震级分布统计图使用柱状序列（`type: 'bar'`），以 8 个震级区间（0-2、2-3、3-4、4-5、5-6、6-7、7-8、8+）对数据进行分箱计数，每根柱子使用渐变色填充：

```typescript
itemStyle: {
  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: colors[index!]! },
    { offset: 1, color: colors[index!]! + '80' },
  ]),
}
```

震源深度图使用散点序列并将纵轴反转（`inverse: true`），以符合"深度向下增大"的直觉。所有图表均通过解析图表主题色彩变量实现明暗主题的自适应——将 CSS 变量中的 OKLCH 颜色值转换为十六进制色码后注入图表配置：

```typescript
export function oklchToHex(color: string): string {
  const parts = parseOklch(color)
  if (!parts) return color
  const { L, C, H } = parts
  const hRad = (H * Math.PI) / 180
  const a = C * Math.cos(hRad)
  const b = C * Math.sin(hRad)
  // ... OKLab 到线性 sRGB 再到 gamma 校正 sRGB 的完整转换
}
```

---

## 2. @vuepic/vue-datepicker

- **用途**：日期选择器组件，提供日历式日期范围选择交互。
- **GitHub**：https://github.com/Vuepic/vue-datepicker
- **npm**：https://www.npmjs.com/package/@vuepic/vue-datepicker
- **版本**：^13.0.0

在本项目中用于起始日期和结束日期的选择，配置了中文界面（通过 `date-fns` 的 `zhCN` locale）、年份优先选择模式、以及起始/结束日期之间的联动校验（起始日期不可晚于结束日期，结束日期不可早于起始日期）。核心调用方式：

```typescript
import { VueDatePicker } from '@vuepic/vue-datepicker'
import { zhCN } from 'date-fns/locale'

// 组件中使用的关键配置：
// model-type="yyyy-MM-dd"
// :locale="zhCN"
// :min-date="minDate"       // 最早可追溯到 1900-01-01
// :max-date="today"          // 最晚为当天
// :year-first="true"
// :clearable="false"
```

---

## 3. date-fns

- **用途**：现代 JavaScript 日期工具库，本项目中仅使用了其国际化（locale）模块来提供中文日期界面。
- **官网**：https://date-fns.org/
- **npm**：https://www.npmjs.com/package/date-fns

仅使用了一行导入，为日期选择器提供中文本地化支持：

```typescript
import { zhCN } from 'date-fns/locale'
```

---

## 技术架构概览（数据流）

```
用户设定参数（时间/震级/坐标/半径）
  → 构建 URLSearchParams 查询字符串
    → fetch() 请求 USGS FDSN Event API（GeoJSON 格式）
      → 返回 EarthquakeApiResponse（含 features 数组）
        → 统计计算（总数、最大震级、平均震级、最深深度）
        → echarts 图表渲染（散点图 / 柱状图）
        → JSON 数据导出（Blob + URL.createObjectURL 下载）
```
