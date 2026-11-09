/**
 * 图框图签的视图状态：元素级显示开关 + 网格/提示开关。
 * 与 SheetDocument 分离，切换显示不会进入撤销历史或导出 JSON。
 */

export interface ViewGroup {
  id: string
  label: string
  children?: ViewGroup[]
  defaultVisible?: boolean
  description?: string
}

export interface ViewState {
  showGrid: boolean
  showTooltips: boolean
  groups: Record<string, boolean>
}

export const VIEW_TREE: ViewGroup[] = [
  {
    id: 'frame',
    label: '图框',
    children: [
      { id: 'paper', label: '纸张边界', defaultVisible: true },
      { id: 'frame.line', label: '图框线', defaultVisible: true },
      { id: 'frame.binding', label: '装订边参考区', defaultVisible: false, description: '视图辅助，不是国标图线' },
      { id: 'symbol.centering', label: '对中符号', defaultVisible: true },
      { id: 'zone.mark', label: '分区标记', defaultVisible: true },
      { id: 'zone.number', label: '分区编号', defaultVisible: true },
    ],
  },
  {
    id: 'titleBlock',
    label: '图签',
    children: [
      { id: 'titleBlock.border', label: '图签外框', defaultVisible: true },
      { id: 'titleBlock.cellBorder', label: '单元格边框', defaultVisible: true },
      { id: 'titleBlock.label', label: '标签文字', defaultVisible: true },
      { id: 'titleBlock.value', label: '字段值文字', defaultVisible: true },
    ],
  },
  {
    id: 'aux',
    label: '辅助',
    children: [
      { id: 'grid', label: '编辑网格', defaultVisible: true },
      { id: 'tooltip', label: '鼠标提示', defaultVisible: true },
    ],
  },
]

const LEAF_GROUPS: ViewGroup[] = VIEW_TREE.flatMap((group) => group.children ?? [group])

export function createDefaultViewState(): ViewState {
  const groups: Record<string, boolean> = {}
  for (const group of LEAF_GROUPS) {
    groups[group.id] = group.defaultVisible !== false
  }
  return {
    showGrid: true,
    showTooltips: true,
    groups,
  }
}

export function isGroupVisible(state: ViewState | undefined, group: string | undefined): boolean {
  if (!state) return true
  if (!group) return true
  return state.groups[group] !== false
}

export function groupState(state: ViewState, group: ViewGroup): 'all' | 'some' | 'none' {
  if (!group.children?.length) {
    return isGroupVisible(state, group.id) ? 'all' : 'none'
  }
  const states = group.children.map((child) => groupState(state, child))
  if (states.every((item) => item === 'all')) return 'all'
  if (states.every((item) => item === 'none')) return 'none'
  return 'some'
}

export function setGroupState(state: ViewState, group: ViewGroup, visible: boolean): void {
  if (group.children?.length) {
    for (const child of group.children) setGroupState(state, child, visible)
  } else {
    state.groups[group.id] = visible
  }
}
