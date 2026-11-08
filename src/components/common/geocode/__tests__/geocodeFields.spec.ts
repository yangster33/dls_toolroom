import { describe, it, expect } from 'vitest'
import { findFieldLabel, getAddFieldValue, getLonLatFieldValue } from '../geocodeFields'
import type { QueryResult as AddQueryResult } from '@/tools/get_add/ApiService'
import type { QueryResult as LonLatQueryResult } from '@/tools/get_lonlat/ApiService'

const addResult: AddQueryResult = {
  name: 'A',
  longitude: 116.4,
  latitude: 39.9,
  address: '北京市海淀区',
  province: '北京市',
  city: '北京市',
  district: '海淀区',
  formattedAddress: '北京市海淀区某路',
  adcode: '110108',
  provider: 'gaode',
}

const lonlatResult: LonLatQueryResult = {
  province: '北京市',
  city: '北京市',
  district: '海淀区',
  township: '中关村街道',
  community: '某社区',
  address: '某路 1 号',
  longitude: 116.3,
  latitude: 39.98,
  formattedAddress: '北京市海淀区某路 1 号',
  adcode: '110108',
  provider: 'gaode',
  inBounds: true,
}

describe('findFieldLabel', () => {
  const fields = [
    { value: 'address', label: '地址' },
    { value: 'adcode', label: '行政区划代码' },
  ]

  it('命中时返回中文列名', () => {
    expect(findFieldLabel(fields, 'adcode')).toBe('行政区划代码')
  })

  it('未命中时回退原字段名', () => {
    expect(findFieldLabel(fields, 'unknown')).toBe('unknown')
  })
})

describe('getAddFieldValue', () => {
  it.each([
    ['address', '北京市海淀区'],
    ['province', '北京市'],
    ['city', '北京市'],
    ['district', '海淀区'],
    ['formattedAddress', '北京市海淀区某路'],
    ['adcode', '110108'],
    ['provider', '高德地图'],
    ['unknown', ''],
  ])('%s 取值正确', (field, expected) => {
    expect(getAddFieldValue(addResult, field)).toBe(expected)
  })
})

describe('getLonLatFieldValue', () => {
  it.each([
    ['formattedAddress', '北京市海淀区某路 1 号'],
    ['adcode', '110108'],
    ['inBounds', '是'],
    ['provider', '高德地图'],
    ['unknown', ''],
  ])('%s 取值正确', (field, expected) => {
    expect(getLonLatFieldValue(lonlatResult, field)).toBe(expected)
  })

  it('不在区域内时 inBounds 显示否', () => {
    expect(getLonLatFieldValue({ ...lonlatResult, inBounds: false }, 'inBounds')).toBe('否')
  })
})
