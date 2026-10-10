import type { Component } from 'vue'

export interface DlsMdPageProps extends Record<string, unknown> {
  fileName: string
  basePath?: string
}

/**
 * 「势」tab 无自有 props，透传 Record<string, unknown>。
 * 用 type alias 而非 interface：空 interface 继承一个索引签名等价于其超类型，
 * 是冗余写法（eslint no-empty-object-type）。
 */
export type DlsMomentProps = Record<string, unknown>

export type NavItemProps = DlsMdPageProps | DlsMomentProps

export interface NavItem {
  name: string
  icon: Component
  component: Component
  props: NavItemProps
}

export type ComponentMap = Record<string, Component>
