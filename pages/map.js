import 'maplibre-gl/dist/maplibre-gl.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import StoreDetailModal from '@/components/store-detail-modal'
import { getOrRefreshStores } from '@/lib/storeCache'
import { IGNORED_NAME_TERMS } from '@/helper/duplicateCheck'
import { DISTRICT_WARD_SUGGESTIONS, STORE_TYPE_OPTIONS } from '@/lib/constants'
import { parseCoordinate } from '@/helper/coordinate'
import { formatAddressParts } from '@/lib/utils'
import { buildStoreSearchIndex, createSearchQueryMeta, matchesSearchQuery } from '@/helper/storeSearch'
import { filterMapStoresByAreaSelection } from '@/helper/mapFilter'
import {
  formatRouteDistance,
  formatRouteDuration,
  formatShortAddress,
  moveItem,
} from '@/helper/mapRoute'
import { useMapNavigationController } from '@/helper/useMapNavigationController'
import { useMapRouteController } from '@/helper/useMapRouteController'
import {
  createUserHeadingFanImage,
  ensureStoreMarkerImage,
  getBaseMarkerImageId,
  getHighlightedMarkerImageId,
  removeMarkerImages,
} from '@/helper/mapMarkerImages'

const DEFAULT_CENTER = [105.6955684, 21.0768617]
const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] }

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

export default function MapPage() {
  const router = useRouter()
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const maplibreRef = useRef(null)
  const popupRef = useRef(null)
  const activeMarkerImageIdsRef = useRef(new Set())

  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedStoreId, setHighlightedStoreId] = useState('')
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
  const [armedRouteIndex, setArmedRouteIndex] = useState(-1)
  const [draggedRouteIndex, setDraggedRouteIndex] = useState(-1)
  const [dragOverRouteIndex, setDragOverRouteIndex] = useState(-1)
  const [dragRouteOffset, setDragRouteOffset] = useState({ x: 0, y: 0 })
  const [dragRouteBox, setDragRouteBox] = useState(null)
  const [routePanelOpen, setRoutePanelOpen] = useState(false)
  const searchWrapperRef = useRef(null)
  const inputRef = useRef(null)
  const suggestionsRef = useRef(null)
  const routeListScrollRef = useRef(null)
  const routeItemRefs = useRef(new Map())
  const routeDragStateRef = useRef(null)
  const pendingRouteDragRef = useRef(null)
  const routeAutoScrollRef = useRef(null)
  const suppressMapInteractionUntilRef = useRef(0)

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

  const clearSelectedStore = useCallback(() => {
    setSelectedStore(null)
  }, [])

  const {
    locationError,
    userLocation,
    followUserHeading,
    navLoading,
    recenterToUserLocation,
    toggleUserHeadingRotation,
    disableFollowUserHeading,
  } = useMapNavigationController({
    mapRef,
    mapReady,
    initialHasRouteTarget: Boolean(initialTarget || initialStoreId),
    clearSelectedStore,
  })

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
    return filterMapStoresByAreaSelection(storesWithCoords, selectedDistricts, selectedWards)
  }, [storesWithCoords, selectedDistricts, selectedWards])

  const filteredStores = useMemo(() => {
    return storesAfterAreaFilters.filter((store) => {
      const typeMatched = selectedStoreTypes.length === 0 || selectedStoreTypes.includes(store.store_type || '')
      return typeMatched
    })
  }, [storesAfterAreaFilters, selectedStoreTypes])

  const {
    routeStops,
    setRouteStops,
    routeGeojson,
    routeSummary,
    routeLoading,
    routeSorting,
    routeError,
    hideUnselectedStores,
    setHideUnselectedStores,
    routeStopIds,
    routeStopOrderById,
    completedRouteStopIdSet,
    navigationInfo,
    addStoreToRoute,
    removeRouteStop,
    clearRoutePlan,
    buildRoute,
    optimizeRouteOrder,
    resetRouteProgress,
  } = useMapRouteController({
    loading,
    storesWithCoords,
    userLocation,
    followUserHeading,
    mapRef,
    isDesktop,
  })

  const renderedRouteStops = useMemo(() => {
    const items = routeStops.map((store, index) => ({ store, originalIndex: index }))
    if (draggedRouteIndex < 0 || dragOverRouteIndex < 0) {
      return items.map((item, displayIndex) => ({ ...item, displayIndex }))
    }

    return moveItem(items, draggedRouteIndex, dragOverRouteIndex)
      .map((item, displayIndex) => ({ ...item, displayIndex }))
  }, [routeStops, draggedRouteIndex, dragOverRouteIndex])

  const draggedRouteStore = draggedRouteIndex >= 0 ? routeStops[draggedRouteIndex] : null

  const visibleMapStores = useMemo(() => {
    if (!hideUnselectedStores || routeStopIds.size === 0) return filteredStores
    return filteredStores.filter((store) => routeStopIds.has(String(store.id)))
  }, [filteredStores, hideUnselectedStores, routeStopIds])

  const indexedMapStores = useMemo(() => buildStoreSearchIndex(storesWithCoords), [storesWithCoords])

  const storeFeatures = useMemo(() => {
    const highlightedId = highlightedStoreId ? String(highlightedStoreId) : ''
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
        highlighted: String(store.id) === highlightedId ? 'yes' : 'no',
      },
    }))

    if (!highlightedId) return features

    const highlightedIndex = features.findIndex((feature) => feature.properties.storeId === highlightedId)
    if (highlightedIndex < 0) return features

    const nextFeatures = features.slice()
    const [highlightedFeature] = nextFeatures.splice(highlightedIndex, 1)
    nextFeatures.push(highlightedFeature)
    return nextFeatures
  }, [completedRouteStopIdSet, highlightedStoreId, routeStopOrderById, visibleMapStores])

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
    const queryMeta = createSearchQueryMeta(searchTerm)
    if (!queryMeta.term) return []

    return indexedMapStores
      .filter((entry) => matchesSearchQuery(entry, queryMeta))
      .map((entry) => entry.store)
      .slice(0, 25)
  }, [indexedMapStores, searchTerm])

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
            setHighlightedStoreId(String(storeId))
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
      if (activeMap) removeMarkerImages(activeMap, activeMarkerImageIdsRef.current)
      activeMarkerImageIdsRef.current = new Set()
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

    source.setData({ type: 'FeatureCollection', features: storeFeatures })

    const desiredImageIds = new Set()
    const pendingImages = []
    for (const feature of storeFeatures) {
      const storeId = feature.properties.storeId
      const routeOrder = feature.properties.routeOrder || ''
      const name = feature.properties.name || 'Cửa hàng'
      const highlighted = feature.properties.highlighted === 'yes'
      const baseImageId = getBaseMarkerImageId(storeId, routeOrder)

      desiredImageIds.add(baseImageId)
      if (!map.hasImage(baseImageId)) {
        pendingImages.push({ storeId, text: name, routeOrder, highlighted: false })
      }

      if (highlighted) {
        const highlightedImageId = getHighlightedMarkerImageId(storeId, routeOrder)
        desiredImageIds.add(highlightedImageId)
        if (!map.hasImage(highlightedImageId)) {
          pendingImages.push({ storeId, text: name, routeOrder, highlighted: true })
        }
      }
    }

    let frameId = 0
    let cancelled = false
    let index = 0

    const removeStaleImages = () => {
      const staleImageIds = Array.from(activeMarkerImageIdsRef.current).filter((imageId) => !desiredImageIds.has(imageId))
      if (staleImageIds.length > 0) {
        removeMarkerImages(map, staleImageIds)
      }
      activeMarkerImageIdsRef.current = desiredImageIds
    }

    if (pendingImages.length === 0) {
      removeStaleImages()
      return undefined
    }

    const flushImageBatch = () => {
      if (cancelled) return

      const batchEnd = Math.min(index + 18, pendingImages.length)
      for (; index < batchEnd; index += 1) {
        const item = pendingImages[index]
        ensureStoreMarkerImage(map, item)
      }

      if (index < pendingImages.length) {
        frameId = window.requestAnimationFrame(flushImageBatch)
        return
      }

      removeStaleImages()
    }

    frameId = window.requestAnimationFrame(flushImageBatch)

    return () => {
      cancelled = true
      if (frameId) window.cancelAnimationFrame(frameId)
    }
  }, [mapReady, storeFeatures, visibleMapStores])

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
    const map = mapRef.current
    if (!map || !mapReady) return

    const routeSource = map.getSource('route-path')
    if (routeSource) routeSource.setData(routeGeojson)
  }, [mapReady, routeGeojson])

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
      resetRouteProgress()
    }

    setArmedRouteIndex(-1)
    setDraggedRouteIndex(-1)
    setDragOverRouteIndex(-1)
    setDragRouteOffset({ x: 0, y: 0 })
    setDragRouteBox(null)
  }, [cancelPendingRouteDrag, resetRouteProgress, setRouteStops])

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

  const flyToStore = useCallback((store) => {
    if (!store?.coords) return
    const map = mapRef.current
    if (!map) return

    setHighlightedStoreId(String(store.id))
    map.flyTo({ center: [store.coords.lng, store.coords.lat], zoom: 16, duration: 900 })

    setShowSuggestions(false)
    setSearchTerm(store.name || '')
    inputRef.current?.blur()
  }, [])

  const handleSearch = useCallback(() => {
    const queryMeta = createSearchQueryMeta(searchTerm)
    if (!queryMeta.term) return

    const matchedEntry = indexedMapStores.find((entry) => matchesSearchQuery(entry, queryMeta))
    const matched = matchedEntry?.store || null

    if (matched) flyToStore(matched)
    setShowSuggestions(false)
  }, [flyToStore, indexedMapStores, searchTerm])

  const showNavigationInfoPanel = followUserHeading && Boolean(navigationInfo)

  useEffect(() => {
    if (!router.isReady) return
    if (!initialStoreId || !mapReady) return

    const matched = storesWithCoords.find((store) => String(store.id) === initialStoreId)
    if (!matched) return

    setHighlightedStoreId(initialStoreId)
    flyToStore(matched)
  }, [router.isReady, initialStoreId, storesWithCoords, mapReady, flyToStore])

  useEffect(() => {
    if (routeStops.length === 0) {
      disableFollowUserHeading()
    }
  }, [disableFollowUserHeading, routeStops.length])

  const handleToggleUserHeadingRotation = useCallback(() => {
    toggleUserHeadingRotation({
      routeStopsLength: routeStops.length,
      routeFeatureCount: routeGeojson.features.length,
      buildRoute,
      onEnableRouteMode: () => setHideUnselectedStores(true),
    })
  }, [buildRoute, routeGeojson.features.length, routeStops.length, setHideUnselectedStores, toggleUserHeadingRotation])

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

        {/* Dark loading overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950 transition-opacity duration-500"
          style={{ opacity: mapReady ? 0 : 1 }}
        >
          <svg className="h-8 w-8 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-60" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="mt-3 text-sm text-slate-500">Đang tải bản đồ…</p>
        </div>

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
                onClick={handleToggleUserHeadingRotation}
                disabled={navLoading}
                title={navLoading ? 'Đang kết nối...' : followUserHeading ? 'Tắt dẫn đường' : 'Bật dẫn đường'}
                aria-label={navLoading ? 'Đang kết nối...' : followUserHeading ? 'Tắt dẫn đường' : 'Bật dẫn đường'}
                aria-pressed={followUserHeading}
                className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur transition ${
                  navLoading
                    ? 'border-sky-400/50 bg-sky-500/10 text-sky-300 opacity-80 cursor-wait'
                    : followUserHeading
                    ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                    : 'border-slate-600/70 bg-slate-950/90 text-slate-100 hover:border-sky-400 hover:text-sky-300'
                }`}
              >
                {navLoading ? (
                  <svg className="h-4.5 w-4.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                ) : (
                  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5-9 16-7-7 16-1.7-6.3L9 20z" />
                  </svg>
                )}
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
                    onClick={handleToggleUserHeadingRotation}
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

