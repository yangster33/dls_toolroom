import { reactive, onMounted, onUnmounted, toRefs } from 'vue'

export interface DaisyThemeColors {
  base100: string
  base200: string
  base300: string
  baseContent: string
  primary: string
  primaryContent: string
  secondary: string
  secondaryContent: string
  accent: string
  accentContent: string
  neutral: string
  neutralContent: string
  info: string
  success: string
  warning: string
  error: string
}

const CSS_VAR_MAP: Record<keyof DaisyThemeColors, string> = {
  base100: '--color-base-100',
  base200: '--color-base-200',
  base300: '--color-base-300',
  baseContent: '--color-base-content',
  primary: '--color-primary',
  primaryContent: '--color-primary-content',
  secondary: '--color-secondary',
  secondaryContent: '--color-secondary-content',
  accent: '--color-accent',
  accentContent: '--color-accent-content',
  neutral: '--color-neutral',
  neutralContent: '--color-neutral-content',
  info: '--color-info',
  success: '--color-success',
  warning: '--color-warning',
  error: '--color-error',
}

function readCssVar(name: string): string {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function buildColors(): DaisyThemeColors {
  const colors = {} as DaisyThemeColors
  for (const [key, varName] of Object.entries(CSS_VAR_MAP)) {
    colors[key as keyof DaisyThemeColors] = readCssVar(varName)
  }
  return colors
}

/**
 * Parse an OKLCH color string and return a new one with modified lightness.
 * daisyUI v5 uses OKLCH for all theme colors.
 */
export function darkenOklch(color: string, factor: number): string {
  const match = color.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/)
  if (match) {
    const l = Math.max(0, parseFloat(match[1]!) * factor).toFixed(4)
    return `oklch(${l} ${match[2]} ${match[3]})`
  }
  return color
}

/**
 * Composable that reads daisyUI CSS custom properties and stays reactive
 * to theme changes (data-theme attribute on <html>).
 */
export function useDaisyTheme() {
  const colors = reactive<DaisyThemeColors>(buildColors())
  let observer: MutationObserver | null = null

  const refresh = () => {
    Object.assign(colors, buildColors())
  }

  onMounted(() => {
    refresh()
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'data-theme') {
          refresh()
          break
        }
      }
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
  })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
  })

  return {
    ...toRefs(colors),
    refresh,
  }
}
