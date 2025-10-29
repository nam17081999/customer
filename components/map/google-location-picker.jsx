import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useLoadScript, GoogleMap } from '@react-google-maps/api'

// A lightweight Google Maps location picker that mirrors the center-overlay UX.
// Props: initialLat, initialLng, onChange(lat,lng), editable (boolean), className, onToggleEditable
export default function GoogleLocationPicker({ initialLat, initialLng, onChange, editable = true, className, onToggleEditable }) {
  const defaultCenter = { lat: initialLat || 10.7769, lng: initialLng || 106.70098 }
  const [center, setCenter] = useState(defaultCenter)
  const mapRef = useRef(null)
  const centerRef = useRef(center)

  useEffect(() => { centerRef.current = center }, [center])

  useEffect(() => {
    if (initialLat && initialLng) {
      const c = { lat: initialLat, lng: initialLng }
      setCenter(c)
      if (mapRef.current) {
        try { mapRef.current.panTo(c) } catch (e) {}
      }
    }
  }, [initialLat, initialLng])

  const libs = ['places']
  const apiKey = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY : undefined
  const { isLoaded, loadError } = useLoadScript({ googleMapsApiKey: apiKey, libraries: libs })

  const onMapLoad = useCallback((map) => {
    mapRef.current = map
  }, [])

  // Emit center updates on idle (after move/zoom) when editable
  const onIdle = useCallback(() => {
    if (!mapRef.current) return
    const c = mapRef.current.getCenter()
    if (!c) return
    const lat = c.lat()
    const lng = c.lng()
    setCenter({ lat, lng })
    if (editable && onChange) onChange(lat, lng)
  }, [editable, onChange])

  if (loadError) return <div>Không tải được bản đồ Google</div>
  if (!isLoaded) return <div>Đang nạp bản đồ…</div>

  return (
    <div className={className} style={{ position: 'relative' }}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: 320 }}
        center={center}
        zoom={16}
        options={{
          disableDefaultUI: true,
          gestureHandling: editable ? 'greedy' : 'none',
          draggable: !!editable,
          clickableIcons: false,
        }}
        onLoad={onMapLoad}
        onIdle={onIdle}
      >
        {/* Intentionally empty children — we rely on center overlay */}
      </GoogleMap>

      {/* dim overlay when locked - blocks interactions */}
      {!editable && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', zIndex: 9998, pointerEvents: 'auto', touchAction: 'none' }} />
      )}

      {/* Center pin overlay */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', pointerEvents: 'none', zIndex: 9999 }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-100%)' }}>
          <svg width="28" height="40" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C7.031 0 3 4.031 3 9c0 7.5 9 18 9 18s9-10.5 9-18c0-4.969-4.031-9-9-9z" fill="#ef4444"/>
            <circle cx="12" cy="9" r="3" fill="white" />
          </svg>
        </div>
      </div>

      {/* lock/unlock icon overlay */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (onToggleEditable) onToggleEditable() }}
        aria-label={editable ? 'Khóa bản đồ' : 'Mở khóa bản đồ'}
        style={{ position: 'absolute', right: 10, top: 10, zIndex: 10010, background: 'white', borderRadius: 8, padding: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.2)', border: 'none', cursor: 'pointer' }}
      >
        {/* black outline lock/unlock - same as leaflet version */}
        {editable ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="10" width="16" height="10" rx="2" fill="none" stroke="black" strokeWidth="1.8" />
            <path d="M8 10V7a4 4 0 018 0v3" fill="none" stroke="black" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="10" width="16" height="10" rx="2" fill="none" stroke="black" strokeWidth="1.8" />
            <path d="M16 10c0-2.2-1.8-4-4-4-1.5 0-2.8.8-3.5 2" fill="none" stroke="black" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9.5 14h5" fill="none" stroke="black" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div style={{ position: 'absolute', right: 8, bottom: 8 }}>
        <div className="bg-white/90 rounded shadow p-1 text-xs">
          {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
        </div>
      </div>
    </div>
  )
}
