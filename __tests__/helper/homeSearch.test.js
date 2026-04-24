import { describe, expect, it } from 'vitest'

import { buildStoreSearchIndex } from '@/helper/storeSearch'
import {
  FILTER_FLAG_HAS_IMAGE,
  FILTER_FLAG_HAS_PHONE,
  FILTER_FLAG_NO_LOCATION,
  FILTER_FLAG_POTENTIAL,
  buildSearchRouteQuery,
  buildSearchStateFromRouteQuery,
  countActiveFilters,
  filterAndSortSearchResults,
  hasActiveSearchCriteria,
  hasStoreCoordinates,
  parseQueryList,
  serializeRouteQuery,
} from '@/helper/homeSearch'

function makeStore(overrides = {}) {
  return {
    id: 1,
    name: 'Tạp Hóa Minh Anh',
    district: 'Hoài Đức',
    ward: 'An Khánh',
    phone: '0901234567',
    image_url: 'abc.jpg',
    latitude: 21.0,
    longitude: 105.8,
    active: true,
    created_at: '2026-04-01T00:00:00.000Z',
    store_type: 'Tạp hóa',
    is_potential: false,
    ...overrides,
  }
}

describe('parseQueryList', () => {
  it('tách chuỗi csv, trim và unique', () => {
    expect(parseQueryList('a, b,a,,c')).toEqual(['a', 'b', 'c'])
  })

  it('hỗ trợ array query values', () => {
    expect(parseQueryList(['a,b', 'c'])).toEqual(['a', 'b', 'c'])
  })
})

describe('route query helpers', () => {
  it('buildSearchRouteQuery chỉ giữ field có giá trị', () => {
    expect(buildSearchRouteQuery({
      searchTerm: '  minh anh  ',
      selectedDistrict: 'Hoài Đức',
      selectedWard: '',
      selectedStoreTypes: ['Tạp hóa'],
      selectedDetailFlags: [],
    })).toEqual({
      q: 'minh anh',
      district: 'Hoài Đức',
      types: 'Tạp hóa',
    })
  })

  it('serializeRouteQuery ổn định thứ tự key', () => {
    const left = serializeRouteQuery({ ward: 'A', q: 'x' })
    const right = serializeRouteQuery({ q: 'x', ward: 'A' })
    expect(left).toBe(right)
  })

  it('buildSearchStateFromRouteQuery khôi phục state từ query', () => {
    expect(buildSearchStateFromRouteQuery({
      q: 'minh anh',
      district: 'Hoài Đức',
      types: 'Tạp hóa,Quán ăn',
      flags: 'has_phone,is_potential',
    })).toEqual({
      searchTerm: 'minh anh',
      selectedDistrict: 'Hoài Đức',
      selectedWard: '',
      selectedStoreTypes: ['Tạp hóa', 'Quán ăn'],
      selectedDetailFlags: ['has_phone', 'is_potential'],
      showDetailedFilters: true,
    })
  })
})

describe('criteria helpers', () => {
  it('hasActiveSearchCriteria nhận ra khi có text hoặc filter', () => {
    expect(hasActiveSearchCriteria({
      searchTerm: 'minh',
      selectedDistrict: '',
      selectedWard: '',
      selectedStoreTypes: [],
      selectedDetailFlags: [],
    })).toBe(true)
    expect(hasActiveSearchCriteria({
      searchTerm: '',
      selectedDistrict: '',
      selectedWard: '',
      selectedStoreTypes: [],
      selectedDetailFlags: [],
    })).toBe(false)
  })

  it('countActiveFilters cộng đúng số filter đang bật', () => {
    expect(countActiveFilters({
      selectedDistrict: 'Hoài Đức',
      selectedWard: 'An Khánh',
      selectedStoreTypes: ['Tạp hóa', 'Quán ăn'],
      selectedDetailFlags: ['has_phone'],
    })).toBe(5)
  })
})

describe('hasStoreCoordinates', () => {
  it('trả về false cho null coordinates', () => {
    expect(hasStoreCoordinates(makeStore({ latitude: null, longitude: null }))).toBe(false)
  })
})

describe('filterAndSortSearchResults', () => {
  const stores = [
    makeStore({ id: 1, name: 'Tạp Hóa Minh Anh', created_at: '2026-04-01T00:00:00.000Z' }),
    makeStore({ id: 2, name: 'Quán Ăn Minh', ward: 'An Thượng', image_url: '', phone: '', active: false, created_at: '2026-04-03T00:00:00.000Z' }),
    makeStore({ id: 3, name: 'Cửa Hàng Giang', district: 'Quốc Oai', ward: 'Yên Sơn', latitude: null, longitude: null, is_potential: true, created_at: '2026-04-02T00:00:00.000Z' }),
  ]

  const indexedStores = buildStoreSearchIndex(stores, { getHasCoords: hasStoreCoordinates })

  it('lọc theo district/ward/store type/detail flags', () => {
    const results = filterAndSortSearchResults({
      indexedStores,
      searchTerm: '',
      selectedDistrict: 'Hoài Đức',
      selectedWard: 'An Khánh',
      selectedStoreTypes: ['Tạp hóa'],
      selectedDetailFlags: [FILTER_FLAG_HAS_PHONE, FILTER_FLAG_HAS_IMAGE],
      currentLocation: null,
    })

    expect(results.map((store) => store.id)).toEqual([1])
  })

  it('lọc đúng cờ không có vị trí và tiềm năng', () => {
    const results = filterAndSortSearchResults({
      indexedStores,
      searchTerm: '',
      selectedDistrict: '',
      selectedWard: '',
      selectedStoreTypes: [],
      selectedDetailFlags: [FILTER_FLAG_NO_LOCATION, FILTER_FLAG_POTENTIAL],
      currentLocation: null,
    })

    expect(results.map((store) => store.id)).toEqual([3])
  })

  it('ưu tiên score tìm kiếm rồi đến khoảng cách', () => {
    const results = filterAndSortSearchResults({
      indexedStores,
      searchTerm: 'minh anh',
      selectedDistrict: '',
      selectedWard: '',
      selectedStoreTypes: [],
      selectedDetailFlags: [],
      currentLocation: { latitude: 21.0, longitude: 105.8 },
    })

    expect(results[0].id).toBe(1)
    expect(results[0]._score).toBeGreaterThanOrEqual(results[1]?._score ?? -1)
  })

  it('hỗ trợ match qua phonetic search', () => {
    const results = filterAndSortSearchResults({
      indexedStores,
      searchTerm: 'dang',
      selectedDistrict: '',
      selectedWard: '',
      selectedStoreTypes: [],
      selectedDetailFlags: [],
      currentLocation: null,
    })

    expect(results.map((store) => store.id)).toContain(3)
  })
})
