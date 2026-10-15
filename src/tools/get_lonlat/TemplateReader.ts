/**
 * 模板读取 - 经纬度查询（地址 → 坐标）专用验证器
 *
 * D1 重构：取值/校验/循环已收敛到 `@/utils/templateRowReader`。
 * 本文件只保留**本工具特有的地址语义**（6 个地址字段、只强制校验「地址」）。
 */
import { resolveAlias, readRows, toValidationResult, type RawRow } from '@/utils/templateRowReader'
import type { TemplateValidationResult } from '@/utils/templateHandler'
import type { ProgressCallback } from '@/utils/progress'

/** 经纬度查询的地址行：不含「名称」列（查询的是地址，不是站点名） */
export interface FullAddress {
  province: string
  city: string
  district: string
  township: string
  community: string
  address: string
}

export type { TemplateValidationResult }

/** 地址字段的中英文列名别名 */
const PROVINCE_ALIASES = ['省', 'province', 'Province']
const CITY_ALIASES = ['市', 'city', 'City']
const DISTRICT_ALIASES = ['区/县', '区县', 'district', 'District']
const TOWNSHIP_ALIASES = ['乡/镇', '乡镇', 'township', 'Township']
const COMMUNITY_ALIASES = ['社区/村', '社区村', 'community', 'Community']
const ADDRESS_ALIASES = ['地址', 'address', 'Address']

/**
 * 读取并验证地址模板
 *
 * @param onProgress 进度回调（C4 阶段 2，可选）
 * @param signal 取消信号（C4 收尾，可选）：已取消时以 AbortError 拒绝，不写入 errors
 */
export async function readAndValidateTemplate(
  rows: readonly Record<string, string | number>[],
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<TemplateValidationResult<FullAddress>> {
  const result = await readRows<FullAddress>(
    rows,
    (row: RawRow, rowNumber) => {
      const address = resolveAlias(row, ADDRESS_ALIASES)

      // 只强制校验「地址」：其余字段留空时高德/MQ 自己解析
      if (!address) {
        return { errors: [`第 ${rowNumber} 行：地址不能为空`] }
      }

      return {
        records: [
          {
            province: resolveAlias(row, PROVINCE_ALIASES),
            city: resolveAlias(row, CITY_ALIASES),
            district: resolveAlias(row, DISTRICT_ALIASES),
            township: resolveAlias(row, TOWNSHIP_ALIASES),
            community: resolveAlias(row, COMMUNITY_ALIASES),
            address,
          },
        ],
      }
    },
    { onProgress, signal },
  )

  return toValidationResult(result)
}
