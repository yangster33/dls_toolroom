import { describe, it, expect, beforeAll } from 'vitest'
import { mount, type DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import TaskEditModal from '../TaskEditModal.vue'

/**
 * TaskEditModal 的挂载级测试（D4 抽出时新增）。
 *
 * 仓库此前没有页面/组件挂载测试（交互靠 e2e 覆盖），这里是**第一个** .vue 组件
 * 单测。只断言组件对外契约，不断言样式：
 *   1. 添加/编辑两种模式的标题与按钮文案；
 *   2. openForCreate / openForEdit 填充表单（用属性选择器定位，不靠下标）；
 *   3. 提交时把表单值通过 @save 交给页面。
 *
 * jsdom 不实现 `<dialog>` 的 showModal/close，测试里补桩（仅本文件生效）。
 */
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {}
  HTMLDialogElement.prototype.close = function close() {}
})

const byPlaceholder = (
  wrapper: ReturnType<typeof mount>,
  text: string,
): DOMWrapper<HTMLInputElement> =>
  wrapper
    .findAll('input')
    .find((i) =>
      (i.element as HTMLInputElement).placeholder.includes(text),
    ) as unknown as DOMWrapper<HTMLInputElement>

describe('TaskEditModal', () => {
  it('默认是「添加任务」模式', () => {
    const wrapper = mount(TaskEditModal)
    expect(wrapper.find('h3').text()).toBe('添加任务')
    expect(wrapper.find('button[type="submit"]').text()).toBe('添加')
  })

  it('传入 editingTaskId 时切换为「编辑任务」', () => {
    const wrapper = mount(TaskEditModal, { props: { editingTaskId: '3' } })
    expect(wrapper.find('h3').text()).toBe('编辑任务')
    expect(wrapper.find('button[type="submit"]').text()).toBe('保存修改')
  })

  it('openForCreate 用「今天起一周」填充表单，默认色来自 prop', async () => {
    const wrapper = mount(TaskEditModal, { props: { defaultColor: '#10b981' } })
    const vm = wrapper.vm as unknown as { openForCreate: () => void }

    vm.openForCreate()
    await nextTick()

    expect(byPlaceholder(wrapper, '输入任务名称').element.value).toBe('')
    const dates = wrapper.findAll('input[type="date"]')
    const start = (dates[0]!.element as HTMLInputElement).value
    const end = (dates[1]!.element as HTMLInputElement).value
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(new Date(end).getTime()).toBeGreaterThan(new Date(start).getTime())
    expect((wrapper.find('input[type="color"]').element as HTMLInputElement).value).toBe('#10b981')
  })

  it('openForEdit 用既有任务填充表单（dependencies 数组转逗号串）', async () => {
    const wrapper = mount(TaskEditModal)
    const vm = wrapper.vm as unknown as {
      openForEdit: (task: Record<string, unknown>) => void
    }

    vm.openForEdit({
      id: '7',
      name: '站点勘查',
      start: '2026-10-01',
      end: '2026-10-10',
      progress: 40,
      dependencies: ['1', '2'],
      color: '#ef4444',
      custom_class: 'milestone',
    })
    await nextTick()

    expect(byPlaceholder(wrapper, '输入任务名称').element.value).toBe('站点勘查')
    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe('40')
    expect(byPlaceholder(wrapper, '逗号').element.value).toBe('1,2')
    expect(byPlaceholder(wrapper, '可选').element.value).toBe('milestone')
  })

  it('提交时发出 save，载荷就是表单值', async () => {
    const wrapper = mount(TaskEditModal)
    const vm = wrapper.vm as unknown as { openForCreate: () => void }

    vm.openForCreate()
    await byPlaceholder(wrapper, '输入任务名称').setValue('新任务')
    await byPlaceholder(wrapper, '逗号').setValue('1, 2')
    await wrapper.find('form').trigger('submit.prevent')

    const saveEvents = wrapper.emitted('save')
    expect(saveEvents).toHaveLength(1)
    expect(saveEvents![0]![0]).toMatchObject({
      name: '新任务',
      dependencies: '1, 2',
      progress: 0,
    })
  })
})
