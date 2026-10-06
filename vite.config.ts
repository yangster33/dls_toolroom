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
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Vue ecosystem — shared across all pages
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router') || id.includes('vueuse')) {
              return 'vue-ecosystem'
            }
            // ECharts is large (~1MB) and used by multiple chart tools
            if (id.includes('echarts') || id.includes('zrender')) {
              return 'echarts'
            }
            // Leaflet is large and used by map tools
            if (id.includes('leaflet')) {
              return 'leaflet'
            }
            // Turf.js geo analysis library
            if (id.includes('@turf')) {
              return 'turf'
            }
            // ExcelJS 单独成块：它约 900KB，且只在「XLSX 模板导出」被使用时
            // 通过动态 import 加载。不拆开的话，用 DOCX 模板的用户也得下载它。
            if (id.includes('exceljs')) {
              return 'exceljs'
            }
            // Document generation libraries
            if (id.includes('docxtemplater') || id.includes('xlsx') || id.includes('jszip') || id.includes('pizzip')) {
              return 'document-libs'
            }
            // UI component libraries
            if (id.includes('radix-vue') || id.includes('@vuepic') || id.includes('frappe-gantt') || id.includes('vuedraggable')) {
              return 'ui-libs'
            }
            // Markdown and diagram
            if (id.includes('markdown-it') || id.includes('mermaid') || id.includes('monaco')) {
              return 'md-diagram'
            }
            // Everything else from node_modules
            return 'vendor'
          }
        },
      },
    },
  },
}
})
