import type { Component } from 'vue'

export interface DlsMdPageProps extends Record<string, unknown> {
  fileName: string
  basePath?: string
}

export interface ToolWithMdPageProps extends Record<string, unknown> {
  toolPage: Component
  toolPageProps?: Record<string, unknown>
  toolName: string
}

export interface DlsMomentProps extends Record<string, unknown> {
}

export type NavItemProps = DlsMdPageProps | ToolWithMdPageProps | DlsMomentProps

export interface NavItem {
  name: string
  icon: Component
  component: Component
  props: NavItemProps
}

export type ComponentMap = Record<string, Component>