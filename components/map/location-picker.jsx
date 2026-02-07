import React, { useEffect, useState, useRef, useCallback } from 'react'
// This component requires `react-leaflet` and `leaflet` packages.
// Install with: npm install react-leaflet leaflet
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, useMapEvents, Marker } from 'react-leaflet'
import L from 'leaflet'

// ensure icon assets are available in various bundlers
try {
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: typeof window !== 'undefined' ? require('leaflet/dist/images/marker-icon-2x.png') : undefined,
    iconUrl: typeof window !== 'undefined' ? require('leaflet/dist/images/marker-icon.png') : undefined,
    shadowUrl: typeof window !== 'undefined' ? require('leaflet/dist/images/marker-shadow.png') : undefined,
  })
} catch (e) {
  // ignore when require isn't available at build time
}

function CenterTracker({ onCenterChange, icon, onInit, debug = false }) {
  const markerRef = useRef(null)
  const debugMarkerRef = useRef(null)
  const map = useMapEvents({
    move() {
      // Get exact center coordinates
      const center = map.getCenter()
      const lat = Number(center.lat.toFixed(6))
      const lng = Number(center.lng.toFixed(6))
      
      // Update marker positions continuously during drag
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      }
      if (debugMarkerRef.current) {
        debugMarkerRef.current.setLatLng([lat, lng])
      }
    },
    moveend() {
      // Emit exact coordinates on moveend
      const center = map.getCenter()
      const lat = Number(center.lat.toFixed(6))
      const lng = Number(center.lng.toFixed(6))
      onCenterChange(lat, lng)
    }
  })

  // Create markers on mount
  useEffect(() => {
    if (!map || !icon) return

    // Main center marker (red pin)
    const center = map.getCenter()
    const lat = Number(center.lat.toFixed(6))
    const lng = Number(center.lng.toFixed(6))
    
    const marker = L.marker([lat, lng], {
      icon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000
    }).addTo(map)
    markerRef.current = marker
    
    // Optional debug marker (small blue dot exactly at center)
    if (debug) {
      const debugIcon = L.divIcon({
        html: '<div style="width: 4px; height: 4px; background: blue; border-radius: 50%; transform: translate(-50%, -50%)"></div>',
        className: '',
        iconSize: [4, 4]
      })
      const debugMarker = L.marker([lat, lng], {
        icon: debugIcon,
        interactive: false,
        keyboard: false,
        zIndexOffset: 1001
      }).addTo(map)
      debugMarkerRef.current = debugMarker
    }

    if (onInit) onInit(marker)

    return () => {
      marker.remove()
      if (debugMarkerRef.current) {
        debugMarkerRef.current.remove()
      }
    }
  }, [map, icon, debug])

  return null
}

export default function LocationPicker({ initialLat, initialLng, onChange, className, editable = true, onToggleEditable, debug = false, height = 420 }) {
  const defaultLat = 10.776900
  const defaultLng = 106.700980
  const [center, setCenter] = useState(() => {
    if (typeof initialLat === 'number' && typeof initialLng === 'number') {
      return [initialLat, initialLng]
    }
    return [defaultLat, defaultLng]
  })
  
  const mapRef = useRef(null)
  const mapCreatedRef = useRef(false)
  const centerRef = useRef(center)
  const [centerIcon, setCenterIcon] = useState(null)

  useEffect(() => {
    centerRef.current = center
  }, [center])

  // Whenever center state changes, keep the map view in sync
  useEffect(() => {
    if (mapRef.current && Array.isArray(center) && center.length === 2) {
      try { mapRef.current.setView(center, mapRef.current.getZoom(), { animate: false }) } catch {}
    }
  }, [center])

  // enable/disable dragging when editable changes (zoom always disabled)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try {
      if (editable) {
        if (map.dragging && map.dragging.enable) map.dragging.enable()
        map.getContainer().style.cursor = 'grab'
      } else {
        if (map.dragging && map.dragging.disable) map.dragging.disable()
        map.getContainer().style.cursor = 'default'
      }
      // Always disable zoom interactions
      if (map.touchZoom && map.touchZoom.disable) map.touchZoom.disable()
      if (map.scrollWheelZoom && map.scrollWheelZoom.disable) map.scrollWheelZoom.disable()
      if (map.boxZoom && map.boxZoom.disable) map.boxZoom.disable()
      if (map.keyboard && map.keyboard.disable) map.keyboard.disable()
      // Force zoom level
      map.setZoom(18)
    } catch (e) {}
  }, [editable])

  // Create a Leaflet DivIcon from the same SVG we used for the overlay. Using a
  // real Leaflet Marker aligned by iconAnchor guarantees the marker's pixel
  // placement matches Leaflet's internal positioning (more accurate than a
  // separate DOM overlay).
  useEffect(() => {
    try {
      // iconAnchor y slightly above bottom to align pin tip to exact lat/lng
      const svgHtml = `<svg width="28" height="40" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C7.031 0 3 4.031 3 9c0 7.5 9 18 9 18s9-10.5 9-18c0-4.969-4.031-9-9-9z" fill="#ef4444"/><circle cx="12" cy="9" r="3" fill="white" /></svg>`
      const icon = L.divIcon({ className: '', html: svgHtml, iconSize: [28, 40], iconAnchor: [20, 32] })
      setCenterIcon(icon)
    } catch (e) {
      // ignore
    }
  }, [])

  // Update center when props change (fresh coordinates)
  useEffect(() => {
    if (typeof initialLat === 'number' && typeof initialLng === 'number') {
      setCenter([initialLat, initialLng])
      if (mapRef.current) {
        try { mapRef.current.setView([initialLat, initialLng], mapRef.current.getZoom(), { animate: false }) } catch {}
      }
    }
  }, [initialLat, initialLng])

  // stable handler that only updates state when the center meaningfully changes.
  // We ensure coordinates are handled with exact precision (6 decimal places) and
  // adjusted to exact precision.
  const handleCenterChange = useCallback((lat, lng) => {
    const cur = centerRef.current || [0, 0]
    const latDiff = Math.abs((cur[0] || 0) - lat)
    const lngDiff = Math.abs((cur[1] || 0) - lng)
    
    // Only update if change is significant (>0.000001 degree, about 10cm)
    if (latDiff < 0.000001 && lngDiff < 0.000001) return
    
    setCenter([lat, lng]) // Keep original coordinates for map display
    if (editable && onChange) {
      onChange(lat, lng)
    }
    
    // Log both original and adjusted coordinates in debug mode
    if (debug) {
      console.log('Map center:', { lat, lng })
    }
  }, [onChange, debug])

  return (
    <div className={className} style={{ position: 'relative' }}>
      {/* Ensure the leaflet container class is present and touchAction is set so touch/pointer
          events are handled by the map (fixes inability to drag on touch devices / mobiles). */}
      <MapContainer
        center={center}
        zoom={18}
        maxZoom={18}
        minZoom={18}
        zoomControl={false}
        scrollWheelZoom={false}
        touchZoom={false}
        doubleClickZoom={false}
        className="leaflet-container"
        style={{ height, width: '100%', touchAction: 'none', cursor: 'grab' }}
        whenCreated={(map) => {
          mapRef.current = map
          mapCreatedRef.current = true
          // ensure dragging enabled but zoom disabled
          try { 
            if (map.dragging && map.dragging.enable) map.dragging.enable()
            if (map.touchZoom && map.touchZoom.disable) map.touchZoom.disable()
            if (map.scrollWheelZoom && map.scrollWheelZoom.disable) map.scrollWheelZoom.disable()
            if (map.boxZoom && map.boxZoom.disable) map.boxZoom.disable()
            if (map.keyboard && map.keyboard.disable) map.keyboard.disable()
          } catch (e) {}
        }}
      >
        <TileLayer attribution='© OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <CenterTracker 
          onCenterChange={handleCenterChange}
          icon={centerIcon}
          debug={debug} // Add small blue dot for precise center verification
        />
      </MapContainer>

      {/* Dim overlay when locked */}
      {!editable && (
        // block pointer events when locked so the map cannot be dragged/zoomed
        // but allow buttons with higher z-index to still work
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', zIndex: 9998, pointerEvents: 'none', touchAction: 'none' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', touchAction: 'none' }} />
        </div>
      )}
    </div>
  )
}
