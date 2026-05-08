import { describe, expect, it } from 'vitest'

import {
  getLocationBootstrapOptions,
  getLocationDuplicateCheckOptions,
  getLocationFallbackSubmitOptions,
  getLocationRefreshOptions,
} from '@/helper/locationPolicy'

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
