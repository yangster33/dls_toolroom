import type { TemplateValidationResult } from '@/utils/templateHandler'

// 定义地址数据类型 - 去掉名称
export interface FullAddress {
  province: string
  city: string
  district: string
  township: string
  community: string
  address: string
}

export type { TemplateValidationResult }

// 验证单个数据行
function validateRow(
  row: Record<string, string | number>,
  rowIndex: number
): { valid: boolean; data?: FullAddress; error?: string } {
  // 尝试获取地址字段
  const getField = (aliases: string[]): string => {
    for (const alias of aliases) {
      if (row[alias] !== undefined && row[alias] !== null) {
        return String(row[alias] || '').trim()
      }
    }
    return ''
  }

  const province = getField(['省', 'province', 'Province'])
  const city = getField(['市', 'city', 'City'])
  const district = getField(['区/县', '区县', 'district', 'District'])
  const township = getField(['乡/镇', '乡镇', 'township', 'Township'])
  const community = getField(['社区/村', '社区村', 'community', 'Community'])
  const address = getField(['地址', 'address', 'Address'])

  // 只强制校验地址字段
  if (!address.trim()) {
    return { valid: false, error: `第 ${rowIndex + 1} 行：地址不能为空` }
  }

  return {
    valid: true,
    data: {
      province,
      city,
      district,
      township,
      community,
      address,
    },
  }
}

// 读取并验证模板数据
export function readAndValidateTemplate(
  rows: Record<string, string | number>[]
): TemplateValidationResult<FullAddress> {
  const data: FullAddress[] = []
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const validation = validateRow(row, i)

    if (validation.valid && validation.data) {
      data.push(validation.data)
    } else if (validation.error) {
      errors.push(validation.error)
    }
  }

  return {
    isValid: errors.length === 0 && data.length > 0,
    data,
    errors,
  }
}
