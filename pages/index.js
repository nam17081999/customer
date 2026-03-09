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
import removeVietnameseTones from '@/helper/removeVietnameseTones'

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
      // Split into individual words for word-order-independent matching
      const words = normTerm.split(/\s+/).filter(Boolean)

      // Score: 2 = exact substring match, 1 = all words present (any order), 0 = any word present
      results = results
        .map((s) => {
          const name = (s.name || '').toLowerCase()
          const normName = removeVietnameseTones(name)
          if (name.includes(term) || normName.includes(normTerm)) return { ...s, _score: 2 }
          if (words.length > 1 && words.every((w) => normName.includes(w))) return { ...s, _score: 1 }
          if (words.some((w) => normName.includes(w))) return { ...s, _score: 0 }
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
      try { searchInputRef.current.focus() } catch {}
    }
  }, [])

  const clearAllFilters = () => {
    setSearchTerm('')
    setSelectedDistrict('')
    setSelectedWard('')
  }

  return (
    <div className="h-[calc(100dvh-5rem)] bg-gray-950 overflow-hidden">
      <div className="h-full px-4 sm:px-5 pt-5 sm:pt-6 max-w-screen-md mx-auto flex flex-col gap-4">
        {/* HEADER NOI BAT - Nen xanh duong dam */}
        <div className="flex-shrink-0 bg-blue-600 rounded-2xl p-5 shadow-lg">
          <h1 className="text-2xl font-bold text-white mb-1">TIM KHACH HANG</h1>
          <p className="text-lg text-blue-100">Go ten hoac chon quan de tim</p>
        </div>

        {/* Search + Filters - NEN SANG HON */}
        <div className="flex-shrink-0 flex flex-col gap-4 bg-gray-800 rounded-2xl p-4">
          {/* O tim kiem LON - NEN TRANG */}
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Go ten khach hang..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            className="w-full text-lg h-14 bg-white text-gray-900 placeholder:text-gray-500 border-2 border-gray-300"
            aria-label="Tim kiem khach hang"
          />
          
          {/* Bo loc - 2 dong tren mobile de de nhan */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-lg font-bold text-yellow-400 mb-2">QUAN/HUYEN</label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                aria-label="Chon quan/huyen"
                className="w-full h-14 rounded-xl border-2 border-gray-500 bg-gray-700 px-4 text-lg text-white focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400 transition-all"
              >
                <option value="">-- Tat ca quan --</option>
                {districtOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-lg font-bold text-yellow-400 mb-2">XA/PHUONG</label>
              <select
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                disabled={!selectedDistrict}
                aria-label="Chon xa/phuong"
                className="w-full h-14 rounded-xl border-2 border-gray-500 bg-gray-700 px-4 text-lg text-white disabled:opacity-50 disabled:cursor-not-allowed focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400 transition-all"
              >
                <option value="">{selectedDistrict ? '-- Tat ca xa --' : 'Chon quan truoc'}</option>
                {wardOptions.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Thanh ket qua - MAU XANH LA NOI BAT */}
          {hasSearchCriteria && (
            <div className="flex items-center justify-between gap-3 bg-green-700 rounded-xl px-4 py-3">
              <p className="text-lg text-white font-semibold">
                Tim thay <span className="font-bold text-yellow-300 text-xl">{searchResults.length}</span> khach hang
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-base font-bold bg-red-600 text-white hover:bg-red-500 transition-all min-h-[48px] shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                XOA LOC
              </button>
            </div>
          )}
        </div>
        {/* Search Results */}
        <div className="flex-1 min-h-0 flex flex-col gap-3">
        

          {showSkeleton && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4" aria-label={loading ? 'Dang tai ket qua' : 'Dang chuan bi tim kiem'}>
              {[...Array(4)].map((_, i) => (
                <Card key={i} className={`overflow-hidden rounded-2xl bg-gray-800 border-2 border-gray-600 ${loading ? '' : 'opacity-70'}`}>
                  <CardContent className="p-0">
                    <div className="flex gap-4 p-4">
                      {/* Anh skeleton */}
                      <div className="w-24 h-24 rounded-xl bg-gray-600 animate-pulse flex-shrink-0" />
                      <div className="flex-1 space-y-3 py-1">
                        <div className="h-6 w-3/4 bg-gray-600 rounded-lg animate-pulse" />
                        <div className="h-5 w-full bg-gray-600 rounded-lg animate-pulse" />
                        <div className="h-5 w-1/2 bg-gray-600 rounded-lg animate-pulse" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!showSkeleton && hasSearchCriteria && searchResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-gray-800 rounded-2xl">
              {/* Icon lon hon - mau cam */}
              <div className="w-24 h-24 rounded-full bg-orange-500 flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <p className="text-2xl text-white font-bold mb-2">KHONG TIM THAY</p>
              <p className="text-lg text-gray-300 mb-6">Thu tim voi ten khac hoac bot bo loc</p>
              <Button asChild size="lg" className="bg-green-600 hover:bg-green-500 text-white text-lg font-bold h-14 px-8">
                <Link href="/store/create">
                  THEM KHACH HANG MOI
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
                  <div className="mb-4" key={`${store.id}-${store.distance == null ? 'x' : store.distance.toFixed(3)}`}>
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
                    <div className="py-6 text-center text-lg text-gray-500">
                      Het ket qua
                    </div>
                  )
                }}
              />
            </div>
          )}

          {!hasSearchCriteria && (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center bg-gray-800 rounded-2xl">
              {/* Icon lon hon - mau xanh duong noi bat */}
              <div className="w-28 h-28 rounded-full bg-blue-500 flex items-center justify-center mb-6 shadow-lg">
                <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <p className="text-2xl text-white font-bold mb-2">TIM KHACH HANG</p>
              <p className="text-lg text-gray-300 mb-6">Go ten hoac chon quan de bat dau</p>
              
              {/* Nut chon nhanh quan - MAU SAC NOI BAT */}
              <p className="text-lg text-yellow-400 font-bold mb-4">CHON NHANH QUAN:</p>
              <div className="flex flex-wrap gap-3 justify-center max-w-md">
                {DISTRICTS.slice(0, 6).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDistrict(d)}
                    className="px-5 py-3 rounded-xl text-lg font-bold bg-blue-600 border-2 border-blue-400 text-white hover:bg-blue-500 hover:scale-105 transition-all min-h-[52px] shadow-md"
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
