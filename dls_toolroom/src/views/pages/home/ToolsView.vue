<template>
  <DlsMainLayout :nav-items="navItems" />
</template>

<script setup lang="ts">
import DlsMainLayout from '@/components/layout/DlsMainLayout.vue'
import ToolsPage from './ToolsPage.vue'
import { createToolNavItems } from '@/tools/createToolNavItems'

const navItems = createToolNavItems(ToolsPage, 'tools')
</script>
