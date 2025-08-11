import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MIN_SEARCH_LEN, SEARCH_DEBOUNCE_MS, PAGE_SIZE, SCROLL_BOTTOM_OFFSET } from '@/lib/constants'
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog'
import Image from 'next/image'
import Link from 'next/link'
import { haversineKm } from '@/helper/distance'
import { useAuth } from '@/components/auth-context'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import StoreResultCard from '@/components/store-result-card'
import SelectedStoreItem from '@/components/selected-store-item'

const STORAGE_KEY = 'arrange:selectedStores:v1'
const ORIGIN = { latitude: 21.077358236549987, longitude: 105.69518029931452 }

function getFileNameFromUrl(url) {
  try {
    const marker = '/object/public/stores/'
    const idx = url.indexOf(marker)
    if (idx !== -1) return url.substring(idx + marker.length)
    const u = new URL(url)
    const parts = u.pathname.split('/')
    return parts[parts.length - 1]
  } catch {
    return null
  }
}

function SortableItem({ item, children, render }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  if (render) {
    return (
      <li ref={setNodeRef} style={style} data-dragging={isDragging ? 'true' : 'false'}>
        {render({ attributes, listeners, isDragging })}
      </li>
    )
  }
  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </li>
  )
}

export default function ArrangeStores() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [selected, setSelected] = useState([])
  const [sorting, setSorting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [listCollapsed, setListCollapsed] = useState(false)

  // Distance origin controls
  const [originMode, setOriginMode] = useState('npp') // 'npp' | 'current'
  const [currentPos, setCurrentPos] = useState(null) // { latitude, longitude } | null
  const [locLoading, setLocLoading] = useState(false)
  const [locError, setLocError] = useState(null)

  // Add manual search states (like /store/index.js)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 0, tolerance: 8 } })
  )

  // Load persisted selected list on mount
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setSelected(parsed)
      }
      const collapsed = typeof window !== 'undefined' ? localStorage.getItem('arrange:listCollapsed') : null
      if (collapsed === '1') setListCollapsed(true)
      const savedOrigin = typeof window !== 'undefined' ? localStorage.getItem('arrange:originMode') : null
      if (savedOrigin === 'current' || savedOrigin === 'npp') setOriginMode(savedOrigin)
    } catch (e) {
      console.warn('Cannot load saved route list:', e)
    }
  }, [])

  // Persist selected list whenever it changes (exclude volatile fields)
  useEffect(() => {
    try {
      const toSave = selected.map(({ distance, ...rest }) => rest)
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    } catch (e) {
      console.warn('Cannot save route list:', e)
    }
  }, [selected])

  // Persist collapsed state
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        if (listCollapsed) localStorage.setItem('arrange:listCollapsed', '1')
        else localStorage.removeItem('arrange:listCollapsed')
      }
    } catch {}
  }, [listCollapsed])

  // Persist origin mode
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem('arrange:originMode', originMode)
    } catch {}
  }, [originMode])

  // Resolve origin coordinates
  const originCoords = useMemo(() => {
    if (originMode === 'npp') return ORIGIN
    if (currentPos && typeof currentPos.latitude === 'number' && typeof currentPos.longitude === 'number') return currentPos
    return null
  }, [originMode, currentPos])

  // Acquire current position when needed
  useEffect(() => {
    if (originMode !== 'current') return
    if (currentPos) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocError('Trình duyệt không hỗ trợ vị trí')
      return
    }
    setLocError(null)
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentPos({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        setLocLoading(false)
      },
      () => {
        setLocError('Không lấy được vị trí')
        setLocLoading(false)
      }
    )
  }, [originMode, currentPos])

  // Helper to compute distance to current origin
  function distanceFromOrigin(store) {
    if (!originCoords) return null
    if (typeof store?.latitude !== 'number' || typeof store?.longitude !== 'number') return null
    return haversineKm(originCoords.latitude, originCoords.longitude, store.latitude, store.longitude)
  }

  const addToSelected = useCallback((store) => {
    setSelected((prev) => {
      if (prev.some((s) => s.id === store.id)) return prev
      const withDistance = (store.distance !== undefined)
        ? { ...store, distance: distanceFromOrigin(store) }
        : { ...store, distance: distanceFromOrigin(store) }
      return [...prev, withDistance]
    })
  }, [originCoords, distanceFromOrigin])

  const removeFromSelected = useCallback((id) => {
    setSelected((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const handleNewRoute = useCallback(() => {
    const ok = window.confirm('Bắt đầu lộ trình mới? Danh sách ghé thăm hiện tại sẽ bị xóa.')
    if (!ok) return
    setSelected([])
    try { 
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {}
  }, [])

  // Add back missing sort and drag handlers
  const sortByDistance = useCallback(() => {
    if (!selected.length) return
    const ok = window.confirm('Bạn có chắc muốn tính khoảng cách và sắp xếp lại danh sách? Thứ tự hiện tại sẽ thay đổi.')
    if (!ok) return
    setSorting(true)
    try {
      setSelected((prev) => {
        const withDistance = prev.map((s) => ({ ...s, distance: distanceFromOrigin(s) }))
        withDistance.sort((a, b) => {
          const da = a.distance
          const db = b.distance
          if (da == null && db == null) return 0
          if (da == null) return -1
          if (db == null) return 1
          return da - db
        })
        return withDistance
      })
    } finally {
      setSorting(false)
    }
  }, [selected.length, originCoords, distanceFromOrigin])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSelected((items) => {
      const oldIndex = items.findIndex((s) => s.id === active.id)
      const newIndex = items.findIndex((s) => s.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return items
      return arrayMove(items, oldIndex, newIndex)
    })
  }, [])

  // Find closest store to current position and create route with next 9 stores
  const handleOpenRoute = useCallback(() => {
    if (selected.length === 0) {
      alert('Chưa có cửa hàng nào trong danh sách')
      return
    }

    // Always get current position for route planning
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      alert('Trình duyệt không hỗ trợ vị trí')
      return
    }

    // Show loading state
    const loadingAlert = () => {
      if (window.confirm('Đang lấy vị trí hiện tại...\nBấm OK để tiếp tục hoặc Cancel để hủy')) {
        return true
      }
      return false
    }

    // Get current position for route planning with mobile-friendly options
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const myCurrentPos = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
        
        const validStores = selected.filter(s => 
          typeof s.latitude === 'number' && 
          typeof s.longitude === 'number'
        )

        if (validStores.length === 0) {
          alert('Không có cửa hàng nào có tọa độ để tạo lộ trình')
          return
        }

        // Find closest store to current position
        const storesWithDistance = validStores.map(store => ({
          ...store,
          distanceToMe: haversineKm(myCurrentPos.latitude, myCurrentPos.longitude, store.latitude, store.longitude)
        }))

        // Sort by distance to current position
        storesWithDistance.sort((a, b) => a.distanceToMe - b.distanceToMe)

        // Take closest store as starting point + next 9 stores (total 10)
        const routeStores = storesWithDistance.slice(0, 10)
        const startStore = routeStores[0]
        const remainingStores = routeStores.slice(1)

        let url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving'
        
        // Set origin to closest store
        url += `&origin=${startStore.latitude},${startStore.longitude}`

        // Set destination (last store)
        if (remainingStores.length > 0) {
          const lastStore = remainingStores[remainingStores.length - 1]
          url += `&destination=${lastStore.latitude},${lastStore.longitude}`
          
          // Add waypoints (intermediate stores) - max 9 waypoints
          const waypoints = remainingStores.slice(0, -1) // All except last
          if (waypoints.length > 0) {
            const waypointStr = waypoints.map(s => `${s.latitude},${s.longitude}`).join('|')
            url += `&waypoints=${waypointStr}`
          }
        }

        const distanceM = Math.round(startStore.distanceToMe * 1000)
        const confirmed = window.confirm(
          `Mở lộ trình với ${routeStores.length} cửa hàng?\n\n` +
          `Bắt đầu từ: ${startStore.name} (${distanceM}m từ bạn)`
        )
        
        if (confirmed) {
          // For mobile, try to open in app first, then fallback to web
          if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            // Try Google Maps app first
            const appUrl = url.replace('https://www.google.com/maps/dir/', 'googlemaps://maps.google.com/maps/dir/')
            window.location.href = appUrl
            
            // Fallback to web version after a short delay
            setTimeout(() => {
              window.open(url, '_blank')
            }, 1000)
          } else {
            window.open(url, '_blank')
          }
        }
      },
      (error) => {
        let errorMessage = 'Không lấy được vị trí hiện tại'
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Bạn đã từ chối quyền truy cập vị trí. Vui lòng bật GPS và cho phép truy cập vị trí trong cài đặt trình duyệt.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Không thể xác định vị trí. Vui lòng kiểm tra kết nối mạng và GPS.'
            break
          case error.TIMEOUT:
            errorMessage = 'Hết thời gian chờ. Vui lòng thử lại.'
            break
        }
        
        alert(errorMessage)
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // 15 seconds timeout
        maximumAge: 60000 // Accept cached position up to 1 minute old
      }
    )
  }, [selected])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [search])

  // Fetch one page
  async function fetchResultsPage(keyword, pageNum = 1, append = false) {
    const raw = (keyword || '').trim()
    const q = removeVietnameseTones(raw).toLowerCase()
    const from = (pageNum - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    if (pageNum === 1) setLoading(true); else setLoadingMore(true)

    const { data, error } = await supabase
      .from('stores')
      .select('id,name,address,phone,status,image_url,latitude,longitude,note')
      .ilike('name_search', `%${q}%`)
      .order('status', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (pageNum === 1) setLoading(false); else setLoadingMore(false)

    if (error) {
      console.error('Search error:', error)
      return
    }

    const rows = data || []
    const withDistance = rows.map((s) => ({
      ...s,
      distance: distanceFromOrigin(s),
    }))

    setResults((prev) => (append ? [...prev, ...withDistance] : withDistance))
    setHasMore(rows.length === PAGE_SIZE)
    setPage(pageNum)
  }

  // Reset and fetch first page when keyword changes (same as /store/index.js)
  useEffect(() => {
    const keyword = debouncedSearch
    if (keyword && keyword.length < MIN_SEARCH_LEN) {
      setLoading(false)
      setHasMore(false)
      setPage(1)
      setResults([])
      return
    }
    if (keyword && keyword.length >= MIN_SEARCH_LEN) {
      setPage(1)
      setHasMore(true)
      setResults([])
      fetchResultsPage(keyword, 1, false)
    } else {
      setResults([])
      setHasMore(false)
      setLoading(false)
      setPage(1)
    }
  }, [debouncedSearch, fetchResultsPage])

  // Load more using IntersectionObserver
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return
    if (!debouncedSearch || debouncedSearch.length < MIN_SEARCH_LEN) return

    const loadMoreTrigger = document.getElementById('load-more-trigger')
    if (!loadMoreTrigger) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting) {
          fetchResultsPage(debouncedSearch, page + 1, true)
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    observer.observe(loadMoreTrigger)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, page, debouncedSearch, fetchResultsPage])

  // Ensure selected items update distance when origin changes
  useEffect(() => {
    setSelected((prev) => prev.map((s) => ({ ...s, distance: distanceFromOrigin(s) })))
  }, [originCoords, distanceFromOrigin])

  // Recompute result distances when origin changes
  useEffect(() => {
    setResults((prev) => prev.map((s) => ({ ...s, distance: distanceFromOrigin(s) })))
  }, [originCoords, distanceFromOrigin])

  // Ensure every selected item has a distance value (legacy fill-in)
  useEffect(() => {
    if (!selected.length) return
    if (!selected.some((s) => s.distance === undefined)) return
    setSelected((prev) => prev.map((s) => ({ ...s, distance: distanceFromOrigin(s) })))
  }, [selected, distanceFromOrigin])

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected])

  // Helper to highlight search matches
  const highlightText = useCallback((text, searchTerm) => {
    if (!searchTerm || !text) return text
    const normalizedSearch = removeVietnameseTones(searchTerm.toLowerCase())
    const normalizedText = removeVietnameseTones(text.toLowerCase())
    
    const index = normalizedText.indexOf(normalizedSearch)
    if (index === -1) return text
    
    const beforeMatch = text.slice(0, index)
    const match = text.slice(index, index + searchTerm.length)
    const afterMatch = text.slice(index + searchTerm.length)
    
    return (
      <>
        {beforeMatch}
        <span className="bg-yellow-200 text-yellow-900 dark:bg-yellow-700 dark:text-yellow-100 px-0.5 rounded">
          {match}
        </span>
        {afterMatch}
      </>
    )
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Selected list */}
        <div>
          {/* Header row: title + origin switch */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setListCollapsed((v) => !v)}
              className="group inline-flex items-center gap-2 cursor-pointer"
              aria-expanded={!listCollapsed}
              aria-controls="visit-list"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">DS ghé thăm ({selected.length})</h2>
              <span className="text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300">
                {listCollapsed ? '▶' : '▼'}
              </span>
            </button>

            <div className="flex items-center gap-3">
              <div
                role="group"
                aria-label="Nguồn vị trí"
                className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 p-0.5 text-xs dark:border-gray-800 dark:bg-gray-900"
              >
                <button
                  type="button"
                  aria-pressed={originMode === 'npp'}
                  onClick={() => setOriginMode('npp')}
                  className={`${originMode === 'npp' ? 'bg-white text-emerald-600 shadow dark:bg-gray-800' : 'text-gray-600 dark:text-gray-300'} px-3 py-1 rounded-full`}
                >
                  NPP
                </button>
                <button
                  type="button"
                  aria-pressed={originMode === 'current'}
                  onClick={() => setOriginMode('current')}
                  className={`${originMode === 'current' ? 'bg-white text-emerald-600 shadow dark:bg-gray-800' : 'text-gray-600 dark:text-gray-300'} relative px-3 py-1 rounded-full`}
                >
                  Tôi
                  {originMode === 'current' && (
                    locLoading ? (
                      <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-gray-400 align-middle animate-pulse" />
                    ) : locError ? (
                      <span title={locError} className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />
                    ) : null
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* New route and sort buttons */}
          {!listCollapsed && (
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleNewRoute}>
                  Thêm lộ trình mới
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={sortByDistance} disabled={!selected.length || sorting}>
                  {sorting ? 'Đang sắp xếp...' : 'Sắp xếp'}
                </Button>
                <Button variant="default" size="sm" onClick={handleOpenRoute} disabled={selected.length === 0}>
                  Mở lộ trình thông minh
                </Button>
              </div>
            </div>
          )}

          <div id="visit-list">
            {selected.length === 0 ? (
              <Card><CardContent className="p-4 text-sm text-gray-500 dark:text-gray-400">Chưa có cửa hàng nào trong danh sách</CardContent></Card>
            ) : listCollapsed ? (
              <Card><CardContent className="p-4 text-sm text-gray-500 dark:text-gray-400">Danh sách đang ẩn</CardContent></Card>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={selected.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-2">
                    {selected.map((s) => (
                      <SortableItem
                        key={s.id}
                        item={s}
                        render={({ attributes, listeners }) => (
                          <SelectedStoreItem item={s} dragAttributes={attributes} dragListeners={listeners} onRemove={removeFromSelected} />
                        )}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Search (moved to bottom) */}
        <div className="mt-8 flex items-center gap-3">
          <Input
            type="text"
            placeholder="Tìm theo tên cửa hàng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
          <Button onClick={() => setDebouncedSearch(search.trim())}>Tìm</Button>
        </div>

        {/* Search results */}
        <div className="mt-4 space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="flex items-center justify-between gap-3 p-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-8 w-20" /></CardContent></Card>
            ))
          ) : !debouncedSearch ? (
            <Card><CardContent className="p-4 text-sm text-gray-500 dark:text-gray-400">Nhập từ khóa để tìm cửa hàng</CardContent></Card>
          ) : debouncedSearch.length < MIN_SEARCH_LEN ? (
            <Card><CardContent className="p-4 text-sm text-gray-500 dark:text-gray-400">Nhập tối thiểu {MIN_SEARCH_LEN} ký tự để tìm</CardContent></Card>
          ) : results.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                <div>❌ Không tìm thấy cửa hàng nào</div>
                <Button asChild>
                  <Link href={{ pathname: '/store/create', query: { name: debouncedSearch } }}>
                    Thêm cửa hàng mới
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <ul className="space-y-2">
                {results.map((s) => (
                  <li key={s.id}>
                    <StoreResultCard 
                      store={s} 
                      isSelected={selectedIds.has(s.id)} 
                      onAdd={addToSelected}
                      searchTerm={debouncedSearch}
                      highlightText={highlightText}
                    />
                  </li>
                ))}
              </ul>
              {/* Load more trigger for IntersectionObserver */}
              {hasMore && <div id="load-more-trigger" className="h-1" />}
              <div className="py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                {loadingMore ? 'Đang tải thêm…' : !hasMore ? 'Đã hết' : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
