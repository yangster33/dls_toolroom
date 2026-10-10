import { fileURLToPath } from 'node:url'
import { defineConfig, configDefaults } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

/**
 * Vitest 独立配置
 *
 * 历史问题（审计 P2-4）：原来直接复用 vite.config.ts，导致
 *   1. `loadEnv(mode, cwd, '')` 空前缀把 .env 全部内容注入 config
 *   2. viteMockServe / vite-plugin-vue-devtools 被拖进测试环境（白付初始化开销）
 *   3. manualChunks 对 vitest 完全无意义
 *   4. 依赖 `.env` 是否存在来决定 mock 开关，删掉 .env 后行为漂移
 *
 * 现在测试环境**只**带它真正需要的：Vue 单文件组件编译 + 路径别名。
 * 不读 .env、不挂 mock、不做 build 分包。
 */
export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    root: fileURLToPath(new URL('./', import.meta.url)),
  },
})
