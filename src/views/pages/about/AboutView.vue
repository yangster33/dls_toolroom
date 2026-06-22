<template>
  <DlsMainLayout :nav-items="navItems" />
</template>

<script setup lang="ts">
import DlsMainLayout from '@/components/layout/DlsMainLayout.vue'
import AboutPage from './AboutPage.vue'
import { createToolNavItems } from '@/tools/createToolNavItems'
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: '关于',
  description: '关于大龙山工具间 — 项目背景、作者介绍与使用说明。',
  path: '/about',
  keywords: ['关于', '大龙山工具间', '作者', '项目介绍'],
})

const navItems = createToolNavItems(AboutPage, 'about')
</script>
