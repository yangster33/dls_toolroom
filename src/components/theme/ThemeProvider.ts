/**
 * ThemeProvider.ts
 * 负责管理 daisyUI 主题的切换、持久化和初始化
 */

import { logger } from '@/utils/logger'

// 从 tailwind.config.js 中提取的主题列表
const AVAILABLE_THEMES = [
  'light',
  'dark',
  'corporate',
  'business',
  'night',
  'dracula',
  'winter',
  'forest',
] as const

// 定义类型，确保类型安全
export type Theme = (typeof AVAILABLE_THEMES)[number]

const THEME_STORAGE_KEY = 'dls_toolroom_theme'

class ThemeProvider {
  private currentTheme: Theme = 'light'
  private isInitialized = false

  constructor() {
    // SSR安全：不在构造函数中调用init()，改为惰性初始化
  }

  /**
   * 初始化主题
   */
  public init(): void {
    if (this.isInitialized) return

    const savedTheme = this.getSavedTheme()

    if (savedTheme) {
      this.currentTheme = savedTheme
    } else {
      this.currentTheme = this.getSystemPreference()
    }

    this.applyTheme(this.currentTheme)
    this.isInitialized = true
  }

  /**
   * 切换主题
   */
  public setTheme(theme?: Theme): void {
    let nextTheme: Theme

    if (theme) {
      if (!this.isValidTheme(theme)) {
        logger.warn(`[ThemeProvider] 无效的主题: ${theme}`)
        return
      }
      nextTheme = theme
    } else {
      const currentIndex = AVAILABLE_THEMES.indexOf(this.currentTheme)
      if (currentIndex === -1) {
        nextTheme = 'light'
      } else {
        const nextIndex = (currentIndex + 1) % AVAILABLE_THEMES.length
        nextTheme = AVAILABLE_THEMES[nextIndex]!
      }
    }

    this.currentTheme = nextTheme
    this.saveTheme(nextTheme)
    this.applyTheme(nextTheme)
  }

  /**
   * 获取当前主题（惰性初始化）
   */
  public getTheme(): Theme {
    if (!this.isInitialized) {
      this.init()
    }
    return this.currentTheme
  }

  /**
   * 获取所有可用主题列表
   */
  public getAvailableThemes(): readonly Theme[] {
    return AVAILABLE_THEMES
  }

  // --- 私有方法 ---

  private applyTheme(theme: Theme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }

  private saveTheme(theme: Theme): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch (e) {
      logger.error('[ThemeProvider] 无法保存到 LocalStorage', e)
    }
  }

  private getSavedTheme(): Theme | null {
    if (typeof window === 'undefined') return null

    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved && this.isValidTheme(saved)) {
      return saved as Theme
    }
    return null
  }

  /**
   * 检测系统偏好 (深色/浅色)
   */
  private getSystemPreference(): Theme {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  private isValidTheme(theme: string): theme is Theme {
    return AVAILABLE_THEMES.includes(theme as Theme)
  }
}

// 导出单例实例
export const themeProvider = new ThemeProvider()
