import removeVietnameseTones, { normalizeVietnamesePhonetics } from '@/helper/removeVietnameseTones'

export function createSearchQueryMeta(rawValue) {
  const term = String(rawValue || '').trim().toLowerCase()
  const normalizedTerm = removeVietnameseTones(term)
  const phoneticTerm = normalizeVietnamesePhonetics(term)

  return {
    term,
    normalizedTerm,
    phoneticTerm,
    words: normalizedTerm.split(/\s+/).filter(Boolean),
    phoneticWords: phoneticTerm.split(/\s+/).filter(Boolean),
  }
}

export function buildStoreSearchIndex(stores, options = {}) {
  const getHasCoords = typeof options.getHasCoords === 'function' ? options.getHasCoords : null

  return (Array.isArray(stores) ? stores : []).map((store) => {
    const nameLower = String(store?.name || '').toLowerCase()

    return {
      store,
      nameLower,
      normalizedName: removeVietnameseTones(nameLower),
      phoneticName: normalizeVietnamesePhonetics(nameLower),
      hasPhone: Boolean(String(store?.phone || '').trim()),
      hasImage: Boolean(String(store?.image_url || '').trim()),
      hasCoords: getHasCoords ? Boolean(getHasCoords(store)) : null,
    }
  })
}

export function getSearchScore(entry, queryMeta) {
  if (!entry || !queryMeta?.term) return null

  const {
    term,
    normalizedTerm,
    phoneticTerm,
    words,
    phoneticWords,
  } = queryMeta

  const hasExactLike = (
    entry.nameLower.includes(term)
    || entry.normalizedName.includes(normalizedTerm)
    || entry.phoneticName.includes(phoneticTerm)
  )
  if (hasExactLike) return 2

  const allWordsMatch = words.length > 1 && words.every((word, index) => {
    const phoneticWord = phoneticWords[index] || normalizeVietnamesePhonetics(word)
    return entry.normalizedName.includes(word) || entry.phoneticName.includes(phoneticWord)
  })
  if (allWordsMatch) return 1

  const anyWordMatch = words.some((word, index) => {
    const phoneticWord = phoneticWords[index] || normalizeVietnamesePhonetics(word)
    return entry.normalizedName.includes(word) || entry.phoneticName.includes(phoneticWord)
  })
  if (anyWordMatch) return 0

  return null
}

export function matchesSearchQuery(entry, queryMeta) {
  return getSearchScore(entry, queryMeta) != null
}
