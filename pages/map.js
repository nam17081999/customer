import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import StoreDetailModal from '@/components/store-detail-modal'
import { getOrRefreshStores } from '@/lib/storeCache'
import { IGNORED_NAME_TERMS } from '@/helper/duplicateCheck'
import { DISTRICT_WARD_SUGGESTIONS, STORE_TYPE_OPTIONS } from '@/lib/constants'
import { getBestPosition, getGeoErrorMessage, requestCompassHeading } from '@/helper/geolocation'
function formatShortAddress(store) {
  if (!store) return ''
  const parts = []
  if (store.ward) parts.push(store.ward)
  if (store.district) parts.push(store.district)
  return parts.join(', ')
}

const DEFAULT_CENTER = [105.6955684, 21.0768617]
const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] }

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

/**
 * Pre-render house icon + store name into a single canvas image.
 * Returns { width, height, data, dpr, anchorY } for MapLibre addImage.
 */
function createStoreMarker(text, fontSize = 13, maxWidthEm = 9, highlighted = false) {
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 2

  // ── House icon dimensions ──
  const iconSize = Math.round(38 * dpr) // circle diameter
  const iconPad = Math.round(2 * dpr)   // space around circle
  const hlPad = highlighted ? Math.round(5 * dpr) : 0 // extra space for highlight ring
  const gap = Math.round(1 * dpr)       // gap between icon and label

  // ── Label dimensions ──
  const scaledFont = Math.round(fontSize * dpr)
  const maxPxWidth = Math.round(maxWidthEm * fontSize * dpr)
  const paddingX = Math.round(7 * dpr)
  const paddingY = Math.round(3 * dpr)
  const lineHeight = Math.round(scaledFont * 1.3)
  const radius = Math.round(5 * dpr)

  // Measure & word-wrap label text
  const measure = document.createElement('canvas').getContext('2d')
  measure.font = `bold ${scaledFont}px "Open Sans", system-ui, sans-serif`
  const words = text.split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (measure.measureText(test).width > maxPxWidth && cur) {
      lines.push(cur)
      cur = w
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)

  const textW = Math.max(...lines.map((l) => Math.ceil(measure.measureText(l).width)))
  const labelW = textW + paddingX * 2
  const labelH = lines.length * lineHeight + paddingY * 2

  // ── Combined canvas ──
  const totalW = Math.max(iconSize + iconPad * 2 + hlPad * 2, labelW)
  const iconBottom = iconSize + hlPad * 2
  const totalH = iconBottom + gap + labelH
  const canvas = document.createElement('canvas')
  canvas.width = totalW
  canvas.height = totalH
  const ctx = canvas.getContext('2d')

  // Draw house icon (centered horizontally)
  const iconCX = totalW / 2
  const iconCY = hlPad + iconPad + iconSize / 2
  const r = iconSize / 2 - iconPad

  // Highlight ring (if selected)
  if (highlighted) {
    ctx.beginPath()
    ctx.arc(iconCX, iconCY, r + hlPad, 0, Math.PI * 2)
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 3 * dpr
    ctx.stroke()
  }

  // Circle bg
  ctx.beginPath()
  ctx.arc(iconCX, iconCY, r, 0, Math.PI * 2)
  ctx.fillStyle = '#1f2937'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5 * dpr
  ctx.stroke()

  // House shape inside circle
  const s = r * 0.52
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 0.8 * dpr
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // Roof
  ctx.beginPath()
  ctx.moveTo(iconCX, iconCY - s * 0.9)
  ctx.lineTo(iconCX - s, iconCY - s * 0.05)
  ctx.lineTo(iconCX + s, iconCY - s * 0.05)
  ctx.closePath()
  ctx.fill()
  // Body
  ctx.fillRect(iconCX - s * 0.72, iconCY - s * 0.05, s * 1.44, s * 1.0)
  // Door
  ctx.fillStyle = '#1f2937'
  ctx.fillRect(iconCX - s * 0.2, iconCY + s * 0.3, s * 0.4, s * 0.65)

  // Draw label background (centered horizontally)
  const lx = (totalW - labelW) / 2
  const ly = iconBottom + gap
  ctx.beginPath()
  ctx.roundRect(lx, ly, labelW, labelH, radius)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.13)'
  ctx.lineWidth = dpr
  ctx.stroke()

  // Draw label text
  ctx.font = `bold ${scaledFont}px "Open Sans", system-ui, sans-serif`
  ctx.fillStyle = '#f1f5f9'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], totalW / 2, ly + paddingY + i * lineHeight)
  }

  return { width: totalW, height: totalH, data: ctx.getImageData(0, 0, totalW, totalH).data, dpr }
}

function createUserHeadingFanImage() {
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 2
  const size = 132 * dpr
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const center = size / 2
  const innerRadius = 7 * dpr
  const outerRadius = 58 * dpr
  const outerSpread = (32 * Math.PI) / 180
  const innerSpread = (16 * Math.PI) / 180
  const startOuter = -Math.PI / 2 - outerSpread
  const endOuter = -Math.PI / 2 + outerSpread
  const startInner = -Math.PI / 2 - innerSpread
  const endInner = -Math.PI / 2 + innerSpread

  ctx.beginPath()
  ctx.moveTo(center, center)
  ctx.arc(center, center, outerRadius, startOuter, endOuter)
  ctx.closePath()
  ctx.fillStyle = 'rgba(59, 130, 246, 0.42)'
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(center, center)
  ctx.arc(center, center, outerRadius, startOuter, endOuter)
  ctx.closePath()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)'
  ctx.lineWidth = 2.2 * dpr
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(center, center)
  ctx.arc(center, center, outerRadius * 0.72, startInner, endInner)
  ctx.closePath()
  ctx.fillStyle = 'rgba(96, 165, 250, 0.5)'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(center, center, innerRadius, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(37, 99, 235, 0.18)'
  ctx.fill()

  return {
    width: size,
    height: size,
    data: ctx.getImageData(0, 0, size, size).data,
    dpr,
  }
}

export default function MapPage() {
  const router = useRouter()
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const maplibreRef = useRef(null)
  const popupRef = useRef(null)
  const highlightedStoreIdRef = useRef(null)
  const locatingUserRef = useRef(false)

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
  const [isStandalonePwa, setIsStandalonePwa] = useState(false)
  const [selectedDistricts, setSelectedDistricts] = useState([])
  const [selectedWards, setSelectedWards] = useState([])
  const [selectedStoreTypes, setSelectedStoreTypes] = useState([])
  const [locatingUser, setLocatingUser] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [userLocation, setUserLocation] = useState(null)
  const searchWrapperRef = useRef(null)
  const inputRef = useRef(null)
  const suggestionsRef = useRef(null)

  const initialTarget = useMemo(() => {
    if (!router.isReady) return null
    const rawLat = Array.isArray(router.query.lat) ? router.query.lat[0] : router.query.lat
    const rawLng = Array.isArray(router.query.lng) ? router.query.lng[0] : router.query.lng
    const lat = parseCoordinate(rawLat)
    const lng = parseCoordinate(rawLng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
    return { lat, lng }
  }, [router.isReady, router.query.lat, router.query.lng])

  const initialStoreId = useMemo(() => {
    if (!router.isReady) return ''
    const rawStoreId = Array.isArray(router.query.storeId) ? router.query.storeId[0] : router.query.storeId
    return rawStoreId ? String(rawStoreId) : ''
  }, [router.isReady, router.query.storeId])

  // Detect desktop via pointer capability (not screen width)
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    setIsDesktop(mq.matches)
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const standaloneMq = window.matchMedia('(display-mode: standalone)')
    const updateStandaloneState = () => {
      setIsStandalonePwa(Boolean(standaloneMq.matches || window.navigator.standalone === true))
    }

    updateStandaloneState()
    standaloneMq.addEventListener('change', updateStandaloneState)
    return () => standaloneMq.removeEventListener('change', updateStandaloneState)
  }, [])

  const storesWithCoords = useMemo(() => {
    return stores
      .map((store) => ({ ...store, coords: toLatLng(store) }))
      .filter((store) => store.coords)
  }, [stores])

  const storesAfterAreaFilters = useMemo(() => {
    if (selectedWards.length === 0) return storesWithCoords
    return storesWithCoords.filter((store) => {
      const w = (store.ward || '').trim()
      return selectedWards.includes(w)
    })
  }, [storesWithCoords, selectedWards])

  const filteredStores = useMemo(() => {
    return storesAfterAreaFilters.filter((store) => {
      const typeMatched = selectedStoreTypes.length === 0 || selectedStoreTypes.includes(store.store_type || '')
      return typeMatched
    })
  }, [storesAfterAreaFilters, selectedStoreTypes])

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

  const storeTypeCounts = useMemo(() => {
    const counts = {}
    for (const store of storesAfterAreaFilters) {
      const key = store.store_type || ''
      if (!key) continue
      counts[key] = (counts[key] || 0) + 1
    }
    return counts
  }, [storesAfterAreaFilters])

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

  const toggleStoreType = useCallback((storeType) => {
    setSelectedStoreTypes((prev) =>
      prev.includes(storeType) ? prev.filter((value) => value !== storeType) : [...prev, storeType]
    )
  }, [])

  const clearFilters = useCallback(() => {
    setSelectedDistricts([])
    setSelectedWards([])
    setSelectedStoreTypes([])
  }, [])

  const suggestions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return []
    return storesWithCoords.filter((s) => (s.name || '').toLowerCase().includes(q))
  }, [searchTerm, storesWithCoords])

  const storeMapRef = useRef(new Map()) // storeId → store data for quick lookup

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
          glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
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
        center: initialTarget ? [initialTarget.lng, initialTarget.lat] : DEFAULT_CENTER,
        zoom: initialTarget ? 16 : 13,
        minZoom: 3,
        maxZoom: 20,
        attributionControl: true
      })

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')

      // Add GeoJSON source
      map.on('load', () => {
        if (cancelled) return

        map.addSource('stores', {
          type: 'geojson',
          data: EMPTY_FEATURE_COLLECTION,
        })

        map.addSource('user-location', {
          type: 'geojson',
          data: EMPTY_FEATURE_COLLECTION,
        })

        // Combined marker: house icon + name label in one image per store
        map.addLayer({
          id: 'store-marker',
          type: 'symbol',
          source: 'stores',
          layout: {
            'icon-image': ['case',
              ['==', ['get', 'highlighted'], 'yes'], ['concat', 'smh-', ['get', 'storeId']],
              ['concat', 'sm-', ['get', 'storeId']]
            ],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 10, 0.55, 14, 0.8, 17, 1],
            'icon-anchor': 'top',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'symbol-sort-key': ['case', ['==', ['get', 'highlighted'], 'yes'], 999, 0],
            'symbol-z-order': 'auto',
          },
        })

        map.addLayer({
          id: 'user-location-halo',
          type: 'circle',
          source: 'user-location',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 9, 12, 12, 16, 16],
            'circle-color': 'rgba(59, 130, 246, 0.22)',
          },
        })

        if (!map.hasImage('user-heading-fan')) {
          const img = createUserHeadingFanImage()
          map.addImage('user-heading-fan', { width: img.width, height: img.height, data: img.data }, { pixelRatio: img.dpr })
        }

        map.addLayer({
          id: 'user-location-heading',
          type: 'symbol',
          source: 'user-location',
          layout: {
            'icon-image': 'user-heading-fan',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 1.05, 8, 0.92, 12, 0.78, 16, 0.62],
            'icon-rotate': ['get', 'heading'],
            'icon-rotation-alignment': 'map',
            'icon-anchor': 'center',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            'icon-opacity': ['case', ['==', ['get', 'hasHeading'], 'yes'], 1, 0],
          },
        })

        map.addLayer({
          id: 'user-location-dot',
          type: 'circle',
          source: 'user-location',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 12, 6, 16, 8],
            'circle-color': '#2563eb',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          },
        })

        // Click on store marker → open dialog
        map.on('click', 'store-marker', (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['store-marker'] })
          if (!features.length) return
          const f = features[0]
          const storeId = f.properties.storeId
          const store = storeMapRef.current.get(storeId)
          if (store) {
            const [lng, lat] = f.geometry.coordinates
            map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 900 })
            setSelectedStore(store)
          }
        })

        // Hover tooltip (desktop only) using Popup
        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'store-hover-popup',
          offset: 14,
          maxWidth: '320px',
        })
        popupRef.current = popup

        map.on('mousemove', 'store-marker', (e) => {
          if (!e.features?.length) return
          map.getCanvas().style.cursor = 'pointer'
          const f = e.features[0]
          const name = f.properties.name || 'Cửa hàng'
          const addr = f.properties.address || ''
          popup.setLngLat(f.geometry.coordinates)
            .setHTML(
              `<div style="font-size:13px;font-weight:600;line-height:1.3;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name.replace(/</g, '&lt;')}</div>` +
              (addr ? `<div style="font-size:11px;color:#94a3b8;line-height:1.3;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${addr.replace(/</g, '&lt;')}</div>` : '')
            )
            .addTo(map)
        })

        map.on('mouseleave', 'store-marker', () => {
          map.getCanvas().style.cursor = ''
          popup.remove()
        })

        setMapReady(true)
      })

      mapRef.current = map
      activeMap = map
    }

    initMap().catch((e) => {
      console.error(e)
      setError('Không thể khởi tạo bản đồ. Vui lòng tải lại trang.')
    })

    return () => {
      cancelled = true
      if (popupRef.current) popupRef.current.remove()
      if (activeMap) activeMap.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [initialTarget])

  useEffect(() => {
    let active = true

    const fetchAllStores = async () => {
      setLoading(true)
      setError('')

      try {
        const data = await getOrRefreshStores()
        const visibleStores = (data || []).filter((store) => toLatLng(store))
        if (active) setStores(visibleStores)
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

  const applyStoreChange = useCallback((detail = {}) => {
    const { type, id, ids, store, stores } = detail

    setStores((prev) => {
      if (type === 'delete' && id != null) {
        return prev.filter((item) => item.id !== id)
      }

      if (type === 'verify-many' && Array.isArray(ids) && ids.length > 0) {
        const idSet = new Set(ids)
        return prev.map((item) => (
          idSet.has(item.id) ? { ...item, active: true } : item
        ))
      }

      if (type === 'append-many' && Array.isArray(stores) && stores.length > 0) {
        const byId = new Map(prev.map((item) => [item.id, item]))
        stores.forEach((item) => {
          if (item?.id == null) return
          if (!toLatLng(item)) return
          byId.set(item.id, item)
        })
        return Array.from(byId.values())
      }

      if (type === 'update' && store?.id != null) {
        const hasCoords = Boolean(toLatLng(store))
        let found = false
        const next = prev
          .map((item) => {
            if (item.id !== store.id) return item
            found = true
            return hasCoords ? { ...item, ...store } : null
          })
          .filter(Boolean)

        if (found) return next
        return hasCoords ? [...next, store] : next
      }

      return prev
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStoresChanged = async (event) => {
      const detail = event?.detail || {}
      const shouldRefetchAll = Boolean(detail.shouldRefetchAll)
      if (!shouldRefetchAll) applyStoreChange(detail)
      if (shouldRefetchAll) {
        try {
          const data = await getOrRefreshStores()
          setStores((data || []).filter((store) => toLatLng(store)))
        } catch (e) {
          console.error(e)
        }
      }
    }

    window.addEventListener('storevis:stores-changed', handleStoresChanged)
    return () => window.removeEventListener('storevis:stores-changed', handleStoresChanged)
  }, [applyStoreChange])

  // Update GeoJSON source when filtered stores change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    // Build lookup map for click handler
    const lookup = new Map()
    filteredStores.forEach((store) => { lookup.set(String(store.id), store) })
    storeMapRef.current = lookup

    const source = map.getSource('stores')
    if (!source) return

    const features = filteredStores.map((store) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [store.coords.lng, store.coords.lat] },
      properties: {
        storeId: String(store.id),
        name: store.name || 'Cửa hàng',
        shortName: getFirstWord(store.name),
        address: buildAddress(store),
      },
    }))

    // Generate combined marker images (house icon + label in one canvas)
    for (const f of features) {
      const imgId = `sm-${f.properties.storeId}`
      if (!map.hasImage(imgId)) {
        const img = createStoreMarker(f.properties.name)
        map.addImage(imgId, { width: img.width, height: img.height, data: img.data }, { pixelRatio: img.dpr })
      }
    }

    source.setData({ type: 'FeatureCollection', features })
  }, [filteredStores, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const pointSource = map.getSource('user-location')
    if (!pointSource) return

    const features = userLocation
      ? [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [userLocation.longitude, userLocation.latitude],
        },
        properties: {
          heading: userLocation.heading ?? 0,
          hasHeading: userLocation.heading != null ? 'yes' : 'no',
        },
      }]
      : []

    pointSource.setData({ type: 'FeatureCollection', features })
  }, [mapReady, userLocation])

  const flyToStore = useCallback((store) => {
    if (!store?.coords) return
    const map = mapRef.current
    if (!map) return
    map.flyTo({ center: [store.coords.lng, store.coords.lat], zoom: 16, duration: 900 })

    // Generate highlighted image if not already cached
    const hlId = `smh-${store.id}`
    if (!map.hasImage(hlId)) {
      const img = createStoreMarker(store.name || 'Cửa hàng', 13, 9, true)
      map.addImage(hlId, { width: img.width, height: img.height, data: img.data }, { pixelRatio: img.dpr })
    }

    // Update features: set highlighted property and move highlighted store to end (renders on top)
    highlightedStoreIdRef.current = String(store.id)
    const source = map.getSource('stores')
    if (source) {
      const storeId = String(store.id)
      const features = filteredStores.map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.coords.lng, s.coords.lat] },
        properties: {
          storeId: String(s.id),
          name: s.name || 'Cửa hàng',
          shortName: getFirstWord(s.name),
          address: buildAddress(s),
          highlighted: String(s.id) === storeId ? 'yes' : 'no',
        },
      }))
      // Move highlighted to end so it renders on top
      const hlIdx = features.findIndex((f) => f.properties.storeId === storeId)
      if (hlIdx >= 0) {
        const [hl] = features.splice(hlIdx, 1)
        features.push(hl)
      }
      source.setData({ type: 'FeatureCollection', features })
    }

    setShowSuggestions(false)
    setSearchTerm(store.name || '')
    inputRef.current?.blur()
  }, [filteredStores])

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

  const refreshUserLocation = useCallback(async ({ shouldRecenter = false, forceFreshPosition = false } = {}) => {
    if (locatingUserRef.current) return null

    locatingUserRef.current = true
    setLocatingUser(true)
    setLocationError('')

    try {
      const [positionResult, headingResult] = await Promise.all([
        getBestPosition({
          maxWaitTime: 2500,
          desiredAccuracy: 30,
          skipCache: forceFreshPosition,
        }),
        requestCompassHeading().catch(() => ({ heading: null, error: '' })),
      ])

      const { coords, error } = positionResult
      const compassHeading = typeof headingResult?.heading === 'number'
        ? ((headingResult.heading % 360) + 360) % 360
        : null
      const gpsHeading = typeof coords?.heading === 'number' && Number.isFinite(coords.heading)
        ? ((coords.heading % 360) + 360) % 360
        : null
      const heading = compassHeading ?? gpsHeading

      if (!coords) {
        setLocationError(getGeoErrorMessage(error))
        return null
      }

      const nextLocation = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy ?? null,
        heading,
      }
      setUserLocation(nextLocation)

      if (shouldRecenter) {
        const map = mapRef.current
        if (map) {
          setSelectedStore(null)
          map.flyTo({
            center: [coords.longitude, coords.latitude],
            zoom: Math.max(map.getZoom(), 16),
            duration: 900,
          })
        }
      }

      return nextLocation
    } catch (err) {
      console.error('Recenter to user failed:', err)
      setLocationError(getGeoErrorMessage(err))
      return null
    } finally {
      locatingUserRef.current = false
      setLocatingUser(false)
    }
  }, [])

  const recenterToUserLocation = useCallback(() => {
    return refreshUserLocation({ shouldRecenter: true, forceFreshPosition: true })
  }, [refreshUserLocation])

  useEffect(() => {
    if (!mapReady) return
    const hasRouteTarget = Boolean(initialTarget || initialStoreId)
    refreshUserLocation({ shouldRecenter: !hasRouteTarget })
  }, [mapReady, refreshUserLocation, initialTarget, initialStoreId])

  useEffect(() => {
    if (!router.isReady) return
    if (!initialStoreId || !mapReady) return

    const matched = storesWithCoords.find((store) => String(store.id) === initialStoreId)
    if (!matched) return

    flyToStore(matched)
  }, [router.isReady, initialStoreId, storesWithCoords, mapReady, flyToStore])

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
    <div className="relative h-[calc(100dvh-3.5rem)] w-full overflow-hidden bg-slate-950 text-slate-100 flex">
      {/* Map area */}
      <div className="relative flex-1 h-full">
        <div ref={mapContainerRef} className="absolute inset-0" />

        <div className="pointer-events-none absolute inset-x-0 top-2 z-20 px-2 sm:top-3 sm:px-3">
          <div ref={searchWrapperRef} className="pointer-events-auto mx-auto w-full max-w-md md:mx-0 md:mr-auto">
              <div className="grid grid-cols-[1fr_auto] items-center">
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
                  className="h-11 rounded-lg border-slate-700 bg-slate-950/90 px-3 text-base text-slate-100 placeholder:text-slate-400"
                />
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
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors ${idx === activeSuggestion ? 'bg-sky-500/20' : 'hover:bg-slate-800/80'
                        } border-b border-slate-700/50`}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => flyToStore(store)}
                    >
                      <span className="min-w-0 truncate text-base font-medium text-slate-100">{store.name}</span>
                      <span className="shrink-0 max-w-[45%] truncate text-right text-sm text-slate-400">{formatShortAddress(store)}</span>
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

        <div
          className="pointer-events-none absolute right-3 sm:bottom-3 z-20"
          style={!isDesktop ? { bottom: isStandalonePwa ? 'calc(env(safe-area-inset-bottom) + 0.75rem)' : '0.75rem' } : undefined}
        >
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            {locationError && (
              <div className="max-w-[260px] rounded-lg border border-red-500/30 bg-slate-950/95 px-3 py-2 text-xs text-red-200 shadow-lg">
                {locationError}
              </div>
            )}
            <button
              type="button"
              onClick={recenterToUserLocation}
              disabled={locatingUser}
              title="Về vị trí đang đứng"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/70 bg-slate-950/90 text-slate-100 shadow-lg backdrop-blur transition hover:border-sky-400 hover:text-sky-300 disabled:cursor-wait disabled:opacity-70"
            >
              {locatingUser ? (
                <svg className="h-4.5 w-4.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v3m0 12v3m9-9h-3M6 12H3" />
                  <circle cx="12" cy="12" r="4" strokeWidth="2" />
                </svg>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Right Sidebar - desktop only (detected via pointer capability) */}
      {isDesktop && (
        <div className="flex flex-col w-[345px] h-full bg-slate-900 border-l border-slate-700/60 shrink-0">
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
            <h2 className="text-base font-semibold text-slate-100">Bộ lọc khu vực</h2>
            <div className="flex items-center gap-2">
              {(selectedDistricts.length > 0 || selectedWards.length > 0 || selectedStoreTypes.length > 0) && (
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
          <div className="px-4 py-2 text-sm text-slate-400 border-b border-slate-700/40">
            Hiển thị <span className="font-semibold text-slate-200">{filteredStores.length}</span> / {storesWithCoords.length} cửa hàng
          </div>

          {/* Scrollable filter content */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {/* District section */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2">Quận / Huyện</h3>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(DISTRICT_WARD_SUGGESTIONS).map((district) => {
                  const active = selectedDistricts.includes(district)
                  const count = storeCounts.districtCounts[district] || 0
                  return (
                    <button
                      key={district}
                      type="button"
                      onClick={() => toggleDistrict(district)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${active
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
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-1">Xã / Phường <span className="normal-case font-normal text-slate-500">(chọn để hiển thị)</span></h3>
                {selectedDistricts.map((district) => {
                  const wards = DISTRICT_WARD_SUGGESTIONS[district] || []
                  if (wards.length === 0) return null
                  return (
                    <div key={district} className="mb-3">
                      <div className="text-xs font-medium text-slate-400 mb-1.5">{district}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {wards.map((ward) => {
                          const active = selectedWards.includes(ward)
                          const count = storeCounts.wardCounts[ward] || 0
                          return (
                            <button
                              key={ward}
                              type="button"
                              onClick={() => toggleWard(ward)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium transition-colors ${active
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

            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">Loại cửa hàng</h3>
              <div className="flex flex-wrap gap-1.5">
                {STORE_TYPE_OPTIONS.map((storeType) => {
                  const active = selectedStoreTypes.includes(storeType.value)
                  const count = storeTypeCounts[storeType.value] || 0
                  return (
                    <button
                      key={storeType.value}
                      type="button"
                      onClick={() => toggleStoreType(storeType.value)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${active
                        ? 'bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/40'
                        : 'bg-slate-800 text-slate-300 ring-1 ring-slate-600/40 hover:bg-slate-700'
                        }`}
                    >
                      {storeType.label}
                      {count > 0 && <span className={`text-[10px] ${active ? 'text-violet-300' : 'text-slate-500'}`}>({count})</span>}
                    </button>
                  )
                })}
              </div>
            </div>

          </div>
        </div>
      )}



      <style jsx global>{`
        .maplibregl-map {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          background: #020617;
        }

        .maplibregl-canvas-container,
        .maplibregl-canvas {
          width: 100% !important;
          height: 100% !important;
        }

        /* Hover popup styling */
        .store-hover-popup .maplibregl-popup-content {
          background: rgba(15, 23, 42, 0.95);
          color: #f1f5f9;
          padding: 6px 10px;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
          pointer-events: none;
        }

        .store-hover-popup .maplibregl-popup-tip {
          border-top-color: rgba(15, 23, 42, 0.95);
        }
      `}</style>

      <StoreDetailModal
        store={selectedStore}
        open={!!selectedStore}
        onOpenChange={(open) => { if (!open) setSelectedStore(null) }}
      />
    </div>
  )
}
