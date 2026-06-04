import type { Component } from 'vue'
import { PhMapPin as PhHome, PhInfo, PhFileText } from '@phosphor-icons/vue'

export interface DocType {
  key: string
  label: string
  fileName: string
}

export const docTypes: DocType[] = [
  { key: 'tao', label: '道', fileName: 'tao.md' },
  { key: 'method', label: '法', fileName: 'method.md' },
  { key: 'tech', label: '术', fileName: 'tech.md' },
]

export interface ViewConfig {
  id: string
  name: string
  path: string
  description: string
  icon: Component
  docTypes?: string[]
}

export const viewConfigs: ViewConfig[] = [
  {
    id: 'home',
    name: '首页',
    path: '/',
    description: '工具导航首页',
    icon: PhHome,
  },
  {
    id: 'about',
    name: '关于',
    path: '/about',
    description: '关于大龙山工具间',
    icon: PhInfo,
    docTypes: ['tao', 'method', 'tech'],
  },
  {
    id: 'mdtest',
    name: 'Markdown测试',
    path: '/mdtest',
    description: 'Markdown渲染测试页面',
    icon: PhFileText,
  },
]

export function getViewById(id: string): ViewConfig | undefined {
  return viewConfigs.find((view) => view.id === id)
}

export function getViewByPath(path: string): ViewConfig | undefined {
  return viewConfigs.find((view) => view.path === path)
}

export function getViewName(id: string, fallback?: string): string {
  const view = getViewById(id)
  return view?.name || fallback || id
}

export function getViewNameByPath(path: string, fallback?: string): string {
  const view = getViewByPath(path)
  return view?.name || fallback || path
}

export function getDocType(key: string): DocType | undefined {
  return docTypes.find((d) => d.key === key)
}

export function getViewDocTypes(viewId: string): DocType[] {
  const view = getViewById(viewId)
  if (!view?.docTypes) return []
  return view.docTypes.map((key) => getDocType(key)).filter((d): d is DocType => d !== undefined)
}

export function getViewDocPath(viewId: string, docKey: string): string {
  return `/docs/${viewId}/${docKey}.md`
}
