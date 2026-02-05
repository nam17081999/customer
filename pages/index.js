import { useEffect, useState, useCallback, useRef } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { supabase } from '@/lib/supabaseClient'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MIN_SEARCH_LEN, SEARCH_DEBOUNCE_MS, PAGE_SIZE } from '@/lib/constants'
import Link from 'next/link'
import { haversineKm } from '@/helper/distance'
import SearchStoreCard from '@/components/search-store-card'
import LocationSwitch from '@/components/location-switch'

const LOCATION_MODE_KEY = 'locationMode'
const USER_LOCATION_KEY = 'userLocation'
const NPP_LOCATION = { latitude: 21.077358236549987, longitude: 105.69518029931452 }

function getInitialLocationMode() {
  if (typeof window === 'undefined') return 'npp'
  const saved = localStorage.getItem(LOCATION_MODE_KEY)
  return (saved === 'user' || saved === 'npp') ? saved : 'npp'
}
function getInitialUserLocation() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(USER_LOCATION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') return parsed
  } catch {}
  return null
}

export default function HomePage() {
  const [searchResults, setSearchResults] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [districts, setDistricts] = useState([])
  const [wards, setWards] = useState([])
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedWard, setSelectedWard] = useState('')
  const [wardDistrictMap, setWardDistrictMap] = useState(new Map())
  const [currentLocation, setCurrentLocation] = useState(getInitialUserLocation())
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [locationMode, setLocationMode] = useState(getInitialLocationMode()) // 'user' or 'npp'
  const observer = useRef(null)
  const suppressFirstAutoLoad = useRef(false)
  const lastQueryRef = useRef('') // lưu searchTerm cuối đã fetch để tránh fetch trùng (không phụ thuộc locationMode)
  const searchInputRef = useRef(null)
  const searchCacheRef = useRef(new Map())

  // Load districts for filter
  useEffect(() => {
    const loadDistricts = async () => {
      try {
        const { data, error } = await supabase
          .from('stores')
          .select('district')
          .not('district', 'is', null)
        if (error) throw error
        const uniq = Array.from(new Set((data || []).map(d => (d?.district || '').trim()).filter(Boolean)))
        uniq.sort((a, b) => a.localeCompare(b, 'vi'))
        setDistricts(uniq)
      } catch (e) {
        console.error('Load districts error:', e)
      }
    }
    loadDistricts()
  }, [])

  useEffect(() => {
    const loadWards = async () => {
      try {
        const { data, error } = await supabase
          .from('stores')
          .select('ward,district')
          .not('ward', 'is', null)
        if (error) throw error
        const map = new Map()
        const uniq = Array.from(new Set((data || []).map(d => (d?.ward || '').trim()).filter(Boolean)))
        ;(data || []).forEach((row) => {
          const ward = (row?.ward || '').trim()
          const district = (row?.district || '').trim()
          if (!ward) return
          if (!map.has(ward)) map.set(ward, new Set())
          if (district) map.get(ward).add(district)
        })
        uniq.sort((a, b) => a.localeCompare(b, 'vi'))
        setWards(uniq)
        setWardDistrictMap(map)
      } catch (e) {
        console.error('Load wards error:', e)
      }
    }
    loadWards()
  }, [])

  const wardOptions = selectedDistrict
    ? wards.filter((w) => wardDistrictMap.get(w)?.has(selectedDistrict))
    : wards

  const districtsForSelectedWard = selectedWard ? Array.from(wardDistrictMap.get(selectedWard) || []) : []
  const isDistrictLocked = selectedWard && districtsForSelectedWard.length === 1

  useEffect(() => {
    if (isDistrictLocked) {
      const only = districtsForSelectedWard[0] || ''
      if (only && selectedDistrict !== only) setSelectedDistrict(only)
    }
  }, [isDistrictLocked, districtsForSelectedWard, selectedDistrict])

  useEffect(() => {
    if (selectedWard && selectedDistrict) {
      const districtsForWard = wardDistrictMap.get(selectedWard)
      if (districtsForWard && !districtsForWard.has(selectedDistrict)) {
        setSelectedWard('')
      }
    }
  }, [selectedDistrict, selectedWard, wardDistrictMap])
  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
        },
        (error) => {
          console.error('Error getting location:', error)
        }
      )
    }
  }, [])

  // Init & sync locationMode across pages (listeners only; initial state hydrated via initializer)
  useEffect(() => {
    const handleModeChanged = (e) => {
      const mode = e.detail?.mode
      if (mode && mode !== locationMode) setLocationMode(mode)
      if (mode === 'user' && !currentLocation) {
        const savedLoc = localStorage.getItem(USER_LOCATION_KEY)
        if (savedLoc) {
          try {
            const parsed = JSON.parse(savedLoc)
            if (parsed && typeof parsed.latitude === 'number') setCurrentLocation(parsed)
          } catch {}
        }
      }
    }
    const handleStorage = (e) => {
      if (e.key === LOCATION_MODE_KEY && (e.newValue === 'user' || e.newValue === 'npp')) {
        setLocationMode(e.newValue)
      }
      if (e.key === USER_LOCATION_KEY && e.newValue && !currentLocation) {
        try {
          const parsed = JSON.parse(e.newValue)
          if (parsed && typeof parsed.latitude === 'number') setCurrentLocation(parsed)
        } catch {}
      }
    }
    window.addEventListener('locationModeChanged', handleModeChanged)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('locationModeChanged', handleModeChanged)
      window.removeEventListener('storage', handleStorage)
    }
  }, [locationMode, currentLocation])

  // Get reference location based on mode
  const getReferenceLocation = useCallback(() => {
    if (locationMode === 'user' && currentLocation) {
      return currentLocation
    }
    return NPP_LOCATION
  }, [locationMode, currentLocation])

  // Helper: compute distance for a store given current reference
  const computeDistance = useCallback((store, refLoc) => {
    if (!refLoc) return null
    if (store.latitude == null || store.longitude == null) return null
    return haversineKm(refLoc.latitude, refLoc.longitude, store.latitude, store.longitude)
  }, [])

  // Debounce search term (chỉ phụ thuộc searchTerm, đổi locationMode không refetch mà chỉ tính lại distance)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= MIN_SEARCH_LEN || selectedDistrict || selectedWard) {
        handleSearch()
      } else {
        setSearchResults([])
        setHasMore(true)
        setPage(1)
        lastQueryRef.current = ''
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [searchTerm, selectedDistrict, selectedWard])

  // Remove infinite scroll - no auto load more on scroll

  const handleSearch = async () => {
    if (searchTerm.length < MIN_SEARCH_LEN && !selectedDistrict && !selectedWard) return

    const queryKey = `${searchTerm}|${selectedDistrict}|${selectedWard}` // include filters
    if (lastQueryRef.current === queryKey) return // tránh fetch trùng

    setLoading(true)
    setPage(1)
    setHasMore(true)
    suppressFirstAutoLoad.current = true

    try {
      const normalizedSearch = removeVietnameseTones(searchTerm.toLowerCase())
      const cacheKey = `q:${searchTerm}|d:${selectedDistrict}|w:${selectedWard}|p:1`
      if (searchCacheRef.current.has(cacheKey)) {
        const cached = searchCacheRef.current.get(cacheKey)
        lastQueryRef.current = queryKey
        const referenceLocation = getReferenceLocation()
        const resultsWithDistance = cached.map(store => ({
          ...store,
          distance: computeDistance(store, referenceLocation)
        }))
        setSearchResults(resultsWithDistance)
        setHasMore(cached.length === PAGE_SIZE)
        return
      }

      let query = supabase
        .from('stores')
        .select('id,name,address_detail,ward,district,city,phone,image_url,latitude,longitude,status,created_at')
        .or(`name.ilike.%${searchTerm}%,name_search.ilike.%${normalizedSearch}%`)
      if (selectedDistrict) {
        query = query.eq('district', selectedDistrict)
      }
      if (selectedWard) {
        query = query.eq('ward', selectedWard)
      }
      const { data, error } = await query
        .order('status', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (error) throw error

      lastQueryRef.current = queryKey

      searchCacheRef.current.set(cacheKey, data)
      const referenceLocation = getReferenceLocation()
      const resultsWithDistance = data.map(store => ({
        ...store,
        distance: computeDistance(store, referenceLocation)
      }))

      setSearchResults(resultsWithDistance)
      setHasMore(data.length === PAGE_SIZE)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Recompute distances when location mode or currentLocation changes (không cần refetch)
  useEffect(() => {
    const referenceLocation = getReferenceLocation()
    if (searchResults.length > 0) {
      setSearchResults(prev => prev.map(store => {
        const newDistance = computeDistance(store, referenceLocation)
        return newDistance === store.distance ? store : { ...store, distance: newDistance }
      }))
    }
    // no visit list
  }, [locationMode, currentLocation, getReferenceLocation, computeDistance])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || loadingMore || searchTerm.length < MIN_SEARCH_LEN) return

    setLoadingMore(true)
    const nextPage = page + 1

    try {
      const normalizedSearch = removeVietnameseTones(searchTerm.toLowerCase())
      const cacheKey = `q:${searchTerm}|d:${selectedDistrict}|w:${selectedWard}|p:${nextPage}`
      if (searchCacheRef.current.has(cacheKey)) {
        const cached = searchCacheRef.current.get(cacheKey)
        const referenceLocation = getReferenceLocation()
        const resultsWithDistance = cached.map(store => ({
          ...store,
          distance: computeDistance(store, referenceLocation)
        }))
        setSearchResults(prev => {
          const existingIds = new Set(prev.map(s => s.id))
          const merged = [...prev]
          resultsWithDistance.forEach(s => { if (!existingIds.has(s.id)) merged.push(s) })
          return merged
        })
        setPage(nextPage)
        setHasMore(cached.length === PAGE_SIZE)
        return
      }

      let query = supabase
        .from('stores')
        .select('id,name,address_detail,ward,district,city,phone,image_url,latitude,longitude,status,created_at')
        .or(`name.ilike.%${searchTerm}%,name_search.ilike.%${normalizedSearch}%`)
      if (selectedDistrict) {
        query = query.eq('district', selectedDistrict)
      }
      if (selectedWard) {
        query = query.eq('ward', selectedWard)
      }
      const { data, error } = await query
        .order('status', { ascending: false })
        .order('created_at', { ascending: false })
        .range((nextPage - 1) * PAGE_SIZE, nextPage * PAGE_SIZE - 1)

      if (error) throw error

      searchCacheRef.current.set(cacheKey, data)
      const referenceLocation = getReferenceLocation()
      const resultsWithDistance = data.map(store => ({
        ...store,
        distance: computeDistance(store, referenceLocation)
      }))

      setSearchResults(prev => {
        // tránh trùng (nếu server trả về record đã có)
        const existingIds = new Set(prev.map(s => s.id))
        const merged = [...prev]
        resultsWithDistance.forEach(s => { if (!existingIds.has(s.id)) merged.push(s) })
        return merged
      })
      setPage(nextPage)
      setHasMore(data.length === PAGE_SIZE)
    } catch (error) {
      console.error('Load more error:', error)
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, loadingMore, loading, searchTerm, page, getReferenceLocation, selectedDistrict, selectedWard])

  // Guarded switch: only allow switching to 'user' if geolocation succeeds
  const handleLocationModeChange = useCallback((mode) => {
    const broadcast = (m, loc) => {
      try {
        localStorage.setItem(LOCATION_MODE_KEY, m)
        if (loc) localStorage.setItem(USER_LOCATION_KEY, JSON.stringify(loc))
      } catch {}
      window.dispatchEvent(new CustomEvent('locationModeChanged', { detail: { mode: m } }))
    }

    if (mode === 'user') {
      if (currentLocation) {
        setLocationMode('user')
        broadcast('user', currentLocation)
        return
      }
      if (!navigator.geolocation) {
        alert('Thiết bị không hỗ trợ định vị')
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
          setCurrentLocation(loc)
            setLocationMode('user')
          broadcast('user', loc)
        },
        (err) => {
          console.error('Get location on switch error:', err)
          alert('Không thể lấy được vị trí của bạn')
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    } else {
      setLocationMode('npp')
      broadcast('npp')
    }
  }, [currentLocation])

  const isPendingSearch = (searchTerm.length >= MIN_SEARCH_LEN || selectedDistrict || selectedWard) && lastQueryRef.current !== `${searchTerm}|${selectedDistrict}|${selectedWard}`
  const showSkeleton = (searchTerm.length >= MIN_SEARCH_LEN || selectedDistrict || selectedWard) && (loading || isPendingSearch)

  // Infinite scroll observer
  const sentinelRef = useCallback(node => {
    if (!hasMore) return
    if (loading || loadingMore) return
    if (searchTerm.length < MIN_SEARCH_LEN) return
    if (observer.current) observer.current.disconnect()
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        if (suppressFirstAutoLoad.current) {
          suppressFirstAutoLoad.current = false
          return
        }
        loadMore()
      }
    }, { rootMargin: '400px' }) // tải trước khi chạm đáy
    if (node) observer.current.observe(node)
  }, [hasMore, loading, loadingMore, loadMore, searchTerm])

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observer.current) observer.current.disconnect()
    }
  }, [])

  // Auto focus search input on mount for faster typing
  useEffect(() => {
    if (searchInputRef.current) {
      try { searchInputRef.current.focus() } catch {}
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="px-3 sm:px-4 py-4 sm:py-6 space-y-3 max-w-screen-md mx-auto">
        {/* Location Switch - Top Right */}
        <div className="flex justify-end">
          <LocationSwitch 
            locationMode={locationMode}
            onLocationModeChange={handleLocationModeChange}
          />
        </div>
        {/* Search + Filters */}
        <div className="flex flex-col gap-2">
          {/* Font >=16px để tránh iOS tự zoom khi focus input */}
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Tìm kiếm cửa hàng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            className="w-full text-base sm:text-base"
          />
          <div className="flex gap-2">
            <select
              value={selectedWard}
              onChange={(e) => {
                const ward = e.target.value
                setSelectedWard(ward)
                setSearchResults([])
                setHasMore(true)
                setPage(1)
                lastQueryRef.current = ''
              }}
              className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2 text-sm text-gray-900 dark:text-gray-100"
            >
              <option value="">Xã/Phường</option>
              {wardOptions.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            <select
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value)
                setSearchResults([])
                setHasMore(true)
                setPage(1)
                lastQueryRef.current = ''
              }}
              disabled={isDistrictLocked}
              className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
            >
              <option value="">Quận/Huyện</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
        {/* Search Results */}
        <div className="space-y-4">
          {showSkeleton && (
            <div className="space-y-4" aria-label={loading ? 'Đang tải kết quả' : 'Đang chuẩn bị tìm kiếm'}>
              {[...Array(3)].map((_, i) => (
                <Card
                  key={i}
                  className={`overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 ${loading ? '' : 'opacity-70'}`}
                >
                  <CardContent className="p-0">
                    {/* Image area */}
                    <div className="relative w-full h-56 sm:h-64 bg-gray-200 dark:bg-gray-800 animate-pulse" />
                    {/* Content area */}
                    <div className="p-4 flex flex-col gap-3">
                      {/* Title */}
                      <div className="h-5 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
                      {/* Meta lines */}
                      <div className="space-y-2">
                        <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="h-3 w-5/6 bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                      </div>
                      {/* Action buttons */}
                      <div className="flex gap-3 pt-2">
                        <div className="h-9 flex-1 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
                        <div className="h-9 flex-1 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

              {!loading && !isPendingSearch && searchTerm.length >= MIN_SEARCH_LEN && searchResults.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Không tìm thấy cửa hàng nào
                </p>
                <Button asChild>
                  <Link href={`/store/create?name=${encodeURIComponent(searchTerm)}`}>
                    + Tạo cửa hàng mới
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {searchResults.length > 0 && (
            <div className="h-[calc(100vh-220px)] sm:h-[calc(100vh-250px)]">{/* Responsive container height */}
              <Virtuoso
                data={searchResults}
                computeItemKey={(index, item) => `${item.id}:${item.distance == null ? 'x' : item.distance.toFixed(3)}`}
                endReached={() => {
                  if (!loadingMore && hasMore) loadMore()
                }}
                overscan={300}
                itemContent={(index, store) => (
                  <div className="mb-4" key={`${store.id}-${store.distance == null ? 'x' : store.distance.toFixed(3)}`}>
                    <SearchStoreCard
                      store={store}
                      distance={store.distance}
                      searchTerm={searchTerm}
                    />
                  </div>
                )}
                components={{
                  Footer: () => (
                    <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      {loadingMore && hasMore && (
                        <div className="space-y-3">
                          <div className="flex justify-center text-xs text-gray-500 dark:text-gray-400">Đang tải thêm...</div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {[...Array(2)].map((_, i) => (
                              <Card key={i} className="animate-pulse">
                                <CardContent className="p-0">
                                  <div className="h-40 bg-gray-200 dark:bg-gray-800" />
                                  <div className="p-4 space-y-2">
                                    <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                                    <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                                    <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                      {!hasMore && searchResults.length > 0 && !loadingMore && 'Đã hiển thị tất cả kết quả'}
                    </div>
                  )
                }}
              />
            </div>
          )}

          {searchTerm.length < MIN_SEARCH_LEN && !selectedDistrict && !selectedWard && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  Nhập ít nhất {MIN_SEARCH_LEN} ký tự để tìm kiếm
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sentinel div removed due to virtual scrolling */}
      </div>
    </div>
  )
}

/* NOTE: Virtual scrolling implemented with react-virtuoso */
