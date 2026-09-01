import type { Component } from 'vue'

export interface DlsMdPageProps extends Record<string, unknown> {
  fileName: string
  basePath?: string
}

export interface DlsMomentProps extends Record<string, unknown> {
}

export type NavItemProps = DlsMdPageProps | DlsMomentProps

export interface NavItem {
  name: string
  icon: Component
  component: Component
  props: NavItemProps
}

export type ComponentMap = Record<string, Component>