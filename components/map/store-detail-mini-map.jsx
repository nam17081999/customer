import { useEffect, useMemo, useRef, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  ensureStoreMarkerImage,
  getBaseMarkerImageId,
  getHighlightedMarkerImageId,
  removeMarkerImages,
} from '@/helper/mapMarkerImages'
import { hasStoreCoordinates } from '@/helper/storeSupplement'
import { getOrRefreshStores } from '@/lib/storeCache'

const DEFAULT_ZOOM = 15.2
const MAX_NEARBY_STORES = 40

function toRadians(value) {
  return (value * Math.PI) / 180
}

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function createFeature(store, selectedStoreId) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [store.longitude, store.latitude],
    },
    properties: {
      storeId: String(store.id),
      name: store.name || 'Cửa hàng',
      highlighted: String(store.id) === String(selectedStoreId) ? 'yes' : 'no',
      routeOrder: '',
      passed: 'no',
    },
  }
}

export default function StoreDetailMiniMap({ store, open }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const activeMarkerImageIdsRef = useRef(new Set())
  const popupRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [nearbyStores, setNearbyStores] = useState([])

  const selectedStoreId = String(store?.id || '')
  const hasCoords = hasStoreCoordinates(store)

  const mapFeatures = useMemo(() => {
    if (!hasCoords || !store) return []

    const selected = {
      ...store,
      latitude: Number(store.latitude),
      longitude: Number(store.longitude),
    }

    const normalizedNearby = nearbyStores
      .filter((item) => String(item.id) !== selectedStoreId)
      .map((item) => ({
        ...item,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
      }))

    return [
      ...normalizedNearby.map((item) => createFeature(item, selectedStoreId)),
      createFeature(selected, selectedStoreId),
    ]
  }, [hasCoords, nearbyStores, selectedStoreId, store])

  useEffect(() => {
    if (!open || !hasCoords || !store?.id) {
      setNearbyStores([])
      return
    }

    let cancelled = false

    const loadStores = async () => {
      try {
        const stores = await getOrRefreshStores()
        if (cancelled || !Array.isArray(stores)) return

        const currentLat = Number(store.latitude)
        const currentLng = Number(store.longitude)

        const rankedStores = stores
          .filter((item) => hasStoreCoordinates(item))
          .map((item) => ({
            ...item,
            distanceMeters: calculateDistanceMeters(
              currentLat,
              currentLng,
              Number(item.latitude),
              Number(item.longitude)
            ),
          }))
          .sort((first, second) => first.distanceMeters - second.distanceMeters)
          .slice(0, MAX_NEARBY_STORES)

        setNearbyStores(rankedStores)
      } catch (error) {
        console.error('Load nearby stores for detail mini map failed:', error)
        if (!cancelled) setNearbyStores([])
      }
    }

    loadStores()

    return () => {
      cancelled = true
    }
  }, [hasCoords, open, store])

  useEffect(() => {
    if (!open || !hasCoords || !containerRef.current || mapRef.current) return

    let cancelled = false

    const setupMap = async () => {
      const maplibreModule = await import('maplibre-gl')
      if (cancelled || !containerRef.current) return

      const maplibregl = maplibreModule.default
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [Number(store.longitude), Number(store.latitude)],
        zoom: DEFAULT_ZOOM,
        minZoom: 3,
        maxZoom: 19,
        attributionControl: false,
      })

      mapRef.current = map
      map.boxZoom.disable()
      map.doubleClickZoom.disable()
      map.dragRotate.disable()
      map.dragPan.disable()
      map.keyboard.disable()
      map.scrollZoom.disable()
      map.touchPitch.disable()
      map.touchZoomRotate.disable()
      map.touchZoomRotate.disableRotation()
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')

      map.on('load', () => {
        if (cancelled) return

        map.addSource('detail-stores', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })

        map.addLayer({
          id: 'detail-store-marker',
          type: 'symbol',
          source: 'detail-stores',
          layout: {
            'icon-image': ['case',
              ['==', ['get', 'highlighted'], 'yes'], ['concat', 'smh-', ['get', 'storeId']],
              ['concat', 'sm-', ['get', 'storeId']],
            ],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 10, 0.55, 14, 0.8, 17, 1],
            'icon-anchor': 'center',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'symbol-sort-key': ['case', ['==', ['get', 'highlighted'], 'yes'], 999, 0],
            'symbol-z-order': 'auto',
          },
          paint: {
            'icon-opacity': 1,
          },
        })

        popupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 12,
          className: 'detail-mini-map-popup',
        })

        map.on('mouseenter', 'detail-store-marker', (event) => {
          const feature = event.features?.[0]
          const coordinates = feature?.geometry?.coordinates
          if (!feature || !Array.isArray(coordinates)) return

          map.getCanvas().style.cursor = 'pointer'
          popupRef.current
            ?.setLngLat(coordinates)
            .setHTML(`<div>${feature.properties?.name || 'Cửa hàng'}</div>`)
            .addTo(map)
        })

        map.on('mouseleave', 'detail-store-marker', () => {
          map.getCanvas().style.cursor = ''
          popupRef.current?.remove()
        })

        setMapReady(true)
      })
    }

    setupMap()

    return () => {
      cancelled = true
      popupRef.current?.remove()
      popupRef.current = null
      setMapReady(false)
      if (mapRef.current) {
        removeMarkerImages(mapRef.current, Array.from(activeMarkerImageIdsRef.current))
        activeMarkerImageIdsRef.current = new Set()
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [hasCoords, open, store])

  useEffect(() => {
    if (!open) return
    const map = mapRef.current
    if (!map) return

    window.requestAnimationFrame(() => {
      map.resize()
    })
  }, [open])

  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    const source = map?.getSource('detail-stores')
    if (!map || !source) return

    source.setData({
      type: 'FeatureCollection',
      features: mapFeatures,
    })

    const desiredImageIds = new Set()
    for (const feature of mapFeatures) {
      const storeId = feature.properties.storeId
      const name = feature.properties.name || 'Cửa hàng'
      const highlighted = feature.properties.highlighted === 'yes'
      const baseImageId = getBaseMarkerImageId(storeId)
      desiredImageIds.add(baseImageId)
      if (!map.hasImage(baseImageId)) {
        ensureStoreMarkerImage(map, { storeId, text: name, highlighted: false })
      }

      if (highlighted) {
        const highlightedImageId = getHighlightedMarkerImageId(storeId)
        desiredImageIds.add(highlightedImageId)
        if (!map.hasImage(highlightedImageId)) {
          ensureStoreMarkerImage(map, { storeId, text: name, highlighted: true })
        }
      }
    }

    const staleImageIds = Array.from(activeMarkerImageIdsRef.current).filter((imageId) => !desiredImageIds.has(imageId))
    if (staleImageIds.length > 0) {
      removeMarkerImages(map, staleImageIds)
    }
    activeMarkerImageIdsRef.current = desiredImageIds

    if (hasCoords) {
      map.easeTo({
        center: [Number(store.longitude), Number(store.latitude)],
        zoom: DEFAULT_ZOOM,
        duration: 500,
      })
    }
  }, [hasCoords, mapFeatures, mapReady, store])

  if (!hasCoords) return null

  return (
    <section className="space-y-2 border-t border-gray-800/70 pt-3">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <p className="text-sm font-semibold text-gray-300">Bản đồ cửa hàng</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-950/40">
        <div ref={containerRef} className="aspect-square w-full bg-slate-950" />
      </div>

      <style jsx global>{`
        .detail-mini-map-popup .maplibregl-popup-content {
          background: rgba(15, 23, 42, 0.96);
          color: #f8fafc;
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
        }

        .detail-mini-map-popup .maplibregl-popup-tip {
          border-top-color: rgba(15, 23, 42, 0.96);
        }
      `}</style>
    </section>
  )
}