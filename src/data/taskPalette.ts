/**
 * 甘特图任务配色。
 *
 * 用一组低饱和的工程色代替 Tailwind 500 彩虹色，保证和图纸主题一致，
 * 同时保持任务之间可区分。条形上的文字为白色，所以整体压暗。
 */
export const taskColorPalette = [
  '#2C6E9B', // 制图蓝
  '#3A7F6B', // 水系青
  '#8F6A1E', // 测点黄
  '#A6453A', // 标石红
  '#7A5B7E', // 紫铜
  '#55677A', // 灰蓝
  '#4F7A3F', // 等高绿
  '#8A6A4F', // 土褐
] as const

export const defaultTaskColor: string = taskColorPalette[0]
