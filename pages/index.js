import { useEffect, useState, useCallback, useRef } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { supabase } from '@/lib/supabaseClient'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MIN_SEARCH_LEN, SEARCH_DEBOUNCE_MS, PAGE_SIZE } from '@/lib/constants'
import Link from 'next/link'
import { haversineKm } from '@/helper/distance'
import { useAuth } from '@/components/auth-context'
import SearchStoreCard from '@/components/search-store-card'
import LocationSwitch from '@/components/location-switch'

const STORAGE_KEY = 'selectedStores'
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

function getFileNameFromUrl(url) {
  if (!url) return null;
  
  // Since image_url is now always just filename, return as is
  // But keep URL parsing for backward compatibility if needed
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url;
  }
  
  try {
    const marker = '/object/public/stores/'
    const idx = url.indexOf(marker)
    if (idx !== -1) return url.substring(idx + marker.length)
    const u = new URL(url)
    const parts = u.pathname.split('/')
    return parts[parts.length - 1]
  } catch {
    return null
  }
}

export default function HomePage() {
  const { user } = useAuth()
  const [searchResults, setSearchResults] = useState([])
  const [stores, setStores] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [currentLocation, setCurrentLocation] = useState(getInitialUserLocation())
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [locationMode, setLocationMode] = useState(getInitialLocationMode()) // 'user' or 'npp'
  const [isClient, setIsClient] = useState(false)
  const observer = useRef(null)
  const suppressFirstAutoLoad = useRef(false)
  const lastQueryRef = useRef('') // lưu searchTerm cuối đã fetch để tránh fetch trùng (không phụ thuộc locationMode)

  // Load stores from localStorage on component mount
  useEffect(() => {
    setIsClient(true)
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsedStores = JSON.parse(saved)
        setStores(parsedStores)
      } catch (error) {
        console.error('Error parsing saved stores:', error)
        setStores([])
      }
    }
  }, [])

  // Save to localStorage whenever stores changes and notify navbar
  useEffect(() => {
    if (isClient) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stores))
      // Dispatch custom event to notify navbar
      window.dispatchEvent(new CustomEvent('selectedStoresUpdated'))
    }
  }, [stores, isClient])  // Get current location
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
      if (searchTerm.length >= MIN_SEARCH_LEN) {
        handleSearch()
      } else {
        setSearchResults([])
        setHasMore(true)
        setPage(1)
        lastQueryRef.current = ''
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Remove infinite scroll - no auto load more on scroll

  const handleSearch = async () => {
    if (searchTerm.length < MIN_SEARCH_LEN) return

    const queryKey = searchTerm // chỉ dựa trên searchTerm
    if (lastQueryRef.current === queryKey) return // tránh fetch trùng

    setLoading(true)
    setPage(1)
    setHasMore(true)
    suppressFirstAutoLoad.current = true

    try {
      const normalizedSearch = removeVietnameseTones(searchTerm.toLowerCase())
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .or(`name.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,name_search.ilike.%${normalizedSearch}%`)
        .order('status', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (error) throw error

      lastQueryRef.current = queryKey

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
    if (stores.length > 0) {
      setStores(prev => prev.map(store => {
        const newDistance = computeDistance(store, referenceLocation)
        return newDistance === store.distance ? store : { ...store, distance: newDistance }
      }))
    }
  }, [locationMode, currentLocation, getReferenceLocation, computeDistance])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || loadingMore || searchTerm.length < MIN_SEARCH_LEN) return

    setLoadingMore(true)
    const nextPage = page + 1

    try {
      const normalizedSearch = removeVietnameseTones(searchTerm.toLowerCase())
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .or(`name.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,name_search.ilike.%${normalizedSearch}%`)
        .order('status', { ascending: false })
        .order('created_at', { ascending: false })
        .range((nextPage - 1) * PAGE_SIZE, nextPage * PAGE_SIZE - 1)

      if (error) throw error

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
  }, [hasMore, loadingMore, loading, searchTerm, page, getReferenceLocation])

  const addToList = (store) => {
    if (!stores.find(s => s.id === store.id)) {
      const referenceLocation = getReferenceLocation()
      const distance = computeDistance(store, referenceLocation)
      setStores(prev => [...prev, { ...store, distance }])
    }
  }

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

  const visitListCount = stores.length
  const isPendingSearch = searchTerm.length >= MIN_SEARCH_LEN && lastQueryRef.current !== searchTerm
  const showSkeleton = searchTerm.length >= MIN_SEARCH_LEN && (loading || isPendingSearch)

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
        {/* Search Input */}
        <div>
          {/* Font >=16px để tránh iOS tự zoom khi focus input */}
          <Input
            type="text"
            placeholder="Tìm kiếm cửa hàng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-base sm:text-base"
          />
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
                {user && (
                  <Button asChild>
                    <Link href={`/store/create?name=${encodeURIComponent(searchTerm)}`}>
                      + Tạo cửa hàng mới
                    </Link>
                  </Button>
                )}
                {!user && (
                  <p className="text-xs mt-4 text-gray-400">Đăng nhập để tạo cửa hàng mới</p>
                )}
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
                      onAdd={() => addToList(store)}
                      isAdded={stores.some(s => s.id === store.id)}
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

          {searchTerm.length < MIN_SEARCH_LEN && (
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
