<template>
  <footer class="site-footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <p class="footer-wordmark">大龙山工具间</p>
        <p class="footer-desc">
          通信工程科研 / 规划 / 设计工具集。纯前端实现，数据只在浏览器里处理。
        </p>
        <p class="footer-note">顶部 12 色为光缆纤序（TIA-598），悬停可查。</p>
      </div>

      <nav class="footer-col" aria-label="站内">
        <h2 class="footer-heading">站内</h2>
        <router-link class="footer-link" to="/">首页</router-link>
        <router-link class="footer-link" to="/tools">工具索引</router-link>
        <router-link class="footer-link" to="/about">关于</router-link>
        <router-link class="footer-link" to="/donate">支持我</router-link>
      </nav>

      <nav class="footer-col" aria-label="技术">
        <h2 class="footer-heading">技术</h2>
        <a class="footer-link" href="https://vuejs.org" target="_blank" rel="noopener">Vue 3</a>
        <a class="footer-link" href="https://www.typescriptlang.org" target="_blank" rel="noopener"
          >TypeScript</a
        >
        <a class="footer-link" href="https://tailwindcss.com" target="_blank" rel="noopener"
          >Tailwind CSS</a
        >
        <a class="footer-link" href="https://daisyui.com" target="_blank" rel="noopener">daisyUI</a>
        <a class="footer-link" href="https://echarts.apache.org" target="_blank" rel="noopener"
          >ECharts</a
        >
      </nav>

      <nav class="footer-col" aria-label="其他">
        <h2 class="footer-heading">其他</h2>
        <a
          class="footer-link"
          href="https://github.com/yangster33/dls_toolroom"
          target="_blank"
          rel="noopener"
          >GitHub</a
        >
        <a
          class="footer-link"
          href="https://gitee.com/yangster/dls_toolroom"
          target="_blank"
          rel="noopener"
          >Gitee</a
        >
        <a class="footer-link" href="mailto:yangster33@outlook.com">联系我</a>
        <a class="footer-link" href="https://beian.miit.gov.cn" target="_blank" rel="noopener"
          >渝ICP备2026013128号</a
        >
      </nav>
    </div>

    <div class="footer-bottom">
      <span>© {{ currentYear }} 大龙山工具间</span>
      <span class="footer-bottom-sep" aria-hidden="true">/</span>
      <span>个人项目 · 工具结果请以人工复核为准</span>
    </div>
  </footer>
</template>

<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>

<style scoped>
.site-footer {
  margin-top: 3rem;
  border-top: 1px solid var(--color-base-300);
  background-color: var(--color-base-200);
}

.footer-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) repeat(3, minmax(0, 1fr));
  gap: 2rem;
  padding: 2rem 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.footer-wordmark {
  font-family: var(--font-drawing);
  font-size: 1rem;
  letter-spacing: 0.02em;
}

.footer-desc {
  margin-top: 0.5rem;
  max-width: 34ch;
  font-size: 12px;
  line-height: 1.7;
  color: color-mix(in oklab, var(--color-base-content) 65%, transparent);
}

.footer-note {
  margin-top: 0.75rem;
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 45%, transparent);
}

.footer-heading {
  margin-bottom: 0.5rem;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.footer-link {
  width: fit-content;
  font-size: 12px;
  color: color-mix(in oklab, var(--color-base-content) 75%, transparent);
}

.footer-link:hover {
  color: var(--color-primary);
}

.footer-bottom {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 45%, transparent);
  border-top: 1px solid var(--color-base-300);
  max-width: 1400px;
  margin: 0 auto;
}

.footer-bottom-sep {
  color: var(--color-base-300);
}

@media (max-width: 900px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .footer-grid {
    grid-template-columns: 1fr;
  }
}
</style>
