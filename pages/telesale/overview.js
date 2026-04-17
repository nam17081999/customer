import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { getOrRefreshStores } from '@/lib/storeCache'
import { formatAddressParts } from '@/lib/utils'
import { formatLastCalledText, getTelesaleResultLabel, hasReportedOrder } from '@/helper/telesale'
import TelesaleCallDialog from '@/components/store/telesale-call-dialog'

function hasPhone(store) {
  return Boolean(String(store?.phone || '').trim())
}

function byRecentCallDesc(a, b) {
  const aTime = new Date(a?.last_called_at || 0).getTime()
  const bTime = new Date(b?.last_called_at || 0).getTime()
  return bTime - aTime
}

function getPriorityGroup(store) {
  if (!store?.last_called_at) return 0
  if (isResultStale(store)) return 1
  const result = store?.last_call_result
  if (result === 'goi_lai_sau') return 2
  if (result === 'khong_nghe' || result === 'khong_nghe_may') return 3
  if (result === 'con_hang' || result === 'quan_tam') return 4
  if (result === 'da_len_don' || result === 'da_bao_don') return 5
  return 6
}

function getTimeValue(value) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function getResultGapMinutes(store) {
  const calledAt = getTimeValue(store?.last_called_at)
  if (!calledAt) return null

  const resultAt = getTimeValue(store?.last_call_result_at)
  if (!resultAt) return null

  return Math.abs(resultAt - calledAt) / (60 * 1000)
}

function isResultStale(store) {
  const gapMinutes = getResultGapMinutes(store)
  if (gapMinutes == null) return Boolean(store?.last_called_at && !store?.last_call_result_at)
  return gapMinutes > 30
}

function getPriorityTime(store) {
  const group = getPriorityGroup(store)
  if (group === 0) {
    return new Date(store?.created_at || store?.updated_at || 0).getTime()
  }
  if (group === 1) {
    return getTimeValue(store?.last_called_at || store?.updated_at || store?.created_at)
  }
  if (group === 5) {
    return getTimeValue(store?.last_order_reported_at || store?.last_call_result_at || store?.last_called_at)
  }
  return getTimeValue(store?.last_call_result_at || store?.last_called_at)
}

function comparePriorityStores(a, b) {
  const groupDelta = getPriorityGroup(a) - getPriorityGroup(b)
  if (groupDelta !== 0) return groupDelta
  return getPriorityTime(a) - getPriorityTime(b)
}

function isOlderThanDays(value, days) {
  if (!value) return true
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return true
  const minAge = days * 24 * 60 * 60 * 1000
  return Date.now() - time >= minAge
}

function TelesaleStoreRow({ store, onUpdate }) {
  const addressText = formatAddressParts(store)
  const needsUpdate = isResultStale(store)

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-gray-100">{store.name}</p>
          {addressText && <p className="mt-1 line-clamp-2 text-sm text-gray-400">{addressText}</p>}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-gray-800 px-2 py-1 text-gray-200">
              {getTelesaleResultLabel(store.last_call_result)}
            </span>
            <span className="rounded-full bg-gray-800 px-2 py-1 text-gray-200">
              {formatLastCalledText(store.last_called_at)}
            </span>
            {store.last_call_result_at && (
              <span className="rounded-full bg-gray-800 px-2 py-1 text-gray-200">
                Cập nhật kết quả: {formatLastCalledText(store.last_call_result_at)}
              </span>
            )}
            {hasReportedOrder(store) && (
              <span className="rounded-full bg-amber-500/15 px-2 py-1 text-amber-200">Đã lên đơn</span>
            )}
          </div>
          {store.sales_note && <p className="mt-2 line-clamp-2 text-sm text-gray-300">{store.sales_note}</p>}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {needsUpdate && (
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-sky-500/40 text-sky-100 hover:bg-sky-500/10"
              onClick={() => onUpdate?.(store.id)}
            >
              Cập nhật
            </Button>
          )}
          {store.phone && (
            <TelesaleCallDialog
              store={store}
              trigger={(
                <Button type="button" variant="outline" className="shrink-0">
                  Gọi
                </Button>
              )}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function TelesaleOverviewPage() {
  const router = useRouter()
  const { isAdmin, isTelesale, isAuthenticated, loading: authLoading } = useAuth() || {}
  const [pageReady, setPageReady] = useState(false)
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setPageReady(false)
      router.replace('/login?from=/telesale/overview')
      return
    }
    if (!isAdmin && !isTelesale) {
      setPageReady(false)
      router.replace('/account')
      return
    }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, isTelesale, router])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getOrRefreshStores()
      setStores(data || [])
    } catch {
      setStores([])
      setError('Không tải được dữ liệu telesale. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!pageReady) return
    loadDashboard()
  }, [pageReady, loadDashboard])

  useEffect(() => {
    if (!pageReady || typeof window === 'undefined') return undefined
    const handleChanged = () => loadDashboard()
    window.addEventListener('storevis:stores-changed', handleChanged)
    return () => window.removeEventListener('storevis:stores-changed', handleChanged)
  }, [pageReady, loadDashboard])

  const summary = useMemo(() => {
    const allWithPhone = stores.filter(hasPhone)
    const potentialStores = allWithPhone.filter((store) => store.is_potential)
    const neverCalled = potentialStores.filter((store) => !store.last_called_at)
    const needFollowUp = potentialStores.filter((store) => ['goi_lai_sau', 'khong_nghe', 'khong_nghe_may'].includes(store.last_call_result))
    const interestedStores = potentialStores.filter((store) => ['con_hang', 'quan_tam'].includes(store.last_call_result))
    const reportedStores = potentialStores.filter(hasReportedOrder)
    const recentCalls = potentialStores
      .filter((store) => store.last_called_at)
      .sort(byRecentCallDesc)
      .slice(0, 6)
    const queueStores = potentialStores
      .filter((store) => {
        const result = store.last_call_result
        if (result === 'da_len_don' || result === 'da_bao_don') {
          return isOlderThanDays(store.last_order_reported_at || store.last_called_at, 3)
        }
        if (result === 'con_hang' || result === 'quan_tam') {
          return isOlderThanDays(store.last_call_result_at || store.last_called_at, 2)
        }
        return true
      })
      .sort(comparePriorityStores)

    return {
      totalPhoneStores: allWithPhone.length,
      neverCalledCount: neverCalled.length,
      needFollowUpCount: needFollowUp.length,
      interestedCount: interestedStores.length,
      reportedCount: reportedStores.length,
      recentCalls,
      queueStores,
    }
  }, [stores])

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push('/account')
  }, [router])

  const handleOpenUpdate = useCallback((storeId) => {
    if (!storeId) return
    router.push(`/telesale/call/${storeId}?from=${encodeURIComponent('/telesale/overview')}`)
  }, [router])

  if (authLoading || !pageReady) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <>
      <Head>
        <title>Telesale - NPP Hà Công</title>
      </Head>

      <div className="min-h-screen bg-black">
        <div className="mx-auto max-w-screen-md space-y-4 px-3 py-4 sm:px-4 sm:py-6">
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleBack}>
              ← Quay lại
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={loadDashboard} disabled={loading}>
              {loading ? 'Đang tải...' : 'Làm mới'}
            </Button>
          </div>

          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div>
                <h1 className="text-xl font-bold text-gray-100 sm:text-2xl">Tổng quan telesale</h1>
                <p className="text-sm text-gray-400 sm:text-base">
                  Quan sát nhanh nhóm cần gọi và cửa hàng đã lên đơn.
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-gray-800 bg-gray-950 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-400">Có số điện thoại</p>
                  <p className="mt-1 text-3xl font-bold text-gray-100">{summary.totalPhoneStores}</p>
                </div>
                <div className="rounded-xl border border-amber-900 bg-amber-950/25 p-3">
                  <p className="text-xs uppercase tracking-wide text-amber-300">Chưa gọi</p>
                  <p className="mt-1 text-3xl font-bold text-amber-200">{summary.neverCalledCount}</p>
                </div>
                <div className="rounded-xl border border-sky-900 bg-sky-950/25 p-3">
                  <p className="text-xs uppercase tracking-wide text-sky-300">Cần gọi lại</p>
                  <p className="mt-1 text-3xl font-bold text-sky-200">{summary.needFollowUpCount}</p>
                </div>
                <div className="rounded-xl border border-violet-900 bg-violet-950/25 p-3">
                  <p className="text-xs uppercase tracking-wide text-violet-300">Còn hàng</p>
                  <p className="mt-1 text-3xl font-bold text-violet-200">{summary.interestedCount}</p>
                </div>
                <div className="rounded-xl border border-green-900 bg-green-950/25 p-3">
                  <p className="text-xs uppercase tracking-wide text-green-300">Đã lên đơn</p>
                  <p className="mt-1 text-3xl font-bold text-green-200">{summary.reportedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border border-gray-800">
              <CardContent className="space-y-3 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-100">Danh sách ưu tiên gọi</h2>
                  <span className="text-sm text-gray-400">{summary.queueStores.length} cửa hàng</span>
                </div>
                {summary.queueStores.length === 0 ? (
                  <p className="text-sm text-gray-400">Chưa có cửa hàng cần ưu tiên gọi.</p>
                ) : (
                  <div className="space-y-3">
                    {summary.queueStores.map((store) => (
                      <TelesaleStoreRow key={store.id} store={store} onUpdate={handleOpenUpdate} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-gray-800">
              <CardContent className="space-y-3 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-100">Cuộc gọi gần đây</h2>
                  <span className="text-sm text-gray-400">{summary.recentCalls.length} cửa hàng</span>
                </div>
                {summary.recentCalls.length === 0 ? (
                  <p className="text-sm text-gray-400">Chưa có cuộc gọi nào được cập nhật.</p>
                ) : (
                  <div className="space-y-3">
                    {summary.recentCalls.map((store) => (
                      <TelesaleStoreRow key={store.id} store={store} onUpdate={handleOpenUpdate} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
