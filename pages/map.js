import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DetailStoreModalContent } from '@/components/detail-store-card'
import { getOrRefreshStores } from '@/lib/storeCache'
import { IGNORED_NAME_TERMS } from '@/helper/duplicateCheck'
import { loadGoogleMaps } from '@/lib/googleMaps'

function formatShortAddress(store) {
  if (!store) return ''
  const parts = []
  if (store.ward) parts.push(store.ward)
  if (store.district) parts.push(store.district)
  return parts.join(', ')
}

const DEFAULT_CENTER = { lat: 10.7769, lng: 106.70098 }

// Lazy-initialized custom OverlayView class for HTML markers
let _HtmlMarkerOverlay = null
function getHtmlMarkerOverlayClass() {
  if (_HtmlMarkerOverlay) return _HtmlMarkerOverlay

  class HtmlMarkerOverlay extends window.google.maps.OverlayView {
    constructor(position, content, zIndex, onClick) {
      super()
      this.position = position
      this.content = content
      this.zIndex_ = zIndex
      this.onClick = onClick
      this.div = null
    }

    onAdd() {
      this.div = document.createElement('div')
      this.div.style.position = 'absolute'
      this.div.style.zIndex = this.zIndex_
      this.div.style.cursor = 'pointer'
      this.div.appendChild(this.content)
      if (this.onClick) {
        this.div.addEventListener('click', (e) => {
          e.stopPropagation()
          this.onClick()
        })
      }
      const panes = this.getPanes()
      panes.overlayMouseTarget.appendChild(this.div)
    }

    draw() {
      if (!this.div) return
      const projection = this.getProjection()
      if (!projection) return
      const pos = projection.fromLatLngToDivPixel(this.position)
      if (pos) {
        this.div.style.left = pos.x + 'px'
        this.div.style.top = pos.y + 'px'
        this.div.style.transform = 'translate(-50%, -50%)'
      }
    }

    onRemove() {
      if (this.div?.parentNode) {
        this.div.parentNode.removeChild(this.div)
        this.div = null
      }
    }

    getElement() {
      return this.content
    }
  }

  _HtmlMarkerOverlay = HtmlMarkerOverlay
  return _HtmlMarkerOverlay
}

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
  const markersRef = useRef([])
  const markerByStoreIdRef = useRef(new Map())
  const highlightedRef = useRef(null)

  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStore, setSelectedStore] = useState(null)
  const [mapReady, setMapReady] = useState(false)
  const [gmapsError, setGmapsError] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const searchWrapperRef = useRef(null)
  const inputRef = useRef(null)
  const suggestionsRef = useRef(null)

  // Init Google Maps
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    let cancelled = false

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapContainerRef.current) return
        const map = new window.google.maps.Map(mapContainerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 13,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
          styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
        })
        mapRef.current = map
        setMapReady(true)

        // Try to center on user location
        if (navigator.geolocation) {
          const panToPos = (pos) => {
            try { map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude }) } catch {}
          }
          navigator.geolocation.getCurrentPosition(panToPos, () => {
            navigator.geolocation.getCurrentPosition(panToPos, () => {}, {
              enableHighAccuracy: false, timeout: 10000, maximumAge: 300000,
            })
          }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 })
        }
      })
      .catch((err) => {
        console.error('Google Maps load error:', err)
        if (!cancelled) setGmapsError(err.message || 'Không thể tải Google Maps')
      })

    return () => { cancelled = true }
  }, [])

  const storesWithCoords = useMemo(() => {
    return stores
      .map((store) => ({ ...store, coords: toLatLng(store) }))
      .filter((store) => store.coords)
  }, [stores])

  const suggestions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return []
    return storesWithCoords.filter((s) => (s.name || '').toLowerCase().includes(q))
  }, [searchTerm, storesWithCoords])

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => {
      if (m.setMap) m.setMap(null)
      if (m.map) m.map = null
    })
    markersRef.current = []
    markerByStoreIdRef.current.clear()
  }, [])

  // Fetch stores
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
    return () => { active = false }
  }, [])

  // Place markers when stores or map is ready
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    clearMarkers()
    if (storesWithCoords.length === 0) return

    storesWithCoords.forEach((store) => {
      const { lat, lng } = store.coords
      const fallbackWord = getFirstWord(store.name)

      // Create custom marker element
      const markerEl = document.createElement('button')
      markerEl.type = 'button'
      markerEl.className = 'store-marker'
      markerEl.setAttribute('aria-label', store.name || 'Store marker')

      const markerAvatar = document.createElement('span')
      markerAvatar.className = 'store-marker-avatar'

      const text = document.createElement('span')
      text.className = 'store-marker-text'
      text.textContent = fallbackWord
      markerAvatar.appendChild(text)
      markerEl.appendChild(markerAvatar)

      const nameLabel = document.createElement('span')
      nameLabel.className = 'store-marker-name'
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

      const HtmlMarkerOverlay = getHtmlMarkerOverlayClass()
      const marker = new HtmlMarkerOverlay(
        new window.google.maps.LatLng(lat, lng),
        markerEl,
        Math.round((90 - lat) * 1000),
        () => {
          map.panTo({ lat, lng })
          map.setZoom(Math.max(map.getZoom(), 16))
          setSelectedStore(store)
        }
      )
      marker.setMap(map)

      markersRef.current.push(marker)
      markerByStoreIdRef.current.set(store.id, marker)
    })

    // Update marker sizes on zoom change
    const updateMarkerSizes = () => {
      const zoom = map.getZoom()
      const size = zoom < 7 ? 20 : zoom < 8 ? 24 : zoom < 9 ? 30 : zoom < 11 ? 40 : 56
      const showName = zoom >= 11

      markersRef.current.forEach((marker) => {
        const el = marker.getElement?.()
        if (!el) return
        el.style.setProperty('--marker-size', `${size}px`)
        const nameEl = el.querySelector('.store-marker-name')
        if (nameEl) nameEl.style.display = showName ? 'block' : 'none'
      })
    }

    const listener = map.addListener('zoom_changed', updateMarkerSizes)
    updateMarkerSizes()

    return () => {
      if (listener) window.google.maps.event.removeListener(listener)
    }
  }, [storesWithCoords, mapReady, clearMarkers])

  const flyToStore = useCallback((store) => {
    if (!store?.coords) return
    const map = mapRef.current
    if (!map) return
    map.panTo({ lat: store.coords.lat, lng: store.coords.lng })
    map.setZoom(16)

    // Reset previous highlighted marker
    if (highlightedRef.current) {
      const prev = highlightedRef.current
      const el = prev.marker.getElement?.()
      el?.classList.remove('store-marker-highlight')
      highlightedRef.current = null
    }

    // Highlight the searched marker
    const marker = markerByStoreIdRef.current.get(store.id)
    if (marker) {
      const el = marker.getElement?.()
      el?.classList.add('store-marker-highlight')
      highlightedRef.current = { marker }
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

  if (gmapsError) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 px-6 text-center">
      <div className="text-red-500 text-lg font-semibold">Không tải được bản đồ Google Maps</div>
      <div className="text-sm text-gray-500 max-w-md">
        Vui lòng kiểm tra:
        <ul className="mt-2 text-left list-disc list-inside space-y-1">
          <li>Tắt trình chặn quảng cáo (uBlock Origin, AdBlock...) cho trang này</li>
          <li>Kiểm tra kết nối mạng</li>
          <li>API key Google Maps đã được bật Maps JavaScript API</li>
        </ul>
      </div>
      <button onClick={() => window.location.reload()} className="mt-2 px-4 py-2 bg-sky-500 text-sm text-white rounded-lg hover:bg-sky-400">
        Tải lại trang
      </button>
    </div>
  )

  return (
    <div className="relative h-[calc(100vh-56px)] w-full overflow-hidden bg-slate-950 text-slate-100">
      <div ref={mapContainerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-2 z-20 px-2 sm:top-3 sm:px-3">
        <div ref={searchWrapperRef} className="pointer-events-auto mx-auto w-full max-w-md">
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

      <Dialog open={!!selectedStore} onOpenChange={(open) => { if (!open) setSelectedStore(null) }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">{selectedStore?.name || 'Chi tiết cửa hàng'}</DialogTitle>
          <DetailStoreModalContent store={selectedStore} />
        </DialogContent>
      </Dialog>

      <style jsx global>{`
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
      `}</style>
    </div>
  )
}
