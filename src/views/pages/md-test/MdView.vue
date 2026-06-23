<template>
  <DlsMdPage fileName="thisMd.md" />
</template>

<script setup lang="ts">
import DlsMdPage from '@/components/layout/DlsMdPage.vue'
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: 'Markdown 文档',
  description: '大龙山工具间 Markdown 文档查看器。',
  keywords: ['Markdown', '文档', '大龙山工具间'],
})
</script>
