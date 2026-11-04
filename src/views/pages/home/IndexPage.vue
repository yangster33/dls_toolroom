<template>
  <div class="home">
    <!-- 图名页：链接示意 + 光缆色谱 -->
    <section class="masthead paper-grid">
      <div class="masthead-copy">
        <h1 class="masthead-title">大龙山工具间</h1>
        <p class="masthead-lead">通信工程科研、规划与设计工具集</p>
        <p class="masthead-meta readout">
          {{ toolCount }} 个工具 · {{ professionStats.length }} 个专业 · 数据不出浏览器
        </p>
      </div>

      <figure class="masthead-figure">
        <svg
          class="route"
          viewBox="0 0 460 150"
          role="img"
          aria-label="链路示意：站址到汇聚到核心，链路以 12 色光缆表示"
        >
          <rect
            x="57"
            y="59"
            width="346"
            height="15"
            fill="none"
            stroke="currentColor"
            stroke-opacity="0.22"
          />
          <rect
            v-for="(fiber, i) in fiberColors"
            :key="fiber.index"
            x="58"
            :y="60 + i * 1.16"
            width="344"
            height="1.06"
            :fill="fiber.hex"
          />

          <rect x="50" y="60" width="14" height="13" class="route-node" />
          <rect x="223" y="58" width="18" height="17" class="route-node route-node-strong" />
          <rect x="394" y="56" width="22" height="21" class="route-node route-node-core" />

          <text x="57" y="44" class="route-label route-label-sm">24 芯</text>
          <text x="232" y="42" class="route-label route-label-sm">48 芯</text>

          <text x="57" y="104" class="route-label">站址</text>
          <text x="232" y="104" class="route-label">汇聚</text>
          <text x="405" y="104" class="route-label">核心</text>
        </svg>
        <figcaption class="masthead-caption">
          链路示意 · 光缆按 12 色纤序绘制（悬停顶部色条可查）
        </figcaption>
      </figure>
    </section>

    <!-- 常用 -->
    <section class="block">
      <header class="block-head">
        <h2 class="block-title">常用</h2>
        <router-link class="block-link" to="/tools">全部 {{ toolCount }} 个工具</router-link>
      </header>

      <div class="ledger">
        <router-link
          v-for="item in featured"
          :key="item.id"
          :to="`/tools/${item.id}`"
          class="ledger-row ledger-row-tool"
        >
          <span class="ledger-no readout">{{ item.no }}</span>
          <span class="ledger-name">{{ item.name }}</span>
          <span class="ledger-desc">{{ item.description }}</span>
          <span class="ledger-prof">{{ item.profession }}</span>
          <span class="ledger-out readout">{{ item.output }}</span>
        </router-link>
      </div>
    </section>

    <!-- 按专业 -->
    <section class="block">
      <header class="block-head">
        <h2 class="block-title">按专业</h2>
        <span class="block-note">电源、管道暂无工具，规划中</span>
      </header>

      <div class="profession-row">
        <router-link
          v-for="item in professionStats"
          :key="item.key"
          :to="{ path: '/tools', query: { prof: item.key } }"
          class="profession-item"
        >
          <span class="profession-short">{{ item.short }}</span>
          <span class="profession-label">{{ item.label }}</span>
          <span class="profession-count readout">{{ item.count }}</span>
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { toolConfigs, getToolById } from '@/tools/toolData'
import { professions, getProfession, getToolMeta } from '@/tools/toolTaxonomy'
import { fiberColors } from '@/data/fiberColors'
import { useSeo, useSiteSchema } from '@/composables/useSeo'

useSeo({
  title: '大龙山工具间',
  description:
    '通信工程科研、规划与设计工具集：坐标转换、距离测算、地址解析、KML/SHP 互转、高程与气象查询、模板批量导出、甘特图排期等，浏览器直接使用，数据不出本机。',
  path: '/',
  keywords: ['通信工程', '规划设计', '坐标转换', 'GIS', 'KML', 'SHP', '在线工具', '大龙山工具间'],
})
useSiteSchema()

const toolCount = toolConfigs.length

const featuredIds = ['coord_convert', 'coords_convert', 'kml_viewer', 'gantt_chart']

const featured = featuredIds
  .map((id) => {
    const tool = getToolById(id)
    if (!tool) return null
    const meta = getToolMeta(id)
    return {
      id,
      no: String(toolConfigs.findIndex((item) => item.id === id) + 1).padStart(2, '0'),
      name: tool.name,
      description: tool.description,
      profession: getProfession(meta.profession).label,
      output: meta.output,
    }
  })
  .filter((item): item is NonNullable<typeof item> => item !== null)

const professionStats = professions.map((item) => ({
  ...item,
  count: toolConfigs.filter((tool) => getToolMeta(tool.id).profession === item.key).length,
}))
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ---------- 图名页 ---------- */
.masthead {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 2rem;
  align-items: center;
  padding: 2.5rem;
  border: 1px solid var(--color-base-300);
}

.masthead-title {
  font-family: var(--font-drawing);
  font-size: 2.75rem;
  font-weight: 400;
  letter-spacing: 0.03em;
  line-height: 1.15;
}

.masthead-lead {
  margin-top: 0.75rem;
  font-size: 1rem;
  color: color-mix(in oklab, var(--color-base-content) 75%, transparent);
}

.masthead-meta {
  margin-top: 1.25rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-base-300);
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
}

.masthead-figure {
  min-width: 0;
}

.route {
  width: 100%;
  height: auto;
  color: var(--color-base-content);
}

.route-node {
  fill: var(--color-base-100);
  stroke: var(--color-base-content);
  stroke-opacity: 0.55;
  stroke-width: 1;
}

.route-node-strong {
  stroke: var(--color-primary);
  stroke-opacity: 1;
}

.route-node-core {
  fill: var(--color-primary);
  stroke: var(--color-primary);
}

.route-label {
  font-family: var(--font-sans);
  font-size: 11px;
  fill: color-mix(in oklab, var(--color-base-content) 65%, transparent);
}

.route-label-sm {
  font-family: var(--font-mono);
  font-size: 9px;
  fill: color-mix(in oklab, var(--color-base-content) 45%, transparent);
}

.masthead-caption {
  margin-top: 0.5rem;
  font-size: 11px;
  text-align: right;
  color: color-mix(in oklab, var(--color-base-content) 45%, transparent);
}

/* ---------- 区块 ---------- */
.block {
  border: 1px solid var(--color-base-300);
  background-color: var(--color-base-100);
}

.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.625rem 0.875rem;
  border-bottom: 1px solid var(--color-base-300);
  background-color: var(--color-base-200);
}

.block-title {
  font-size: 13px;
  font-weight: 500;
}

.block-link,
.block-note {
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
}

.block-link:hover {
  color: var(--color-primary);
}

.ledger {
  display: flex;
  flex-direction: column;
}

.ledger-row-tool {
  grid-template-columns: 3rem minmax(7rem, 11rem) minmax(0, 1fr) 4rem 6rem;
  gap: 1rem;
  padding: 0.625rem 0.875rem;
  color: var(--color-base-content);
}

.ledger-no {
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 45%, transparent);
}

.ledger-name {
  font-size: 13px;
  font-weight: 500;
}

.ledger-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: color-mix(in oklab, var(--color-base-content) 60%, transparent);
}

.ledger-prof {
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
}

.ledger-out {
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
}

/* ---------- 专业 ---------- */
.profession-row {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.profession-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-left: 1px solid var(--color-base-300);
}

.profession-item:first-child {
  border-left: 0;
}

.profession-item:hover {
  background-color: var(--color-base-200);
}

.profession-short {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  font-size: 11px;
  border: 1px solid var(--color-base-300);
  color: color-mix(in oklab, var(--color-base-content) 70%, transparent);
}

.profession-label {
  font-size: 12px;
}

.profession-count {
  margin-left: auto;
  font-size: 11px;
  color: color-mix(in oklab, var(--color-base-content) 45%, transparent);
}

@media (max-width: 900px) {
  .masthead {
    grid-template-columns: 1fr;
    padding: 1.5rem;
  }

  .masthead-title {
    font-size: 2rem;
  }

  .route {
    max-width: 520px;
  }

  .masthead-caption {
    text-align: left;
  }

  .ledger-row-tool {
    grid-template-columns: 2.25rem minmax(0, 1fr) 4rem;
  }

  .ledger-desc,
  .ledger-out {
    display: none;
  }

  .profession-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .profession-item:nth-child(3n + 1) {
    border-left: 0;
  }
}
</style>
