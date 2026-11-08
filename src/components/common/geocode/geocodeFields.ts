/**
 * 地址查询 / 经纬度查询的字段展示与取值。
 *
 * 原来的两个 switch 从 GeocodeCommon.vue 抽出，便于单测与结果表组件复用。
 */
import type { QueryResult as AddQueryResult } from '@/tools/get_add/ApiService'
import type { QueryResult as LonLatQueryResult } from '@/tools/get_lonlat/ApiService'

export interface FieldOption {
  value: string
  label: string
}

/** 字段值 → 中文列名；找不到时回退原值 */
export function findFieldLabel(fields: FieldOption[], field: string): string {
  return fields.find((f) => f.value === field)?.label || field
}

/** 地址查询结果的字段取值 */
export function getAddFieldValue(result: AddQueryResult, field: string): string {
  switch (field) {
    case 'address':
      return result.address
    case 'province':
      return result.province
    case 'city':
      return result.city
    case 'district':
      return result.district
    case 'formattedAddress':
      return result.formattedAddress
    case 'adcode':
      return result.adcode
    case 'provider':
      return '高德地图'
    default:
      return ''
  }
}

/** 经纬度查询结果的字段取值 */
export function getLonLatFieldValue(result: LonLatQueryResult, field: string): string {
  switch (field) {
    case 'formattedAddress':
      return result.formattedAddress
    case 'adcode':
      return result.adcode
    case 'inBounds':
      return result.inBounds ? '是' : '否'
    case 'provider':
      return '高德地图'
    default:
      return ''
  }
}
