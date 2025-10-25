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
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog'

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
  const [loading, setLoading] = useState(false)
  const [locationMode, setLocationMode] = useState(getInitialLocationMode()) // For location comparison
  const [userLocation, setUserLocation] = useState(getInitialUserLocation())
  const [routeDialogOpen, setRouteDialogOpen] = useState(false)

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

  // Thuật toán tối ưu quãng đường
  function haversineKmPrecise(lat1, lng1, lat2, lng2) {
    const R = 6371 // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  function nearestNeighbor(points, startIdx = 0) {
    const n = points.length
    const used = new Array(n).fill(false)
    const order = [startIdx]
    used[startIdx] = true
    
    for (let i = 1; i < n; i++) {
      const last = order[order.length - 1]
      let bestNext = -1
      let bestDist = Infinity
      
      for (let j = 0; j < n; j++) {
        if (!used[j]) {
          const dist = haversineKmPrecise(
            points[last].latitude,
            points[last].longitude,
            points[j].latitude,
            points[j].longitude
          )
          if (dist < bestDist) {
            bestDist = dist
            bestNext = j
          }
        }
      }
      
      used[bestNext] = true
      order.push(bestNext)
    }
    
    return order
  }

  function twoOpt(points, order) {
    let improved = true
    while (improved) {
      improved = false
      
      for (let i = 1; i < order.length - 2; i++) {
        for (let j = i + 1; j < order.length - 1; j++) {
          // Tính độ dài trước khi đổi
          const d1 = haversineKmPrecise(
            points[order[i-1]].latitude,
            points[order[i-1]].longitude,
            points[order[i]].latitude,
            points[order[i]].longitude
          )
          const d2 = haversineKmPrecise(
            points[order[j]].latitude,
            points[order[j]].longitude,
            points[order[j+1]].latitude,
            points[order[j+1]].longitude
          )
          
          // Tính độ dài sau khi đổi
          const d3 = haversineKmPrecise(
            points[order[i-1]].latitude,
            points[order[i-1]].longitude,
            points[order[j]].latitude,
            points[order[j]].longitude
          )
          const d4 = haversineKmPrecise(
            points[order[i]].latitude,
            points[order[i]].longitude,
            points[order[j+1]].latitude,
            points[order[j+1]].longitude
          )
          
          // Nếu đổi cho kết quả tốt hơn
          if (d1 + d2 > d3 + d4 + 0.001) { // threshold 1m để tránh floating point
            // Đảo ngược đoạn từ i đến j
            const reversed = order.slice(i, j + 1).reverse()
            order.splice(i, j - i + 1, ...reversed)
            improved = true
          }
        }
      }
    }
    return order
  }

  const callOSRMTrip = async (coordinates) => {
    try {
      // Format: longitude,latitude for OSRM
      const formatCoords = coords => `${coords[0]},${coords[1]}`
      
      // Prepare coordinates array including NPP
      const allCoords = [
        [NPP_LOCATION.longitude, NPP_LOCATION.latitude],
        ...coordinates.map(store => [store.longitude, store.latitude])
      ]
      
      // Build OSRM API URL
      // source=first: start from NPP
      // destination=last: end at last point
      // annotations=true: get detailed info
      const coordsStr = allCoords.map(formatCoords).join(';')
      const url = `https://router.project-osrm.org/trip/v1/driving/${coordsStr}?source=first&roundtrip=false&annotations=true`
      
      const response = await fetch(url)
      if (!response.ok) throw new Error('OSRM request failed')
      
      const data = await response.json()
      if (data.code !== 'Ok') throw new Error(data.message || 'OSRM error')
      
      // Get the waypoint order (skip first point which is NPP)
      const order = data.waypoints
        .sort((a, b) => a.waypoint_index - b.waypoint_index)
        .map(w => w.waypoint_index)
        .filter(idx => idx > 0)
        .map(idx => idx - 1) // Adjust index since we remove NPP
      
      // Get total distance in km
      const totalDistance = data.trips[0].distance / 1000
      
      return { order, totalDistance }
    } catch (error) {
      console.error('OSRM error:', error)
      return null
    }
  }

  const optimizeRoute = useCallback(async () => {
    if (!window.confirm('Tối ưu thứ tự ghé thăm để giảm quãng đường?')) return

    // Lọc các điểm có tọa độ hợp lệ
    const validStores = selectedStores.filter(
      store => typeof store.latitude === 'number' && typeof store.longitude === 'number'
    )

    if (validStores.length < 2) {
      alert('Cần ít nhất 2 điểm có tọa độ để tối ưu quãng đường')
      return
    }

    try {
      // Gọi OSRM Trip API
      const result = await callOSRMTrip(validStores)
      
      if (result) {
        // Sắp xếp theo thứ tự OSRM trả về
        const optimizedStores = result.order.map(idx => validStores[idx])
        
        // Thêm các điểm không có tọa độ vào cuối
        const invalidStores = selectedStores.filter(
          store => typeof store.latitude !== 'number' || typeof store.longitude !== 'number'
        )
        
        // Cập nhật danh sách
        setSelectedStores([...optimizedStores, ...invalidStores])
        
        alert(`Đã tối ưu quãng đường!\nTổng quãng đường (đường bộ): ${result.totalDistance.toFixed(1)}km`)
      } else {
        // Fallback to offline algorithm if OSRM fails
        const startIdx = 0 // Start with first store
        let order = nearestNeighbor(validStores, startIdx)
        order = twoOpt(validStores, order)
        
        const optimizedStores = order.map(idx => validStores[idx])
        const invalidStores = selectedStores.filter(
          store => typeof store.latitude !== 'number' || typeof store.longitude !== 'number'
        )
        
        setSelectedStores([...optimizedStores, ...invalidStores])
        alert('Không thể kết nối tới OSRM, đã dùng thuật toán offline để tối ưu')
      }
    } catch (error) {
      console.error('Route optimization error:', error)
      alert('Có lỗi khi tối ưu quãng đường, vui lòng thử lại sau')
    }
  }, [selectedStores])

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

  const openRouteAir = useCallback(() => {
    try {
      const coords = []
      // First point: NPP
      coords.push([NPP_LOCATION.longitude, NPP_LOCATION.latitude])
      // Then selected stores in current order (valid coords only)
      selectedStores.forEach(s => {
        if (typeof s.latitude === 'number' && typeof s.longitude === 'number') {
          coords.push([s.longitude, s.latitude])
        }
      })
      if (coords.length < 2) {
        alert('Chưa đủ dữ liệu tọa độ để vẽ quãng đường')
        return
      }
      const features = [
        {
          type: 'Feature',
          properties: { name: 'Tuyến ghé thăm (đường chim bay)' },
          geometry: { type: 'LineString', coordinates: coords }
        },
        // Markers
        {
          type: 'Feature',
          properties: { name: 'Nhà phân phối (điểm đầu)' },
          geometry: { type: 'Point', coordinates: coords[0] }
        },
        ...coords.slice(1).map((c, idx) => ({
          type: 'Feature',
          properties: { name: `Điểm ${idx + 1}` },
          geometry: { type: 'Point', coordinates: c }
        }))
      ]
      const fc = { type: 'FeatureCollection', features }
      const url = `https://geojson.io/#data=data:application/json,${encodeURIComponent(JSON.stringify(fc))}`
      window.open(url, '_blank')
    } catch (e) {
      console.error('Open route air view error', e)
      alert('Không thể mở bản đồ quãng đường (chim bay)')
    }
  }, [selectedStores])

  const openRouteRoad = useCallback(() => {
    try {
      const stops = selectedStores
        .filter(s => typeof s.latitude === 'number' && typeof s.longitude === 'number')
        .map(s => ({ lat: s.latitude, lng: s.longitude }))

      if (stops.length === 0) {
        alert('Chưa đủ dữ liệu tọa độ để vẽ quãng đường')
        return
      }

      const origin = `${NPP_LOCATION.latitude},${NPP_LOCATION.longitude}`
      const MAX_WAYPOINTS = 23 // số điểm trung gian tối đa (không tính điểm đầu và cuối) cho URL Google Maps
      const destination = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`
      const waypointCount = Math.min(stops.length - 1, MAX_WAYPOINTS)
      const waypointsList = waypointCount > 0
        ? stops.slice(0, waypointCount).map(p => `${p.lat},${p.lng}`)
        : []
      const waypointsParam = waypointsList.length
        ? `&waypoints=${encodeURIComponent(waypointsList.join('|'))}`
        : ''

      if (stops.length - 1 > MAX_WAYPOINTS) {
        alert(`Chỉ hiển thị ${MAX_WAYPOINTS + 1} điểm dừng đầu tiên trên Google Maps (giới hạn).`)
      }

      const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypointsParam}&travelmode=driving`
      window.open(url, '_blank')
    } catch (e) {
      console.error('Open route road view error', e)
      alert('Không thể mở bản đồ quãng đường (đường bộ)')
    }
  }, [selectedStores])

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
                onClick={() => {
                  setLoading(true)
                  optimizeRoute().finally(() => setLoading(false))
                }}
                disabled={loading}
                className="text-xs sm:text-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {loading ? 'Đang tối ưu...' : 'Tối ưu quãng đường'}
              </Button>

              <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs sm:text-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7l6 4 6-4 6 4M3 12l6 4 6-4 6 4M3 17l6 4 6-4 6 4" />
                    </svg>
                    Xem quãng đường
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <div className="p-2">
                    <div className="text-sm font-medium mb-3 text-gray-900 dark:text-gray-100">Chọn cách xem quãng đường</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button
                        onClick={() => { openRouteRoad(); setRouteDialogOpen(false) }}
                        className="h-10"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" />
                        </svg>
                        Đường bộ (Google Maps)
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { openRouteAir(); setRouteDialogOpen(false) }}
                        className="h-10"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7l6 4 6-4 6 4M3 12l6 4 6-4 6 4M3 17l6 4 6-4 6 4" />
                        </svg>
                        Chim bay (GeoJSON)
                      </Button>
                    </div>
                    <DialogClose asChild>
                      <Button variant="outline" className="w-full mt-3">Đóng</Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
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
