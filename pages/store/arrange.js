import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MIN_SEARCH_LEN, SEARCH_DEBOUNCE_MS, PAGE_SIZE } from '@/lib/constants'
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog'
import Image from 'next/image'
import Link from 'next/link'
import { haversineKm } from '@/helper/distance'

const STORAGE_KEY = 'arrange:selectedStores:v1'
const ORIGIN = { latitude: 21.077358236549987, longitude: 105.69518029931452 }

export default function ArrangeStores() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])

  const [selected, setSelected] = useState([]) // [{id, name, address, latitude, longitude, distance?}]
  const [sorting, setSorting] = useState(false)

  // Load persisted selected list on mount
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setSelected(parsed)
      }
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

  // Fetch search results
  useEffect(() => {
    const keyword = debouncedSearch
    if (!keyword) {
      setResults([])
      setLoading(false)
      return
    }
    if (keyword.length < MIN_SEARCH_LEN) {
      setResults([])
      setLoading(false)
      return
    }

    async function run() {
      try {
        setLoading(true)
        const q = removeVietnameseTones(keyword).toLowerCase()
        const { data, error } = await supabase
          .from('stores')
          .select('id,name,address,phone,status,image_url,latitude,longitude,note')
          .ilike('name_search', `%${q}%`)
          .order('status', { ascending: false })
          .order('id', { ascending: false })
          .limit(PAGE_SIZE)
        if (error) throw error
        setResults(data || [])
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [debouncedSearch])

  function addToSelected(store) {
    setSelected((prev) => {
      if (prev.some((s) => s.id === store.id)) return prev
      return [...prev, store]
    })
  }

  function removeFromSelected(id) {
    setSelected((prev) => prev.filter((s) => s.id !== id))
  }

  async function sortByDistance() {
    if (!selected.length) return

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

      // Sort: unknown distance first, then valid distances ascending
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

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Sắp xếp lộ trình giao hàng</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tìm và thêm các cửa hàng vào danh sách, sau đó tính khoảng cách từ vị trí của bạn để sắp xếp từ gần đến xa.</p>

        {/* Search */}
        <div className="mt-6 flex items-center gap-3">
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
            <Card><CardContent className="p-4 text-sm text-gray-500 dark:text-gray-400">Không tìm thấy cửa hàng nào</CardContent></Card>
          ) : (
            <ul className="space-y-2">
              {results.map((s) => (
                <li key={s.id}>
                  <Card>
                    <CardContent className="flex items-center gap-4 p-3">
                      {s.image_url ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Image
                              src={s.image_url}
                              alt={s.name}
                              width={64}
                              height={64}
                              sizes="64px"
                              quality={70}
                              className="h-16 w-16 cursor-zoom-in rounded object-cover ring-1 ring-gray-200 transition hover:opacity-90 dark:ring-gray-800"
                            />
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
                        <div className="flex h-16 w-16 items-center justify-center rounded bg-gray-100 text-gray-400 ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-800">
                          🏬
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`shrink-0 rounded px-2 py-0.5 text-xs ${s.status ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
                          >
                            {s.status ? 'Đã xác thực' : 'Chưa xác thực'}
                          </span>
                          <h3 className="text-lg font-semibold leading-snug text-gray-900 dark:text-gray-100 break-words">
                            <Link href={`/store/${s.id}`} className="block hover:underline">Cửa hàng: {s.name}</Link>
                          </h3>
                        </div>
                        <p className="truncate text-sm text-gray-600 dark:text-gray-400">
                          Địa chỉ: {s.address}
                        </p>
                        {s.phone && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Số điện thoại:{' '}
                            <a
                              href={`tel:${(s.phone || '').replace(/[^+\d]/g, '')}`}
                              className="inline-flex items-center rounded-sm font-medium text-emerald-600 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:text-emerald-400 dark:hover:text-emerald-300"
                            >
                              {s.phone}
                            </a>
                          </p>
                        )}
                        {s.note && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">Ghi chú: {s.note}</p>
                        )}
                      </div>

                      {selectedIds.has(s.id) ? (
                        <Button size="sm" variant="secondary" disabled className="ml-auto">Đã thêm</Button>
                      ) : (
                        <Button size="sm" onClick={() => addToSelected(s)} className="ml-auto">Thêm</Button>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Selected list */}
        <div className="mt-8">
          <div className="mb-2">
            <Button variant="outline" size="sm" onClick={handleNewRoute}>
              Thêm lộ trình mới
            </Button>
          </div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Danh sách ghé thăm ({selected.length})</h2>
            <Button variant="outline" size="sm" onClick={sortByDistance} disabled={!selected.length || sorting}>
              {sorting ? 'Đang sắp xếp...' : 'Tính khoảng cách & sắp xếp'}
            </Button>
          </div>

          {selected.length === 0 ? (
            <Card><CardContent className="p-4 text-sm text-gray-500 dark:text-gray-400">Chưa có cửa hàng nào trong danh sách</CardContent></Card>
          ) : (
            <ul className="space-y-2">
              {selected.map((s) => (
                <li key={s.id}>
                  <Card>
                    <CardContent className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</div>
                        <div className="truncate text-xs text-gray-600 dark:text-gray-400">{s.address}</div>
                        {typeof s.distance === 'number' ? (
                          <div className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">Khoảng cách: {s.distance.toFixed(1)} km</div>
                        ) : s.distance === null ? (
                          <div className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">Khoảng cách: Không xác định</div>
                        ) : null}
                      </div>
                      <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950" onClick={() => removeFromSelected(s.id)}>
                        Xóa
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
