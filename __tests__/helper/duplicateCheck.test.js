import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock storeCache trước khi import duplicateCheck
// vì duplicateCheck import getOrRefreshStores từ storeCache,
// và storeCache import supabaseClient (cần SUPABASE_URL env var)
vi.mock('@/lib/storeCache', () => ({
  getOrRefreshStores: vi.fn(),
  getCachedStores: vi.fn(),
  appendStoreToCache: vi.fn(),
  removeStoreFromCache: vi.fn(),
  invalidateStoreCache: vi.fn(),
}))

import {
  normalizeNameForMatch,
  stripIgnoredPhrases,
  extractWords,
  isSimilarNameByWords,
  containsAllInputWords,
  evaluateDuplicateCandidate,
  findStoreDuplicateCandidates,
  mergeDuplicateCandidates,
  findNearbySimilarStores,
  findGlobalExactNameMatches,
  IGNORED_NAME_TERMS,
} from '@/helper/duplicateCheck'
import { getOrRefreshStores } from '@/lib/storeCache'

// ── normalizeNameForMatch ─────────────────────────────────────────────────────

describe('normalizeNameForMatch', () => {
  it('chuyển về lowercase', () => {
    expect(normalizeNameForMatch('TẠP HÓA ABC')).toBe('tạp hóa abc')
  })

  it('thay thế ký tự đặc biệt bằng dấu cách', () => {
    expect(normalizeNameForMatch('ABC-DEF')).toBe('abc def')
    expect(normalizeNameForMatch('ABC, DEF')).toBe('abc def')
  })

  it('loại bỏ khoảng trắng thừa', () => {
    expect(normalizeNameForMatch('  abc   def  ')).toBe('abc def')
  })

  it('xử lý chuỗi rỗng', () => {
    expect(normalizeNameForMatch('')).toBe('')
  })

  it('xử lý null/undefined', () => {
    expect(normalizeNameForMatch(null)).toBe('')
    expect(normalizeNameForMatch(undefined)).toBe('')
  })

  it('giữ nguyên chữ có dấu tiếng Việt (chưa bỏ dấu)', () => {
    // normalizeNameForMatch chỉ lowercase + chuẩn hoá ký tự, KHÔNG bỏ dấu
    expect(normalizeNameForMatch('Cửa Hàng')).toBe('cửa hàng')
  })
})

// ── stripIgnoredPhrases ───────────────────────────────────────────────────────

describe('stripIgnoredPhrases', () => {
  it('loại bỏ từ "quán" khỏi chuỗi', () => {
    const result = stripIgnoredPhrases('quán minh anh')
    expect(result).not.toContain('quán')
    expect(result).toContain('minh')
  })

  it('loại bỏ "cửa hàng"', () => {
    const result = stripIgnoredPhrases('cửa hàng đức nam')
    expect(result).not.toContain('cửa hàng')
  })

  it('loại bỏ "tạp hoá"', () => {
    const result = stripIgnoredPhrases('tạp hoá hương lan')
    expect(result).not.toContain('tạp hoá')
  })

  it('giữ lại phần tên chính sau khi loại bỏ', () => {
    const result = stripIgnoredPhrases('quán minh thành')
    // 'quán' bị loại, 'minh' và 'thành' được giữ lại
    // (lưu ý: 'anh' trong IGNORED_NAME_TERMS nên tránh dùng trong test này)
    expect(result.trim()).toContain('minh')
    expect(result.trim()).toContain('thành')
  })

  it('xử lý chuỗi không có từ cần loại bỏ', () => {
    // 'minh thành' không có từ nào trong IGNORED_NAME_TERMS
    const result = stripIgnoredPhrases('minh thành')
    expect(result.trim()).toBe('minh thành')
  })

  it('xử lý chuỗi chỉ có từ cần loại bỏ', () => {
    const result = stripIgnoredPhrases('quán')
    expect(result.trim()).toBe('')
  })

  it('loại bỏ nhiều lần xuất hiện', () => {
    const result = stripIgnoredPhrases('quán minh quán')
    expect(result).not.toContain('quán')
  })
})

// ── extractWords ──────────────────────────────────────────────────────────────

describe('extractWords', () => {
  it('trả về các từ có ý nghĩa (>= 2 ký tự)', () => {
    // Lưu ý: 'anh' nằm trong IGNORED_NAME_TERMS nên bị lọc ra
    // Dùng 'tạp hoá minh thành' để test
    const words = extractWords('tạp hoá minh thành')
    expect(words).toContain('minh')
    expect(words).toContain('thành')
    expect(words).not.toContain('tạp hoá') // bị strip
  })

  it('loại bỏ từ bị ignored trước khi tách', () => {
    const words = extractWords('quán nước hương lan')
    expect(words).not.toContain('quán')
    expect(words).toContain('hương')
    expect(words).toContain('lan')
  })

  it('trả về [] nếu chỉ có từ ignored', () => {
    const words = extractWords('quán')
    expect(words).toEqual([])
  })

  it('trả về [] nếu chuỗi rỗng', () => {
    expect(extractWords('')).toEqual([])
  })
})

// ── isSimilarNameByWords ──────────────────────────────────────────────────────

describe('isSimilarNameByWords', () => {
  it('trả về true khi ít nhất một từ khớp', () => {
    const inputWords = extractWords('minh anh')
    expect(isSimilarNameByWords(inputWords, 'Tạp Hoá Minh Thành')).toBe(true)
  })

  it('trả về false khi không có từ nào khớp', () => {
    const inputWords = extractWords('abc xyz')
    expect(isSimilarNameByWords(inputWords, 'Tạp Hoá Minh Thành')).toBe(false)
  })

  it('trả về false khi inputWords rỗng', () => {
    expect(isSimilarNameByWords([], 'Tạp Hoá Minh Thành')).toBe(false)
  })

  it('trả về false khi storeName rỗng', () => {
    const inputWords = extractWords('minh')
    expect(isSimilarNameByWords(inputWords, '')).toBe(false)
  })

  it('so sánh case-insensitive (extractWords cần input đã lowercase)', () => {
    // extractWords không tự lowercase - normalizeNameForMatch mới làm điều đó
    // Cần pass inputWords đã lowercase để so sánh đúng
    const inputWords = extractWords('minh thành')
    expect(inputWords).toContain('minh')
    expect(inputWords).toContain('thành')
    expect(isSimilarNameByWords(inputWords, 'tạp hoá minh thành')).toBe(true)
    // store chứa "Minh Thành" (uppercase) cũng match vì isSimilarNameByWords normalizes storeName
    expect(isSimilarNameByWords(inputWords, 'Tạp Hoá Minh Thành')).toBe(true)
  })

})

// ── containsAllInputWords ─────────────────────────────────────────────────────

describe('containsAllInputWords', () => {
  it('trả về true khi tất cả từ đều khớp', () => {
    const inputWords = extractWords('minh anh')
    expect(containsAllInputWords(inputWords, 'Tạp Hoá Minh Anh')).toBe(true)
  })

  it('trả về false khi chỉ một từ khớp', () => {
    const inputWords = extractWords('minh xyz')
    expect(containsAllInputWords(inputWords, 'Tạp Hoá Minh Anh')).toBe(false)
  })

  it('trả về false khi inputWords rỗng', () => {
    expect(containsAllInputWords([], 'Tạp Hoá Minh')).toBe(false)
  })

  it('trả về false khi inputWords là null', () => {
    expect(containsAllInputWords(null, 'Tạp Hoá Minh')).toBe(false)
  })

  it('trả về false khi storeName rỗng', () => {
    const inputWords = extractWords('minh anh')
    expect(containsAllInputWords(inputWords, '')).toBe(false)
  })
})

// ── IGNORED_NAME_TERMS ────────────────────────────────────────────────────────

describe('IGNORED_NAME_TERMS', () => {
  it('là một mảng không rỗng', () => {
    expect(Array.isArray(IGNORED_NAME_TERMS)).toBe(true)
    expect(IGNORED_NAME_TERMS.length).toBeGreaterThan(0)
  })

  it('chứa các từ phổ biến trong ngành', () => {
    expect(IGNORED_NAME_TERMS).toContain('quán')
    expect(IGNORED_NAME_TERMS).toContain('cafe')
    expect(IGNORED_NAME_TERMS).toContain('shop')
  })
})

describe('evaluateDuplicateCandidate', () => {
  it('đánh dấu certain duplicate khi trùng số điện thoại dù khác địa bàn', () => {
    const candidate = evaluateDuplicateCandidate(
      {
        name: 'Tạp hóa Minh Anh',
        district: 'Hoài Đức',
        ward: 'An Khánh',
        phone: '0901234567',
        phoneSecondary: '',
      },
      {
        id: 99,
        name: 'Quán nước hoàn toàn khác',
        district: 'Quốc Oai',
        ward: 'Yên Sơn',
        phone: '0901234567',
        phone_secondary: '',
      }
    )

    expect(candidate).toMatchObject({
      id: 99,
      duplicateKind: 'certain',
    })
    expect(candidate.duplicateReasons.phoneMatch).toBe(true)
    expect(candidate.duplicateReasons.sameDistrict).toBe(false)
  })

  it('đánh dấu possible duplicate khi cùng quận, xã liền kề và trùng ít nhất một từ có nghĩa', () => {
    const candidate = evaluateDuplicateCandidate(
      {
        name: 'Tạp hóa Minh Lan',
        district: 'Hoài Đức',
        ward: 'An Khánh',
        addressDetail: '',
      },
      {
        id: 101,
        name: 'Cửa hàng Minh Phúc',
        district: 'Hoài Đức',
        ward: 'An Thượng',
        address_detail: '',
        phone: '',
        phone_secondary: '',
      }
    )

    expect(candidate).toMatchObject({
      id: 101,
      duplicateKind: 'possible',
    })
    expect(candidate.duplicateReasons.phoneMatch).toBe(false)
    expect(candidate.duplicateReasons.adjacentWard).toBe(true)
    expect(candidate.duplicateReasons.oneWordNameMatch).toBe(true)
  })

  it('trả về null khi không có phone match và cũng không có name match đủ điều kiện', () => {
    const candidate = evaluateDuplicateCandidate(
      {
        name: 'Tạp hóa Minh Lan',
        district: 'Hoài Đức',
        ward: 'An Khánh',
      },
      {
        id: 202,
        name: 'Cửa hàng Phúc Lộc',
        district: 'Hoài Đức',
        ward: 'An Thượng',
        phone: '',
        phone_secondary: '',
      }
    )

    expect(candidate).toBeNull()
  })
})

// ── mergeDuplicateCandidates ──────────────────────────────────────────────────

describe('mergeDuplicateCandidates', () => {
  const storeA = { id: 1, name: 'Tạp Hóa A', latitude: 21.0, longitude: 105.8 }
  const storeB = { id: 2, name: 'Tạp Hóa B', latitude: 21.1, longitude: 105.9 }
  const storeNoCoord = { id: 3, name: 'Tạp Hóa C' }

  it('de-duplicate theo id', () => {
    const result = mergeDuplicateCandidates([storeA], [storeA])
    expect(result.length).toBe(1)
    expect(result[0].id).toBe(1)
  })

  it('đánh dấu matchScope="nearby+global" khi có ở cả 2', () => {
    const result = mergeDuplicateCandidates([storeA], [storeA])
    expect(result[0].matchScope).toBe('nearby+global')
  })

  it('đánh dấu matchScope="global" khi chỉ có trong global', () => {
    const result = mergeDuplicateCandidates([], [storeB])
    expect(result[0].matchScope).toBe('global')
  })

  it('đánh dấu matchScope="nearby" khi chỉ có trong nearby', () => {
    const result = mergeDuplicateCandidates([storeA], [])
    expect(result[0].matchScope).toBe('nearby')
  })

  it('merge đầy đủ nearby + global', () => {
    const result = mergeDuplicateCandidates([storeA], [storeB])
    const ids = result.map((s) => s.id)
    expect(ids).toContain(1)
    expect(ids).toContain(2)
  })

  it('gắn distance khi có originLat/Lng và store có tọa độ', () => {
    const result = mergeDuplicateCandidates([], [storeA], 21.0, 105.8)
    expect(result[0].distance).toBeDefined()
    expect(result[0].distance).toBeCloseTo(0, 1)
  })

  it('không gắn distance khi store không có tọa độ', () => {
    const result = mergeDuplicateCandidates([], [storeNoCoord], 21.0, 105.8)
    expect(result[0].distance).toBeUndefined()
  })

  it('sort: store có distance lên trước', () => {
    const near = { ...storeA, distance: 0.05 }
    const result = mergeDuplicateCandidates([near], [storeNoCoord], 21.0, 105.8)
    expect(result[0].id).toBe(1)
    expect(result[1].id).toBe(3)
  })

  it('xử lý mảng rỗng', () => {
    expect(mergeDuplicateCandidates([], [])).toEqual([])
  })

  it('xử lý undefined gracefully', () => {
    expect(mergeDuplicateCandidates(undefined, undefined)).toEqual([])
  })
})

// ── findNearbySimilarStores (với mock) ────────────────────────────────────────

describe('findNearbySimilarStores', () => {
  const mockStores = [
    { id: 1, name: 'Tạp Hóa Minh Anh', latitude: 21.001, longitude: 105.801 },
    { id: 2, name: 'Cửa Hàng Đức Nam', latitude: 21.005, longitude: 105.805 },
    { id: 3, name: 'Quán Nước Hữu', latitude: 21.5, longitude: 106.5 }, // xa
  ]

  beforeEach(() => {
    getOrRefreshStores.mockResolvedValue(mockStores)
  })

  it('trả về store gần và có tên tương tự', async () => {
    const results = await findNearbySimilarStores(21.001, 105.801, 'Minh Anh', 1)
    const ids = results.map((s) => s.id)
    expect(ids).toContain(1)
  })

  it('không trả về store ở xa (ngoài bán kính)', async () => {
    const results = await findNearbySimilarStores(21.001, 105.801, 'Hữu', 0.5)
    const ids = results.map((s) => s.id)
    expect(ids).not.toContain(3) // store 3 ở xa ~70km
  })

  it('trả về [] khi không có store nào khớp tên', async () => {
    const results = await findNearbySimilarStores(21.001, 105.801, 'XYZ không tồn tại', 1)
    expect(results).toEqual([])
  })

  it('trả về [] khi lat/lng là null', async () => {
    const results = await findNearbySimilarStores(null, null, 'Minh Anh')
    expect(results).toEqual([])
  })

  it('sort theo khoảng cách tăng dần', async () => {
    const results = await findNearbySimilarStores(21.001, 105.801, 'Hàng', 1)
    if (results.length >= 2) {
      expect(results[0].distance).toBeLessThanOrEqual(results[1].distance)
    }
  })
})

// ── findGlobalExactNameMatches (với mock) ─────────────────────────────────────

describe('findGlobalExactNameMatches', () => {
  const mockStores = [
    { id: 1, name: 'Tạp Hóa Minh Anh', latitude: 21.0, longitude: 105.8 },
    { id: 2, name: 'Tạp Hóa Minh Thành', latitude: 21.1, longitude: 105.9 },
    { id: 3, name: 'Cửa Hàng Đức', latitude: null, longitude: null },
  ]

  beforeEach(() => {
    getOrRefreshStores.mockResolvedValue(mockStores)
  })

  it('tìm được store có chứa tất cả từ khóa (lưu ý: anh bị ignored)', async () => {
    // 'anh' trong IGNORED_NAME_TERMS nên extractWords('Minh Anh') chỉ cho ['minh']
    // → findGlobalExactNameMatches tìm store có 'minh' → cả store 1 và 2 đều match
    const results = await findGlobalExactNameMatches('Minh Anh')
    const ids = results.map((s) => s.id)
    expect(ids).toContain(1)
    expect(ids).toContain(2) // cả hai đều có 'minh'
  })

  it('tìm chính xác khi dùng từ không bị ignored', async () => {
    // 'thành' không bị ignored, nên chỉ store 2 match 'Minh Thành'
    const results = await findGlobalExactNameMatches('Minh Thành')
    const ids = results.map((s) => s.id)
    expect(ids).not.toContain(1) // store 1 là 'Minh Anh', không có 'thành'
    expect(ids).toContain(2)   // store 2 là 'Minh Thành'
  })

  it('trả về [] khi không tìm thấy', async () => {
    const results = await findGlobalExactNameMatches('XYZ không tồn tại')
    expect(results).toEqual([])
  })

  it('trả về [] khi query rỗng', async () => {
    const results = await findGlobalExactNameMatches('')
    expect(results).toEqual([])
  })

  it('tìm được store không có tọa độ (global search không cần tọa độ)', async () => {
    const results = await findGlobalExactNameMatches('Đức')
    const ids = results.map((s) => s.id)
    expect(ids).toContain(3) // store 3 không có tọa độ nhưng vẫn có trong global search
  })
})

describe('findStoreDuplicateCandidates', () => {
  it('sort certain trước possible, rồi theo duplicateScore giảm dần', async () => {
    const candidates = await findStoreDuplicateCandidates(
      {
        name: 'Tạp hóa Minh Lan',
        district: 'Hoài Đức',
        ward: 'An Khánh',
        phone: '0901234567',
        phoneSecondary: '',
        addressDetail: 'Xóm Chợ',
      },
      {
        stores: [
          {
            id: 1,
            name: 'Cửa hàng Minh Lan',
            district: 'Hoài Đức',
            ward: 'An Thượng',
            address_detail: 'Xóm Chợ',
            phone: '',
            phone_secondary: '',
          },
          {
            id: 2,
            name: 'Tạp hóa bất kỳ',
            district: 'Quốc Oai',
            ward: 'Yên Sơn',
            address_detail: '',
            phone: '0901234567',
            phone_secondary: '',
          },
          {
            id: 3,
            name: 'Tạp hóa Minh Lan',
            district: 'Hoài Đức',
            ward: 'An Khánh',
            address_detail: 'Xóm Chợ',
            phone: '',
            phone_secondary: '',
          },
        ],
      }
    )

    expect(candidates.map((item) => item.id)).toEqual([2, 3, 1])
    expect(candidates[0].duplicateKind).toBe('certain')
    expect(candidates[1].duplicateScore).toBeGreaterThan(candidates[2].duplicateScore)
  })
})
