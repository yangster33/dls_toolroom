const isDev = import.meta.env.DEV

/**
 * 统一日志工具（生产环境静默）
 *
 * 参数用 `unknown[]` 而非 `any[]`：console.* 本身接受任意值，
 * 用 unknown 既满足 no-explicit-any，又不损失任何能力。
 */
export const logger = {
  log(...args: unknown[]) {
    if (isDev) {
      console.log(...args)
    }
  },
  warn(...args: unknown[]) {
    if (isDev) {
      console.warn(...args)
    }
  },
  error(...args: unknown[]) {
    console.error(...args)
  },
  info(...args: unknown[]) {
    if (isDev) {
      console.info(...args)
    }
  },
  debug(...args: unknown[]) {
    if (isDev) {
      console.debug(...args)
    }
  },
}
