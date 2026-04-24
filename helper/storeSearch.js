import removeVietnameseTones, { normalizeVietnamesePhonetics } from '@/helper/removeVietnameseTones'
import { haversineKm } from '@/helper/distance'
import { parseCoordinate } from '@/helper/coordinate'

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

function computeDistance(store, currentLocation) {
  if (!currentLocation) return null

  const lat = parseCoordinate(store?.latitude)
  const lng = parseCoordinate(store?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return haversineKm(currentLocation.latitude, currentLocation.longitude, lat, lng)
}

function compareRankedStores(a, b, hasTextSearch) {
  if (hasTextSearch) {
    const scoreA = a._score ?? 2
    const scoreB = b._score ?? 2
    if (scoreB !== scoreA) return scoreB - scoreA
  }

  const aHasDistance = a.distance != null
  const bHasDistance = b.distance != null
  if (aHasDistance && bHasDistance && a.distance !== b.distance) {
    return a.distance - b.distance
  }
  if (aHasDistance !== bHasDistance) return aHasDistance ? -1 : 1
  if (a.active !== b.active) return a.active ? -1 : 1

  const createdAtA = a.created_at || ''
  const createdAtB = b.created_at || ''
  return createdAtB.localeCompare(createdAtA)
}

export function rankStoreSearchResults({
  indexedStores,
  searchTerm,
  currentLocation,
  limit,
}) {
  const safeIndexedStores = Array.isArray(indexedStores) ? indexedStores : []
  const queryMeta = createSearchQueryMeta(searchTerm)
  const hasTextSearch = Boolean(queryMeta.term)

  const rankedResults = (hasTextSearch
    ? safeIndexedStores
      .map((entry) => {
        const score = getSearchScore(entry, queryMeta)
        if (score == null) return null
        return { entry, score }
      })
      .filter(Boolean)
    : safeIndexedStores.map((entry) => ({ entry, score: 2 }))
  )
    .map(({ entry, score }) => ({
      ...entry.store,
      _score: score,
      distance: computeDistance(entry.store, currentLocation),
    }))
    .sort((a, b) => compareRankedStores(a, b, hasTextSearch))

  return Number.isInteger(limit) && limit >= 0
    ? rankedResults.slice(0, limit)
    : rankedResults
}
