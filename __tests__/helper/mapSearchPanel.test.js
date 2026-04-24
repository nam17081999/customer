import { describe, expect, it } from 'vitest'

import { buildStoreSearchIndex } from '@/helper/storeSearch'
import {
  buildMapAvailableWards,
  buildMapSearchSuggestions,
  buildMapStoreCounts,
  buildMapStoreTypeCounts,
  hasActiveMapFilters,
  toggleMapDistrictSelection,
  toggleMapMultiSelect,
} from '@/helper/mapSearchPanel'

function makeStore(overrides = {}) {
  return {
    id: 1,
    name: 'Tạp hóa Minh Anh',
    district: 'Hoài Đức',
    ward: 'An Khánh',
    store_type: 'tap_hoa',
    latitude: 21.02861,
    longitude: 105.80492,
    active: true,
    created_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildMapAvailableWards', () => {
  it('trả về danh sách xã/phường theo đúng các quận đã chọn', () => {
    const wards = buildMapAvailableWards(['Hoài Đức', 'Quốc Oai'])
    expect(wards).toContain('An Khánh')
    expect(wards).toContain('Yên Sơn')
  })

  it('trả về [] khi chưa chọn quận/huyện', () => {
    expect(buildMapAvailableWards([])).toEqual([])
  })
})

describe('buildMapStoreCounts', () => {
  it('đếm đúng số store theo quận và xã, bỏ qua giá trị rỗng', () => {
    const counts = buildMapStoreCounts([
      makeStore({ id: 1, district: 'Hoài Đức', ward: 'An Khánh' }),
      makeStore({ id: 2, district: 'Hoài Đức', ward: 'An Thượng' }),
      makeStore({ id: 3, district: 'Quốc Oai', ward: 'Yên Sơn' }),
      makeStore({ id: 4, district: '', ward: '' }),
    ])

    expect(counts.districtCounts).toEqual({
      'Hoài Đức': 2,
      'Quốc Oai': 1,
    })
    expect(counts.wardCounts).toEqual({
      'An Khánh': 1,
      'An Thượng': 1,
      'Yên Sơn': 1,
    })
  })
})

describe('buildMapStoreTypeCounts', () => {
  it('đếm đúng số store theo loại ở tập đã qua lọc khu vực', () => {
    const counts = buildMapStoreTypeCounts([
      makeStore({ id: 1, store_type: 'tap_hoa' }),
      makeStore({ id: 2, store_type: 'tap_hoa' }),
      makeStore({ id: 3, store_type: 'quan_an' }),
      makeStore({ id: 4, store_type: '' }),
    ])

    expect(counts).toEqual({
      tap_hoa: 2,
      quan_an: 1,
    })
  })
})

describe('toggleMapDistrictSelection', () => {
  it('thêm quận mới mà không đụng vào xã đang chọn', () => {
    expect(toggleMapDistrictSelection({
      selectedDistricts: ['Hoài Đức'],
      selectedWards: ['An Khánh'],
      district: 'Quốc Oai',
    })).toEqual({
      selectedDistricts: ['Hoài Đức', 'Quốc Oai'],
      selectedWards: ['An Khánh'],
    })
  })

  it('bỏ quận thì tự gỡ các xã thuộc quận đó', () => {
    expect(toggleMapDistrictSelection({
      selectedDistricts: ['Hoài Đức', 'Quốc Oai'],
      selectedWards: ['An Khánh', 'Yên Sơn'],
      district: 'Hoài Đức',
    })).toEqual({
      selectedDistricts: ['Quốc Oai'],
      selectedWards: ['Yên Sơn'],
    })
  })
})

describe('toggleMapMultiSelect', () => {
  it('thêm giá trị khi chưa tồn tại', () => {
    expect(toggleMapMultiSelect(['tap_hoa'], 'quan_an')).toEqual(['tap_hoa', 'quan_an'])
  })

  it('gỡ giá trị khi đã tồn tại', () => {
    expect(toggleMapMultiSelect(['tap_hoa', 'quan_an'], 'tap_hoa')).toEqual(['quan_an'])
  })
})

describe('hasActiveMapFilters', () => {
  it('nhận ra khi đang có filter hoạt động', () => {
    expect(hasActiveMapFilters({
      selectedDistricts: ['Hoài Đức'],
      selectedWards: [],
      selectedStoreTypes: [],
    })).toBe(true)
  })

  it('trả về false khi chưa bật filter nào', () => {
    expect(hasActiveMapFilters({
      selectedDistricts: [],
      selectedWards: [],
      selectedStoreTypes: [],
    })).toBe(false)
  })
})

describe('buildMapSearchSuggestions', () => {
  it('trả về [] khi search term rỗng', () => {
    const indexedStores = buildStoreSearchIndex([makeStore()])
    expect(buildMapSearchSuggestions({
      indexedStores,
      searchTerm: '   ',
      currentLocation: null,
    })).toEqual([])
  })

  it('giữ cùng thứ tự top-ranked với logic search dùng chung', () => {
    const indexedStores = buildStoreSearchIndex([
      makeStore({ id: 1, name: 'Tạp hóa Minh', created_at: '2026-04-20T00:00:00.000Z' }),
      makeStore({ id: 2, name: 'Tạp hóa Minh Anh', created_at: '2026-04-19T00:00:00.000Z' }),
      makeStore({ id: 3, name: 'Minh Anh Số 3', created_at: '2026-04-21T00:00:00.000Z' }),
    ])

    const suggestions = buildMapSearchSuggestions({
      indexedStores,
      searchTerm: 'minh anh',
      currentLocation: null,
      limit: 2,
    })

    expect(suggestions.map((store) => store.id)).toEqual([3, 2])
  })
})
