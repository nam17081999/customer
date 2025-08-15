import { useEffect, useMemo, useState, useCallback } from 'react'
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
import { StoreResultCard } from '@/components/store-card'
import LocationSwitch from '@/components/location-switch'

const STORAGE_KEY = 'selectedStores'
const NPP_LOCATION = { latitude: 21.077358236549987, longitude: 105.69518029931452 }

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
  const [currentLocation, setCurrentLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [locationMode, setLocationMode] = useState('npp') // 'user' or 'npp'
  const [isClient, setIsClient] = useState(false)

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

  // Get reference location based on mode
  const getReferenceLocation = useCallback(() => {
    if (locationMode === 'user' && currentLocation) {
      return currentLocation
    }
    return NPP_LOCATION
  }, [locationMode, currentLocation])

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= MIN_SEARCH_LEN) {
        handleSearch()
      } else {
        setSearchResults([])
        setHasMore(true)
        setPage(1)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [searchTerm, locationMode]) // Re-search when location mode changes

  // Remove infinite scroll - no auto load more on scroll

  const handleSearch = async () => {
    if (searchTerm.length < MIN_SEARCH_LEN) return

    setLoading(true)
    setPage(1)
    setHasMore(true)

    try {
      const normalizedSearch = removeVietnameseTones(searchTerm.toLowerCase())
      
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .or(`name.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,name_search.ilike.%${normalizedSearch}%`)
        .limit(PAGE_SIZE)

      if (error) throw error

      const referenceLocation = getReferenceLocation()
      const resultsWithDistance = data.map(store => ({
        ...store,
        distance: referenceLocation 
          ? haversineKm(
              referenceLocation.latitude,
              referenceLocation.longitude,
              store.latitude,
              store.longitude
            )
          : null
      }))

      setSearchResults(resultsWithDistance)
      setHasMore(data.length === PAGE_SIZE)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    if (!hasMore || loadingMore || searchTerm.length < MIN_SEARCH_LEN) return

    setLoadingMore(true)
    const nextPage = page + 1

    try {
      const normalizedSearch = removeVietnameseTones(searchTerm.toLowerCase())
      
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .or(`name.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,name_search.ilike.%${normalizedSearch}%`)
        .range((nextPage - 1) * PAGE_SIZE, nextPage * PAGE_SIZE - 1)

      if (error) throw error

      const referenceLocation = getReferenceLocation()
      const resultsWithDistance = data.map(store => ({
        ...store,
        distance: referenceLocation 
          ? haversineKm(
              referenceLocation.latitude,
              referenceLocation.longitude,
              store.latitude,
              store.longitude
            )
          : null
      }))

      setSearchResults(prev => [...prev, ...resultsWithDistance])
      setPage(nextPage)
      setHasMore(data.length === PAGE_SIZE)
    } catch (error) {
      console.error('Load more error:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  const addToList = (store) => {
    if (!stores.find(s => s.id === store.id)) {
      setStores(prev => [...prev, store])
    }
  }

  const visitListCount = stores.length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-4 py-6 space-y-6">
        {/* Location Switch - Top Right */}
        <div className="flex justify-end">
          <LocationSwitch 
            locationMode={locationMode}
            onLocationModeChange={setLocationMode}
          />
        </div>

        {/* Search Input */}
        <div>
          <Input
            type="text"
            placeholder="Tìm kiếm cửa hàng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Search Results */}
        <div className="space-y-4">
          {loading && searchTerm.length >= MIN_SEARCH_LEN && (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex space-x-4">
                      <Skeleton className="h-16 w-16 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!loading && searchTerm.length >= MIN_SEARCH_LEN && searchResults.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  Không tìm thấy cửa hàng nào
                </p>
              </CardContent>
            </Card>
          )}

          {searchResults.length > 0 && (
            <>
              <ul className="space-y-4">
                {searchResults.map((store) => (
                  <li key={store.id}>
                    <StoreResultCard
                      store={store}
                      onAdd={() => addToList(store)}
                      isAdded={stores.some(s => s.id === store.id)}
                    />
                  </li>
                ))}
              </ul>
              {/* Manual Load More Button */}
              {hasMore && (
                <div className="text-center py-4">
                  <Button 
                    onClick={loadMore} 
                    disabled={loadingMore}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    {loadingMore ? 'Đang tải...' : 'Tải thêm'}
                  </Button>
                </div>
              )}
              {!hasMore && searchResults.length > 0 && (
                <div className="py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                  Đã hiển thị tất cả kết quả
                </div>
              )}
            </>
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
      </div>
    </div>
  )
}
