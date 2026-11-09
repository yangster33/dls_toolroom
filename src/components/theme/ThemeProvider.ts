/**
 * ThemeProvider.ts
 * 负责管理主题的切换、持久化和初始化。
 *
 * 主题模型：家族（视觉语言） × 明暗模式
 *   工程 gongcheng —— 白图 / 蓝图（施工白图纸 / 晒图纸）
 *   地形 dixing    —— 地形纸 / 夜航图（等高线地形图 / 夜航图）
 *   CAD  cad       —— 布局白 / 模型黑（布局空间 / 模型空间）
 *   仪表 yibiao    —— 仪表白 / 荧光黑（仪表盘 / 示波器）
 *
 * 明暗模式支持 light / dark / system，system 跟随系统偏好。
 * 站点不再暴露 daisyUI 官方主题，避免站点气质随用户切换而整体漂移。
 */

import { logger } from '@/utils/logger'

export type ThemeFamily = 'gongcheng' | 'dixing' | 'cad' | 'yibiao'
export type ThemeMode = 'light' | 'dark'
export type ThemeModePreference = ThemeMode | 'system'
export type Theme = `${ThemeFamily}-${ThemeMode}`

export interface ThemeFamilyMeta {
  id: ThemeFamily
  label: string
  lightLabel: string
  darkLabel: string
  description: string
}

export interface ThemeModeMeta {
  id: ThemeModePreference
  label: string
}

export const THEME_FAMILIES: readonly ThemeFamilyMeta[] = [
  {
    id: 'gongcheng',
    label: '工程',
    lightLabel: '白图',
    darkLabel: '蓝图',
    description: '施工白图纸 / 晒图纸',
  },
  {
    id: 'dixing',
    label: '地形',
    lightLabel: '地形纸',
    darkLabel: '夜航图',
    description: '等高线地形图 / 夜航图',
  },
  {
    id: 'cad',
    label: 'CAD',
    lightLabel: '布局白',
    darkLabel: '模型黑',
    description: '布局空间 / 模型空间',
  },
  {
    id: 'yibiao',
    label: '仪表',
    lightLabel: '仪表白',
    darkLabel: '荧光黑',
    description: '仪表盘 / 示波器',
  },
] as const

export const THEME_MODES: readonly ThemeModeMeta[] = [
  { id: 'system', label: '自动' },
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
] as const

const THEME_STORAGE_KEY = 'dls_toolroom_family'
const MODE_STORAGE_KEY = 'dls_toolroom_mode'
const LEGACY_THEME_KEY = 'dls_toolroom_theme'

/** 旧版本保存的是单主题（含 daisyUI 官方主题名），读取时映射到家族 + 明暗 */
const LEGACY_THEME_MAP: Record<string, Theme> = {
  baitu: 'gongcheng-light',
  lantu: 'gongcheng-dark',
  light: 'gongcheng-light',
  winter: 'gongcheng-light',
  corporate: 'gongcheng-light',
  business: 'gongcheng-light',
  dark: 'gongcheng-dark',
  night: 'gongcheng-dark',
  dracula: 'gongcheng-dark',
  forest: 'gongcheng-dark',
}

function isThemeFamily(value: string): value is ThemeFamily {
  return THEME_FAMILIES.some((item) => item.id === value)
}

function isThemeMode(value: string): value is ThemeMode {
  return value === 'light' || value === 'dark'
}

function isThemeModePreference(value: string): value is ThemeModePreference {
  return value === 'system' || isThemeMode(value)
}

function isTheme(value: string): value is Theme {
  const [family, mode] = value.split('-')
  return !!family && !!mode && isThemeFamily(family) && isThemeMode(mode)
}

function parseTheme(theme: Theme): { family: ThemeFamily; mode: ThemeMode } {
  const [family, mode] = theme.split('-') as [ThemeFamily, ThemeMode]
  return { family, mode }
}

class ThemeProvider {
  private family: ThemeFamily = 'gongcheng'
  private modePreference: ThemeModePreference = 'system'
  private resolvedMode: ThemeMode = 'light'
  private isInitialized = false
  private mediaQuery: MediaQueryList | null = null
  private subscribers = new Set<() => void>()

  /**
   * 初始化主题。重复调用无副作用。
   */
  public init(): void {
    if (this.isInitialized) return

    this.loadPreference()
    this.resolvedMode = this.resolveMode(this.modePreference)
    this.applyTheme()
    this.watchSystemPreference()
    this.isInitialized = true
  }

  public getFamily(): ThemeFamily {
    this.init()
    return this.family
  }

  public getModePreference(): ThemeModePreference {
    this.init()
    return this.modePreference
  }

  public getResolvedMode(): ThemeMode {
    this.init()
    return this.resolvedMode
  }

  public getTheme(): Theme {
    this.init()
    return `${this.family}-${this.resolvedMode}`
  }

  public getAvailableFamilies(): readonly ThemeFamilyMeta[] {
    return THEME_FAMILIES
  }

  public getFamilyMeta(family: ThemeFamily = this.getFamily()): ThemeFamilyMeta {
    return THEME_FAMILIES.find((item) => item.id === family) ?? THEME_FAMILIES[0]!
  }

  /**
   * 切换视觉家族，保留当前明暗模式偏好。
   */
  public setFamily(family: ThemeFamily): void {
    if (!isThemeFamily(family)) {
      logger.warn(`[ThemeProvider] 无效的主题家族: ${family}`)
      return
    }
    if (family === this.family) return

    this.family = family
    this.savePreference()
    this.applyTheme()
    this.notify()
  }

  /**
   * 设置明暗模式偏好（light / dark / system）。
   */
  public setMode(preference: ThemeModePreference): void {
    if (!isThemeModePreference(preference)) {
      logger.warn(`[ThemeProvider] 无效的明暗模式: ${preference}`)
      return
    }
    if (preference === this.modePreference) return

    this.modePreference = preference
    this.resolvedMode = this.resolveMode(preference)
    this.savePreference()
    this.applyTheme()
    this.notify()
  }

  /**
   * 在浅色 / 深色之间切换。当前是“自动”时，以实际生效的模式为起点。
   */
  public toggleMode(): void {
    this.setMode(this.getResolvedMode() === 'dark' ? 'light' : 'dark')
  }

  /**
   * 订阅主题变化，返回取消订阅函数。
   */
  public subscribe(callback: () => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  // --- 私有方法 ---

  private loadPreference(): void {
    if (typeof window === 'undefined') return

    try {
      const savedFamily = localStorage.getItem(THEME_STORAGE_KEY)
      const savedMode = localStorage.getItem(MODE_STORAGE_KEY)
      const legacy = localStorage.getItem(LEGACY_THEME_KEY)

      if (savedFamily && isThemeFamily(savedFamily)) {
        this.family = savedFamily
      }

      if (savedMode && isThemeModePreference(savedMode)) {
        this.modePreference = savedMode
      }

      // 单主题时代的存档：补齐缺失的家族 / 明暗，并清理旧键
      if (legacy) {
        const mapped = LEGACY_THEME_MAP[legacy] ?? (isTheme(legacy) ? legacy : null)
        if (mapped) {
          const parsed = parseTheme(mapped)
          if (!savedFamily || !isThemeFamily(savedFamily)) {
            this.family = parsed.family
          }
          if (!savedMode || !isThemeModePreference(savedMode)) {
            this.modePreference = parsed.mode
          }
          this.savePreference()
        }
        localStorage.removeItem(LEGACY_THEME_KEY)
      }
    } catch (e) {
      logger.error('[ThemeProvider] 无法读取本地主题设置', e)
    }
  }

  private savePreference(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(THEME_STORAGE_KEY, this.family)
      localStorage.setItem(MODE_STORAGE_KEY, this.modePreference)
    } catch (e) {
      logger.error('[ThemeProvider] 无法保存到 LocalStorage', e)
    }
  }

  private resolveMode(preference: ThemeModePreference): ThemeMode {
    if (preference !== 'system') return preference
    if (typeof window === 'undefined' || !window.matchMedia) return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  private watchSystemPreference(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    this.mediaQuery.addEventListener?.('change', this.handleSystemChange)
  }

  private handleSystemChange = (): void => {
    if (this.modePreference !== 'system') return
    const next = this.resolveMode('system')
    if (next === this.resolvedMode) return

    this.resolvedMode = next
    this.applyTheme()
    this.notify()
  }

  private applyTheme(): void {
    if (typeof document === 'undefined') return

    const theme: Theme = `${this.family}-${this.resolvedMode}`
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    root.setAttribute('data-mode', this.resolvedMode)
    this.syncBrowserThemeColor()
  }

  private syncBrowserThemeColor(): void {
    if (typeof document === 'undefined') return

    const color = getComputedStyle(document.documentElement)
      .getPropertyValue('--browser-theme-color')
      .trim()
    if (!color) return
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', color)
  }

  private notify(): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber()
      } catch (e) {
        logger.error('[ThemeProvider] 主题订阅回调失败', e)
      }
    }
  }
}

// 导出单例实例
export const themeProvider = new ThemeProvider()
