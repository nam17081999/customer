import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export default function LocationPicker({
  initialLat,
  initialLng,
  onChange,
  className,
  editable = true,
  debug = false,
  height = 420,
  heading = null
}) {
  const defaultLat = 10.776900
  const defaultLng = 106.700980
  const mapRef = useRef(null)
  const lastBearingRef = useRef(0)
  const mapContainerRef = useRef(null)
  const centerRef = useRef([initialLng ?? defaultLng, initialLat ?? defaultLat])
  const markerRef = useRef(null)
  const editableRef = useRef(editable)
  const onChangeRef = useRef(onChange)
  const debugRef = useRef(debug)

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
      zoom: 18,
      minZoom: 3,
      maxZoom: 20,
      attributionControl: true
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')

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
    const marker = new maplibregl.Marker({ color: '#ef4444', scale: 1.1 })
      .setLngLat(centerRef.current)
      .addTo(map)
    markerRef.current = marker

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
      if (editableRef.current && onChangeRef.current) {
        const [lng, lat] = centerRef.current
        onChangeRef.current(lat, lng)
      }
      if (debugRef.current) {
        const [lng, lat] = centerRef.current
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
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (typeof initialLat === 'number' && typeof initialLng === 'number') {
      map.setCenter([initialLng, initialLat])
      centerRef.current = [initialLng, initialLat]
      if (markerRef.current) markerRef.current.setLngLat([initialLng, initialLat])
    }
  }, [initialLat, initialLng])

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
        style={{ height, width: '100%', touchAction: editable ? 'none' : 'manipulation', cursor: editable ? 'grab' : 'default' }}
      />
      {!editable && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', zIndex: 9998, pointerEvents: 'none' }} />
      )}
    </div>
  )
}
