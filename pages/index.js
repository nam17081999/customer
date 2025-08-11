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
  }, [originCoords])

  const removeFromSelected = useCallback((id) => {
    setSelected((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const handleNewRoute = useCallback(() => {
    const ok = window.confirm('Bắt đầu lộ trình mới? Danh sách ghé thăm hiện tại sẽ bị xóa.')
    if (!ok) return
    setSelected([])
    try { if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY) } catch {}
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
  }, [selected.length, originCoords])

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
  }, [debouncedSearch])

  // Load more on scroll
  useEffect(() => {
    function onScroll() {
      if (!hasMore || loading || loadingMore) return
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - SCROLL_BOTTOM_OFFSET) {
        if (debouncedSearch && debouncedSearch.length >= MIN_SEARCH_LEN) {
          fetchResultsPage(debouncedSearch, page + 1, true)
        }
      }
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [hasMore, loading, loadingMore, page, debouncedSearch])

  // Ensure selected items update distance when origin changes
  useEffect(() => {
    setSelected((prev) => prev.map((s) => ({ ...s, distance: distanceFromOrigin(s) })))
  }, [originCoords])

  // Recompute result distances when origin changes
  useEffect(() => {
    setResults((prev) => prev.map((s) => ({ ...s, distance: distanceFromOrigin(s) })))
  }, [originCoords])

  // Ensure every selected item has a distance value (legacy fill-in)
  useEffect(() => {
    if (!selected.length) return
    if (!selected.some((s) => s.distance === undefined)) return
    setSelected((prev) => prev.map((s) => ({ ...s, distance: distanceFromOrigin(s) })))
  }, [selected])

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected])

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
              <Button variant="outline" size="sm" onClick={handleNewRoute}>
                Thêm lộ trình mới
              </Button>
              <Button variant="outline" size="sm" onClick={sortByDistance} disabled={!selected.length || sorting}>
                {sorting ? 'Đang sắp xếp...' : 'Sắp xếp'}
              </Button>
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
                    <StoreResultCard store={s} isSelected={selectedIds.has(s.id)} onAdd={addToSelected} />
                  </li>
                ))}
              </ul>
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
