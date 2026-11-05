<template>
  <div class="not-found-wrap">
    <section class="sheet-frame not-found">
      <span class="sheet-corner sheet-corner-tl" aria-hidden="true"></span>
      <span class="sheet-corner sheet-corner-tr" aria-hidden="true"></span>
      <span class="sheet-corner sheet-corner-bl" aria-hidden="true"></span>
      <span class="sheet-corner sheet-corner-br" aria-hidden="true"></span>

      <div class="nf-body">
        <p class="nf-code readout">404</p>
        <h1 class="nf-title">页面未找到</h1>
        <p class="nf-text">这个地址可能已经变更、被移除，或者链接本身就写错了。</p>
        <div class="nf-actions">
          <router-link to="/" class="nf-action nf-action-primary">返回首页</router-link>
          <button type="button" class="nf-action" @click="goBack">返回上页</button>
        </div>
      </div>

      <div class="sheet-title-block">
        <div class="sheet-cell sheet-cell-main">
          <p class="sheet-label">图名</p>
          <p class="sheet-title">页面未找到</p>
        </div>
        <div class="sheet-cell">
          <p class="sheet-label">图号</p>
          <p class="sheet-value">DLS-404</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: '页面未找到',
  description: '抱歉，您访问的页面不存在或已被移除。返回大龙山工具间首页浏览更多在线工具。',
  keywords: ['404', '页面未找到', '大龙山工具间'],
})

const router = useRouter()

const goBack = () => {
  router.back()
}
</script>

<style scoped>
.not-found-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2rem 0;
}

.not-found {
  width: min(720px, 100%);
}

.nf-body {
  padding: 2.5rem 2rem 2rem;
}

.nf-code {
  font-size: 3.5rem;
  line-height: 1;
  letter-spacing: 0.04em;
  color: var(--color-primary);
}

.nf-title {
  margin-top: 0.75rem;
  font-family: var(--font-drawing);
  font-size: 1.75rem;
  font-weight: 400;
  letter-spacing: 0.03em;
}

.nf-text {
  margin-top: 0.5rem;
  max-width: 42ch;
  font-size: 13px;
  color: color-mix(in oklab, var(--color-base-content) 65%, transparent);
}

.nf-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.nf-action {
  padding: 0.375rem 0.875rem;
  font-size: 12px;
  color: var(--color-base-content);
  border: 1px solid var(--color-base-300);
  background-color: var(--color-base-100);
}

.nf-action:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.nf-action-primary,
.nf-action-primary:hover {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-primary-content);
}

@media (max-width: 640px) {
  .nf-body {
    padding: 1.5rem 1.25rem;
  }

  .nf-code {
    font-size: 2.5rem;
  }
}
</style>
