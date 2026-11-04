<template>
  <DlsMainLayout
    :nav-items="toolNav.navItems"
    :tool-page="toolNav.toolPage"
    :tool-page-props="toolNav.toolPageProps"
    title="工具索引"
  />
</template>

<script setup lang="ts">
import DlsMainLayout from '@/components/layout/DlsMainLayout.vue'
import ToolsPage from './ToolsPage.vue'
import { createToolNavItems } from '@/tools/createToolNavItems'
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: '全部工具',
  description:
    '浏览大龙山工具间全部在线工具：坐标转换、距离测算、地址解析、KML/SHP 互转、高程与气象查询、地震/灾害查询、文档模板批量导出、甘特图排期等。',
  path: '/tools',
  keywords: ['在线工具列表', '通信工程', '坐标转换', 'KML', 'SHP', 'GIS'],
})

const toolNav = createToolNavItems(ToolsPage, 'tools')
</script>
