import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/router'
import { Virtuoso } from 'react-virtuoso'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Msg } from '@/components/ui/msg'
import { DISTRICT_WARD_SUGGESTIONS, STORE_TYPE_OPTIONS } from '@/lib/constants'
import Link from 'next/link'
import { haversineKm } from '@/helper/distance'
import SearchStoreCard from '@/components/search-store-card'
import { getOrRefreshStores } from '@/lib/storeCache'
import removeVietnameseTones, { normalizeVietnamesePhonetics } from '@/helper/removeVietnameseTones'
import { parseCoordinate } from '@/helper/coordinate'

// Districts sorted alphabetically
const DISTRICTS = Object.keys(DISTRICT_WARD_SUGGESTIONS).sort((a, b) => a.localeCompare(b, 'vi'))

// All wards sorted alphabetically
const ALL_WARDS = Array.from(
  new Set(Object.values(DISTRICT_WARD_SUGGESTIONS).flat())
).sort((a, b) => a.localeCompare(b, 'vi'))
const LOCATION_REFRESH_INTERVAL_MS = 3 * 60 * 1000
const LOCATION_REFRESH_COOLDOWN_MS = 5 * 1000
const FILTER_FLAG_HAS_PHONE = 'has_phone'
const FILTER_FLAG_HAS_IMAGE = 'has_image'
const FILTER_FLAG_NO_LOCATION = 'has_no_location'
const FILTER_FLAG_POTENTIAL = 'is_potential'
const FLASH_MESSAGE_DURATION_MS = 3800

function hasStoreCoordinates(store) {
  return Number.isFinite(parseCoordinate(store?.latitude)) && Number.isFinite(parseCoordinate(store?.longitude))
}

function parseQueryList(rawValue) {
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

function buildSearchRouteQuery({
  searchTerm,
  selectedDistrict,
  selectedWard,
  selectedStoreTypes,
  selectedDetailFlags,
}) {
  const query = {}
  if (searchTerm.trim()) query.q = searchTerm.trim()
  if (selectedDistrict) query.district = selectedDistrict
  if (selectedWard) query.ward = selectedWard
  if (selectedStoreTypes.length) query.types = selectedStoreTypes.join(',')
  if (selectedDetailFlags.length) query.flags = selectedDetailFlags.join(',')
  return query
}

function serializeRouteQuery(query) {
  return JSON.stringify(
    Object.keys(query)
      .sort()
      .reduce((acc, key) => {
        acc[key] = query[key]
        return acc
      }, {})
  )
}

function persistSearchRoute(query) {
  if (typeof window === 'undefined') return
  const search = new URLSearchParams(query).toString()
  const href = search ? `/?${search}` : '/'
  window.sessionStorage.setItem('storevis:last-search-route', href)
  window.dispatchEvent(new CustomEvent('storevis:search-route-changed', { detail: { href } }))
}

export default function HomePage() {
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
  const [showDetailedFilters, setShowDetailedFilters] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const searchInputRef = useRef(null)
  const virtuosoRef = useRef(null)
  const initializedFromQuery = useRef(false)
  const lastLocationRequestAtRef = useRef(0)
  const lastSearchCriteriaRef = useRef('')
  const hasSearchCriteria = Boolean(
    searchTerm.trim()
    || selectedDistrict
    || selectedWard
    || selectedStoreTypes.length
    || selectedDetailFlags.length
  )
  const activeFilterCount = (selectedDistrict ? 1 : 0) + (selectedWard ? 1 : 0) + selectedStoreTypes.length + selectedDetailFlags.length

  // Restore state from URL query params on mount (for back-navigation)
  useEffect(() => {
    if (initializedFromQuery.current || !router.isReady) return
    initializedFromQuery.current = true
    const { q, district, districts, ward, wards, types, flags } = router.query
    if (q) setSearchTerm(q)
    const restoredDistricts = parseQueryList(districts || district)
    const restoredWards = parseQueryList(wards || ward)
    const restoredTypes = parseQueryList(types)
    const restoredFlags = parseQueryList(flags)
    if (restoredDistricts.length) setSelectedDistrict(restoredDistricts[0])
    if (restoredWards.length) setSelectedWard(restoredWards[0])
    if (restoredTypes.length) setSelectedStoreTypes(restoredTypes)
    if (restoredFlags.length) setSelectedDetailFlags(restoredFlags)
    if (restoredDistricts.length || restoredWards.length || restoredTypes.length || restoredFlags.length) {
      setShowDetailedFilters(true)
    }
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

  // Sync state to URL query params (shallow, no navigation)
  useEffect(() => {
    if (!initializedFromQuery.current || !router.isReady) return

    const nextQuery = buildSearchRouteQuery({
      searchTerm,
      selectedDistrict,
      selectedWard,
      selectedStoreTypes,
      selectedDetailFlags,
    })
    const currentQuery = buildSearchRouteQuery({
      searchTerm: String(router.query.q || ''),
      selectedDistrict: parseQueryList(router.query.districts || router.query.district)[0] || '',
      selectedWard: parseQueryList(router.query.wards || router.query.ward)[0] || '',
      selectedStoreTypes: parseQueryList(router.query.types),
      selectedDetailFlags: parseQueryList(router.query.flags),
    })

    if (serializeRouteQuery(nextQuery) === serializeRouteQuery(currentQuery)) return

    const syncTimer = window.setTimeout(() => {
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
      persistSearchRoute(nextQuery)
    }, 250)

    return () => window.clearTimeout(syncTimer)
  }, [searchTerm, selectedDistrict, selectedWard, selectedStoreTypes, selectedDetailFlags, router, router.isReady, router.pathname, router.query])

  useEffect(() => {
    if (!initializedFromQuery.current || !router.isReady) return
    persistSearchRoute(buildSearchRouteQuery({
      searchTerm,
      selectedDistrict,
      selectedWard,
      selectedStoreTypes,
      selectedDetailFlags,
    }))
  }, [searchTerm, selectedDistrict, selectedWard, selectedStoreTypes, selectedDetailFlags, router.isReady])

  // Compute ward/district options from static DISTRICT_WARD_SUGGESTIONS
  const wardOptions = useMemo(() => (
    selectedDistrict
      ? (DISTRICT_WARD_SUGGESTIONS[selectedDistrict] || []).slice().sort((a, b) => a.localeCompare(b, 'vi'))
      : ALL_WARDS
  ), [selectedDistrict])
  const districtOptions = DISTRICTS
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
  // Get current location (initial + periodic + when user returns to page)
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

  // Helper: compute distance for a store given current reference
  const computeDistance = useCallback((store, refLoc) => {
    if (!refLoc) return null
    if (store.latitude == null || store.longitude == null) return null
    return haversineKm(refLoc.latitude, refLoc.longitude, store.latitude, store.longitude)
  }, [])

  // Load all stores — always goes through storeCache (which handles 60s cooldown + dedup)
  const loadAllStores = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getOrRefreshStores()
      setAllStores(data)
      setStoresLoaded(true)
    } catch (err) {
      console.error('Failed to load stores:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load on mount so data is ready the moment user starts typing
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

  // Keep results in sync after create/update/delete without full page reload
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

  // Local filtering
  const searchResults = useMemo(() => {
    if (!storesLoaded) return []

    let results = allStores
    const hasTextSearch = Boolean(searchTerm.trim())

    // District filter
    if (selectedDistrict) {
      results = results.filter((s) => s.district === selectedDistrict)
    }
    // Ward filter
    if (selectedWard) {
      results = results.filter((s) => s.ward === selectedWard)
    }
    if (selectedStoreTypes.length > 0) {
      results = results.filter((s) => selectedStoreTypes.includes(s.store_type || ''))
    }
    if (selectedDetailFlags.includes(FILTER_FLAG_HAS_PHONE)) {
      results = results.filter((s) => Boolean(String(s.phone || '').trim()))
    }
    if (selectedDetailFlags.includes(FILTER_FLAG_HAS_IMAGE)) {
      results = results.filter((s) => Boolean(String(s.image_url || '').trim()))
    }
    if (selectedDetailFlags.includes(FILTER_FLAG_NO_LOCATION)) {
      results = results.filter((s) => !hasStoreCoordinates(s))
    }
    if (selectedDetailFlags.includes(FILTER_FLAG_POTENTIAL)) {
      results = results.filter((s) => Boolean(s.is_potential))
    }
    // Text search (supports Vietnamese without tones + any word order)
    if (hasTextSearch) {
      const term = searchTerm.trim().toLowerCase()
      const normTerm = removeVietnameseTones(term)
      const phoneticTerm = normalizeVietnamesePhonetics(term)
      // Split into individual words for word-order-independent matching
      const words = normTerm.split(/\s+/).filter(Boolean)
      const phoneticWords = phoneticTerm.split(/\s+/).filter(Boolean)

      // Score: 2 = exact substring match, 1 = all words present (any order), 0 = any word present
      results = results
        .map((s) => {
          const name = (s.name || '').toLowerCase()
          const normName = removeVietnameseTones(name)
          const phoneticName = normalizeVietnamesePhonetics(name)

          const hasExactLike = name.includes(term) || normName.includes(normTerm) || phoneticName.includes(phoneticTerm)
          if (hasExactLike) return { ...s, _score: 2 }

          const allWordsMatch = words.length > 1 && words.every((w, idx) => {
            const phoneticWord = phoneticWords[idx] || normalizeVietnamesePhonetics(w)
            return normName.includes(w) || phoneticName.includes(phoneticWord)
          })
          if (allWordsMatch) return { ...s, _score: 1 }

          const anyWordMatch = words.some((w, idx) => {
            const phoneticWord = phoneticWords[idx] || normalizeVietnamesePhonetics(w)
            return normName.includes(w) || phoneticName.includes(phoneticWord)
          })
          if (anyWordMatch) return { ...s, _score: 0 }
          return null
        })
        .filter(Boolean)
    }

    // Add distance
    const refLoc = currentLocation
    results = results.map((s) => ({
      ...s,
      distance: computeDistance(s, refLoc)
    }))

    // Sort: match score first (if any), then near-to-far, then active, then newest
    results = results.slice().sort((a, b) => {
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

    return results
  }, [
    allStores,
    storesLoaded,
    searchTerm,
    selectedDistrict,
    selectedWard,
    selectedStoreTypes,
    selectedDetailFlags,
    currentLocation,
    computeDistance,
  ])

  // Search triggers when name or filters change
  // (no longer needs debounced API call — kept for UX smoothness)
  const showSkeleton = loading || !storesLoaded

  // Auto focus search input on mount — only on desktop (mobile keyboard is annoying)
  useEffect(() => {
    if (searchInputRef.current && window.innerWidth >= 768) {
      try { searchInputRef.current.focus() } catch { }
    }
  }, [])

  const clearAllFilters = () => {
    setSearchTerm('')
    setSelectedDistrict('')
    setSelectedWard('')
    setSelectedStoreTypes([])
    setSelectedDetailFlags([])
  }

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

    virtuosoRef.current?.scrollToIndex({
      index: 0,
      align: 'start',
      behavior: 'auto',
    })
  }, [searchTerm, selectedDistrict, selectedWard, selectedStoreTypes, selectedDetailFlags])

  return (
    <div className="h-[calc(100dvh-3.5rem)] overflow-hidden bg-black">
      <Msg type={msgState.type} show={msgState.show}>{msgState.text}</Msg>
      <div className="mx-auto flex h-full max-w-screen-md flex-col gap-3 px-3 pt-4 sm:px-4 sm:pt-6">
        <div className="flex shrink-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="VD: Tạp Hóa Minh Anh"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
              className="flex-1 text-base"
            />
            <Button
              type="button"
              variant={activeFilterCount > 0 || showDetailedFilters ? 'secondary' : 'outline'}
              onClick={() => setShowDetailedFilters((prev) => !prev)}
              className="h-11 shrink-0 gap-2 px-2.5 text-base sm:px-3"
              aria-expanded={showDetailedFilters}
              aria-controls="search-detail-filters"
              aria-label="Mở bộ lọc chi tiết"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18M6 12h12m-9 7h6" />
              </svg>
              <span className="hidden sm:inline">Lọc</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-sky-500 px-1.5 py-0.5 text-sm font-semibold text-slate-950">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {showDetailedFilters && (
            <div
              id="search-detail-filters"
              className="overflow-x-hidden rounded-xl border border-gray-800 bg-gray-950 px-2.5 py-2.5 text-gray-100 sm:px-3 sm:py-3"
            >
              <div className="max-h-[68vh] overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible sm:pr-0">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-300">Quận / Huyện</label>
                      <select
                        value={selectedDistrict}
                        onChange={(e) => {
                          setSelectedDistrict(e.target.value)
                          setSelectedWard('')
                        }}
                        className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100"
                      >
                        <option value="">Tất cả quận</option>
                        {districtOptions.map((district) => (
                          <option key={district} value={district}>{district}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-300">Xã / Phường</label>
                      <select
                        value={selectedWard}
                        onChange={(e) => setSelectedWard(e.target.value)}
                        className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100"
                      >
                        <option value="">{selectedDistrict ? 'Tất cả xã' : 'Tất cả xã/phường'}</option>
                        {wardOptions.map((ward) => (
                          <option key={ward} value={ward}>{ward}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 text-sm font-semibold text-gray-200">Loại cửa hàng</div>
                    <div className="grid grid-cols-2 gap-2">
                      {STORE_TYPE_OPTIONS.map((type) => {
                        const active = selectedStoreTypes.includes(type.value)
                        return (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => toggleFilterValue(setSelectedStoreTypes, type.value)}
                            className={`rounded-lg border px-2.5 py-2 text-sm font-medium transition ${
                              active
                                ? 'border-blue-500 bg-blue-500/15 text-blue-100'
                                : 'border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800'
                            }`}
                          >
                            {type.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 text-sm font-semibold text-gray-200">Chi tiết dữ liệu</div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: FILTER_FLAG_HAS_PHONE, label: 'Có số điện thoại' },
                        { value: FILTER_FLAG_HAS_IMAGE, label: 'Có ảnh' },
                        { value: FILTER_FLAG_NO_LOCATION, label: 'Không có vị trí' },
                        { value: FILTER_FLAG_POTENTIAL, label: 'Tiềm năng' },
                      ].map((flag) => {
                        const active = selectedDetailFlags.includes(flag.value)
                        return (
                          <button
                            key={flag.value}
                            type="button"
                            onClick={() => toggleFilterValue(setSelectedDetailFlags, flag.value)}
                            className={`rounded-lg border px-2.5 py-2 text-sm font-medium transition ${
                              active
                                ? 'border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-100'
                                : 'border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800'
                            }`}
                          >
                            {flag.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="sticky bottom-0 flex flex-col gap-2 border-t border-gray-800 bg-gray-950/95 pb-1 pt-2.5 backdrop-blur sm:static sm:flex-row sm:items-center sm:justify-between sm:bg-transparent sm:pb-0">
                    <p className="text-sm text-gray-400">
                      Đang áp dụng <span className="font-semibold text-gray-200">{activeFilterCount}</span> bộ lọc chi tiết
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-nowrap sm:items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDistrict('')
                          setSelectedWard('')
                          setSelectedStoreTypes([])
                          setSelectedDetailFlags([])
                        }}
                        className="w-full whitespace-nowrap rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800 sm:w-auto"
                      >
                        Xóa lọc
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDetailedFilters(false)}
                        className="w-full whitespace-nowrap rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800 sm:w-auto"
                      >
                        Thu gọn
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {hasSearchCriteria ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="min-w-0 text-sm text-gray-400">
                Tìm thấy <span className="font-semibold text-gray-200">{searchResults.length}</span> cửa hàng
                {activeFilterCount > 0 && (
                  <span> với <span className="font-semibold text-gray-200">{activeFilterCount}</span> bộ lọc</span>
                )}
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-800 bg-red-900/20 px-2.5 py-1 text-xs font-medium text-red-400 transition hover:bg-red-900/40"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Xóa lọc
              </button>
            </div>
          ) : (
            !showSkeleton && (
              <p className="text-sm text-gray-400">
                Đang hiển thị <span className="font-semibold text-gray-200">{searchResults.length}</span> cửa hàng gần nhất
              </p>
            )
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {showSkeleton && (
            <div
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1"
              aria-label={loading ? 'Đang tải kết quả' : 'Đang chuẩn bị tìm kiếm'}
            >
              {[...Array(5)].map((_, i) => (
                <Card key={i} className={`overflow-hidden rounded-md border border-gray-800 bg-gray-950 ${loading ? '' : 'opacity-70'}`}>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 gap-y-2 p-3">
                      <div className="flex h-6 w-6 items-center justify-center">
                        <div className="h-4.5 w-4.5 animate-pulse rounded-sm bg-gray-800" />
                      </div>

                      <div className="min-w-0">
                        <div className="h-5 w-3/4 animate-pulse rounded bg-gray-700" />
                      </div>

                      <div className="row-span-3 flex shrink-0 flex-col justify-center gap-2">
                        <div className="h-10 w-10 animate-pulse rounded-full border border-gray-800 bg-gray-800" />
                        <div className="h-10 w-10 animate-pulse rounded-full border border-gray-800 bg-gray-800" />
                      </div>

                      <div className="col-span-2 flex items-center gap-1">
                        <div className="h-4 w-4 animate-pulse rounded-full bg-gray-800" />
                        <div className="h-4 w-16 animate-pulse rounded bg-gray-800" />
                      </div>

                      <div className="col-span-2 space-y-2">
                        <div className="h-4 w-full animate-pulse rounded bg-gray-800" />
                        <div className="h-4 w-2/3 animate-pulse rounded bg-gray-800" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!showSkeleton && searchResults.length === 0 && (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
                <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="mb-1 font-medium text-gray-300">Không tìm thấy cửa hàng</p>
              <p className="mb-4 text-sm text-gray-500">Thử tìm với từ khác hoặc bớt bộ lọc</p>
              <Button asChild>
                <Link href="/store/create">+ Tạo cửa hàng mới</Link>
              </Button>
            </div>
          )}

          {!showSkeleton && searchResults.length > 0 && (
            <div className="min-h-0 flex-1">
              <Virtuoso
                ref={virtuosoRef}
                style={{ height: '100%' }}
                data={searchResults}
                computeItemKey={(index, item) => `${item.id}:${item.distance == null ? 'x' : item.distance.toFixed(3)}`}
                overscan={300}
                itemContent={(index, store) => (
                  <div className="mb-3" key={`${store.id}-${store.distance == null ? 'x' : store.distance.toFixed(3)}`}>
                    <SearchStoreCard
                      store={store}
                      distance={store.distance}
                      searchTerm={searchTerm}
                      compact
                    />
                  </div>
                )}
                components={{
                  Footer: () => (
                    <div className="pb-4 pt-2 text-center text-sm text-gray-500">
                      Hết kết quả
                    </div>
                  )
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

