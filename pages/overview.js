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

      <div className="min-h-screen bg-black">
        <div className="mx-auto max-w-[1900px] px-3 py-4 sm:px-4 sm:py-6 space-y-4">
          <div>
            <Button type="button" variant="outline" size="sm" onClick={handleBack}>
              ← Quay lại
            </Button>
          </div>

          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-100">Tổng quan</h1>
                  <p className="text-base text-gray-400">
                    Theo dõi số lượng cửa hàng và trạng thái xác thực.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={loadDashboard} disabled={loading}>
                  {loading ? 'Đang tải...' : 'Làm mới'}
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-blue-950/30 border border-blue-900 p-3">
                  <p className="text-xs uppercase tracking-wide text-blue-300">Tổng cửa hàng</p>
                  <p className="text-3xl font-bold text-blue-200">{summary.totalStores}</p>
                </div>
                <div className="rounded-xl bg-green-950/30 border border-green-900 p-3">
                  <p className="text-xs uppercase tracking-wide text-green-300">Đã xác thực</p>
                  <p className="text-3xl font-bold text-green-200">{summary.verifiedStores}</p>
                </div>
                <div className="rounded-xl bg-amber-950/30 border border-amber-900 p-3">
                  <p className="text-xs uppercase tracking-wide text-amber-300">Chưa xác thực</p>
                  <p className="text-3xl font-bold text-amber-200">{summary.unverifiedStores}</p>
                </div>
                <div className="rounded-xl bg-purple-950/30 border border-purple-900 p-3">
                  <p className="text-xs uppercase tracking-wide text-purple-300">Tỷ lệ xác thực</p>
                  <p className="text-3xl font-bold text-purple-200">{summary.verificationRate}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-800 p-3 bg-gray-950">
                  <p className="text-sm text-gray-400">Số huyện có dữ liệu</p>
                  <p className="text-2xl font-semibold text-gray-100">{summary.districtCount}</p>
                </div>
                <div className="rounded-xl border border-gray-800 p-3 bg-gray-950">
                  <p className="text-sm text-gray-400">Số xã/phường có dữ liệu</p>
                  <p className="text-2xl font-semibold text-gray-100">{summary.wardCount}</p>
                </div>
                <div className="rounded-xl border border-gray-800 p-3 bg-gray-950">
                  <p className="text-sm text-gray-400">Thêm trong 7 ngày</p>
                  <p className="text-2xl font-semibold text-gray-100">{summary.last7DaysStores}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-800 p-3 bg-gray-950">
                  <p className="text-sm text-gray-400">Cửa hàng có số điện thoại</p>
                  <p className="text-2xl font-semibold text-gray-100">{summary.storesWithPhone}</p>
                </div>
                <div className="rounded-xl border border-gray-800 p-3 bg-gray-950">
                  <p className="text-sm text-gray-400">Cửa hàng có tọa độ</p>
                  <p className="text-2xl font-semibold text-gray-100">{summary.storesWithLocation}</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 p-3 bg-gray-950">
                <p className="text-sm text-gray-400">Dữ liệu mới nhất</p>
                <p className="text-base font-medium text-gray-100">{formatDateTime(summary.newestCreatedAt)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-100">Vận hành hôm nay</h2>
                  <p className="text-base text-gray-400">Doanh thu, tồn kho, đối soát và thao tác nhanh.</p>
                </div>
                <div className={health.needsAttention ? 'rounded-full border border-amber-900 bg-amber-950/30 px-3 py-1 text-sm text-amber-200' : 'rounded-full border border-green-900 bg-green-950/30 px-3 py-1 text-sm text-green-200'}>
                  {health.needsAttention ? 'Cần kiểm tra' : 'Ổn định'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                <div className="rounded-xl border border-gray-800 bg-gray-950 p-3"><p className="text-sm text-gray-400">Doanh thu</p><p className="text-2xl font-bold text-green-200">{formatMoney(health.revenue)}</p></div>
                <div className="rounded-xl border border-gray-800 bg-gray-950 p-3"><p className="text-sm text-gray-400">Lợi nhuận</p><p className="text-2xl font-bold text-sky-200">{formatMoney(health.profit)}</p></div>
                <div className="rounded-xl border border-gray-800 bg-gray-950 p-3"><p className="text-sm text-gray-400">Đơn hiệu lực</p><p className="text-2xl font-bold text-gray-100">{health.activeOrderCount}</p></div>
                <div className="rounded-xl border border-gray-800 bg-gray-950 p-3"><p className="text-sm text-gray-400">Nhập hiệu lực</p><p className="text-2xl font-bold text-gray-100">{health.activePurchaseCount}</p></div>
                <div className="rounded-xl border border-gray-800 bg-gray-950 p-3"><p className="text-sm text-gray-400">Tồn thấp</p><p className="text-2xl font-bold text-amber-200">{health.lowStockCount}</p></div>
                <div className="rounded-xl border border-gray-800 bg-gray-950 p-3"><p className="text-sm text-gray-400">Lệch đối soát</p><p className="text-2xl font-bold text-red-200">{health.reconciliationIssueCount}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {OPERATOR_QUICK_ACTIONS.map((action) => (
                  <Button key={action.key} asChild variant="outline" className="h-11 justify-between">
                    <a href={action.href}><span>{action.label}</span><span className="text-xs text-gray-500">{action.shortcut}</span></a>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-100">Số cửa hàng theo huyện</h2>
                <span className="text-sm text-gray-400">{summary.districtRows.length} huyện</span>
              </div>

              {loading && <p className="text-base text-gray-400">Đang tải dữ liệu...</p>}

              {!loading && error && (
                <div className="rounded-lg border border-red-900 bg-red-950/30 p-3">
                  <p className="text-base text-red-300">{error}</p>
                </div>
              )}

              {!loading && !error && summary.districtRows.length === 0 && (
                <p className="text-base text-gray-400">Chưa có dữ liệu cửa hàng.</p>
              )}

              {!loading && !error && summary.districtRows.length > 0 && (
                <div className="space-y-2">
                  {summary.districtRows.map((row) => {
                    const widthPercent = Math.round((row.count / summary.topDistrictCount) * 100)
                    return (
                      <div key={row.district} className="rounded-xl border border-gray-800 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-base font-medium text-gray-100">{row.district}</p>
                          <p className="text-base font-semibold text-gray-100">{row.count}</p>
                        </div>
                        <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${widthPercent}%` }} />
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
