import { describe, expect, it } from 'vitest'

import {
  buildUserCameraPayload,
  hasValidUserLocation,
  normalizeHeading,
  resolveCurrentHeading,
  shouldBuildRouteOnFollowStart,
  shortestHeadingDelta,
  smoothHeading,
} from '@/helper/mapNavigation'

describe('mapNavigation helpers', () => {
  it('chuẩn hóa heading về khoảng 0-360', () => {
    expect(normalizeHeading(370)).toBe(10)
    expect(normalizeHeading(-15)).toBe(345)
    expect(normalizeHeading(Number.NaN)).toBeNull()
  })

  it('tính delta heading ngắn nhất đúng chiều quay', () => {
    expect(shortestHeadingDelta(350, 10)).toBe(20)
    expect(shortestHeadingDelta(10, 350)).toBe(-20)
  })

  it('smooth heading bỏ qua jitter nhỏ và làm mượt khi lệch lớn', () => {
    expect(smoothHeading(90, 94)).toBe(90)
    expect(smoothHeading(90, 120)).toBeCloseTo(96.6, 5)
    expect(smoothHeading(null, 120)).toBe(120)
  })

  it('resolveCurrentHeading ưu tiên heading mới rồi làm mượt từ heading cũ', () => {
    expect(resolveCurrentHeading({
      permissionHeading: 120,
      locationHeading: 60,
      previousHeading: 90,
    })).toBeCloseTo(96.6, 5)

    expect(resolveCurrentHeading({
      permissionHeading: null,
      locationHeading: 45,
      previousHeading: null,
    })).toBe(45)

    expect(resolveCurrentHeading({
      permissionHeading: null,
      locationHeading: null,
      previousHeading: null,
    })).toBeNull()
  })

  it('nhận diện vị trí người dùng hợp lệ và tạo payload camera đúng', () => {
    expect(hasValidUserLocation({ latitude: 21.02851, longitude: 105.80482 })).toBe(true)
    expect(hasValidUserLocation({ latitude: null, longitude: 105.80482 })).toBe(false)

    expect(buildUserCameraPayload({
      latitude: 21.02851,
      longitude: 105.80482,
      heading: 42,
    })).toEqual({
      center: [105.80482, 21.02851],
      bearing: 42,
      duration: 900,
      essential: true,
    })

    expect(buildUserCameraPayload({
      latitude: 21.02851,
      longitude: 105.80482,
      heading: null,
    })).toEqual({
      center: [105.80482, 21.02851],
      duration: 900,
      essential: true,
    })
  })

  it('chỉ build route khi có điểm dừng nhưng chưa có geometry', () => {
    expect(shouldBuildRouteOnFollowStart({ routeStopsLength: 1, routeFeatureCount: 0 })).toBe(true)
    expect(shouldBuildRouteOnFollowStart({ routeStopsLength: 1, routeFeatureCount: 1 })).toBe(false)
    expect(shouldBuildRouteOnFollowStart({ routeStopsLength: 0, routeFeatureCount: 0 })).toBe(false)
  })
})
