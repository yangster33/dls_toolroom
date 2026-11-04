/**
 * 工具分类元数据：专业轴 + 动作轴 + 交付物。
 *
 * 专业轴来自通信工程设计的常规分工（电源 / 设备 / 无线 / 传输 / 管道 / 其他），
 * 其中电源、管道目前没有工具，作为后续规划占位。
 * 动作轴回答"我要做什么"，比学科分类更接近用户的实际检索方式。
 *
 * 这份表是人工判断的结果，改一个工具的归属只需要改这里。
 */

export type ProfessionKey =
  | 'power'
  | 'equipment'
  | 'wireless'
  | 'transmission'
  | 'pipeline'
  | 'other'

export type ActionKey = 'convert' | 'generate' | 'query' | 'export' | 'project'

export interface Profession {
  key: ProfessionKey
  /** 侧栏与筛选用的全称 */
  label: string
  /** 窄栏用的单字标记 */
  short: string
  /** 空分类时显示的专业定位 */
  description: string
  /** 规划中的工具，用于空状态 */
  planned: string[]
}

export interface Action {
  key: ActionKey
  label: string
}

export interface ToolMeta {
  profession: ProfessionKey
  action: ActionKey
  /** 交付物：Excel / Word / KML / 图片 / 文本 / 图表 … */
  output: string
}

export const professions: Profession[] = [
  {
    key: 'power',
    label: '电源',
    short: '电',
    description: '通信电源、负荷与接地计算',
    planned: ['负荷计算', '蓄电池容量校核', '接地电阻估算'],
  },
  {
    key: 'equipment',
    label: '设备',
    short: '设',
    description: '机房设备、机架与标签',
    planned: ['机架 U 位排布', '端口与配线表', '设备标签批量生成'],
  },
  {
    key: 'wireless',
    label: '无线',
    short: '无',
    description: '站址勘察、覆盖与站间距测算',
    planned: ['链路预算', '天线方位角计算', '覆盖半径估算'],
  },
  {
    key: 'transmission',
    label: '传输',
    short: '传',
    description: '光缆线路、坐标与图层数据',
    planned: ['光缆段长统计', '纤芯占用表', '接头盒位置表'],
  },
  {
    key: 'pipeline',
    label: '管道',
    short: '管',
    description: '通信管道、人井与管孔资源',
    planned: ['管孔占用统计', '人井编号整理', '埋深校核'],
  },
  {
    key: 'other',
    label: '其他',
    short: '其',
    description: '通用数据处理、模板导出与项目管理',
    planned: [],
  },
]

export const actions: Action[] = [
  { key: 'convert', label: '转换' },
  { key: 'generate', label: '生成' },
  { key: 'query', label: '查询' },
  { key: 'export', label: '导出' },
  { key: 'project', label: '项目管理' },
]

export const toolMeta: Record<string, ToolMeta> = {
  coord_convert: { profession: 'transmission', action: 'convert', output: '文本' },
  coords_convert: { profession: 'transmission', action: 'convert', output: 'Excel' },
  distance_sensor: { profession: 'wireless', action: 'query', output: '计算书' },
  get_add: { profession: 'wireless', action: 'query', output: '表格' },
  get_lonlat: { profession: 'wireless', action: 'query', output: '表格' },
  table2kml_point: { profession: 'wireless', action: 'generate', output: 'KML' },
  table2kml_basestation: { profession: 'wireless', action: 'generate', output: 'KML' },
  geo_data: { profession: 'other', action: 'convert', output: 'GeoJSON' },
  gis2excel: { profession: 'other', action: 'convert', output: 'Excel' },
  shp2excel: { profession: 'other', action: 'convert', output: 'Excel / CSV' },
  docx_template_export: { profession: 'other', action: 'export', output: 'Word' },
  kml_viewer: { profession: 'transmission', action: 'query', output: '地图' },
  shp2kml: { profession: 'transmission', action: 'convert', output: 'KML' },
  gantt_chart: { profession: 'other', action: 'project', output: 'PNG / SVG' },
  xlsx_template_export: { profession: 'other', action: 'export', output: 'Excel' },
  elevation_query: { profession: 'wireless', action: 'query', output: '文本' },
  elevations_convert: { profession: 'wireless', action: 'query', output: 'Excel' },
  elevations_batch: { profession: 'wireless', action: 'query', output: 'Excel' },
  weather_history: { profession: 'wireless', action: 'query', output: '图表 / Excel' },
  earthquake_query: { profession: 'wireless', action: 'query', output: '图表 / CSV' },
  gdacs: { profession: 'wireless', action: 'query', output: '图表 / CSV' },
  qrcode: { profession: 'equipment', action: 'generate', output: '图片' },
}

export function getProfession(key: ProfessionKey): Profession {
  return professions.find((item) => item.key === key) ?? professions[professions.length - 1]!
}

export function getAction(key: ActionKey): Action {
  return actions.find((item) => item.key === key) ?? actions[0]!
}

export function getToolMeta(toolId: string): ToolMeta {
  return toolMeta[toolId] ?? { profession: 'other', action: 'convert', output: '—' }
}
