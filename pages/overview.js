import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'
import { FullPageLoading } from '@/components/ui/full-page-loading'
import { OPERATOR_QUICK_ACTIONS } from '@/helper/operatorWorkflow'
import { useDashboardData } from '@/hooks/useDashboardData'
import { KpiGrid } from '@/components/dashboard/kpi-grid'
import { RecentOrders } from '@/components/dashboard/recent-orders'
import { DistrictChart } from '@/components/dashboard/district-chart'
import { formatDateTime } from '@/helper/storeAnalytics'

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

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) { setPageReady(false); router.replace('/login?from=/overview'); return }
    if (!isAdmin) { setPageReady(false); router.replace('/account'); return }
    setPageReady(true)
  }, [authLoading, isAuthenticated, isAdmin, router])

  const {
    stores,
    orders,
    summary,
    health,
    loading,
    error,
  } = useDashboardData()

  if (authLoading || !pageReady) {
    return <FullPageLoading visible message="Đang kiểm tra đăng nhập..." />
  }

  return (
    <div className="content-inner">

      {/* ── Page Title ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Tổng quan</h1>
        <p className="text-sm text-muted mt-1">Theo dõi hoạt động kinh doanh và cửa hàng trên toàn hệ thống</p>
      </div>

      <KpiGrid loading={loading} error={error} summary={summary} health={health} />

      {!loading && !error && (
        <>
          <div className="cols-2">
            {/* Quick Actions */}
            <div className="bg-gray-900 border border-gray-700 rounded p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-foreground">Thao tác nhanh</h3>
                <Link className="text-sm text-accent hover:underline" href="/orders">Xem tất cả</Link>
              </div>
              <div>
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

            <DistrictChart districtRows={summary.districtRows} topDistrictCount={summary.topDistrictCount} />
          </div>

          <RecentOrders orders={orders} stores={stores} />

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
