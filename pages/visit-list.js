import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/components/auth-context'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DetailStoreCard from '@/components/detail-store-card'
import Link from 'next/link'
import LocationSwitch from '@/components/location-switch'
import { haversineKm } from '@/helper/distance'
import { NPP_LOCATION } from '@/lib/constants'

const STORAGE_KEY = 'selectedStores'
const LOCATION_MODE_KEY = 'locationMode'
const USER_LOCATION_KEY = 'userLocation'

function getInitialLocationMode() {
  if (typeof window === 'undefined') return 'npp'
  const saved = localStorage.getItem(LOCATION_MODE_KEY)
  return (saved === 'user' || saved === 'npp') ? saved : 'npp'
}
function getInitialUserLocation() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(USER_LOCATION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') return parsed
  } catch {}
  return null
}

function SortableItem({ item, children, render }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  if (render) {
    return (
      <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-50' : ''}>
        {render(item, attributes, listeners)}
      </div>
    )
  }
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-50' : ''}>
      {children}
    </div>
  )
}

export default function VisitListPage() {
  const { user } = useAuth()
  const [selectedStores, setSelectedStores] = useState([])
  const [isClient, setIsClient] = useState(false)
  const [locationMode, setLocationMode] = useState(getInitialLocationMode()) // For location comparison
  const [userLocation, setUserLocation] = useState(getInitialUserLocation())

  // Get user location
  useEffect(() => {
    if (navigator.geolocation && locationMode === 'user') {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
        },
        (error) => {
          console.error('Error getting location:', error)
          setLocationMode('npp') // Fallback to NPP
        }
      )
    }
  }, [locationMode])

  // Calculate distances based on location mode
  const getReferenceLocation = useCallback(() => {
    if (locationMode === 'user' && userLocation) {
      return userLocation
    }
    return NPP_LOCATION
  }, [locationMode, userLocation])

  // Update distances when location changes
  useEffect(() => {
    if (selectedStores.length > 0) {
      const referenceLocation = getReferenceLocation()
      const updatedStores = selectedStores.map(store => ({
        ...store,
        distance: haversineKm(
          referenceLocation.latitude,
          referenceLocation.longitude,
          store.latitude,
          store.longitude
        )
      }))
      setSelectedStores(updatedStores)
    }
  }, [locationMode, userLocation, getReferenceLocation])

  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor))

  // Load selected stores from localStorage on client-side
  useEffect(() => {
    setIsClient(true)
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setSelectedStores(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to load selected stores:', e)
      }
    }
  }, [])

  // Save to localStorage whenever selectedStores changes and notify navbar
  useEffect(() => {
    if (isClient) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedStores))
      // Dispatch custom event to notify navbar
      window.dispatchEvent(new CustomEvent('selectedStoresUpdated'))
    }
  }, [selectedStores, isClient])

  // Init & sync locationMode across pages (listeners only)
  useEffect(() => {
    const handleModeChanged = (e) => {
      const mode = e.detail?.mode
      if (mode && mode !== locationMode) setLocationMode(mode)
      if (mode === 'user' && !userLocation) {
        const savedLoc = localStorage.getItem(USER_LOCATION_KEY)
        if (savedLoc) {
          try {
            const parsed = JSON.parse(savedLoc)
            if (parsed && typeof parsed.latitude === 'number') setUserLocation(parsed)
          } catch {}
        }
      }
    }
    const handleStorage = (e) => {
      if (e.key === LOCATION_MODE_KEY && (e.newValue === 'user' || e.newValue === 'npp')) {
        setLocationMode(e.newValue)
      }
      if (e.key === USER_LOCATION_KEY && e.newValue && !userLocation) {
        try {
          const parsed = JSON.parse(e.newValue)
          if (parsed && typeof parsed.latitude === 'number') setUserLocation(parsed)
        } catch {}
      }
    }
    window.addEventListener('locationModeChanged', handleModeChanged)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('locationModeChanged', handleModeChanged)
      window.removeEventListener('storage', handleStorage)
    }
  }, [locationMode, userLocation])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      setSelectedStores((stores) => {
        const oldIndex = stores.findIndex((store) => store.id === active.id)
        const newIndex = stores.findIndex((store) => store.id === over.id)
        return arrayMove(stores, oldIndex, newIndex)
      })
    }
  }, [])

  const removeFromSelected = useCallback((storeId) => {
    setSelectedStores(prev => prev.filter(store => store.id !== storeId))
  }, [])

  const clearAll = useCallback(() => {
    if (!window.confirm('Bạn có chắc muốn xóa tất cả cửa hàng đã chọn?')) return
    setSelectedStores([])
  }, [])

  const sortByDistanceNow = useCallback(() => {
    if (!window.confirm('Sắp xếp danh sách theo khoảng cách?')) return
    const referenceLocation = getReferenceLocation()
    setSelectedStores(prev => [...prev].sort((a, b) => {
      const distanceA = haversineKm(
        referenceLocation.latitude,
        referenceLocation.longitude,
        a.latitude,
        a.longitude
      )
      const distanceB = haversineKm(
        referenceLocation.latitude,
        referenceLocation.longitude,
        b.latitude,
        b.longitude
      )
      return distanceA - distanceB
    }))
  }, [getReferenceLocation])

  const handleLocationModeChange = useCallback((mode) => {
    const broadcast = (m, loc) => {
      try {
        localStorage.setItem(LOCATION_MODE_KEY, m)
        if (loc) localStorage.setItem(USER_LOCATION_KEY, JSON.stringify(loc))
      } catch {}
      window.dispatchEvent(new CustomEvent('locationModeChanged', { detail: { mode: m } }))
    }

    if (mode === 'user') {
      if (userLocation) {
        setLocationMode('user')
        broadcast('user', userLocation)
        return
      }
      if (!navigator.geolocation) {
        alert('Thiết bị không hỗ trợ định vị')
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
          setUserLocation(loc)
          setLocationMode('user')
          broadcast('user', loc)
        },
        (err) => {
          console.error('Get location on switch error:', err)
          alert('Không thể lấy được vị trí của bạn')
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    } else {
      setLocationMode('npp')
      broadcast('npp')
    }
  }, [userLocation])

  const visitListCount = selectedStores.length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="px-3 sm:px-4 py-4 sm:py-6 space-y-3 max-w-screen-md mx-auto">
        {/* Location Switch - Top Right */}
        <div className="flex justify-end">
          <LocationSwitch 
            locationMode={locationMode}
            onLocationModeChange={handleLocationModeChange}
          />
        </div>

        {/* Header Actions */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              Cửa hàng đã chọn ({visitListCount})
            </h2>
            {visitListCount > 0 && (
              <Button onClick={clearAll} variant="destructive" size="sm" className="text-xs sm:text-sm">
                Xóa tất cả
              </Button>
            )}
          </div>
          
          {visitListCount > 0 && (
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={sortByDistanceNow}
                className="text-xs sm:text-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Sắp xếp theo khoảng cách
              </Button>
            </div>
          )}
        </div>

        {/* Visit List */}
        <div className="space-y-4">
          {selectedStores.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10 sm:py-12 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Chưa có cửa hàng nào
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md">
                  Hãy thêm cửa hàng vào danh sách ghé thăm từ trang tìm kiếm
                </p>
                <Button asChild>
                  <Link href="/">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Tìm kiếm cửa hàng
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={selectedStores} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {selectedStores.map((store) => {
                    const referenceLocation = getReferenceLocation()
                    const storeWithDistance = {
                      ...store,
                      distance: haversineKm(
                        referenceLocation.latitude,
                        referenceLocation.longitude,
                        store.latitude,
                        store.longitude
                      )
                    }
                    return (
                      <div key={store.id} className="flex-1">
                        <SortableItem 
                          item={store}
                          render={(item, dragAttributes, dragListeners) => (
                            <DetailStoreCard 
                              item={storeWithDistance}
                              dragAttributes={dragAttributes}
                              dragListeners={dragListeners}
                              onRemove={removeFromSelected}
                            />
                          )}
                        />
                      </div>
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  )
}
