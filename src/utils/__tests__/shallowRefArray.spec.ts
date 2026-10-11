import { describe, it, expect } from 'vitest'
import { shallowRef, ref, computed, isProxy } from 'vue'

/**
 * 审计 C3 / P2-18 的响应式契约测试。
 *
 * 背景：代码库里多处用 `ref` 承载**只读的解析结果**（万行数组）。`ref` 会给
 * 数组本身及其中每个对象建立深度响应式代理，对这些只做整体替换的数据纯属浪费：
 * 内存 2–3 倍，且遍历时代理拦截带来额外开销。故改为 `shallowRef`。
 *
 * `shallowRef` 只在「整体替换」时才够用。若之后有人把某一处改成「就地改元素
 * 属性」，响应式会静默失效。以下三条断言把该契约钉住：
 *   1. 整体替换 → computed 照旧重算（UI 仍更新）；
 *   2. 不会给元素建深度代理（省内存的全部意义所在）；
 *   3. 就地改元素属性 → 不触发（这正是不能乱用 shallowRef 的原因）。
 *
 * 覆盖缺口：本测试验证的是「shallowRef 能否胜任整体替换」这一前提；
 * 具体每个站点确实只做整体替换、没有就地修改，是靠逐处读代码确认的
 * （见台账 C3 明细表的审计结论）。
 */

describe('shallowRef 承载只读大数组（C3 响应式契约）', () => {
  it('整体替换时 computed 会重新计算，UI 仍更新', () => {
    const rows = shallowRef<{ n: number }[]>([])
    const count = computed(() => rows.value.length)

    expect(count.value).toBe(0)

    rows.value = [{ n: 1 }, { n: 2 }, { n: 3 }]
    expect(count.value).toBe(3)

    rows.value = []
    expect(count.value).toBe(0)
  })

  it('整体替换不会触发整表深度代理，值按原样透出', () => {
    const payload = [{ n: 1 }, { n: 2 }]
    const rows = shallowRef<{ n: number }[]>(payload)
    // shallowRef 存的就是原数组本身，不包代理
    expect(rows.value).toBe(payload)
  })

  it('不会给元素建深度代理（省内存的原因），而 ref 会', () => {
    const shallowRows = shallowRef<{ n: number }[]>([{ n: 1 }])
    expect(isProxy(shallowRows.value[0]!)).toBe(false)

    const deepRows = ref<{ n: number }[]>([{ n: 1 }])
    expect(isProxy(deepRows.value[0]!)).toBe(true)
  })

  it('就地改元素属性不会触发重算（反证：所以不能随意改用 shallowRef）', () => {
    const rows = shallowRef<{ n: number }[]>([{ n: 1 }])
    let evaluated = 0
    const sum = computed(() => {
      evaluated++
      return rows.value.reduce((acc, r) => acc + r.n, 0)
    })

    expect(sum.value).toBe(1)
    const evaluationsBeforeInPlaceEdit = evaluated

    rows.value[0]!.n = 99
    // computed 未被标脏 → 不重算
    expect(evaluated).toBe(evaluationsBeforeInPlaceEdit)

    // 但整体替换即可生效
    rows.value = [{ n: 99 }]
    expect(sum.value).toBe(99)
  })
})
