import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Button } from '@/components/ui/button'
import StoreReportForm from '@/components/store-report-form'
import { getOrRefreshStores } from '@/lib/storeCache'
import { useAuth } from '@/lib/AuthContext'
import { getFullImageUrl, STORE_PLACEHOLDER_IMAGE } from '@/helper/imageUtils'
import { formatAddressParts } from '@/lib/utils'
import { getStoreTypeLabel, DEFAULT_STORE_TYPE } from '@/lib/constants'

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

  const imageSrc = store?.image_url ? getFullImageUrl(store.image_url) : STORE_PLACEHOLDER_IMAGE
  const storeTypeLabel = getStoreTypeLabel(store?.store_type || DEFAULT_STORE_TYPE, 'Cửa hàng')
  const addressText = formatAddressParts(store)

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
                <div className="grid gap-0 sm:grid-cols-[180px_1fr]">
                  <div className="relative h-36 bg-gray-900 sm:h-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageSrc}
                      alt={store.name}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <p className="text-sm font-medium text-gray-400">{storeTypeLabel}</p>
                      <h2 className="mt-1 text-lg font-semibold text-gray-100 sm:text-xl">{store.name}</h2>
                    </div>
                    {addressText && (
                      <p className="text-base leading-relaxed text-gray-300">{addressText}</p>
                    )}
                    {store.phone && (
                      <p className="text-base text-gray-300">{store.phone}</p>
                    )}
                  </div>
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
