import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import removeVietnameseTones from '@/helper/removeVietnameseTones';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog';
import Link from 'next/link';
import { useAuth } from '@/components/auth-context';
import Image from 'next/image';
import { PAGE_SIZE, MIN_SEARCH_LEN, SEARCH_DEBOUNCE_MS, SCROLL_BOTTOM_OFFSET } from '@/lib/constants';

export default function StoreList() {
  const [stores, setStores] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [deletingId, setDeletingId] = useState(null);

  // Pagination & control
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset and fetch first page when keyword changes
  useEffect(() => {
    const keyword = debouncedSearch;
    if (keyword && keyword.length < MIN_SEARCH_LEN) {
      // show prompt in UI, do not fetch
      setLoading(false);
      setHasMore(false);
      setPage(1);
      setStores([]);
      return;
    }
    if (keyword && keyword.length >= MIN_SEARCH_LEN) {
      // valid search -> fresh fetch
      setPage(1);
      setHasMore(true);
      setStores([]);
      fetchPage(keyword, 1, false);
    } else {
      // empty search -> clear list
      setStores([]);
      setHasMore(false);
      setLoading(false);
      setPage(1);
    }
  }, [debouncedSearch]);

  async function fetchPage(keyword, pageNum = 1, append = false) {
    const raw = (keyword || '').trim();
    const searchValue = removeVietnameseTones(raw).toLowerCase();
    const from = (pageNum - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    if (pageNum === 1) setLoading(true); else setLoadingMore(true);

    const { data, error } = await supabase
      .from('stores')
      .select('id,name,address,phone,status,image_url,latitude,longitude,note')
      .ilike('name_search', `%${searchValue}%`)
      .order('status', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (pageNum === 1) setLoading(false); else setLoadingMore(false);
    if (error) {
      console.error(error);
      return;
    }
    const items = data || [];
    setStores((prev) => (append ? [...prev, ...items] : items));
    setHasMore(items.length === PAGE_SIZE);
    setPage(pageNum);
  }

  // Load more on scroll
  useEffect(() => {
    function onScroll() {
      if (!hasMore || loading || loadingMore) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - SCROLL_BOTTOM_OFFSET) {
        if (debouncedSearch && debouncedSearch.length >= MIN_SEARCH_LEN) {
          fetchPage(debouncedSearch, page + 1, true);
        }
      }
    }
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [hasMore, loading, loadingMore, page, debouncedSearch]);

  function getFileNameFromUrl(url) {
    try {
      const marker = '/object/public/stores/';
      const idx = url.indexOf(marker);
      if (idx !== -1) return url.substring(idx + marker.length);
      const u = new URL(url);
      const parts = u.pathname.split('/');
      return parts[parts.length - 1];
    } catch {
      return null;
    }
  }

  async function handleDelete(store) {
    if (!user) {
      alert('Vui lòng đăng nhập để xóa cửa hàng');
      return;
    }
    const ok = window.confirm(`Bạn có chắc muốn xóa cửa hàng "${store.name}"?`);
    if (!ok) return;
    try {
      setDeletingId(store.id);
      const { error: delErr } = await supabase.from('stores').delete().eq('id', store.id);
      if (delErr) throw delErr;
      // best-effort remove image
      if (store.image_url) {
        const file = getFileNameFromUrl(store.image_url);
        if (file) await supabase.storage.from('stores').remove([file]);
      }
      setStores((prev) => prev.filter((s) => s.id !== store.id));
    } catch (err) {
      console.error(err);
      alert('Xóa thất bại');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Danh sách cửa hàng
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Tìm kiếm theo tên cửa hàng, địa chỉ hoặc số điện thoại.
        </p>

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
                          <p className="truncate text-sm text-gray-600 dark:text-gray-400">
                            Địa chỉ: {store.address}
                          </p>
                          {store.phone && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Số điện thoại:{' '}
                              <a
                                href={`tel:${(store.phone || '').replace(/[^+\d]/g, '')}`}
                                className="inline-flex items-center rounded-sm font-medium text-emerald-600 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:text-emerald-400 dark:hover:text-emerald-300"
                              >
                                {store.phone}
                              </a>
                            </p>
                          )}
                          {store.note && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">Ghi chú: {store.note}</p>
                          )}
                          <div className="mt-2 flex items-center gap-2">
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
                            {user && (
                              <>
                                <Button asChild size="sm" variant="outline">
                                  <Link href={`/store/${store.id}`}>Chỉnh sửa</Link>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950"
                                  disabled={deletingId === store.id}
                                  onClick={() => handleDelete(store)}
                                >
                                  {deletingId === store.id ? 'Đang xóa…' : 'Xóa'}
                                </Button>
                              </>
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
          ) : debouncedSearch && stores.length === 0 ? (
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
            <Card>
              <CardContent className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Nhập từ khóa để tìm cửa hàng
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
