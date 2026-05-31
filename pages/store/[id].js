import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Button } from '@/components/ui/button'
import { Badge, PageHeader } from '@/components/ui/v2'
import { getOrRefreshStores } from '@/lib/storeCache'
import { formatAddressParts } from '@/lib/utils'
import { formatDistance } from '@/helper/validation'
import { DEFAULT_STORE_TYPE, STORE_TYPE_OPTIONS } from '@/lib/constants'
import { hasStoreCoordinates, hasStoreSupplementOpportunity } from '@/helper/storeSupplement'
import { useAuth } from '@/lib/AuthContext'
import { buildStoreDetailBadges } from '@/helper/storeDetailActions'

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
    return () => { active = false }
  }, [router.isReady, storeId])

  const hasCoords = hasStoreCoordinates(store)
  const canSupplement = hasStoreSupplementOpportunity(store)
  const addressText = formatAddressParts(store)
  const storeTypeValue = store?.store_type || DEFAULT_STORE_TYPE
  const storeTypeLabel = STORE_TYPE_OPTIONS.find((option) => option.value === storeTypeValue)?.label || storeTypeValue
  const qualityBadges = useMemo(() => buildStoreDetailBadges(store || {}), [store])
  const contactCount = [store?.phone, store?.phone_secondary].filter(Boolean).length

  const actionButtons = store
    ? [
        hasCoords && {
          key: 'map',
          label: 'Bản đồ',
          href: `/map?storeId=${store.id}&lat=${store.latitude}&lng=${store.longitude}`,
          primary: false,
          visible: true,
        },
        {
          key: 'report',
          label: 'Báo cáo',
          href: `/store/report/${store.id}?from=${encodeURIComponent(router.asPath || `/store/${store.id}`)}`,
          primary: false,
          visible: true,
        },
        canSupplement && {
          key: 'supplement',
          label: 'Bổ sung',
          href: `/store/edit/${store.id}?mode=supplement`,
          primary: false,
          visible: true,
        },
        isAdmin && {
          key: 'edit',
          label: 'Chỉnh sửa',
          href: `/store/edit/${store.id}`,
          primary: true,
          visible: true,
        },
      ].filter(Boolean)
    : []

  return (
    <>
      <Head>
        <title>{store ? `${store.name} - NPP Hà Công` : 'Chi tiết cửa hàng - NPP Hà Công'}</title>
      </Head>

      <div className="min-h-[calc(100dvh-3.5rem)] px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto max-w-5xl space-y-4 pb-28 sm:space-y-6 sm:pb-10">
          <PageHeader
            title="Chi tiết cửa hàng"
            subtitle="Tổng quan thông tin, liên hệ và các thao tác nhanh."
            actions={
              <Button asChild variant="outline" className="shrink-0">
                <Link href={backHref}>Quay lại</Link>
              </Button>
            }
          />

          {loading && (
            <div className="rounded-xl border border-gray-800 bg-gray-950/90 p-6 text-base text-gray-400">
              Đang tải thông tin cửa hàng...
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-900 bg-red-950/20 p-6 text-base text-red-300">
              {error}
            </div>
          )}

          {!loading && store && (
            <section className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950/92 shadow-2xl shadow-black/20 backdrop-blur">
              <div className="border-b border-gray-800 bg-gradient-to-br from-slate-900/85 via-slate-950/85 to-black/40 px-4 py-5 sm:px-6 sm:py-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="active">{storeTypeLabel}</Badge>
                      {typeof store.distance === 'number' ? (
                        <Badge>{formatDistance(store.distance)}</Badge>
                      ) : !hasCoords ? (
                        <Badge variant="warning">Chưa có vị trí</Badge>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <h1 className="break-words text-2xl font-bold leading-tight text-gray-50 sm:text-3xl">{store.name}</h1>
                      <p className="max-w-3xl text-base leading-relaxed text-gray-300 sm:text-lg">
                        {addressText || 'Chưa có địa chỉ chi tiết.'}
                      </p>
                    </div>

                    {qualityBadges.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {qualityBadges.map((badge) => (
                          <Badge key={badge.key} variant="warning">{badge.label}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid min-w-[14rem] grid-cols-2 gap-3 md:w-[17rem] md:grid-cols-1">
                    <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
                      <p className="text-sm text-gray-400">Liên hệ</p>
                      <p className="mt-1 text-2xl font-semibold text-gray-50">{contactCount}</p>
                      <p className="mt-1 text-sm text-gray-400">Số điện thoại</p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
                      <p className="text-sm text-gray-400">Vị trí</p>
                      <p className="mt-1 text-2xl font-semibold text-gray-50">{hasCoords ? 'Đã có' : 'Thiếu'}</p>
                      <p className="mt-1 text-sm text-gray-400">Trạng thái tọa độ</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
                      <p className="text-sm font-medium text-gray-400">Thông tin liên hệ</p>
                      <div className="mt-3 space-y-3">
                        {store.phone ? (
                          <div>
                            <p className="text-sm text-gray-500">Số điện thoại chính</p>
                            <p className="break-all text-base font-medium text-gray-100">{store.phone}</p>
                          </div>
                        ) : (
                          <p className="text-base text-gray-400">Chưa có số điện thoại.</p>
                        )}
                        {store.phone_secondary && (
                          <div>
                            <p className="text-sm text-gray-500">Số điện thoại phụ</p>
                            <p className="break-all text-base font-medium text-gray-100">{store.phone_secondary}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
                      <p className="text-sm font-medium text-gray-400">Tình trạng dữ liệu</p>
                      <div className="mt-3 space-y-2">
                        <p className="text-base text-gray-200">{isAdmin ? 'Có quyền chỉnh sửa trực tiếp.' : 'Có thể báo cáo hoặc bổ sung dữ liệu.'}</p>
                        <p className="text-sm leading-relaxed text-gray-400">
                          {hasCoords ? 'Cửa hàng đã có tọa độ hiển thị bản đồ.' : 'Cửa hàng chưa có tọa độ, chỉ hỗ trợ tác vụ phù hợp.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
                    <p className="text-sm font-medium text-gray-400">Ghi chú</p>
                    {store.note ? (
                      <p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed text-gray-200">{store.note}</p>
                    ) : (
                      <p className="mt-3 text-base text-gray-400">Chưa có ghi chú.</p>
                    )}
                  </div>
                </div>

                <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
                  <div className="rounded-xl border border-gray-800 bg-gradient-to-br from-blue-950/30 via-gray-950/70 to-gray-950 p-4 shadow-xl shadow-black/10">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">Thao tác nhanh</p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">
                      Giữ nguyên luồng hiện tại, nhưng gom các tác vụ quan trọng vào một cụm dễ chạm và dễ quét hơn.
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                      {actionButtons.map((action) => (
                        <Button
                          key={action.key}
                          asChild
                          variant={action.primary ? 'primary' : 'outline'}
                          className="w-full justify-start"
                        >
                          <Link href={action.href}>{action.label}</Link>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
                    <p className="text-sm font-semibold text-gray-300">Tóm tắt</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
                      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Loại</p>
                        <p className="mt-1 text-sm font-semibold text-gray-100">{storeTypeLabel}</p>
                      </div>
                      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Liên hệ</p>
                        <p className="mt-1 text-sm font-semibold text-gray-100">{contactCount} số</p>
                      </div>
                      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Vị trí</p>
                        <p className="mt-1 text-sm font-semibold text-gray-100">{hasCoords ? 'Đã có' : 'Chưa có'}</p>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
