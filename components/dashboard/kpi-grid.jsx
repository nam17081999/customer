import { formatMoney } from '@/api/inventory/inventory-client'

export function KpiGrid({ loading, error, summary, health }) {
  if (loading) {
    return (
      <div className="kpi-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="kpi-card">
            <div className="kpi-label" style={{ height: 12, background: 'var(--surface2)', borderRadius: 4, width: '60%', marginBottom: 8 }} />
            <div className="kpi-value" style={{ height: 32, background: 'var(--surface2)', borderRadius: 6, width: '40%' }} />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ background: 'oklch(60% 0.16 28 / 0.1)', border: '1px solid oklch(60% 0.16 28 / 0.2)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--red)' }}>{error}</p>
      </div>
    )
  }

  return (
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
    </>
  )
}
