import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/router'
import { DISTRICT_WARD_SUGGESTIONS } from '@/lib/constants'
import { getOrRefreshStores } from '@/lib/storeCache'
import { buildStoreSearchIndex } from '@/helper/storeSearch'
import {
  buildSearchStateFromRouteQuery,
  countActiveFilters,
  filterAndSortSearchResults,
  hasActiveSearchCriteria,
  hasStoreCoordinates,
  normalizeCreateStoreName,
  shouldShowSearchCreateCta,
  SORT_OPTIONS,
  ACTIVE_STATUS_OPTIONS,
} from '@/helper/homeSearch'
import {
  buildCurrentSearchRouteQuery,
  buildNextSearchRouteQuery,
  buildPersistedSearchHref,
  scheduleSearchRouteSync,
  shouldSyncSearchRoute,
} from '@/helper/homeSearchRouteSync'

const DISTRICTS = Object.keys(DISTRICT_WARD_SUGGESTIONS).sort((a, b) => a.localeCompare(b, 'vi'))
const ALL_WARDS = Array.from(
  new Set(Object.values(DISTRICT_WARD_SUGGESTIONS).flat())
).sort((a, b) => a.localeCompare(b, 'vi'))
const LOCATION_REFRESH_INTERVAL_MS = 3 * 60 * 1000
const LOCATION_REFRESH_COOLDOWN_MS = 5 * 1000
const FLASH_MESSAGE_DURATION_MS = 3800

function persistSearchRoute(query) {
  if (typeof window === 'undefined') return
  const href = buildPersistedSearchHref(query)
  window.sessionStorage.setItem('storevis:last-search-route', href)
  window.dispatchEvent(new CustomEvent('storevis:search-route-changed', { detail: { href } }))
}

export function useHomeSearchController() {
  const router = useRouter()
  const [msgState, setMsgState] = useState({ type: 'info', text: '', show: false })
  const msgTimerRef = useRef(null)
  const [allStores, setAllStores] = useState([])
  const [storesLoaded, setStoresLoaded] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedWard, setSelectedWard] = useState('')
  const [selectedStoreTypes, setSelectedStoreTypes] = useState([])
  const [selectedDetailFlags, setSelectedDetailFlags] = useState([])
  const [sortBy, setSortBy] = useState('distance')
  const [activeStatus, setActiveStatus] = useState('all')
  const [showDetailedFilters, setShowDetailedFilters] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [sortLocation, setSortLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const searchInputRef = useRef(null)
  const virtuosoRef = useRef(null)
  const initializedFromQuery = useRef(false)
  const lastLocationRequestAtRef = useRef(0)
  const lastSearchCriteriaRef = useRef('')
  const isListAtTopRef = useRef(true)
  const pendingSortLocationRef = useRef(null)
  const routerQueryRef = useRef(router.query)
  // Keep routerQueryRef current on every render
  routerQueryRef.current = router.query

  const hasSearchCriteria = hasActiveSearchCriteria({
    searchTerm,
    selectedDistrict,
    selectedWard,
    selectedStoreTypes,
    selectedDetailFlags,
    activeStatus,
  })

  const activeFilterCount = countActiveFilters({
    selectedDistrict,
    selectedWard,
    selectedStoreTypes,
    selectedDetailFlags,
    activeStatus,
  })

  useEffect(() => {
    if (initializedFromQuery.current || !router.isReady) return
    initializedFromQuery.current = true
    const restoredState = buildSearchStateFromRouteQuery(router.query)
    setSearchTerm(restoredState.searchTerm)
    setSelectedDistrict(restoredState.selectedDistrict)
    setSelectedWard(restoredState.selectedWard)
    setSelectedStoreTypes(restoredState.selectedStoreTypes)
    setSelectedDetailFlags(restoredState.selectedDetailFlags)
    setSortBy(restoredState.sortBy)
    setActiveStatus(restoredState.activeStatus)
    setShowDetailedFilters(restoredState.showDetailedFilters)
  }, [router.isReady, router.query])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const consumeFlashMessage = () => {
      const rawFlash = window.sessionStorage.getItem('storevis:flash-message')
      if (!rawFlash) return

      window.sessionStorage.removeItem('storevis:flash-message')
      try {
        const parsed = JSON.parse(rawFlash)
        if (!parsed?.text) return
        if (msgTimerRef.current) {
          clearTimeout(msgTimerRef.current)
        }
        setMsgState({
          type: parsed.type || 'info',
          text: String(parsed.text),
          show: true,
        })
        msgTimerRef.current = setTimeout(() => {
          setMsgState((prev) => ({ ...prev, show: false }))
          msgTimerRef.current = null
        }, FLASH_MESSAGE_DURATION_MS)
      } catch {
        // Ignore malformed flash payload.
      }
    }

    const handleFlashEvent = () => consumeFlashMessage()
    consumeFlashMessage()
    window.addEventListener('storevis:flash-message', handleFlashEvent)

    return () => {
      window.removeEventListener('storevis:flash-message', handleFlashEvent)
      if (msgTimerRef.current) {
        clearTimeout(msgTimerRef.current)
        msgTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!initializedFromQuery.current || !router.isReady) return

    const nextQuery = buildNextSearchRouteQuery({
      searchTerm,
      selectedDistrict,
      selectedWard,
      selectedStoreTypes,
      selectedDetailFlags,
      sortBy,
      activeStatus,
    })
    const currentQuery = buildCurrentSearchRouteQuery(routerQueryRef.current)

    if (!shouldSyncSearchRoute(nextQuery, currentQuery)) return

    return scheduleSearchRouteSync({
      nextQuery,
      pathname: router.pathname,
      replace: router.replace.bind(router),
      persist: persistSearchRoute,
      setTimer: window.setTimeout.bind(window),
    })
  }, [searchTerm, selectedDistrict, selectedWard, selectedStoreTypes, selectedDetailFlags, sortBy, activeStatus, router])

  const wardOptions = useMemo(() => (
    selectedDistrict
      ? (DISTRICT_WARD_SUGGESTIONS[selectedDistrict] || []).slice().sort((a, b) => a.localeCompare(b, 'vi'))
      : ALL_WARDS
  ), [selectedDistrict])

  useEffect(() => {
    if (!selectedDistrict || !selectedWard) return
    if (!wardOptions.includes(selectedWard)) {
      setSelectedWard('')
    }
  }, [selectedDistrict, selectedWard, wardOptions])

  const toggleFilterValue = useCallback((setter, value) => {
    setter((prev) => (
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    ))
  }, [])

  const refreshCurrentLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return

    const now = Date.now()
    if (now - lastLocationRequestAtRef.current < LOCATION_REFRESH_COOLDOWN_MS) return
    lastLocationRequestAtRef.current = now

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        console.error('Error getting location:', error)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [])

  useEffect(() => {
    refreshCurrentLocation()
  }, [refreshCurrentLocation])

  const commitSortLocation = useCallback((location) => {
    if (!location) return
    setSortLocation((prev) => {
      if (
        prev
        && prev.latitude === location.latitude
        && prev.longitude === location.longitude
      ) {
        return prev
      }
      return location
    })
  }, [])

  const handleListAtTopChange = useCallback((isAtTop) => {
    isListAtTopRef.current = isAtTop

    if (isAtTop && pendingSortLocationRef.current) {
      commitSortLocation(pendingSortLocationRef.current)
      pendingSortLocationRef.current = null
    }
  }, [commitSortLocation])

  useEffect(() => {
    if (!currentLocation) return

    if (!sortLocation || isListAtTopRef.current) {
      commitSortLocation(currentLocation)
      pendingSortLocationRef.current = null
      return
    }

    pendingSortLocationRef.current = currentLocation
  }, [commitSortLocation, currentLocation, sortLocation])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshCurrentLocation()
      }
    }, LOCATION_REFRESH_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [refreshCurrentLocation])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshCurrentLocation()
      }
    }
    const handleFocus = () => {
      refreshCurrentLocation()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('pageshow', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pageshow', handleFocus)
    }
  }, [refreshCurrentLocation])

  const loadAllStores = useCallback(async () => {
    setLoading(true)
    setHasError(false)
    try {
      const data = await getOrRefreshStores()
      setAllStores(data)
      setStoresLoaded(true)
    } catch (err) {
      console.error('Failed to load stores:', err)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAllStores()
  }, [loadAllStores])

  const applyStoreChange = useCallback((detail = {}) => {
    const { type, id, ids, store, stores } = detail

    setAllStores((prev) => {
      if (type === 'delete' && id != null) {
        return prev.filter((item) => item.id !== id)
      }

      if (type === 'verify-many' && Array.isArray(ids) && ids.length > 0) {
        const idSet = new Set(ids)
        return prev.map((item) => (
          idSet.has(item.id) ? { ...item, active: true } : item
        ))
      }

      if (type === 'append-many' && Array.isArray(stores) && stores.length > 0) {
        const byId = new Map(prev.map((item) => [item.id, item]))
        stores.forEach((item) => {
          if (item?.id != null) byId.set(item.id, item)
        })
        return Array.from(byId.values())
      }

      if (type === 'update' && store?.id != null) {
        let found = false
        const next = prev.map((item) => {
          if (item.id !== store.id) return item
          found = true
          return { ...item, ...store }
        })
        return found ? next : [...prev, store]
      }

      return prev
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStoresChanged = async (event) => {
      const detail = event?.detail || {}
      const shouldRefetchAll = Boolean(event?.detail?.shouldRefetchAll)
      if (!shouldRefetchAll) applyStoreChange(detail)
      if (shouldRefetchAll) {
        await loadAllStores()
      }
    }

    window.addEventListener('storevis:stores-changed', handleStoresChanged)
    return () => window.removeEventListener('storevis:stores-changed', handleStoresChanged)
  }, [applyStoreChange, loadAllStores])

  const indexedStores = useMemo(() => buildStoreSearchIndex(allStores, {
    getHasCoords: hasStoreCoordinates,
  }), [allStores])

  const searchResults = useMemo(() => {
    if (!storesLoaded) return []
    return filterAndSortSearchResults({
      indexedStores,
      searchTerm,
      selectedDistrict,
      selectedWard,
      selectedStoreTypes,
      selectedDetailFlags,
      currentLocation: sortLocation,
      activeStatus,
      sortBy,
    })
  }, [
    indexedStores,
    storesLoaded,
    searchTerm,
    selectedDistrict,
    selectedWard,
    selectedStoreTypes,
    selectedDetailFlags,
    sortLocation,
    activeStatus,
    sortBy,
  ])

  const showCreateStoreCta = useMemo(() => {
    if (!storesLoaded) return false
    return shouldShowSearchCreateCta({ indexedStores, searchTerm })
  }, [indexedStores, searchTerm, storesLoaded])

  const createStoreHref = useMemo(() => ({
    pathname: '/store/create',
    query: {
      name: normalizeCreateStoreName(searchTerm),
      step: '2',
    },
  }), [searchTerm])

  const handleCreateStoreClick = useCallback(async () => {
    const nextQuery = buildNextSearchRouteQuery({
      searchTerm,
      selectedDistrict,
      selectedWard,
      selectedStoreTypes,
      selectedDetailFlags,
    })

    persistSearchRoute(nextQuery)
    await router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
    await router.push(createStoreHref)
  }, [
    createStoreHref,
    router,
    searchTerm,
    selectedDistrict,
    selectedWard,
    selectedStoreTypes,
    selectedDetailFlags,
  ])

  const showSkeleton = loading || !storesLoaded

  useEffect(() => {
    if (searchInputRef.current && window.innerWidth >= 768) {
      try { searchInputRef.current.focus() } catch { }
    }
  }, [])

  const clearAllFilters = useCallback(() => {
    setSearchTerm('')
    setSelectedDistrict('')
    setSelectedWard('')
    setSelectedStoreTypes([])
    setSelectedDetailFlags([])
    setSortBy('distance')
    setActiveStatus('all')
  }, [])

  useEffect(() => {
    const nextCriteria = JSON.stringify({
      searchTerm: searchTerm.trim(),
      selectedDistrict,
      selectedWard,
      selectedStoreTypes,
      selectedDetailFlags,
    })

    if (lastSearchCriteriaRef.current === '') {
      lastSearchCriteriaRef.current = nextCriteria
      return
    }

    if (lastSearchCriteriaRef.current === nextCriteria) return
    lastSearchCriteriaRef.current = nextCriteria

    if (currentLocation) {
      commitSortLocation(currentLocation)
      pendingSortLocationRef.current = null
    }

    virtuosoRef.current?.scrollToIndex({
      index: 0,
      align: 'start',
      behavior: 'auto',
    })
  }, [commitSortLocation, currentLocation, searchTerm, selectedDistrict, selectedWard, selectedStoreTypes, selectedDetailFlags, sortBy, activeStatus])

  return {
    msgState,
    searchInputRef,
    virtuosoRef,
    searchTerm,
    setSearchTerm,
    selectedDistrict,
    setSelectedDistrict,
    selectedWard,
    setSelectedWard,
    selectedStoreTypes,
    setSelectedStoreTypes,
    selectedDetailFlags,
    setSelectedDetailFlags,
    sortBy,
    setSortBy,
    activeStatus,
    setActiveStatus,
    showDetailedFilters,
    setShowDetailedFilters,
    activeFilterCount,
    hasSearchCriteria,
    wardOptions,
    districtOptions: DISTRICTS,
    toggleFilterValue,
    clearAllFilters,
    handleListAtTopChange,
    searchResults,
    showCreateStoreCta,
    createStoreHref,
    handleCreateStoreClick,
    showSkeleton,
    hasError,
    retryLoadStores: loadAllStores,
    SORT_OPTIONS,
    ACTIVE_STATUS_OPTIONS,
  }
}
