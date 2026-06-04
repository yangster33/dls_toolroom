import type { TileLayer } from 'leaflet'

/**
 * 底图瓦片提供商配置
 * 集中管理所有支持的国内主流地图底图 URL 模板
 */
export interface TileProvider {
  /** 显示名称 */
  name: string
  /** 瓦片 URL 模板 */
  url: string
  /** 子域名列表 */
  subdomains: string[]
  /** 属性标注 */
  attribution: string
  /** 最大缩放级别 */
  maxZoom: number
  /** 说明 */
  description: string
  /**
   * 是否翻转 Y 轴 — 腾讯地图瓦片 Y 轴原点在左下角（TMS 规则），
   * 与 Leaflet 默认的左上角原点（XYZ 规则）相反，需要翻转。
   */
  yFlip?: boolean
  /**
   * 是否需要 Key — 天地图等需要用户填入 tk 参数
   */
  needsKey?: boolean
}

export const tileProviders: TileProvider[] = [
  {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: [],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    description: '国际通用的开源地图，坐标系 WGS-84',
  },
  {
    name: '高德地图',
    url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    subdomains: ['1', '2', '3', '4'],
    attribution: '&copy; 高德地图',
    maxZoom: 18,
    description: '国内主流道路地图，坐标系 GCJ-02',
  },
  {
    name: '高德卫星图',
    url: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    subdomains: ['1', '2', '3', '4'],
    attribution: '&copy; 高德地图',
    maxZoom: 18,
    description: '高德卫星影像，坐标系 GCJ-02',
  },
  {
    name: 'Google 地图',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    attribution: '&copy; Google',
    maxZoom: 20,
    description: 'Google 道路地图',
  },
  {
    name: 'Google 卫星图',
    url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    attribution: '&copy; Google',
    maxZoom: 20,
    description: 'Google 卫星影像',
  },
  {
    name: '腾讯地图',
    url: 'https://rt{s}.map.gtimg.com/tile?z={z}&x={x}&y={y}&type=vector&styleid=1&version=376',
    subdomains: ['0', '1', '2', '3'],
    attribution: '&copy; 腾讯地图',
    maxZoom: 18,
    description: '腾讯道路地图，坐标系 GCJ-02',
    yFlip: true,
  },
  {
    name: '天地图矢量',
    url: 'https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk={key}',
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
    attribution: '&copy; 天地图',
    maxZoom: 18,
    description: '天地图矢量底图（需填入 Key）',
    needsKey: true,
  },
  {
    name: '天地图影像',
    url: 'https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk={key}',
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
    attribution: '&copy; 天地图',
    maxZoom: 18,
    description: '天地图卫星影像（需填入 Key）',
    needsKey: true,
  },
]

/**
 * 根据索引获取瓦片提供商配置
 */
export function getTileProvider(index: number): TileProvider {
  return tileProviders[index]! || tileProviders[0]!
}
