import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import UnitField from '../UnitField.vue'

/**
 * UnitField 的挂载级测试。
 *
 * 重点回归：输入框被清空时不能把空字符串写进模型。
 * 计算层用 `Number(input)` 取值，`Number('') === 0`，
 * 若把 '' 传下去，短路电流会被当成 0 kA、热稳定直接判“通过”。
 */
const mountField = (modelValue: number) => {
  const updates: number[] = []
  const wrapper = mount(UnitField, {
    props: {
      label: '测试项',
      modelValue,
      'onUpdate:modelValue': (value: number) => updates.push(value),
    },
  })
  return { wrapper, updates }
}

describe('UnitField', () => {
  it('输入有效数字时更新模型', async () => {
    const { wrapper, updates } = mountField(30)
    const input = wrapper.find('input')

    await input.setValue('45')

    expect(updates).toEqual([45])
    expect((input.element as HTMLInputElement).value).toBe('45')
  })

  it('清空输入框时不把空字符串写进模型', async () => {
    const { wrapper, updates } = mountField(30)
    const input = wrapper.find('input')

    await input.setValue('')

    expect(updates).toEqual([])
  })

  it('清空后失焦，回填模型里的上一次有效值', async () => {
    const { wrapper } = mountField(30)
    const input = wrapper.find('input')

    await input.setValue('')
    await input.trigger('blur')

    expect((input.element as HTMLInputElement).value).toBe('30')
  })

  it('清空后失焦，回填的是用户最后输入的有效值', async () => {
    const { wrapper, updates } = mountField(30)
    const input = wrapper.find('input')

    await input.setValue('45')
    // 模拟父组件用 v-model 回写：真实页面里 form 会跟着更新
    await wrapper.setProps({ modelValue: 45 })
    await input.setValue('')
    await input.trigger('blur')

    expect(updates).toEqual([45])
    expect((input.element as HTMLInputElement).value).toBe('45')
  })

  it('外部改模型时同步显示值', async () => {
    const { wrapper } = mountField(30)
    const input = wrapper.find('input')

    await wrapper.setProps({ modelValue: 20 })
    await nextTick()

    expect((input.element as HTMLInputElement).value).toBe('20')
  })
})
