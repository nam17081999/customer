/**
 * Duplicate-detection utilities for store names.
 *
 * Normalises Vietnamese text, strips common "ignored" business-type prefixes,
 * and compares remaining keywords to find nearby or global duplicates.
 */

import { getOrRefreshStores } from '@/lib/storeCache'
import removeVietnameseTones from '@/helper/removeVietnameseTones'

// Draft adjacency map with human-readable ward names. It is normalized at runtime before matching.
const ADJACENT_WARD_DRAFT = {
  // --- HUYỆN HOÀI ĐỨC (20 đơn vị) ---
  'Trạm Trôi': ['Đức Giang', 'Đức Thượng', 'Kim Chung', 'Tân Lập'],
  'An Khánh': ['An Thượng', 'Lại Yên', 'Song Phương', 'Vân Canh', 'La Phù', 'Đông La', 'Tây Mỗ', 'Dương Nội'],
  'An Thượng': ['An Khánh', 'Song Phương', 'Vân Côn', 'Đông La', 'Tân Phú', 'Đại Thành'],
  'Cát Quế': ['Dương Liễu', 'Đức Giang', 'Yên Sở', 'Minh Khai'],
  'Di Trạch': ['Kim Chung', 'Lại Yên', 'Sơn Đồng', 'Vân Canh', 'Phương Canh'],
  'Dương Liễu': ['Cát Quế', 'Đức Thượng', 'Minh Khai', 'Đức Giang'],
  'Đắc Sở': ['Sơn Đồng', 'Tiền Yên', 'Yên Sở', 'Song Phương'],
  'Đông La': ['An Khánh', 'An Thượng', 'La Phù', 'Vân Côn', 'Yên Nghĩa', 'Đại Thành'],
  'Đức Giang': ['Cát Quế', 'Dương Liễu', 'Đức Thượng', 'Kim Chung', 'Sơn Đồng', 'Trạm Trôi', 'Yên Sở'],
  'Đức Thượng': ['Dương Liễu', 'Đức Giang', 'Minh Khai', 'Trạm Trôi', 'Kim Chung', 'Tân Hội', 'Tân Lập', 'Phùng'],
  'Kim Chung': ['Di Trạch', 'Đức Giang', 'Đức Thượng', 'Sơn Đồng', 'Trạm Trôi', 'Vân Canh', 'Tân Lập', 'Liên Canh', 'Phương Canh'],
  'La Phù': ['An Khánh', 'Đông La', 'Dương Nội', 'Yên Nghĩa'],
  'Lại Yên': ['An Khánh', 'Di Trạch', 'Sơn Đồng', 'Song Phương', 'Vân Canh'],
  'Minh Khai': ['Dương Liễu', 'Đức Thượng', 'Song Phương', 'Canh Nậu', 'Dị Nậu'],
  'Sơn Đồng': ['Di Trạch', 'Đắc Sở', 'Đức Giang', 'Kim Chung', 'Lại Yên', 'Yên Sở', 'Song Phương'],
  'Song Phương': ['An Khánh', 'An Thượng', 'Đắc Sở', 'Lại Yên', 'Sơn Đồng', 'Tiền Yên', 'Vân Côn', 'Minh Khai'],
  'Tiền Yên': ['Đắc Sở', 'Song Phương', 'Yên Sở', 'Cộng Hòa', 'Tân Hòa'],
  'Vân Canh': ['An Khánh', 'Di Trạch', 'Lại Yên', 'Phương Canh', 'Xuân Phương', 'Tây Mỗ'],
  'Vân Côn': ['An Thượng', 'Đông La', 'Song Phương', 'Cộng Hòa', 'Tân Hòa', 'Đại Thành'],
  'Yên Sở': ['Cát Quế', 'Đắc Sở', 'Đức Giang', 'Sơn Đồng', 'Tiền Yên'],

  // --- QUẬN NAM TỪ LIÊM (10 đơn vị) ---
  'Cầu Diễn': ['Mỹ Đình 1', 'Mỹ Đình 2', 'Phú Đô', 'Phúc Diễn', 'Mai Dịch'],
  'Đại Mỗ': ['Mễ Trì', 'Phú Đô', 'Tây Mỗ', 'Trung Văn', 'Dương Nội', 'Vạn Phúc'],
  'Mễ Trì': ['Đại Mỗ', 'Mỹ Đình 1', 'Phú Đô', 'Trung Văn', 'Yên Hòa', 'Trung Hòa'],
  'Mỹ Đình 1': ['Cầu Diễn', 'Mễ Trì', 'Mỹ Đình 2', 'Phú Đô', 'Mễ Trì'],
  'Mỹ Đình 2': ['Cầu Diễn', 'Mỹ Đình 1', 'Mai Dịch', 'Dịch Vọng Hậu'],
  'Phú Đô': ['Cầu Diễn', 'Đại Mỗ', 'Mễ Trì', 'Mỹ Đình 1', 'Trung Văn'],
  'Phương Canh': ['Xuân Phương', 'Vân Canh', 'Di Trạch', 'Kim Chung', 'Minh Khai (Bắc TL)'],
  'Tây Mỗ': ['Đại Mỗ', 'Xuân Phương', 'An Khánh', 'Vân Canh', 'Dương Nội'],
  'Trung Văn': ['Đại Mỗ', 'Mễ Trì', 'Phú Đô', 'Thanh Xuân Bắc', 'Thanh Xuân Nam', 'Mộ Lao'],
  'Xuân Phương': ['Cầu Diễn', 'Phương Canh', 'Tây Mỗ', 'Vân Canh'],

  // --- HUYỆN ĐAN PHƯỢNG (16 đơn vị) ---
  'Phùng': ['Đan Phượng', 'Đồng Tháp', 'Song Phượng', 'Đức Thượng'],
  'Đan Phượng': ['Phùng', 'Hạ Mỗ', 'Song Phượng', 'Thượng Mỗ', 'Tân Hội'],
  'Đồng Tháp': ['Phùng', 'Phương Đình', 'Song Phượng', 'Thọ Lộc'],
  'Hạ Mỗ': ['Đan Phượng', 'Hồng Hà', 'Liên Trung', 'Thượng Mỗ', 'Tân Hội'],
  'Hồng Hà': ['Hạ Mỗ', 'Liên Hồng', 'Thượng Mỗ', 'Trung Châu'],
  'Liên Hà': ['Liên Hồng', 'Liên Trung', 'Thượng Cát (Bắc TL)'],
  'Liên Hồng': ['Hồng Hà', 'Liên Hà', 'Liên Trung'],
  'Liên Trung': ['Hạ Mỗ', 'Liên Hà', 'Liên Hồng', 'Tân Lập'],
  'Phương Đình': ['Đồng Tháp', 'Thọ An', 'Thượng Mỗ', 'Thọ Lộc', 'Sen Phương'],
  'Song Phượng': ['Phùng', 'Đan Phượng', 'Đồng Tháp', 'Đắc Sở'],
  'Tân Hội': ['Đan Phượng', 'Hạ Mỗ', 'Tân Lập', 'Thượng Mỗ', 'Đức Thượng'],
  'Tân Lập': ['Liên Trung', 'Tân Hội', 'Đức Thượng', 'Kim Chung', 'Tây Tựu'],
  'Thọ An': ['Phương Đình', 'Trung Châu', 'Thọ Lộc'],
  'Thọ Xuân': ['Trung Châu', 'Thượng Mỗ', 'Hồng Hà'],
  'Thượng Mỗ': ['Đan Phượng', 'Hạ Mỗ', 'Hồng Hà', 'Phương Đình', 'Tân Hội', 'Thọ Xuân'],
  'Trung Châu': ['Hồng Hà', 'Thọ An', 'Thọ Xuân'],

  // --- HUYỆN PHÚC THỌ (21 đơn vị) ---
  'Phúc Thọ': ['Phúc Hòa', 'Thọ Lộc', 'Trạch Mỹ Lộc', 'Hát Môn'],
  'Hát Môn': ['Phúc Thọ', 'Thanh Đa', 'Vân Nam'],
  'Hiệp Thuận': ['Liên Hiệp', 'Tam Hiệp', 'Phụng Thượng', 'Canh Nậu'],
  'Liên Hiệp': ['Hiệp Thuận', 'Tam Hiệp', 'Sài Sơn'],
  'Long Xuyên': ['Phúc Hòa', 'Thượng Cốc', 'Xuân Đình', 'Vân Phúc'],
  'Ngọc Tảo': ['Phụng Thượng', 'Phúc Hòa', 'Tam Hiệp', 'Thanh Đa'],
  'Phúc Hòa': ['Phúc Thọ', 'Long Xuyên', 'Ngọc Tảo', 'Phụng Thượng', 'Thọ Lộc'],
  'Phụng Thượng': ['Hiệp Thuận', 'Ngọc Tảo', 'Phúc Hòa'],
  'Sen Phương': ['Phương Đình', 'Thọ Lộc', 'Vân Phúc', 'Xuân Đình'],
  'Tam Hiệp': ['Hiệp Thuận', 'Liên Hiệp', 'Ngọc Tảo', 'Canh Nậu'],
  'Tam Thuấn': ['Thanh Đa', 'Xuân Đình'],
  'Thanh Đa': ['Hát Môn', 'Ngọc Tảo', 'Tam Thuấn', 'Vân Hà'],
  'Thọ Lộc': ['Phúc Thọ', 'Đồng Tháp', 'Phương Đình', 'Phúc Hòa', 'Sen Phương', 'Trạch Mỹ Lộc'],
  'Thượng Cốc': ['Long Xuyên', 'Xuân Đình', 'Thanh Mỹ (Sơn Tây)'],
  'Tích Giang': ['Trạch Mỹ Lộc', 'Thọ Lộc', 'Sơn Đông (Sơn Tây)'],
  'Trạch Mỹ Lộc': ['Phúc Thọ', 'Thọ Lộc', 'Tích Giang'],
  'Vân Hà': ['Thanh Đa', 'Vân Nam', 'Vân Phúc'],
  'Vân Nam': ['Hát Môn', 'Vân Hà', 'Vân Phúc'],
  'Vân Phúc': ['Long Xuyên', 'Sen Phương', 'Vân Hà', 'Vân Nam'],
  'Võng Xuyên': ['Phúc Hòa', 'Long Xuyên', 'Thọ Lộc'],
  'Xuân Đình': ['Long Xuyên', 'Sen Phương', 'Tam Thuấn', 'Thượng Cốc'],

  // --- HUYỆN QUỐC OAI (21 đơn vị) ---
  'Quốc Oai': ['Ngọc Mỹ', 'Phượng Cách', 'Thạch Thán', 'Yên Sơn'],
  'Cấn Hữu': ['Đông Quang', 'Liệp Tuyết', 'Nghĩa Hương', 'Tuyết Nghĩa', 'Hòa Thạch', 'Đông Yên'],
  'Cộng Hòa': ['Tân Hòa', 'Tiền Yên', 'Vân Côn', 'Đồng Quang'],
  'Đại Thành': ['An Thượng', 'Đông La', 'Vân Côn', 'Phụng Châu', 'Tân Phú'],
  'Đông Quang': ['Cấn Hữu', 'Cộng Hòa', 'Nghĩa Hương', 'Tân Hòa'],
  'Đông Yên': ['Cấn Hữu', 'Hòa Thạch', 'Phú Mãn', 'Trần Phú (Chương Mỹ)'],
  'Đồng Quang': ['Cộng Hòa', 'Nghĩa Hương', 'Thạch Thán'],
  'Hòa Thạch': ['Cấn Hữu', 'Đông Yên', 'Phú Cát', 'Phú Mãn', 'Tuyết Nghĩa'],
  'Liệp Tuyết': ['Cấn Hữu', 'Ngọc Liệp', 'Nghĩa Hương', 'Tuyết Nghĩa'],
  'Nghĩa Hương': ['Cấn Hữu', 'Đông Quang', 'Đồng Quang', 'Liệp Tuyết', 'Thạch Thán'],
  'Ngọc Liệp': ['Liệp Tuyết', 'Ngọc Mỹ', 'Tuyết Nghĩa', 'Cần Kiệm (Thạch Thất)'],
  'Ngọc Mỹ': ['Quốc Oai', 'Ngọc Liệp', 'Thạch Thán', 'Thụy Hương'],
  'Phú Cát': ['Hòa Thạch', 'Tuyết Nghĩa', 'Thạch Hòa (Thạch Thất)'],
  'Phú Mãn': ['Đông Xuân', 'Đông Yên', 'Hòa Thạch'],
  'Phượng Cách': ['Quốc Oai', 'Sài Sơn', 'Yên Sơn'],
  'Sài Sơn': ['Phượng Cách', 'Yên Sơn', 'Liên Hiệp', 'Thạch Thán'],
  'Tân Hòa': ['Cộng Hòa', 'Đông Quang', 'Tiền Yên', 'Vân Côn'],
  'Tân Phú': ['An Thượng', 'Đại Thành', 'Phượng Cách'],
  'Thạch Thán': ['Quốc Oai', 'Đồng Quang', 'Nghĩa Hương', 'Ngọc Mỹ', 'Sài Sơn', 'Yên Sơn'],
  'Tuyết Nghĩa': ['Cấn Hữu', 'Hòa Thạch', 'Liệp Tuyết', 'Ngọc Liệp', 'Phú Cát'],
  'Yên Sơn': ['Quốc Oai', 'Phượng Cách', 'Sài Sơn', 'Thạch Thán'],
  'Đông Xuân': ['Phú Mãn', 'Tiến Xuân (Thạch Thất)']
};

/** Common business-type words that should be ignored when comparing names. */
export const IGNORED_NAME_TERMS = [
  'cửa hàng',
  'tạp hoá',
  'quán nước',
  'giải khát',
  'nhà nghỉ',
  'nhà hàng',
  'cyber cà phê',
  'cafe',
  'lẩu',
  'siêu thị',
  'quán',
  'gym',
  'đại lý',
  'cơm',
  'phở',
  'bún',
  'shop',
  'kok',
  'karaoke',
  'bi-a',
  'bia',
  'net',
  'game',
  'internet',
  'beer',
  'coffee',
  'mart',
  'store',
  'minimart',
  'thực phẩm',
  'cơm bình dân',
  'ăn vặt',
  'ăn nhanh',
  'quán nước',
  'quán ăn',
  'chị',
  'anh',
  'cô',
  'chú',
  'bác',
  'em',
]

// ── Internal helpers ────────────────────────────────────────────────────

export function normalizeNameForMatch(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeAdjacentWardDraftMap(source) {
  const normalizedMap = {}
  Object.entries(source || {}).forEach(([ward, neighbors]) => {
    const normalizedWard = normalizeLooseText(ward)
    if (!normalizedWard) return
    normalizedMap[normalizedWard] = Array.from(new Set(
      (neighbors || [])
        .map((neighbor) => normalizeLooseText(neighbor))
        .filter(Boolean)
    ))
  })
  return normalizedMap
}

const NORMALIZED_ADJACENT_WARD_MAP = normalizeAdjacentWardDraftMap(ADJACENT_WARD_DRAFT)

export function stripIgnoredPhrases(normalized) {
  const ignoredList = IGNORED_NAME_TERMS
    .map((t) => normalizeNameForMatch(t))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  let out = ` ${normalized} `
  for (const phrase of ignoredList) {
    if (!phrase) continue
    // Use space boundaries instead of \b for Vietnamese diacritics compatibility
    while (out.includes(` ${phrase} `)) {
      out = out.replace(` ${phrase} `, ' ')
    }
  }
  return out.replace(/\s+/g, ' ').trim()
}

export function extractWords(normalized) {
  const cleaned = stripIgnoredPhrases(normalized)
  return cleaned
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
}

// ── Comparison functions ────────────────────────────────────────────────

/** Returns true if *any* keyword from `inputWords` appears in the store name. */
export function isSimilarNameByWords(inputWords, storeName) {
  const storeNorm = normalizeNameForMatch(storeName || '')
  if (!storeNorm || inputWords.length === 0) return false
  const storeWords = extractWords(storeNorm)
  if (storeWords.length === 0) return false
  const storeSet = new Set(storeWords)
  for (const w of inputWords) {
    if (storeSet.has(w)) return true
  }
  return false
}

/** Returns true if *all* keywords from `inputWords` appear in the store name. */
export function containsAllInputWords(inputWords, storeName) {
  if (!Array.isArray(inputWords) || inputWords.length === 0) return false
  const storeNorm = normalizeNameForMatch(storeName || '')
  if (!storeNorm) return false
  const storeWords = extractWords(storeNorm)
  if (storeWords.length === 0) return false
  const storeSet = new Set(storeWords)
  for (const w of inputWords) {
    if (!storeSet.has(w)) return false
  }
  return true
}

function normalizeLooseText(raw) {
  return removeVietnameseTones(String(raw || ''))
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildComparableName(rawName) {
  const normalized = normalizeNameForMatch(rawName || '')
  const stripped = stripIgnoredPhrases(normalized)
  const ascii = normalizeLooseText(stripped)
  const tokens = ascii.split(' ').map((token) => token.trim()).filter((token) => token.length >= 2)
  return {
    signature: tokens.join(' '),
    tokens,
  }
}

function buildComparableAddress(rawAddress) {
  const normalized = normalizeLooseText(rawAddress || '')
  const tokens = normalized.split(' ').map((token) => token.trim()).filter((token) => token.length >= 2)
  return {
    signature: normalized,
    tokens,
  }
}

function getTokenOverlap(leftTokens = [], rightTokens = []) {
  if (!leftTokens.length || !rightTokens.length) {
    return { count: 0, ratio: 0 }
  }
  const rightSet = new Set(rightTokens)
  let count = 0
  leftTokens.forEach((token) => {
    if (rightSet.has(token)) count += 1
  })
  return {
    count,
    ratio: count / Math.min(leftTokens.length, rightTokens.length),
  }
}

function hasStrongAddressMatch(inputAddress, storeAddress) {
  if (!inputAddress.signature || !storeAddress.signature) return false
  if (inputAddress.signature === storeAddress.signature) return true

  const overlap = getTokenOverlap(inputAddress.tokens, storeAddress.tokens)
  return overlap.count >= 2 && overlap.ratio >= 0.75
}

function areAdjacentWardsDraft(leftWard, rightWard) {
  if (!leftWard || !rightWard || leftWard === rightWard) return false
  const leftNeighbors = NORMALIZED_ADJACENT_WARD_MAP[leftWard] || []
  const rightNeighbors = NORMALIZED_ADJACENT_WARD_MAP[rightWard] || []
  return leftNeighbors.includes(rightWard) || rightNeighbors.includes(leftWard)
}

export function evaluateDuplicateCandidate(input, store) {
  const inputName = buildComparableName(input?.name)
  const storeName = buildComparableName(store?.name)
  const inputAddress = buildComparableAddress(input?.addressDetail)
  const storeAddress = buildComparableAddress(store?.address_detail)
  const inputDistrict = normalizeLooseText(input?.district)
  const inputWard = normalizeLooseText(input?.ward)
  const storeDistrict = normalizeLooseText(store?.district)
  const storeWard = normalizeLooseText(store?.ward)

  const sameDistrict = Boolean(inputDistrict) && inputDistrict === storeDistrict
  const sameWard = Boolean(inputWard) && inputWard === storeWard
  const adjacentWard = sameDistrict && areAdjacentWardsDraft(inputWard, storeWard)
  const nameOverlap = getTokenOverlap(inputName.tokens, storeName.tokens)
  const oneWordNameMatch = nameOverlap.count >= 1
  const strongAddressMatch = hasStrongAddressMatch(inputAddress, storeAddress)

  const phoneValues = [input?.phone, input?.phoneSecondary]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  const storePhones = [store?.phone, store?.phone_secondary]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  const phoneMatch = phoneValues.some((value) => storePhones.includes(value))

  const scopeMatch = Boolean(sameWard || adjacentWard)
  const certainDuplicate = Boolean(phoneMatch)
  const possibleDuplicate = Boolean(!certainDuplicate && scopeMatch && oneWordNameMatch)

  if (!certainDuplicate && !possibleDuplicate) return null

  let duplicateScore = 0
  if (phoneMatch) duplicateScore += 200
  if (nameOverlap.count >= 2) duplicateScore += 60
  else if (oneWordNameMatch) duplicateScore += 30
  if (sameWard) duplicateScore += 30
  if (adjacentWard) duplicateScore += 20
  if (sameDistrict) duplicateScore += 15
  if (strongAddressMatch) duplicateScore += 30

  return {
    ...store,
    duplicateKind: certainDuplicate ? 'certain' : 'possible',
    duplicateScore,
    duplicateReasons: {
      phoneMatch,
      oneWordNameMatch,
      sameWard,
      adjacentWard,
      sameDistrict,
      strongAddressMatch,
    },
  }
}

export async function findStoreDuplicateCandidates(input, options = {}) {
  const stores = options.stores || await getOrRefreshStores()
  const candidates = []

  stores.forEach((store) => {
    const candidate = evaluateDuplicateCandidate(input, store)
    if (candidate) candidates.push(candidate)
  })

  return candidates.sort((left, right) => {
    if (left.duplicateKind !== right.duplicateKind) {
      return left.duplicateKind === 'certain' ? -1 : 1
    }
    if (right.duplicateScore !== left.duplicateScore) {
      return right.duplicateScore - left.duplicateScore
    }
    return (left.name || '').localeCompare(right.name || '', 'vi')
  })
}

// ── High-level search helpers ───────────────────────────────────────────

/**
 * Find stores within `radiusKm` that share at least one keyword with `inputName`.
 */
export async function findNearbySimilarStores(lat, lng, inputName, radiusKm = 0.1) {
  const inputNorm = normalizeNameForMatch(inputName)
  if (!inputNorm || lat == null || lng == null) return []
  const inputWords = extractWords(inputNorm)
  if (inputWords.length === 0) return []

  const allStores = await getOrRefreshStores()

  return allStores
    .map((s) => {
      const storeLat = parseCoordinate(s?.latitude)
      const storeLng = parseCoordinate(s?.longitude)
      if (!Number.isFinite(storeLat) || !Number.isFinite(storeLng)) return null
      return {
        ...s,
        latitude: storeLat,
        longitude: storeLng,
        distance: haversineKm(lat, lng, storeLat, storeLng),
      }
    })
    .filter(Boolean)
    .filter((s) => s.distance <= radiusKm && isSimilarNameByWords(inputWords, s.name))
    .sort((a, b) => a.distance - b.distance)
}

/**
 * Find stores anywhere whose name contains *all* keywords from `inputName`.
 */
export async function findGlobalExactNameMatches(inputName) {
  const inputNorm = normalizeNameForMatch(inputName)
  if (!inputNorm) return []

  const inputWords = extractWords(inputNorm)
  if (inputWords.length === 0) return []

  const allStores = await getOrRefreshStores()

  return allStores
    .filter((s) => containsAllInputWords(inputWords, s.name))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'))
}

function attachDistance(store, originLat, originLng) {
  const storeLat = parseCoordinate(store?.latitude)
  const storeLng = parseCoordinate(store?.longitude)
  if (
    originLat == null ||
    originLng == null ||
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLng) ||
    !Number.isFinite(storeLat) ||
    !Number.isFinite(storeLng)
  ) {
    return store
  }

  return {
    ...store,
    latitude: storeLat,
    longitude: storeLng,
    distance: haversineKm(originLat, originLng, storeLat, storeLng),
  }
}

/**
 * Merge nearby + global duplicate candidates, de-duplicate by id, sort by distance first.
 */
export function mergeDuplicateCandidates(
  nearbyMatches = [],
  globalMatches = [],
  originLat = null,
  originLng = null
) {
  const byId = new Map()
  globalMatches.forEach((s) => {
    byId.set(s.id, { ...attachDistance(s, originLat, originLng), matchScope: 'global' })
  })
  nearbyMatches.forEach((s) => {
    const existing = byId.get(s.id)
    byId.set(s.id, {
      ...(existing || {}),
      ...s,
      matchScope: existing ? 'nearby+global' : 'nearby',
    })
  })

  return Array.from(byId.values()).sort((a, b) => {
    const aHasDistance = typeof a.distance === 'number'
    const bHasDistance = typeof b.distance === 'number'
    if (aHasDistance && bHasDistance) return a.distance - b.distance
    if (aHasDistance) return -1
    if (bHasDistance) return 1
    return (a.name || '').localeCompare(b.name || '', 'vi')
  })
}
