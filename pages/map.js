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
import { parseCoordinate } from '@/helper/coordinate'
import { formatAddressParts } from '@/lib/utils'
import { haversineKm } from '@/helper/distance'
function formatShortAddress(store) {
  if (!store) return ''
  const parts = []
  if (store.ward) parts.push(store.ward)
  if (store.district) parts.push(store.district)
  return parts.join(', ')
}

const DEFAULT_CENTER = [105.6955684, 21.0768617]
const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] }
const MAP_ROUTE_STORAGE_KEY = 'storevis:map-route-plan'
const STORE_MARKER_IMAGE_CACHE = new Map()
const FIXED_ROUTE_POINT = {
  lat: 21.0774332,
  lng: 105.6951599,
  name: 'Điểm xuất phát',
}

const HEADING_JITTER_DEG = 6
const HEADING_SMOOTHING_ALPHA = 0.22
const NAV_ARRIVE_DISTANCE_M = 45
const NAV_LEAVE_DISTANCE_M = 90
const NAV_WAREHOUSE_DISTANCE_M = 55
const ROUTE_STOP_STATUS = {
  PENDING: 'pending',
  ARRIVED: 'arrived',
  COMPLETED: 'completed',
}

function normalizeHeading(deg) {
  if (!Number.isFinite(deg)) return null
  return ((deg % 360) + 360) % 360
}

function shortestHeadingDelta(from, to) {
  return ((((to - from) % 360) + 540) % 360) - 180
}

function smoothHeading(previous, next) {
  const prev = normalizeHeading(previous)
  const nextNorm = normalizeHeading(next)
  if (nextNorm == null) return null
  if (prev == null) return nextNorm

  const delta = shortestHeadingDelta(prev, nextNorm)
  if (Math.abs(delta) <= HEADING_JITTER_DEG) return prev

  return normalizeHeading(prev + (delta * HEADING_SMOOTHING_ALPHA))
}

function formatRouteDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return ''
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`
  return `${(distanceMeters / 1000).toFixed(distanceMeters >= 10000 ? 0 : 1)} km`
}

function formatRouteDuration(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return ''
  const totalMinutes = Math.round(durationSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} phút`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) return `${hours} giờ`
  return `${hours} giờ ${minutes} phút`
}

function moveItem(list, fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= list.length || fromIndex === toIndex) return list
  const next = [...list]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

const ROUTE_DRAG_HOLD_MS = 220
const ROUTE_DRAG_CANCEL_PX = 10
const MAP_INTERACTION_SUPPRESS_MS = 500

/**
 * Get the first meaningful word of a store name,
 * skipping leading words that match IGNORED_NAME_TERMS.
 * Example: "Cua Hang Anh Dung" -> "Anh"
 */
function getFirstWord(name = '') {
  let remaining = String(name).trim().toLowerCase()
  // Sort ignored terms by length (longest first) so multi-word terms
  // like "cua hang" are stripped before single-word "cua".
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

function toLatLng(store) {
  let lat = parseCoordinate(store.latitude)
  let lng = parseCoordinate(store.longitude)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  // Fix swapped coordinates when latitude/longitude are reversed in data.
  if ((lat < -90 || lat > 90) && lng >= -90 && lng <= 90 && lat >= -180 && lat <= 180) {
    const temp = lat
    lat = lng
    lng = temp
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  return { lat, lng }
}

/**
 * Pre-render house icon + store name into a single canvas image.
 * Returns { width, height, data, dpr, anchorY } for MapLibre addImage.
 */
function createStoreMarker(text, fontSize = 13, maxWidthEm = 9, highlighted = false, routeOrder = '') {
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 2

  // House icon dimensions
  const iconSize = Math.round(38 * dpr) // circle diameter
  const iconPad = Math.round(2 * dpr)   // space around circle
  const hlPad = highlighted ? Math.round(5 * dpr) : 0 // extra space for highlight ring
  const gap = Math.round(1 * dpr)       // gap between icon and label

  // Label dimensions
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

  // Combined canvas
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
  ctx.fillStyle = routeOrder ? '#f97316' : '#1f2937'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5 * dpr
  ctx.stroke()

  if (routeOrder) {
    ctx.font = `bold ${Math.round(16 * dpr)}px "Open Sans", system-ui, sans-serif`
    ctx.fillStyle = '#fff7ed'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(routeOrder), iconCX, iconCY + dpr * 0.25)
  } else {
    // House shape inside circle
    const s = r * 0.52
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 0.8 * dpr
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(iconCX, iconCY - s * 0.9)
    ctx.lineTo(iconCX - s, iconCY - s * 0.05)
    ctx.lineTo(iconCX + s, iconCY - s * 0.05)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(iconCX - s * 0.72, iconCY - s * 0.05, s * 1.44, s * 1.0)
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(iconCX - s * 0.2, iconCY + s * 0.3, s * 0.4, s * 0.65)
  }

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

function getStoreMarkerCacheKey(text, fontSize, maxWidthEm, highlighted, routeOrder) {
  return [text, fontSize, maxWidthEm, highlighted ? '1' : '0', routeOrder || ''].join('::')
}

function getOrCreateStoreMarkerImage(text, fontSize = 13, maxWidthEm = 9, highlighted = false, routeOrder = '') {
  const cacheKey = getStoreMarkerCacheKey(text, fontSize, maxWidthEm, highlighted, routeOrder)
  const cached = STORE_MARKER_IMAGE_CACHE.get(cacheKey)
  if (cached) return cached

  const nextImage = createStoreMarker(text, fontSize, maxWidthEm, highlighted, routeOrder)
  STORE_MARKER_IMAGE_CACHE.set(cacheKey, nextImage)
  return nextImage
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
  const pendingHeadingRef = useRef(null)

  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStore, setSelectedStore] = useState(null)
  const [mapReady, setMapReady] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const [canScrollDown, setCanScrollDown] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [isStandalonePwa, setIsStandalonePwa] = useState(false)
  const [selectedDistricts, setSelectedDistricts] = useState([])
  const [selectedWards, setSelectedWards] = useState([])
  const [selectedStoreTypes, setSelectedStoreTypes] = useState([])
  const [locationError, setLocationError] = useState('')
  const [userLocation, setUserLocation] = useState(null)
  const [followUserHeading, setFollowUserHeading] = useState(false)
  const [routeStops, setRouteStops] = useState([])
  const [routeGeojson, setRouteGeojson] = useState(EMPTY_FEATURE_COLLECTION)
  const [routeSummary, setRouteSummary] = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeSorting, setRouteSorting] = useState(false)
  const [routeError, setRouteError] = useState('')
  const [routePanelOpen, setRoutePanelOpen] = useState(false)
  const [hideUnselectedStores, setHideUnselectedStores] = useState(false)
  const [routeStopStatusById, setRouteStopStatusById] = useState({})
  const [armedRouteIndex, setArmedRouteIndex] = useState(-1)
  const [draggedRouteIndex, setDraggedRouteIndex] = useState(-1)
  const [dragOverRouteIndex, setDragOverRouteIndex] = useState(-1)
  const [dragRouteOffset, setDragRouteOffset] = useState({ x: 0, y: 0 })
  const [dragRouteBox, setDragRouteBox] = useState(null)
  const [routePlanHydrated, setRoutePlanHydrated] = useState(false)
  const searchWrapperRef = useRef(null)
  const inputRef = useRef(null)
  const suggestionsRef = useRef(null)
  const routeListScrollRef = useRef(null)
  const routeItemRefs = useRef(new Map())
  const routeDragStateRef = useRef(null)
  const pendingRouteDragRef = useRef(null)
  const routeAutoScrollRef = useRef(null)
  const suppressMapInteractionUntilRef = useRef(0)
  const restoredRoutePlanRef = useRef(false)
  const followUserHeadingRef = useRef(false)

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
  const routeStopIds = useMemo(
    () => new Set(routeStops.map((store) => String(store.id))),
    [routeStops]
  )

  const routeStopOrderById = useMemo(
    () => {
      const remainingStops = routeStops.filter((store) => {
        const id = String(store.id)
        return (routeStopStatusById[id] || ROUTE_STOP_STATUS.PENDING) !== ROUTE_STOP_STATUS.COMPLETED
      })
      return new Map(remainingStops.map((store, index) => [String(store.id), String(index + 1)]))
    },
    [routeStops, routeStopStatusById]
  )
  const completedRouteStopIdSet = useMemo(() => {
    const ids = []
    for (const store of routeStops) {
      const id = String(store.id)
      if ((routeStopStatusById[id] || ROUTE_STOP_STATUS.PENDING) === ROUTE_STOP_STATUS.COMPLETED) {
        ids.push(id)
      }
    }
    return new Set(ids)
  }, [routeStops, routeStopStatusById])

  const renderedRouteStops = useMemo(() => {
    const items = routeStops.map((store, index) => ({ store, originalIndex: index }))
    if (draggedRouteIndex < 0 || dragOverRouteIndex < 0) {
      return items.map((item, displayIndex) => ({ ...item, displayIndex }))
    }

    return moveItem(items, draggedRouteIndex, dragOverRouteIndex)
      .map((item, displayIndex) => ({ ...item, displayIndex }))
  }, [routeStops, draggedRouteIndex, dragOverRouteIndex])

  const draggedRouteStore = draggedRouteIndex >= 0 ? routeStops[draggedRouteIndex] : null

  useEffect(() => {
    followUserHeadingRef.current = followUserHeading
  }, [followUserHeading])

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

  const visibleMapStores = useMemo(() => {
    if (!hideUnselectedStores || routeStopIds.size === 0) return filteredStores
    return filteredStores.filter((store) => routeStopIds.has(String(store.id)))
  }, [filteredStores, hideUnselectedStores, routeStopIds])

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

  const storeMapRef = useRef(new Map()) // storeId -> store data for quick lookup

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
        pitch: 0,
        minZoom: 3,
        maxZoom: 20,
        maxPitch: 0,
        pitchWithRotate: false,
        attributionControl: true
      })

      map.dragRotate.disable()
      map.touchZoomRotate.disableRotation()

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

        map.addSource('route-path', {
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
              ['all', ['==', ['get', 'highlighted'], 'yes'], ['!=', ['get', 'routeOrder'], '']], ['concat', 'smrh-', ['get', 'storeId'], '-', ['get', 'routeOrder']],
              ['==', ['get', 'highlighted'], 'yes'], ['concat', 'smh-', ['get', 'storeId']],
              ['!=', ['get', 'routeOrder'], ''], ['concat', 'smr-', ['get', 'storeId'], '-', ['get', 'routeOrder']],
              ['concat', 'sm-', ['get', 'storeId']]
            ],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 10, 0.55, 14, 0.8, 17, 1],
            'icon-anchor': 'top',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'symbol-sort-key': ['case', ['==', ['get', 'highlighted'], 'yes'], 999, 0],
            'symbol-z-order': 'auto',
          },
          paint: {
            'icon-opacity': ['case', ['==', ['get', 'passed'], 'yes'], 0.45, 1],
          },
        })

        map.addLayer({
          id: 'route-line-outline',
          type: 'line',
          source: 'route-path',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': 'rgba(15, 23, 42, 0.95)',
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 7, 12, 9, 16, 12],
            'line-opacity': 0.95,
          },
        }, 'store-marker')

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-path',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#38bdf8',
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 5.5, 16, 7],
            'line-opacity': 0.95,
          },
        }, 'store-marker')

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

        // Click on store marker -> open dialog
        map.on('click', 'store-marker', (e) => {
          if (Date.now() < suppressMapInteractionUntilRef.current) return
          const f = e.features?.[0]
          if (!f) return
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
    visibleMapStores.forEach((store) => { lookup.set(String(store.id), store) })
    storeMapRef.current = lookup

    const source = map.getSource('stores')
    if (!source) return

    const features = visibleMapStores.map((store) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [store.coords.lng, store.coords.lat] },
      properties: {
        storeId: String(store.id),
        name: store.name || 'Cửa hàng',
        shortName: getFirstWord(store.name),
        address: formatAddressParts(store),
        routeOrder: routeStopOrderById.get(String(store.id)) || '',
        passed: completedRouteStopIdSet.has(String(store.id)) ? 'yes' : 'no',
      },
    }))

    source.setData({ type: 'FeatureCollection', features })

    // Add marker images in small batches to reduce main-thread blocking
    const pendingImages = []
    for (const feature of features) {
      const routeOrder = feature.properties.routeOrder || ''
      const imgId = routeOrder
        ? `smr-${feature.properties.storeId}-${routeOrder}`
        : `sm-${feature.properties.storeId}`
      if (!map.hasImage(imgId)) {
        pendingImages.push({
          imgId,
          text: feature.properties.name,
          routeOrder,
        })
      }
    }

    if (pendingImages.length === 0) return

    let frameId = 0
    let cancelled = false
    let index = 0

    const flushImageBatch = () => {
      if (cancelled) return

      const batchEnd = Math.min(index + 18, pendingImages.length)
      for (; index < batchEnd; index += 1) {
        const item = pendingImages[index]
        if (map.hasImage(item.imgId)) continue
        const img = getOrCreateStoreMarkerImage(item.text, 13, 9, false, item.routeOrder)
        map.addImage(item.imgId, { width: img.width, height: img.height, data: img.data }, { pixelRatio: img.dpr })
      }

      if (index < pendingImages.length) {
        frameId = window.requestAnimationFrame(flushImageBatch)
      }
    }

    frameId = window.requestAnimationFrame(flushImageBatch)

    return () => {
      cancelled = true
      if (frameId) window.cancelAnimationFrame(frameId)
    }
  }, [completedRouteStopIdSet, mapReady, routeStopOrderById, visibleMapStores])

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

  useEffect(() => {
    const latestById = new Map(storesWithCoords.map((store) => [String(store.id), store]))
    setRouteStops((prev) => prev
      .map((store) => latestById.get(String(store.id)) || null)
      .filter(Boolean)
    )
  }, [storesWithCoords])

  useEffect(() => {
    if (restoredRoutePlanRef.current) return
    if (typeof window === 'undefined') return
    if (loading) return

    try {
      const raw = window.localStorage.getItem(MAP_ROUTE_STORAGE_KEY)
      if (!raw) {
        restoredRoutePlanRef.current = true
        return
      }

      const parsed = JSON.parse(raw)
      const savedIds = Array.isArray(parsed?.routeStopIds) ? parsed.routeStopIds.map(String) : []
      const byId = new Map(storesWithCoords.map((store) => [String(store.id), store]))
      const restoredStops = savedIds
        .map((id) => byId.get(id) || null)
        .filter(Boolean)

      // Wait for the first non-loading store payload before finalizing restore.
      if (savedIds.length > 0 && restoredStops.length === 0 && stores.length === 0) return

      restoredRoutePlanRef.current = true
      setRouteStops(restoredStops)
      if (typeof parsed?.hideUnselectedStores === 'boolean') setHideUnselectedStores(parsed.hideUnselectedStores)
    } catch (error) {
      restoredRoutePlanRef.current = true
      console.error('Restore route plan failed:', error)
    } finally {
      if (restoredRoutePlanRef.current) {
        setRoutePlanHydrated(true)
      }
    }
  }, [loading, stores, storesWithCoords])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!routePlanHydrated) return

    try {
      window.localStorage.setItem(MAP_ROUTE_STORAGE_KEY, JSON.stringify({
        routeStopIds: routeStops.map((store) => String(store.id)),
        hideUnselectedStores,
      }))
    } catch (error) {
      console.error('Persist route plan failed:', error)
    }
  }, [routePlanHydrated, routeStops, hideUnselectedStores])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const routeSource = map.getSource('route-path')
    if (routeSource) routeSource.setData(routeGeojson)
  }, [mapReady, routeGeojson])

  useEffect(() => {
    setRouteGeojson(EMPTY_FEATURE_COLLECTION)
    setRouteSummary(null)
    setRouteError('')
  }, [routeStops])

  useEffect(() => {
    if (routeStops.length === 0) setHideUnselectedStores(false)
  }, [routeStops.length])

  useEffect(() => {
    setRouteStopStatusById((prev) => {
      const next = {}
      for (const store of routeStops) {
        const id = String(store.id)
        next[id] = prev[id] || ROUTE_STOP_STATUS.PENDING
      }
      return next
    })
    if (routeStops.length === 0) {
      followUserHeadingRef.current = false
      setFollowUserHeading(false)
    }
  }, [routeStops])

  const addStoreToRoute = useCallback((store) => {
    if (!store?.coords) return
    setRouteStops((prev) => {
      if (prev.some((item) => String(item.id) === String(store.id))) return prev
      return [...prev, store]
    })
    setRouteStopStatusById({})
    setRouteError('')
  }, [])

  const removeRouteStop = useCallback((storeId) => {
    setRouteStops((prev) => prev.filter((store) => String(store.id) !== String(storeId)))
    setRouteStopStatusById((prev) => {
      const next = { ...prev }
      delete next[String(storeId)]
      return next
    })
  }, [])

  const clearRoutePlan = useCallback(() => {
    setRouteStops([])
    setRouteGeojson(EMPTY_FEATURE_COLLECTION)
    setRouteSummary(null)
    setRouteError('')
    setRouteStopStatusById({})
  }, [])

  const cancelPendingRouteDrag = useCallback(() => {
    if (!pendingRouteDragRef.current) return
    window.clearTimeout(pendingRouteDragRef.current.timerId)
    pendingRouteDragRef.current = null
  }, [])

  const finishRouteDrag = useCallback((cancelled = false) => {
    const dragState = routeDragStateRef.current
    routeDragStateRef.current = null
    cancelPendingRouteDrag()
    if (routeAutoScrollRef.current) {
      window.cancelAnimationFrame(routeAutoScrollRef.current)
      routeAutoScrollRef.current = null
    }

    const fromIndex = dragState?.fromIndex ?? -1
    const toIndex = dragState?.targetIndex ?? -1

    if (!cancelled && fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
      setRouteStops((prev) => moveItem(prev, fromIndex, toIndex))
      setRouteStopStatusById({})
    }

    setArmedRouteIndex(-1)
    setDraggedRouteIndex(-1)
    setDragOverRouteIndex(-1)
    setDragRouteOffset({ x: 0, y: 0 })
    setDragRouteBox(null)
  }, [cancelPendingRouteDrag])

  const updateRouteDragTarget = useCallback((clientY) => {
    const entries = Array.from(routeItemRefs.current.entries())
    if (entries.length === 0) return

    let nextTarget = entries[entries.length - 1][0]
    for (const [index, element] of entries) {
      if (!element) continue
      const rect = element.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) {
        nextTarget = index
        break
      }
    }

    if (routeDragStateRef.current) {
      routeDragStateRef.current.targetIndex = nextTarget
    }
    setDragOverRouteIndex(nextTarget)
  }, [])

  const tickRouteAutoScroll = useCallback(() => {
    routeAutoScrollRef.current = null
    const dragState = routeDragStateRef.current
    const container = routeListScrollRef.current
    if (!dragState || !container) return

    const rect = container.getBoundingClientRect()
    const threshold = 56
    let delta = 0

    if (dragState.lastClientY < rect.top + threshold) {
      delta = Math.max(-14, -((rect.top + threshold - dragState.lastClientY) / 6))
    } else if (dragState.lastClientY > rect.bottom - threshold) {
      delta = Math.min(14, (dragState.lastClientY - (rect.bottom - threshold)) / 6)
    }

    if (delta !== 0) {
      container.scrollTop += delta
      updateRouteDragTarget(dragState.lastClientY)
      routeAutoScrollRef.current = window.requestAnimationFrame(tickRouteAutoScroll)
    }
  }, [updateRouteDragTarget])

  const activateRouteDrag = useCallback((dragState) => {
    if (!dragState?.element) return

    const elementRect = dragState.element.getBoundingClientRect()
    routeDragStateRef.current = {
      ...dragState,
      status: 'dragging',
      lastClientY: dragState.latestClientY,
    }
    dragState.element.setPointerCapture?.(dragState.pointerId)
    setArmedRouteIndex(-1)
    setDraggedRouteIndex(dragState.fromIndex)
    setDragOverRouteIndex(dragState.fromIndex)
    setDragRouteOffset({
      x: dragState.latestClientX - dragState.startX,
      y: dragState.latestClientY - dragState.startY,
    })
    setDragRouteBox({
      left: elementRect.left,
      top: elementRect.top,
      width: elementRect.width,
      height: elementRect.height,
    })
    updateRouteDragTarget(dragState.latestClientY)
  }, [updateRouteDragTarget])

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (routeDragStateRef.current?.status === 'dragging') {
        if (event.cancelable) event.preventDefault()
        routeDragStateRef.current.lastClientY = event.clientY
        routeDragStateRef.current.latestClientX = event.clientX
        routeDragStateRef.current.latestClientY = event.clientY
        setDragRouteOffset({
          x: event.clientX - routeDragStateRef.current.startX,
          y: event.clientY - routeDragStateRef.current.startY,
        })
        updateRouteDragTarget(event.clientY)
        if (!routeAutoScrollRef.current) {
          routeAutoScrollRef.current = window.requestAnimationFrame(tickRouteAutoScroll)
        }
        return
      }

      if (routeDragStateRef.current?.status === 'armed') {
        if (event.cancelable) event.preventDefault()
        routeDragStateRef.current.latestClientX = event.clientX
        routeDragStateRef.current.latestClientY = event.clientY
        routeDragStateRef.current.lastClientY = event.clientY

        const movedX = Math.abs(event.clientX - routeDragStateRef.current.startX)
        const movedY = Math.abs(event.clientY - routeDragStateRef.current.startY)
        if (movedX > 3 || movedY > 3) {
          activateRouteDrag(routeDragStateRef.current)
        }
        return
      }

      const pending = pendingRouteDragRef.current
      if (!pending) return

      const movedX = Math.abs(event.clientX - pending.startX)
      const movedY = Math.abs(event.clientY - pending.startY)
      if (movedX > ROUTE_DRAG_CANCEL_PX || movedY > ROUTE_DRAG_CANCEL_PX) {
        cancelPendingRouteDrag()
        return
      }
      pending.latestClientX = event.clientX
      pending.latestClientY = event.clientY
    }

    const handlePointerUp = () => {
      if (routeDragStateRef.current) {
        finishRouteDrag(false)
        return
      }
      cancelPendingRouteDrag()
      setArmedRouteIndex(-1)
    }

    const handlePointerCancel = () => {
      if (routeDragStateRef.current) {
        finishRouteDrag(true)
        return
      }
      cancelPendingRouteDrag()
      setArmedRouteIndex(-1)
    }

    const handleTouchMove = (event) => {
      if (!routeDragStateRef.current) return
      if (event.cancelable) event.preventDefault()
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [activateRouteDrag, cancelPendingRouteDrag, finishRouteDrag, tickRouteAutoScroll, updateRouteDragTarget])

  const startRouteDrag = useCallback((index, event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    cancelPendingRouteDrag()
    pendingRouteDragRef.current = {
      fromIndex: index,
      startX: event.clientX,
      startY: event.clientY,
      latestClientX: event.clientX,
      latestClientY: event.clientY,
      pointerId: event.pointerId,
      element: event.currentTarget,
      timerId: window.setTimeout(() => {
        const pending = pendingRouteDragRef.current
        if (!pending) return
        routeDragStateRef.current = {
          ...pending,
          status: 'armed',
          targetIndex: pending.fromIndex,
          lastClientY: pending.latestClientY,
        }
        pendingRouteDragRef.current = null
        setArmedRouteIndex(pending.fromIndex)
      }, ROUTE_DRAG_HOLD_MS),
    }
  }, [cancelPendingRouteDrag])

  const buildRoute = useCallback(async () => {
    const startPoint = FIXED_ROUTE_POINT
    const endPoint = FIXED_ROUTE_POINT

    const completedSet = new Set(
      routeStops
        .map((store) => String(store.id))
        .filter((id) => (routeStopStatusById[id] || ROUTE_STOP_STATUS.PENDING) === ROUTE_STOP_STATUS.COMPLETED)
    )
    const stops = routeStops
      .filter((store) => !completedSet.has(String(store.id)))
      .map((store) => ({
      id: String(store.id),
      name: store.name || 'C\u1eeda h\u00e0ng',
      lat: store.coords.lat,
      lng: store.coords.lng,
      }))

    if (stops.length < 1) {
      setRouteError('Chọn ít nhất 1 cửa hàng để vẽ tuyến.')
      return
    }

    setRouteLoading(true)
    setRouteError('')

    try {
      const response = await fetch('/api/route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start: startPoint,
          end: endPoint,
          stops,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Kh\u00f4ng l\u1ea5y \u0111\u01b0\u1ee3c tuy\u1ebfn \u0111\u01b0\u1eddng.')
      }

      const routeFeature = {
        type: 'Feature',
        geometry: payload.geometry,
        properties: {
          distance: payload.distance,
          duration: payload.duration,
        },
      }

      setRouteGeojson({
        type: 'FeatureCollection',
        features: [routeFeature],
      })
      setRouteSummary({
        distance: payload.distance,
        duration: payload.duration,
        returnsToFixedPoint: true,
      })

      const map = mapRef.current
      const bounds = payload.geometry?.coordinates?.reduce((acc, [lng, lat]) => {
        if (!acc) return [[lng, lat], [lng, lat]]
        return [
          [Math.min(acc[0][0], lng), Math.min(acc[0][1], lat)],
          [Math.max(acc[1][0], lng), Math.max(acc[1][1], lat)],
        ]
      }, null)

      if (map && bounds) {
        map.fitBounds(bounds, {
          padding: isDesktop
            ? { top: 110, right: 370, bottom: 70, left: 70 }
            : { top: 110, right: 40, bottom: 220, left: 40 },
          duration: 900,
        })
      }
    } catch (err) {
      console.error('Build route failed:', err)
      setRouteError(err?.message || 'Kh\u00f4ng th\u1ec3 v\u1ebd tuy\u1ebfn \u0111\u01b0\u1eddng ngay l\u00fac n\u00e0y.')
    } finally {
      setRouteLoading(false)
    }
  }, [isDesktop, routeStopStatusById, routeStops])

  const optimizeRouteOrder = useCallback(async () => {
    if (routeStops.length < 2) {
      setRouteError('Chọn ít nhất 2 cửa hàng để sắp xếp.')
      return
    }

    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm('Sắp xếp lại thứ tự cửa hàng cho tuyến đi và quay về điểm xuất phát cố định? Thứ tự hiện tại sẽ được thay đổi.')

    if (!confirmed) return

    const startPoint = FIXED_ROUTE_POINT
    const endPoint = FIXED_ROUTE_POINT

    const stops = routeStops.map((store) => ({
      id: String(store.id),
      name: store.name || 'C\u1eeda h\u00e0ng',
      lat: store.coords.lat,
      lng: store.coords.lng,
    }))

    setRouteSorting(true)
    setRouteError('')

    try {
      const response = await fetch('/api/route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'optimize',
          start: startPoint,
          end: endPoint,
          stops,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Kh\u00f4ng th\u1ec3 s\u1eafp x\u1ebfp danh s\u00e1ch c\u1eeda h\u00e0ng.')
      }

      const orderedStopIds = Array.isArray(payload?.orderedStopIds) ? payload.orderedStopIds.map(String) : []
      if (orderedStopIds.length !== routeStops.length) {
        throw new Error('Kh\u00f4ng th\u1ec3 s\u1eafp x\u1ebfp l\u1ea1i \u0111\u1ea7y \u0111\u1ee7 danh s\u00e1ch c\u1eeda h\u00e0ng.')
      }

      const storeById = new Map(routeStops.map((store) => [String(store.id), store]))
      const nextRouteStops = orderedStopIds
        .map((id) => storeById.get(id) || null)
        .filter(Boolean)

      if (nextRouteStops.length !== routeStops.length) {
        throw new Error('Kh\u00f4ng th\u1ec3 kh\u00f4i ph\u1ee5c \u0111\u1ea7y \u0111\u1ee7 danh s\u00e1ch sau khi s\u1eafp x\u1ebfp.')
      }

      setRouteStops(nextRouteStops)
      setRouteGeojson(EMPTY_FEATURE_COLLECTION)
      setRouteSummary(null)
      setRouteStopStatusById({})
    } catch (err) {
      console.error('Optimize route order failed:', err)
      setRouteError(err?.message || 'Kh\u00f4ng th\u1ec3 s\u1eafp x\u1ebfp danh s\u00e1ch c\u1eeda h\u00e0ng l\u00fac n\u00e0y.')
    } finally {
      setRouteSorting(false)
    }
  }, [routeStops])

  const flyToStore = useCallback((store) => {
    if (!store?.coords) return
    const map = mapRef.current
    if (!map) return
    map.flyTo({ center: [store.coords.lng, store.coords.lat], zoom: 16, duration: 900 })

    // Generate highlighted image if not already cached
    const hlId = `smh-${store.id}`
    const routeOrder = routeStopOrderById.get(String(store.id)) || ''
    const highlightedImageId = routeOrder ? `smrh-${store.id}-${routeOrder}` : hlId
    if (!map.hasImage(highlightedImageId)) {
      const img = getOrCreateStoreMarkerImage(store.name || 'Cửa hàng', 13, 9, true, routeOrder)
      map.addImage(highlightedImageId, { width: img.width, height: img.height, data: img.data }, { pixelRatio: img.dpr })
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
          address: formatAddressParts(s),
          routeOrder: routeStopOrderById.get(String(s.id)) || '',
          passed: completedRouteStopIdSet.has(String(s.id)) ? 'yes' : 'no',
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
  }, [completedRouteStopIdSet, filteredStores, routeStopOrderById])

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

  const setMapBearing = useCallback((bearing) => {
    const map = mapRef.current
    if (!map) return

    map.easeTo({
      bearing,
      duration: 900,
      essential: true,
    })
  }, [])

  const refreshUserLocation = useCallback(async ({ shouldRecenter = false, forceFreshPosition = false } = {}) => {
    if (locatingUserRef.current) return null

    locatingUserRef.current = true
    setLocationError('')

    try {
      const [positionResult, headingResult] = await Promise.all([
        getBestPosition({
          maxWaitTime: 2500,
          desiredAccuracy: 30,
          skipCache: forceFreshPosition,
        }),
        requestCompassHeading({ requestPermission: false }).catch(() => ({ heading: null, error: '' })),
      ])

      const { coords, error } = positionResult
      const compassHeading = typeof headingResult?.heading === 'number'
        ? ((headingResult.heading % 360) + 360) % 360
        : null
      const gpsHeading = typeof coords?.heading === 'number' && Number.isFinite(coords.heading)
        ? ((coords.heading % 360) + 360) % 360
        : null
      const heading = compassHeading ?? gpsHeading ?? pendingHeadingRef.current

      if (!coords) {
        setLocationError(getGeoErrorMessage(error))
        return null
      }

      const normalizedHeading = normalizeHeading(heading)
      const smoothedHeading = smoothHeading(pendingHeadingRef.current, normalizedHeading)

      const nextLocation = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy ?? null,
        heading: smoothedHeading,
      }
      if (smoothedHeading != null) {
        pendingHeadingRef.current = smoothedHeading
      }
      setUserLocation((prev) => ({
        ...nextLocation,
        heading: smoothedHeading ?? prev?.heading ?? null,
      }))

      if (shouldRecenter) {
        const map = mapRef.current
        if (map) {
          setSelectedStore(null)
          map.stop()
          map.easeTo({
            center: [coords.longitude, coords.latitude],
            duration: 900,
            essential: true,
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
    }
  }, [])

  const recenterToUserLocation = useCallback(() => {
    if (!userLocation || !Number.isFinite(userLocation.latitude) || !Number.isFinite(userLocation.longitude)) {
      setLocationError('Chưa có vị trí hiện tại để quay về.')
      return null
    }

    const map = mapRef.current
    if (!map) return null

    setLocationError('')
    setSelectedStore(null)
    map.stop()
    map.easeTo({
      center: [userLocation.longitude, userLocation.latitude],
      duration: 900,
      essential: true,
    })

    return null
  }, [userLocation])

  const toggleUserHeadingRotation = useCallback(async () => {
    if (followUserHeading) {
      followUserHeadingRef.current = false
      setFollowUserHeading(false)
      setMapBearing(0)
      return
    }

    const currentLocation = userLocation
    const map = mapRef.current
    if (!map) return

    const headingResult = await requestCompassHeading({ requestPermission: true }).catch(() => ({ heading: null, error: '' }))
    let heading = normalizeHeading(headingResult?.heading ?? currentLocation?.heading ?? pendingHeadingRef.current)
    if (heading != null) {
      pendingHeadingRef.current = smoothHeading(pendingHeadingRef.current, heading)
      heading = pendingHeadingRef.current
      setUserLocation((prev) => (prev ? { ...prev, heading } : prev))
    }
    if (headingResult?.error && heading == null) {
      setLocationError(headingResult.error)
    }

    if (!currentLocation || !Number.isFinite(currentLocation.latitude) || !Number.isFinite(currentLocation.longitude)) {
      setLocationError('Không lấy được hướng hiện tại của thiết bị.')
      return
    }

    followUserHeadingRef.current = true
    setFollowUserHeading(true)
    if (!headingResult?.error || heading != null) {
      setLocationError('')
    }
    setSelectedStore(null)
    map.stop()
    map.easeTo({
      center: [currentLocation.longitude, currentLocation.latitude],
      bearing: pendingHeadingRef.current ?? heading ?? 0,
      duration: 900,
      essential: true,
    })
    if (routeStops.length > 0 && routeGeojson.features.length === 0) {
      buildRoute()
    }
  }, [buildRoute, followUserHeading, routeGeojson.features.length, routeStops.length, setMapBearing, userLocation])

  useEffect(() => {
    if (!followUserHeading) return
    if (!Number.isFinite(userLocation?.latitude) || !Number.isFinite(userLocation?.longitude)) return
    if (routeStops.length === 0) return
    setRouteStopStatusById((prev) => {
      const next = { ...prev }
      let changed = false

      const orderedStops = routeStops.map((store) => {
        const id = String(store.id)
        const status = next[id] || ROUTE_STOP_STATUS.PENDING
        next[id] = status
        return { id, store, status }
      })

      const arrivedEntry = orderedStops.find((entry) => next[entry.id] === ROUTE_STOP_STATUS.ARRIVED) || null

      if (arrivedEntry) {
        const distanceFromArrived = haversineKm(
          userLocation.latitude,
          userLocation.longitude,
          arrivedEntry.store.coords.lat,
          arrivedEntry.store.coords.lng
        ) * 1000

        if (distanceFromArrived > NAV_LEAVE_DISTANCE_M) {
          next[arrivedEntry.id] = ROUTE_STOP_STATUS.COMPLETED
          changed = true
        }
      }

      const activeArrivedEntry = orderedStops.find((entry) => next[entry.id] === ROUTE_STOP_STATUS.ARRIVED) || null
      if (!activeArrivedEntry) {
        const firstRemaining = orderedStops.find((entry) => next[entry.id] !== ROUTE_STOP_STATUS.COMPLETED) || null
        if (firstRemaining) {
          const distanceToFirstRemaining = haversineKm(
            userLocation.latitude,
            userLocation.longitude,
            firstRemaining.store.coords.lat,
            firstRemaining.store.coords.lng
          ) * 1000
          if (distanceToFirstRemaining <= NAV_ARRIVE_DISTANCE_M) {
            next[firstRemaining.id] = ROUTE_STOP_STATUS.ARRIVED
            changed = true
          }
        }
      }

      let firstArrivedFound = false
      for (const entry of orderedStops) {
        if (next[entry.id] !== ROUTE_STOP_STATUS.ARRIVED) continue
        if (!firstArrivedFound) {
          firstArrivedFound = true
          continue
        }
        next[entry.id] = ROUTE_STOP_STATUS.PENDING
        changed = true
      }

      return changed ? next : prev
    })
  }, [
    followUserHeading,
    userLocation?.latitude,
    userLocation?.longitude,
    routeStops,
  ])

  const navigationInfo = useMemo(() => {
    if (!followUserHeading || routeStops.length === 0) return null

    const orderedStops = routeStops.map((store) => {
      const id = String(store.id)
      return {
        id,
        store,
        status: routeStopStatusById[id] || ROUTE_STOP_STATUS.PENDING,
      }
    })

    const arrivedIndex = orderedStops.findIndex((entry) => entry.status === ROUTE_STOP_STATUS.ARRIVED)
    const activeStore = arrivedIndex >= 0 ? orderedStops[arrivedIndex].store : null
    const nextStore = arrivedIndex >= 0
      ? (orderedStops.slice(arrivedIndex + 1).find((entry) => entry.status !== ROUTE_STOP_STATUS.COMPLETED)?.store || null)
      : (orderedStops.find((entry) => entry.status !== ROUTE_STOP_STATUS.COMPLETED)?.store || null)
    const distanceTargetStore = nextStore || activeStore || null
    const canMeasureDistance = Number.isFinite(userLocation?.latitude) && Number.isFinite(userLocation?.longitude)
    const distanceFromLat = canMeasureDistance ? userLocation.latitude : FIXED_ROUTE_POINT.lat
    const distanceFromLng = canMeasureDistance ? userLocation.longitude : FIXED_ROUTE_POINT.lng
    const targetLat = Number.isFinite(distanceTargetStore?.coords?.lat) ? distanceTargetStore.coords.lat : null
    const targetLng = Number.isFinite(distanceTargetStore?.coords?.lng) ? distanceTargetStore.coords.lng : null
    const rawNextDistanceMeters = (targetLat != null && targetLng != null)
      ? haversineKm(distanceFromLat, distanceFromLng, targetLat, targetLng) * 1000
      : 0
    const nextDistanceMeters = Number.isFinite(rawNextDistanceMeters) ? rawNextDistanceMeters : 0

    const completedStops = orderedStops.filter((entry) => entry.status === ROUTE_STOP_STATUS.COMPLETED)
    const lastCompletedStore = completedStops.length > 0 ? completedStops[completedStops.length - 1].store : null

    const atWarehouse = Number.isFinite(userLocation?.latitude) && Number.isFinite(userLocation?.longitude)
      ? (haversineKm(
        userLocation.latitude,
        userLocation.longitude,
        FIXED_ROUTE_POINT.lat,
        FIXED_ROUTE_POINT.lng
      ) * 1000) <= NAV_WAREHOUSE_DISTANCE_M
      : false

    if (activeStore) {
      return {
        currentLabel: 'Hiện tại',
        currentStore: activeStore,
        nextStore,
        nextDistanceMeters,
      }
    }

    if (atWarehouse) {
      return {
        currentLabel: 'Hiện tại',
        currentText: 'Kho',
        nextStore,
        nextDistanceMeters,
      }
    }

    if (lastCompletedStore) {
      return {
        currentLabel: 'Đã qua',
        currentStore: lastCompletedStore,
        nextStore,
        nextDistanceMeters,
      }
    }

    return {
      currentLabel: 'Hiện tại',
      currentText: 'Đang di chuyển',
      nextStore,
      nextDistanceMeters,
    }
  }, [
    followUserHeading,
    routeStops,
    routeStopStatusById,
    userLocation?.latitude,
    userLocation?.longitude,
  ])
  const showNavigationInfoPanel = followUserHeading && Boolean(navigationInfo)

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

  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map) return

    if (followUserHeading) {
      map.dragPan.disable()
    } else {
      map.dragPan.enable()
    }

    return () => {
      map.dragPan.enable()
    }
  }, [followUserHeading, mapReady])

  useEffect(() => {
    if (!followUserHeading) return
    if (!mapReady) return
    if (!Number.isFinite(userLocation?.latitude) || !Number.isFinite(userLocation?.longitude)) return

    const map = mapRef.current
    if (!map) return

    setSelectedStore(null)
    map.stop()
    map.easeTo({
      center: [userLocation.longitude, userLocation.latitude],
      ...(userLocation.heading != null ? { bearing: userLocation.heading } : {}),
      duration: 900,
      essential: true,
    })
  }, [followUserHeading, mapReady, userLocation?.latitude, userLocation?.longitude, userLocation?.heading])

  useEffect(() => {
    if (!mapReady) return undefined

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      refreshUserLocation({ shouldRecenter: false, forceFreshPosition: true })
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [mapReady, refreshUserLocation])

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

        {!showNavigationInfoPanel && (
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
                    <div
                      key={store.id}
                      className={`flex items-center gap-2 border-b border-slate-700/50 px-2 py-2 ${idx === activeSuggestion ? 'bg-sky-500/20' : 'hover:bg-slate-800/80'}`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => flyToStore(store)}
                      >
                        <div className="truncate text-base font-medium text-slate-100">{store.name}</div>
                        <div className="truncate text-sm text-slate-400">{formatShortAddress(store)}</div>
                      </button>
                      <button
                        type="button"
                        className={`shrink-0 rounded-md border px-2 py-1 text-sm transition ${routeStopIds.has(String(store.id))
                          ? 'border-red-500/40 bg-red-500/15 text-red-200 hover:border-red-400 hover:text-red-100'
                          : 'border-slate-600/70 bg-slate-950/80 text-slate-200 hover:border-sky-400 hover:text-sky-200'
                          }`}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => {
                          if (routeStopIds.has(String(store.id))) {
                            removeRouteStop(store.id)
                            return
                          }
                          addStoreToRoute(store)
                        }}
                      >
                        {routeStopIds.has(String(store.id)) ? 'Bỏ khỏi tuyến' : 'Thêm'}
                      </button>
                    </div>
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
        )}

        {!routePanelOpen && (
          <div
            className="pointer-events-none absolute left-3 z-10"
            style={{
              bottom: !isDesktop && showNavigationInfoPanel
                ? (isStandalonePwa ? 'calc(env(safe-area-inset-bottom) + 13rem)' : '13rem')
                : (isStandalonePwa ? 'calc(env(safe-area-inset-bottom) + 0.75rem)' : '0.75rem'),
            }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="pointer-events-auto relative rounded-full border border-slate-600/70 bg-slate-950/90 px-4 py-2 text-sm font-medium text-slate-100 shadow-lg backdrop-blur transition hover:border-sky-400 hover:text-sky-200"
                onClick={() => setRoutePanelOpen(true)}
              >
                {'Tuy\u1ebfn \u0111\u01b0\u1eddng'}
                {routeStops.length > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-orange-200/80 bg-orange-500 px-1.5 text-xs font-semibold text-orange-950 shadow">
                    {routeStops.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {routePanelOpen && (
          <div
            className="pointer-events-none absolute left-3 right-3 z-30 sm:top-auto"
            style={{
              top: isDesktop ? 'auto' : '0.75rem',
              bottom: isDesktop
                ? (isStandalonePwa ? 'calc(env(safe-area-inset-bottom) + 0.75rem)' : '0.75rem')
                : '0.5rem',
            }}
          >
            <div
              className="pointer-events-auto flex h-full w-full max-w-none overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/95 shadow-2xl backdrop-blur sm:h-auto sm:max-h-[min(42rem,calc(100dvh-2rem))] sm:max-w-[26rem]"
              onPointerDown={(event) => {
                suppressMapInteractionUntilRef.current = Date.now() + MAP_INTERACTION_SUPPRESS_MS
                event.stopPropagation()
              }}
              onClick={(event) => {
                suppressMapInteractionUntilRef.current = Date.now() + MAP_INTERACTION_SUPPRESS_MS
                event.stopPropagation()
              }}
              onDoubleClick={(event) => {
                suppressMapInteractionUntilRef.current = Date.now() + MAP_INTERACTION_SUPPRESS_MS
                event.stopPropagation()
              }}
              onTouchStart={() => {
                suppressMapInteractionUntilRef.current = Date.now() + MAP_INTERACTION_SUPPRESS_MS
              }}
            >
              <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between px-4 pb-2 pt-4 sm:pt-3">
                <div>
                  <p className="text-base font-semibold text-slate-100">{'Tuy\u1ebfn \u0111\u01b0\u1eddng'}</p>
                </div>
                <div className="flex items-center gap-2">
                {routeStops.length > 0 && (
                  <button
                    type="button"
                    className={`rounded-full border p-2 transition ${hideUnselectedStores
                      ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                      : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                      }`}
                    onClick={() => setHideUnselectedStores((prev) => !prev)}
                    title={hideUnselectedStores ? 'Hi\u1ec7n t\u1ea5t c\u1ea3 c\u1eeda h\u00e0ng' : '\u1ea8n c\u1eeda h\u00e0ng ngo\u00e0i tuy\u1ebfn'}
                    aria-label={hideUnselectedStores ? 'Hi\u1ec7n t\u1ea5t c\u1ea3 c\u1eeda h\u00e0ng' : '\u1ea8n c\u1eeda h\u00e0ng ngo\u00e0i tuy\u1ebfn'}
                  >
                    {hideUnselectedStores ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.58 10.58A3 3 0 0014 14a2.99 2.99 0 002.12-.88" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.88 5.09A9.77 9.77 0 0112 4.8c5.05 0 9.27 3.11 10.5 7.2a11.8 11.8 0 01-4.04 5.54M6.61 6.61C4.54 7.84 2.98 9.75 2.5 12c.57 2.37 2.23 4.36 4.5 5.62" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.5 12C3.73 7.91 7.95 4.8 13 4.8S22.27 7.91 23.5 12c-1.23 4.09-5.45 7.2-10.5 7.2S3.73 16.09 2.5 12z" />
                        <circle cx="13" cy="12" r="3" strokeWidth={2} />
                      </svg>
                    )}
                  </button>
                )}
                  <button
                    type="button"
                    className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:border-slate-500 hover:text-white"
                    onClick={() => setRoutePanelOpen(false)}
                    aria-label={'\u1ea8n b\u1ea3ng tuy\u1ebfn \u0111\u01b0\u1eddng'}
                    title={'\u1ea8n b\u1ea3ng tuy\u1ebfn \u0111\u01b0\u1eddng'}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M6 12h12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div
                ref={routeListScrollRef}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-3 pt-3"
                onContextMenu={(event) => event.preventDefault()}
                style={{
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  WebkitTouchCallout: 'none',
                }}
              >
                {selectedStore?.coords && !routeStopIds.has(String(selectedStore.id)) && (
                  <Button variant="outline" className="w-full" onClick={() => addStoreToRoute(selectedStore)}>
                    {'Th\u00eam c\u1eeda h\u00e0ng \u0111ang m\u1edf'}
                  </Button>
                )}

                {routeStops.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/70 px-3 py-3 text-sm text-slate-400">
                    {'G\u00f5 t\u00ean c\u1eeda h\u00e0ng \u1edf \u00f4 t\u00ecm ki\u1ebfm r\u1ed3i b\u1ea5m '}<span className="font-medium text-slate-200">{'Th\u00eam'}</span>{' \u0111\u1ec3 \u0111\u01b0a v\u00e0o tuy\u1ebfn.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {renderedRouteStops.map(({ store, originalIndex, displayIndex }) => (
                      completedRouteStopIdSet.has(String(store.id)) ? null : (
                      <div
                        key={store.id}
                        ref={(element) => {
                          if (element) routeItemRefs.current.set(displayIndex, element)
                          else routeItemRefs.current.delete(displayIndex)
                        }}
                        onPointerDown={(event) => startRouteDrag(originalIndex, event)}
                        onContextMenu={(event) => event.preventDefault()}
                        className={`rounded-lg border bg-slate-900/75 px-2.5 py-2 transition ${completedRouteStopIdSet.has(String(store.id)) ? 'opacity-45' : ''} ${originalIndex === draggedRouteIndex
                          ? 'border-slate-700/40 opacity-0'
                          : originalIndex === armedRouteIndex
                            ? 'border-sky-400/80 ring-1 ring-sky-400/50'
                          : dragOverRouteIndex === displayIndex && draggedRouteIndex !== -1
                            ? 'border-sky-400/80 ring-1 ring-sky-400/50'
                            : 'border-slate-700/70'
                          }`}
                        style={originalIndex === draggedRouteIndex && dragRouteBox
                          ? {
                            height: `${dragRouteBox.height}px`,
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            WebkitTouchCallout: 'none',
                          }
                          : {
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            WebkitTouchCallout: 'none',
                          }}
                      >
                        <div className="flex w-full items-start justify-between gap-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-col">
                              <span className={`truncate font-medium ${completedRouteStopIdSet.has(String(store.id)) ? 'text-slate-400' : 'text-slate-100'}`}>{store.name}</span>
                              <span className={`truncate ${completedRouteStopIdSet.has(String(store.id)) ? 'text-slate-500' : 'text-slate-400'}`}>{formatShortAddress(store)}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-start justify-end">
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-red-900/60 text-red-300 transition hover:bg-red-950/40"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => removeRouteStop(store.id)}
                              aria-label={`Lo\u1ea1i b\u1ecf c\u1eeda h\u00e0ng ${store.name} kh\u1ecfi tuy\u1ebfn`}
                            >
                              <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                      )
                    ))}
                  </div>
                )}

                {draggedRouteStore && dragRouteBox && (
                  <div
                    className="pointer-events-none fixed z-[400] rounded-lg border border-sky-400/80 bg-slate-900/95 px-2.5 py-2 shadow-2xl ring-1 ring-sky-400/40"
                    style={{
                      left: `${dragRouteBox.left}px`,
                      top: `${dragRouteBox.top}px`,
                      width: `${dragRouteBox.width}px`,
                      transform: `translate(${dragRouteOffset.x}px, ${dragRouteOffset.y}px)`,
                    }}
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-2.5">
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-slate-100">{draggedRouteStore.name}</span>
                          <span className="truncate text-slate-400">{formatShortAddress(draggedRouteStore)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {routeError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                    {routeError}
                  </div>
                )}

                {routeSummary && (
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-100">
                    <div className="font-medium">{'\u0110\u00e3 v\u1ebd tuy\u1ebfn theo \u0111\u01b0\u1eddng th\u1eadt'}</div>
                    <div className="mt-1 text-emerald-200/90">
                      {formatRouteDistance(routeSummary.distance)} • {formatRouteDuration(routeSummary.duration)}
                    </div>
                    <div className="mt-1 text-xs text-emerald-200/80">
                      {'Xuất phát và kết thúc tại điểm cố định đã chọn.'}
                    </div>
                  </div>
                )}

              </div>
              <div className="border-t border-slate-700/60 px-4 py-3">
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={routeLoading || routeSorting || routeStops.length < 2}
                    onClick={optimizeRouteOrder}
                  >
                    {routeSorting ? '\u0110ang s\u1eafp' : 'S\u1eafp x\u1ebfp'}
                  </Button>
                  <Button
                    className="w-full"
                    disabled={routeLoading || routeSorting || (routeStops.length === 0)}
                    onClick={async () => {
                      setRoutePanelOpen(false)
                      await buildRoute()
                    }}
                  >
                    {routeLoading ? '\u0110ang v\u1ebd' : 'V\u1ebd'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={routeLoading || routeSorting || (routeStops.length === 0 && routeGeojson.features.length === 0)}
                    onClick={clearRoutePlan}
                  >
                    Xóa
                  </Button>
                </div>
              </div>
              </div>
            </div>
          </div>
        )}

        <div
          className="pointer-events-none absolute right-3 sm:bottom-3 z-20"
          style={!isDesktop
            ? { bottom: isStandalonePwa ? 'calc(env(safe-area-inset-bottom) + 0.75rem)' : '0.75rem' }
            : undefined}
        >
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            {locationError && (
              <div className="max-w-[260px] rounded-lg border border-red-500/30 bg-slate-950/95 px-3 py-2 text-xs text-red-200 shadow-lg">
                {locationError}
              </div>
            )}
            {routeStops.length > 0 && !showNavigationInfoPanel && (
              <button
                type="button"
                onClick={toggleUserHeadingRotation}
                title={followUserHeading ? 'Tắt dẫn đường' : 'Bật dẫn đường'}
                aria-label={followUserHeading ? 'Tắt dẫn đường' : 'Bật dẫn đường'}
                aria-pressed={followUserHeading}
                className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur transition ${
                  followUserHeading
                    ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                    : 'border-slate-600/70 bg-slate-950/90 text-slate-100 hover:border-sky-400 hover:text-sky-300'
                }`}
              >
                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5-9 16-7-7 16-1.7-6.3L9 20z" />
                </svg>
              </button>
            )}
            {!showNavigationInfoPanel && (
              <button
                type="button"
                onClick={recenterToUserLocation}
                title="Về vị trí đang đứng"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/70 bg-slate-950/90 text-slate-100 shadow-lg backdrop-blur transition hover:border-sky-400 hover:text-sky-300"
              >
                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v3m0 12v3m9-9h-3M6 12H3" />
                  <circle cx="12" cy="12" r="4" strokeWidth="2" />
                </svg>
              </button>
            )}
            {showNavigationInfoPanel && navigationInfo && (
              <div className={`rounded-xl border border-slate-700/70 bg-slate-950/95 shadow-lg backdrop-blur ${isDesktop ? 'w-[320px] px-4 py-3 text-sm' : 'w-[calc(100vw-1rem)] px-4 py-3 text-base'}`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sky-200">Dẫn đường</div>
                  <button
                    type="button"
                    onClick={toggleUserHeadingRotation}
                    className="flex h-9 items-center justify-center rounded-md border border-red-500/60 bg-red-500/20 px-3 text-sm font-semibold text-red-100 transition hover:border-red-400 hover:bg-red-500/30 hover:text-white"
                  >
                    Thoát
                  </button>
                </div>
                <div className="mt-3 space-y-2.5">
                  <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{navigationInfo.currentLabel}</div>
                    <div className="mt-0.5 truncate text-[15px] font-semibold leading-tight text-slate-100">
                      {navigationInfo.currentStore ? navigationInfo.currentStore.name : navigationInfo.currentText}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Tiếp theo</div>
                    {navigationInfo.nextStore ? (
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[15px] font-semibold leading-tight text-slate-100">{navigationInfo.nextStore.name}</span>
                        <span className="shrink-0 rounded-full border border-sky-400/35 bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-100">
                          {Math.max(0, Math.round(navigationInfo.nextDistanceMeters || 0))}m
                        </span>
                      </div>
                    ) : (
                      <div className="mt-0.5 text-[15px] font-semibold leading-tight text-slate-100">Đã hoàn thành tuyến</div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
        onAddToRoute={addStoreToRoute}
        onRemoveFromRoute={removeRouteStop}
        isInRoute={selectedStore ? routeStopIds.has(String(selectedStore.id)) : false}
      />
    </div>
  )
}

