# 术

本项目在数据处理和可视化环节使用了三个构建工具提供的软件包。

## echarts

- **用途**：数据可视化图表渲染。将时间序列气象数据绘制为折线图、柱状图等形式，支持交互式缩放、悬停提示、动态主题切换。
- **官网**：[https://echarts.apache.org/](https://echarts.apache.org/)
- **npm**：[https://www.npmjs.com/package/echarts](https://www.npmjs.com/package/echarts)

图表实例的初始化与生命周期管理通过封装后的组合函数实现，核心逻辑如下：

```ts
// 初始化图表实例（来自 useECharts.ts）
chartInstance = echarts.init(chartContainer.value)

// 设置图表配置
chartInstance.setOption(option, true)

// 窗口大小变化时自适应
chartInstance.resize()

// 销毁实例释放资源
chartInstance.dispose()
```

图表配置采用工厂函数模式，每种图表类型对应一个生成函数，根据传入的天气数据和主题色彩动态生成配置对象。以气温趋势图为例：

```ts
// 气温折线图配置生成（来自 weatherHistoryChart.ts）
export function generateTemperatureChart(
  data: WeatherApiResponse,
  theme: ChartThemeColors
): EChartsOption {
  const hourly = data.hourly
  if (!hourly?.time || !hourly.temperature_2m) {
    return {}
  }
  return {
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: hourly.time.map((t) => t.substring(0, 16).replace('T', ' ')),
    },
    yAxis: { type: 'value', name: '温度 (°C)' },
    series: [{
      name: '气温',
      type: 'line',
      data: hourly.temperature_2m,
      smooth: true,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: oklchToHex(theme.primary) + '40' },
          { offset: 1, color: oklchToHex(theme.primary) + '05' },
        ]),
      },
    }],
  }
}
```

设计中采用了渐变色域填充（areaStyle + LinearGradient），使折线下方呈现由浓到淡的颜色过渡，增强视觉层次感。主题色彩通过 oklch 色彩空间传入后转换为十六进制格式，确保图表配色与界面主题协调一致。

## @vuepic/vue-datepicker

- **用途**：日期选择交互组件。提供日历面板供用户直观选择起止日期，支持日期范围约束、国际化本地化显示。
- **npm**：[https://www.npmjs.com/package/@vuepic/vue-datepicker](https://www.npmjs.com/package/@vuepic/vue-datepicker)

核心配置：

```ts
// 日期选择器配置（来自 WeatherHistoryPage.vue script 部分）
:time-config="{ enableTimePicker: false }"
:min-date="minDate"
:max-date="endDateModel || today"
model-type="yyyy-MM-dd"
:formats="{ input: 'yyyy-MM-dd', preview: 'yyyy/MM/dd' }"
:year-first="true"
:clearable="false"
:locale="zhCN"
placeholder="选择开始日期"
```

关键设计要点：
- 仅启用日期选择（`enableTimePicker: false`），不涉及时分秒，符合历史天气按天查询的场景。
- 起始日期和结束日期相互联动约束：开始日期不超过结束日期，结束日期不早于开始日期，且均不超过当天。
- 使用 `yyyy-MM-dd` 格式输出日期字符串，与 API 的日期参数格式保持一致。
- 通过 `zhCN` 本地化对象实现中文界面，该对象由 date-fns 提供。

## date-fns

- **用途**：日期处理工具库，提供本地化语言包。用于将日期选择器的界面文本（月份、星期、按钮标签等）转换为中文显示。
- **npm**：[https://www.npmjs.com/package/date-fns](https://www.npmjs.com/package/date-fns)
- **官网**：[https://date-fns.org/](https://date-fns.org/)

```ts
// 导入中文本地化对象（来自 WeatherHistoryPage.vue）
import { zhCN } from 'date-fns/locale'
```

## 技术架构与数据流

数据在系统中的流转路径如下：

1. 用户通过日期选择器组件选定起止日期，输入经纬度坐标。
2. 日期字符串经由内联函数 `toDateString` 格式化，确保输出格式与 API 要求一致（`yyyy-MM-dd`）。
3. 表单验证层检查坐标范围（-180 到 180、-90 到 90）、日期逻辑（起始 <= 结束）、日期跨度（1 到 365 天）、变量非空。
4. 验证通过后，构建 URLSearchParams 对象，将经纬度、起止日期、选中的变量列表（逗号拼接）、固定每日变量、时区信息组装为查询字符串。
5. 通过浏览器原生网络请求接口将参数发送至历史天气数据 API 端点。
6. 响应数据经类型校验后传入图表工厂，根据用户选择的图表类型调用对应的配置生成函数。
7. echarts 实例接收配置对象，渲染图表到页面容器。
8. 响应数据同时支持导出为 JSON 文件，通过 Blob 和 Object URL 实现浏览器端文件下载。
