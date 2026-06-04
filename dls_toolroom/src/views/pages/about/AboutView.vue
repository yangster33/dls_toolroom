<template>
  <DlsMainLayout :nav-items="navItems" />
</template>

<script setup lang="ts">
import DlsMainLayout from '@/components/layout/DlsMainLayout.vue'
import AboutPage from './AboutPage.vue'
import { createToolNavItems } from '@/tools/createToolNavItems'

const navItems = createToolNavItems(AboutPage, 'about')
</script>
