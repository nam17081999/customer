import { describe, expect, it, vi } from 'vitest'
import { addMapEventListener, toLatLng } from '@/helper/mapHelpers'

describe('toLatLng', () => {
  it('trả về { lat, lng } khi lat/lng hợp lệ', () => {
    const result = toLatLng({ latitude: '21.028511', longitude: '105.804817' })
    expect(result).toEqual({ lat: 21.028511, lng: 105.804817 })
  })

  it('trả về null khi lat hoặc lng undefined', () => {
    expect(toLatLng({})).toBeNull()
  })

  it('trả về null khi lat hoặc lng null', () => {
    expect(toLatLng({ latitude: null, longitude: null })).toBeNull()
  })

  it('trả về null khi lat hoặc lng NaN', () => {
    expect(toLatLng({ latitude: 'abc', longitude: 'def' })).toBeNull()
  })

  it('tự động swap nếu lat và lng bị ngược', () => {
    const result = toLatLng({ latitude: '105.804817', longitude: '21.028511' })
    expect(result).toEqual({ lat: 21.028511, lng: 105.804817 })
  })

  it('trả về null khi lat ngoài [-90,90] kể cả sau swap', () => {
    expect(toLatLng({ latitude: '200', longitude: '105' })).toBeNull()
  })
})

describe('addMapEventListener', () => {
  it('trả về hàm cleanup cho event với layer', () => {
    const off = vi.fn()
    const on = vi.fn(() => off)
    const getLayer = vi.fn(() => true)
    const map = { on, off, getLayer }

    const cleanup = addMapEventListener(map, 'click', 'layer-id', vi.fn())
    expect(on).toHaveBeenCalledWith('click', 'layer-id', expect.any(Function))
    expect(typeof cleanup).toBe('function')

    cleanup()
    expect(off).toHaveBeenCalled()
  })

  it('trả về hàm cleanup cho event không có layer', () => {
    const off = vi.fn()
    const on = vi.fn(() => off)
    const map = { on, off }

    const cleanup = addMapEventListener(map, 'load', vi.fn())
    expect(on).toHaveBeenCalledWith('load', expect.any(Function))
    expect(typeof cleanup).toBe('function')

    cleanup()
    expect(off).toHaveBeenCalled()
  })

  it('không gọi off nếu layer không tồn tại khi cleanup', () => {
    const off = vi.fn()
    const on = vi.fn(() => off)
    const getLayer = vi.fn(() => false)
    const map = { on, off, getLayer }

    const cleanup = addMapEventListener(map, 'click', 'missing-layer', vi.fn())
    cleanup()
    expect(off).not.toHaveBeenCalled()
  })
})
