import { DISTRICT_WARD_SUGGESTIONS } from '@/lib/constants'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { filterAndRankIndexedStores } from '@/helper/storeSearch'

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeFilterValue(value) {
  return removeVietnameseTones(String(value || '').trim())
}

export function buildMapAvailableWards(selectedDistricts = []) {
  if (!Array.isArray(selectedDistricts) || selectedDistricts.length === 0) return []

  const wards = []
  selectedDistricts.forEach((district) => {
    const districtName = normalizeText(district)
    if (!districtName) return
    wards.push(...(DISTRICT_WARD_SUGGESTIONS[districtName] || []))
  })
  return wards
}

export function buildMapStoreCounts(stores = []) {
  const districtCounts = {}
  const wardCounts = {}

  ;(Array.isArray(stores) ? stores : []).forEach((store) => {
    const district = normalizeText(store?.district)
    const ward = normalizeText(store?.ward)

    if (district) districtCounts[district] = (districtCounts[district] || 0) + 1
    if (ward) wardCounts[ward] = (wardCounts[ward] || 0) + 1
  })

  return { districtCounts, wardCounts }
}

export function buildMapStoreTypeCounts(stores = []) {
  const counts = {}

  ;(Array.isArray(stores) ? stores : []).forEach((store) => {
    const storeType = normalizeText(store?.store_type)
    if (!storeType) return
    counts[storeType] = (counts[storeType] || 0) + 1
  })

  return counts
}

export function toggleMapDistrictSelection({
  selectedDistricts = [],
  selectedWards = [],
  district,
}) {
  const districtName = normalizeText(district)
  if (!districtName) {
    return {
      selectedDistricts: Array.isArray(selectedDistricts) ? selectedDistricts : [],
      selectedWards: Array.isArray(selectedWards) ? selectedWards : [],
    }
  }

  const safeDistricts = Array.isArray(selectedDistricts) ? selectedDistricts : []
  const safeWards = Array.isArray(selectedWards) ? selectedWards : []

  if (safeDistricts.includes(districtName)) {
    const nextDistricts = safeDistricts.filter((value) => value !== districtName)
    const removedWards = new Set((DISTRICT_WARD_SUGGESTIONS[districtName] || []).map(normalizeText))
    return {
      selectedDistricts: nextDistricts,
      selectedWards: safeWards.filter((ward) => !removedWards.has(normalizeText(ward))),
    }
  }

  return {
    selectedDistricts: [...safeDistricts, districtName],
    selectedWards: safeWards,
  }
}

export function toggleMapMultiSelect(values = [], value) {
  const safeValues = Array.isArray(values) ? values : []
  return safeValues.includes(value)
    ? safeValues.filter((item) => item !== value)
    : [...safeValues, value]
}

export function hasActiveMapFilters({
  selectedDistricts = [],
  selectedWards = [],
  selectedStoreTypes = [],
}) {
  return selectedDistricts.length > 0 || selectedWards.length > 0 || selectedStoreTypes.length > 0
}

export function buildMapSearchResults({
  indexedStores,
  searchTerm,
  currentLocation,
  selectedDistricts = [],
  selectedWards = [],
  selectedStoreTypes = [],
}) {
  const districtSet = new Set(selectedDistricts.map(normalizeFilterValue).filter(Boolean))
  const wardSet = new Set(selectedWards.map(normalizeFilterValue).filter(Boolean))
  const typeSet = new Set(selectedStoreTypes.map(normalizeFilterValue).filter(Boolean))

  return filterAndRankIndexedStores({
    indexedStores,
    searchTerm,
    currentLocation,
    predicate: (entry) => {
      const district = entry.normalizedDistrict
      const ward = entry.normalizedWard
      const storeType = entry.normalizedStoreType

      if (districtSet.size > 0 && !districtSet.has(district)) return false
      if (wardSet.size > 0 && !wardSet.has(ward)) return false
      if (typeSet.size > 0 && !typeSet.has(storeType)) return false

      return true
    },
  })
}


export function buildMapPanelDerivedData({
  indexedStores,
  searchTerm,
  currentLocation,
  selectedDistricts = [],
  selectedWards = [],
  selectedStoreTypes = [],
  suggestionLimit = 25,
}) {
  const storesAfterAreaFilters = buildMapSearchResults({
    indexedStores,
    searchTerm: '',
    currentLocation,
    selectedDistricts,
    selectedWards,
    selectedStoreTypes: [],
  })

  const filteredStores = selectedStoreTypes.length > 0 || String(searchTerm || '').trim()
    ? buildMapSearchResults({
      indexedStores,
      searchTerm,
      currentLocation,
      selectedDistricts,
      selectedWards,
      selectedStoreTypes,
    })
    : storesAfterAreaFilters

  return {
    storesAfterAreaFilters,
    filteredStores,
    storeTypeCounts: buildMapStoreTypeCounts(storesAfterAreaFilters),
    suggestions: String(searchTerm || '').trim()
      ? filteredStores.slice(0, suggestionLimit)
      : [],
  }
}

export function buildMapSearchSuggestions({
  indexedStores,
  searchTerm,
  currentLocation,
  selectedDistricts = [],
  selectedWards = [],
  selectedStoreTypes = [],
  limit = 25,
}) {
  if (!String(searchTerm || '').trim()) return []

  return buildMapPanelDerivedData({
    indexedStores,
    searchTerm,
    currentLocation,
    selectedDistricts,
    selectedWards,
    selectedStoreTypes,
    suggestionLimit: limit,
  }).suggestions
}
