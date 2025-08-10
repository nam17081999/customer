import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const [selected, setSelected] = useState([])
  const [sorting, setSorting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [listCollapsed, setListCollapsed] = useState(false)

  const lastKeyRef = useRef('')
  const dragIndexRef = useRef(null)

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

  function handleNewRoute() {
    const ok = window.confirm('Bắt đầu lộ trình mới? Danh sách ghé thăm hiện tại sẽ bị xóa.')
    if (!ok) return
    setSelected([])
    try { if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY) } catch {}
  }

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [search])

  // Fetch page helper
  async function fetchResultsPage(keyword, pageNum = 1, append = false) {
    const raw = (keyword || '').trim()
    const q = removeVietnameseTones(raw).toLowerCase()
    const from = (pageNum - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    if (pageNum === 1) setLoading(true); else setLoadingMore(true)

    lastKeyRef.current = `${q}|${pageNum}`

    const { data, error } = await supabase
      .from('stores')
      .select('id,name,address,phone,status,image_url,latitude,longitude,note')
      .ilike('name_search', `%${q}%`)
      .order('status', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (pageNum === 1) setLoading(false); else setLoadingMore(false)

    if (lastKeyRef.current !== `${q}|${pageNum}`) return

    if (error) {
      console.error('Search error:', error)
      return
    }
    const rows = (data || [])
    const myLat = ORIGIN.latitude
    const myLon = ORIGIN.longitude
    const withDistance = rows.map((s) =>
      (typeof s.latitude === 'number' && typeof s.longitude === 'number')
        ? { ...s, distance: haversineKm(myLat, myLon, s.latitude, s.longitude) }
        : { ...s, distance: null }
    )
    setResults((prev) => (append ? [...prev, ...withDistance] : withDistance))
    setHasMore(rows.length === PAGE_SIZE)
    setPage(pageNum)
  }

  // Reset and fetch first page when keyword changes
  useEffect(() => {
    const keyword = debouncedSearch
    if (!keyword) {
      setResults([])
      setHasMore(false)
      setLoading(false)
      setPage(1)
      return
    }
    if (keyword.length < MIN_SEARCH_LEN) {
      setResults([])
      setHasMore(false)
      setLoading(false)
      setPage(1)
      return
    }
    setResults([])
    setHasMore(true)
    fetchResultsPage(keyword, 1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  // Load more on scroll (for search results at bottom)
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

  function addToSelected(store) {
    setSelected((prev) => {
      if (prev.some((s) => s.id === store.id)) return prev
      const myLat = ORIGIN.latitude
      const myLon = ORIGIN.longitude
      const withDistance = (store.distance !== undefined)
        ? store
        : (typeof store.latitude === 'number' && typeof store.longitude === 'number')
          ? { ...store, distance: haversineKm(myLat, myLon, store.latitude, store.longitude) }
          : { ...store, distance: null }
      return [...prev, withDistance]
    })
  }

  function removeFromSelected(id) {
    setSelected((prev) => prev.filter((s) => s.id !== id))
  }

  async function deleteStore(store) {
    if (!user) {
      alert('Vui lòng đăng nhập để xóa cửa hàng')
      return
    }
    const ok = window.confirm(`Bạn có chắc muốn xóa cửa hàng "${store.name}"?`)
    if (!ok) return
    try {
      setDeletingId(store.id)
      const { error: delErr } = await supabase.from('stores').delete().eq('id', store.id)
      if (delErr) throw delErr
      if (store.image_url) {
        const file = getFileNameFromUrl(store.image_url)
        if (file) await supabase.storage.from('stores').remove([file])
      }
      setResults((prev) => prev.filter((s) => s.id !== store.id))
      setSelected((prev) => prev.filter((s) => s.id !== store.id))
    } catch (err) {
      console.error(err)
      alert('Xóa thất bại')
    } finally {
      setDeletingId(null)
    }
  }

  async function sortByDistance() {
    if (!selected.length) return

    // Ask for user confirmation before proceeding
    const ok = window.confirm('Bạn có chắc muốn tính khoảng cách và sắp xếp lại danh sách? Thứ tự hiện tại sẽ thay đổi.')
    if (!ok) return

    const myLat = ORIGIN.latitude
    const myLon = ORIGIN.longitude

    setSorting(true)
    try {
      const withDistance = selected.map((s) => {
        if (typeof s.latitude === 'number' && typeof s.longitude === 'number') {
          const d = haversineKm(myLat, myLon, s.latitude, s.longitude)
          return { ...s, distance: d }
        }
        return { ...s, distance: null }
      })

      withDistance.sort((a, b) => {
        const da = a.distance
        const db = b.distance
        if (da == null && db == null) return 0
        if (da == null) return -1
        if (db == null) return 1
        return da - db
      })

      setSelected(withDistance)
    } finally {
      setSorting(false)
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = selected.findIndex((s) => s.id === active.id)
    const newIndex = selected.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    setSelected((items) => arrayMove(items, oldIndex, newIndex))
  }

  // Drag and drop handlers for selected list
  function onDragStart(e, index) {
    dragIndexRef.current = index
  }
  function onDragOver(e) {
    e.preventDefault()
  }
  function onDrop(e, dropIndex) {
    e.preventDefault()
    const from = dragIndexRef.current
    if (from == null || from === dropIndex) return
    setSelected((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(dropIndex, 0, moved)
      return next
    })
    dragIndexRef.current = null
  }

  // Ensure every selected item has a distance value (number or null)
  useEffect(() => {
    if (!selected.length) return
    if (!selected.some((s) => s.distance === undefined)) return
    const myLat = ORIGIN.latitude
    const myLon = ORIGIN.longitude
    setSelected((prev) => prev.map((s) => {
      if (s.distance !== undefined) return s
      if (typeof s.latitude === 'number' && typeof s.longitude === 'number') {
        return { ...s, distance: haversineKm(myLat, myLon, s.latitude, s.longitude) }
      }
      return { ...s, distance: null }
    }))
  }, [selected])

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Sắp xếp lộ trình giao hàng</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Thêm các cửa hàng vào danh sách, sắp xếp theo khoảng cách hoặc kéo-thả để đổi thứ tự.</p>

        {/* Selected list */}
        <div className="mt-6">
          <div className="mb-2">
            <Button variant="outline" size="sm" onClick={handleNewRoute}>
              Thêm lộ trình mới
            </Button>
          </div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Danh sách ghé thăm ({selected.length})</h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setListCollapsed((v) => !v)}>
                {listCollapsed ? 'Hiện danh sách' : 'Ẩn danh sách'}
              </Button>
              <Button variant="outline" size="sm" onClick={sortByDistance} disabled={!selected.length || sorting}>
                {sorting ? 'Đang sắp xếp...' : 'Sắp xếp'}
              </Button>
            </div>
          </div>

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
                        s.image_url ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Card className="cursor-zoom-in">
                                <CardContent className="flex items-center gap-3 p-3">
                                  {/* Drag handle */}
                                  <button
                                    type="button"
                                    aria-label="Kéo để sắp xếp"
                                    {...attributes}
                                    {...listeners}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex h-8 shrink-0 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none select-none opacity-70 hover:opacity-100 focus:outline-none focus:ring-0"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                      <path d="M7 5a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM7 15a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                  </button>

                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</div>
                                    <div className="truncate text-xs text-gray-600 dark:text-gray-400">{s.address}</div>
                                    {typeof s.distance === 'number' ? (
                                      <div className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">Khoảng cách: {s.distance.toFixed(1)} km</div>
                                    ) : s.distance === null ? (
                                      <div className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">Khoảng cách: Không xác định</div>
                                    ) : null}
                                  </div>
                                  <div className="ml-auto flex items-center gap-2">
                                    {typeof s.latitude === 'number' && typeof s.longitude === 'number' && (
                                      <Button asChild size="sm" variant="secondary" onClick={(e) => e.stopPropagation()}>
                                        <a
                                          href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}&travelmode=driving`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          Maps
                                        </a>
                                      </Button>
                                    )}
                                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); removeFromSelected(s.id); }}>
                                      Bỏ
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            </DialogTrigger>
                            <DialogContent className="overflow-hidden p-0">
                              <DialogClose asChild>
                                <Image
                                  src={s.image_url}
                                  alt={s.name}
                                  width={800}
                                  height={800}
                                  title="Bấm vào ảnh để đóng"
                                  draggable={false}
                                  className="max-h-[80vh] w-auto cursor-zoom-out object-contain"
                                />
                              </DialogClose>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <Card>
                            <CardContent className="flex items-center gap-3 p-3">
                              {/* Drag handle */}
                              <button
                                type="button"
                                aria-label="Kéo để sắp xếp"
                                {...attributes}
                                {...listeners}
                                className="flex h-8 shrink-0 items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none select-none opacity-70 hover:opacity-100 focus:outline-none focus:ring-0"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                  <path d="M7 5a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM7 15a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</div>
                                <div className="truncate text-xs text-gray-600 dark:text-gray-400">{s.address}</div>
                                {typeof s.distance === 'number' ? (
                                  <div className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">Khoảng cách: {s.distance.toFixed(1)} km</div>
                                ) : s.distance === null ? (
                                  <div className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">Khoảng cách: Không xác định</div>
                                ) : null}
                              </div>
                              <div className="ml-auto flex items-center gap-2">
                                {typeof s.latitude === 'number' && typeof s.longitude === 'number' && (
                                  <Button asChild size="sm" variant="secondary">
                                    <a
                                      href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}&travelmode=driving`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Maps
                                    </a>
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => removeFromSelected(s.id)}>
                                  Bỏ
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      )}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
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
                    {s.image_url ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Card className="cursor-zoom-in" onClick={(e) => e.stopPropagation()}>
                            <CardContent className="flex items-center gap-4 p-3">
                              {/* Thumbnail (no inner dialog now) */}
                              <Image
                                src={s.image_url}
                                alt={s.name}
                                width={64}
                                height={64}
                                sizes="64px"
                                quality={70}
                                className="h-16 w-16 rounded object-cover ring-1 ring-gray-200 dark:ring-gray-800"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col items-start gap-1">
                                  <span
                                    className={`shrink-0 rounded px-2 py-0.5 text-xs ${s.status ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
                                  >
                                    {s.status ? 'Đã xác thực' : 'Chưa xác thực'}
                                  </span>
                                  <h3 className="text-lg font-semibold leading-snug text-gray-900 dark:text-gray-100 break-words">
                                    <span className="block">Cửa hàng: {s.name}</span>
                                  </h3>
                                </div>
                                <p className="truncate text-sm text-gray-600 dark:text-gray-400">Địa chỉ: {s.address}</p>
                                {s.phone && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400">Số điện thoại: {s.phone}</p>
                                )}
                                {s.note && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400">Ghi chú: {s.note}</p>
                                )}
                                {typeof s.distance === 'number' ? (
                                  <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">Khoảng cách: {s.distance.toFixed(1)} km</p>
                                ) : (
                                  <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">Khoảng cách: Không xác định</p>
                                )}
                                <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  {typeof s.latitude === 'number' && typeof s.longitude === 'number' && (
                                    <Button asChild variant="secondary" size="sm">
                                      <a
                                        href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}&travelmode=driving`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Maps
                                      </a>
                                    </Button>
                                  )}
                                  <span className="ml-auto">
                                    {selectedIds.has(s.id) ? (
                                      <Button size="sm" variant="secondary" disabled onClick={(e) => e.stopPropagation()}>
                                        Đã thêm
                                      </Button>
                                    ) : (
                                      <Button size="sm" onClick={(e) => { e.stopPropagation(); addToSelected(s); }}>
                                        Thêm
                                      </Button>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </DialogTrigger>
                        <DialogContent className="overflow-hidden p-0">
                          <DialogClose asChild>
                            <Image
                              src={s.image_url}
                              alt={s.name}
                              width={800}
                              height={800}
                              title="Bấm vào ảnh để đóng"
                              draggable={false}
                              className="max-h-[80vh] w-auto cursor-zoom-out object-contain"
                            />
                          </DialogClose>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <Card>
                        <CardContent className="flex items-center gap-4 p-3">
                          <div className="flex h-16 w-16 items-center justify-center rounded bg-gray-100 text-gray-400 ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-800">
                            🏬
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`shrink-0 rounded px-2 py-0.5 text-xs ${s.status ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
                              >
                                {s.status ? 'Đã xác thực' : 'Chưa xác thực'}
                              </span>
                              <h3 className="text-lg font-semibold leading-snug text-gray-900 dark:text-gray-100 break-words">
                                <span className="block">Cửa hàng: {s.name}</span>
                              </h3>
                            </div>
                            <p className="truncate text-sm text-gray-600 dark:text-gray-400">Địa chỉ: {s.address}</p>
                            {s.phone && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">Số điện thoại: {s.phone}</p>
                            )}
                            {s.note && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">Ghi chú: {s.note}</p>
                            )}
                            {typeof s.distance === 'number' ? (
                              <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">Khoảng cách: {s.distance.toFixed(1)} km</p>
                            ) : (
                              <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">Khoảng cách: Không xác định</p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {typeof s.latitude === 'number' && typeof s.longitude === 'number' && (
                                <Button asChild variant="secondary" size="sm">
                                  <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}&travelmode=driving`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Maps
                                  </a>
                                </Button>
                              )}
                              <span className="ml-auto">
                                {selectedIds.has(s.id) ? (
                                  <Button size="sm" variant="secondary" disabled>
                                    Đã thêm
                                  </Button>
                                ) : (
                                  <Button size="sm" onClick={() => addToSelected(s)}>
                                    Thêm
                                  </Button>
                                )}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
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
