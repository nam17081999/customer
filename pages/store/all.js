import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import removeVietnameseTones from '@/helper/removeVietnameseTones'
import { useAuth } from '@/components/auth-context'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog'
import { PAGE_SIZE, MIN_SEARCH_LEN, SEARCH_DEBOUNCE_MS, SCROLL_BOTTOM_OFFSET } from '@/lib/constants'

export default function AllStoresVerify() {
  const { user } = useAuth()
  const [stores, setStores] = useState([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifyingId, setVerifyingId] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkLoading, setBulkLoading] = useState(false)

  // Added: cache, race-guard, and constants
  const cacheRef = useRef(new Map())
  const lastKeyRef = useRef('')

  // Pagination controls
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [search])

  // fetch stores when searching (default: all unverified)
  useEffect(() => {
    const keyword = debouncedSearch
    if (keyword && keyword.length < MIN_SEARCH_LEN) {
      setStores([])
      setSelectedIds([])
      setHasMore(false)
      setLoading(false)
      setPage(1)
      return
    }
    fetchPage(keyword || '', 1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  async function fetchPage(keyword, pageNum = 1, append = false) {
    const raw = (keyword || '').trim()
    const searchValue = removeVietnameseTones(raw).toLowerCase()
    const key = searchValue

    const from = (pageNum - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    if (pageNum === 1) setLoading(true); else setLoadingMore(true)

    lastKeyRef.current = `${key}|${pageNum}`

    let query = supabase
      .from('stores')
      .select('id,name,address,phone,status,image_url,latitude,longitude,note')
      .eq('status', false)

    if (searchValue) {
      query = query.ilike('name_search', `%${searchValue}%`)
    }

    const { data, error } = await query
      .order('id', { ascending: false })
      .range(from, to)

    if (pageNum === 1) setLoading(false); else setLoadingMore(false)

    // ignore stale
    if (lastKeyRef.current !== `${key}|${pageNum}`) return

    if (error) {
      console.error(error)
      return
    }
    const result = data || []
    setStores((prev) => (append ? [...prev, ...result] : result))
    setSelectedIds((prev) => prev.filter((id) => (append ? [...prev, ...result] : result).some((s) => s.id === id)))
    setHasMore(result.length === PAGE_SIZE)
    setPage(pageNum)
  }

  // Load more on scroll
  useEffect(() => {
    function onScroll() {
      if (!hasMore || loading || loadingMore) return
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - SCROLL_BOTTOM_OFFSET) {
        if (!debouncedSearch || debouncedSearch.length >= MIN_SEARCH_LEN) {
          fetchPage(debouncedSearch || '', page + 1, true)
        }
      }
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [hasMore, loading, loadingMore, page, debouncedSearch])

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function selectAllUnverified() {
    const ids = stores.filter((s) => !s.status).map((s) => s.id)
    setSelectedIds(ids)
  }

  function clearSelection() {
    setSelectedIds([])
  }

  async function verifyOne(store) {
    if (!user) {
      alert('Vui lòng đăng nhập để xác thực')
      return
    }
    if (store.status) return
    try {
      setVerifyingId(store.id)
      const { error } = await supabase
        .from('stores')
        .update({ status: true })
        .eq('id', store.id)
      if (error) throw error
      setStores((prev) => prev.map((s) => (s.id === store.id ? { ...s, status: true } : s)))
      setSelectedIds((prev) => prev.filter((id) => id !== store.id))
    } catch (e) {
      console.error(e)
      alert('Xác thực thất bại')
    } finally {
      setVerifyingId(null)
    }
  }

  async function verifySelected() {
    if (!user) {
      alert('Vui lòng đăng nhập để xác thực')
      return
    }
    const ids = selectedIds.filter((id) => {
      const s = stores.find((x) => x.id === id)
      return s && !s.status
    })
    if (ids.length === 0) return
    try {
      setBulkLoading(true)
      const { error } = await supabase
        .from('stores')
        .update({ status: true })
        .in('id', ids)
      if (error) throw error
      setStores((prev) => prev.map((s) => (ids.includes(s.id) ? { ...s, status: true } : s)))
      setSelectedIds([])
    } catch (e) {
      console.error(e)
      alert('Xác thực hàng loạt thất bại')
    } finally {
      setBulkLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Tất cả cửa hàng – Xác thực</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tìm và xác thực cửa hàng. Bạn có thể xác thực từng cửa hàng hoặc chọn nhiều để xác thực hàng loạt.</p>

        {!user && (
          <Card className="mt-4">
            <CardContent className="p-4 text-sm text-amber-700 dark:text-amber-300">
              Vui lòng <Link href="/login" className="text-blue-600 underline">đăng nhập</Link> để thực hiện xác thực.
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex items-center gap-3">
          <Input
            type="text"
            placeholder="Tìm theo tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
          <Button onClick={() => setDebouncedSearch(search.trim())}>Tìm</Button>
        </div>

        {user && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={selectAllUnverified} disabled={stores.filter((s) => !s.status).length === 0 || loading || bulkLoading}>
              Chọn tất cả (chưa xác thực)
            </Button>
            <Button variant="outline" onClick={clearSelection} disabled={selectedIds.length === 0 || bulkLoading}>
              Bỏ chọn
            </Button>
            <Button onClick={verifySelected} disabled={selectedIds.length === 0 || bulkLoading}>
              {bulkLoading ? 'Đang xác thực…' : `Xác thực ${selectedIds.length} mục`}
            </Button>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-4 p-4">
                  <Skeleton className="h-14 w-14 rounded" />
                  <div className="w-full space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : debouncedSearch && debouncedSearch.length === 1 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Nhập tối thiểu 2 ký tự để tìm
              </CardContent>
            </Card>
          ) : stores.length > 0 ? (
            <>
              <ul className="space-y-3">
                {stores.map((store) => (
                  <li key={store.id}>
                    <Card>
                      <CardContent className="flex items-center gap-4 p-4">
                        {store.image_url ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Image
                                src={store.image_url}
                                alt={store.name}
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
                                  src={store.image_url}
                                  alt={store.name}
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
                          <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                            <span
                              className={`shrink-0 rounded px-2 py-0.5 text-xs ${store.status ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
                            >
                              {store.status ? 'Đã xác thực' : 'Chưa xác thực'}
                            </span>
                            <h3 className="text-lg font-semibold leading-snug text-gray-900 dark:text-gray-100 break-words">
                              <Link href={`/store/${store.id}`} className="block hover:underline">Cửa hàng: {store.name}</Link>
                            </h3>
                          </div>
                          <p className="truncate text-sm text-gray-600 dark:text-gray-400">Địa chỉ: {store.address}</p>
                          {store.phone && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">Số điện thoại: {store.phone}</p>
                          )}
                          {store.note && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">Ghi chú: {store.note}</p>
                          )}
                          <div className="mt-2 flex items-center gap-3">
                            {user && !store.status && (
                              <>
                                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
                                    checked={selectedIds.includes(store.id)}
                                    onChange={() => toggleSelect(store.id)}
                                    disabled={bulkLoading}
                                  />
                                  Chọn
                                </label>
                                <Button
                                  size="sm"
                                  onClick={() => verifyOne(store)}
                                  disabled={verifyingId === store.id || bulkLoading}
                                >
                                  {verifyingId === store.id ? 'Đang xác thực…' : 'Xác thực'}
                                </Button>
                              </>
                            )}
                            {store.latitude && store.longitude && (
                              <Button asChild variant="secondary" size="sm">
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}&travelmode=driving`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  GG Maps
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
              <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                {loadingMore ? 'Đang tải thêm…' : !hasMore ? 'Đã hết' : null}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {!debouncedSearch ? 'Nhập từ khóa để tìm cửa hàng' : 'Không có cửa hàng chưa xác thực'}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
