/**
 * 计算书文本拼装：把步骤与校核转成「复制计算书」用到的行。
 *
 * 只负责格式，不关心各工具的字段；标题、输入摘要等仍由页面自己拼。
 */

import type { CalcStep } from './calcTrace'

export interface CheckLineSource {
  label: string
  pass: boolean
  required: string
  actual: string
}

/** 逐步推导行：序号/标题/公式，再跟代入与结果。 */
export function formatStepLines(steps: ReadonlyArray<CalcStep>): string[] {
  return steps.flatMap((step) => [
    `${step.index}. ${step.title}：${step.formula.replace(/\n/g, '；')}`,
    `   代入：${step.substitution}`,
    `   结果：${step.result}`,
  ])
}

/** 校核明细行：`- 标签：通过/不通过；要求 …；实际 …`。 */
export function formatCheckLines(
  checks: ReadonlyArray<CheckLineSource>,
  labels: { pass?: string; fail?: string } = {},
): string[] {
  const passLabel = labels.pass ?? '通过'
  const failLabel = labels.fail ?? '不通过'
  return checks.map(
    (check) =>
      `- ${check.label}：${check.pass ? passLabel : failLabel}；要求 ${check.required}；实际 ${check.actual}`,
  )
}
