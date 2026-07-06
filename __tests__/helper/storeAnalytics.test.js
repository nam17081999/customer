import { describe, expect, it } from 'vitest'
import { formatDateTime, formatOrderTime, hasValidCoordinates } from '@/helper/storeAnalytics'

describe('formatDateTime', () => {
  it('trả về fallback khi value null', () => {
    expect(formatDateTime(null)).toBe('Chưa có dữ liệu')
  })

  it('trả về fallback khi value undefined', () => {
    expect(formatDateTime(undefined)).toBe('Chưa có dữ liệu')
  })

  it('trả về fallback khi value rỗng', () => {
    expect(formatDateTime('')).toBe('Chưa có dữ liệu')
  })

  it('trả về fallback khi value không phải date hợp lệ', () => {
    expect(formatDateTime('not-a-date')).toBe('Chưa có dữ liệu')
  })

  it('format date hợp lệ theo locale vi-VN', () => {
    const result = formatDateTime('2026-07-01T14:30:00Z')
    expect(result).toContain('30')
    expect(result).toContain('2026')
    expect(result).toContain('7')
  })
})

describe('formatOrderTime', () => {
  it('trả về rỗng khi value null', () => {
    expect(formatOrderTime(null)).toBe('')
  })

  it('trả về rỗng khi value rỗng', () => {
    expect(formatOrderTime('')).toBe('')
  })
})

describe('hasValidCoordinates', () => {
  it('trả về true khi lat/lng hợp lệ', () => {
    expect(hasValidCoordinates({ latitude: 21.028511, longitude: 105.804817 })).toBe(true)
  })

  it('trả về true khi lat/lng là null (Number(null) thành 0, nằm trong range)', () => {
    expect(hasValidCoordinates({ latitude: null, longitude: null })).toBe(true)
  })

  it('trả về false khi lat/lng là undefined', () => {
    expect(hasValidCoordinates({})).toBe(false)
  })

  it('trả về false khi lat ngoài khoảng [-90, 90]', () => {
    expect(hasValidCoordinates({ latitude: 100, longitude: 105 })).toBe(false)
  })

  it('trả về false khi lng ngoài khoảng [-180, 180]', () => {
    expect(hasValidCoordinates({ latitude: 21, longitude: 200 })).toBe(false)
  })
})
