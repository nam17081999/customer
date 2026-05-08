import { describe, expect, it } from 'vitest'

import {
  buildReportLocationPatch,
  buildStoreFormLocationPatch,
  shouldAutoAcquireLocationOnStepEnter,
} from '@/helper/locationOrchestration'

describe('buildStoreFormLocationPatch', () => {
  it('build patch chuẩn cho GPS refresh/bootstrap của create/edit', () => {
    expect(buildStoreFormLocationPatch({
      lat: 21.028511,
      lng: 105.804817,
      userHasEditedMap: false,
    })).toEqual({
      geoBlocked: false,
      initialGPSLat: 21.028511,
      initialGPSLng: 105.804817,
      pickedLat: 21.028511,
      pickedLng: 105.804817,
      userHasEditedMap: false,
    })
  })

  it('cho phép maps-link/manual pick đánh dấu userHasEditedMap', () => {
    expect(buildStoreFormLocationPatch({
      lat: 21.1,
      lng: 105.9,
      userHasEditedMap: true,
    }).userHasEditedMap).toBe(true)
  })
})

describe('buildReportLocationPatch', () => {
  it('build patch chuẩn cho report location state', () => {
    expect(buildReportLocationPatch({ lat: 21.028511, lng: 105.804817 })).toEqual({
      reportLat: 21.028511,
      reportLng: 105.804817,
    })
  })
})

describe('shouldAutoAcquireLocationOnStepEnter', () => {
  it('không auto acquire nếu đã có tọa độ data hợp lệ', () => {
    expect(shouldAutoAcquireLocationOnStepEnter({ lat: 21.0285, lng: 105.8048 })).toBe(false)
  })

  it('auto acquire nếu chưa có tọa độ hợp lệ', () => {
    expect(shouldAutoAcquireLocationOnStepEnter({ lat: null, lng: null })).toBe(true)
    expect(shouldAutoAcquireLocationOnStepEnter({ lat: Number.NaN, lng: 105.8 })).toBe(true)
  })
})
