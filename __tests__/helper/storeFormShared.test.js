import { describe, expect, it, vi } from 'vitest'

import {
  buildDuplicatePhoneMessage,
  extractCoordsFromMapsUrl,
  getStoreFormFinalCoordinates,
  resolveMapsLinkCoordinates,
} from '@/helper/storeFormShared'

describe('extractCoordsFromMapsUrl', () => {
  it('đọc được tọa độ từ pattern @lat,lng', () => {
    expect(extractCoordsFromMapsUrl('https://maps.google.com/@21.02851,105.80482,17z')).toEqual({
      lat: 21.02851,
      lng: 105.80482,
    })
  })

  it('đọc được tọa độ từ q=lat,lng', () => {
    expect(extractCoordsFromMapsUrl('https://maps.google.com/?q=21.1,105.9')).toEqual({
      lat: 21.1,
      lng: 105.9,
    })
  })

  it('đọc được tọa độ search path từ Google Maps share redirect', () => {
    expect(extractCoordsFromMapsUrl('https://www.google.com/maps/search/21.069855,+105.707641?entry=tts')).toEqual({
      lat: 21.069855,
      lng: 105.707641,
    })
  })

  it('đọc được tọa độ query có dấu cộng trước longitude', () => {
    expect(extractCoordsFromMapsUrl('https://www.google.com/maps?q=21.069855,+105.707641')).toEqual({
      lat: 21.069855,
      lng: 105.707641,
    })
  })

  it('đọc được tọa độ query có encoded plus trước longitude', () => {
    expect(extractCoordsFromMapsUrl('https://www.google.com/maps?q=21.069855,%2B105.707641')).toEqual({
      lat: 21.069855,
      lng: 105.707641,
    })
  })

  it('đọc được tọa độ center URL-encoded trong share metadata', () => {
    expect(extractCoordsFromMapsUrl('https://maps.googleapis.com/maps/api/staticmap?center=21.02851%2C105.80482&zoom=17')).toEqual({
      lat: 21.02851,
      lng: 105.80482,
    })
  })

  it('ưu tiên tọa độ place !3d!4d thay vì tâm viewport @lat,lng', () => {
    expect(extractCoordsFromMapsUrl('https://www.google.com/maps/place/Cua+Hang/@21.00000,105.00000,17z/data=!4m6!3m5!1sabc!8m2!3d21.02851!4d105.80482')).toEqual({
      lat: 21.02851,
      lng: 105.80482,
    })
  })

  it('ưu tiên marker thay vì center trong static map metadata', () => {
    expect(extractCoordsFromMapsUrl('https://maps.googleapis.com/maps/api/staticmap?center=21.00000%2C105.00000&markers=21.02851%2C105.80482&zoom=17')).toEqual({
      lat: 21.02851,
      lng: 105.80482,
    })
  })

  it('đọc được marker có option style trong static map metadata', () => {
    expect(extractCoordsFromMapsUrl('https://maps.googleapis.com/maps/api/staticmap?center=21.00000%2C105.00000&markers=color:red%7C21.02851%2C105.80482&zoom=17')).toEqual({
      lat: 21.02851,
      lng: 105.80482,
    })
  })

  it('đọc được tọa độ khi HTML escape ampersand', () => {
    expect(extractCoordsFromMapsUrl('<meta content="https://maps.googleapis.com/maps/api/staticmap?size=600x315&amp;center=21.02851%2C105.80482&amp;zoom=17">')).toEqual({
      lat: 21.02851,
      lng: 105.80482,
    })
  })

  it('trả về null khi không có tọa độ hợp lệ', () => {
    expect(extractCoordsFromMapsUrl('https://maps.google.com/?q=999,999')).toBeNull()
    expect(extractCoordsFromMapsUrl('https://example.com')).toBeNull()
  })
})

describe('resolveMapsLinkCoordinates', () => {
  it('trả direct coords ngay khi link đã chứa tọa độ', async () => {
    const fetcher = vi.fn()
    await expect(resolveMapsLinkCoordinates('https://maps.google.com/?q=21.1,105.9', fetcher)).resolves.toEqual({
      coords: { lat: 21.1, lng: 105.9 },
      error: '',
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('expand short link qua fetcher rồi đọc tọa độ từ finalUrl', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        finalUrl: 'https://maps.google.com/@21.02851,105.80482,17z',
      }),
    })

    await expect(resolveMapsLinkCoordinates('https://maps.app.goo.gl/abc123', fetcher)).resolves.toEqual({
      coords: { lat: 21.02851, lng: 105.80482 },
      error: '',
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('ưu tiên coords do expand API parse từ Google Maps share page', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        finalUrl: 'https://www.google.com/maps/place/Cua+Hang+Minh+Anh',
        coords: { lat: 21.02851, lng: 105.80482 },
      }),
    })

    await expect(resolveMapsLinkCoordinates('https://maps.app.goo.gl/share123', fetcher)).resolves.toEqual({
      coords: { lat: 21.02851, lng: 105.80482 },
      error: '',
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('trả lỗi khi link không phải short-link và không có tọa độ', async () => {
    await expect(resolveMapsLinkCoordinates('https://example.com')).resolves.toEqual({
      coords: null,
      error: 'Không tìm thấy tọa độ trong link',
    })
  })

  it('trả lỗi khi expand được nhưng finalUrl vẫn không có tọa độ', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        finalUrl: 'https://maps.google.com/place/abc',
      }),
    })

    await expect(resolveMapsLinkCoordinates('https://maps.app.goo.gl/abc123', fetcher)).resolves.toEqual({
      coords: null,
      error: 'Không tìm thấy tọa độ từ link',
    })
  })

  it('trả lỗi khi expand API báo fail', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({ success: false, finalUrl: '' }),
    })

    await expect(resolveMapsLinkCoordinates('https://maps.app.goo.gl/abc123', fetcher)).resolves.toEqual({
      coords: null,
      error: 'Không mở được link',
    })
  })
})

describe('getStoreFormFinalCoordinates', () => {
  it('ưu tiên tọa độ map do người dùng chỉnh', () => {
    expect(getStoreFormFinalCoordinates({
      userHasEditedMap: true,
      pickedLat: 21.1,
      pickedLng: 105.9,
      initialGPSLat: 21.0,
      initialGPSLng: 105.8,
    })).toEqual({ latitude: 21.1, longitude: 105.9 })
  })

  it('fallback về GPS ban đầu khi chưa sửa map', () => {
    expect(getStoreFormFinalCoordinates({
      userHasEditedMap: false,
      pickedLat: 21.1,
      pickedLng: 105.9,
      initialGPSLat: 21.0,
      initialGPSLng: 105.8,
    })).toEqual({ latitude: 21.0, longitude: 105.8 })
  })

  it('trả về null/null khi chưa có tọa độ nào', () => {
    expect(getStoreFormFinalCoordinates({
      userHasEditedMap: false,
      pickedLat: null,
      pickedLng: null,
      initialGPSLat: null,
      initialGPSLng: null,
    })).toEqual({ latitude: null, longitude: null })
  })
})

describe('buildDuplicatePhoneMessage', () => {
  it('ghép tối đa 3 tên store vào thông báo', () => {
    expect(buildDuplicatePhoneMessage([
      { name: 'A' },
      { name: 'B' },
      { name: 'C' },
      { name: 'D' },
    ], 'Số điện thoại 1')).toBe('Số điện thoại 1 đã tồn tại ở A; B; C')
  })
})
