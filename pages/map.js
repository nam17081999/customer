import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DetailStoreModalContent } from '@/components/detail-store-card'
import { getOrRefreshStores } from '@/lib/storeCache'
import { IGNORED_NAME_TERMS } from '@/helper/duplicateCheck'

const DEFAULT_CENTER = [106.70098, 10.7769]

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

  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStore, setSelectedStore] = useState(null)
  const [mapReady, setMapReady] = useState(false)

  const storesWithCoords = useMemo(() => {
    return stores
      .map((store) => ({ ...store, coords: toLatLng(store) }))
      .filter((store) => store.coords)
  }, [stores])

  const storeNames = useMemo(() => {
    return storesWithCoords.map((store) => store.name).filter(Boolean)
  }, [storesWithCoords])

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

      // Try to center on user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!cancelled) {
              map.flyTo({
                center: [pos.coords.longitude, pos.coords.latitude],
                zoom: 13,
                duration: 1200
              })
            }
          },
          () => { /* ignore error, keep default center */ },
          { enableHighAccuracy: true, timeout: 8000 }
        )
      }

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

    storesWithCoords.forEach((store) => {
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
  }, [storesWithCoords, mapReady, clearMarkers, applyMarkerStyleByZoom])

  const handleSearch = useCallback(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return

    const matched = storesWithCoords.find((store) => {
      const name = (store.name || '').toLowerCase()
      return name === query || name.includes(query)
    })

    if (!matched) return

    const map = mapRef.current
    if (!map) return

    map.flyTo({ center: [matched.coords.lng, matched.coords.lat], zoom: 16, duration: 900 })
  }, [searchTerm, storesWithCoords])

  return (
    <div className="relative h-[calc(100vh-56px)] w-full overflow-hidden bg-slate-950 text-slate-100">
      <div ref={mapContainerRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-2 z-20 px-2 sm:top-3 sm:px-3">
        <div className="pointer-events-auto mx-auto w-full max-w-md rounded-xl bg-slate-900/80 p-1.5 shadow-lg ring-1 ring-white/15 backdrop-blur-md">
          <div className="grid grid-cols-[1fr_auto] items-center gap-1.5">
            <Input
              list="store-name-options"
              placeholder="Tìm cửa hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch()
              }}
              className="h-9 rounded-lg border-slate-700 bg-slate-950/90 px-3 text-[16px] sm:text-sm text-slate-100 placeholder:text-slate-400"
            />
            <datalist id="store-name-options">
              {storeNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <Button
              onClick={handleSearch}
              className="h-9 rounded-lg bg-sky-500 px-3 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 sm:px-4"
              disabled={loading || Boolean(error)}
            >
              Tìm
            </Button>
          </div>
        </div>
      </div>

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
      `}</style>
    </div>
  )
}
