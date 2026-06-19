<template>
  <footer class="bg-neutral text-neutral-content p-10">
    <div class="footer sm:footer-horizontal">
      <nav>
        <h6 class="footer-title">编程/标记语言</h6>
        <a class="link link-hover" href="https://www.python.org" target="_blank" rel="noopener"
          >Python</a
        >
        <a
          class="link link-hover"
          href="https://www.typescriptlang.org"
          target="_blank"
          rel="noopener"
          >TypeScript</a
        >
        <a
          class="link link-hover"
          href="https://developer.mozilla.org/zh-CN/docs/Web/HTML"
          target="_blank"
          rel="noopener"
          >HTML</a
        >
        <a
          class="link link-hover"
          href="https://developer.mozilla.org/zh-CN/docs/Web/CSS"
          target="_blank"
          rel="noopener"
          >CSS</a
        >
        <a class="link link-hover" href="https://markdown.org" target="_blank" rel="noopener"
          >Markdown</a
        >
        <a
          class="link link-hover"
          href="https://www.ecma-international.org/publications-and-standards/standards/ecma-262/"
          target="_blank"
          rel="noopener"
          >JavaScript</a
        >
      </nav>
      <nav>
        <h6 class="footer-title">技术框架</h6>
        <a class="link link-hover" href="https://vuejs.org" target="_blank" rel="noopener">Vue 3</a>
        <a class="link link-hover" href="https://nodejs.org" target="_blank" rel="noopener"
          >Node.js</a
        >
        <a class="link link-hover" href="https://tailwindcss.com" target="_blank" rel="noopener"
          >Tailwind CSS</a
        >
        <a class="link link-hover" href="https://daisyui.com" target="_blank" rel="noopener"
          >daisyUI</a
        >
        <a class="link link-hover" href="https://router.vuejs.org" target="_blank" rel="noopener"
          >Vue Router</a
        >
        <a class="link link-hover" href="https://pinia.vuejs.org" target="_blank" rel="noopener"
          >Pinia</a
        >
        <a class="link link-hover" href="https://echarts.apache.org" target="_blank" rel="noopener"
          >ECharts</a
        >
      </nav>
      <nav>
        <h6 class="footer-title">关于作者</h6>
        <a class="link link-hover" href="/about">关于项目</a>
        <a class="link link-hover" href="/docs">使用文档</a>
        <a class="link link-hover" href="mailto:yangster33@outlook.com">联系我</a>
        <a
          class="link link-hover"
          href="https://github.com/yangster33/dls_toolroom"
          target="_blank"
          rel="noopener"
          >GitHub</a
        >
        <a
          class="link link-hover"
          href="https://gitee.com/yangster/dls_toolroom"
          target="_blank"
          rel="noopener"
          >gitee</a
        >
      </nav>
    </div>
    <div class="footer-center mt-8 border-t border-neutral-content/20 pt-6">
      <p class="text-sm">© {{ currentYear }} 大龙山工具间 | 纯前端工具聚合网站</p>
      <p class="text-xs mt-2 opacity-70">
        <a class="link link-hover" href="https://beian.miit.gov.cn" target="_blank" rel="noopener">
          渝ICP备2026013128号
        </a>
      </p>
    </div>
  </footer>
</template>

<script setup lang="ts">
const currentYear = new Date().getFullYear()
</script>
