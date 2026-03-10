import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/router'
import { Virtuoso } from 'react-virtuoso'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SEARCH_DEBOUNCE_MS, DISTRICT_WARD_SUGGESTIONS } from '@/lib/constants'
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

export default function HomePage() {
  const router = useRouter()
  const [allStores, setAllStores] = useState([])
  const [storesLoaded, setStoresLoaded] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedWard, setSelectedWard] = useState('')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const searchInputRef = useRef(null)
  const initializedFromQuery = useRef(false)
  const hasSearchCriteria = Boolean(searchTerm.trim() || selectedDistrict || selectedWard)

  // Restore state from URL query params on mount (for back-navigation)
  useEffect(() => {
    if (initializedFromQuery.current || !router.isReady) return
    initializedFromQuery.current = true
    const { q, district, ward, sort } = router.query
    if (q) setSearchTerm(q)
    if (district) setSelectedDistrict(district)
    if (ward) setSelectedWard(ward)
  }, [router.isReady, router.query])

  // Sync state to URL query params (shallow, no navigation)
  useEffect(() => {
    if (!initializedFromQuery.current) return
    const query = {}
    if (searchTerm.trim()) query.q = searchTerm.trim()
    if (selectedDistrict) query.district = selectedDistrict
    if (selectedWard) query.ward = selectedWard
    router.replace({ pathname: '/', query }, undefined, { shallow: true })
  }, [searchTerm, selectedDistrict, selectedWard])

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
    // Text search (supports Vietnamese without tones + any word order)
    if (searchTerm.trim()) {
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

    // Sort: match score first, then distance (if enabled), then active, then newest
    results = results.slice().sort((a, b) => {
      const sa = a._score ?? 2
      const sb = b._score ?? 2
      if (sb !== sa) return sb - sa
      if (a.distance != null && b.distance != null) {
        return a.distance - b.distance
      }
      if (a.active !== b.active) return a.active ? -1 : 1
      const da = a.created_at || ''
      const db = b.created_at || ''
      return db.localeCompare(da)
    })

    return results
  }, [allStores, storesLoaded, hasSearchCriteria, searchTerm, selectedDistrict, selectedWard, currentLocation, computeDistance])

  // Search triggers when name or filters change
  // (no longer needs debounced API call — kept for UX smoothness)
  const showSkeleton = hasSearchCriteria && (loading || !storesLoaded)

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
  }

  return (
    <div className="h-[calc(100dvh-3.5rem)] bg-black overflow-hidden">
      <div className="h-full px-3 sm:px-4 pt-4 sm:pt-6 max-w-screen-md mx-auto flex flex-col gap-3">
        {/* Search + Filters */}
        <div className="flex-shrink-0 flex flex-col gap-2">
          {/* Font >=16px để tránh iOS tự zoom khi focus input */}
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="VD: Tạp Hóa Minh Anh"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            className="w-full text-base"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                aria-label="Chọn quận/huyện"
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2.5 text-base text-gray-100 disabled:opacity-60"
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
                disabled={!selectedDistrict}
                aria-label="Chọn xã/phường"
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2.5 text-base text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{selectedDistrict ? 'Xã/Phường' : 'Chọn quận trước'}</option>
                {wardOptions.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Active filters bar: count + clear button */}
          {hasSearchCriteria && (
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-400">
                Tìm thấy <span className="font-semibold text-gray-200">{searchResults.length}</span> cửa hàng
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/20 border border-red-800 text-red-400 hover:bg-red-900/40 transition"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Xoá bộ lọc
              </button>
            </div>
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

          {!showSkeleton && hasSearchCriteria && searchResults.length === 0 && (
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

          {!hasSearchCriteria && (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <div className="w-20 h-20 rounded-full bg-blue-900/20 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <p className="text-gray-200 font-medium mb-1">Tìm cửa hàng</p>
              <p className="text-sm text-gray-500 mb-5">Gõ tên hoặc chọn quận bên trên để bắt đầu</p>
              {/* Quick district chips */}
              <div className="flex flex-wrap gap-2 justify-center max-w-xs">
                {DISTRICTS.slice(0, 6).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDistrict(d)}
                    className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-800 border border-gray-700 text-gray-400 hover:border-blue-600 hover:text-blue-400 transition"
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
