import Head from 'next/head'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { OverflowMarquee } from '@/components/ui/overflow-marquee'
import StoreReportForm from '@/components/store-report-form'
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { getOrRefreshStores } from '@/lib/storeCache'

export default function StoreReportEditPage() {
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
    return raw ? String(raw) : `/store/report/${storeId}`
  }, [router.query.from, storeId])

  const reportDistance = useMemo(() => {
    const raw = Array.isArray(router.query.distance) ? router.query.distance[0] : router.query.distance
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }, [router.query.distance])

  const pushSearchWithNotice = async (text, type = 'success') => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('storevis:flash-message', JSON.stringify({
        type,
        text,
        createdAt: Date.now(),
      }))
      window.dispatchEvent(new CustomEvent('storevis:flash-message'))
    }
    await router.push('/')
  }

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
        console.error('Load store for report edit failed:', err)
        if (active) {
          setError('Không tải được thông tin cửa hàng.')
          setStore(null)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadStore()
    return () => { active = false }
  }, [router.isReady, storeId])

  return (
    <>
      <Head>
        <title>Sửa thông tin cửa hàng - NPP Hà Công</title>
      </Head>

      <div className="min-h-screen bg-black">
        {!loading && store ? (
          <div className="sticky top-0 z-[140] flex items-center gap-3 border-b border-gray-800 bg-black/95 px-4 py-3 backdrop-blur">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => router.push(backHref)}
              icon={(
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              )}
            />
            <div>
              <h1 className="text-base font-semibold leading-tight text-white">Sửa cửa hàng</h1>
              <OverflowMarquee text={store.name} className="max-w-[220px]" textClassName="text-xs text-gray-400" />
            </div>
          </div>
        ) : null}

        <div className="mx-auto max-w-screen-md space-y-3 px-3 py-3 pb-24 sm:px-4 sm:py-4 sm:pb-8">

          {loading ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5 text-base text-gray-400">
              Đang tải thông tin cửa hàng…
            </div>
          ) : null}

          {!loading && error ? (
            <div className="rounded-2xl border border-red-900 bg-red-950/20 p-5 text-base text-red-300">
              {error}
            </div>
          ) : null}

          {!loading && store ? (
            <>
              {submitted ? (
                <section className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-5">
                  <p className="text-lg font-semibold text-emerald-200">Đã gửi báo cáo</p>
                  <p className="mt-2 text-base text-emerald-100">{submitted}</p>
                  <div className="mt-4">
                    <Button asChild>
                      <Link href={backHref}>Quay lại báo cáo</Link>
                    </Button>
                  </div>
                </section>
              ) : (
                <StoreReportForm
                  key={`${store.id}-edit`}
                  store={store}
                  user={user}
                  initialMode="edit"
                  hideModeChooser
                  onCancel={() => {
                    void router.push(backHref)
                  }}
                  onSubmitted={(message) => {
                    setSubmitted(message)
                    void pushSearchWithNotice(message)
                  }}
                />
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
