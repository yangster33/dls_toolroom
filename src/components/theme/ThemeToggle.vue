<!-- src/components/theme/ThemeToggle.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { themeProvider, type Theme } from './ThemeProvider'

const currentTheme = ref<Theme>('baitu')

const themes: { value: Theme; label: string }[] = [
  { value: 'baitu', label: '白图' },
  { value: 'lantu', label: '蓝图' },
]

onMounted(() => {
  currentTheme.value = themeProvider.getTheme()
})

const selectTheme = (theme: Theme) => {
  if (currentTheme.value === theme) return
  currentTheme.value = theme
  themeProvider.setTheme(theme)
}
</script>

<template>
  <div class="theme-switch" role="group" aria-label="图纸主题">
    <button
      v-for="item in themes"
      :key="item.value"
      type="button"
      class="theme-switch-btn"
      :class="{ 'theme-switch-btn-active': currentTheme === item.value }"
      :aria-pressed="currentTheme === item.value"
      :title="item.value === 'baitu' ? '白图：施工白图纸' : '蓝图：晒图纸'"
      @click="selectTheme(item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.theme-switch {
  display: inline-flex;
  border: 1px solid var(--color-base-300);
  background-color: var(--color-base-200);
}

.theme-switch-btn {
  padding: 0.25rem 0.625rem;
  font-size: 12px;
  line-height: 1.5;
  color: color-mix(in oklab, var(--color-base-content) 65%, transparent);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.theme-switch-btn + .theme-switch-btn {
  border-left: 1px solid var(--color-base-300);
}

.theme-switch-btn:hover {
  color: var(--color-base-content);
}

.theme-switch-btn-active,
.theme-switch-btn-active:hover {
  background-color: var(--color-primary);
  color: var(--color-primary-content);
}
</style>
