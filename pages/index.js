import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { supabase } from '@/lib/supabaseClient'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SEARCH_DEBOUNCE_MS, DISTRICT_WARD_SUGGESTIONS } from '@/lib/constants'
import Link from 'next/link'
import { haversineKm } from '@/helper/distance'
import SearchStoreCard from '@/components/search-store-card'
import { getOrRefreshStores } from '@/lib/storeCache'

// Districts sorted alphabetically
const DISTRICTS = Object.keys(DISTRICT_WARD_SUGGESTIONS).sort((a, b) => a.localeCompare(b, 'vi'))

// All wards sorted alphabetically
const ALL_WARDS = Array.from(
  new Set(Object.values(DISTRICT_WARD_SUGGESTIONS).flat())
).sort((a, b) => a.localeCompare(b, 'vi'))

export default function HomePage() {
  const [allStores, setAllStores] = useState([])
  const [storesLoaded, setStoresLoaded] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedWard, setSelectedWard] = useState('')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const searchInputRef = useRef(null)
  const hasSearchCriteria = Boolean(searchTerm.trim() || selectedDistrict || selectedWard)

  // Compute ward/district options from static DISTRICT_WARD_SUGGESTIONS
  const wardOptions = selectedDistrict
    ? (DISTRICT_WARD_SUGGESTIONS[selectedDistrict] || []).slice().sort((a, b) => a.localeCompare(b, 'vi'))
    : ALL_WARDS
  const districtOptions = DISTRICTS

  useEffect(() => {
    if (selectedWard && selectedDistrict) {
      const wardsInDistrict = DISTRICT_WARD_SUGGESTIONS[selectedDistrict] || []
      if (!wardsInDistrict.includes(selectedWard)) {
        setSelectedWard('')
      }
    }
  }, [selectedDistrict, selectedWard])
  // Get current location
  useEffect(() => {
    if (!navigator.geolocation) return
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

  // Helper: compute distance for a store given current reference
  const computeDistance = useCallback((store, refLoc) => {
    if (!refLoc) return null
    if (store.latitude == null || store.longitude == null) return null
    return haversineKm(refLoc.latitude, refLoc.longitude, store.latitude, store.longitude)
  }, [])

  // Load all stores from IndexedDB cache (or fetch if count changed)
  const loadAllStores = useCallback(async () => {
    if (storesLoaded) return
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
  }, [storesLoaded])

  // Trigger load when user starts typing or selects a filter
  useEffect(() => {
    if (hasSearchCriteria && !storesLoaded) {
      loadAllStores()
    }
  }, [hasSearchCriteria, storesLoaded, loadAllStores])

  // Local filtering
  const searchResults = useMemo(() => {
    if (!hasSearchCriteria || !storesLoaded) return []

    let results = allStores

    // District filter
    if (selectedDistrict) {
      results = results.filter((s) => s.district === selectedDistrict)
    }
    // Ward filter
    if (selectedWard) {
      results = results.filter((s) => s.ward === selectedWard)
    }
    // Text search
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase()
      const termNorm = removeVietnameseTones(term)
      results = results.filter((s) => {
        const name = (s.name || '').toLowerCase()
        const nameSearch = (s.name_search || '').toLowerCase()
        return name.includes(term) || nameSearch.includes(termNorm)
      })
    }

    // Sort: active first, then by created_at desc
    results = results.slice().sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      const da = a.created_at || ''
      const db = b.created_at || ''
      return db.localeCompare(da)
    })

    // Add distance
    const refLoc = currentLocation
    return results.map((s) => ({
      ...s,
      distance: computeDistance(s, refLoc)
    }))
  }, [allStores, storesLoaded, hasSearchCriteria, searchTerm, selectedDistrict, selectedWard, currentLocation, computeDistance])

  // Search triggers when name or filters change
  // (no longer needs debounced API call — kept for UX smoothness)
  const showSkeleton = hasSearchCriteria && (loading || !storesLoaded)

  // Auto focus search input on mount for faster typing
  useEffect(() => {
    if (searchInputRef.current) {
      try { searchInputRef.current.focus() } catch {}
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="px-3 sm:px-4 py-4 sm:py-6 space-y-3 max-w-screen-md mx-auto">
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
            <div className="flex-1">
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                aria-label="Chọn quận/huyện"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
              >
                <option value="">Quận/Huyện</option>
                {districtOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <select
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                aria-label="Chọn xã/phường"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="">Xã/Phường</option>
                {wardOptions.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
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

          {!showSkeleton && hasSearchCriteria && searchResults.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Không tìm thấy cửa hàng nào
                </p>
                <Button asChild>
                  <Link href="/store/create">
                    + Tạo cửa hàng mới
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {searchResults.length > 0 && (
            <div className="h-[calc(100vh-220px)] sm:h-[calc(100vh-250px)]">
              <Virtuoso
                data={searchResults}
                computeItemKey={(index, item) => `${item.id}:${item.distance == null ? 'x' : item.distance.toFixed(3)}`}
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
                      {searchResults.length > 0 && `Hiển thị ${searchResults.length} kết quả`}
                    </div>
                  )
                }}
              />
            </div>
          )}

          {!hasSearchCriteria && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  Nhập tên cửa hàng hoặc chọn Quận/Huyện, Xã/Phường để tìm kiếm
                </p>
              </CardContent>
            </Card>
          )}
        </div>

      </div>
    </div>
  )
}
