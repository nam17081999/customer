import { useCallback, useMemo, useState } from 'react'

import { filterMapStoresByAreaSelection } from '@/helper/mapFilter'
import {
  buildMapAvailableWards,
  buildMapSearchSuggestions,
  buildMapStoreCounts,
  buildMapStoreTypeCounts,
  hasActiveMapFilters,
  toggleMapDistrictSelection,
  toggleMapMultiSelect,
} from '@/helper/mapSearchPanel'

export function useMapSearchPanelController({
  storesWithCoords,
  indexedMapStores,
  currentLocation,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const [selectedDistricts, setSelectedDistricts] = useState([])
  const [selectedWards, setSelectedWards] = useState([])
  const [selectedStoreTypes, setSelectedStoreTypes] = useState([])

  const availableWards = useMemo(
    () => buildMapAvailableWards(selectedDistricts),
    [selectedDistricts]
  )

  const storeCounts = useMemo(
    () => buildMapStoreCounts(storesWithCoords),
    [storesWithCoords]
  )

  const storesAfterAreaFilters = useMemo(
    () => filterMapStoresByAreaSelection(storesWithCoords, selectedDistricts, selectedWards),
    [selectedDistricts, selectedWards, storesWithCoords]
  )

  const filteredStores = useMemo(() => {
    return storesAfterAreaFilters.filter((store) => {
      return selectedStoreTypes.length === 0 || selectedStoreTypes.includes(store.store_type || '')
    })
  }, [selectedStoreTypes, storesAfterAreaFilters])

  const storeTypeCounts = useMemo(
    () => buildMapStoreTypeCounts(storesAfterAreaFilters),
    [storesAfterAreaFilters]
  )

  const suggestions = useMemo(() => buildMapSearchSuggestions({
    indexedStores: indexedMapStores,
    searchTerm,
    currentLocation,
    limit: 25,
  }), [currentLocation, indexedMapStores, searchTerm])

  const filtersActive = hasActiveMapFilters({
    selectedDistricts,
    selectedWards,
    selectedStoreTypes,
  })

  const handleSearchInputChange = useCallback((value) => {
    setSearchTerm(value)
    setShowSuggestions(true)
    setActiveSuggestion(-1)
  }, [])

  const handleSearchFocus = useCallback(() => {
    if (searchTerm.trim()) setShowSuggestions(true)
  }, [searchTerm])

  const closeSuggestions = useCallback(() => {
    setShowSuggestions(false)
  }, [])

  const resetActiveSuggestion = useCallback(() => {
    setActiveSuggestion(-1)
  }, [])

  const moveActiveSuggestion = useCallback((direction, itemCount) => {
    if (direction === 'down') {
      setActiveSuggestion((index) => Math.min(index + 1, itemCount - 1))
      return
    }
    if (direction === 'up') {
      setActiveSuggestion((index) => Math.max(index - 1, -1))
    }
  }, [])

  const handleSuggestionsScroll = useCallback((element) => {
    if (!element) {
      setCanScrollDown(false)
      return
    }
    setCanScrollDown(element.scrollTop + element.clientHeight < element.scrollHeight - 2)
  }, [])

  const syncSuggestionScrollHint = useCallback((element) => {
    if (!element) {
      setCanScrollDown(false)
      return
    }
    setCanScrollDown(element.scrollHeight > element.clientHeight + 2)
  }, [])

  const toggleDistrict = useCallback((district) => {
    setSelectedDistricts((currentDistricts) => {
      const nextState = toggleMapDistrictSelection({
        selectedDistricts: currentDistricts,
        selectedWards,
        district,
      })
      setSelectedWards(nextState.selectedWards)
      return nextState.selectedDistricts
    })
  }, [selectedWards])

  const toggleWard = useCallback((ward) => {
    setSelectedWards((currentWards) => toggleMapMultiSelect(currentWards, ward))
  }, [])

  const toggleStoreType = useCallback((storeType) => {
    setSelectedStoreTypes((currentTypes) => toggleMapMultiSelect(currentTypes, storeType))
  }, [])

  const clearFilters = useCallback(() => {
    setSelectedDistricts([])
    setSelectedWards([])
    setSelectedStoreTypes([])
  }, [])

  return {
    searchTerm,
    setSearchTerm,
    showSuggestions,
    setShowSuggestions,
    activeSuggestion,
    setActiveSuggestion,
    canScrollDown,
    selectedDistricts,
    selectedWards,
    selectedStoreTypes,
    storesAfterAreaFilters,
    filteredStores,
    availableWards,
    storeCounts,
    storeTypeCounts,
    suggestions,
    filtersActive,
    handleSearchInputChange,
    handleSearchFocus,
    closeSuggestions,
    resetActiveSuggestion,
    moveActiveSuggestion,
    handleSuggestionsScroll,
    syncSuggestionScrollHint,
    toggleDistrict,
    toggleWard,
    toggleStoreType,
    clearFilters,
  }
}
