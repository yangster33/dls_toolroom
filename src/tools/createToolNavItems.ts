import { markRaw, type Component } from 'vue'
import { PhYinYang, PhFileText, PhWrench, PhCpu, PhTrendUp } from '@phosphor-icons/vue'
import DlsMdPage from '@/components/layout/DlsMdPage.vue'
import DlsMoment from '@/components/layout/DlsMoment.vue'
import type { NavItem } from '@/types/nav'

const AsyncMdPage = markRaw(DlsMdPage)
const AsyncMoment = markRaw(DlsMoment)

export interface ToolNav {
  navItems: NavItem[]
  toolPage: Component | null
  toolPageProps: Record<string, unknown>
}

export function createToolNavItems(toolPage: Component | null, toolName: string): ToolNav {
  const basePath = `docs/${toolName}`

  const navItems: NavItem[] = [
    {
      name: '道',
      icon: markRaw(PhYinYang),
      component: AsyncMdPage,
      props: { fileName: 'tao.md', basePath },
    },
    {
      name: '法',
      icon: markRaw(PhFileText),
      component: AsyncMdPage,
      props: { fileName: 'method.md', basePath },
    },
    {
      name: '术',
      icon: markRaw(PhWrench),
      component: AsyncMdPage,
      props: { fileName: 'tech.md', basePath },
    },
    {
      name: '器',
      icon: markRaw(PhCpu),
      component: AsyncMdPage,
      props: { fileName: 'tool.md', basePath },
    },
  ]

  const enableMomentTab = import.meta.env.VITE_ENABLE_MOMENT_TAB === 'true'

  if (enableMomentTab) {
    navItems.push({
      name: '势',
      icon: markRaw(PhTrendUp),
      component: AsyncMoment,
      props: {},
    })
  }

  return { navItems, toolPage, toolPageProps: {} }
}