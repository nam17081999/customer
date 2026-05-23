import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_THEME, THEME_STORAGE_KEY, getThemeMeta, normalizeTheme } from '@/helper/theme'

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  themeMeta: getThemeMeta(DEFAULT_THEME),
})

function applyTheme(theme) {
  if (typeof document === 'undefined') return
  const safeTheme = normalizeTheme(theme)
  document.documentElement.setAttribute('data-theme', safeTheme)
  document.documentElement.style.colorScheme = safeTheme
  const themeColor = document.querySelector('meta[name="theme-color"]')
  if (themeColor) themeColor.setAttribute('content', getThemeMeta(safeTheme).themeColor)
}

function readStoredTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return DEFAULT_THEME
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(DEFAULT_THEME)

  useEffect(() => {
    const storedTheme = readStoredTheme()
    setThemeState(storedTheme)
    applyTheme(storedTheme)
  }, [])

  const setTheme = (nextTheme) => {
    const safeTheme = normalizeTheme(nextTheme)
    setThemeState(safeTheme)
    applyTheme(safeTheme)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, safeTheme)
    } catch {
      // Theme still applies for this session when storage is unavailable.
    }
  }

  const value = useMemo(() => ({
    theme,
    setTheme,
    themeMeta: getThemeMeta(theme),
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
