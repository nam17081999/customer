import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DetailStoreModalContent } from '@/components/detail-store-card'
import { getOrRefreshStores } from '@/lib/storeCache'
import { IGNORED_NAME_TERMS } from '@/helper/duplicateCheck'
import { DISTRICT_WARD_SUGGESTIONS } from '@/lib/constants'
function formatShortAddress(store) {
  if (!store) return ''
  const parts = []
  if (store.ward) parts.push(store.ward)
  if (store.district) parts.push(store.district)
  return parts.join(', ')
}

const DEFAULT_CENTER = [105.6955684, 21.0768617]

/**
 * Get the first meaningful word of a store name,
 * skipping leading words that match IGNORED_NAME_TERMS.
 * E.g. "Cửa Hàng Anh Dũng" → "Anh"
 */
function getFirstWord(name = '') {
  let remaining = String(name).trim().toLowerCase()
  // Sort ignored terms by length (longest first) so multi-word terms
  // like "cửa hàng" are stripped before single-word "cửa".
  const sorted = [...IGNORED_NAME_TERMS].sort((a, b) => b.length - a.length)
  let stripped = true
  while (stripped) {
    stripped = false
    for (const term of sorted) {
      if (remaining.startsWith(term)) {
        remaining = remaining.slice(term.length).trimStart()
        stripped = true
        break
      }
    }
  }
  // Restore original casing by matching position in original string
  const offset = String(name).trim().length - remaining.length
  const meaningful = String(name).trim().slice(offset).trimStart()
  const first = meaningful.split(/\s+/)[0] || String(name).trim().split(/\s+/)[0] || '?'
  return first.slice(0, 12)
}

function parseCoordinate(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (typeof value !== 'string') return NaN
  const parsed = Number.parseFloat(value.trim().replace(/,/g, '.'))
  return Number.isFinite(parsed) ? parsed : NaN
}

function toLatLng(store) {
  let lat = parseCoordinate(store.latitude)
  let lng = parseCoordinate(store.longitude)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  // Fix swapped coordinates when dữ liệu bị đảo cột lat/lng
  if ((lat < -90 || lat > 90) && lng >= -90 && lng <= 90 && lat >= -180 && lat <= 180) {
    const temp = lat
    lat = lng
    lng = temp
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  return { lat, lng }
}

function buildAddress(store) {
  return [store.address_detail, store.ward, store.district].filter(Boolean).join(', ')
}

export default function MapPage() {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const maplibreRef = useRef(null)
  const markersRef = useRef([])
  const markerByStoreIdRef = useRef(new Map())
  const highlightedRef = useRef(null)

  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStore, setSelectedStore] = useState(null)
  const [mapReady, setMapReady] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [selectedDistricts, setSelectedDistricts] = useState([])
  const [selectedWards, setSelectedWards] = useState([])
  const searchWrapperRef = useRef(null)
  const inputRef = useRef(null)
  const suggestionsRef = useRef(null)

  // Detect desktop via pointer capability (not screen width)
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    setIsDesktop(mq.matches)
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const storesWithCoords = useMemo(() => {
    return stores
      .map((store) => ({ ...store, coords: toLatLng(store) }))
      .filter((store) => store.coords)
  }, [stores])

  // Filtered stores based on district/ward selection
  // Rule: must select ward(s) to show stores — selecting district alone only reveals ward options
  const filteredStores = useMemo(() => {
    if (selectedWards.length === 0) return storesWithCoords
    return storesWithCoords.filter((store) => {
      const w = (store.ward || '').trim()
      return selectedWards.includes(w)
    })
  }, [storesWithCoords, selectedWards])

  // Available wards based on selected districts
  const availableWards = useMemo(() => {
    if (selectedDistricts.length === 0) return []
    const wards = []
    for (const d of selectedDistricts) {
      if (DISTRICT_WARD_SUGGESTIONS[d]) wards.push(...DISTRICT_WARD_SUGGESTIONS[d])
    }
    return wards
  }, [selectedDistricts])

  // Count stores per district and ward for display
  const storeCounts = useMemo(() => {
    const districtCounts = {}
    const wardCounts = {}
    for (const store of storesWithCoords) {
      const d = (store.district || '').trim()
      const w = (store.ward || '').trim()
      if (d) districtCounts[d] = (districtCounts[d] || 0) + 1
      if (w) wardCounts[w] = (wardCounts[w] || 0) + 1
    }
    return { districtCounts, wardCounts }
  }, [storesWithCoords])

  const toggleDistrict = useCallback((district) => {
    setSelectedDistricts(prev => {
      if (prev.includes(district)) {
        const next = prev.filter(d => d !== district)
        // Also remove wards belonging to unselected district
        const removedWards = DISTRICT_WARD_SUGGESTIONS[district] || []
        setSelectedWards(w => w.filter(x => !removedWards.includes(x)))
        return next
      }
      return [...prev, district]
    })
  }, [])

  const toggleWard = useCallback((ward) => {
    setSelectedWards(prev =>
      prev.includes(ward) ? prev.filter(w => w !== ward) : [...prev, ward]
    )
  }, [])

  const clearFilters = useCallback(() => {
    setSelectedDistricts([])
    setSelectedWards([])
  }, [])

  const suggestions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return []
    return storesWithCoords.filter((s) => (s.name || '').toLowerCase().includes(q))
  }, [searchTerm, storesWithCoords])

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []
    markerByStoreIdRef.current.clear()
  }, [])

  const applyMarkerStyleByZoom = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    const zoom = map.getZoom()
    const size = zoom < 7 ? 20 : zoom < 8 ? 24 : zoom < 9 ? 30 : zoom < 11 ? 40 : 56

    const showName = zoom >= 11

    markersRef.current.forEach((marker) => {
      const el = marker.getElement()
      if (!el) return
      el.style.setProperty('--marker-size', `${size}px`)
      const nameEl = el.querySelector('.store-marker-name')
      if (nameEl) nameEl.style.display = showName ? 'block' : 'none'
    })
  }, [])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    let cancelled = false
    let activeMap = null

    const initMap = async () => {
      const maplibreModule = await import('maplibre-gl')
      if (cancelled || !mapContainerRef.current) return

      const maplibregl = maplibreModule.default
      maplibreRef.current = maplibregl

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap'
            }
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
        },
        center: DEFAULT_CENTER,
        zoom: 13,
        minZoom: 3,
        maxZoom: 20,
        attributionControl: true
      })

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')
      map.on('zoom', applyMarkerStyleByZoom)

      mapRef.current = map
      activeMap = map
      setMapReady(true)
    }

    initMap().catch((e) => {
      console.error(e)
      setError('Không thể khởi tạo bản đồ. Vui lòng tải lại trang.')
    })

    return () => {
      cancelled = true
      clearMarkers()
      if (activeMap) activeMap.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [clearMarkers, applyMarkerStyleByZoom])

  useEffect(() => {
    let active = true

    const fetchAllStores = async () => {
      setLoading(true)
      setError('')

      try {
        const data = await getOrRefreshStores()
        if (active) setStores(data)
      } catch (e) {
        if (active) {
          console.error(e)
          setError('Không thể tải dữ liệu cửa hàng. Vui lòng thử lại.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchAllStores()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const maplibregl = maplibreRef.current
    if (!map || !maplibregl || !mapReady) return

    clearMarkers()

    if (storesWithCoords.length === 0) return

    filteredStores.forEach((store) => {
      const { lat, lng } = store.coords

      const markerEl = document.createElement('button')
      markerEl.type = 'button'
      markerEl.className = 'store-marker'
      markerEl.setAttribute('aria-label', store.name || 'Store marker')

      const markerAvatar = document.createElement('span')
      markerAvatar.className = 'store-marker-avatar'

      const fallbackWord = getFirstWord(store.name)
      const text = document.createElement('span')
      text.className = 'store-marker-text'
      text.textContent = fallbackWord
      markerAvatar.appendChild(text)

      markerEl.appendChild(markerAvatar)

      const nameLabel = document.createElement('span')
      nameLabel.className = 'store-marker-name'
      // Show 3 words per line, wrap rest to next line
      const rawName = store.name || 'Cửa hàng'
      const words = rawName.split(/\s+/)
      if (words.length <= 3) {
        nameLabel.textContent = rawName
      } else {
        const lines = []
        for (let i = 0; i < words.length; i += 3) {
          lines.push(words.slice(i, i + 3).join(' '))
        }
        nameLabel.innerHTML = lines.map(l => l.replace(/</g, '&lt;')).join('<br>')
      }
      markerEl.appendChild(nameLabel)

      // Hover tooltip with name + address (desktop only)
      const tooltip = document.createElement('div')
      tooltip.className = 'store-marker-tooltip'
      const tooltipName = document.createElement('div')
      tooltipName.className = 'store-marker-tooltip-name'
      tooltipName.textContent = store.name || 'Cửa hàng'
      tooltip.appendChild(tooltipName)
      const addr = buildAddress(store)
      if (addr) {
        const tooltipAddr = document.createElement('div')
        tooltipAddr.className = 'store-marker-tooltip-addr'
        tooltipAddr.textContent = addr
        tooltip.appendChild(tooltipAddr)
      }
      markerEl.appendChild(tooltip)

      const marker = new maplibregl.Marker({ element: markerEl, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(map)

      // z-index: stores lower on screen (smaller lat) render on top
      const wrapperEl = marker.getElement()?.parentElement || marker.getElement()
      if (wrapperEl?.classList?.contains('maplibregl-marker')) {
        wrapperEl.style.zIndex = Math.round((90 - lat) * 1000)
      }

      markerEl.addEventListener('click', (e) => {
        e.stopPropagation()
        map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 900 })
        setSelectedStore(store)
      })

      markersRef.current.push(marker)
      markerByStoreIdRef.current.set(store.id, marker)
    })
    applyMarkerStyleByZoom()
  }, [filteredStores, mapReady, clearMarkers, applyMarkerStyleByZoom])

  const flyToStore = useCallback((store) => {
    if (!store?.coords) return
    const map = mapRef.current
    if (!map) return
    map.flyTo({ center: [store.coords.lng, store.coords.lat], zoom: 16, duration: 900 })

    // Reset previous highlighted marker
    if (highlightedRef.current) {
      const prev = highlightedRef.current
      if (prev.wrapper) prev.wrapper.style.setProperty('z-index', prev.originalZ)
      prev.marker.getElement()?.classList.remove('store-marker-highlight')
      highlightedRef.current = null
    }

    // Highlight the searched marker
    const marker = markerByStoreIdRef.current.get(store.id)
    if (marker) {
      const el = marker.getElement()
      const wrapper = el?.parentElement?.classList?.contains('maplibregl-marker')
        ? el.parentElement : el
      const originalZ = wrapper?.style.zIndex || '0'
      if (wrapper) wrapper.style.setProperty('z-index', '999999', 'important')
      el?.classList.add('store-marker-highlight')
      highlightedRef.current = { marker, originalZ, wrapper }
    }

    setShowSuggestions(false)
    setSearchTerm(store.name || '')
    inputRef.current?.blur()
  }, [])

  const handleSearch = useCallback(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return

    const matched = storesWithCoords.find((store) => {
      const name = (store.name || '').toLowerCase()
      return name === query || name.includes(query)
    })

    if (matched) flyToStore(matched)
    setShowSuggestions(false)
  }, [searchTerm, storesWithCoords, flyToStore])

  // Close suggestions on outside click
  useEffect(() => {
    function onPointerDown(e) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // Recalculate scroll indicator when suggestions change
  useEffect(() => {
    const el = suggestionsRef.current
    if (el) {
      setCanScrollDown(el.scrollHeight > el.clientHeight + 2)
    } else {
      setCanScrollDown(false)
    }
  }, [suggestions])

  return (
    <div className="relative h-[calc(100vh-56px)] w-full overflow-hidden bg-slate-950 text-slate-100 flex">
      {/* Map area */}
      <div className="relative flex-1 h-full">
        <div ref={mapContainerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-2 z-20 px-2 sm:top-3 sm:px-3">
        <div ref={searchWrapperRef} className="pointer-events-auto mx-auto w-full max-w-md md:mx-0 md:mr-auto">
          <div className="rounded-xl bg-slate-900/80 p-1.5 shadow-lg ring-1 ring-white/15 backdrop-blur-md">
            <div className="grid grid-cols-[1fr_auto] items-center gap-1.5">
              <Input
                ref={inputRef}
                placeholder="Tìm cửa hàng..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setShowSuggestions(true)
                  setActiveSuggestion(-1)
                }}
                onFocus={() => { if (searchTerm.trim()) setShowSuggestions(true) }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActiveSuggestion((i) => Math.max(i - 1, -1))
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
                      flyToStore(suggestions[activeSuggestion])
                    } else {
                      handleSearch()
                    }
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false)
                    inputRef.current?.blur()
                  }
                }}
                className="h-9 rounded-lg border-slate-700 bg-slate-950/90 px-3 text-[16px] sm:text-sm text-slate-100 placeholder:text-slate-400"
              />
              <Button
                onClick={handleSearch}
                className="h-9 rounded-lg bg-sky-500 px-3 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 sm:px-4"
                disabled={loading || Boolean(error)}
              >
                Tìm
              </Button>
            </div>
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="relative mt-1 rounded-xl bg-slate-900/95 shadow-xl ring-1 ring-white/15 backdrop-blur-md">
              <div
                ref={suggestionsRef}
                className="max-h-64 overflow-y-auto"
                onScroll={(e) => {
                  const el = e.currentTarget
                  setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 2)
                }}
              >
                {suggestions.map((store, idx) => (
                  <button
                    key={store.id}
                    type="button"
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors ${
                      idx === activeSuggestion ? 'bg-sky-500/20' : 'hover:bg-slate-800/80'
                    } border-b border-slate-700/50`}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => flyToStore(store)}
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-slate-100">{store.name}</span>
                    <span className="shrink-0 max-w-[45%] truncate text-right text-xs text-slate-400">{formatShortAddress(store)}</span>
                  </button>
                ))}
              </div>
              {canScrollDown && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center rounded-b-xl bg-gradient-to-t from-slate-900/90 to-transparent pb-1 pt-4">
                  <svg width="14" height="8" viewBox="0 0 14 8" className="text-slate-400">
                    <path d="M1 1l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      </div>

      {/* Right Sidebar - desktop only (detected via pointer capability) */}
      {isDesktop && (
      <div className="flex flex-col w-[320px] h-full bg-slate-900 border-l border-slate-700/60 shrink-0">
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
          <h2 className="text-sm font-semibold text-slate-100">Bộ lọc khu vực</h2>
          <div className="flex items-center gap-2">
            {(selectedDistricts.length > 0 || selectedWards.length > 0) && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-sky-400 hover:text-sky-300"
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>

        {/* Filter count */}
        <div className="px-4 py-2 text-xs text-slate-400 border-b border-slate-700/40">
          Hiển thị <span className="font-semibold text-slate-200">{filteredStores.length}</span> / {storesWithCoords.length} cửa hàng
        </div>

        {/* Scrollable filter content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* District section */}
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">Quận / Huyện</h3>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(DISTRICT_WARD_SUGGESTIONS).map((district) => {
                const active = selectedDistricts.includes(district)
                const count = storeCounts.districtCounts[district] || 0
                return (
                  <button
                    key={district}
                    type="button"
                    onClick={() => toggleDistrict(district)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 ring-1 ring-slate-600/40'
                    }`}
                  >
                    {district}
                    {count > 0 && <span className={`text-[10px] ${active ? 'text-sky-400' : 'text-slate-500'}`}>({count})</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ward section - only show when districts selected */}
          {selectedDistricts.length > 0 && availableWards.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1">Xã / Phường <span className="normal-case font-normal text-slate-500">(chọn để hiển thị)</span></h3>
              {selectedDistricts.map((district) => {
                const wards = DISTRICT_WARD_SUGGESTIONS[district] || []
                if (wards.length === 0) return null
                return (
                  <div key={district} className="mb-3">
                    <div className="text-[11px] font-medium text-slate-400 mb-1.5">{district}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {wards.map((ward) => {
                        const active = selectedWards.includes(ward)
                        const count = storeCounts.wardCounts[ward] || 0
                        return (
                          <button
                            key={ward}
                            type="button"
                            onClick={() => toggleWard(ward)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                              active
                                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 ring-1 ring-slate-600/30'
                            }`}
                          >
                            {ward}
                            {count > 0 && <span className={`text-[10px] ${active ? 'text-emerald-400' : 'text-slate-500'}`}>({count})</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      )}

      <Dialog open={!!selectedStore} onOpenChange={(open) => { if (!open) setSelectedStore(null) }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">{selectedStore?.name || 'Chi tiết cửa hàng'}</DialogTitle>
          <DetailStoreModalContent store={selectedStore} />
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .maplibregl-map {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          background: #e5e7eb;
        }

        .maplibregl-canvas-container,
        .maplibregl-canvas {
          width: 100% !important;
          height: 100% !important;
        }

        .maplibregl-marker {
          position: absolute !important;
          opacity: 1 !important;
          visibility: visible !important;
          overflow: visible !important;
        }

        .store-marker {
          width: var(--marker-size, 56px);
          height: var(--marker-size, 56px);
          border: 0;
          background: transparent;
          padding: 0;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.15s ease;
          overflow: visible;
        }

        .store-marker:hover {
          transform: scale(1.06);
        }

        .store-marker-avatar {
          width: var(--marker-size, 56px);
          height: var(--marker-size, 56px);
          border-radius: 9999px;
          border: 3px solid #ffffff;
          background: #1f2937;
          overflow: hidden;
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .store-marker-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .store-marker-text {
          font-size: 11px;
          line-height: 1;
          font-weight: 700;
          color: #ffffff;
          text-transform: uppercase;
          text-align: center;
          padding: 0 6px;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          width: 100%;
        }

        .store-marker-name {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 2px;
          font-size: 11px;
          font-weight: 600;
          color: #1e293b;
          background: rgba(255, 255, 255, 0.92);
          padding: 2px 6px;
          border-radius: 4px;
          white-space: nowrap;
          text-align: center;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
          line-height: 1.4;
          pointer-events: none;
        }

        .hidden {
          display: none;
        }

        .store-marker-highlight .store-marker-avatar {
          border-color: #38bdf8;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.4), 0 8px 18px rgba(0, 0, 0, 0.25);
        }

        /* Hover tooltip - desktop only */
        .store-marker-tooltip {
          display: none;
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(15, 23, 42, 0.95);
          color: #f1f5f9;
          padding: 6px 10px;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
          pointer-events: none;
          z-index: 10;
          white-space: nowrap;
        }

        .store-marker-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: rgba(15, 23, 42, 0.95);
        }

        @media (hover: hover) and (pointer: fine) {
          .store-marker:hover .store-marker-tooltip {
            display: block;
          }
        }

        .store-marker-tooltip-name {
          font-size: 13px;
          font-weight: 600;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 300px;
        }

        .store-marker-tooltip-addr {
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 300px;
        }
      `}</style>
    </div>
  )
}
