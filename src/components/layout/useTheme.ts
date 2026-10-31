import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'expense_wiki_theme'

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  } catch {
    // ignore storage errors
  }
  return 'system'
}

function applyThemeToDocument(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches

  const isDark = mode === 'dark' || (mode === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme)

  useEffect(() => {
    applyThemeToDocument(theme)
    if (theme !== 'system' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyThemeToDocument('system')
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [theme])

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // ignore storage errors
    }
  }, [])

  const toggleLightDark = useCallback(() => {
    const isCurrentlyDark =
      typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    setTheme(isCurrentlyDark ? 'light' : 'dark')
  }, [setTheme])

  return { theme, setTheme, toggleLightDark }
}

