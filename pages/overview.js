import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { StatusBadge } from '@/components/ui/status-badge'
import { getOrRefreshStores } from '@/lib/storeCache'
import { formatMoney, getDashboardAggregateReport, getInventoryReconciliationReport, listProductsWithStock, listPurchaseOrders, listSalesOrders } from '@/api/inventory/inventory-client'
import { buildDashboardHealthSummary, OPERATOR_QUICK_ACTIONS } from '@/helper/operatorWorkflow'

function formatDateTime(value) {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu'
  return date.toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function isToday(value) {
  if (!value) return false
  const d = new Date(value)
  const n = new Date()
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
}

function isYesterday(value) {
  if (!value) return false
  const d = new Date(value)
  const y = new Date()
  y.setDate(y.getDate() - 1)
  return d.getDate() === y.getDate() && d.getMonth() === y.getMonth() && d.getFullYear() === y.getFullYear()
}

function formatOrderTime(value) {
  if (!value) return ''
  if (isToday(value)) return formatTime(value)
  if (isYesterday(value)) return 'Hôm qua'
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

function hasValidCoordinates(store) {
  const lat = Number(store?.latitude)
  const lng = Number(store?.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

const QA_ICONS = [
  () => <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>,
  () => <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  () => <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  () => <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M16 4v12l-4-2-4 2V4m0 0H4v16h16V4h-4z" /></svg>,
  () => <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  () => <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>,
]

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
    if (!isAuthenticated) { setPageReady(false); router.replace('/login?from=/overview'); return }
    if (!isAdmin) { setPageReady(false); router.replace('/account'); return }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router])

  const loadDashboard = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [storeRows, productRows, orderRows, purchaseRows, reconciliationReport, dashboardAggregate] = await Promise.all([
        getOrRefreshStores(),
        listProductsWithStock(),
        listSalesOrders(20),
        listPurchaseOrders({ page: 1, pageSize: 20 }).then(r => r.orders || []),
        getInventoryReconciliationReport().catch(() => []),
        getDashboardAggregateReport().catch(() => null),
      ])
      setStores(storeRows || []); setProducts(productRows || [])
      setOrders(orderRows || []); setPurchases(purchaseRows || [])
      setReconciliationRows(reconciliationReport || [])
      setAggregateReport(dashboardAggregate)
    } catch {
      setError('Không tải được dữ liệu tổng quan. Vui lòng thử lại.')
      setStores([]); setProducts([]); setOrders([]); setPurchases([])
      setReconciliationRows([]); setAggregateReport(null)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (pageReady) loadDashboard() }, [pageReady, loadDashboard])

  const summary = useMemo(() => {
    const totalStores = stores.length
    const verifiedStores = stores.filter(s => s.active === true).length
    const unverifiedStores = totalStores - verifiedStores
    const districtSet = new Set()
    const wardSet = new Set()
    const districtCountMap = {}
    let newestCreatedAt = null
    let last7DaysStores = 0
    const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000

    stores.forEach(s => {
      const d = (s.district || '').trim()
      if (d) { districtSet.add(d); districtCountMap[d] = (districtCountMap[d] || 0) + 1 }
      const w = (s.ward || '').trim()
      if (w) wardSet.add(w)
      const t = new Date(s.created_at || '').getTime()
      if (!Number.isNaN(t)) {
        if (!newestCreatedAt || t > newestCreatedAt) newestCreatedAt = t
        if (t >= threshold) last7DaysStores += 1
      }
    })

    const districtRows = Object.entries(districtCountMap)
      .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0], 'vi')))
      .map(([district, count]) => ({ district, count }))
    const topDistrictCount = districtRows[0]?.count || 1
    const verificationRate = totalStores === 0 ? 0 : Math.round((verifiedStores / totalStores) * 100)

    return {
      totalStores, verifiedStores, unverifiedStores,
      districtRows, topDistrictCount,
      districtCount: districtSet.size, wardCount: wardSet.size,
      last7DaysStores, newestCreatedAt: newestCreatedAt ? new Date(newestCreatedAt).toISOString() : null,
      verificationRate,
    }
  }, [stores])

  const fallbackHealth = useMemo(() => buildDashboardHealthSummary({ products, reconciliationRows, orders, purchases }), [orders, products, purchases, reconciliationRows])
  const health = useMemo(() => {
    if (!aggregateReport) return fallbackHealth
    const sales = aggregateReport.sales || {}
    const purchasesSummary = aggregateReport.purchases || {}
    const inventory = aggregateReport.inventory || {}
    const reconciliationIssueCount = reconciliationRows.filter(r => (r.issue_codes || []).length > 0).length
    return {
      ...fallbackHealth,
      lowStockCount: Number(inventory.low_stock_count ?? fallbackHealth.lowStockCount),
      reconciliationIssueCount,
      activeOrderCount: Number(sales.order_count ?? fallbackHealth.activeOrderCount),
      activePurchaseCount: Number(purchasesSummary.purchase_count ?? fallbackHealth.activePurchaseCount),
      revenue: Number(sales.revenue ?? fallbackHealth.revenue),
      profit: Number(sales.profit ?? fallbackHealth.profit),
      purchaseAmount: Number(purchasesSummary.purchase_amount ?? fallbackHealth.purchaseAmount),
      needsAttention: (Number(inventory.low_stock_count ?? fallbackHealth.lowStockCount) > 0) || reconciliationIssueCount > 0,
    }
  }, [aggregateReport, fallbackHealth, reconciliationRows])

  if (authLoading || !pageReady) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <div className="content-inner">

      {/* ── Page Title ── */}
      <div className="page-title">
        <h1>Tổng quan</h1>
        <p>Theo dõi hoạt động kinh doanh và cửa hàng trên toàn hệ thống</p>
      </div>

      {/* ── KPI Grid ── */}
      {loading ? (
        <div className="kpi-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="kpi-card">
              <div className="kpi-label" style={{ height: 12, background: 'var(--surface2)', borderRadius: 4, width: '60%', marginBottom: 8 }} />
              <div className="kpi-value" style={{ height: 32, background: 'var(--surface2)', borderRadius: 6, width: '40%' }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{ background: 'oklch(60% 0.16 28 / 0.1)', border: '1px solid oklch(60% 0.16 28 / 0.2)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: 'var(--red)' }}>{error}</p>
        </div>
      ) : (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="shine" style={{ background: 'linear-gradient(90deg, var(--accent), oklch(60% 0.18 260))' }} />
              <div className="kpi-label">Tổng cửa hàng</div>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>{summary.totalStores}</div>
              <div className="kpi-sub">Toàn bộ hệ thống</div>
              {summary.last7DaysStores > 0 && (
                <div className="kpi-change up">↑ {summary.last7DaysStores} (7 ngày)</div>
              )}
            </div>
            <div className="kpi-card">
              <div className="shine" style={{ background: 'linear-gradient(90deg, var(--green), oklch(60% 0.14 150))' }} />
              <div className="kpi-label">Đã xác thực</div>
              <div className="kpi-value" style={{ color: 'var(--green)' }}>{summary.verifiedStores}</div>
              <div className="kpi-sub">{summary.totalStores > 0 ? `${summary.verificationRate}% tổng số` : 'Chưa có dữ liệu'}</div>
              {summary.verifiedStores > 0 && <div className="kpi-change up">↑ {summary.verifiedStores} cửa hàng</div>}
            </div>
            <div className="kpi-card">
              <div className="shine" style={{ background: 'linear-gradient(90deg, var(--amber), oklch(65% 0.16 90))' }} />
              <div className="kpi-label">Chưa xác thực</div>
              <div className="kpi-value" style={{ color: 'var(--amber)' }}>{summary.unverifiedStores}</div>
              <div className="kpi-sub">{summary.totalStores > 0 ? `${(100 - summary.verificationRate)}% tổng số` : 'Chưa có dữ liệu'}</div>
            </div>
            <div className="kpi-card">
              <div className="shine" style={{ background: 'linear-gradient(90deg, var(--purple), oklch(58% 0.14 295))' }} />
              <div className="kpi-label">Tỷ lệ xác thực</div>
              <div className="kpi-value" style={{ color: 'var(--purple)' }}>{summary.verificationRate}%</div>
              <div className="kpi-sub">{summary.totalStores > 0 ? `${summary.verifiedStores}/${summary.totalStores} cửa hàng` : 'Chưa có dữ liệu'}</div>
            </div>
          </div>

          {/* ── Operations Grid ── */}
          <div className="ops-grid">
            <div className="ops-card">
              <div className="ops-top">
                <span className="ops-label">Doanh thu hôm nay</span>
                <span className="ops-value" style={{ color: 'var(--green)' }}>{formatMoney(health.revenue)}</span>
              </div>
              <div className="ops-bar">
                <div className="ops-bar-fill" style={{ width: `${Math.min(100, Math.round((health.revenue || 0) / 50000000 * 100))}%`, background: 'var(--green)' }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                {health.activeOrderCount} đơn hiệu lực
              </div>
            </div>
            <div className="ops-card">
              <div className="ops-top">
                <span className="ops-label">Đơn đang xử lý</span>
                <span className="ops-value">{health.activeOrderCount}</span>
              </div>
              <div className="ops-bar">
                <div className="ops-bar-fill" style={{ width: `${Math.min(100, Math.round((health.activeOrderCount || 0) / 50 * 100))}%`, background: 'var(--accent)' }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                {health.reconciliationIssueCount > 0 ? `${health.reconciliationIssueCount} đơn cần đối soát` : 'Đơn hàng ổn định'}
              </div>
            </div>
            <div className="ops-card">
              <div className="ops-top">
                <span className="ops-label">Tồn kho thấp</span>
                <span className="ops-value" style={{ color: 'var(--amber)' }}>{health.lowStockCount}</span>
              </div>
              <div className="ops-bar">
                <div className="ops-bar-fill" style={{ width: `${Math.min(100, Math.round((health.lowStockCount || 0) / 15 * 100))}%`, background: 'var(--amber)' }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                {health.lowStockCount > 0 ? `${Math.min(health.lowStockCount, 3)} sản phẩm sắp hết` : 'Tồn kho ổn định'}
              </div>
            </div>
          </div>

          {/* ── Two columns ── */}
          <div className="cols-2">
            {/* Quick Actions */}
            <div className="card">
              <div className="card-header">
                <h3>Thao tác nhanh</h3>
                <Link href="/orders">Xem tất cả</Link>
              </div>
              <div className="card-body">
                <div className="qa-grid">
                  {OPERATOR_QUICK_ACTIONS.map((action, idx) => {
                    const IconComponent = QA_ICONS[idx]
                    return (
                      <Link key={action.key} href={action.href} className="qa-btn" style={{ textDecoration: 'none' }}>
                        {IconComponent && <IconComponent />}
                        {action.label}
                        {action.shortcut && <span className="shortcut">{action.shortcut}</span>}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* District Chart */}
            <div className="card">
              <div className="card-header">
                <h3>Cửa hàng theo huyện</h3>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{summary.districtRows.length} huyện</span>
              </div>
              <div className="card-body">
                {summary.districtRows.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 0' }}>
                    <p>Chưa có dữ liệu cửa hàng.</p>
                  </div>
                ) : (
                  <div>
                    {summary.districtRows.slice(0, 8).map((row) => (
                      <div key={row.district} className="district-row">
                        <span className="district-name">{row.district}</span>
                        <div className="district-bar-wrap">
                          <div className="district-bar-fill" style={{ width: `${Math.round((row.count / summary.topDistrictCount) * 100)}%`, background: 'linear-gradient(90deg, var(--accent), oklch(62% 0.18 252))' }} />
                        </div>
                        <span className="district-count">{row.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Recent Orders ── */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header" style={{ padding: '16px 20px 0' }}>
              <h3>Đơn hàng gần đây</h3>
              <Link href="/orders">Xem tất cả</Link>
            </div>
            <div className="card-body" style={{ paddingTop: 8 }}>
              {orders.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <p>Chưa có đơn hàng nào.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>Mã đơn</th>
                        <th>Cửa hàng</th>
                        <th>Trạng thái</th>
                        <th style={{ textAlign: 'right' }}>Giá trị</th>
                        <th style={{ textAlign: 'right' }}>Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 8).map((order) => (
                        <tr key={order.id}>
                          <td>
                            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                              {order.code || `#${String(order.id).slice(0, 8)}`}
                            </span>
                          </td>
                          <td className="order-store">
                            {(() => {
                              const s = stores.find(st => String(st.id) === String(order.customer_store_id))
                              return s?.name || order.customer_store_name || order.store_name || '—'
                            })()}
                          </td>
                          <td>
                            <StatusBadge status={order.status} />
                          </td>
                          <td className="order-amount" style={{ textAlign: 'right' }}>
                            {formatMoney(order.total_amount)}
                          </td>
                          <td className="order-time" style={{ textAlign: 'right' }}>
                            {formatOrderTime(order.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer Info ── */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Dữ liệu mới nhất: {formatDateTime(summary.newestCreatedAt)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {summary.districtCount} huyện · {summary.wardCount} xã/phường
              </span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>NPP Hà Công © 2026</span>
          </div>
        </>
      )}

    </div>
  )
}
