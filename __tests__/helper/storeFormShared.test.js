import { describe, expect, it } from 'vitest'

import {
  buildDuplicatePhoneMessage,
  extractCoordsFromMapsUrl,
  getStoreFormFinalCoordinates,
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

  it('trả về null khi không có tọa độ hợp lệ', () => {
    expect(extractCoordsFromMapsUrl('https://maps.google.com/?q=999,999')).toBeNull()
    expect(extractCoordsFromMapsUrl('https://example.com')).toBeNull()
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
