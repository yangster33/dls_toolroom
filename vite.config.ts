import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import { viteMockServe } from 'vite-plugin-mock'
// import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      vue(),
      vueJsx(),
      vueDevTools(),
      viteMockServe({
        mockPath: './src/mock',
        enable: command === 'serve' && env.VITE_USE_MOCK !== 'false',
        watchFiles: false,
      }),
      //  tailwindcss()
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': 'http://127.0.0.1:8000',
      },
    },
    build: {
      rollupOptions: {
        output: {
          /**
           * 手动分包（审计 P2-10 / P2-11）。
           *
           * 旧实现用 `id.includes('vue')` 之类的**子串**匹配，命中一切路径含
           * "vue" 的包：`@vuepic/vue-datepicker`、`vuedraggable` 都被并进
           * `vue-ecosystem`。由于 `vue` 是入口静态依赖，整块（含这两个按需库）
           * 被写进 index.html 的 modulepreload，首屏白白多下几百 KB。
           *
           * 这里改为基于 `node_modules/<pkg>/` 的**精确包名**匹配；同时去掉
           * 兜底的 catch-all `vendor`——把未命中的模块交还给 Rollup，让它按
           * 「静态 / 动态导入边界」自动切分，避免一个静态依赖把整块按需库
           * 拖进首屏。
           */
          manualChunks(id) {
            if (!id.includes('node_modules')) return

            const normalized = id.replace(/\\/g, '/')
            const matched = normalized.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/)
            if (!matched) return
            const pkg = matched[1]

            if (
              pkg === 'vue' ||
              pkg === 'vue-router' ||
              pkg === 'pinia' ||
              pkg === 'vue-demi' ||
              pkg.startsWith('@vue/')
            ) {
              return 'vue-ecosystem'
            }

            // 大体积按需库：各自成块便于缓存与并行下载。
            //
            // 注意：`@vuepic/vue-datepicker`、`vuedraggable`/`sortablejs` 这几个
            // **故意不在这里起名**。实测（Rolldown）给它们指定 chunk 名时，
            // 会把它们依赖的 `@vue/shared` 等首屏共享模块一并并入该块，反而
            // 把整块拖进 modulepreload。交给自动切分后它们才是真正的懒加载块。
            if (pkg.startsWith('echarts') || pkg === 'zrender') return 'echarts'
            if (pkg === 'leaflet') return 'leaflet'
            if (pkg.startsWith('@turf/')) return 'turf'
            if (pkg === 'exceljs') return 'exceljs'
            if (['docxtemplater', 'xlsx', 'jszip', 'pizzip'].includes(pkg)) {
              return 'document-libs'
            }
            if (pkg === 'frappe-gantt') return 'frappe-gantt'
            if (pkg === 'markdown-it' || pkg === 'dompurify') return 'md-utils'
            if (pkg === 'proj4' || pkg === 'gcoord' || pkg === 'shpjs') return 'geo-libs'

            return undefined
          },
        },
      },
    },
  }
})
