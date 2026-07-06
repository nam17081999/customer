import { describe, expect, it } from 'vitest'
import { formatCountdown, RESEND_COOLDOWN_SECONDS } from '@/helper/magicLinkResend'

describe('RESEND_COOLDOWN_SECONDS', () => {
  it('là 60 giây', () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(60)
  })
})

describe('formatCountdown', () => {
  it('trả về định dạng giây cho dưới 60s', () => {
    expect(formatCountdown(59)).toBe('59s')
    expect(formatCountdown(1)).toBe('1s')
    expect(formatCountdown(30)).toBe('30s')
  })

  it('trả về định dạng m:ss cho trên 60s', () => {
    expect(formatCountdown(60)).toBe('1:00')
    expect(formatCountdown(90)).toBe('1:30')
    expect(formatCountdown(120)).toBe('2:00')
  })

  it('trả về rỗng khi seconds <= 0', () => {
    expect(formatCountdown(0)).toBe('')
    expect(formatCountdown(-1)).toBe('')
  })

  it('trả về rỗng khi seconds không phải số', () => {
    expect(formatCountdown(null)).toBe('')
    expect(formatCountdown(undefined)).toBe('')
    expect(formatCountdown('60')).toBe('')
  })
})
