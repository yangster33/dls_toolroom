import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfigFn from './vite.config'

const viteConfig =
  typeof viteConfigFn === 'function'
    ? viteConfigFn({ command: 'serve', mode: 'test', isSsrBuild: false, isPreview: false })
    : viteConfigFn

export default mergeConfig(
  viteConfig as any,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
