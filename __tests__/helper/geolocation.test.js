import { describe, expect, it } from 'vitest'

import {
  classifyGeolocationSample,
  selectGeolocationFinishResult,
  shouldFinishGeolocationEarly,
} from '@/helper/geolocation'
import {
  getLocationBootstrapOptions,
  getLocationDuplicateCheckOptions,
  getLocationFallbackSubmitOptions,
  getLocationRefreshOptions,
} from '@/helper/locationPolicy'

describe('classifyGeolocationSample', () => {
  it('coi mẫu gần anchor là trusted', () => {
    expect(classifyGeolocationSample({
      anchorCoords: { latitude: 21.0285, longitude: 105.8048 },
      candidate: { latitude: 21.0287, longitude: 105.8049, accuracy: 20 },
    }).isSuspicious).toBe(false)
  })

  it('coi mẫu nhảy xa anchor là suspicious', () => {
    expect(classifyGeolocationSample({
      anchorCoords: { latitude: 21.0285, longitude: 105.8048 },
      candidate: { latitude: 21.0885, longitude: 105.8648, accuracy: 20 },
    }).isSuspicious).toBe(true)
  })
})

describe('shouldFinishGeolocationEarly', () => {
  it('cho finish sớm với trusted fix tốt', () => {
    expect(shouldFinishGeolocationEarly({
      desiredAccuracy: 30,
      trustedFixCount: 1,
      suspiciousFixCount: 0,
      bestTrusted: { accuracy: 18 },
      bestSuspicious: null,
    })).toBe(true)
  })

  it('không finish sớm với suspicious fix đầu tiên dù accuracy tốt', () => {
    expect(shouldFinishGeolocationEarly({
      desiredAccuracy: 30,
      trustedFixCount: 0,
      suspiciousFixCount: 1,
      bestTrusted: null,
      bestSuspicious: { accuracy: 12 },
    })).toBe(false)
  })

  it('cho finish khi suspicious fix tốt lặp lại đủ 2 lần', () => {
    expect(shouldFinishGeolocationEarly({
      desiredAccuracy: 30,
      trustedFixCount: 0,
      suspiciousFixCount: 2,
      bestTrusted: null,
      bestSuspicious: { accuracy: 12 },
    })).toBe(true)
  })
})

describe('selectGeolocationFinishResult', () => {
  it('ưu tiên trusted result thay vì suspicious jump', () => {
    expect(selectGeolocationFinishResult({
      bestTrusted: { latitude: 21.0285, longitude: 105.8048, accuracy: 28 },
      bestSuspicious: { latitude: 21.0885, longitude: 105.8648, accuracy: 8 },
    })).toEqual({ latitude: 21.0285, longitude: 105.8048, accuracy: 28 })
  })

  it('fallback sang suspicious result khi không có trusted result', () => {
    expect(selectGeolocationFinishResult({
      bestTrusted: null,
      bestSuspicious: { latitude: 21.0885, longitude: 105.8648, accuracy: 8 },
    })).toEqual({ latitude: 21.0885, longitude: 105.8648, accuracy: 8 })
  })
})

describe('getLocationBootstrapOptions', () => {
  it('dùng chung policy bootstrap cho create và supplement/edit', () => {
    expect(getLocationBootstrapOptions()).toEqual({
      maxWaitTime: 1500,
      desiredAccuracy: 30,
    })
  })
})

describe('getLocationRefreshOptions', () => {
  it('dùng fresh read cho create/edit manual refresh', () => {
    expect(getLocationRefreshOptions()).toEqual({
      maxWaitTime: 2000,
      desiredAccuracy: 30,
      skipCache: true,
    })
  })

  it('cho phép report giữ desiredAccuracy chặt hơn khi refresh GPS', () => {
    expect(getLocationRefreshOptions({ profile: 'report' })).toEqual({
      maxWaitTime: 2000,
      desiredAccuracy: 15,
      skipCache: true,
    })
  })
})

describe('getLocationDuplicateCheckOptions', () => {
  it('giữ policy rộng hơn cho duplicate check theo vị trí gần đúng', () => {
    expect(getLocationDuplicateCheckOptions()).toEqual({
      maxWaitTime: 2000,
      desiredAccuracy: 50,
    })
  })
})

describe('getLocationFallbackSubmitOptions', () => {
  it('giữ fallback submit đủ nhanh nhưng không dùng cache override riêng', () => {
    expect(getLocationFallbackSubmitOptions()).toEqual({
      maxWaitTime: 2000,
      desiredAccuracy: 30,
    })
  })
})
