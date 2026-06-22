import { useHead } from '@unhead/vue'
import { computed } from 'vue'
import type { ToolConfig } from '@/tools/toolData'

const SITE_NAME = '大龙山工具间'
const SITE_URL = (import.meta.env.VITE_SITE_URL ?? 'https://dlslab.cn').replace(/\/$/, '')
const SITE_DESCRIPTION =
  '大龙山工具间 — 一站式地理空间数据处理与转换工具集，提供坐标转换、距离测算、地址解析、GIS 文件互转、高程查询、地震/天气查询等在线工具。'
interface SeoOptions {
  title: string
  description?: string
  path?: string
  keywords?: string[]
  image?: string
}

export function useSeo(options: SeoOptions) {
  const fullTitle = computed(() =>
    options.title === SITE_NAME ? options.title : `${options.title} | ${SITE_NAME}`,
  )
  const url = computed(() => `${SITE_URL}${options.path ?? '/'}`)
  const description = options.description ?? SITE_DESCRIPTION

  useHead({
    title: fullTitle,
    meta: [
      { name: 'description', content: description },
      ...(options.keywords && options.keywords.length
        ? [{ name: 'keywords', content: options.keywords.join(',') }]
        : []),
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: description },
      { name: 'twitter:url', content: url },
    ],
    link: [{ rel: 'canonical', href: url }],
  })
}

export function useToolSeo(tool: ToolConfig) {
  useSeo({
    title: tool.name,
    description: `${tool.description} — ${tool.tags.join('、')}相关在线工具，免安装、浏览器直接使用。`,
    path: `/tools/${tool.id}`,
    keywords: [...tool.tags, tool.name, '在线工具', '地理空间'],
  })

  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: tool.name,
          description: tool.description,
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          keywords: tool.tags.join(', '),
          url: `${SITE_URL}/tools/${tool.id}`,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'CNY',
          },
          publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
          },
        }),
      },
    ],
  })
}

export function useSiteSchema() {
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: SITE_URL,
          description: SITE_DESCRIPTION,
          publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
        }),
      },
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: SITE_NAME,
          url: SITE_URL,
          logo: `${SITE_URL}/my-logo.png`,
          slogan: SITE_DESCRIPTION,
        }),
      },
    ],
  })
}

export { SITE_NAME, SITE_URL, SITE_DESCRIPTION }
