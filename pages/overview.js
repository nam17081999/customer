import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { getOrRefreshStores } from '@/lib/storeCache'
import { formatMoney, getDashboardAggregateReport, getInventoryReconciliationReport, listProductsWithStock, listPurchaseOrders, listSalesOrders } from '@/api/inventory/inventory-client'
import { buildDashboardHealthSummary, OPERATOR_QUICK_ACTIONS } from '@/helper/operatorWorkflow'
import { PageHeader, Badge } from '@/components/ui/v2'

function formatDateTime(value) {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu'
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function hasValidCoordinates(store) {
  const lat = Number(store?.latitude)
  const lng = Number(store?.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export default function OverviewPage() {
  const router = useRouter()
  const { isAdmin, isAuthenticated, loading: authLoading } = useAuth() || {}

  const [pageReady, setPageReady] = useState(false)
  const [stores, setStores] = useState([])
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [purchases, setPurchases] = useState([])
  const [reconciliationRows, setReconciliationRows] = useState([])
  const [aggregateReport, setAggregateReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setPageReady(false)
      router.replace('/login?from=/overview')
      return
    }
    if (!isAdmin) {
      setPageReady(false)
      router.replace('/account')
      return
    }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [storeRows, productRows, orderRows, purchaseRows, reconciliationReport, dashboardAggregate] = await Promise.all([
        getOrRefreshStores(),
        listProductsWithStock(),
        listSalesOrders(20),
        listPurchaseOrders(20),
        getInventoryReconciliationReport().catch(() => []),
        getDashboardAggregateReport().catch(() => null),
      ])
      setStores(storeRows || [])
      setProducts(productRows || [])
      setOrders(orderRows || [])
      setPurchases(purchaseRows || [])
      setReconciliationRows(reconciliationReport || [])
      setAggregateReport(dashboardAggregate)
    } catch {
      setError('Không tải được dữ liệu tổng quan. Vui lòng thử lại.')
      setStores([])
      setProducts([])
      setOrders([])
      setPurchases([])
      setReconciliationRows([])
      setAggregateReport(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push('/account')
  }, [router])

  useEffect(() => {
    if (!pageReady) return
    loadDashboard()
  }, [pageReady, loadDashboard])

  const summary = useMemo(() => {
    const totalStores = stores.length
    const verifiedStores = stores.filter((store) => store.active === true).length
    const unverifiedStores = totalStores - verifiedStores
    const storesWithPhone = stores.filter((store) => String(store.phone || '').trim()).length
    const storesWithLocation = stores.filter(hasValidCoordinates).length
    const districtCountMap = {}
    const wardSet = new Set()
    const districtSet = new Set()

    let newestCreatedAt = null
    let last7DaysStores = 0
    const last7DaysThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000

    stores.forEach((store) => {
      const districtName = (store.district || '').trim() || 'Chưa cập nhật huyện'
      districtCountMap[districtName] = (districtCountMap[districtName] || 0) + 1

      const district = (store.district || '').trim()
      if (district) districtSet.add(district)

      const ward = (store.ward || '').trim()
      if (ward) wardSet.add(ward)

      const createdTime = new Date(store.created_at || '').getTime()
      if (!Number.isNaN(createdTime)) {
        if (!newestCreatedAt || createdTime > newestCreatedAt) newestCreatedAt = createdTime
        if (createdTime >= last7DaysThreshold) last7DaysStores += 1
      }
    })

    const districtRows = Object.entries(districtCountMap)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]
        return a[0].localeCompare(b[0], 'vi')
      })
      .map(([district, count]) => ({ district, count }))

    const topDistrictCount = districtRows[0]?.count || 1
    const verificationRate = totalStores === 0 ? 0 : Math.round((verifiedStores / totalStores) * 100)

    return {
      totalStores,
      verifiedStores,
      unverifiedStores,
      storesWithPhone,
      storesWithLocation,
      districtRows,
      topDistrictCount,
      districtCount: districtSet.size,
      wardCount: wardSet.size,
      last7DaysStores,
      newestCreatedAt: newestCreatedAt ? new Date(newestCreatedAt).toISOString() : null,
      verificationRate,
    }
  }, [stores])

  const fallbackHealth = useMemo(() => buildDashboardHealthSummary({
    products,
    reconciliationRows,
    orders,
    purchases,
  }), [orders, products, purchases, reconciliationRows])

  const health = useMemo(() => {
    if (!aggregateReport) return fallbackHealth
    const sales = aggregateReport.sales || {}
    const purchasesSummary = aggregateReport.purchases || {}
    const inventory = aggregateReport.inventory || {}
    const reconciliationIssueCount = reconciliationRows.filter((row) => (row.issue_codes || []).length > 0).length
    return {
      ...fallbackHealth,
      lowStockCount: Number(inventory.low_stock_count ?? fallbackHealth.lowStockCount),
      reconciliationIssueCount,
      activeOrderCount: Number(sales.order_count ?? fallbackHealth.activeOrderCount),
      activePurchaseCount: Number(purchasesSummary.purchase_count ?? fallbackHealth.activePurchaseCount),
      revenue: Number(sales.revenue ?? fallbackHealth.revenue),
      profit: Number(sales.profit ?? fallbackHealth.profit),
      purchaseAmount: Number(purchasesSummary.purchase_amount ?? fallbackHealth.purchaseAmount),
      needsAttention: Number(inventory.low_stock_count ?? fallbackHealth.lowStockCount) > 0 || reconciliationIssueCount > 0,
    }
  }, [aggregateReport, fallbackHealth, reconciliationRows])

  if (authLoading || !pageReady) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <>
      <Head>
        <title>Tổng quan - NPP Hà Công</title>
      </Head>

      <div className="min-h-screen">
        <div className="mx-auto max-w-[1900px] px-3 py-4 sm:px-4 sm:py-6 space-y-5">
          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={handleBack} className="border-slate-800 hover:bg-slate-900 transition-all">
              ← Quay lại
            </Button>
          </div>

          <Card className="rounded-3xl border border-slate-800/80 bg-slate-950/70 backdrop-blur-md shadow-2xl">
            <CardContent className="p-4 sm:p-6 space-y-6">
              <PageHeader
                title="Tổng quan"
                subtitle="Theo dõi số lượng cửa hàng, chất lượng dữ liệu và trạng thái vận hành hệ thống."
                actions={(
                  <Button type="button" variant="outline" size="sm" onClick={loadDashboard} disabled={loading} className="border-slate-700 bg-slate-900/60 font-bold hover:bg-slate-800 transition-all cursor-pointer">
                    {loading ? 'Đang tải...' : 'Làm mới'}
                  </Button>
                )}
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="rounded-2xl bg-blue-950/20 border border-blue-900/50 p-4 transition-all duration-300 hover:bg-blue-950/30">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-400">Tổng cửa hàng</p>
                  <p className="mt-1.5 text-3xl font-extrabold text-blue-200">{summary.totalStores}</p>
                </div>
                <div className="rounded-2xl bg-emerald-950/20 border border-emerald-900/50 p-4 transition-all duration-300 hover:bg-emerald-950/30">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Đã xác thực</p>
                  <p className="mt-1.5 text-3xl font-extrabold text-emerald-200">{summary.verifiedStores}</p>
                </div>
                <div className="rounded-2xl bg-amber-950/20 border border-amber-900/50 p-4 transition-all duration-300 hover:bg-amber-950/30">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Chưa xác thực</p>
                  <p className="mt-1.5 text-3xl font-extrabold text-amber-200">{summary.unverifiedStores}</p>
                </div>
                <div className="rounded-2xl bg-indigo-950/20 border border-indigo-900/50 p-4 transition-all duration-300 hover:bg-indigo-950/30">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Tỷ lệ xác thực</p>
                  <p className="mt-1.5 text-3xl font-extrabold text-indigo-200">{summary.verificationRate}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="rounded-2xl border border-slate-800/80 p-4 bg-slate-900/20 hover:bg-slate-900/40 transition-all duration-200">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Số huyện có dữ liệu</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-100">{summary.districtCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-800/80 p-4 bg-slate-900/20 hover:bg-slate-900/40 transition-all duration-200">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Số xã/phường có dữ liệu</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-100">{summary.wardCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-800/80 p-4 bg-slate-900/20 hover:bg-slate-900/40 transition-all duration-200">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Thêm trong 7 ngày</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-100">{summary.last7DaysStores}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 border-t border-slate-800/50 pt-5">
                <div className="rounded-2xl border border-slate-800/80 p-4 bg-slate-900/20 hover:bg-slate-900/40 transition-all duration-200">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Cửa hàng có số điện thoại</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-100">{summary.storesWithPhone}</p>
                </div>
                <div className="rounded-2xl border border-slate-800/80 p-4 bg-slate-900/20 hover:bg-slate-900/40 transition-all duration-200">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Cửa hàng có tọa độ</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-100">{summary.storesWithLocation}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 p-4 bg-slate-900/30 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Dữ liệu cập nhật mới nhất</p>
                <p className="text-sm font-extrabold text-blue-400 bg-blue-950/20 border border-blue-900/40 px-3 py-1 rounded-full">{formatDateTime(summary.newestCreatedAt)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-800/80 bg-slate-950/70 backdrop-blur-md shadow-2xl">
            <CardContent className="space-y-5 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/50 pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-100">Vận hành hôm nay</h2>
                  <p className="mt-1 text-sm font-medium text-slate-400">Theo dõi dòng tài chính doanh thu, tồn kho và đối soát tức thì.</p>
                </div>
                <Badge variant={health.needsAttention ? 'warning' : 'success'} className="uppercase tracking-wide">
                  {health.needsAttention ? 'Cần kiểm tra' : 'Ổn định'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-6">
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-4 transition-all duration-300 hover:bg-slate-900/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Doanh thu</p>
                  <p className="mt-1 text-2xl font-extrabold text-emerald-400">{formatMoney(health.revenue)}</p>
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-4 transition-all duration-300 hover:bg-slate-900/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Lợi nhuận</p>
                  <p className="mt-1 text-2xl font-extrabold text-sky-400">{formatMoney(health.profit)}</p>
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-4 transition-all duration-300 hover:bg-slate-900/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Đơn hàng</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-100">{health.activeOrderCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-4 transition-all duration-300 hover:bg-slate-900/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Nhập hàng</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-100">{health.activePurchaseCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-4 transition-all duration-300 hover:bg-slate-900/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tồn thấp</p>
                  <p className={`mt-1 text-2xl font-extrabold ${health.lowStockCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>{health.lowStockCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-4 transition-all duration-300 hover:bg-slate-900/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Lệch đối soát</p>
                  <p className={`mt-1 text-2xl font-extrabold ${health.reconciliationIssueCount > 0 ? 'text-red-400' : 'text-slate-300'}`}>{health.reconciliationIssueCount}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 border-t border-slate-800/40 pt-4">
                {OPERATOR_QUICK_ACTIONS.map((action) => (
                  <Button key={action.key} asChild variant="outline" className="h-12 justify-between border-slate-800/80 hover:border-slate-600 bg-slate-900/20 transition-all duration-200 rounded-xl cursor-pointer">
                    <a href={action.href} className="flex w-full items-center justify-between">
                      <span className="font-semibold text-slate-200">{action.label}</span>
                      <span className="rounded bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">{action.shortcut}</span>
                    </a>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-800/80 bg-slate-950/70 backdrop-blur-md shadow-2xl">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-800/50 pb-4 mb-2">
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-100">Số cửa hàng theo huyện</h2>
                  <p className="mt-0.5 text-sm text-slate-400">Mật độ bao phủ khách hàng trên từng địa bàn.</p>
                </div>
                <span className="rounded-full bg-slate-800 px-3.5 py-1 text-xs font-bold text-slate-300 border border-slate-700">{summary.districtRows.length} Huyện</span>
              </div>

              {loading && (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  <p className="text-sm font-semibold text-slate-400">Đang tải dữ liệu địa bàn...</p>
                </div>
              )}

              {!loading && error && (
                <div className="rounded-2xl border border-red-900 bg-red-950/20 p-4 text-center">
                  <p className="text-sm font-bold text-red-400">{error}</p>
                </div>
              )}

              {!loading && !error && summary.districtRows.length === 0 && (
                <div className="py-12 text-center rounded-2xl border border-dashed border-slate-850">
                  <p className="text-base text-slate-500 font-semibold">Chưa có dữ liệu cửa hàng nào được ghi nhận.</p>
                </div>
              )}

              {!loading && !error && summary.districtRows.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {summary.districtRows.map((row) => {
                    const widthPercent = Math.round((row.count / summary.topDistrictCount) * 100)
                    return (
                      <div key={row.district} className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-4 hover:bg-slate-900/50 transition-all duration-200">
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <p className="text-base font-bold text-slate-100">{row.district}</p>
                          <span className="rounded-full bg-blue-500/10 px-3 py-0.5 text-xs font-extrabold text-blue-400 border border-blue-500/20">{row.count} cửa hàng</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-850/50">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-400 shadow-[0_0_8px_rgba(59,130,246,0.35)]" style={{ width: `${widthPercent}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
