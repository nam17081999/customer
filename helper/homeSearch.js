import { haversineKm } from '@/helper/distance'
import { parseCoordinate } from '@/helper/coordinate'
import { createSearchQueryMeta, getSearchScore } from '@/helper/storeSearch'

export const FILTER_FLAG_HAS_PHONE = 'has_phone'
export const FILTER_FLAG_HAS_IMAGE = 'has_image'
export const FILTER_FLAG_NO_LOCATION = 'has_no_location'
export const FILTER_FLAG_POTENTIAL = 'is_potential'

export function hasStoreCoordinates(store) {
  return Number.isFinite(parseCoordinate(store?.latitude)) && Number.isFinite(parseCoordinate(store?.longitude))
}

export function parseQueryList(rawValue) {
  if (!rawValue) return []
  const values = Array.isArray(rawValue) ? rawValue : [rawValue]
  return Array.from(
    new Set(
      values
        .flatMap((value) => String(value).split(','))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )
}

export function buildSearchRouteQuery({
  searchTerm,
  selectedDistrict,
  selectedWard,
  selectedStoreTypes,
  selectedDetailFlags,
}) {
  const query = {}
  if (String(searchTerm || '').trim()) query.q = String(searchTerm).trim()
  if (selectedDistrict) query.district = selectedDistrict
  if (selectedWard) query.ward = selectedWard
  if (selectedStoreTypes.length) query.types = selectedStoreTypes.join(',')
  if (selectedDetailFlags.length) query.flags = selectedDetailFlags.join(',')
  return query
}

export function serializeRouteQuery(query) {
  return JSON.stringify(
    Object.keys(query || {})
      .sort()
      .reduce((acc, key) => {
        acc[key] = query[key]
        return acc
      }, {})
  )
}

export function buildSearchStateFromRouteQuery(query = {}) {
  const { q, district, districts, ward, wards, types, flags } = query
  const selectedDistrict = parseQueryList(districts || district)[0] || ''
  const selectedWard = parseQueryList(wards || ward)[0] || ''
  const selectedStoreTypes = parseQueryList(types)
  const selectedDetailFlags = parseQueryList(flags)

  return {
    searchTerm: q ? String(q) : '',
    selectedDistrict,
    selectedWard,
    selectedStoreTypes,
    selectedDetailFlags,
    showDetailedFilters: Boolean(
      selectedDistrict
      || selectedWard
      || selectedStoreTypes.length
      || selectedDetailFlags.length
    ),
  }
}

export function hasActiveSearchCriteria({
  searchTerm,
  selectedDistrict,
  selectedWard,
  selectedStoreTypes,
  selectedDetailFlags,
}) {
  return Boolean(
    String(searchTerm || '').trim()
    || selectedDistrict
    || selectedWard
    || selectedStoreTypes.length
    || selectedDetailFlags.length
  )
}

export function countActiveFilters({
  selectedDistrict,
  selectedWard,
  selectedStoreTypes,
  selectedDetailFlags,
}) {
  return (selectedDistrict ? 1 : 0)
    + (selectedWard ? 1 : 0)
    + selectedStoreTypes.length
    + selectedDetailFlags.length
}

function computeDistance(store, refLoc) {
  if (!refLoc) return null
  const lat = parseCoordinate(store?.latitude)
  const lng = parseCoordinate(store?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return haversineKm(refLoc.latitude, refLoc.longitude, lat, lng)
}

export function filterAndSortSearchResults({
  indexedStores,
  searchTerm,
  selectedDistrict,
  selectedWard,
  selectedStoreTypes,
  selectedDetailFlags,
  currentLocation,
}) {
  let results = Array.isArray(indexedStores) ? indexedStores : []
  const queryMeta = createSearchQueryMeta(searchTerm)
  const hasTextSearch = Boolean(queryMeta.term)

  if (selectedDistrict) {
    results = results.filter(({ store }) => store.district === selectedDistrict)
  }
  if (selectedWard) {
    results = results.filter(({ store }) => store.ward === selectedWard)
  }
  if (selectedStoreTypes.length > 0) {
    results = results.filter(({ store }) => selectedStoreTypes.includes(store.store_type || ''))
  }
  if (selectedDetailFlags.includes(FILTER_FLAG_HAS_PHONE)) {
    results = results.filter((entry) => entry.hasPhone)
  }
  if (selectedDetailFlags.includes(FILTER_FLAG_HAS_IMAGE)) {
    results = results.filter((entry) => entry.hasImage)
  }
  if (selectedDetailFlags.includes(FILTER_FLAG_NO_LOCATION)) {
    results = results.filter((entry) => !entry.hasCoords)
  }
  if (selectedDetailFlags.includes(FILTER_FLAG_POTENTIAL)) {
    results = results.filter(({ store }) => Boolean(store.is_potential))
  }

  if (hasTextSearch) {
    results = results
      .map((entry) => {
        const score = getSearchScore(entry, queryMeta)
        if (score == null) return null
        return { entry, score }
      })
      .filter(Boolean)
  } else {
    results = results.map((entry) => ({ entry, score: 2 }))
  }

  results = results.map(({ entry, score }) => ({
    ...entry.store,
    _score: score,
    distance: computeDistance(entry.store, currentLocation),
  }))

  return results.slice().sort((a, b) => {
    if (hasTextSearch) {
      const sa = a._score ?? 2
      const sb = b._score ?? 2
      if (sb !== sa) return sb - sa
    }

    const aHasDistance = a.distance != null
    const bHasDistance = b.distance != null
    if (aHasDistance && bHasDistance && a.distance !== b.distance) {
      return a.distance - b.distance
    }
    if (aHasDistance !== bHasDistance) return aHasDistance ? -1 : 1
    if (a.active !== b.active) return a.active ? -1 : 1
    const da = a.created_at || ''
    const db = b.created_at || ''
    return db.localeCompare(da)
  })
}
