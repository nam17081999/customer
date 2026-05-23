import removeVietnameseTones, { normalizeVietnamesePhonetics } from '@/helper/removeVietnameseTones'
import { haversineKm } from '@/helper/distance'
import { parseCoordinate } from '@/helper/coordinate'


function normalizeLooseText(value) {
  return removeVietnameseTones(String(value || '').trim())
}

function collapseRepeatedCharacters(value) {
  return String(value || '').replace(/([a-z0-9])\1+/g, '$1')
}

export function createSearchQueryMeta(rawValue) {
  const term = String(rawValue || '').trim().toLowerCase()
  const normalizedTerm = removeVietnameseTones(term)
  const phoneticTerm = normalizeVietnamesePhonetics(term)
  const relaxedNormalizedTerm = collapseRepeatedCharacters(normalizedTerm)
  const relaxedPhoneticTerm = collapseRepeatedCharacters(phoneticTerm)

  return {
    term,
    normalizedTerm,
    phoneticTerm,
    relaxedNormalizedTerm,
    relaxedPhoneticTerm,
    words: normalizedTerm.split(/\s+/).filter(Boolean),
    phoneticWords: phoneticTerm.split(/\s+/).filter(Boolean),
    relaxedWords: relaxedNormalizedTerm.split(/\s+/).filter(Boolean),
    relaxedPhoneticWords: relaxedPhoneticTerm.split(/\s+/).filter(Boolean),
  }
}

export function buildStoreSearchIndex(stores, options = {}) {
  const getHasCoords = typeof options.getHasCoords === 'function' ? options.getHasCoords : null

  return (Array.isArray(stores) ? stores : []).map((store) => {
    const nameLower = String(store?.name || '').toLowerCase()
    const normalizedName = removeVietnameseTones(nameLower)
    const phoneticName = normalizeVietnamesePhonetics(nameLower)

    return {
      store,
      nameLower,
      normalizedName,
      phoneticName,
      relaxedNormalizedName: collapseRepeatedCharacters(normalizedName),
      relaxedPhoneticName: collapseRepeatedCharacters(phoneticName),
      normalizedDistrict: normalizeLooseText(store?.district),
      normalizedWard: normalizeLooseText(store?.ward),
      normalizedStoreType: normalizeLooseText(store?.store_type),
      hasPhone: Boolean(String(store?.phone || '').trim()),
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
    relaxedNormalizedTerm,
    relaxedPhoneticTerm,
    words,
    phoneticWords,
    relaxedWords,
    relaxedPhoneticWords,
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

  const hasRelaxedExactLike = (
    relaxedNormalizedTerm
    && (
      entry.relaxedNormalizedName.includes(relaxedNormalizedTerm)
      || entry.relaxedPhoneticName.includes(relaxedPhoneticTerm)
    )
  )
  if (hasRelaxedExactLike) return -1

  const relaxedAnyWordMatch = relaxedWords.some((word, index) => {
    const relaxedPhoneticWord = relaxedPhoneticWords[index] || collapseRepeatedCharacters(normalizeVietnamesePhonetics(word))
    return entry.relaxedNormalizedName.includes(word) || entry.relaxedPhoneticName.includes(relaxedPhoneticWord)
  })
  if (relaxedAnyWordMatch) return -2

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

export function compareRankedStores(a, b, hasTextSearch) {
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

export function filterAndRankIndexedStores({
  indexedStores,
  searchTerm,
  currentLocation,
  limit,
  predicate,
}) {
  const safeIndexedStores = Array.isArray(indexedStores) ? indexedStores : []
  const entryPredicate = typeof predicate === 'function' ? predicate : null
  const queryMeta = createSearchQueryMeta(searchTerm)
  const hasTextSearch = Boolean(queryMeta.term)
  const rankedResults = []

  safeIndexedStores.forEach((entry) => {
    if (entryPredicate && !entryPredicate(entry)) return

    const score = hasTextSearch ? getSearchScore(entry, queryMeta) : 2
    if (score == null) return

    rankedResults.push({
      ...entry.store,
      _score: score,
      distance: computeDistance(entry.store, currentLocation),
    })
  })

  rankedResults.sort((a, b) => compareRankedStores(a, b, hasTextSearch))

  return Number.isInteger(limit) && limit >= 0
    ? rankedResults.slice(0, limit)
    : rankedResults
}

export function rankStoreSearchResults({
  indexedStores,
  searchTerm,
  currentLocation,
  limit,
}) {
  return filterAndRankIndexedStores({
    indexedStores,
    searchTerm,
    currentLocation,
    limit,
  })
}
