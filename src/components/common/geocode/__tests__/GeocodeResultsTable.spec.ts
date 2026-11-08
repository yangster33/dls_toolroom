import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GeocodeResultsTable from '../GeocodeResultsTable.vue'
import type { QueryResult as AddQueryResult } from '@/tools/get_add/ApiService'

function makeAddResult(index: number): AddQueryResult {
  return {
    name: `站点 ${index}`,
    longitude: 116 + index / 1000,
    latitude: 39 + index / 1000,
    address: '地址',
    province: '省',
    city: '市',
    district: '区',
    formattedAddress: '格式化地址',
    adcode: '100000',
    provider: 'gaode',
  }
}

describe('GeocodeResultsTable', () => {
  it('校验通过时显示数据条数', () => {
    const wrapper = mount(GeocodeResultsTable, {
      props: {
        mode: 'add',
        validationResult: { isValid: true, data: [makeAddResult(0)], errors: [] },
        addResults: [],
        lonlatResults: [],
        selectedFields: [],
        enableBounds: false,
      },
    })
    expect(wrapper.text()).toContain('验证通过，共 1 条数据')
  })

  it('最多渲染 20 行并提示剩余数量', () => {
    const results = Array.from({ length: 25 }, (_, i) => makeAddResult(i))
    const wrapper = mount(GeocodeResultsTable, {
      props: {
        mode: 'add',
        validationResult: null,
        addResults: results,
        lonlatResults: [],
        selectedFields: ['adcode'],
        enableBounds: false,
      },
    })
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(20)
    expect(wrapper.text()).toContain('还有 5 行未显示')
    expect(wrapper.text()).toContain('行政区划代码')
  })

  it('经纬度模式按 inBounds + 区域约束标红坐标', () => {
    const wrapper = mount(GeocodeResultsTable, {
      props: {
        mode: 'lonlat',
        validationResult: null,
        addResults: [],
        lonlatResults: [
          {
            province: '省',
            city: '市',
            district: '区',
            township: '乡',
            community: '村',
            address: '地址',
            longitude: 116.3,
            latitude: 39.9,
            formattedAddress: '格式化地址',
            adcode: '100000',
            provider: 'gaode',
            inBounds: false,
          },
        ],
        selectedFields: ['inBounds'],
        enableBounds: true,
      },
    })
    const cells = wrapper.findAll('tbody td')
    expect(cells[7]?.classes()).toContain('text-error')
    expect(cells[8]?.classes()).toContain('text-error')
    expect(wrapper.text()).toContain('否')
  })
})
