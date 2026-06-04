<!-- src/components/theme/ThemeToggle.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { themeProvider, type Theme } from './ThemeProvider'
import { logger } from '@/utils/logger'

const currentTheme = ref<Theme>('light')

onMounted(() => {
  currentTheme.value = themeProvider.getTheme()
  setThisPageTheme(currentTheme.value)
  logger.log('currentTheme', currentTheme.value)
})

onUnmounted(() => {})

const setTheme = (theme: Theme) => {
  themeProvider.setTheme(theme)
}

const getThemeDisplayName = (theme: Theme): string => {
  const nameMap: Record<Theme, string> = {
    light: '简约白',
    dark: '深邃黑',
    corporate: '商务蓝',
    business: '商务灰',
    night: '深夜蓝',
    dracula: '暗夜紫',
    winter: '霜雪白',
    forest: '深林绿',
  }
  return nameMap[theme] || theme
}

const setThisPageTheme = (themeName: Theme): void => {
  const selector = `input[aria-label="${getThemeDisplayName(themeName)}"]`
  const radioElement = document.querySelector(selector) as HTMLInputElement | null
  if (radioElement) {
    radioElement.checked = true
    radioElement.click()
  }
}
</script>

<template>
  <div class="dropdown dropdown-end mb-1">
    <div tabindex="0" role="button" class="btn m-1">
      主题切换
      <svg
        width="12px"
        height="12px"
        class="inline-block h-2 w-2 fill-current opacity-60"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 2048 2048"
      >
        <path d="M1799 349l242 241-1017 1017L7 590l242-241 775 775 775-775z"></path>
      </svg>
    </div>

    <ul tabindex="-1" class="dropdown-content bg-base-300 rounded-box z-50 w-52 p-2 shadow-2xl">
      <li
        v-for="theme in themeProvider.getAvailableThemes()"
        :key="theme"
        data-theme="{currentTheme}"
      >
        <input
          @click="setTheme(theme)"
          type="radio"
          name="theme-dropdown"
          class="theme-controller w-full btn btn-sm btn-block btn-ghost justify-start"
          :aria-label="getThemeDisplayName(theme)"
          :value="theme"
        />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.dropdown-open .dropdown-content {
  display: block;
}
</style>
