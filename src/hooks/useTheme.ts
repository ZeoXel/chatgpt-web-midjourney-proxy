import type { GlobalThemeOverrides } from 'naive-ui'
import { computed, watch } from 'vue'
import { darkTheme, useOsTheme } from 'naive-ui'
import { useAppStore } from '@/store'

export function useTheme() {
  const appStore = useAppStore()

  const OsTheme = useOsTheme()

  const isDark = computed(() => {
    if (appStore.theme === 'auto')
      return OsTheme.value === 'dark'
    else
      return appStore.theme === 'dark'
  })

  const theme = computed(() => {
    return isDark.value ? darkTheme : undefined
  })

  const themeOverrides = computed<GlobalThemeOverrides>(() => {
    const baseOverrides = {
      common: {
        primaryColor: '#3b82f6',
        primaryColorHover: '#2563eb',
        primaryColorPressed: '#1d4ed8',
        primaryColorSuppl: '#60a5fa',
        successColor: '#3b82f6',
        successColorHover: '#2563eb',
        successColorPressed: '#1d4ed8',
        successColorSuppl: '#60a5fa',
      }
    }
    
    if (isDark.value) {
      return {
        ...baseOverrides,
        common: {
          ...baseOverrides.common,
        },
      }
    }
    return baseOverrides
  })

  watch(
    () => isDark.value,
    (dark) => {
      if (dark)
        document.documentElement.classList.add('dark')
      else
        document.documentElement.classList.remove('dark')
    },
    { immediate: true },
  )

  return { theme, themeOverrides }
}
