<template>
  <div class="about p-6">
    <div class="about-grid">
      <div class="about-main">
        <section class="about-section">
          <h2>这是什么</h2>
          <p>
            大龙山工具间把通信工程科研、规划和设计里那些高频、零碎、又不得不做的小事，做成了一组打开浏览器就能用的工具：坐标转换、距离测算、KML/SHP
            互转、高程与气象查询、模板批量导出、工期倒排。
          </p>
        </section>

        <section class="about-section">
          <h2>为什么是纯前端</h2>
          <p>
            坐标和表格往往涉及项目数据。把处理放在浏览器里，文件不上传、结果不落库，用完即走；站点本身也只是一堆静态文件。
          </p>
        </section>

        <section class="about-section">
          <h2>顶部那 12 个色块</h2>
          <p>那是光缆的 12 色纤序（TIA-598）。从第 1 芯到第 12 芯依次是：</p>
          <ol class="fiber-list">
            <li v-for="fiber in fiberColors" :key="fiber.index">
              <span
                class="fiber-dot"
                :class="{ 'fiber-dot-light': fiber.light }"
                :style="{ backgroundColor: fiber.hex }"
              ></span>
              <span class="fiber-index readout">第 {{ fiber.index }} 芯</span>
              <span class="fiber-name">{{ fiber.name }}</span>
            </li>
          </ol>
          <p class="about-note">它是编码，不是装饰，所以不做渐变、不做动画，顺序也永远不变。</p>
        </section>

        <section class="about-section">
          <h2>技术</h2>
          <dl class="tech-grid">
            <div class="tech-item">
              <dt>框架</dt>
              <dd>Vue 3 · TypeScript · Vite</dd>
            </div>
            <div class="tech-item">
              <dt>样式</dt>
              <dd>Tailwind CSS · daisyUI（白图 / 蓝图双主题）</dd>
            </div>
            <div class="tech-item">
              <dt>图表与地图</dt>
              <dd>ECharts · Leaflet · Turf.js</dd>
            </div>
            <div class="tech-item">
              <dt>文档与表格</dt>
              <dd>docxtemplater · exceljs · SheetJS</dd>
            </div>
          </dl>
        </section>

        <section class="about-section">
          <h2>边界</h2>
          <ul class="about-list">
            <li>所有结果都需要人工复核，尤其是坐标转换和批量导出。</li>
            <li>高程、天气、地震等数据来自第三方公开接口，可用性取决于对方。</li>
            <li>本站不保存上传的文件，请自行保留原始数据。</li>
          </ul>
        </section>
      </div>

      <aside class="about-side" aria-label="站点信息">
        <div class="side-block">
          <p class="sheet-label">作者</p>
          <p class="side-value">yangster</p>
        </div>
        <div class="side-block">
          <p class="sheet-label">站点</p>
          <p class="side-value">个人项目 · 纯静态</p>
        </div>
        <div class="side-block">
          <p class="sheet-label">主题</p>
          <p class="side-value">白图 / 蓝图</p>
        </div>
        <div class="side-block">
          <p class="sheet-label">源码</p>
          <p class="side-links">
            <a href="https://github.com/yangster33/dls_toolroom" target="_blank" rel="noopener"
              >GitHub</a
            >
            <a href="https://gitee.com/yangster/dls_toolroom" target="_blank" rel="noopener"
              >Gitee</a
            >
          </p>
        </div>
        <div class="side-block">
          <p class="sheet-label">联系</p>
          <p class="side-links">
            <a href="mailto:yangster33@outlook.com">yangster33@outlook.com</a>
          </p>
        </div>
        <div class="side-block">
          <p class="sheet-label">反馈</p>
          <p class="side-text">缺什么工具、哪里算错了，发邮件告诉我。</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fiberColors } from '@/data/fiberColors'
</script>

<style scoped>
.about-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 232px;
  gap: 2.5rem;
  align-items: start;
}

.about-main {
  max-width: 68ch;
}

.about-section {
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--color-base-300);
}

.about-section:first-child {
  padding-top: 0;
}

.about-section:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.about-section h2 {
  margin-bottom: 0.5rem;
}

.about-section p,
.about-list {
  font-size: 13px;
  line-height: 1.85;
  color: color-mix(in oklab, var(--color-base-content) 78%, transparent);
}

.about-list {
  padding-left: 1.1rem;
  list-style: square;
}

.about-note {
  margin-top: 0.5rem;
  font-size: 12px;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
}

.fiber-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.375rem 1rem;
  margin: 0.75rem 0;
}

.fiber-list li {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 12px;
}

.fiber-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
}

.fiber-dot-light {
  box-shadow: inset 0 0 0 1px color-mix(in oklab, #6b7280 60%, transparent);
}

.fiber-index {
  font-size: 10px;
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 2rem;
}

.tech-item {
  display: flex;
  gap: 0.75rem;
  font-size: 12px;
}

.tech-item dt {
  flex: 0 0 4.5rem;
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
}

.tech-item dd {
  color: var(--color-base-content);
}

/* 右侧注释栏：像图纸边上的说明表 */
.about-side {
  border-left: 1px solid var(--color-base-300);
  padding-left: 1.5rem;
}

.side-block {
  padding: 0.625rem 0;
  border-bottom: 1px solid color-mix(in oklab, var(--color-base-300) 65%, transparent);
}

.side-block:first-child {
  padding-top: 0;
}

.side-block:last-child {
  border-bottom: 0;
}

.side-value {
  margin-top: 0.125rem;
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--color-base-content);
}

.side-text {
  margin-top: 0.25rem;
  font-size: 12px;
  line-height: 1.7;
  color: color-mix(in oklab, var(--color-base-content) 65%, transparent);
}

.side-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.125rem;
}

.side-links a {
  font-size: 12px;
  color: var(--color-primary);
}

.side-links a:hover {
  text-decoration: underline;
}

@media (max-width: 900px) {
  .about-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .about-side {
    border-left: 0;
    border-top: 1px solid var(--color-base-300);
    padding-left: 0;
    padding-top: 1rem;
  }

  .fiber-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .tech-grid {
    grid-template-columns: 1fr;
  }
}
</style>
