/**
 * 光缆 12 色纤序（TIA-598 / YD/T 标准色序）。
 *
 * 颜色在这里是编码，不是装饰：第 N 芯永远是同一个颜色。
 * 任何界面都可以引用这份数据，但不要改变顺序、不要做渐变或混合。
 */
export interface FiberColor {
  index: number
  name: string
  hex: string
  /** 浅色纤芯需要描边，否则在白图主题下不可见 */
  light?: boolean
}

export const fiberColors: FiberColor[] = [
  { index: 1, name: '蓝', hex: '#3b82f6' },
  { index: 2, name: '橙', hex: '#f97316' },
  { index: 3, name: '绿', hex: '#22c55e' },
  { index: 4, name: '棕', hex: '#a16207' },
  { index: 5, name: '灰', hex: '#6b7280' },
  { index: 6, name: '白', hex: '#ffffff', light: true },
  { index: 7, name: '红', hex: '#ff1e1e' },
  { index: 8, name: '黑', hex: '#1f2937' },
  { index: 9, name: '黄', hex: '#eab308' },
  { index: 10, name: '紫', hex: '#8b5cf6' },
  { index: 11, name: '粉', hex: '#db7183' },
  { index: 12, name: '青', hex: '#06b6d4' },
]
