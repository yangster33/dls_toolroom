<template>
  <router-view />
  <!-- 全局 toast 容器：必须挂载，否则 useToast() 的提示会静默丢失（审计 P1-1）。
       用 Teleport 到 body，因此放在这里不会影响页面布局。 -->
  <ToastContainer />
</template>

<script setup lang="ts">
import ToastContainer from '@/components/common/ToastContainer.vue'
</script>
