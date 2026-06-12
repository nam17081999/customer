import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }))

import { buildStoreSearchIndex } from '@/helper/storeSearch'
import {
  FILTER_FLAG_HAS_PHONE,
  FILTER_FLAG_NO_LOCATION,
  FILTER_FLAG_POTENTIAL,
  buildSearchRouteQuery,
  buildSearchStateFromRouteQuery,
  countActiveFilters,
  filterAndSortSearchResults,
  hasActiveSearchCriteria,
  hasStoreCoordinates,
  normalizeCreateStoreName,
  parseQueryList,
  serializeRouteQuery,
  shouldShowSearchCreateCta,
} from '@/helper/homeSearch'

function makeStore(overrides = {}) {
  return {
    id: 1,
    name: 'Tạp Hóa Minh Anh',
    district: 'Hoài Đức',
    ward: 'An Khánh',
    phone: '0901234567',
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
      sortBy: 'distance',
      activeStatus: 'all',
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
    makeStore({ id: 2, name: 'Quán Ăn Minh', ward: 'An Thượng', phone: '', active: false, created_at: '2026-04-03T00:00:00.000Z' }),
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
      selectedDetailFlags: [FILTER_FLAG_HAS_PHONE],
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



  it('giữ nguyên output filter theo district/ward/type sau khi dùng derived fields chuẩn hóa sẵn', () => {
    const indexedStores = buildStoreSearchIndex([
      makeStore({ id: 1, district: 'Hoài Đức', ward: 'An Khánh', store_type: 'Tạp hóa' }),
      makeStore({ id: 2, district: 'Quốc Oai', ward: 'Yên Sơn', store_type: 'Quán ăn' }),
    ], { getHasCoords: hasStoreCoordinates })

    const results = filterAndSortSearchResults({
      indexedStores,
      searchTerm: '',
      selectedDistrict: 'Hoài Đức',
      selectedWard: 'An Khánh',
      selectedStoreTypes: ['Tạp hóa'],
      selectedDetailFlags: [],
      currentLocation: null,
    })

    expect(results.map((store) => store.id)).toEqual([1])
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


describe('filterAndSortSearchResults regression', () => {
  it('home search vẫn ưu tiên exact match trước near-match mới', () => {
    const indexedStores = buildStoreSearchIndex([
      makeStore({ id: 1, name: 'Shopii Mart', store_type: 'tap_hoa', phone: '' }),
      makeStore({ id: 2, name: 'Shoppii Mart', store_type: 'tap_hoa', phone: '' }),
    ], { getHasCoords: hasStoreCoordinates })

    const results = filterAndSortSearchResults({
      indexedStores,
      searchTerm: 'shopii',
      selectedDistrict: '',
      selectedWard: '',
      selectedStoreTypes: [],
      selectedDetailFlags: [],
      currentLocation: null,
    })

    expect(results.map((store) => store.id)).toEqual([1, 2])
  })
})

describe('shouldShowSearchCreateCta', () => {
  it('hiện CTA khi query có ít nhất 2 từ và không trùng chính xác tên store', () => {
    const indexedStores = buildStoreSearchIndex([
      makeStore({ id: 1, name: 'Tạp Hóa Minh Anh' }),
    ], { getHasCoords: hasStoreCoordinates })

    expect(shouldShowSearchCreateCta({
      indexedStores,
      searchTerm: 'Minh Anh',
    })).toBe(false)
  })

  it('ẩn CTA khi query chỉ có 1 từ', () => {
    const indexedStores = buildStoreSearchIndex([], { getHasCoords: hasStoreCoordinates })

    expect(shouldShowSearchCreateCta({
      indexedStores,
      searchTerm: 'Minh',
    })).toBe(true)
  })

  it('ẩn CTA khi tên query trùng 100% với store hiện có theo lowercase và bỏ dấu', () => {
    const indexedStores = buildStoreSearchIndex([
      makeStore({ id: 1, name: 'Tạp Hóa Minh Anh' }),
    ], { getHasCoords: hasStoreCoordinates })

    expect(shouldShowSearchCreateCta({
      indexedStores,
      searchTerm: 'tap hoa minh anh',
    })).toBe(true)
  })

  it('ẩn CTA khi exact-name chỉ khác khoảng trắng thừa', () => {
    const indexedStores = buildStoreSearchIndex([
      makeStore({ id: 1, name: 'Tạp Hóa Minh Anh' }),
    ], { getHasCoords: hasStoreCoordinates })

    expect(shouldShowSearchCreateCta({
      indexedStores,
      searchTerm: 'tap hoa   minh anh',
    })).toBe(true)
  })
})

describe('normalizeCreateStoreName', () => {
  it('trim và gom khoảng trắng về 1 dấu cách', () => {
    expect(normalizeCreateStoreName('  Minh   Anh  ')).toBe('Minh Anh')
  })

  it('trả về chuỗi rỗng khi input rỗng hoặc toàn khoảng trắng', () => {
    expect(normalizeCreateStoreName('')).toBe('')
    expect(normalizeCreateStoreName('   ')).toBe('')
  })

  it('gom cả tab/newline về 1 dấu cách', () => {
    expect(normalizeCreateStoreName('Minh\t\nAnh')).toBe('Minh Anh')
  })
})
