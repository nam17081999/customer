import { parseCoordinate } from '@/helper/coordinate'
import { createSearchQueryMeta, filterAndRankIndexedStores } from '@/helper/storeSearch'

export const FILTER_FLAG_HAS_PHONE = 'has_phone'
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

function parseCoordinateSelectedText(value) {
  return String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
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

export function filterAndSortSearchResults({
  indexedStores,
  searchTerm,
  selectedDistrict,
  selectedWard,
  selectedStoreTypes,
  selectedDetailFlags,
  currentLocation,
}) {
  return filterAndRankIndexedStores({
    indexedStores,
    searchTerm,
    currentLocation,
    predicate: (entry) => {
      const { store, hasPhone, hasCoords, normalizedDistrict, normalizedWard, normalizedStoreType } = entry

      if (selectedDistrict && normalizedDistrict !== parseCoordinateSelectedText(selectedDistrict)) return false
      if (selectedWard && normalizedWard !== parseCoordinateSelectedText(selectedWard)) return false
      if (selectedStoreTypes.length > 0 && !selectedStoreTypes.some((value) => normalizedStoreType === parseCoordinateSelectedText(value))) return false
      if (selectedDetailFlags.includes(FILTER_FLAG_HAS_PHONE) && !hasPhone) return false
      if (selectedDetailFlags.includes(FILTER_FLAG_NO_LOCATION) && hasCoords) return false
      if (selectedDetailFlags.includes(FILTER_FLAG_POTENTIAL) && !Boolean(store.is_potential)) return false

      return true
    },
  })
}

export function shouldShowSearchCreateCta({ indexedStores, searchTerm }) {
  const queryMeta = createSearchQueryMeta(searchTerm)
  if (queryMeta.words.length < 2) return false

  const exactName = queryMeta.words.join(' ')
  return !(Array.isArray(indexedStores) ? indexedStores : []).some((entry) => (
    String(entry?.normalizedName || '').split(/\s+/).filter(Boolean).join(' ') === exactName
  ))
}

export function normalizeCreateStoreName(searchTerm) {
  return String(searchTerm || '').trim().split(/\s+/).filter(Boolean).join(' ')
}
