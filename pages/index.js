import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/router'
import { Virtuoso } from 'react-virtuoso'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DISTRICT_WARD_SUGGESTIONS, STORE_SIZE_OPTIONS, STORE_TYPE_OPTIONS } from '@/lib/constants'
import Link from 'next/link'
import { haversineKm } from '@/helper/distance'
import SearchStoreCard from '@/components/search-store-card'
import { getOrRefreshStores } from '@/lib/storeCache'
import removeVietnameseTones, { normalizeVietnamesePhonetics } from '@/helper/removeVietnameseTones'

// Districts sorted alphabetically
const DISTRICTS = Object.keys(DISTRICT_WARD_SUGGESTIONS).sort((a, b) => a.localeCompare(b, 'vi'))

// All wards sorted alphabetically
const ALL_WARDS = Array.from(
  new Set(Object.values(DISTRICT_WARD_SUGGESTIONS).flat())
).sort((a, b) => a.localeCompare(b, 'vi'))
const DEFAULT_NEARBY_LIMIT = 50
const LOCATION_REFRESH_INTERVAL_MS = 3 * 60 * 1000
const LOCATION_REFRESH_COOLDOWN_MS = 5 * 1000
const UNKNOWN_STORE_SIZE_VALUE = '__unknown__'
const FILTER_FLAG_HAS_PHONE = 'has_phone'
const FILTER_FLAG_HAS_IMAGE = 'has_image'

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
  selectedStoreSizes,
  selectedDetailFlags,
}) {
  const query = {}
  if (searchTerm.trim()) query.q = searchTerm.trim()
  if (selectedDistrict) query.district = selectedDistrict
  if (selectedWard) query.ward = selectedWard
  if (selectedStoreTypes.length) query.types = selectedStoreTypes.join(',')
  if (selectedStoreSizes.length) query.sizes = selectedStoreSizes.join(',')
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

export default function HomePage() {
  const router = useRouter()
  const [allStores, setAllStores] = useState([])
  const [storesLoaded, setStoresLoaded] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedWard, setSelectedWard] = useState('')
  const [selectedStoreTypes, setSelectedStoreTypes] = useState([])
  const [selectedStoreSizes, setSelectedStoreSizes] = useState([])
  const [selectedDetailFlags, setSelectedDetailFlags] = useState([])
  const [showDetailedFilters, setShowDetailedFilters] = useState(false)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const searchInputRef = useRef(null)
  const initializedFromQuery = useRef(false)
  const lastLocationRequestAtRef = useRef(0)
  const hasSearchCriteria = Boolean(
    searchTerm.trim()
    || selectedDistrict
    || selectedWard
    || selectedStoreTypes.length
    || selectedStoreSizes.length
    || selectedDetailFlags.length
  )
  const activeFilterCount = (selectedDistrict ? 1 : 0) + (selectedWard ? 1 : 0) + selectedStoreTypes.length + selectedStoreSizes.length + selectedDetailFlags.length

  // Restore state from URL query params on mount (for back-navigation)
  useEffect(() => {
    if (initializedFromQuery.current || !router.isReady) return
    initializedFromQuery.current = true
    const { q, district, districts, ward, wards, types, sizes, flags } = router.query
    if (q) setSearchTerm(q)
    const restoredDistricts = parseQueryList(districts || district)
    const restoredWards = parseQueryList(wards || ward)
    const restoredTypes = parseQueryList(types)
    const restoredSizes = parseQueryList(sizes)
    const restoredFlags = parseQueryList(flags)
    if (restoredDistricts.length) setSelectedDistrict(restoredDistricts[0])
    if (restoredWards.length) setSelectedWard(restoredWards[0])
    if (restoredTypes.length) setSelectedStoreTypes(restoredTypes)
    if (restoredSizes.length) setSelectedStoreSizes(restoredSizes)
    if (restoredFlags.length) setSelectedDetailFlags(restoredFlags)
    if (restoredDistricts.length || restoredWards.length || restoredTypes.length || restoredSizes.length || restoredFlags.length) {
      setShowDetailedFilters(true)
    }
  }, [router.isReady, router.query])

  // Sync state to URL query params (shallow, no navigation)
  useEffect(() => {
    if (!initializedFromQuery.current || !router.isReady) return

    const nextQuery = buildSearchRouteQuery({
      searchTerm,
      selectedDistrict,
      selectedWard,
      selectedStoreTypes,
      selectedStoreSizes,
      selectedDetailFlags,
    })
    const currentQuery = buildSearchRouteQuery({
      searchTerm: String(router.query.q || ''),
      selectedDistrict: parseQueryList(router.query.districts || router.query.district)[0] || '',
      selectedWard: parseQueryList(router.query.wards || router.query.ward)[0] || '',
      selectedStoreTypes: parseQueryList(router.query.types),
      selectedStoreSizes: parseQueryList(router.query.sizes),
      selectedDetailFlags: parseQueryList(router.query.flags),
    })

    if (serializeRouteQuery(nextQuery) === serializeRouteQuery(currentQuery)) return

    const syncTimer = window.setTimeout(() => {
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
    }, 250)

    return () => window.clearTimeout(syncTimer)
  }, [searchTerm, selectedDistrict, selectedWard, selectedStoreTypes, selectedStoreSizes, selectedDetailFlags, router.isReady, router.pathname, router.query])

  // Compute ward/district options from static DISTRICT_WARD_SUGGESTIONS
  const wardOptions = useMemo(() => (
    selectedDistrict
      ? (DISTRICT_WARD_SUGGESTIONS[selectedDistrict] || []).slice().sort((a, b) => a.localeCompare(b, 'vi'))
      : ALL_WARDS
  ), [selectedDistrict])
  const districtOptions = DISTRICTS
  const storeSizeOptions = useMemo(() => ([
    { value: UNKNOWN_STORE_SIZE_VALUE, label: 'Chưa rõ' },
    ...STORE_SIZE_OPTIONS,
  ]), [])

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

  // Keep results in sync after create/update/delete without full page reload
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStoresChanged = async (event) => {
      const changedId = event?.detail?.id
      const shouldRefetchAll = Boolean(event?.detail?.shouldRefetchAll)
      if (changedId) {
        setAllStores((prev) => prev.filter((store) => store.id !== changedId))
      }
      if (shouldRefetchAll) {
        await loadAllStores()
      }
    }

    window.addEventListener('storevis:stores-changed', handleStoresChanged)
    return () => window.removeEventListener('storevis:stores-changed', handleStoresChanged)
  }, [loadAllStores])

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
    if (selectedStoreSizes.length > 0) {
      results = results.filter((s) => {
        const normalizedSize = (s.store_size || '').trim()
        return selectedStoreSizes.some((size) => size === UNKNOWN_STORE_SIZE_VALUE ? !normalizedSize : normalizedSize === size)
      })
    }
    if (selectedDetailFlags.includes(FILTER_FLAG_HAS_PHONE)) {
      results = results.filter((s) => Boolean(String(s.phone || '').trim()))
    }
    if (selectedDetailFlags.includes(FILTER_FLAG_HAS_IMAGE)) {
      results = results.filter((s) => Boolean(String(s.image_url || '').trim()))
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

    if (!hasSearchCriteria) {
      return results.slice(0, DEFAULT_NEARBY_LIMIT)
    }

    return results
  }, [
    allStores,
    storesLoaded,
    hasSearchCriteria,
    searchTerm,
    selectedDistrict,
    selectedWard,
    selectedStoreTypes,
    selectedStoreSizes,
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
    setSelectedStoreSizes([])
    setSelectedDetailFlags([])
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)] bg-black overflow-hidden">
      <div className="h-full px-3 sm:px-4 pt-4 sm:pt-6 max-w-screen-md mx-auto flex flex-col gap-3">
        {/* Search + Filters */}
        <div className="flex-shrink-0 flex flex-col gap-2">
          {/* Font >=16px để tránh iOS tự zoom khi focus input */}
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
            <div id="search-detail-filters" className="overflow-x-hidden rounded-xl border border-gray-800 bg-gray-950 px-2.5 py-2.5 text-gray-100 sm:px-3 sm:py-3">
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
                          className={`rounded-lg border px-2.5 py-2 text-sm font-medium transition ${active
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
                  <div className="mb-1.5 text-sm font-semibold text-gray-200">Độ lớn cửa hàng</div>
                  <div className="grid grid-cols-2 gap-2">
                    {storeSizeOptions.map((size) => {
                      const active = selectedStoreSizes.includes(size.value)
                      return (
                        <button
                          key={size.value}
                          type="button"
                          onClick={() => toggleFilterValue(setSelectedStoreSizes, size.value)}
                          className={`rounded-lg border px-2.5 py-2 text-sm font-medium transition ${active
                            ? 'border-amber-500 bg-amber-500/15 text-amber-100'
                            : 'border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800'
                            }`}
                        >
                          {size.label}
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
                    ].map((flag) => {
                      const active = selectedDetailFlags.includes(flag.value)
                      return (
                        <button
                          key={flag.value}
                          type="button"
                          onClick={() => toggleFilterValue(setSelectedDetailFlags, flag.value)}
                          className={`rounded-lg border px-2.5 py-2 text-sm font-medium transition ${active
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

                <div className="sticky bottom-0 flex flex-col gap-2 border-t border-gray-800 bg-gray-950/95 pt-2.5 pb-1 backdrop-blur sm:static sm:flex-row sm:items-center sm:justify-between sm:bg-transparent sm:pb-0">
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
                        setSelectedStoreSizes([])
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
          {/* Active filters bar: count + clear button */}
          {hasSearchCriteria ? (
            <div className="flex flex-wrap items-center gap-2 min-w-0">
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
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Xoá lọc
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
        {/* Search Results */}
        <div className="flex-1 min-h-0 flex flex-col gap-3">


          {showSkeleton && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3" aria-label={loading ? 'Đang tải kết quả' : 'Đang chuẩn bị tìm kiếm'}>
              {[...Array(5)].map((_, i) => (
                <Card key={i} className={`overflow-hidden rounded-xl border border-gray-800 ${loading ? '' : 'opacity-70'}`}>
                  <CardContent className="p-0">
                    <div className="flex gap-3 p-3">
                      <div className="w-20 h-20 rounded-lg bg-gray-800 animate-pulse flex-shrink-0" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 w-3/4 bg-gray-700 rounded" />
                        <div className="h-3 w-full bg-gray-700 rounded" />
                        <div className="h-3 w-1/2 bg-gray-700 rounded" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!showSkeleton && searchResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <p className="text-gray-300 font-medium mb-1">Không tìm thấy cửa hàng</p>
              <p className="text-sm text-gray-500 mb-4">Thử tìm với từ khác hoặc bớt bộ lọc</p>
              <Button asChild>
                <Link href="/store/create">
                  + Tạo cửa hàng mới
                </Link>
              </Button>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="flex-1 min-h-0">
              <Virtuoso
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
                    <div className="py-4 text-center text-xs text-gray-500">
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
