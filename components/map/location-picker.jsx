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
      minZoom: 18,
      maxZoom: 18,
      attributionControl: true
    })
    mapRef.current = map

    map.dragPan.enable()
    map.scrollZoom.disable()
    map.doubleClickZoom.disable()
    map.boxZoom.disable()
    map.keyboard.disable()
    map.touchZoomRotate.disableRotation()

    const markerEl = document.createElement('div')
    markerEl.style.width = '28px'
    markerEl.style.height = '40px'
    markerEl.style.background =
      'url("data:image/svg+xml;utf8,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"28\\" height=\\"40\\" viewBox=\\"0 0 24 36\\"><path d=\\"M12 0C7.031 0 3 4.031 3 9c0 7.5 9 18 9 18s9-10.5 9-18c0-4.969-4.031-9-9-9z\\" fill=\\"%23ef4444\\"/><circle cx=\\"12\\" cy=\\"9\\" r=\\"3\\" fill=\\"white\\" /></svg>") no-repeat center'
    markerEl.style.transform = 'translate(-50%, -100%)'

    const marker = new maplibregl.Marker({ element: markerEl })
      .setLngLat(centerRef.current)
      .addTo(map)
    markerRef.current = marker

    const updateCenter = () => {
      const c = map.getCenter()
      const lat = Number(c.lat.toFixed(6))
      const lng = Number(c.lng.toFixed(6))
      centerRef.current = [lng, lat]
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat])
      }
    }

    map.on('move', updateCenter)
    map.on('moveend', () => {
      updateCenter()
      if (editable && onChange) {
        const [lng, lat] = centerRef.current
        onChange(lat, lng)
      }
      if (debug) {
        const [lng, lat] = centerRef.current
        console.log('Map center:', { lat, lng })
      }
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [editable, onChange, debug])

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
    if (editable) {
      map.dragPan.enable()
    } else {
      map.dragPan.disable()
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
        style={{ height, width: '100%', touchAction: 'none', cursor: editable ? 'grab' : 'default' }}
      />
      {!editable && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', zIndex: 9998, pointerEvents: 'none' }} />
      )}
    </div>
  )
}
