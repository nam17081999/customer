import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }))

import {
  buildCurrentSearchRouteQuery,
  buildNextSearchRouteQuery,
  buildPersistedSearchHref,
  scheduleSearchRouteSync,
  SEARCH_ROUTE_SYNC_DEBOUNCE_MS,
  shouldSyncSearchRoute,
} from '@/helper/homeSearchRouteSync'

describe('buildPersistedSearchHref', () => {
  it('trả về / khi query rỗng', () => {
    expect(buildPersistedSearchHref({})).toBe('/')
  })

  it('tạo href từ query search hiện tại', () => {
    expect(buildPersistedSearchHref({ q: 'minh anh', district: 'Hoài Đức' }))
      .toBe('/?q=minh+anh&district=Ho%C3%A0i+%C4%90%E1%BB%A9c')
  })
})

describe('buildCurrentSearchRouteQuery', () => {
  it('chuẩn hóa router query về cùng shape search route', () => {
    expect(buildCurrentSearchRouteQuery({
      q: 'minh anh',
      district: 'Hoài Đức',
      ward: 'An Khánh',
      types: 'Tạp hóa,Quán ăn',
      flags: 'has_phone,is_potential',
    })).toEqual({
      q: 'minh anh',
      district: 'Hoài Đức',
      ward: 'An Khánh',
      types: 'Tạp hóa,Quán ăn',
      flags: 'has_phone,is_potential',
    })
  })
})

describe('search route sync decision', () => {
  it('không sync khi route query hiện tại và state mới là tương đương', () => {
    const nextQuery = buildNextSearchRouteQuery({
      searchTerm: 'minh anh',
      selectedDistrict: 'Hoài Đức',
      selectedWard: '',
      selectedStoreTypes: ['Tạp hóa'],
      selectedDetailFlags: ['has_phone'],
    })

    const currentQuery = buildCurrentSearchRouteQuery({
      q: 'minh anh',
      district: 'Hoài Đức',
      types: 'Tạp hóa',
      flags: 'has_phone',
    })

    expect(shouldSyncSearchRoute(nextQuery, currentQuery)).toBe(false)
  })

  it('sync khi search state đổi thật sự', () => {
    const nextQuery = buildNextSearchRouteQuery({
      searchTerm: 'minh anh',
      selectedDistrict: 'Hoài Đức',
      selectedWard: '',
      selectedStoreTypes: ['Tạp hóa'],
      selectedDetailFlags: ['has_phone'],
    })

    const currentQuery = buildCurrentSearchRouteQuery({
      q: 'minh',
      district: 'Hoài Đức',
      types: 'Tạp hóa',
      flags: 'has_phone',
    })

    expect(shouldSyncSearchRoute(nextQuery, currentQuery)).toBe(true)
  })
})

describe('scheduleSearchRouteSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounce rồi mới gọi replace và persist đúng 1 lần', () => {
    const replace = vi.fn()
    const persist = vi.fn()
    const setTimer = (cb, ms) => setTimeout(cb, ms)

    scheduleSearchRouteSync({
      nextQuery: { q: 'minh anh' },
      pathname: '/',
      replace,
      persist,
      setTimer,
    })

    vi.advanceTimersByTime(SEARCH_ROUTE_SYNC_DEBOUNCE_MS - 1)
    expect(replace).not.toHaveBeenCalled()
    expect(persist).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(persist).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith({ pathname: '/', query: { q: 'minh anh' } }, undefined, { shallow: true })
    expect(persist).toHaveBeenCalledWith({ q: 'minh anh' })
  })

  it('cleanup sẽ hủy sync đã lên lịch', () => {
    const replace = vi.fn()
    const persist = vi.fn()
    const setTimer = (cb, ms) => setTimeout(cb, ms)

    const cancel = scheduleSearchRouteSync({
      nextQuery: { q: 'minh anh' },
      pathname: '/',
      replace,
      persist,
      setTimer,
    })

    cancel()
    vi.runAllTimers()

    expect(replace).not.toHaveBeenCalled()
    expect(persist).not.toHaveBeenCalled()
  })
})
