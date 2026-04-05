import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Button } from '@/components/ui/button'
import { getOrRefreshStores } from '@/lib/storeCache'
import { getFullImageUrl, STORE_PLACEHOLDER_IMAGE } from '@/helper/imageUtils'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance } from '@/helper/validation'
import { DEFAULT_STORE_TYPE, STORE_TYPE_OPTIONS } from '@/lib/constants'
import { hasStoreCoordinates, hasStoreSupplementOpportunity } from '@/helper/storeSupplement'
import { useAuth } from '@/lib/AuthContext'

function appendFocusStoreId(path, focusStoreId) {
  const base = String(path || '/').trim() || '/'
  if (!focusStoreId) return base
  if (!base.startsWith('/')) return '/'

  const [pathname, rawQuery = ''] = base.split('?')
  const params = new URLSearchParams(rawQuery)
  if (!params.get('focusStoreId')) params.set('focusStoreId', String(focusStoreId))
  const queryString = params.toString()
  return queryString ? `${pathname}?${queryString}` : pathname
}

export default function StoreDetailPage() {
  const router = useRouter()
  const { isAdmin } = useAuth() || {}
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const storeId = useMemo(() => {
    if (!router.isReady) return ''
    const raw = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id
    return raw ? String(raw) : ''
  }, [router.isReady, router.query.id])

  const focusStoreId = useMemo(() => {
    const raw = Array.isArray(router.query.focusStoreId) ? router.query.focusStoreId[0] : router.query.focusStoreId
    return raw ? String(raw) : ''
  }, [router.query.focusStoreId])

  const backHref = useMemo(() => {
    const raw = Array.isArray(router.query.from) ? router.query.from[0] : router.query.from
    const from = raw ? String(raw) : '/'
    return appendFocusStoreId(from, focusStoreId || storeId)
  }, [router.query.from, focusStoreId, storeId])

  useEffect(() => {
    if (!router.isReady || !storeId) return

    let active = true

    const loadStore = async () => {
      setLoading(true)
      setError('')
      try {
        const stores = await getOrRefreshStores()
        if (!active) return
        const matched = stores.find((item) => String(item.id) === storeId)
        if (!matched) {
          setStore(null)
          setError('Không tìm thấy cửa hàng.')
          return
        }
        setStore(matched)
      } catch (err) {
        console.error('Load store detail failed:', err)
        if (active) {
          setStore(null)
          setError('Không tải được thông tin cửa hàng.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadStore()

    return () => {
      active = false
    }
  }, [router.isReady, storeId])

  const hasCoords = hasStoreCoordinates(store)
  const canSupplement = hasStoreSupplementOpportunity(store)
  const addressText = formatAddressParts(store)
  const imageSrc = store?.image_url ? getFullImageUrl(store.image_url) : STORE_PLACEHOLDER_IMAGE
  const storeTypeValue = store?.store_type || DEFAULT_STORE_TYPE
  const storeTypeLabel = STORE_TYPE_OPTIONS.find((option) => option.value === storeTypeValue)?.label || storeTypeValue

  return (
    <>
      <Head>
        <title>{store ? `${store.name} - NPP Hà Công` : 'Chi tiết cửa hàng - NPP Hà Công'}</title>
      </Head>

      <div className="min-h-[calc(100dvh-3.5rem)] bg-black px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto max-w-screen-md space-y-4 pb-24 sm:pb-8">
          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="outline">
              <Link href={backHref}>Quay lại</Link>
            </Button>
          </div>

          {loading && (
            <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5 text-base text-gray-400">
              Đang tải thông tin cửa hàng...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-red-900 bg-red-950/20 p-5 text-base text-red-300">
              {error}
            </div>
          )}

          {!loading && store && (
            <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-950">
              <div className="relative h-52 w-full bg-gray-900 sm:h-64">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageSrc} alt={store.name} className="h-full w-full object-contain" />
                {store.active && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-green-500/90 px-2 py-0.5 text-xs font-medium text-white">
                    Xác thực
                  </span>
                )}
              </div>

              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-400">{storeTypeLabel}</p>
                    <h1 className="mt-1 break-words text-xl font-bold leading-tight text-gray-100 sm:text-2xl">{store.name}</h1>
                  </div>
                  {typeof store.distance === 'number' ? (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-200">
                      {formatDistance(store.distance)}
                    </span>
                  ) : !hasCoords ? (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-950/80 px-2 py-0.5 text-xs font-medium text-amber-200">
                      Chưa có vị trí
                    </span>
                  ) : null}
                </div>

                {addressText && <p className="text-base leading-relaxed text-gray-300">{addressText}</p>}
                {store.phone && <p className="text-base text-gray-300">{store.phone}</p>}
                {store.note && <p className="text-base leading-relaxed text-gray-400">{store.note}</p>}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {hasCoords && (
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/map?storeId=${store.id}&lat=${store.latitude}&lng=${store.longitude}`}>Bản đồ</Link>
                    </Button>
                  )}

                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/store/report/${store.id}?from=${encodeURIComponent(router.asPath || `/store/${store.id}`)}`}>Báo cáo</Link>
                  </Button>

                  {canSupplement && (
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/store/edit/${store.id}?mode=supplement`}>Bổ sung</Link>
                    </Button>
                  )}

                  {isAdmin && (
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/store/edit/${store.id}`}>Chỉnh sửa</Link>
                    </Button>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
