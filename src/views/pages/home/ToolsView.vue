<template>
  <DlsMainLayout :nav-items="navItems" />
</template>

<script setup lang="ts">
import DlsMainLayout from '@/components/layout/DlsMainLayout.vue'
import ToolsPage from './ToolsPage.vue'
import { createToolNavItems } from '@/tools/createToolNavItems'
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: '全部工具',
  description:
    '浏览大龙山工具间全部在线工具：坐标转换、距离测算、地址解析、GIS 文件互转、高程查询、地震/天气查询、文档模板导出等。',
  path: '/tools',
  keywords: ['在线工具列表', '地理空间工具', '坐标转换', 'GIS', 'KML', 'SHP'],
})

const navItems = createToolNavItems(ToolsPage, 'tools')
</script>
