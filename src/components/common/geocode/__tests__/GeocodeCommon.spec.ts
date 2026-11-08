import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import GeocodeCommon from '../../GeocodeCommon.vue'

describe('GeocodeCommon 组件拆分后的集成冒烟', () => {
  it('add 模式渲染五个步骤的标题', () => {
    const wrapper = mount(GeocodeCommon, {
      props: { mode: 'add' },
      global: { plugins: [createPinia()] },
    })
    const text = wrapper.text()
    expect(text).toContain('下载模板')
    expect(text).toContain('API Key 配置')
    expect(text).toContain('查询参数设置')
    expect(text).toContain('输出字段选择')
    expect(text).toContain('上传文件并查询')
  })

  it('lonlat 模式显示区域约束入口，add 模式不显示', () => {
    const add = mount(GeocodeCommon, {
      props: { mode: 'add' },
      global: { plugins: [createPinia()] },
    })
    expect(add.text()).not.toContain('启用区域约束')

    const lonlat = mount(GeocodeCommon, {
      props: { mode: 'lonlat' },
      global: { plugins: [createPinia()] },
    })
    expect(lonlat.text()).toContain('启用区域约束')
  })
})
