import { describe, expect, it } from 'vitest'

import {
  buildLocationStepResetPatch,
  getCreateLocationStepView,
  getLocationStepView,
  hasLocationCoordinates,
} from '@/helper/storeLocationStep'

describe('hasLocationCoordinates', () => {
  it('trả về true khi cả lat/lng đều hợp lệ', () => {
    expect(hasLocationCoordinates(21.0285, 105.8048)).toBe(true)
  })

  it('trả về false khi thiếu hoặc không hợp lệ', () => {
    expect(hasLocationCoordinates(null, 105.8048)).toBe(false)
    expect(hasLocationCoordinates(21.0285, undefined)).toBe(false)
    expect(hasLocationCoordinates(Number.NaN, 105.8048)).toBe(false)
  })
})

describe('buildLocationStepResetPatch', () => {
  it('reset state giống bootstrap step 3 create/edit và tăng step2Key', () => {
    expect(buildLocationStepResetPatch(4)).toEqual({
      geoBlocked: false,
      mapEditable: false,
      userHasEditedMap: false,
      pickedLat: null,
      pickedLng: null,
      initialGPSLat: null,
      initialGPSLng: null,
      heading: null,
      nextStep2Key: 5,
    })
  })

  it('mặc định tăng từ 0 khi không truyền step2Key', () => {
    expect(buildLocationStepResetPatch().nextStep2Key).toBe(1)
  })

  it('giữ tọa độ hợp lệ khi quay lại bước vị trí để map không bị ẩn', () => {
    expect(buildLocationStepResetPatch(2, {
      pickedLat: 21.028511,
      pickedLng: 105.804817,
      initialGPSLat: 21.0285,
      initialGPSLng: 105.8048,
      userHasEditedMap: true,
    })).toEqual({
      geoBlocked: false,
      mapEditable: false,
      userHasEditedMap: true,
      pickedLat: 21.028511,
      pickedLng: 105.804817,
      initialGPSLat: 21.0285,
      initialGPSLng: 105.8048,
      heading: null,
      nextStep2Key: 3,
    })
  })
})

describe('getLocationStepView', () => {
  it('ẩn map mặc định khi đang bootstrap GPS nhưng chưa có tọa độ', () => {
    expect(getLocationStepView({
      resolving: true,
      lat: null,
      lng: null,
      blocked: false,
    })).toEqual({
      hasCoordinates: false,
      phase: 'bootstrapping',
      shouldRenderMap: false,
      shouldShowPlaceholder: true,
    })
  })

  it('render map khi đã có tọa độ thật dù resolving vừa kết thúc hoặc còn state phụ', () => {
    expect(getLocationStepView({
      resolving: false,
      lat: 21.028511,
      lng: 105.804817,
      blocked: false,
    })).toEqual({
      hasCoordinates: true,
      phase: 'ready',
      shouldRenderMap: true,
      shouldShowPlaceholder: false,
    })

    expect(getLocationStepView({
      resolving: true,
      lat: 21.028511,
      lng: 105.804817,
      blocked: false,
    }).shouldRenderMap).toBe(true)
  })

  it('vẫn render map khi flow bị chặn quyền để giữ overlay/các nút fallback hiện có', () => {
    expect(getLocationStepView({
      resolving: false,
      lat: null,
      lng: null,
      blocked: true,
    })).toEqual({
      hasCoordinates: false,
      phase: 'blocked',
      shouldRenderMap: true,
      shouldShowPlaceholder: false,
    })
  })

  it('không render map default sau bootstrap nếu vẫn chưa có tọa độ và chưa blocked', () => {
    expect(getLocationStepView({
      resolving: false,
      lat: null,
      lng: null,
      blocked: false,
    })).toEqual({
      hasCoordinates: false,
      phase: 'awaiting_input',
      shouldRenderMap: false,
      shouldShowPlaceholder: true,
    })
  })

  it('coi tọa độ không hợp lệ như chưa có tọa độ để chặn default center', () => {
    expect(getLocationStepView({
      resolving: true,
      lat: Number.NaN,
      lng: 105.804817,
      blocked: false,
    }).phase).toBe('bootstrapping')
  })

  it('hỗ trợ report flow khi chưa blocked state riêng nhưng vẫn cần placeholder', () => {
    expect(getLocationStepView({
      resolving: false,
      lat: null,
      lng: null,
    })).toEqual({
      hasCoordinates: false,
      phase: 'awaiting_input',
      shouldRenderMap: false,
      shouldShowPlaceholder: true,
    })
  })
})

describe('getCreateLocationStepView', () => {
  it('giữ compatibility bằng cách map state create sang helper chung', () => {
    expect(getCreateLocationStepView({
      resolvingAddr: true,
      pickedLat: null,
      pickedLng: null,
      geoBlocked: false,
    })).toEqual(getLocationStepView({
      resolving: true,
      lat: null,
      lng: null,
      blocked: false,
    }))
  })
})
