import type { Component } from 'vue'
import {
  PhMapPin,
  PhArrowsOutCardinal,
  PhRuler,
  PhMapTrifold,
  PhCrosshair,
  PhFileCode,
  PhCellSignalFull,
  PhGlobe,
  PhTable,
  PhFileDoc,
  PhFileXls,
  PhEye,
  PhChartBar,
  PhMountains,
  PhCloud,
  PhWarning,
  PhWaveform,
  PhQrCode,
} from '@phosphor-icons/vue'

export interface DocType {
  key: string
  label: string
  fileName: string
}

export const docTypes: DocType[] = [
  { key: 'tao', label: '道', fileName: 'tao.md' },
  { key: 'method', label: '法', fileName: 'method.md' },
  { key: 'tech', label: '术', fileName: 'tech.md' },
  { key: 'tool', label: '器', fileName: 'tool.md' },
]

export interface ToolConfig {
  id: string
  name: string
  description: string
  icon: Component
  tags: string[]
  docTypes?: string[]
}

export const toolConfigs: ToolConfig[] = [
  {
    id: 'coord_convert',
    name: '坐标转换',
    description: '单点坐标转换工具，支持多种坐标系互转',
    icon: PhMapPin,
    tags: ['坐标', '转换', '单点'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'coords_convert',
    name: '批量转换',
    description: '批量坐标转换工具，支持Excel导入导出',
    icon: PhArrowsOutCardinal,
    tags: ['坐标', '转换', '批量', '模板'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'distance_sensor',
    name: '距离测算',
    description: '两点间距离计算工具，支持多种距离类型',
    icon: PhRuler,
    tags: ['距离', '测算', 'GPS', '基站'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'get_add',
    name: '地址解析',
    description: '经纬度转地址工具，支持多种地图服务',
    icon: PhMapTrifold,
    tags: ['地址', '解析', '逆地理'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'get_lonlat',
    name: '经纬度查询',
    description: '地址转经纬度工具，支持多种地图服务',
    icon: PhCrosshair,
    tags: ['经纬度', '查询', '地理编码'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'table2kml_point',
    name: '点位KML生成',
    description: '表格数据转KML点文件，支持批量导入',
    icon: PhFileCode,
    tags: ['KML', '转换', '点'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'table2kml_basestation',
    name: '基站KML生成',
    description: '基站数据转KML文件，支持多种格式',
    icon: PhCellSignalFull,
    tags: ['KML', '基站', '转换'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'geo_data',
    name: '空间分析',
    description: '基于Turf.js的地理空间分析工具，支持点线面要素测量和空间关系判断',
    icon: PhGlobe,
    tags: ['空间分析', 'Turf.js', 'GeoJSON'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'gis2excel',
    name: 'GIS文件转表格',
    description: '将SHP、KML、KMZ文件转换为Excel表格，支持点线面要素提取',
    icon: PhTable,
    tags: ['GIS', '转换', 'Excel', 'SHP', 'KML'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'shp2excel',
    name: 'SHP转表格',
    description: '将不同类型的SHP文件批量转换为Excel/CSV表格，支持点线面要素提取',
    icon: PhFileXls,
    tags: ['SHP', '转换', 'Excel', 'Shapefile', '批量'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'docx_template_export',
    name: 'DOCX模板批量生成',
    description: '使用docxtemplater将CSV/Excel数据填充到Word模板，生成个性化文档',
    icon: PhFileDoc,
    tags: ['Word', '模板', '导出', '批量', 'docxtemplater'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'kml_viewer',
    name: '简易KML查看器',
    description: '拖拽KML文件即可在地图上自由查看，支持多种国内主流地图底图切换和图层管理',
    icon: PhEye,
    tags: ['KML', '地图', '查看', 'Leaflet'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'shp2kml',
    name: 'SHP转KML',
    description: '将SHP文件转换为KML格式，自动检测点/线/面类型，支持自定义样式和文件夹管理',
    icon: PhFileCode,
    tags: ['SHP', 'KML', '转换', 'GIS'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'gantt_chart',
    name: '甘特图/工期倒排',
    description:
      '基于 Frappe Gantt 的交互式甘特图工具，支持任务管理、依赖关系、进度追踪与多视图切换',
    icon: PhChartBar,
    tags: ['甘特图', '项目管理', '进度', '时间线', 'Gantt', '工期倒排'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'xlsx_template_export',
    name: 'XLSX模板批量导出',
    description: '使用xlsx-template将CSV/Excel数据填充到Excel模板，批量生成个性化文档',
    icon: PhFileXls,
    tags: ['Excel', '模板', '导出', '批量', 'xlsx-template'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'elevation_query',
    name: '高程查询',
    description: '输入经纬度查询海拔高度，数据来源于 Open-Meteo Elevation API',
    icon: PhMountains,
    tags: ['高程', '海拔', '经纬度', 'Open-Meteo'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'elevations_convert',
    name: '批量高程查询',
    description: '批量输入经纬度查询海拔高度，支持 Excel 导入导出',
    icon: PhMountains,
    tags: ['高程', '海拔', '批量', 'Excel', 'Open-Meteo'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'elevations_batch',
    name: '批量高程查询(模板)',
    description: '通过上传模板文件批量查询高程数据，支持自定义延迟设置',
    icon: PhMountains,
    tags: ['高程', '海拔', '批量', '模板', 'Excel', 'Open-Meteo'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'weather_history',
    name: '历史天气查询',
    description: '输入经纬度查询历史天气数据，支持多种气象变量选择',
    icon: PhCloud,
    tags: ['天气', '历史', '气象', 'Open-Meteo', '经纬度'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'earthquake_query',
    name: '地震查询',
    description: '查询全球历史地震数据，支持按时间范围、震级范围和地理位置筛选',
    icon: PhWaveform,
    tags: ['地震', 'USGS', '地质', '震级', '经纬度'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
  {
    id: 'gdacs',
    name: 'GDACS 灾害数据',
    description: '从 GDACS 获取全球灾害事件数据',
    icon: PhWarning,
    tags: ['灾害', 'GDACS', '地震', '洪水', '台风', '火山'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },

  {
    id: 'qrcode',
    name: '二维码工具',
    description: '生成和识别二维码的工具，支持自定义大小和纠错级别',
    icon: PhQrCode,
    tags: ['二维码', '生成', '识别', 'QR Code'],
    docTypes: ['tao', 'method', 'tech', 'tool'],
  },
]

export function getToolById(id: string): ToolConfig | undefined {
  return toolConfigs.find((tool) => tool.id === id)
}

export function getToolName(id: string, fallback?: string): string {
  const tool = getToolById(id)
  return tool?.name || fallback || id
}

export function getDocType(key: string): DocType | undefined {
  return docTypes.find((d) => d.key === key)
}

export function getToolDocTypes(toolId: string): DocType[] {
  const tool = getToolById(toolId)
  if (!tool?.docTypes) return []
  return tool.docTypes.map((key) => getDocType(key)).filter((d): d is DocType => d !== undefined)
}

export function getToolDocPath(toolId: string, docKey: string): string {
  return `/docs/${toolId}/${docKey}.md`
}
