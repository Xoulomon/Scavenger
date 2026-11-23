import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
  type ThemeProviderProps
} from 'next-themes'

export type ThemeName = 'light' | 'dark' | 'high-contrast' | 'system'
export type ResolvedTheme = 'light' | 'dark' | 'high-contrast'

export interface ThemeContextValue {
  theme: ThemeName
  resolvedTheme: ResolvedTheme
  isDark: boolean
  isHighContrast: boolean
  isReady: boolean
  setTheme: (theme: ThemeName) => void
  toggleTheme: () => void
}

// Single source of truth for theme state across the app. Config modules
// (e.g. config.ts / config/app.ts) must not carry theme values; consumers
// should read theme state exclusively through `useTheme()`.
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function resolveTheme(
  theme: ThemeName | undefined,
  resolvedTheme: string | undefined
): ResolvedTheme {
  if (resolvedTheme === 'dark') return 'dark'
  if (resolvedTheme === 'high-contrast' || theme === 'high-contrast') return 'high-contrast'
  return 'light'
}

/**
 * Token-based CSS custom properties for each theme.
 * These are applied to the document root so components can consume tokens
 * (e.g. `var(--color-bg)`) instead of hard-coded color values.
 */
export const themeTokens: Record<ResolvedTheme, Record<string, string>> = {
  light: {
    '--color-bg': 'var(--token-color-bg-light)',
    '--color-surface': 'var(--token-color-surface-light)',
    '--color-text': 'var(--token-color-text-light)',
    '--color-text-muted': 'var(--token-color-text-muted-light)',
    '--color-border': 'var(--token-color-border-light)',
    '--color-primary': 'var(--token-color-primary)',
    '--color-primary-contrast': 'var(--token-color-primary-contrast)',
    '--color-danger': 'var(--token-color-danger)',
    '--color-success': 'var(--token-color-success)',
    '--color-warning': 'var(--token-color-warning)'
  },
  dark: {
    '--color-bg': 'var(--token-color-bg-dark)',
    '--color-surface': 'var(--token-color-surface-dark)',
    '--color-text': 'var(--token-color-text-dark)',
    '--color-text-muted': 'var(--token-color-text-muted-dark)',
    '--color-border': 'var(--token-color-border-dark)',
    '--color-primary': 'var(--token-color-primary)',
    '--color-primary-contrast': 'var(--token-color-primary-contrast)',
    '--color-danger': 'var(--token-color-danger)',
    '--color-success': 'var(--token-color-success)',
    '--color-warning': 'var(--token-color-warning)'
  },
  'high-contrast': {
    '--color-bg': 'var(--token-color-bg-high-contrast)',
    '--color-surface': 'var(--token-color-surface-high-contrast)',
    '--color-text': 'var(--token-color-text-high-contrast)',
    '--color-text-muted': 'var(--token-color-text-muted-high-contrast)',
    '--color-border': 'var(--token-color-border-high-contrast)',
    '--color-primary': 'var(--token-color-primary)',
    '--color-primary-contrast': 'var(--token-color-primary-contrast)',
    '--color-danger': 'var(--token-color-danger)',
    '--color-success': 'var(--token-color-success)',
    '--color-warning': 'var(--token-color-warning)'
  }
}

function applyThemeTokens(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const tokens = themeTokens[resolved]
  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value)
  }
}

function ThemeContextBridge({ children }: { children: ReactNode }) {
  const { theme, resolvedTheme, setTheme } = useNextTheme()

  const currentTheme: ThemeName =
    theme === 'light' || theme === 'dark' || theme === 'system' || theme === 'high-contrast'
      ? theme
      : 'system'
  const currentResolvedTheme = resolveTheme(currentTheme, resolvedTheme)
  const isDark = currentResolvedTheme === 'dark'
  const isHighContrast = currentResolvedTheme === 'high-contrast'

  // Apply token-based CSS variables whenever the resolved theme changes
  useEffect(() => {
    applyThemeTokens(currentResolvedTheme)
  }, [currentResolvedTheme])

  // Add theme-ready class after mount so transitions don't fire on initial paint
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      document.documentElement.classList.add('theme-ready')
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: currentTheme,
      resolvedTheme: currentResolvedTheme,
      isDark,
      isHighContrast,
      isReady: theme !== undefined || resolvedTheme !== undefined,
      setTheme: (nextTheme) => setTheme(nextTheme),
      toggleTheme: () => setTheme(currentResolvedTheme === 'dark' ? 'light' : 'dark')
    }),
    [currentResolvedTheme, currentTheme, isDark, isHighContrast, resolvedTheme, setTheme, theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="scavngr-theme"
      // transitions are handled via CSS + theme-ready class instead
      {...props}
    >
      <ThemeContextBridge>{children}</ThemeContextBridge>
    </NextThemesProvider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider.')
  }

  return context
}
