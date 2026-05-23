import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  getThemeInitScript,
  getThemeMeta,
  normalizeTheme,
} from '@/helper/theme'

describe('theme helpers', () => {
  it('chuẩn hóa theme và mặc định là giao diện tối', () => {
    expect(DEFAULT_THEME).toBe('dark')
    expect(normalizeTheme('light')).toBe('light')
    expect(normalizeTheme('dark')).toBe('dark')
    expect(normalizeTheme('unknown')).toBe('dark')
    expect(normalizeTheme(null)).toBe('dark')
  })

  it('trả metadata màu cho dark/light', () => {
    expect(getThemeMeta('dark')).toMatchObject({
      label: 'Tối',
      themeColor: '#000000',
    })
    expect(getThemeMeta('light')).toMatchObject({
      label: 'Sáng',
      themeColor: '#f6f7fb',
    })
  })

  it('script khởi tạo theme đọc đúng localStorage key và set data-theme', () => {
    const script = getThemeInitScript()
    expect(script).toContain(THEME_STORAGE_KEY)
    expect(script).toContain('data-theme')
    expect(script).toContain('colorScheme')
  })
})
