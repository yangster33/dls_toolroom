<!-- src/components/theme/ThemeToggle.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  themeProvider,
  THEME_FAMILIES,
  THEME_MODES,
  type ThemeFamily,
  type ThemeMode,
  type ThemeModePreference,
} from './ThemeProvider'

const family = ref<ThemeFamily>(themeProvider.getFamily())
const modePreference = ref<ThemeModePreference>(themeProvider.getModePreference())
const resolvedMode = ref<ThemeMode>(themeProvider.getResolvedMode())
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)

const familyMeta = computed(
  () => THEME_FAMILIES.find((item) => item.id === family.value) ?? THEME_FAMILIES[0]!,
)

const modeLabel = computed(() => {
  if (modePreference.value === 'system') {
    return `自动 · ${resolvedMode.value === 'dark' ? '深' : '浅'}`
  }
  return resolvedMode.value === 'dark' ? '深色' : '浅色'
})

const triggerTitle = computed(
  () =>
    `图纸主题：${familyMeta.value.lightLabel} / ${familyMeta.value.darkLabel}（${modeLabel.value}）`,
)

let unsubscribe: (() => void) | null = null

function sync() {
  family.value = themeProvider.getFamily()
  modePreference.value = themeProvider.getModePreference()
  resolvedMode.value = themeProvider.getResolvedMode()
}

function selectFamily(id: ThemeFamily) {
  themeProvider.setFamily(id)
}

function selectMode(id: ThemeModePreference) {
  themeProvider.setMode(id)
}

function onPointerDown(event: PointerEvent) {
  if (!open.value || !rootRef.value) return
  if (!rootRef.value.contains(event.target as Node)) {
    open.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value) return
  open.value = false
  triggerRef.value?.focus()
}

onMounted(() => {
  themeProvider.init()
  sync()
  unsubscribe = themeProvider.subscribe(sync)
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  unsubscribe?.()
  unsubscribe = null
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="rootRef" class="theme-control">
    <button
      ref="triggerRef"
      type="button"
      class="theme-trigger"
      :title="triggerTitle"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="open = !open"
    >
      <span class="theme-chip" aria-hidden="true"></span>
      <span class="theme-trigger-text">
        <span class="theme-trigger-family">{{ familyMeta.label }}</span>
        <span class="theme-trigger-mode">{{ modeLabel }}</span>
      </span>
      <svg
        class="theme-trigger-chevron"
        :class="{ 'theme-trigger-chevron-open': open }"
        viewBox="0 0 12 12"
        aria-hidden="true"
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.2" />
      </svg>
    </button>

    <div v-if="open" class="theme-panel" role="dialog" aria-label="图纸主题">
      <div class="theme-panel-head">
        <span class="theme-panel-title">图纸主题</span>
        <span class="theme-panel-note"
          >{{ familyMeta.lightLabel }} / {{ familyMeta.darkLabel }}</span
        >
      </div>

      <div class="theme-family-list">
        <button
          v-for="item in THEME_FAMILIES"
          :key="item.id"
          type="button"
          class="theme-family"
          :class="{ 'theme-family-active': item.id === family }"
          role="menuitemradio"
          :aria-checked="item.id === family"
          @click="selectFamily(item.id)"
        >
          <span class="theme-family-copy">
            <span class="theme-family-name">{{ item.label }}</span>
            <span class="theme-family-desc">{{ item.description }}</span>
          </span>
          <span class="theme-family-check" aria-hidden="true">
            <svg viewBox="0 0 12 12">
              <path d="M2 6.2 4.7 9 10 3.4" fill="none" stroke="currentColor" stroke-width="1.4" />
            </svg>
          </span>
        </button>
      </div>

      <div class="theme-mode">
        <span class="theme-mode-label">明暗</span>
        <div class="theme-mode-group" role="radiogroup" aria-label="明暗模式">
          <button
            v-for="item in THEME_MODES"
            :key="item.id"
            type="button"
            class="theme-mode-btn"
            :class="{ 'theme-mode-btn-active': item.id === modePreference }"
            role="radio"
            :aria-checked="item.id === modePreference"
            @click="selectMode(item.id)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-control {
  position: relative;
}

.theme-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 30px;
  padding: 0 0.5rem;
  color: var(--text-muted);
  border: 1px solid var(--color-base-300);
  background-color: var(--color-base-200);
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.theme-trigger:hover,
.theme-trigger[aria-expanded='true'] {
  color: var(--color-base-content);
  border-color: var(--line-strong);
}

.theme-chip {
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
  border: 1px solid var(--line-strong);
  background: linear-gradient(135deg, var(--color-base-100) 0 48%, var(--color-primary) 48% 100%);
}

.theme-trigger-text {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.4;
}

.theme-trigger-family {
  color: var(--color-base-content);
}

.theme-trigger-mode {
  font-size: 10px;
  letter-spacing: 0.02em;
  color: var(--text-faint);
}

.theme-trigger-chevron {
  width: 10px;
  height: 10px;
  flex: 0 0 10px;
  transition: transform 0.15s ease;
}

.theme-trigger-chevron-open {
  transform: rotate(180deg);
}

.theme-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 60;
  width: 264px;
  padding: 0.375rem;
  background-color: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.16);
  animation: theme-panel-in 0.12s ease-out both;
}

@keyframes theme-panel-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.theme-panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem 0.5rem;
  border-bottom: 1px solid var(--color-base-300);
}

.theme-panel-title {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--color-base-content);
}

.theme-panel-note {
  font-size: 10px;
  color: var(--text-faint);
}

.theme-family-list {
  padding: 0.25rem 0;
}

.theme-family {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.4rem 0.5rem;
  text-align: left;
  color: var(--text-muted);
  border-left: 2px solid transparent;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.theme-family:hover {
  color: var(--color-base-content);
  background-color: var(--color-base-200);
}

.theme-family-active {
  color: var(--color-base-content);
  background-color: var(--color-base-200);
  border-left-color: var(--color-primary);
}

.theme-family-copy {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.theme-family-name {
  font-size: 12px;
  line-height: 1.4;
}

.theme-family-desc {
  font-size: 10px;
  line-height: 1.4;
  color: var(--text-faint);
}

.theme-family-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-left: auto;
  flex: 0 0 14px;
  color: var(--color-primary);
  opacity: 0;
}

.theme-family-check svg {
  width: 12px;
  height: 12px;
}

.theme-family-active .theme-family-check {
  opacity: 1;
}

.theme-mode {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem 0.375rem;
  border-top: 1px solid var(--color-base-300);
}

.theme-mode-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--text-faint);
}

.theme-mode-group {
  display: inline-flex;
  border: 1px solid var(--color-base-300);
}

.theme-mode-btn {
  padding: 0.2rem 0.5rem;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.theme-mode-btn + .theme-mode-btn {
  border-left: 1px solid var(--color-base-300);
}

.theme-mode-btn:hover {
  color: var(--color-base-content);
}

.theme-mode-btn-active,
.theme-mode-btn-active:hover {
  background-color: var(--color-primary);
  color: var(--color-primary-content);
}

@media (max-width: 520px) {
  .theme-trigger-mode {
    display: none;
  }

  .theme-panel {
    width: min(264px, calc(100vw - 1.5rem));
  }
}
</style>
