import { describe, it, expect } from 'vitest'
import {
  buildStoreSearchIndex,
  createSearchQueryMeta,
  filterAndRankIndexedStores,
  getSearchScore,
  matchesSearchQuery,
  rankStoreSearchResults,
} from '@/helper/storeSearch'
import { parseCoordinate } from '@/helper/coordinate'

// ── helpers ──────────────────────────────────────────────────────────────────

function hasStoreCoordinates(store) {
  return (
    Number.isFinite(parseCoordinate(store?.latitude)) &&
    Number.isFinite(parseCoordinate(store?.longitude))
  )
}

function makeStore(overrides = {}) {
  return {
    id: 1,
    name: 'Tạp Hóa Minh Anh',
    phone: '0901234567',
    latitude: 21.0,
    longitude: 105.8,
    store_type: 'Tạp hóa',
    ...overrides,
  }
}

// ── createSearchQueryMeta ─────────────────────────────────────────────────────

describe('createSearchQueryMeta', () => {
  it('trả về term lowercase đã trim', () => {
    const meta = createSearchQueryMeta('  Minh Anh  ')
    expect(meta.term).toBe('minh anh')
  })

  it('tạo normalizedTerm (không dấu)', () => {
    const meta = createSearchQueryMeta('Hà Nội')
    expect(meta.normalizedTerm).toBe('ha noi')
  })

  it('tạo phoneticTerm (chuẩn hoá phiên âm)', () => {
    const meta = createSearchQueryMeta('Xanh')
    // x → s ở đầu từ
    expect(meta.phoneticTerm).toBe('sanh')
  })

  it('tạo words từ normalizedTerm', () => {
    const meta = createSearchQueryMeta('Minh Anh')
    expect(meta.words).toEqual(['minh', 'anh'])
  })

  it('tạo phoneticWords', () => {
    const meta = createSearchQueryMeta('Xanh Tươi')
    expect(meta.phoneticWords).toEqual(expect.arrayContaining(['sanh']))
  })

  it('chuẩn hóa tương đương d/gi/r và l/n cho phoneticWords', () => {
    const meta = createSearchQueryMeta('Giang Rạng Nam')
    expect(meta.phoneticWords).toEqual(['dang', 'dang', 'lam'])
  })

  it('xử lý chuỗi rỗng', () => {
    const meta = createSearchQueryMeta('')
    expect(meta.term).toBe('')
    expect(meta.words).toEqual([])
  })

  it('xử lý null/undefined', () => {
    const meta1 = createSearchQueryMeta(null)
    const meta2 = createSearchQueryMeta(undefined)
    expect(meta1.term).toBe('')
    expect(meta2.term).toBe('')
  })
})

// ── buildStoreSearchIndex ─────────────────────────────────────────────────────

describe('buildStoreSearchIndex', () => {
  it('tạo index đúng cấu trúc', () => {
    const store = makeStore()
    const [entry] = buildStoreSearchIndex([store], { getHasCoords: hasStoreCoordinates })
    expect(entry).toHaveProperty('store')
    expect(entry).toHaveProperty('nameLower')
    expect(entry).toHaveProperty('normalizedName')
    expect(entry).toHaveProperty('phoneticName')
    expect(entry).toHaveProperty('relaxedNormalizedName')
    expect(entry).toHaveProperty('relaxedPhoneticName')
    expect(entry).toHaveProperty('normalizedDistrict')
    expect(entry).toHaveProperty('normalizedWard')
    expect(entry).toHaveProperty('normalizedStoreType')
    expect(entry).toHaveProperty('hasPhone')
    expect(entry).toHaveProperty('hasCoords')
  })



  it('chuẩn hóa sẵn district, ward và store_type một lần trong index', () => {
    const store = makeStore({
      district: 'Hoài Đức',
      ward: 'An Khánh',
      store_type: 'Tạp hóa',
    })
    const [entry] = buildStoreSearchIndex([store])

    expect(entry.normalizedDistrict).toBe('hoai duc')
    expect(entry.normalizedWard).toBe('an khanh')
    expect(entry.normalizedStoreType).toBe('tap hoa')
  })

  it('trim + normalize các field phụ ngay khi build index', () => {
    const store = makeStore({
      district: '  Hoài Đức  ',
      ward: '  An Khánh  ',
      store_type: '  Tạp hóa  ',
    })
    const [entry] = buildStoreSearchIndex([store])

    expect(entry.normalizedDistrict).toBe('hoai duc')
    expect(entry.normalizedWard).toBe('an khanh')
    expect(entry.normalizedStoreType).toBe('tap hoa')
  })

  it('nameLower là lowercase của store.name', () => {
    const store = makeStore({ name: 'Tạp Hóa ABC' })
    const [entry] = buildStoreSearchIndex([store])
    expect(entry.nameLower).toBe('tạp hóa abc')
  })

  it('normalizedName bỏ dấu tiếng Việt', () => {
    const store = makeStore({ name: 'Cửa Hàng Đức' })
    const [entry] = buildStoreSearchIndex([store])
    expect(entry.normalizedName).toBe('cua hang duc')
  })

  it('hasPhone = true khi có số điện thoại', () => {
    const store = makeStore({ phone: '0901234567' })
    const [entry] = buildStoreSearchIndex([store])
    expect(entry.hasPhone).toBe(true)
  })

  it('hasPhone = false khi không có số điện thoại', () => {
    const store = makeStore({ phone: '' })
    const [entry] = buildStoreSearchIndex([store])
    expect(entry.hasPhone).toBe(false)
  })

  it('hasPhone = false khi phone là null', () => {
    const store = makeStore({ phone: null })
    const [entry] = buildStoreSearchIndex([store])
    expect(entry.hasPhone).toBe(false)
  })

  it('trim khoảng trắng khi tính hasPhone', () => {
    const store = makeStore({ phone: '   ' })
    const [entry] = buildStoreSearchIndex([store])
    expect(entry.hasPhone).toBe(false)
  })

  it('hasCoords = true khi có tọa độ hợp lệ', () => {
    const store = makeStore({ latitude: 21.0, longitude: 105.8 })
    const [entry] = buildStoreSearchIndex([store], { getHasCoords: hasStoreCoordinates })
    expect(entry.hasCoords).toBe(true)
  })

  it('hasCoords = false khi không có tọa độ', () => {
    const store = makeStore({ latitude: null, longitude: null })
    const [entry] = buildStoreSearchIndex([store], { getHasCoords: hasStoreCoordinates })
    expect(entry.hasCoords).toBe(false)
  })

  it('hasCoords = null khi không truyền getHasCoords', () => {
    const store = makeStore()
    const [entry] = buildStoreSearchIndex([store])
    expect(entry.hasCoords).toBe(null)
  })

  it('trả về [] khi đầu vào không phải array', () => {
    expect(buildStoreSearchIndex(null)).toEqual([])
    expect(buildStoreSearchIndex(undefined)).toEqual([])
    expect(buildStoreSearchIndex('string')).toEqual([])
  })

  it('xử lý mảng rỗng', () => {
    expect(buildStoreSearchIndex([])).toEqual([])
  })

  it('xử lý nhiều stores', () => {
    const stores = [makeStore({ id: 1 }), makeStore({ id: 2, name: 'Quán Nước Ba' })]
    const index = buildStoreSearchIndex(stores)
    expect(index).toHaveLength(2)
  })
})

// ── getSearchScore ────────────────────────────────────────────────────────────

describe('getSearchScore', () => {
  const makeEntry = (name) => {
    const [entry] = buildStoreSearchIndex([makeStore({ name })])
    return entry
  }

  it('trả về 2 khi tên chứa chính xác từ tìm kiếm (không dấu)', () => {
    const entry = makeEntry('Tạp Hóa Minh Anh')
    const meta = createSearchQueryMeta('Minh Anh')
    expect(getSearchScore(entry, meta)).toBe(2)
  })

  it('trả về 2 khi tìm kiếm không dấu khớp tên có dấu', () => {
    const entry = makeEntry('Tạp Hóa Minh Anh')
    const meta = createSearchQueryMeta('minh anh') // không dấu
    expect(getSearchScore(entry, meta)).toBe(2)
  })

  it('trả về 2 khi tìm không dấu và tên có dấu', () => {
    const entry = makeEntry('Cửa Hàng Thành Đạt')
    const meta = createSearchQueryMeta('thanh dat')
    expect(getSearchScore(entry, meta)).toBe(2)
  })

  it('trả về 1 khi tất cả words đều khớp (không liên tục)', () => {
    const entry = makeEntry('Tạp Hóa Minh Anh - Chi Nhánh 2')
    const meta = createSearchQueryMeta('minh anh 2')
    // minh, anh, 2 đều có trong tên
    expect(getSearchScore(entry, meta)).toBeGreaterThanOrEqual(1)
  })

  it('trả về 0 khi chỉ một từ khớp', () => {
    const entry = makeEntry('Cửa Hàng Bình')
    const meta = createSearchQueryMeta('binh anh xyz') // binh khớp, anh không, xyz không
    const score = getSearchScore(entry, meta)
    // anyWordMatch
    expect(score).toBe(0)
  })

  it('trả về null khi không khớp gì', () => {
    const entry = makeEntry('Cửa Hàng ABC')
    const meta = createSearchQueryMeta('xyz không tồn tại')
    expect(getSearchScore(entry, meta)).toBeNull()
  })


  it('trả về score yếu hơn cho near-match do lặp ký tự', () => {
    const entry = makeEntry('Shoppii Mart')
    const meta = createSearchQueryMeta('shopii')
    expect(getSearchScore(entry, meta)).toBe(-1)
  })

  it('near-match vẫn đứng dưới exact match', () => {
    const indexedStores = buildStoreSearchIndex([
      makeStore({ id: 1, name: 'Shopii Mart', created_at: '2026-04-01T00:00:00.000Z' }),
      makeStore({ id: 2, name: 'Shoppii Mart', created_at: '2026-04-02T00:00:00.000Z' }),
    ], { getHasCoords: hasStoreCoordinates })

    const results = rankStoreSearchResults({
      indexedStores,
      searchTerm: 'shopii',
      currentLocation: null,
    })

    expect(results.map((store) => store.id)).toEqual([1, 2])
    expect(results[0]._score).toBeGreaterThan(results[1]._score)
  })


  it('phonetic match cũ vẫn đứng trên near-match mới', () => {
    const indexedStores = buildStoreSearchIndex([
      makeStore({ id: 1, name: 'Siêu Thị Mini', created_at: '2026-04-01T00:00:00.000Z' }),
      makeStore({ id: 2, name: 'Siiêu Thị Mini', created_at: '2026-04-02T00:00:00.000Z' }),
    ], { getHasCoords: hasStoreCoordinates })

    const results = rankStoreSearchResults({
      indexedStores,
      searchTerm: 'xieu thi',
      currentLocation: null,
    })

    expect(results.map((store) => store.id)).toEqual([1, 2])
    expect(results[0]._score).toBeGreaterThan(results[1]._score)
  })

  it('không trả near-match khi không đủ giống', () => {
    const indexedStores = buildStoreSearchIndex([
      makeStore({ id: 1, name: 'Shoppii Mart' }),
      makeStore({ id: 2, name: 'Alpha Beta' }),
    ], { getHasCoords: hasStoreCoordinates })

    const results = rankStoreSearchResults({
      indexedStores,
      searchTerm: 'zalo',
      currentLocation: null,
    })

    expect(results).toEqual([])
  })

  it('trả về null khi query rỗng', () => {
    const entry = makeEntry('Tạp Hóa Minh Anh')
    const meta = createSearchQueryMeta('')
    expect(getSearchScore(entry, meta)).toBeNull()
  })

  it('trả về null khi entry là null', () => {
    const meta = createSearchQueryMeta('minh anh')
    expect(getSearchScore(null, meta)).toBeNull()
  })

  it('hỗ trợ tìm theo phiên âm (s/x)', () => {
    const entry = makeEntry('Siêu Thị Mini')
    const meta = createSearchQueryMeta('Xiêu Thị') // x → s
    // phoneticTerm: 'sieu thi', phonetic của 'xiêu thị' = 'sieu thi'
    const score = getSearchScore(entry, meta)
    expect(score).not.toBeNull()
  })

  it('hỗ trợ tìm theo phiên âm (ch/tr)', () => {
    const entry = makeEntry('Trà Sữa Ngọc')
    const meta = createSearchQueryMeta('Chà Sữa') // tr → ch
    const score = getSearchScore(entry, meta)
    expect(score).not.toBeNull()
  })

  it('hỗ trợ tìm theo phiên âm (d/gi/r)', () => {
    const entry = makeEntry('Gà Rán Minh')
    const meta = createSearchQueryMeta('Da Rán')
    const score = getSearchScore(entry, meta)
    expect(score).not.toBeNull()
  })

  it('hỗ trợ tìm theo phiên âm (l/n)', () => {
    const entry = makeEntry('Nâm Quán')
    const meta = createSearchQueryMeta('Lâm')
    const score = getSearchScore(entry, meta)
    expect(score).not.toBeNull()
  })
})

// ── matchesSearchQuery ────────────────────────────────────────────────────────

describe('matchesSearchQuery', () => {
  const makeEntry = (name) => {
    const [entry] = buildStoreSearchIndex([makeStore({ name })])
    return entry
  }

  it('trả về true khi khớp', () => {
    const entry = makeEntry('Tạp Hóa Minh Anh')
    const meta = createSearchQueryMeta('minh anh')
    expect(matchesSearchQuery(entry, meta)).toBe(true)
  })

  it('trả về false khi không khớp', () => {
    const entry = makeEntry('Cửa Hàng ABC')
    const meta = createSearchQueryMeta('xyz zyx')
    expect(matchesSearchQuery(entry, meta)).toBe(false)
  })

  it('trả về true khi khớp qua normalized hoặc phonetic query', () => {
    const entry = makeEntry('Cửa Hàng Giang')
    const meta = createSearchQueryMeta('dang')
    expect(matchesSearchQuery(entry, meta)).toBe(true)
  })
})



describe('filterAndRankIndexedStores', () => {
  it('áp dụng predicate trước khi rank nhưng giữ nguyên rule sort dùng chung', () => {
    const indexedStores = buildStoreSearchIndex([
      makeStore({ id: 1, name: 'Tạp Hóa Minh', district: 'Hoài Đức', created_at: '2026-04-01T00:00:00.000Z' }),
      makeStore({ id: 2, name: 'Tạp Hóa Minh Anh', district: 'Hoài Đức', created_at: '2026-04-02T00:00:00.000Z' }),
      makeStore({ id: 3, name: 'Minh Anh Quốc Oai', district: 'Quốc Oai', created_at: '2026-04-03T00:00:00.000Z' }),
    ], { getHasCoords: hasStoreCoordinates })

    const results = filterAndRankIndexedStores({
      indexedStores,
      searchTerm: 'minh anh',
      currentLocation: null,
      predicate: (entry) => entry.store.district === 'Hoài Đức',
    })

    expect(results.map((store) => store.id)).toEqual([2, 1])
  })
})

describe('rankStoreSearchResults', () => {
  it('ưu tiên kết quả khớp mạnh hơn trước dù store khớp yếu đứng trước trong dữ liệu', () => {
    const indexedStores = buildStoreSearchIndex([
      makeStore({
        id: 1,
        name: 'Tạp Hóa Minh',
        created_at: '2026-04-01T00:00:00.000Z',
      }),
      makeStore({
        id: 2,
        name: 'Tạp Hóa Minh Anh',
        created_at: '2026-04-02T00:00:00.000Z',
      }),
    ], { getHasCoords: hasStoreCoordinates })

    const results = rankStoreSearchResults({
      indexedStores,
      searchTerm: 'minh anh',
      currentLocation: null,
    })

    expect(results.map((store) => store.id)).toEqual([2, 1])
    expect(results[0]._score).toBeGreaterThan(results[1]._score)
  })

  it('giới hạn kết quả sau khi đã sort theo cùng rule chung', () => {
    const indexedStores = buildStoreSearchIndex([
      makeStore({ id: 1, name: 'Tạp Hóa Minh', created_at: '2026-04-01T00:00:00.000Z' }),
      makeStore({ id: 2, name: 'Tạp Hóa Minh Anh', created_at: '2026-04-02T00:00:00.000Z' }),
      makeStore({ id: 3, name: 'Minh Anh Số 3', created_at: '2026-04-03T00:00:00.000Z' }),
    ], { getHasCoords: hasStoreCoordinates })

    const results = rankStoreSearchResults({
      indexedStores,
      searchTerm: 'minh anh',
      currentLocation: null,
      limit: 2,
    })

    expect(results).toHaveLength(2)
    expect(results.map((store) => store.id)).toEqual([3, 2])
  })
})
