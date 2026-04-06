import React, { useCallback, useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getOrRefreshStores } from '@/lib/storeCache'
import { parseCoordinate } from '@/helper/coordinate'
import { haversineKm } from '@/helper/distance'

const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] }
const NEARBY_STORES_LIMIT = 30

function getMarkerLabelText(name = '') {
  const cleaned = String(name || '').trim()
  if (!cleaned) return 'Cửa hàng'
  // Keep full nearby store name instead of abbreviating to first word.
  return cleaned
}

function createStoreMarker(text, fontSize = 12) {
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 2
  const iconSize = Math.round(32 * dpr)
  const iconPad = Math.round(2 * dpr)
  const gap = Math.round(1 * dpr)
  const scaledFont = Math.round(fontSize * dpr)
  const maxPxWidth = Math.round(8.5 * fontSize * dpr)
  const paddingX = Math.round(7 * dpr)
  const paddingY = Math.round(3 * dpr)
  const lineHeight = Math.round(scaledFont * 1.3)
  const radius = Math.round(5 * dpr)

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

  const totalW = Math.max(iconSize + iconPad * 2, labelW)
  const iconBottom = iconSize
  const totalH = iconBottom + gap + labelH
  const canvas = document.createElement('canvas')
  canvas.width = totalW
  canvas.height = totalH
  const ctx = canvas.getContext('2d')

  const iconCX = totalW / 2
  const iconCY = iconPad + iconSize / 2
  const r = iconSize / 2 - iconPad

  ctx.beginPath()
  ctx.arc(iconCX, iconCY, r, 0, Math.PI * 2)
  ctx.fillStyle = '#0f172a'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5 * dpr
  ctx.stroke()

  const s = r * 0.52
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(iconCX, iconCY - s * 0.9)
  ctx.lineTo(iconCX - s, iconCY - s * 0.05)
  ctx.lineTo(iconCX + s, iconCY - s * 0.05)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(iconCX - s * 0.72, iconCY - s * 0.05, s * 1.44, s * 1.0)
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(iconCX - s * 0.2, iconCY + s * 0.3, s * 0.4, s * 0.65)

  const lx = (totalW - labelW) / 2
  const ly = iconBottom + gap
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(lx, ly, labelW, labelH, radius)
  } else {
    const r2 = Math.min(radius, labelW / 2, labelH / 2)
    ctx.moveTo(lx + r2, ly)
    ctx.lineTo(lx + labelW - r2, ly)
    ctx.quadraticCurveTo(lx + labelW, ly, lx + labelW, ly + r2)
    ctx.lineTo(lx + labelW, ly + labelH - r2)
    ctx.quadraticCurveTo(lx + labelW, ly + labelH, lx + labelW - r2, ly + labelH)
    ctx.lineTo(lx + r2, ly + labelH)
    ctx.quadraticCurveTo(lx, ly + labelH, lx, ly + labelH - r2)
    ctx.lineTo(lx, ly + r2)
    ctx.quadraticCurveTo(lx, ly, lx + r2, ly)
    ctx.closePath()
  }
  // Reduce transparency a bit for easier reading.
  ctx.fillStyle = 'rgba(2, 6, 23, 0.98)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = dpr
  ctx.stroke()

  ctx.font = `bold ${scaledFont}px "Open Sans", system-ui, sans-serif`
  ctx.fillStyle = '#f1f5f9'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], totalW / 2, ly + paddingY + i * lineHeight)
  }

  return { width: totalW, height: totalH, data: ctx.getImageData(0, 0, totalW, totalH).data, dpr }
}

function toLatLng(store) {
  let lat = parseCoordinate(store?.latitude)
  let lng = parseCoordinate(store?.longitude)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  if ((lat < -90 || lat > 90) && lng >= -90 && lng <= 90 && lat >= -180 && lat <= 180) {
    const temp = lat
    lat = lng
    lng = temp
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

export default function LocationPicker({
  initialLat,
  initialLng,
  onChange,
  className,
  editable = true,
  debug = false,
  height = 420,
  heading = null,
  dark = true
}) {
  const defaultLat = 21.0768617
  const defaultLng = 105.6955684
  const mapRef = useRef(null)
  const lastBearingRef = useRef(0)
  const mapContainerRef = useRef(null)
  const centerRef = useRef([initialLng ?? defaultLng, initialLat ?? defaultLat])
  const markerRef = useRef(null)
  const editableRef = useRef(editable)
  const onChangeRef = useRef(onChange)
  const debugRef = useRef(debug)
  const allStoresRef = useRef([])
  const nearbyImageIdsRef = useRef(new Set())

  const ensureNearbyStoresLayers = useCallback((map) => {
    if (!map.getSource('nearby-stores')) {
      map.addSource('nearby-stores', {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION,
      })
    }

    if (!map.getLayer('nearby-stores-marker')) {
      map.addLayer({
        id: 'nearby-stores-marker',
        type: 'symbol',
        source: 'nearby-stores',
        layout: {
          'icon-image': ['get', 'markerImage'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.52, 12, 0.72, 15, 0.92, 18, 1],
          'icon-anchor': 'top',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'symbol-sort-key': ['*', -1, ['get', 'distanceRank']],
        },
      })
    }
  }, [])

  const updateNearbyStores = useCallback((lat, lng) => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource('nearby-stores')
    if (!source) return
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      source.setData(EMPTY_FEATURE_COLLECTION)
      return
    }

    const features = allStoresRef.current
      .map((item) => ({
        ...item,
        distance: haversineKm(lat, lng, item.coords.lat, item.coords.lng),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, NEARBY_STORES_LIMIT)

    const featureList = []
    features.forEach((item, index) => {
      const markerImage = `nearby-sm-${String(item.id)}`
      if (!nearbyImageIdsRef.current.has(markerImage) && !map.hasImage(markerImage)) {
        const img = createStoreMarker(getMarkerLabelText(item.name || 'Cửa hàng'))
        map.addImage(markerImage, { width: img.width, height: img.height, data: img.data }, { pixelRatio: img.dpr })
        nearbyImageIdsRef.current.add(markerImage)
      }

      featureList.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [item.coords.lng, item.coords.lat],
        },
        properties: {
          id: String(item.id),
          name: item.name || 'Cửa hàng',
          markerImage,
          distanceRank: index,
        },
      })
    })

    source.setData({ type: 'FeatureCollection', features: featureList })
  }, [])

  const loadNearbyStores = useCallback(async () => {
    try {
      const stores = await getOrRefreshStores()
      allStoresRef.current = (stores || [])
        .map((store) => ({
          id: store.id,
          name: store.name,
          coords: toLatLng(store),
        }))
        .filter((store) => store.coords)

      const [lng, lat] = centerRef.current
      updateNearbyStores(lat, lng)
    } catch (err) {
      console.error('Load nearby stores error:', err)
    }
  }, [updateNearbyStores])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    debugRef.current = debug
  }, [debug])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

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
        layers: [
          { id: 'osm', type: 'raster', source: 'osm' }
        ]
      },
      center: centerRef.current,
      zoom: 17,
      minZoom: 3,
      maxZoom: 20,
      attributionControl: true
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')

    map.on('load', () => {
      ensureNearbyStoresLayers(map)
      const [lng, lat] = centerRef.current
      updateNearbyStores(lat, lng)
    })

    if (map.isStyleLoaded()) {
      ensureNearbyStoresLayers(map)
      const [lng, lat] = centerRef.current
      updateNearbyStores(lat, lng)
    }

    // Locked mode: only allow zoom via built-in +/- control (NavigationControl).
    if (editableRef.current) {
      map.dragPan.enable()
      map.scrollZoom.enable()
      map.doubleClickZoom.enable()
      map.boxZoom.enable()
      map.keyboard.enable()
      map.touchZoomRotate.enable()
      map.touchZoomRotate.disableRotation()
    } else {
      map.dragPan.disable()
      map.scrollZoom.disable()
      map.doubleClickZoom.disable()
      map.boxZoom.disable()
      map.keyboard.disable()
      if (map.touchZoomRotate && map.touchZoomRotate.disable) map.touchZoomRotate.disable()
    }

    // Use native Marker from MapLibre to avoid CSS anchor drift on custom markers.
    const setControlsOnTop = () => {
      const container = map.getContainer()
      if (!container) return
      container.querySelectorAll('.maplibregl-ctrl').forEach((ctrl) => {
        ctrl.style.zIndex = '20'
      })
    }

    const marker = new maplibregl.Marker({ color: '#ef4444', scale: 1.1 })
      .setLngLat(centerRef.current)
      .addTo(map)
    markerRef.current = marker

    setControlsOnTop()

    const updateCenter = () => {
      const c = map.getCenter()
      const lat = Number(c.lat.toFixed(7))
      const lng = Number(c.lng.toFixed(7))
      centerRef.current = [lng, lat]
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat])
      }
    }

    map.on('move', updateCenter)
    map.on('moveend', () => {
      updateCenter()
      const [lng, lat] = centerRef.current
      updateNearbyStores(lat, lng)
      if (editableRef.current && onChangeRef.current) {
        onChangeRef.current(lat, lng)
      }
      if (debugRef.current) {
        console.log('Map center:', { lat, lng })
      }
    })

    // Support "tap/click to pin" when unlocked.
    map.on('click', (e) => {
      if (!editableRef.current) return
      const lat = Number(e.lngLat.lat.toFixed(7))
      const lng = Number(e.lngLat.lng.toFixed(7))
      centerRef.current = [lng, lat]
      map.easeTo({ center: [lng, lat], duration: 250 })
      if (markerRef.current) markerRef.current.setLngLat([lng, lat])
      if (onChangeRef.current) onChangeRef.current(lat, lng)
      updateNearbyStores(lat, lng)
    })

    loadNearbyStores()

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [ensureNearbyStoresLayers, loadNearbyStores, updateNearbyStores])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (typeof initialLat === 'number' && typeof initialLng === 'number') {
      map.setCenter([initialLng, initialLat])
      centerRef.current = [initialLng, initialLat]
      if (markerRef.current) markerRef.current.setLngLat([initialLng, initialLat])
      updateNearbyStores(initialLat, initialLng)
    }
  }, [initialLat, initialLng, updateNearbyStores])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    editableRef.current = editable
    if (editable) {
      map.dragPan.enable()
      map.scrollZoom.enable()
      map.doubleClickZoom.enable()
      map.boxZoom.enable()
      map.keyboard.enable()
      if (map.touchZoomRotate && map.touchZoomRotate.enable) map.touchZoomRotate.enable()
    } else {
      map.dragPan.disable()
      map.scrollZoom.disable()
      map.doubleClickZoom.disable()
      map.boxZoom.disable()
      map.keyboard.disable()
      if (map.touchZoomRotate && map.touchZoomRotate.disable) map.touchZoomRotate.disable()
    }
    // Always disable rotate interactions; bearing is controlled by heading only.
    try {
      if (map.dragRotate && map.dragRotate.disable) map.dragRotate.disable()
      if (map.touchZoomRotate && map.touchZoomRotate.disableRotation) map.touchZoomRotate.disableRotation()
    } catch {}
    try { map.setBearing(lastBearingRef.current) } catch {}
  }, [editable])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (typeof heading === 'number' && isFinite(heading)) {
      lastBearingRef.current = heading
      map.setBearing(heading)
    }
  }, [heading])

  return (
    <div className={className} style={{ position: 'relative' }}>
      <div
        ref={mapContainerRef}
        className={dark ? "dark-map-filter" : ""}
        style={{ height, width: '100%', touchAction: editable ? 'none' : 'manipulation', cursor: editable ? 'grab' : 'default' }}
      />
      {!editable && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: dark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.55)',
            backdropBlur: dark ? '4px' : 'none',
            zIndex: 10,
            pointerEvents: 'none',
            touchAction: 'none',
          }}
        />
      )}
    </div>
  )
}
