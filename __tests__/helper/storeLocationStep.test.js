import { describe, expect, it } from 'vitest'

import { buildLocationStepResetPatch, hasLocationCoordinates } from '@/helper/storeLocationStep'

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
})
