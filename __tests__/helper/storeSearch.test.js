import { describe, it, expect } from 'vitest'
import {
  buildStoreSearchIndex,
  createSearchQueryMeta,
  getSearchScore,
  matchesSearchQuery,
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
    image_url: 'abc.jpg',
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
    expect(entry).toHaveProperty('hasPhone')
    expect(entry).toHaveProperty('hasImage')
    expect(entry).toHaveProperty('hasCoords')
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

  it('hasImage = true khi có image_url', () => {
    const store = makeStore({ image_url: 'photo.jpg' })
    const [entry] = buildStoreSearchIndex([store])
    expect(entry.hasImage).toBe(true)
  })

  it('hasImage = false khi không có ảnh', () => {
    const store = makeStore({ image_url: '' })
    const [entry] = buildStoreSearchIndex([store])
    expect(entry.hasImage).toBe(false)
  })

  it('trim khoảng trắng khi tính hasPhone và hasImage', () => {
    const store = makeStore({ phone: '   ', image_url: '   ' })
    const [entry] = buildStoreSearchIndex([store])
    expect(entry.hasPhone).toBe(false)
    expect(entry.hasImage).toBe(false)
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
