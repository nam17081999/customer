import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import removeVietnameseTones from '@/helper/removeVietnameseTones';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogTrigger, DialogContent, DialogClose } from '@/components/ui/dialog';
import Link from 'next/link';
import { useAuth } from '@/components/auth-context';

export default function StoreList() {
  const [stores, setStores] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [deletingId, setDeletingId] = useState(null);

  // Debounce 500ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch khi có search text
  useEffect(() => {
    if (debouncedSearch) {
      fetchStores(debouncedSearch);
    } else {
      setStores([]); // clear list
      setLoading(false);
    }
  }, [debouncedSearch]);

  async function fetchStores(keyword) {
    setLoading(true);
    const searchValue = removeVietnameseTones(keyword).toLowerCase();
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .ilike('name_search', `%${searchValue}%`)
      .order('id', { ascending: false });

    setLoading(false);
    if (error) {
      console.error(error);
      return;
    }
    setStores(data || []);
  }

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
          ) : stores.length > 0 ? (
            <ul className="space-y-3">
              {stores.map((store) => (
                <li key={store.id}>
                  <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                      {store.image_url ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <img
                              src={store.image_url}
                              alt={store.name}
                              className="h-16 w-16 cursor-zoom-in rounded object-cover ring-1 ring-gray-200 transition hover:opacity-90 dark:ring-gray-800"
                            />
                          </DialogTrigger>
                          <DialogContent className="overflow-hidden p-0">
                            <DialogClose asChild>
                              <img
                                src={store.image_url}
                                alt={store.name}
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
                        <h3 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
                          <Link href={`/store/${store.id}`} className="hover:underline">Tên cửa hàng: {store.name}</Link>
                        </h3>
                        <p className="truncate text-sm text-gray-600 dark:text-gray-400">
                          Địa chỉ: {store.address}
                        </p>
                        {store.phone && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Số điện thoại: {store.phone}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          {store.latitude && store.longitude && (
                            <Button asChild variant="secondary" size="sm">
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Đi tới Google Maps
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
          ) : debouncedSearch && stores.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                ❌ Không tìm thấy cửa hàng nào
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
