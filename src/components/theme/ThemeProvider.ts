/**
 * ThemeProvider.ts
 * 负责管理 daisyUI 主题的切换、持久化和初始化。
 *
 * 站点只保留两套自有主题：
 *   baitu —— 白图（施工白图纸），默认
 *   lantu —— 蓝图（晒图纸）
 * 不再暴露 daisyUI 官方主题，避免站点气质随用户切换整体漂移。
 */

import { logger } from '@/utils/logger'

const AVAILABLE_THEMES = ['baitu', 'lantu'] as const

export type Theme = (typeof AVAILABLE_THEMES)[number]

const THEME_STORAGE_KEY = 'dls_toolroom_theme'

/** 旧版本保存的是 daisyUI 官方主题名，读取时映射到就近的自有主题 */
const LEGACY_THEME_MAP: Record<string, Theme> = {
  light: 'baitu',
  winter: 'baitu',
  corporate: 'baitu',
  business: 'baitu',
  dark: 'lantu',
  night: 'lantu',
  dracula: 'lantu',
  forest: 'lantu',
}

class ThemeProvider {
  private currentTheme: Theme = 'baitu'
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
  public setTheme(theme: Theme): void {
    if (!this.isValidTheme(theme)) {
      logger.warn(`[ThemeProvider] 无效的主题: ${theme}`)
      return
    }

    this.currentTheme = theme
    this.saveTheme(theme)
    this.applyTheme(theme)
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
    if (!saved) return null
    if (this.isValidTheme(saved)) return saved

    const legacy = LEGACY_THEME_MAP[saved]
    if (legacy) {
      this.saveTheme(legacy)
      return legacy
    }
    return null
  }

  /**
   * 检测系统偏好 (深色/浅色)。
   * 公开站首访默认白图：只有用户系统明确偏好深色时才给蓝图。
   */
  private getSystemPreference(): Theme {
    if (typeof window === 'undefined') return 'baitu'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'lantu' : 'baitu'
  }

  private isValidTheme(theme: string): theme is Theme {
    return (AVAILABLE_THEMES as readonly string[]).includes(theme)
  }
}

// 导出单例实例
export const themeProvider = new ThemeProvider()
