'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'securex-theme'

function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', t)
  // Keep <meta name="theme-color"> in sync (browser chrome on mobile)
  const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
  if (meta) meta.content = t === 'light' ? '#f5f7fa' : '#030507'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default 'dark' on first render to match the SSR HTML. The inline script
  // in the root layout sets the real theme on <html> before hydration so the
  // visual flash is avoided; this state then syncs in the effect.
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const current = (document.documentElement.getAttribute('data-theme') as Theme | null) ?? 'dark'
    setThemeState(current)
  }, [])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    applyTheme(t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch { /* private mode */ }
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    // Safe fallback so consumers that render before the provider mounts don't crash
    return { theme: 'dark', toggleTheme: () => {}, setTheme: () => {} }
  }
  return ctx
}

/**
 * Inline script body used in the root <head> to set the theme attribute
 * before React hydrates — prevents flash of incorrect theme on first paint.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`
