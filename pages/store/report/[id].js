import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Button } from '@/components/ui/button'
import StoreReportForm from '@/components/store-report-form'
import { getOrRefreshStores } from '@/lib/storeCache'
import { useAuth } from '@/lib/AuthContext'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance } from '@/helper/validation'
import { hasStoreCoordinates } from '@/helper/storeSupplement'
import { getStoreTypeMeta } from '@/components/store/store-type-icon'

export default function StoreReportPage() {
  const router = useRouter()
  const { user } = useAuth() || {}
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState('')

  const storeId = useMemo(() => {
    if (!router.isReady) return ''
    const raw = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id
    return raw ? String(raw) : ''
  }, [router.isReady, router.query.id])

  const backHref = useMemo(() => {
    const raw = Array.isArray(router.query.from) ? router.query.from[0] : router.query.from
    return raw ? String(raw) : '/'
  }, [router.query.from])

  const reportDistance = useMemo(() => {
    const raw = Array.isArray(router.query.distance) ? router.query.distance[0] : router.query.distance
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }, [router.query.distance])

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
          setError('Không tìm thấy cửa hàng để báo cáo.')
          setStore(null)
        } else {
          setStore(matched)
        }
      } catch (err) {
        console.error('Load store for report failed:', err)
        if (active) {
          setError('Không tải được thông tin cửa hàng.')
          setStore(null)
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

  const storeTypeMeta = getStoreTypeMeta(store?.store_type)
  const storeTypeLabel = storeTypeMeta.label
  const addressText = formatAddressParts(store)
  const hasCoords = hasStoreCoordinates(store)
  const isActive = Boolean(store?.active)
  const displayDistance = typeof store?.distance === 'number' && Number.isFinite(store.distance)
    ? store.distance
    : reportDistance

  return (
    <>
      <Head>
        <title>Báo cáo cửa hàng - StoreVis</title>
      </Head>

      <div className="min-h-[calc(100dvh-3.5rem)] bg-black px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto max-w-screen-md space-y-4 pb-24 sm:pb-8">
          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="outline">
              <Link href={backHref}>Quay lại</Link>
            </Button>
          </div>

          <header className="space-y-1">
            <h1 className="text-xl font-bold text-gray-100 sm:text-2xl">Báo cáo cửa hàng</h1>
          </header>

          {loading && (
            <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5 text-base text-gray-400">
              Đang tải thông tin cửa hàng…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-red-900 bg-red-950/20 p-5 text-base text-red-300">
              {error}
            </div>
          )}

          {!loading && store && (
            <>
              <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-950">
                <div className="border-b border-gray-800 bg-gray-950/95 px-4 py-4 backdrop-blur">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-300">
                      {storeTypeMeta.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-400">{storeTypeLabel}</p>
                      <h2 className="mt-0.5 text-xl font-bold leading-tight text-gray-100 break-words">{store.name}</h2>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {isActive && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-200">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Xác thực
                      </span>
                    )}
                    {typeof displayDistance === 'number' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-300">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {formatDistance(displayDistance)}
                      </span>
                    ) : !hasCoords ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/80 px-2 py-0.5 text-xs font-medium text-amber-200">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21c4.97-4.97 7-8.25 7-11a7 7 0 10-14 0c0 2.75 2.03 6.03 7 11z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
                        </svg>
                        Chưa có vị trí
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2.5 p-4">
                  {addressText && (
                    <div className="flex items-start gap-2.5 text-base text-gray-300">
                      <svg className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="break-words leading-relaxed">{addressText}</span>
                    </div>
                  )}
                  {store.phone && (
                    <div className="flex items-center gap-2.5 text-base text-gray-300">
                      <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="break-all">{store.phone}</span>
                    </div>
                  )}
                  {store.note && (
                    <div className="flex items-start gap-2.5 text-base text-gray-300">
                      <svg className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span className="break-words leading-relaxed">{store.note}</span>
                    </div>
                  )}
                    </div>
                  </section>

              {submitted ? (
                <section className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-5">
                  <p className="text-lg font-semibold text-emerald-200">Đã gửi báo cáo</p>
                  <p className="mt-2 text-base text-emerald-100">{submitted}</p>
                  <div className="mt-4 flex gap-2">
                    <Button asChild>
                      <Link href={backHref}>Quay lại cửa hàng</Link>
                    </Button>
                  </div>
                </section>
              ) : (
                <StoreReportForm
                  key={store.id}
                  store={store}
                  user={user}
                  onSubmitted={(message) => setSubmitted(message)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
