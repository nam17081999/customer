import { parseCoordinate } from '@/helper/coordinate'
import { createSearchQueryMeta, filterAndRankIndexedStores } from '@/helper/storeSearch'
import { normalizeNameForMatch, extractWords, containsAllInputWords } from '@/helper/duplicateCheck'

export const FILTER_FLAG_HAS_PHONE = 'has_phone'
export const FILTER_FLAG_NO_LOCATION = 'has_no_location'
export const FILTER_FLAG_POTENTIAL = 'is_potential'

export const SORT_OPTIONS = [
  { value: 'distance', label: 'Gần nhất' },
  { value: 'name', label: 'Tên A-Z' },
  { value: 'newest', label: 'Mới nhất' },
  { value: 'updated', label: 'Mới cập nhật' },
]

export const ACTIVE_STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đã duyệt' },
  { value: 'inactive', label: 'Chưa duyệt' },
]

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
  sortBy,
  activeStatus,
}) {
  const query = {}
  if (String(searchTerm || '').trim()) query.q = String(searchTerm).trim()
  if (selectedDistrict) query.district = selectedDistrict
  if (selectedWard) query.ward = selectedWard
  if (selectedStoreTypes.length) query.types = selectedStoreTypes.join(',')
  if (selectedDetailFlags.length) query.flags = selectedDetailFlags.join(',')
  if (sortBy && sortBy !== 'distance') query.sort = sortBy
  if (activeStatus && activeStatus !== 'all') query.active = activeStatus
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
  const { q, district, districts, ward, wards, types, flags, sort, active } = query
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
    sortBy: SORT_OPTIONS.some((o) => o.value === sort) ? sort : 'distance',
    activeStatus: ACTIVE_STATUS_OPTIONS.some((o) => o.value === active) ? active : 'all',
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
  activeStatus,
}) {
  return Boolean(
    String(searchTerm || '').trim()
    || selectedDistrict
    || selectedWard
    || selectedStoreTypes.length
    || selectedDetailFlags.length
    || (activeStatus && activeStatus !== 'all')
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
  activeStatus,
}) {
  return (selectedDistrict ? 1 : 0)
    + (selectedWard ? 1 : 0)
    + selectedStoreTypes.length
    + selectedDetailFlags.length
    + (activeStatus && activeStatus !== 'all' ? 1 : 0)
}

export function filterAndSortSearchResults({
  indexedStores,
  searchTerm,
  selectedDistrict,
  selectedWard,
  selectedStoreTypes,
  selectedDetailFlags,
  currentLocation,
  activeStatus,
  sortBy,
}) {
  const rawResults = filterAndRankIndexedStores({
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
      if (activeStatus === 'active' && !store.active) return false
      if (activeStatus === 'inactive' && store.active) return false

      return true
    },
  })

  // Apply sort
  if (sortBy && sortBy !== 'distance') {
    const sorted = [...rawResults]
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'))
        break
      case 'newest':
        sorted.sort((a, b) => ((b.created_at || '') > (a.created_at || '') ? 1 : -1))
        break
      case 'updated':
        sorted.sort((a, b) => ((b.updated_at || '') > (a.updated_at || '') ? 1 : -1))
        break
    }
    return sorted
  }

  return rawResults
}

export function shouldShowSearchCreateCta({ indexedStores, searchTerm }) {
  const term = String(searchTerm || '').trim()
  if (!term) return false

  const inputNorm = normalizeNameForMatch(term)
  if (!inputNorm) return false

  const inputWords = extractWords(inputNorm)
  if (inputWords.length === 0) return false

  // Dùng cùng logic với findGlobalExactNameMatches
  const stores = (Array.isArray(indexedStores) ? indexedStores : []).map(e => e.store).filter(Boolean)
  const hasExactMatch = stores.some((store) => containsAllInputWords(inputWords, store?.name || ''))
  return !hasExactMatch
}

export function normalizeCreateStoreName(searchTerm) {
  return String(searchTerm || '').trim().split(/\s+/).filter(Boolean).join(' ')
}
