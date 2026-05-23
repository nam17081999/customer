export const THEME_STORAGE_KEY = 'storevis:theme'
export const DEFAULT_THEME = 'dark'
export const THEME_OPTIONS = ['dark', 'light']

const THEME_META = {
  dark: {
    label: 'Tối',
    themeColor: '#000000',
  },
  light: {
    label: 'Sáng',
    themeColor: '#f6f7fb',
  },
}

export function normalizeTheme(value) {
  return THEME_OPTIONS.includes(value) ? value : DEFAULT_THEME
}

export function getThemeMeta(theme) {
  return THEME_META[normalizeTheme(theme)]
}

export function getThemeInitScript() {
  return `
    (function () {
      try {
        var key = '${THEME_STORAGE_KEY}';
        var saved = window.localStorage.getItem(key);
        var theme = saved === 'light' || saved === 'dark' ? saved : '${DEFAULT_THEME}';
        var root = document.documentElement;
        root.setAttribute('data-theme', theme);
        root.style.colorScheme = theme;
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'light' ? '${THEME_META.light.themeColor}' : '${THEME_META.dark.themeColor}');
      } catch (error) {}
    })();
  `
}
